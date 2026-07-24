-- =====================================================================
-- 0006 (UP) — Sync idempotency keys + project-catalog attributes
-- Prepares the DB for the Google Sheets → Supabase sync (sheets-ingest)
-- and the authoritative project catalog seed (0007). Purely additive and
-- idempotent; does NOT touch existing rows.
--   1) external_id + (organization_id, external_id) unique index on
--      staff_profiles and units — mirrors the 0005 pattern (which only
--      covered invoices/collections/leads/deals) so the sync can UPSERT
--      staff + units idempotently.
--   2) 'hold' added to the unit_status enum → available|hold|reserved|sold
--      (availability; publishing state stays on units.feed).
--   3) projects gains category / ownership_eligibility / ministry /
--      branded_residence (all nullable) + a (organization_id, name) unique
--      index used as the natural upsert key for the catalog seed and for the
--      sync's project-name resolution.
-- Reversible: 0006_sync_keys_and_catalog.down.sql
-- =====================================================================

-- 1) Sync idempotency keys for staff + units (mirror 0005) ------------------
alter table staff_profiles add column if not exists external_id text;
alter table units          add column if not exists external_id text;
create unique index if not exists staff_profiles_org_ext_uniq on staff_profiles(organization_id, external_id) where external_id is not null;
create unique index if not exists units_org_ext_uniq          on units(organization_id, external_id)          where external_id is not null;

-- 2) Units can be placed on hold (availability, not publishing) --------------
alter type unit_status add value if not exists 'hold';

-- 3) Project-catalog attributes (all nullable) ------------------------------
do $$ begin create type project_category      as enum ('ITC','future_cities','surooh');           exception when duplicate_object then null; end $$;
do $$ begin create type ownership_eligibility as enum ('all_nationalities','gcc_omani_only');      exception when duplicate_object then null; end $$;

alter table projects add column if not exists category              project_category;
alter table projects add column if not exists ownership_eligibility ownership_eligibility;
alter table projects add column if not exists ministry              text;
alter table projects add column if not exists branded_residence     text;

-- Natural upsert key for the catalog seed (0007) and the sync's project lookup.
create unique index if not exists projects_org_name_uniq on projects(organization_id, name);
