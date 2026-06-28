-- Phase 6 migration: Authentication & SaaS foundation.
-- Safe to run multiple times (idempotent). Builds on 002_multi_restaurant.sql.
-- Does NOT touch the reservation flow tables' data.

-- 1. Extend restaurants with the SaaS profile columns.
alter table public.restaurants
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists logo text,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists subscription text not null default 'free';

-- 2. Profiles: links a Supabase Auth user to a restaurant with a role.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  name text,
  email text,
  role text not null default 'Owner'
    check (role in ('Owner', 'Manager', 'Host', 'Waiter')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_restaurant_id_idx
  on public.profiles (restaurant_id);

-- Row Level Security: a user can read/update only their own profile row.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = auth_user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = auth_user_id);

-- 3. Slug generator: derives a unique slug from a restaurant name.
create or replace function public.generate_restaurant_slug(base text)
returns text
language plpgsql
as $$
declare
  slug_base text;
  candidate text;
  n int := 0;
begin
  slug_base := regexp_replace(lower(trim(coalesce(base, ''))), '[^a-z0-9]+', '-', 'g');
  slug_base := trim(both '-' from slug_base);
  if slug_base = '' then
    slug_base := 'restaurant';
  end if;
  candidate := slug_base;
  while exists (select 1 from public.restaurants where slug = candidate) loop
    n := n + 1;
    candidate := slug_base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

-- 4. Onboarding trigger: on auth user creation, provision the restaurant
--    and the linked Owner profile. Runs as security definer so it works even
--    before the user's email is confirmed (no client session required).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_name text;
  v_owner_name text;
  v_restaurant_id uuid;
  v_slug text;
begin
  v_restaurant_name := nullif(trim(new.raw_user_meta_data ->> 'restaurant_name'), '');
  v_owner_name := nullif(trim(new.raw_user_meta_data ->> 'owner_name'), '');

  -- Provision a restaurant when the signup carried one.
  if v_restaurant_name is not null then
    v_slug := public.generate_restaurant_slug(v_restaurant_name);

    insert into public.restaurants (name, slug, email, description, active)
    values (v_restaurant_name, v_slug, new.email, 'Newly onboarded restaurant', true)
    returning id into v_restaurant_id;

    insert into public.restaurant_settings (restaurant_id)
    values (v_restaurant_id);
  end if;

  -- Always create the Owner profile, linked to the restaurant when present.
  insert into public.profiles (auth_user_id, restaurant_id, name, email, role)
  values (
    new.id,
    v_restaurant_id,
    coalesce(v_owner_name, split_part(new.email, '@', 1)),
    new.email,
    'Owner'
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
