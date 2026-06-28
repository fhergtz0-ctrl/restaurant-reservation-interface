-- Phase 10 migration: K'áanche Settings / Admin Center.
-- Fully additive and idempotent. Builds on 001-004. Does NOT alter or drop
-- any existing column, so the public booking flow keeps working unchanged.

-- ---------------------------------------------------------------------------
-- 1. Generic per-section settings store (JSONB).
--    One row per (restaurant, section). Used by config-style sections:
--    profile, contact, branding, reservations, notifications, online_booking,
--    billing. Flexible + future-proof for CRM/POS/KDS/Waitlist modules.
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_settings_kv (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  section text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (restaurant_id, section)
);

-- ---------------------------------------------------------------------------
-- 2. Experiences (prix-fixe menus, tasting events, special offerings).
-- ---------------------------------------------------------------------------
create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  duration_minutes integer not null default 120,
  min_guests integer not null default 1,
  max_guests integer not null default 8,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists experiences_restaurant_idx
  on public.experiences (restaurant_id);

-- ---------------------------------------------------------------------------
-- 3. Team invitations (pending members). Active members live in `profiles`.
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role text not null default 'Host',
  status text not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, email)
);
create index if not exists invitations_restaurant_idx
  on public.invitations (restaurant_id);

-- ---------------------------------------------------------------------------
-- 4. Integrations (per-restaurant external connections, toggle + config).
-- ---------------------------------------------------------------------------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);
create index if not exists integrations_restaurant_idx
  on public.integrations (restaurant_id);

-- ---------------------------------------------------------------------------
-- 5. Audit log (read-only activity trail of admin changes).
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_email text,
  action text not null,
  section text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_restaurant_idx
  on public.audit_log (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security. Scope every row to members of the restaurant.
--    Mirrors the permissive-by-membership model used elsewhere in the app.
-- ---------------------------------------------------------------------------
alter table public.restaurant_settings_kv enable row level security;
alter table public.experiences enable row level security;
alter table public.invitations enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_log enable row level security;

-- Helper predicate: the current user belongs to the row's restaurant.
do $$
begin
  -- restaurant_settings_kv
  if not exists (select 1 from pg_policies where policyname = 'kv_member_all') then
    create policy kv_member_all on public.restaurant_settings_kv
      for all using (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      ) with check (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'experiences_member_all') then
    create policy experiences_member_all on public.experiences
      for all using (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      ) with check (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'invitations_member_all') then
    create policy invitations_member_all on public.invitations
      for all using (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      ) with check (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'integrations_member_all') then
    create policy integrations_member_all on public.integrations
      for all using (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      ) with check (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'audit_member_read') then
    create policy audit_member_read on public.audit_log
      for select using (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'audit_member_insert') then
    create policy audit_member_insert on public.audit_log
      for insert with check (
        restaurant_id in (
          select restaurant_id from public.profiles where auth_user_id = auth.uid()
        )
      );
  end if;
end $$;
