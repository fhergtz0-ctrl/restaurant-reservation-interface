-- Phase 12A migration: K'áanche Availability Engine — Weekly Schedule.
--
-- Introduces the recurring weekly operating/reservation schedule as a
-- normalized table (one row per service period per weekday). This becomes the
-- source of truth for booking availability in later phases.
--
-- Fully ADDITIVE and IDEMPOTENT. Does NOT alter or drop any existing table,
-- column, or policy. Safe to run multiple times.
--
-- ACCESS MODEL (important): like reservations, tables, and the settings tables
-- after migration 006, this table intentionally runs WITHOUT row-level
-- security. The app talks to Supabase with the ANON key (no user JWT), so an
-- auth.uid()-based policy would reject every write (this was the root cause of
-- the Settings 500 fixed in 006). Access is scoped by restaurant_id at the
-- application layer instead. Do NOT enable RLS here without also giving the
-- server an authenticated client.

-- ---------------------------------------------------------------------------
-- restaurant_service_periods
--   day_of_week: 0 = Monday ... 6 = Sunday (matches the Mon–Sun UI order).
--   A weekday with zero active rows is treated as "Closed" by the app; there
--   is no separate closed flag to keep the model normalized.
--   Overnight services (e.g. 18:00 → 00:00) are represented with an end_time
--   that is <= start_time and interpreted as crossing midnight by the app.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_service_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  name text not null default 'Service',
  start_time time not null,
  end_time time not null,
  booking_interval_minutes integer not null default 30
    check (booking_interval_minutes in (15, 30, 60)),
  default_duration_minutes integer not null default 90
    check (default_duration_minutes between 15 and 600),
  min_party_size integer not null default 1
    check (min_party_size >= 1),
  max_party_size integer not null default 8
    check (max_party_size >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- party size sanity: min must never exceed max.
  constraint service_period_party_range check (min_party_size <= max_party_size)
);

-- Fast lookup of a restaurant's week, ordered by day then start time.
create index if not exists service_periods_restaurant_day_idx
  on public.restaurant_service_periods (restaurant_id, day_of_week, start_time);
