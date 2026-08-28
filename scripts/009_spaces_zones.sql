-- Phase 12B migration: K'áanche Spaces / Zones.
--
-- Introduces a normalized table of physical seating areas (Main Dining,
-- Terrace, Bar, VIP, Private Room, ...). This is the source of truth for
-- zone metadata that the Floor Plan, Tables, Table Combinations, and
-- Availability Engine will consume in later phases.
--
-- Fully ADDITIVE and IDEMPOTENT. Does NOT alter or drop any existing table,
-- column, or policy. In particular it does NOT touch public.tables — existing
-- tables keep their free-text `tables.zone` value (migration 004). Zones are
-- matched to tables by name (case-insensitive) at the application layer, so
-- existing data keeps working with no destructive rewrite. Safe to run
-- multiple times.
--
-- ACCESS MODEL (important): like reservations, tables, the settings tables
-- (after migration 006), and the schedule (migration 008), this table
-- intentionally runs WITHOUT row-level security. The app talks to Supabase
-- with the ANON key (no user JWT), so an auth.uid()-based policy would reject
-- every write. Access is scoped by restaurant_id at the application layer.
-- Do NOT enable RLS here without also giving the server an authenticated
-- client.

-- ---------------------------------------------------------------------------
-- restaurant_zones
--   capacity_override: when NULL, the app derives capacity from the tables
--   currently assigned to the zone. When set, it explicitly overrides that
--   calculated capacity. Table seat counts are NEVER duplicated into the zone.
--   display_order: ascending; lower sorts first. Ties broken by name.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  reservable boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  capacity_override integer check (capacity_override is null or capacity_override >= 0),
  color_tag text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate zone names within a single restaurant. Case-insensitive
-- so "Terrace" and "terrace" can't both exist. Matches the app-layer dedupe
-- and the name-based bridge to tables.zone.
create unique index if not exists restaurant_zones_name_unique
  on public.restaurant_zones (restaurant_id, lower(name));

-- Fast ordered fetch of a restaurant's zones.
create index if not exists restaurant_zones_restaurant_order_idx
  on public.restaurant_zones (restaurant_id, display_order, name);
