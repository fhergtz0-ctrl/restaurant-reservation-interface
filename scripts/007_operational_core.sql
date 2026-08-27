-- Phase 11 migration: K'áanche operational core (floor service lifecycle).
-- Safe to run multiple times (idempotent). Additive and non-destructive:
-- it only ADDS nullable columns and never drops or rewrites existing data.
--
-- Service lifecycle enabled by these columns:
--   reservation.status: confirmed -> seated -> finished
--     (cancelled / no_show remain terminal, unchanged)
--   table operational state is DERIVED from the active reservation + the
--   persistent flags below (see lib/operations.ts):
--     available | reserved | seated | finishing | cleaning | blocked
--
-- The `status` column has no CHECK constraint, so the new 'finished' value
-- needs no schema change beyond this documentation.

-- 1. Reservation operational timestamps + source.
alter table public.reservations
  add column if not exists seated_at timestamptz;

alter table public.reservations
  add column if not exists finished_at timestamptz;

-- source: 'reservation' (default, includes public + admin bookings) | 'walk_in'
alter table public.reservations
  add column if not exists source text not null default 'reservation';

-- 2. Table cleaning marker. When set, the table is being turned over after a
--    finished service and stays in "Cleaning" until a host marks it available.
--    NULL = not cleaning. `blocked` (migration 004) still handles Blocked.
alter table public.tables
  add column if not exists cleaning_since timestamptz;

-- 3. Helpful indexes for the live floor queries (today's active service).
create index if not exists reservations_seated_at_idx
  on public.reservations (seated_at)
  where seated_at is not null;

create index if not exists reservations_source_idx
  on public.reservations (source);

-- 4. Backfill: any reservation already in 'seated' state without a seated_at
--    gets one so its live timer has a source of truth. Uses created_at when
--    present, otherwise now(). Non-destructive (only fills NULLs).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'created_at'
  ) then
    update public.reservations
    set seated_at = coalesce(seated_at, created_at, now())
    where status = 'seated' and seated_at is null;
  else
    update public.reservations
    set seated_at = now()
    where status = 'seated' and seated_at is null;
  end if;
end $$;
