-- Phase 13B migration: K'áanche UNIFIED INVENTORY architecture.
--
-- This migration introduces a single authoritative physical-occupancy table,
-- public.restaurant_inventory_blocks, that represents BOTH booking holds and
-- reservations. A GiST exclusion constraint on that table is the hard
-- structural guarantee that no two active blocks for the same physical table
-- can ever overlap in time — regardless of which code path (hold creation,
-- hold->reservation conversion, direct reservation, walk-in, table move) or
-- how many callers race.
--
--   booking_holds            = booking WORKFLOW state (metadata, countdown,
--                              conversion pointer). NOT the inventory source.
--   restaurant_inventory_blocks = physical INVENTORY state (the exclusion
--                              constraint lives here; one row per occupied
--                              physical table per hold/reservation).
--
-- Fully ADDITIVE, IDEMPOTENT, NON-DESTRUCTIVE:
--   * creates the btree_gist extension
--   * creates booking_holds and restaurant_inventory_blocks
--   * adds NULLABLE duration_minutes + occupancy_range to reservations
--   * creates/updates helper functions and the inventory RPCs
-- It does NOT delete reservations, overwrite reservation_date/reservation_time,
-- invent exact historical durations, or change any RLS model. Safe to re-run.
--
-- ACCESS MODEL: like reservations, tables, settings (006), schedule (008),
-- zones (009), special days (010) and combinations (011), these tables
-- intentionally run WITHOUT row-level security. The app talks to Supabase with
-- the ANON key (no user JWT). Every concurrency-critical write goes through a
-- SECURITY DEFINER RPC below that (a) takes the shared advisory lock and (b) is
-- backstopped by the GiST exclusion constraint. Do NOT enable RLS here without
-- revisiting those functions.
--
-- MIGRATION ORDER: assumes the earlier migrations (reservations base, 002
-- restaurant_id, 007 operational columns seated_at/finished_at/source, 008
-- schedule, 011 combinations) have already been applied — the RPCs reference
-- those columns/tables.

-- btree_gist lets a GiST exclusion constraint mix an equality operator (=) on
-- table_id (uuid) with the range-overlap operator (&&) on a tstzrange.
create extension if not exists btree_gist;

-- ===========================================================================
-- Helper: kaanche_clock_to_minutes(text) -> integer
--   Mirrors lib/availability-engine.parseClockToMinutes so SQL parses the same
--   stored reservation_time / booking_time strings ("7:30 PM" 12-hour, or
--   "19:30"/"19:30:00" 24-hour) into minutes-since-midnight. NULL when
--   unparseable. IMMUTABLE so it can be used freely in predicates.
-- ===========================================================================
create or replace function public.kaanche_clock_to_minutes(p_time text)
returns integer
language plpgsql
immutable
as $$
declare
  v  text := btrim(coalesce(p_time, ''));
  m  text[];
  h  int;
  mi int;
  ap text;
begin
  if v = '' then
    return null;
  end if;

  -- 12-hour "H:MM AM/PM"
  m := regexp_match(v, '^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$');
  if m is not null then
    h  := (m[1])::int % 12;
    mi := (m[2])::int;
    ap := upper(m[3]);
    if ap = 'PM' then
      h := h + 12;
    end if;
    if mi > 59 then
      return null;
    end if;
    return h * 60 + mi;
  end if;

  -- 24-hour "HH:MM" (optionally with seconds)
  m := regexp_match(v, '^(\d{1,2}):(\d{2})');
  if m is not null then
    h  := (m[1])::int;
    mi := (m[2])::int;
    if h > 23 or mi > 59 then
      return null;
    end if;
    return h * 60 + mi;
  end if;

  return null;
end;
$$;

