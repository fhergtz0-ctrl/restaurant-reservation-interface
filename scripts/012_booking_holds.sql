-- Phase 13B migration: K'áanche temporary slot holds.
--
-- A hold reserves the physical table(s) for a guest for a short window
-- (BOOKING_HOLD_MINUTES, 5 min) between "guest picked a time" and "guest
-- confirmed". It is NOT a reservation: it auto-expires, never shows in the
-- confirmed book, and is converted into a real reservation in a later phase.
--
-- Fully ADDITIVE, IDEMPOTENT, NON-DESTRUCTIVE. Does NOT alter or drop any
-- existing table, column, or policy. Safe to run multiple times.
--
-- ACCESS MODEL (important): like reservations, tables, settings (after 006),
-- schedule (008), zones (009), special days (010) and combinations (011),
-- these tables intentionally run WITHOUT row-level security. The app talks to
-- Supabase with the ANON key (no user JWT). Concurrency-critical writes go
-- through the create_booking_hold() SECURITY DEFINER function below, which
-- serializes with an advisory lock and is backstopped by a GiST exclusion
-- constraint. Do NOT enable RLS here without also revisiting that function.

-- btree_gist lets a GiST exclusion constraint mix an equality operator (=) on
-- table_id (uuid) with the range-overlap operator (&&) on the time range.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- kaanche_clock_to_minutes(text) -> integer
--   Mirrors lib/availability-engine.parseClockToMinutes so the RPC parses the
--   same stored reservation_time strings ("7:30 PM" 12-hour, or "19:30"/
--   "19:30:00" 24-hour) into minutes-since-midnight. Returns NULL when
--   unparseable. IMMUTABLE so it can be used freely in predicates.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- booking_holds (parent)
--   One row per active hold. table_ids[] is a convenience read-back copy; the
--   authoritative per-table time-locks live in booking_hold_tables. start_minutes
--   + duration_minutes let overlap be computed in SQL. expires_at is the SINGLE
--   source of truth for expiration (lazy — see the loader and the RPC sweep).
-- ---------------------------------------------------------------------------
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

-- Fast active-hold lookups for a restaurant/date (loader + RPC recheck).
create index if not exists booking_holds_active_lookup_idx
  on public.booking_holds (restaurant_id, booking_date, status, expires_at);

