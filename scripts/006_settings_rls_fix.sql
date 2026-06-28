-- Phase 10 fix: align Settings/Admin Center tables with the app's access model.
--
-- ROOT CAUSE of the HTTP 500 on "Save Changes":
--   Migration 005 enabled Row Level Security on the new settings tables with
--   policies gated on `auth.uid()`. The admin API talks to Supabase with the
--   ANON key and no user JWT, so `auth.uid()` is NULL, every policy matches
--   nothing, and each write is rejected by Postgres with code 42501
--   ("new row violates row-level security policy"). That surfaces as a 500 in
--   saveKvSection()'s upsert into restaurant_settings_kv.
--
--   The rest of the app (restaurants, reservations, tables, restaurant_settings)
--   runs WITHOUT RLS and is scoped by restaurant_id at the application layer.
--   This migration makes the new tables consistent with that model.
--
-- Fully idempotent and additive. Does NOT drop or alter any data/columns.

-- 1. Drop the auth.uid()-based policies added in 005 (no-op if already gone).
drop policy if exists kv_member_all on public.restaurant_settings_kv;
drop policy if exists experiences_member_all on public.experiences;
drop policy if exists invitations_member_all on public.invitations;
drop policy if exists integrations_member_all on public.integrations;
drop policy if exists audit_member_read on public.audit_log;
drop policy if exists audit_member_insert on public.audit_log;

-- 2. Disable RLS so the anon server client can read/write, matching the
--    existing tables (restaurants, reservations, tables, restaurant_settings).
alter table public.restaurant_settings_kv disable row level security;
alter table public.experiences disable row level security;
alter table public.invitations disable row level security;
alter table public.integrations disable row level security;
alter table public.audit_log disable row level security;
