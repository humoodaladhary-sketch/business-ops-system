-- =====================================================================
-- 0012 (UP) — Close the listing-table RLS gap
-- users / communities / agents / properties / investment_metrics were
-- created by the public listing app (Prisma, camelCase) with RLS disabled:
-- fully readable AND writable with the anon key — users includes
-- passwordHash. Listing data is public-facing by intent ("drop inventory,
-- list it on any platform"), so: RLS on everywhere; public SELECT policies
-- on the catalog tables; NO policy at all on users (service-role / direct
-- Postgres connections only). Direct connections as the table owner bypass
-- RLS, so the listing app's writes keep working unchanged.
-- Applied to live via MCP on 2026-08-09 (migration version 0012_listing_rls).
-- Additive + reversible: 0012_listing_rls.down.sql
-- =====================================================================

alter table public.users              enable row level security;
alter table public.communities        enable row level security;
alter table public.agents             enable row level security;
alter table public.properties         enable row level security;
alter table public.investment_metrics enable row level security;

do $$ begin
  create policy public_read_communities on public.communities for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy public_read_agents on public.agents for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy public_read_properties on public.properties for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy public_read_metrics on public.investment_metrics for select using (true);
exception when duplicate_object then null; end $$;
