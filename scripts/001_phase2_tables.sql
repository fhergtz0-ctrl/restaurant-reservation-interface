-- Phase 2 migration: physical tables + automatic table assignment
-- Safe to run multiple times (idempotent).

-- 1. New `tables` table.
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  name text not null,
  capacity int not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- 2. Nullable `table_id` on reservations, referencing tables.
alter table public.reservations
  add column if not exists table_id uuid references public.tables (id);

-- Guarantee a single table can't be double-booked for the same
-- restaurant / date / time. (Partial index ignores legacy rows with no table.)
create unique index if not exists reservations_table_slot_unique
  on public.reservations (restaurant_name, reservation_date, reservation_time, table_id)
  where table_id is not null;

-- 3. Seed Maison Laurent's tables (idempotent: only inserts missing rows).
insert into public.tables (restaurant_name, name, capacity)
select v.restaurant_name, v.name, v.capacity
from (
  values
    ('Maison Laurent', 'Table 1', 2),
    ('Maison Laurent', 'Table 2', 2),
    ('Maison Laurent', 'Table 3', 4),
    ('Maison Laurent', 'Table 4', 4),
    ('Maison Laurent', 'Terrace 1', 6),
    ('Maison Laurent', 'VIP Booth', 8)
) as v (restaurant_name, name, capacity)
where not exists (
  select 1
  from public.tables t
  where t.restaurant_name = v.restaurant_name
    and t.name = v.name
);
