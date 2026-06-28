-- Phase 8 migration: interactive floor plan support.
-- Safe to run multiple times (idempotent). Builds on 001/002.
-- Adds optional zone + blocked columns to tables. The app degrades
-- gracefully when these are absent, so applying this is optional but
-- recommended for the full floor-plan experience.

-- 1. Zone groups tables visually (Main Dining, Terrace, VIP, Bar, ...).
alter table public.tables
  add column if not exists zone text;

-- 2. Blocked marks a table as out of service on the floor plan.
alter table public.tables
  add column if not exists blocked boolean not null default false;

-- 3. Seed zones for the original Maison Laurent tables (idempotent:
--    only fills rows that don't have a zone yet).
update public.tables t
set zone = case
  when t.name in ('Table 1', 'Table 2') then 'Main Dining'
  when t.name in ('Table 3', 'Table 4') then 'Main Dining'
  when t.name ilike '%terrace%' then 'Terrace'
  when t.name ilike '%vip%' or t.name ilike '%booth%' then 'VIP'
  when t.name ilike '%bar%' then 'Bar'
  else 'Main Dining'
end
where t.zone is null;
