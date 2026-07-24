-- Row-Level Security for Alwalaa CRM (Phase 6).
--
-- Model: each Supabase auth user carries app_metadata.role ('ADMIN' | 'AGENT')
-- and app_metadata.agent_id (= Agent.id) in their JWT. Admins (CEO) see all;
-- agents see only their own rows, plus the shared leaderboard snapshot.
--
-- IMPORTANT: Prisma connects via a privileged role and BYPASSES RLS. So either
--   (a) serve user-scoped reads through the Supabase client (anon/auth role), or
--   (b) when using Prisma for a user request, run under a restricted role and
--       set the JWT claims per transaction, e.g.:
--         SET LOCAL ROLE authenticated;
--         SET LOCAL request.jwt.claims = '{"role":"AGENT","agent_id":"..."}';
-- The app layer (src/infrastructure/auth) enforces the same scoping today.

-- Helpers ---------------------------------------------------------------------
create or replace function app_role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
                  current_setting('request.jwt.claims', true)::jsonb ->> 'role',
                  'AGENT');
$$;

create or replace function app_agent_id() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'agent_id',
                  current_setting('request.jwt.claims', true)::jsonb ->> 'agent_id');
$$;

create or replace function is_admin() returns boolean language sql stable as $$
  select app_role() = 'ADMIN';
$$;

-- Idempotency: drop any policies from a previous run so this file is always
-- safe to re-run (e.g. after a partially-applied earlier version).
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Leads: agent sees their assigned leads ---------------------------------------
alter table "Lead" enable row level security;
create policy lead_admin_all on "Lead" for all using (is_admin()) with check (is_admin());
create policy lead_agent_read on "Lead" for select using ("assignedAgentId" = app_agent_id());
create policy lead_agent_update on "Lead" for update using ("assignedAgentId" = app_agent_id());

-- Deals & attribution: agent sees deals they are attributed on -----------------
alter table "DealAttribution" enable row level security;
create policy attr_admin_all on "DealAttribution" for all using (is_admin()) with check (is_admin());
create policy attr_agent_read on "DealAttribution" for select using ("agentId" = app_agent_id());

alter table "Deal" enable row level security;
create policy deal_admin_all on "Deal" for all using (is_admin()) with check (is_admin());
create policy deal_agent_read on "Deal" for select using (
  is_admin() or exists (
    select 1 from "DealAttribution" da where da."dealId" = "Deal".id and da."agentId" = app_agent_id()
  )
);

-- Commission: agent sees commission on their own attributions -------------------
alter table "Commission" enable row level security;
create policy comm_admin_all on "Commission" for all using (is_admin()) with check (is_admin());
create policy comm_agent_read on "Commission" for select using (
  is_admin() or exists (
    select 1 from "DealAttribution" da where da.id = "Commission"."attributionId" and da."agentId" = app_agent_id()
  )
);

-- Targets: own only ------------------------------------------------------------
alter table "Target" enable row level security;
create policy target_admin_all on "Target" for all using (is_admin()) with check (is_admin());
create policy target_agent_read on "Target" for select using ("agentId" = app_agent_id());

-- Monthly snapshot: readable by ALL authenticated (the shared leaderboard) ------
alter table "MonthlyPerformanceSnapshot" enable row level security;
create policy snap_admin_all on "MonthlyPerformanceSnapshot" for all using (is_admin()) with check (is_admin());
create policy snap_read_all on "MonthlyPerformanceSnapshot" for select using (auth.role() = 'authenticated');

-- At-risk reviews & rewards: own only (rewards visible to all for the board) ----
alter table "AtRiskReview" enable row level security;
create policy review_admin_all on "AtRiskReview" for all using (is_admin()) with check (is_admin());
create policy review_agent_read on "AtRiskReview" for select using ("agentId" = app_agent_id());

alter table "Reward" enable row level security;
create policy reward_admin_all on "Reward" for all using (is_admin()) with check (is_admin());
create policy reward_read_all on "Reward" for select using (auth.role() = 'authenticated');

-- Config tables (ladder, floors, developer rules, agents, projects) are readable
-- by all authenticated users; only admins write.
do $$
declare t text;
begin
  foreach t in array array['CommissionLadder','LeadSourceFloor','DeveloperCommissionRule','Agent','Developer','Project','StageMapping'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.role() = ''authenticated'')', t || '_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin', t);
  end loop;
end $$;

-- PII / KYC: Client records are sensitive. Admins see all; an agent sees a client
-- only if one of that client's leads is assigned to them.
alter table "Client" enable row level security;
create policy client_admin_all on "Client" for all using (is_admin()) with check (is_admin());
create policy client_agent_read on "Client" for select using (
  exists (select 1 from "Lead" l where l."clientId" = "Client".id and l."assignedAgentId" = app_agent_id())
);

-- Conversation log: agent sees touches they made or that belong to their lead.
alter table "CommunicationLog" enable row level security;
create policy comm_log_admin_all on "CommunicationLog" for all using (is_admin()) with check (is_admin());
create policy comm_log_agent_read on "CommunicationLog" for select using (
  "agentId" = app_agent_id()
  or exists (select 1 from "Lead" l where l.id = "CommunicationLog"."leadId" and l."assignedAgentId" = app_agent_id())
);

-- Inventory (Unit) & Settings are shared read, admin write.
do $$
declare t text;
begin
  foreach t in array array['Unit','Setting'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.role() = ''authenticated'')', t || '_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Audit log: admin-only.
alter table "AuditLog" enable row level security;
create policy audit_admin_all on "AuditLog" for all using (is_admin()) with check (is_admin());