-- ---------------------------------------------------------------------------
-- booking_hold_tables (child)
--   One row per held physical table, carrying the real timestamp range the
--   table is occupied for. The GiST exclusion constraint is the STRUCTURAL
--   race guarantee: two active child rows for the same table whose ranges
--   overlap cannot both exist. `during` is a genuine tstzrange derived from
--   booking_date + start_minutes (+ duration), so an overnight booking (e.g.
--   2026-12-31 23:30 + 120m -> 2027-01-01 01:30) crosses the calendar day
--   correctly. `active` is flipped false when the parent expires/cancels/
--   converts so the constraint stops blocking (lazy expiration is reconciled
--   with the constraint by the RPC's stale-sweep below).
-- ---------------------------------------------------------------------------
create table if not exists public.booking_hold_tables (
  hold_id  uuid not null references public.booking_holds(id) on delete cascade,
  table_id uuid not null references public.tables(id),
  during   tstzrange not null,
  active    boolean not null default true,
  exclude using gist (
    table_id with =,
    during   with &&
  ) where (active)
);

-- Cascade / reverse lookups.
create index if not exists booking_hold_tables_hold_idx
  on public.booking_hold_tables (hold_id);
create index if not exists booking_hold_tables_table_idx
  on public.booking_hold_tables (table_id) where (active);

-- ---------------------------------------------------------------------------
-- create_booking_hold(...) -> (hold_id, expires_at)
--   The ATOMIC commit. Runs entirely in one transaction:
--     0. sweep this restaurant's stale holds (expired -> status 'expired',
--        children active=false) so lazy expiration is reconciled with the
--        exclusion constraint (an expired hold must NOT block a new one).
--     1. advisory xact lock scoped to (restaurant, booking_date) — serializes
--        concurrent callers so the recheck+insert is atomic.
--     2. validate every candidate table still exists.
--     3. reject overlap with any ACTIVE, UNEXPIRED hold on a candidate table.
--     4. reject conflicting ACTIVE reservations (confirmed/seated) on the same
--        date (conservative — see note).
--     5. insert the parent hold.
--     6. insert one range-row per held table (gist constraint is the backstop).
--   Any conflict raises, rolling back so NO partial parent/child rows remain.
--
--   RESERVATION OVERLAP NOTE: reservations store no duration, so step 4 treats
--   an existing confirmed/seated reservation as occupying
--   [res_start, res_start + 600min) — 600 is the service default_duration cap
--   from migration 008, a conservative upper bound that NEVER misses a real
--   same-date overlap (it can only over-reject in the rare commit-race window,
--   which is fail-safe). Cross-midnight reservations recorded on the NEXT
--   calendar date are out of this same-date backstop's scope; those are caught
--   by the Node-side engine that runs immediately before this RPC. This is a
--   deliberate, documented limitation: hold-vs-hold is fully DB-enforced;
--   hold-vs-reservation is engine-accurate in Node with a conservative SQL
--   backstop here.
-- ---------------------------------------------------------------------------
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
  v_lock_key        bigint;
  v_cand_during     tstzrange;
  v_cand_end        integer := p_start_minutes + p_duration_minutes;
  v_existing_tables integer;
  v_id              uuid;
  v_expires         timestamptz;
  -- Conservative max stay for an EXISTING reservation (see note above).
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

  -- 1. Serialize hold creation for this restaurant-day.
  v_lock_key := hashtextextended(p_restaurant_id::text || '|' || p_booking_date::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  -- 0. Sweep stale holds for this restaurant so expired rows stop blocking.
  update public.booking_holds
     set status = 'expired'
   where restaurant_id = p_restaurant_id
     and status = 'active'
     and expires_at <= now();

  update public.booking_hold_tables bht
     set active = false
    from public.booking_holds h
   where bht.hold_id = h.id
     and bht.active
     and h.status <> 'active';

  -- Candidate occupancy as a real timestamp range (crosses midnight naturally).
  v_cand_during := tstzrange(
    (p_booking_date::timestamptz + make_interval(mins => p_start_minutes)),
    (p_booking_date::timestamptz + make_interval(mins => v_cand_end)),
    '[)'
  );

  -- 2. Every candidate table must still exist.
  select count(*) into v_existing_tables
    from public.tables
   where id = any(p_table_ids);
  if v_existing_tables <> array_length(p_table_ids, 1) then
    raise exception 'invalid_table' using errcode = '23503';
  end if;

  -- 3. Reject overlap with any ACTIVE, UNEXPIRED hold on a candidate table.
  if exists (
    select 1
      from public.booking_hold_tables bht
      join public.booking_holds h on h.id = bht.hold_id
     where bht.active
       and h.status = 'active'
       and h.expires_at > now()
       and bht.table_id = any(p_table_ids)
       and bht.during && v_cand_during
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  -- 4. Reject conflicting ACTIVE reservations (confirmed/seated), same date.
  if exists (
    select 1
      from public.reservations r
     where r.restaurant_name = p_restaurant_name
       and r.reservation_date = p_booking_date
       and r.status in ('confirmed','seated')
       and r.table_id = any(p_table_ids)
       and public.kaanche_clock_to_minutes(r.reservation_time) is not null
       and public.kaanche_clock_to_minutes(r.reservation_time) < v_cand_end
       and p_start_minutes < public.kaanche_clock_to_minutes(r.reservation_time) + c_max_res_stay
  ) then
    raise exception 'conflict' using errcode = '23P01';
  end if;

  -- 5. Insert the parent hold.
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

  -- 6. Insert one range-row per held table (structural exclusion backstop).
  insert into public.booking_hold_tables (hold_id, table_id, during, active)
  select v_id, t, v_cand_during, true
    from unnest(p_table_ids) as t;

  hold_id := v_id;
  expires_at := v_expires;
  return next;
end;
$$;

-- Allow the anon/authenticated roles the app uses to call the RPC.
grant execute on function public.create_booking_hold(
  uuid, text, date, text, integer, integer, integer, text, text, uuid, uuid[], integer
) to anon, authenticated;
grant execute on function public.kaanche_clock_to_minutes(text) to anon, authenticated;

-- OPTIONAL (not required): a pg_cron sweep purely for tidiness/auditing. Lazy
-- expiration already stops expired holds from blocking (loader filters on
-- expires_at; the RPC sweeps stale rows before each insert), so no job is
-- needed for correctness.
--   select cron.schedule('expire-booking-holds', '*/5 * * * *', $$
--     update public.booking_holds set status='expired'
--      where status='active' and expires_at <= now();
--     update public.booking_hold_tables bht set active=false
--       from public.booking_holds h
--      where bht.hold_id=h.id and bht.active and h.status<>'active';
--   $$);
