-- =====================================================================
-- 0008 (DOWN) — reverse CRM live dashboards
-- =====================================================================
alter table deals drop constraint if exists deals_source_chk;
alter table deals drop column if exists pv_reference;
alter table deals drop column if exists unit_number;
alter table deals drop column if exists unit_type;
alter table deals drop column if exists project_name;
alter table deals drop column if exists developer;
alter table deals drop column if exists source;

alter table leads drop column if exists registered_on;
alter table leads drop column if exists project_interest;
alter table leads drop column if exists budget_band;
alter table leads drop column if exists deal_status;
alter table leads drop column if exists raw_stage;
alter table leads drop column if exists notes;
alter table leads drop column if exists purpose;
alter table leads drop column if exists email;
alter table leads drop column if exists title;
