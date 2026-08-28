-- Phase 12C migration: K'áanche Special Days (date-specific schedule overrides).
--
-- A Special Day overrides the recurring weekly Schedule (migration 008) for a
-- single calendar date: a closure (Christmas Day), a private event, a
-- maintenance day, or bespoke service hours (Christmas Eve dinner 17:00–21:00).
-- The Availability Engine will consume these in a later phase; this migration
-- only stores the data.
--
-- Fully ADDITIVE and IDEMPOTENT. Does NOT alter or drop any existing table,
-- column, or policy. In particular it does NOT touch the recurring schedule
-- (restaurant_service_periods) — Special Days are a separate, date-scoped
-- override layer. Safe to run multiple times.
--
-- ACCESS MODEL (important): like reservations, tables, the settings tables
-- (after migration 006), the schedule (008), and zones (009), these tables
-- intentionally run WITHOUT row-level security. The app talks to Supabase with
-- the ANON key (no user JWT), so an auth.uid()-based policy would reject every
-- write. Access is scoped by restaurant_id at the application layer. Do NOT
-- enable RLS here without also giving the server an authenticated client.

-- ---------------------------------------------------------------------------
-- restaurant_special_days
--   One definition per restaurant per calendar date (unique constraint).
--   is_open = false  -> the date is a full closure (zero availability),
--                       regardless of the recurring weekly schedule.
--   is_open = true   -> the date uses the child service periods below instead
--                       of the recurring weekly schedule.
--   type: 'holiday' | 'private_event' | 'maintenance' | 'special_service'
--         | 'other' (validated at the application layer; no enum so new types
--         never require a migration).
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_special_days (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  special_date date not null,
  name text not null,
  type text not null default 'other',
  is_open boolean not null default false,
  description text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One Special Day definition per restaurant per date.
create unique index if not exists restaurant_special_days_date_unique
  on public.restaurant_special_days (restaurant_id, special_date);

-- Fast chronological fetch of a restaurant's special days.
create index if not exists restaurant_special_days_restaurant_date_idx
  on public.restaurant_special_days (restaurant_id, special_date);

-- ---------------------------------------------------------------------------
-- restaurant_special_day_periods
--   Zero or more service windows for an OPEN special day. Mirrors the shape of
--   restaurant_service_periods (008) but is scoped to a single special day
--   rather than a weekday. Cascade-deletes with its parent special day.
--   Overnight services (e.g. NYE 18:00 -> 01:00) are represented with an
--   end_time that is <= start_time and interpreted as crossing midnight by the
--   application layer.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_special_day_periods (
  id uuid primary key default gen_random_uuid(),
  special_day_id uuid not null
    references public.restaurant_special_days(id) on delete cascade,
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
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_day_period_party_range check (min_party_size <= max_party_size)
);

-- Fast ordered fetch of a special day's periods.
create index if not exists special_day_periods_parent_order_idx
  on public.restaurant_special_day_periods (special_day_id, display_order, start_time);
