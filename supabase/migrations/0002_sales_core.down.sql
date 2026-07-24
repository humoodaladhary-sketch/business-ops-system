-- =====================================================================
-- 0002 (DOWN) — reverse sales CRM core
-- =====================================================================
drop policy if exists comms_write on communications;
drop policy if exists comms_read on communications;
drop policy if exists targets_write on targets;
drop policy if exists targets_read on targets;
drop policy if exists commcfg_write on commission_config;
drop policy if exists commcfg_read on commission_config;
drop policy if exists assignments_write on assignments;
drop policy if exists assignments_read on assignments;
drop policy if exists deals_write on deals;
drop policy if exists deals_read on deals;
drop policy if exists stage_map_write on stage_mappings;
drop policy if exists stage_map_read on stage_mappings;
drop policy if exists leads_write on leads;
drop policy if exists leads_read on leads;

drop table if exists communications;
drop table if exists targets;
drop table if exists commission_config;
drop table if exists assignments;
drop table if exists deals;
drop table if exists stage_mappings;
drop table if exists leads;

alter table units drop column if exists feed;
alter table units drop column if exists status;

drop type if exists comm_direction;
drop type if exists comm_channel;
drop type if exists assignment_state;
drop type if exists lead_stage;
drop type if exists unit_feed;
drop type if exists unit_status;