-- ===========================================================================
-- Helper: kaanche_build_range(date, start_minutes, duration_minutes)
--   Builds the half-open [start, end) tstzrange for an occupancy the same way
--   lib/booking-holds.computeHoldWindow does: booking_date at midnight +
--   start_minutes, extended by duration_minutes. A booking that starts at 23:30
--   and lasts 120 minutes ends at 01:30 the NEXT calendar day, so the range
--   naturally crosses midnight. IMMUTABLE for use in predicates/generated rows.
-- ===========================================================================
create or replace function public.kaanche_build_range(
  p_date            date,
  p_start_minutes   integer,
  p_duration_minutes integer
)
returns tstzrange
language sql
immutable
as $$
  select tstzrange(
    (p_date::timestamptz + make_interval(mins => p_start_minutes)),
    (p_date::timestamptz + make_interval(mins => p_start_minutes + p_duration_minutes)),
    '[)'
  );
$$;

-- ===========================================================================
-- Helper: kaanche_lock_dates(restaurant_id, start_date, end_date)
--   The SHARED advisory-lock convention used by EVERY inventory-changing RPC so
--   the key calculation can never diverge between functions. Lock scope is
--   (restaurant_id + calendar day). An interval crossing midnight touches two
--   days, so both are locked — ALWAYS in ascending date order to avoid
--   deadlocks between two callers that straddle the same midnight.
-- ===========================================================================
create or replace function public.kaanche_lock_dates(
  p_restaurant_id uuid,
  p_start_date    date,
  p_end_date      date
)
returns void
language plpgsql
as $$
declare
  d      date;
  dates  date[];
