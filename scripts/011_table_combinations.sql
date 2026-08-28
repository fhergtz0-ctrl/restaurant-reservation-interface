-- Phase 12D migration: K'áanche Table Combinations.
--
-- Defines which physical tables may be joined together to seat larger parties
-- (e.g. T1 + T2 -> 8 seats). The future Availability Engine consumes these
-- when a single table can't fit a party. This migration only stores the data.
--
-- Fully ADDITIVE and IDEMPOTENT. Does NOT alter or drop any existing table,
-- column, or policy. In particular it does NOT touch public.tables — member
-- rows reference existing table UUIDs via FK and physical tables are never
-- modified or deleted by this feature. Safe to run multiple times.
--
-- ACCESS MODEL (important): like reservations, tables, the settings tables
-- (after migration 006), the schedule (008), zones (009), and special days
-- (010), these tables intentionally run WITHOUT row-level security. The app
-- talks to Supabase with the ANON key (no user JWT), so an auth.uid()-based
-- policy would reject every write. Access is scoped by restaurant_id at the
-- application layer. Do NOT enable RLS here without also giving the server an
-- authenticated client.

-- ---------------------------------------------------------------------------
-- restaurant_table_combinations (parent)
--   One row per named combination. capacity_override, when set, overrides the
--   capacity calculated from member tables. Table capacities are NEVER copied
--   here — the calculated capacity is always derived at read time from the
--   live member tables.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_table_combinations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  capacity_override integer check (capacity_override is null or capacity_override > 0),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate combination names within a single restaurant.
-- Case-insensitive so "Window Group" and "window group" can't both exist.
create unique index if not exists restaurant_table_combinations_name_unique
  on public.restaurant_table_combinations (restaurant_id, lower(name));

-- Fast ordered fetch of a restaurant's combinations.
create index if not exists restaurant_table_combinations_restaurant_idx
  on public.restaurant_table_combinations (restaurant_id, name);

-- ---------------------------------------------------------------------------
-- restaurant_table_combination_members (child)
--   Zero-or-more member tables per combination (the app requires >= 2). Each
--   references an existing physical table by UUID. Cascade-deletes with its
--   parent combination; deleting a combination NEVER deletes physical tables.
--   display_order preserves the "T1 + T2 + T3" ordering shown in the UI.
--
--   NOTE: table_id references public.tables(id). Existing tables are scoped by
--   restaurant_name (text, legacy model), so the application layer is
--   responsible for ensuring member tables belong to the combination's
--   restaurant — the FK only guarantees the table exists.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_table_combination_members (
  id uuid primary key default gen_random_uuid(),
  combination_id uuid not null
    references public.restaurant_table_combinations(id) on delete cascade,
  table_id uuid not null references public.tables(id),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  -- A physical table can appear in many combinations, but only once within a
  -- single combination.
  constraint table_combination_member_unique unique (combination_id, table_id)
);

-- Fast ordered fetch of a combination's members.
create index if not exists table_combination_members_parent_order_idx
  on public.restaurant_table_combination_members (combination_id, display_order);

-- Reverse lookup: which combinations include a given table.
create index if not exists table_combination_members_table_idx
  on public.restaurant_table_combination_members (table_id);
