-- =====================================================================
-- 0008 (UP) — CRM live dashboards
-- The dashboards (Command Center / Performance / Analytics / Leaderboard /
-- Reports) move from the baked snapshot to Supabase as system of record.
-- Adds the display/attribution fields the Drive CRM history carries that
-- the original deals/leads tables did not: lead-source attribution (drives
-- the comp split), denormalized developer/project/unit labels for deals
-- whose sold units are not in current inventory, and the lead detail the
-- leads screens show. Additive + reversible: 0008_crm_live_dashboards.down.sql
-- =====================================================================

-- Deals: comp attribution + display labels ----------------------------
alter table deals add column if not exists source       text not null default 'ALWALAA';
alter table deals add column if not exists developer    text;
alter table deals add column if not exists project_name text;
alter table deals add column if not exists unit_type    text;
alter table deals add column if not exists unit_number  text;
alter table deals add column if not exists pv_reference text;

do $$ begin
  alter table deals add constraint deals_source_chk
    check (source in ('ALWALAA','REFERRAL','OWN'));
exception when duplicate_object then null; end $$;

-- Leads: the detail the CRM screens show ------------------------------
alter table leads add column if not exists title            text;
alter table leads add column if not exists email            text;
alter table leads add column if not exists purpose          text;
alter table leads add column if not exists notes            text;
alter table leads add column if not exists raw_stage        text;
alter table leads add column if not exists deal_status      text;
alter table leads add column if not exists budget_band      text;
alter table leads add column if not exists project_interest text;
alter table leads add column if not exists registered_on    date;