begin
  if p_start_date = p_end_date then
    dates := array[p_start_date];
  elsif p_start_date < p_end_date then
    dates := array[p_start_date, p_end_date];
  else
    dates := array[p_end_date, p_start_date];
  end if;

  foreach d in array dates loop
    perform pg_advisory_xact_lock(
      hashtextextended(p_restaurant_id::text || '|' || d::text, 0)
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Helper: kaanche_sweep_stale_holds(restaurant_id)
--   Lazy expiration reconciled with the exclusion constraint. Any active hold
--   past its expires_at is moved to status 'expired', and the inventory blocks
--   of ALL non-active holds are deactivated so they stop blocking. Must run
--   inside the caller's transaction (after the advisory lock) so an expired
--   hold never blocks a new one.
-- ===========================================================================
create or replace function public.kaanche_sweep_stale_holds(p_restaurant_id uuid)
returns void
language plpgsql
as $$
begin
  update public.booking_holds
     set status = 'expired'
   where restaurant_id = p_restaurant_id
     and status = 'active'
     and expires_at <= now();

  update public.restaurant_inventory_blocks b
     set active = false
    from public.booking_holds h
   where b.source_type = 'hold'
     and b.source_id = h.id
     and b.active
     and h.status <> 'active';
end;
$$;

-- ===========================================================================
-- reservations: additive occupancy columns
--   duration_minutes  — resolved-at-write-time stay length (nullable; legacy
--                       rows stay NULL because their exact duration cannot be
--                       derived — see the migration report / step notes).
--   occupancy_range   — materialized [start, end) tstzrange; the AUTHORITATIVE
--                       conflict model for NEW inventory-bearing reservations.
--                       NULL for legacy rows.
-- reservation_date / reservation_time are intentionally left untouched.
-- ===========================================================================
alter table public.reservations
  add column if not exists duration_minutes integer;

alter table public.reservations
  add column if not exists occupancy_range tstzrange;

-- Optional GiST support index for future range lookups (only materialized rows).
create index if not exists reservations_occupancy_idx
  on public.reservations using gist (table_id, occupancy_range)
  where occupancy_range is not null;

-- ===========================================================================
-- booking_holds (WORKFLOW metadata)
--   One row per hold. table_ids[] + combination_id record the chosen
--   allocation; the authoritative per-table time-locks live in
--   restaurant_inventory_blocks. expires_at is the SINGLE source of truth for
--   expiration (lazy — see the loader, kaanche_sweep_stale_holds, and the RPC).
-- ===========================================================================
create table if not exists public.booking_holds (
  id                       uuid primary key default gen_random_uuid(),
  restaurant_id            uuid not null references public.restaurants(id) on delete cascade,
  restaurant_name          text not null,               -- tables/reservations are name-scoped
  booking_date             date not null,
  booking_time             text not null,               -- 12-hour display, same convention as reservations
  start_minutes            integer not null check (start_minutes >= 0 and start_minutes < 1440),
  duration_minutes         integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  party_size               integer not null check (party_size >= 1),
  service_name             text,
  allocation_type          text not null check (allocation_type in ('table','combination')),
  combination_id           uuid references public.restaurant_table_combinations(id) on delete set null,
  table_ids                uuid[] not null check (array_length(table_ids, 1) >= 1),
  status                   text not null default 'active'
                             check (status in ('active','converted','expired','cancelled')),
  expires_at               timestamptz not null,
  converted_reservation_id uuid references public.reservations(id) on delete set null,
  created_at               timestamptz not null default now()
);

-- Fast active-hold lookups for a restaurant/date (loader + RPC sweep).
create index if not exists booking_holds_active_lookup_idx
  on public.booking_holds (restaurant_id, booking_date, status, expires_at);

-- ===========================================================================
-- restaurant_inventory_blocks (UNIFIED physical INVENTORY)
--   One row per occupied physical table, for a hold OR a reservation. `during`
--   is a real tstzrange, so overnight occupancy is represented as one
--   continuous range. The partial GiST exclusion constraint is THE structural
--   guarantee: two ACTIVE rows for the same table whose ranges overlap cannot
--   coexist. `active` is flipped false on expire/cancel/finish so the
--   constraint stops blocking. A table combination produces one row per member
--   table (same source_type/source_id/during) so every member is protected.
--
--   source_id is deliberately NOT a polymorphic FK (it points at booking_holds
--   OR reservations depending on source_type). Lifecycle is managed by the RPCs
--   and the ON DELETE CASCADE from restaurants keeps orphan cleanup simple.
-- ===========================================================================
create table if not exists public.restaurant_inventory_blocks (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id      uuid not null references public.tables(id),
  source_type   text not null check (source_type in ('hold','reservation')),
  source_id     uuid not null,
  during        tstzrange not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  exclude using gist (
    table_id with =,
    during   with &&
  ) where (active)
);

-- Restaurant / source / table lookups.
create index if not exists inventory_blocks_restaurant_idx
  on public.restaurant_inventory_blocks (restaurant_id, active);
create index if not exists inventory_blocks_source_idx
  on public.restaurant_inventory_blocks (source_type, source_id);
create index if not exists inventory_blocks_table_idx
  on public.restaurant_inventory_blocks (table_id) where (active);

-- One active block per (source, table) so a source can't duplicate its own lock.
create unique index if not exists inventory_blocks_source_table_active_uidx
  on public.restaurant_inventory_blocks (source_type, source_id, table_id)
  where (active);

-- ===========================================================================
-- create_booking_hold(...) -> (hold_id, expires_at)
--   ATOMIC hold creation. One transaction:
--     1. validate inputs; build the candidate occupancy range.
--     2. advisory lock(s) for the range's calendar day(s).
--     3. sweep this restaurant's stale holds (reconcile lazy expiration).
--     4. verify every candidate table still exists.
--     5. reject overlap with any ACTIVE inventory block (hold OR reservation)
--        on a candidate table.
--     6. reject overlap with LEGACY reservations that have no block yet
--        (occupancy_range IS NULL) using a conservative 600-min assumed stay.
--     7. insert booking_holds (workflow row).
--     8. insert one restaurant_inventory_blocks row per held table.
--   Any conflict raises, rolling back so NO partial parent/child rows remain.
--   The GiST exclusion constraint is the final structural backstop for step 8.
--
--   LEGACY note (step 6): reservations created before this migration store no
--   duration and no range. They are treated as occupying [res_start,
--   res_start + 600min) — a conservative upper bound (600 = the service
--   default_duration cap from migration 008) that never misses a real same-date
--   overlap. Cross-midnight legacy reservations recorded on the NEXT calendar
--   date are out of this backstop's scope; those remain covered by the Node
--   Availability Engine. NEW reservations carry real blocks (step 5), so this
--   backstop is only for un-materialized legacy rows.
-- ===========================================================================
create or replace function public.create_booking_hold(
  p_restaurant_id    uuid,
  p_restaurant_name  text,
  p_booking_date     date,
  p_booking_time     text,
  p_start_minutes    integer,
  p_duration_minutes integer,
  p_party_size       integer,
  p_service_name     text,
  p_allocation_type  text,
  p_combination_id   uuid,
  p_table_ids        uuid[],
  p_hold_minutes     integer
)
returns table (hold_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_during      tstzrange;
  v_end_minutes integer := p_start_minutes + p_duration_minutes;
  v_existing    integer;
  v_id          uuid;
  v_expires     timestamptz;
  c_max_res_stay constant integer := 600;
begin
  if p_table_ids is null or array_length(p_table_ids, 1) is null then
    raise exception 'invalid_allocation' using errcode = '22023';
  end if;
  if p_allocation_type not in ('table','combination') then
    raise exception 'invalid_allocation' using errcode = '22023';
  end if;
  if coalesce(p_party_size, 0) < 1 or coalesce(p_duration_minutes, 0) <= 0 then
    raise exception 'invalid_allocation' using errcode = '22023';
  end if;

  -- 1. Candidate occupancy as a real range (crosses midnight naturally).
  v_during := public.kaanche_build_range(p_booking_date, p_start_minutes, p_duration_minutes);

  -- 2. Serialize on the range's calendar day(s).
  perform public.kaanche_lock_dates(
    p_restaurant_id, lower(v_during)::date, upper(v_during)::date
  );

  -- 3. Reconcile lazy expiration so expired holds stop blocking.
  perform public.kaanche_sweep_stale_holds(p_restaurant_id);

  -- 4. Every candidate table must still exist.
  select count(*) into v_existing
    from public.tables
   where id = any(p_table_ids);
  if v_existing <> array_length(p_table_ids, 1) then
    raise exception 'invalid_table' using errcode = '23503';
  end if;

  -- 5. Reject overlap with any ACTIVE inventory block on a candidate table.
  if exists (
    select 1
      from public.restaurant_inventory_blocks b
     where b.active
       and b.table_id = any(p_table_ids)
       and b.during && v_during
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  -- 6. Reject overlap with LEGACY (un-materialized) reservations, same date.
  if exists (
    select 1
      from public.reservations r
     where r.restaurant_name = p_restaurant_name
       and r.reservation_date = p_booking_date
       and r.status in ('confirmed','seated')
       and r.table_id = any(p_table_ids)
       and r.occupancy_range is null
       and public.kaanche_clock_to_minutes(r.reservation_time) is not null
       and public.kaanche_clock_to_minutes(r.reservation_time) < v_end_minutes
       and p_start_minutes < public.kaanche_clock_to_minutes(r.reservation_time) + c_max_res_stay
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  -- 7. Insert the workflow hold.
  insert into public.booking_holds (
    restaurant_id, restaurant_name, booking_date, booking_time,
    start_minutes, duration_minutes, party_size, service_name,
    allocation_type, combination_id, table_ids, status, expires_at
  ) values (
    p_restaurant_id, p_restaurant_name, p_booking_date, p_booking_time,
    p_start_minutes, p_duration_minutes, p_party_size, p_service_name,
    p_allocation_type, p_combination_id, p_table_ids, 'active',
    now() + make_interval(mins => p_hold_minutes)
  )
  returning id, expires_at into v_id, v_expires;

  -- 8. Insert one inventory block per held table (exclusion backstop).
  insert into public.restaurant_inventory_blocks (
    restaurant_id, table_id, source_type, source_id, during, active
  )
  select p_restaurant_id, t, 'hold', v_id, v_during, true
    from unnest(p_table_ids) as t;

  hold_id := v_id;
  expires_at := v_expires;
  return next;
end;
$$;

-- ===========================================================================
-- cancel_booking_hold(hold_id)
--   Transactional cancellation: mark the hold 'cancelled' and deactivate its
--   inventory blocks so the exclusion constraint stops blocking. Never
--   hard-deletes. Idempotent (no-op if already non-active / missing).
-- ===========================================================================
create or replace function public.cancel_booking_hold(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant uuid;
  v_date       date;
begin
  select restaurant_id, booking_date into v_restaurant, v_date
    from public.booking_holds
   where id = p_hold_id;
  if v_restaurant is null then
    return;
  end if;

  perform public.kaanche_lock_dates(v_restaurant, v_date, v_date);

  update public.booking_holds
     set status = 'cancelled'
   where id = p_hold_id
     and status = 'active';

  update public.restaurant_inventory_blocks
     set active = false
   where source_type = 'hold'
     and source_id = p_hold_id
     and active;
end;
$$;

-- ===========================================================================
-- create_reservation_from_hold(...) -> reservation_id   [Phase 13C readiness]
--   Atomic hold -> reservation conversion. NOT wired to any UI yet (no
--   guest-data collection in this phase); provided so 13C has an atomic,
--   zero-gap primitive.
--     1. SELECT hold FOR UPDATE; lock the range's day(s).
--     2. assert active + unexpired.
--     3. insert the reservation (with duration_minutes + occupancy_range).
--     4. CHANGE OWNERSHIP of the hold's existing block rows IN PLACE
--        (source_type hold -> reservation, source_id hold.id -> reservation.id).
--        The rows are never deactivated/reinserted, so the physical table is
--        continuously blocked — ZERO inventory gap.
--     5. mark hold 'converted' + set converted_reservation_id.
--   Combination holds keep reservations.table_id NULL (a single column cannot
--   represent multiple tables); every member table is still covered by its
--   converted block row.
-- ===========================================================================
create or replace function public.create_reservation_from_hold(
  p_hold_id        uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_customer_email text,
  p_notes          text,
  p_status         text default 'confirmed'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h        public.booking_holds%rowtype;
  v_during tstzrange;
  v_table  uuid;
  v_res_id uuid;
begin
  select * into h from public.booking_holds where id = p_hold_id for update;
  if h.id is null then
    raise exception 'hold_not_found' using errcode = 'P0002';
  end if;

  v_during := public.kaanche_build_range(h.booking_date, h.start_minutes, h.duration_minutes);
  perform public.kaanche_lock_dates(
    h.restaurant_id, lower(v_during)::date, upper(v_during)::date
  );

  if h.status <> 'active' or h.expires_at <= now() then
    raise exception 'hold_inactive' using errcode = '23P01';
  end if;

  if h.allocation_type = 'table' and array_length(h.table_ids, 1) = 1 then
    v_table := h.table_ids[1];
  else
    v_table := null;  -- combination: represented by the block rows, not a single column
  end if;

  insert into public.reservations (
    restaurant_id, restaurant_name, reservation_date, reservation_time,
    guests, customer_name, customer_phone, customer_email, notes,
    status, table_id, duration_minutes, occupancy_range
  ) values (
    h.restaurant_id, h.restaurant_name, h.booking_date, h.booking_time,
    h.party_size, p_customer_name, p_customer_phone, p_customer_email, p_notes,
    coalesce(p_status, 'confirmed'), v_table, h.duration_minutes, v_during
  )
  returning id into v_res_id;

  -- ZERO-GAP ownership change: same rows, still active.
  update public.restaurant_inventory_blocks
     set source_type = 'reservation',
         source_id   = v_res_id
   where source_type = 'hold'
     and source_id   = p_hold_id
     and active;

  update public.booking_holds
     set status = 'converted',
         converted_reservation_id = v_res_id
   where id = p_hold_id;

  return v_res_id;
end;
$$;

-- ===========================================================================
-- create_direct_reservation(...) -> reservation_id
--   Atomic reservation creation for the NON-hold paths (P1 public legacy
--   booking, P2 admin walk-in). Node still validates and picks the table; this
--   RPC performs the race-safe commit and materializes the inventory block so
--   direct reservations participate in the unified exclusion guarantee (a
--   direct reservation can no longer be created on a held table, and vice
--   versa). Duration is resolved at write time by the caller (default stay).
--     1. build range; lock day(s); sweep stale holds.
--     2. verify table exists.
--     3. reject overlap with active blocks; reject overlap with legacy
--        reservations (conservative, same date).
--     4. insert reservation (duration_minutes + occupancy_range populated).
--     5. insert the inventory block.
-- ===========================================================================
create or replace function public.create_direct_reservation(
  p_restaurant_id    uuid,
  p_restaurant_name  text,
  p_booking_date     date,
  p_reservation_time text,
  p_start_minutes    integer,
  p_duration_minutes integer,
  p_guests           integer,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_email   text,
  p_notes            text,
  p_table_id         uuid,
  p_status           text,
  p_source           text,
  p_seated_at        timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_during      tstzrange;
  v_end_minutes integer := p_start_minutes + p_duration_minutes;
  v_res_id      uuid;
  c_max_res_stay constant integer := 600;
begin
  if p_table_id is null then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if coalesce(p_guests, 0) < 1 or coalesce(p_duration_minutes, 0) <= 0 then
    raise exception 'invalid_allocation' using errcode = '22023';
  end if;

  v_during := public.kaanche_build_range(p_booking_date, p_start_minutes, p_duration_minutes);
  perform public.kaanche_lock_dates(
    p_restaurant_id, lower(v_during)::date, upper(v_during)::date
  );
  perform public.kaanche_sweep_stale_holds(p_restaurant_id);

  perform 1 from public.tables where id = p_table_id;
  if not found then
    raise exception 'invalid_table' using errcode = '23503';
  end if;

  -- vs active inventory blocks (holds + materialized reservations)
  if exists (
    select 1 from public.restaurant_inventory_blocks b
     where b.active and b.table_id = p_table_id and b.during && v_during
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  -- vs legacy (un-materialized) reservations, same date
  if exists (
    select 1 from public.reservations r
     where r.restaurant_name = p_restaurant_name
       and r.reservation_date = p_booking_date
       and r.status in ('confirmed','seated')
       and r.table_id = p_table_id
       and r.occupancy_range is null
       and public.kaanche_clock_to_minutes(r.reservation_time) is not null
       and public.kaanche_clock_to_minutes(r.reservation_time) < v_end_minutes
       and p_start_minutes < public.kaanche_clock_to_minutes(r.reservation_time) + c_max_res_stay
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  insert into public.reservations (
    restaurant_id, restaurant_name, reservation_date, reservation_time,
    guests, customer_name, customer_phone, customer_email, notes,
    status, table_id, duration_minutes, occupancy_range, source, seated_at
  ) values (
    p_restaurant_id, p_restaurant_name, p_booking_date, p_reservation_time,
    p_guests, p_customer_name, p_customer_phone, p_customer_email, p_notes,
    coalesce(p_status, 'confirmed'), p_table_id, p_duration_minutes, v_during,
    coalesce(p_source, 'reservation'), p_seated_at
  )
  returning id into v_res_id;

  insert into public.restaurant_inventory_blocks (
    restaurant_id, table_id, source_type, source_id, during, active
  ) values (
    p_restaurant_id, p_table_id, 'reservation', v_res_id, v_during, true
  );

  return v_res_id;
end;
$$;

-- ===========================================================================
-- reassign_reservation_table(reservation_id, new_table_id)
--   Atomic floor-plan MOVE (P3). Frees the reservation's current block(s) and
--   claims the new table under the shared lock, so a move cannot land on a
--   held or otherwise-occupied table. If the reservation has no materialized
--   range yet (legacy row), the range is resolved at write time from its
--   date/time + stored duration_minutes (default 90) and persisted — this is a
--   deliberate write-time resolution for the moved row only. Raises
--   'no_restaurant_scope' when the reservation has no restaurant_id (the caller
--   then falls back to a plain table_id update).
-- ===========================================================================
create or replace function public.reassign_reservation_table(
  p_reservation_id uuid,
  p_new_table_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        public.reservations%rowtype;
  v_during tstzrange;
  v_start  integer;
  v_dur    integer;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.id is null then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if r.restaurant_id is null then
    raise exception 'no_restaurant_scope' using errcode = '22023';
  end if;

  if r.occupancy_range is not null then
    v_during := r.occupancy_range;
  else
    v_start := public.kaanche_clock_to_minutes(r.reservation_time);
    if v_start is null then
      raise exception 'bad_time' using errcode = '22023';
    end if;
    v_dur := coalesce(r.duration_minutes, 90);
    v_during := public.kaanche_build_range(r.reservation_date, v_start, v_dur);
  end if;

  perform public.kaanche_lock_dates(
    r.restaurant_id, lower(v_during)::date, upper(v_during)::date
  );

  perform 1 from public.tables where id = p_new_table_id;
  if not found then
    raise exception 'invalid_table' using errcode = '23503';
  end if;

  -- Free the reservation's current block(s) first so a move within its own
  -- range never self-conflicts. Rolled back with the txn if the new claim fails.
  update public.restaurant_inventory_blocks
     set active = false
   where source_type = 'reservation'
     and source_id = p_reservation_id
     and active;

  if exists (
    select 1 from public.restaurant_inventory_blocks b
     where b.active and b.table_id = p_new_table_id and b.during && v_during
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  insert into public.restaurant_inventory_blocks (
    restaurant_id, table_id, source_type, source_id, during, active
  ) values (
    r.restaurant_id, p_new_table_id, 'reservation', p_reservation_id, v_during, true
  );

  update public.reservations
     set table_id = p_new_table_id,
         duration_minutes = coalesce(
           duration_minutes,
           (extract(epoch from (upper(v_during) - lower(v_during))) / 60)::integer
         ),
         occupancy_range = v_during
   where id = p_reservation_id;
end;
$$;

-- ===========================================================================
-- Grants: the anon/authenticated roles the app uses may call the RPCs.
-- ===========================================================================
grant execute on function public.kaanche_clock_to_minutes(text) to anon, authenticated;
grant execute on function public.kaanche_build_range(date, integer, integer) to anon, authenticated;
grant execute on function public.kaanche_lock_dates(uuid, date, date) to anon, authenticated;
grant execute on function public.kaanche_sweep_stale_holds(uuid) to anon, authenticated;
grant execute on function public.create_booking_hold(
  uuid, text, date, text, integer, integer, integer, text, text, uuid, uuid[], integer
) to anon, authenticated;
grant execute on function public.cancel_booking_hold(uuid) to anon, authenticated;
grant execute on function public.create_reservation_from_hold(
  uuid, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.create_direct_reservation(
  uuid, text, date, text, integer, integer, integer, text, text, text, text, uuid, text, text, timestamptz
) to anon, authenticated;
grant execute on function public.reassign_reservation_table(uuid, uuid) to anon, authenticated;

-- NOTE: lazy expiration + kaanche_sweep_stale_holds make a cron job unnecessary
-- for correctness (the loader filters on expires_at; every inventory RPC sweeps
-- stale holds before it checks/claims). A periodic sweep would be tidiness only.
