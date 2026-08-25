-- =====================================================================
-- 0012 (DOWN) — Reverses 0012_listing_rls.up.sql
-- WARNING: running this reopens the anon-key exposure on the listing
-- tables (including public.users with passwordHash). Only for rollback in
-- a controlled environment.
-- =====================================================================

drop policy if exists public_read_communities on public.communities;
drop policy if exists public_read_agents      on public.agents;
drop policy if exists public_read_properties  on public.properties;
drop policy if exists public_read_metrics     on public.investment_metrics;

alter table public.users              disable row level security;
alter table public.communities        disable row level security;
alter table public.agents             disable row level security;
alter table public.properties         disable row level security;
alter table public.investment_metrics disable row level security;
