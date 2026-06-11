-- =====================================================================
-- 0001 (UP) — Staff identity & role model
-- Extends the existing listing-app schema (organizations, profiles) WITHOUT
-- duplicating identity. profiles.role (owner/member/viewer) is left untouched;
-- the 9-role brokerage/department role lives in staff_profiles.
-- Reversible: 0001_staff_identity.down.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- Department / brokerage role across the whole org (9 roles).
do $$ begin
  create type staff_role as enum (
    'ceo','operations_manager','marketing_manager','hr_manager',
    'finance_head','sales_manager','team_leader','senior_advisor','advisor'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type agent_segment as enum ('diaspora','resident','na');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_status as enum ('active','probation','former');
exception when duplicate_object then null; end $$;

-- 1:1 extension of profiles. Models ALL employees (sales + non-sales).
-- Sales-only fields are nullable for HR/Finance/Marketing/Ops staff.
create table if not exists staff_profiles (
  id                  uuid primary key references profiles(id) on delete cascade,
  organization_id     uuid not null references organizations(id) on delete cascade,
  role                staff_role not null default 'advisor',
  manager_id          uuid references profiles(id) on delete set null,   -- reporting line
  status              staff_status not null default 'active',
  segment             agent_segment,
  start_date          date,
  monthly_target_omr  numeric(18,3),
  ramp_end_date       date,
  exempt_from_at_risk boolean not null default false,
  drive_folder_url    text,
  closed_docs_url     text,
  vouchers_url        text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists staff_profiles_org_idx     on staff_profiles(organization_id);
create index if not exists staff_profiles_role_idx    on staff_profiles(role);
create index if not exists staff_profiles_manager_idx on staff_profiles(manager_id);

drop trigger if exists trg_staff_profiles_touch on staff_profiles;
create trigger trg_staff_profiles_touch before update on staff_profiles
  for each row execute function _touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER so they read staff_profiles
-- WITHOUT triggering that table's own RLS (prevents policy recursion).
-- ---------------------------------------------------------------------
create or replace function my_staff_role() returns staff_role
  language sql stable security definer set search_path = public as $$
  select role from staff_profiles where id = auth.uid();
$$;

-- Caller's org, read WITHOUT profiles RLS (avoids the my_org() recursion risk).
create or replace function my_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function is_exec() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from staff_profiles where id = auth.uid()) = 'ceo', false)
      or coalesce((select role from profiles where id = auth.uid()) = 'owner', false);
$$;

-- Roles that see every lead/assignment in the org.
create or replace function can_see_all_leads() returns boolean
  language sql stable security definer set search_path = public as $$
  select is_exec() or coalesce(
    (select role from staff_profiles where id = auth.uid())
      in ('sales_manager','operations_manager','marketing_manager'), false);
$$;

-- Roles that see commission / payout money org-wide.
create or replace function can_see_money() returns boolean
  language sql stable security definer set search_path = public as $$
  select is_exec() or coalesce(
    (select role from staff_profiles where id = auth.uid())
      in ('finance_head','sales_manager'), false);
$$;

-- True when the caller is the direct manager (team leader / sales manager) of target.
create or replace function manages(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_profiles sp where sp.id = target and sp.manager_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- RLS: self read; managers read reports; HR/exec read+write all.
-- ---------------------------------------------------------------------
alter table staff_profiles enable row level security;

create policy staff_self_read on staff_profiles for select using (
  id = auth.uid()
  or (organization_id = my_org() and (
        is_exec()
        or my_staff_role() in ('hr_manager','sales_manager','operations_manager')
        or manager_id = auth.uid()
     ))
);

create policy staff_admin_write on staff_profiles for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
);
