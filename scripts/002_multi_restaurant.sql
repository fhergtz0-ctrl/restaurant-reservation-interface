-- Phase 5 migration: multi-restaurant (SaaS) support.
-- Safe to run multiple times (idempotent). Backward compatible: the
-- existing restaurant_name columns are kept and continue to work.

-- 1. Restaurants + per-restaurant settings.
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  primary_color text default '#2563eb',
  currency text default 'MXN',
  timezone text default 'America/Mazatlan',
  booking_interval_minutes int default 30,
  min_party_size int default 1,
  max_party_size int default 12,
  created_at timestamptz not null default now()
);

-- 2. Seed the initial restaurant (idempotent via unique slug).
insert into public.restaurants (name, slug, description, location)
values (
  'Maison Laurent',
  'maison-laurent',
  'Contemporary French · Fine Dining',
  'SoHo, New York'
)
on conflict (slug) do nothing;

-- Seed default settings for Maison Laurent if it has none yet.
insert into public.restaurant_settings (restaurant_id)
select r.id
from public.restaurants r
where r.slug = 'maison-laurent'
  and not exists (
    select 1
    from public.restaurant_settings s
    where s.restaurant_id = r.id
  );

-- 3. Nullable restaurant_id on existing tables (kept alongside restaurant_name).
alter table public.reservations
  add column if not exists restaurant_id uuid references public.restaurants (id);

alter table public.tables
  add column if not exists restaurant_id uuid references public.restaurants (id);

-- 4. Backfill restaurant_id for existing Maison Laurent rows.
update public.reservations res
set restaurant_id = r.id
from public.restaurants r
where r.slug = 'maison-laurent'
  and res.restaurant_name = 'Maison Laurent'
  and res.restaurant_id is null;

update public.tables t
set restaurant_id = r.id
from public.restaurants r
where r.slug = 'maison-laurent'
  and t.restaurant_name = 'Maison Laurent'
  and t.restaurant_id is null;

-- Helpful indexes for per-restaurant filtering.
create index if not exists reservations_restaurant_id_idx
  on public.reservations (restaurant_id);
create index if not exists tables_restaurant_id_idx
  on public.tables (restaurant_id);
