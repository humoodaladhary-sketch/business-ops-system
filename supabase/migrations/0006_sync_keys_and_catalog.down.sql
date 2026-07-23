-- =====================================================================
-- 0006 (DOWN) — revert sync keys + project-catalog attributes
-- =====================================================================

-- 3) Project-catalog attributes
drop index if exists projects_org_name_uniq;
alter table projects drop column if exists branded_residence;
alter table projects drop column if exists ministry;
alter table projects drop column if exists ownership_eligibility;
alter table projects drop column if exists category;
drop type if exists ownership_eligibility;
drop type if exists project_category;

-- 1) Sync idempotency keys
drop index if exists units_org_ext_uniq;
drop index if exists staff_profiles_org_ext_uniq;
alter table units          drop column if exists external_id;
alter table staff_profiles drop column if exists external_id;

-- 2) Remove 'hold' from unit_status. Postgres cannot DROP an enum value, so the
-- type is rebuilt without it. Safe ONLY because this migration merely made the
-- value available and nothing sets a unit to 'hold'. If a unit IS 'hold',
-- reassign it before reverting or the cast below will fail.
do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'unit_status' and e.enumlabel = 'hold'
  ) then
    alter table units alter column status drop default;
    alter type unit_status rename to unit_status_old;
    create type unit_status as enum ('available','reserved','sold');
    alter table units alter column status type unit_status using status::text::unit_status;
    alter table units alter column status set default 'available';
    drop type unit_status_old;
  end if;
end $$;
