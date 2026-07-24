-- =============================================================
-- Alwalaa OS — COMPLETE database bring-up (safe to run once or re-run).
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Base listing schema + sales/HR/finance modules + org & CEO seed.
-- =============================================================

-- Idempotency: clear any policies from a prior run so re-paste is safe.
do $idem$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop; end $idem$;

-- ==================== 0000_base_schema.sql ====================
-- =====================================================================
-- Alwalaa AI Listing Agent — Supabase schema
-- Paste into Supabase SQL editor as one script, or use as migration base.
--
-- Naming:
--   snake_case tables, plural. Enums are UPPER_SNAKE.
--   Every row has id (uuid), created_at, updated_at.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------

create extension if not exists "pgcrypto";   -- gen_random_uuid
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  create type unit_type as enum (
    'studio','apartment','townhouse','villa','sky_villa','penthouse','duplex','land','office'
  );
  create type ownership_type as enum ('freehold_itc','usufruct','leasehold','unknown');
  create type completion_status as enum ('ready','off_plan','under_construction');
  create type listing_intent as enum ('sale','rent');
  create type platform as enum (
    'property_finder','olx_oman','instagram','whatsapp','linkedin','website'
  );
  create type language as enum ('en','ar');
  create type field_source as enum ('extracted','inferred','assumed','missing');
  create type buyer_type as enum (
    'investor','end_user_family','luxury','first_time','foreign_expat','gcc_buyer'
  );
  create type report_type as enum ('investor','comparison','pitch');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  full_name text,
  role text default 'member',             -- 'owner' | 'member' | 'viewer'
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Projects (a developer master record + inventory bundle)
-- ---------------------------------------------------------------------

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,                     -- e.g. "Sultan Haitham City — Phase 1"
  developer text,
  location text,                          -- free-text for now
  zone text,                              -- ITC zone name if applicable
  ownership_type ownership_type default 'unknown',
  handover_date date,
  notes text,
  cover_image_file_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_org_idx on projects(organization_id);

-- ---------------------------------------------------------------------
-- Files (stored in Supabase Storage; this table holds metadata)
-- ---------------------------------------------------------------------

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid,                           -- filled when file is unit-specific
  storage_path text not null,             -- path in the 'alwalaa' bucket
  filename text not null,
  mime_type text,
  size_bytes bigint,
  kind text,                              -- 'inventory'|'brochure'|'floor_plan'|'render'|'payment_plan'|'other'
  vision_caption text,                    -- AI-generated for images
  extracted_text text,                    -- AI-extracted for PDFs
  created_at timestamptz default now()
);

create index if not exists files_project_idx on files(project_id);
create index if not exists files_unit_idx on files(unit_id);

-- ---------------------------------------------------------------------
-- Units (the canonical record per property)
-- ---------------------------------------------------------------------

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,

  -- Identifiers
  reference_id text not null,             -- broker SKU
  unit_number text,
  name text,

  -- Classification
  unit_type unit_type not null,
  completion_status completion_status default 'ready',
  intent listing_intent default 'sale',
  ownership_type ownership_type default 'unknown',

  -- Location
  building text,
  floor int,
  cluster text,
  phase text,

  -- Physical
  bedrooms int,
  bathrooms numeric(4,1),
  area_sqm numeric(10,2),
  plot_area_sqm numeric(10,2),
  view text,
  parking int,

  -- Commercial (all OMR)
  price_omr numeric(14,2),
  service_charge_omr_per_sqm numeric(10,2),
  payment_plan text,
  handover_date date,

  -- Free-form (agent extends via AI)
  amenities text[] default '{}',
  features text[] default '{}',
  community_features text[] default '{}',
  broker_notes text,

  -- Audit
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (project_id, reference_id)
);

create index if not exists units_project_idx on units(project_id);
create index if not exists units_org_idx on units(organization_id);

-- ---------------------------------------------------------------------
-- Unit fields — source-tagged per-field audit trail.
-- One row per (unit, field_name); lets us show extracted/inferred/assumed/missing
-- badges in the UI and point to the source file.
-- ---------------------------------------------------------------------

create table if not exists unit_fields (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  field_name text not null,               -- 'bedrooms', 'view', 'handover_date', ...
  value text,
  source field_source not null,
  source_file_id uuid references files(id) on delete set null,
  confidence numeric(3,2),                -- 0.00–1.00 from the model
  reasoning text,                         -- short AI explanation
  created_at timestamptz default now(),
  unique (unit_id, field_name)
);

create index if not exists unit_fields_unit_idx on unit_fields(unit_id);

-- ---------------------------------------------------------------------
-- ROI and liquidity scores (one set per unit; recompute replaces)
-- ---------------------------------------------------------------------

create table if not exists roi_scores (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references units(id) on delete cascade,
  rental_yield_low_pct numeric(4,2),      -- e.g. 6.50
  rental_yield_high_pct numeric(4,2),     -- e.g. 8.00
  demand_strength int,                    -- 1..10
  liquidity_score int,                    -- 1..10
  roi_score int,                          -- 1..10
  appreciation_score int,                 -- 1..10
  rationale jsonb,                        -- { rental_yield: "...", liquidity: "...", ... }
  model_version text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Buyer profile prediction (one per unit)
-- ---------------------------------------------------------------------

create table if not exists buyer_profiles (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references units(id) on delete cascade,
  primary_buyer buyer_type not null,
  secondary_buyer buyer_type,
  best_nationalities text[],              -- ranked
  motivation text,
  expected_rental_audience text,
  sales_angle text,
  objections jsonb,                       -- [{objection, response}, ...]
  model_version text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Listings (one per platform × language)
-- ---------------------------------------------------------------------

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  platform platform not null,
  language language not null,
  title text not null,
  body text not null,
  cta text,
  hashtags text[] default '{}',
  warnings text[] default '{}',
  model_version text,
  prompt_hash text,                       -- for cache audit
  edited_by_human boolean default false,
  edited_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (unit_id, platform, language)
);

create index if not exists listings_unit_idx on listings(unit_id);

-- ---------------------------------------------------------------------
-- Reports (investor, comparison, pitch artifacts)
-- ---------------------------------------------------------------------

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type report_type not null,
  title text,
  input_filter jsonb,                     -- the brief/filter used
  unit_ids uuid[],                        -- ordered list included in report
  body_markdown text,
  pdf_file_id uuid references files(id),
  whatsapp_pitch text,                    -- for comparison/pitch reports
  model_version text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Updated-at trigger helper
-- ---------------------------------------------------------------------

create or replace function _touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists trg_%1$I_touch on %1$I; ' ||
      'create trigger trg_%1$I_touch before update on %1$I ' ||
      'for each row execute function _touch_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table files           enable row level security;
alter table units           enable row level security;
alter table unit_fields     enable row level security;
alter table roi_scores      enable row level security;
alter table buyer_profiles  enable row level security;
alter table listings        enable row level security;
alter table reports         enable row level security;

-- Helper: caller's organization
create or replace function auth_org() returns uuid as $$
  select organization_id from profiles where id = auth.uid();
$$ language sql stable;

-- Same pattern applied per table: members of the same org read+write.
create policy "same_org_read_projects" on projects for select using (organization_id = auth_org());
create policy "same_org_write_projects" on projects for all using (organization_id = auth_org()) with check (organization_id = auth_org());

create policy "same_org_read_files" on files for select using (organization_id = auth_org());
create policy "same_org_write_files" on files for all using (organization_id = auth_org()) with check (organization_id = auth_org());

create policy "same_org_read_units" on units for select using (organization_id = auth_org());
create policy "same_org_write_units" on units for all using (organization_id = auth_org()) with check (organization_id = auth_org());

create policy "read_unit_fields" on unit_fields for select using (
  exists (select 1 from units u where u.id = unit_fields.unit_id and u.organization_id = auth_org())
);
create policy "write_unit_fields" on unit_fields for all using (
  exists (select 1 from units u where u.id = unit_fields.unit_id and u.organization_id = auth_org())
) with check (
  exists (select 1 from units u where u.id = unit_fields.unit_id and u.organization_id = auth_org())
);

create policy "read_roi" on roi_scores for select using (
  exists (select 1 from units u where u.id = roi_scores.unit_id and u.organization_id = auth_org())
);
create policy "write_roi" on roi_scores for all using (
  exists (select 1 from units u where u.id = roi_scores.unit_id and u.organization_id = auth_org())
) with check (
  exists (select 1 from units u where u.id = roi_scores.unit_id and u.organization_id = auth_org())
);

create policy "read_buyer_profiles" on buyer_profiles for select using (
  exists (select 1 from units u where u.id = buyer_profiles.unit_id and u.organization_id = auth_org())
);
create policy "write_buyer_profiles" on buyer_profiles for all using (
  exists (select 1 from units u where u.id = buyer_profiles.unit_id and u.organization_id = auth_org())
) with check (
  exists (select 1 from units u where u.id = buyer_profiles.unit_id and u.organization_id = auth_org())
);

create policy "same_org_read_listings" on listings for select using (organization_id = auth_org());
create policy "same_org_write_listings" on listings for all using (organization_id = auth_org()) with check (organization_id = auth_org());

create policy "same_org_read_reports" on reports for select using (organization_id = auth_org());
create policy "same_org_write_reports" on reports for all using (organization_id = auth_org()) with check (organization_id = auth_org());

create policy "self_read_profile" on profiles for select using (id = auth.uid() or organization_id = auth_org());
create policy "self_write_profile" on profiles for update using (id = auth.uid());

create policy "own_org_read" on organizations for select using (id = auth_org());

-- ==================== 0001_staff_identity.up.sql ====================
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

-- ==================== 0002_sales_core.up.sql ====================
-- =====================================================================
-- 0002 (UP) — Sales CRM core
-- Reuses profiles (identity), projects, units, files. Adds the genuinely
-- missing CRM tables. Money is numeric(18,3) (true 3-decimal OMR); rates are
-- numeric(6,4) fractions (3.5% -> 0.0350). Requires 0001 (helper functions).
-- Reversible: 0002_sales_core.down.sql
-- =====================================================================

do $$ begin create type unit_status as enum ('available','reserved','sold'); exception when duplicate_object then null; end $$;
do $$ begin create type unit_feed as enum ('published','private'); exception when duplicate_object then null; end $$;
do $$ begin create type lead_stage as enum ('new','qualified','engaged','viewing','negotiation','reservation','closed_won','closed_lost'); exception when duplicate_object then null; end $$;
do $$ begin create type assignment_state as enum ('pending','accepted','passed','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type comm_channel as enum ('whatsapp','email','call','meeting','teams','note','system'); exception when duplicate_object then null; end $$;
do $$ begin create type comm_direction as enum ('inbound','outbound','system'); exception when duplicate_object then null; end $$;

-- Extend EXISTING inventory (never a parallel table).
alter table units add column if not exists status unit_status not null default 'available';
alter table units add column if not exists feed   unit_feed   not null default 'private';
create index if not exists units_status_idx on units(status);

-- Leads ---------------------------------------------------------------
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  phone_e164          text,
  country_code        text,
  country             text,
  nationality         text,
  budget_min_omr      numeric(18,3),
  budget_max_omr      numeric(18,3),
  interest_project_id uuid references projects(id) on delete set null,
  stage               lead_stage not null default 'new',
  assigned_agent_id   uuid references profiles(id) on delete set null,
  source              text,
  last_touch_at       timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create unique index if not exists leads_org_phone_uniq on leads(organization_id, phone_e164) where phone_e164 is not null;
create index if not exists leads_stage_idx   on leads(stage);
create index if not exists leads_agent_idx   on leads(assigned_agent_id);
create index if not exists leads_org_idx     on leads(organization_id);
create index if not exists leads_project_idx on leads(interest_project_id);

-- Stage label mappings (external label -> canonical stage) ------------
create table if not exists stage_mappings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_label    text not null,
  canonical_stage lead_stage not null,
  agent_id        uuid references profiles(id) on delete cascade,   -- null = org-global
  created_at      timestamptz default now()
);
create unique index if not exists stage_map_agent_uniq  on stage_mappings(organization_id, source_label, agent_id) where agent_id is not null;
create unique index if not exists stage_map_global_uniq on stage_mappings(organization_id, source_label)           where agent_id is null;

-- Deals ---------------------------------------------------------------
create table if not exists deals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null references profiles(id) on delete restrict,
  lead_id         uuid references leads(id) on delete set null,
  client_name     text,
  project_id      uuid references projects(id) on delete set null,
  unit_id         uuid references units(id) on delete set null,
  value_omr       numeric(18,3) not null,
  developer_pct   numeric(6,4),
  gross_omr       numeric(18,3),
  split_pct       numeric(6,4),
  payout_omr      numeric(18,3),
  developer_paid  boolean not null default false,
  agent_paid      boolean not null default false,
  is_reservation  boolean not null default false,
  closed_at       timestamptz,                                       -- drives month attribution
  source_file_id  uuid references files(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists deals_agent_idx     on deals(agent_id);
create index if not exists deals_closed_idx    on deals(closed_at);
create index if not exists deals_project_idx   on deals(project_id);
create index if not exists deals_org_idx       on deals(organization_id);
create index if not exists deals_devpaid_idx   on deals(developer_paid);
create index if not exists deals_agentpaid_idx on deals(agent_paid);

-- Assignments (10-minute basket) --------------------------------------
create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  agent_id        uuid not null references profiles(id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  expires_at      timestamptz not null,
  state           assignment_state not null default 'pending',
  responded_at    timestamptz,
  created_at      timestamptz default now()
);
create index if not exists assignments_state_idx   on assignments(state);
create index if not exists assignments_expires_idx on assignments(expires_at);
create index if not exists assignments_agent_idx   on assignments(agent_id);
create index if not exists assignments_lead_idx    on assignments(lead_id);

-- Commission configuration (versioned) --------------------------------
create table if not exists commission_config (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  effective_from  date not null,
  ladder          jsonb not null default '[]',     -- [{tier, min_volume_omr, split_pct}]
  dev_rates       jsonb not null default '{}',     -- { "<developer>": rate_fraction }
  source_floors   jsonb not null default '{}',     -- { "<source>": floor_split_pct }
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  unique (organization_id, effective_from)
);

-- Targets (per agent per month) ---------------------------------------
create table if not exists targets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null references profiles(id) on delete cascade,
  period          text not null,                   -- 'YYYY-MM'
  target_omr      numeric(18,3) not null,
  source          text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (agent_id, period)
);

-- Communications / activity timeline ----------------------------------
create table if not exists communications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id         uuid references leads(id) on delete cascade,
  agent_id        uuid references profiles(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  channel         comm_channel not null,
  direction       comm_direction not null default 'outbound',
  body            text,
  outcome         text,
  occurred_at     timestamptz not null default now(),
  meta            jsonb,
  external_id     text,                            -- provider msg id (idempotent ingest)
  created_at      timestamptz default now()
);
create index if not exists comms_lead_idx     on communications(lead_id);
create index if not exists comms_agent_idx    on communications(agent_id);
create index if not exists comms_occurred_idx on communications(occurred_at desc);
create unique index if not exists comms_external_uniq on communications(organization_id, external_id) where external_id is not null;

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['leads','deals','targets'] loop
    execute format('drop trigger if exists trg_%1$I_touch on %1$I; create trigger trg_%1$I_touch before update on %1$I for each row execute function _touch_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row-level security (org-isolated; agent owns own; managers see reports)
-- ---------------------------------------------------------------------
alter table leads             enable row level security;
alter table stage_mappings    enable row level security;
alter table deals             enable row level security;
alter table assignments       enable row level security;
alter table commission_config enable row level security;
alter table targets           enable row level security;
alter table communications    enable row level security;

create policy leads_read on leads for select using (
  organization_id = my_org() and (can_see_all_leads() or assigned_agent_id = auth.uid() or manages(assigned_agent_id))
);
create policy leads_write on leads for all using (
  organization_id = my_org() and (can_see_all_leads() or assigned_agent_id = auth.uid() or manages(assigned_agent_id))
) with check (organization_id = my_org());

create policy stage_map_read on stage_mappings for select using (organization_id = my_org());
create policy stage_map_write on stage_mappings for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() in ('sales_manager','operations_manager'))
) with check (organization_id = my_org());

-- Ops can read deal rows (money columns withheld in the data layer); money roles,
-- the owning agent, and that agent's manager get full access.
create policy deals_read on deals for select using (
  organization_id = my_org() and (can_see_money() or agent_id = auth.uid() or manages(agent_id) or my_staff_role() = 'operations_manager')
);
create policy deals_write on deals for all using (
  organization_id = my_org() and (can_see_money() or agent_id = auth.uid() or manages(agent_id))
) with check (organization_id = my_org());

create policy assignments_read on assignments for select using (
  organization_id = my_org() and (can_see_all_leads() or agent_id = auth.uid() or manages(agent_id))
);
create policy assignments_write on assignments for all using (
  organization_id = my_org() and (can_see_all_leads() or agent_id = auth.uid() or manages(agent_id))
) with check (organization_id = my_org());

create policy commcfg_read on commission_config for select using (organization_id = my_org() and can_see_money());
create policy commcfg_write on commission_config for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());

create policy targets_read on targets for select using (
  organization_id = my_org() and (can_see_all_leads() or agent_id = auth.uid() or manages(agent_id))
);
create policy targets_write on targets for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'sales_manager')
) with check (organization_id = my_org());

create policy comms_read on communications for select using (
  organization_id = my_org() and (
    can_see_all_leads() or agent_id = auth.uid()
    or exists (select 1 from leads l where l.id = communications.lead_id and (l.assigned_agent_id = auth.uid() or manages(l.assigned_agent_id)))
  )
);
create policy comms_write on communications for all using (
  organization_id = my_org() and (
    can_see_all_leads() or agent_id = auth.uid()
    or exists (select 1 from leads l where l.id = communications.lead_id and (l.assigned_agent_id = auth.uid() or manages(l.assigned_agent_id)))
  )
) with check (organization_id = my_org());

-- ==================== 0003_hr.up.sql ====================
-- =====================================================================
-- 0003 (UP) — HR module
-- Employees, contracts, leaves (Oman labour categories — configurable),
-- attendance, KPIs/reviews, recruitment. Requires 0001 (helpers).
-- RLS: each employee sees their own; managers see reports; HR + exec full.
-- Reversible: 0003_hr.down.sql
-- =====================================================================

do $$ begin create type contract_type as enum ('full_time','part_time','fixed_term','consultant'); exception when duplicate_object then null; end $$;
do $$ begin create type contract_status as enum ('active','ended','terminated'); exception when duplicate_object then null; end $$;
do $$ begin create type leave_request_status as enum ('pending','approved','rejected','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type attendance_status as enum ('present','absent','late','half_day','remote','on_leave','holiday'); exception when duplicate_object then null; end $$;
do $$ begin create type review_status as enum ('draft','shared','acknowledged'); exception when duplicate_object then null; end $$;
do $$ begin create type opening_status as enum ('open','on_hold','filled','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type candidate_stage as enum ('applied','screening','interview','offer','hired','rejected'); exception when duplicate_object then null; end $$;

create table if not exists employment_contracts (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references organizations(id) on delete cascade,
  staff_id                    uuid not null references profiles(id) on delete cascade,
  type                        contract_type not null default 'full_time',
  start_date                  date not null,
  end_date                    date,
  basic_salary_omr            numeric(18,3),
  allowances                  jsonb not null default '{}',
  annual_leave_entitlement_days int not null default 30,
  probation_end_date          date,
  contract_file_id            uuid references files(id) on delete set null,
  status                      contract_status not null default 'active',
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);
create index if not exists contracts_staff_idx on employment_contracts(staff_id);
create index if not exists contracts_org_idx   on employment_contracts(organization_id);

create table if not exists leave_types (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  code                  text not null,
  name_en               text not null,
  name_ar               text,
  paid                  boolean not null default true,
  default_days_per_year numeric(5,1),
  oman_labour_note      text,
  active                boolean not null default true,
  created_at            timestamptz default now(),
  unique (organization_id, code)
);

create table if not exists leave_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  staff_id         uuid not null references profiles(id) on delete cascade,
  leave_type_id    uuid not null references leave_types(id) on delete restrict,
  start_date       date not null,
  end_date         date not null,
  working_days     numeric(5,1),
  reason           text,
  status           leave_request_status not null default 'pending',
  approved_by      uuid references profiles(id) on delete set null,
  approved_at      timestamptz,
  evidence_file_id uuid references files(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists leave_req_staff_idx  on leave_requests(staff_id);
create index if not exists leave_req_status_idx on leave_requests(status);

create table if not exists leave_balances (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  staff_id          uuid not null references profiles(id) on delete cascade,
  leave_type_id     uuid not null references leave_types(id) on delete cascade,
  year              int not null,
  entitled_days     numeric(5,1) not null default 0,
  carried_over_days numeric(5,1) not null default 0,
  taken_days        numeric(5,1) not null default 0,
  updated_at        timestamptz default now(),
  unique (staff_id, leave_type_id, year)
);

create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  work_date       date not null,
  check_in        timestamptz,
  check_out       timestamptz,
  status          attendance_status not null default 'present',
  worked_hours    numeric(5,2),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (staff_id, work_date)
);
create index if not exists attendance_date_idx on attendance(work_date);

create table if not exists performance_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  period          text not null,
  reviewer_id     uuid references profiles(id) on delete set null,
  kpis            jsonb not null default '{}',
  rating          numeric(3,1),
  strengths       text,
  improvements    text,
  status          review_status not null default 'draft',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists reviews_staff_idx on performance_reviews(staff_id);

create table if not exists job_openings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title           text not null,
  department      text,
  role            staff_role,
  headcount       int not null default 1,
  status          opening_status not null default 'open',
  jd_file_id      uuid references files(id) on delete set null,
  opened_by       uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists candidates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  opening_id      uuid references job_openings(id) on delete set null,
  name            text not null,
  email           text,
  phone_e164      text,
  stage           candidate_stage not null default 'applied',
  rating          numeric(3,1),
  cv_file_id      uuid references files(id) on delete set null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists candidates_opening_idx on candidates(opening_id);
create index if not exists candidates_stage_idx   on candidates(stage);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['employment_contracts','leave_requests','attendance','performance_reviews','job_openings','candidates'] loop
    execute format('drop trigger if exists trg_%1$I_touch on %1$I; create trigger trg_%1$I_touch before update on %1$I for each row execute function _touch_updated_at();', t);
  end loop;
end $$;

-- Seed standard Oman leave categories (CONFIG, not business data).
-- ⚠️ HR must verify day-counts against the current Oman Labour Law (RD 53/2023);
-- every value here is editable in the app.
do $$
declare o record;
begin
  for o in select id from organizations loop
    insert into leave_types (organization_id, code, name_en, name_ar, paid, default_days_per_year, oman_labour_note) values
      (o.id,'annual','Annual Leave','إجازة سنوية',true,30,'RD 53/2023 — verify'),
      (o.id,'sick','Sick Leave','إجازة مرضية',true,null,'Tiered pay per law — verify'),
      (o.id,'emergency','Emergency Leave','إجازة طارئة',true,null,'Per contract policy'),
      (o.id,'maternity','Maternity Leave','إجازة أمومة',true,98,'RD 53/2023 — verify'),
      (o.id,'paternity','Paternity Leave','إجازة أبوة',true,7,'Verify'),
      (o.id,'bereavement','Bereavement Leave','إجازة وفاة',true,null,'Verify by relation'),
      (o.id,'marriage','Marriage Leave','إجازة زواج',true,3,'Verify'),
      (o.id,'hajj','Hajj Leave','إجازة حج',true,15,'Once in service — verify'),
      (o.id,'unpaid','Unpaid Leave','إجازة بدون راتب',false,null,'By approval')
    on conflict (organization_id, code) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table employment_contracts enable row level security;
alter table leave_types          enable row level security;
alter table leave_requests       enable row level security;
alter table leave_balances       enable row level security;
alter table attendance           enable row level security;
alter table performance_reviews  enable row level security;
alter table job_openings         enable row level security;
alter table candidates           enable row level security;

create policy contracts_read on employment_contracts for select using (
  organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager')
);
create policy contracts_write on employment_contracts for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy leavetypes_read on leave_types for select using (organization_id = my_org());
create policy leavetypes_write on leave_types for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy leavereq_read on leave_requests for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy leavereq_write on leave_requests for all using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager'));

create policy leavebal_read on leave_balances for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy leavebal_write on leave_balances for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy attendance_read on attendance for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy attendance_write on attendance for all using (
  organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager'));

create policy reviews_read on performance_reviews for select using (
  organization_id = my_org() and (staff_id = auth.uid() or reviewer_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy reviews_write on performance_reviews for all using (
  organization_id = my_org() and (reviewer_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy openings_read on job_openings for select using (organization_id = my_org());
create policy openings_write on job_openings for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

-- Candidates carry PII: HR + exec only.
create policy candidates_all on candidates for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager'));

-- ==================== 0004_finance.up.sql ====================
-- =====================================================================
-- 0004 (UP) — Finance module
-- Commission invoicing to developers, collection tracking, agent payout
-- vouchers. Reconciles with deals.developer_paid / agent_paid.
-- Requires 0001 (helpers) and 0002 (deals). Reversible: 0004_finance.down.sql
-- RLS: Finance + exec full; Sales Manager read; agent sees their own vouchers.
-- =====================================================================

do $$ begin create type invoice_status as enum ('draft','sent','partially_paid','paid','overdue','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type voucher_status as enum ('draft','approved','paid','cancelled'); exception when duplicate_object then null; end $$;

-- Commission invoices to developers ----------------------------------
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  developer       text,
  project_id      uuid references projects(id) on delete set null,
  reference       text,
  amount_omr      numeric(18,3) not null default 0,
  period          text,
  issued_date     date,
  due_date        date,
  status          invoice_status not null default 'draft',
  invoice_file_id uuid references files(id) on delete set null,
  notes           text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists invoices_status_idx on invoices(status);
create index if not exists invoices_due_idx    on invoices(due_date);
create index if not exists invoices_org_idx    on invoices(organization_id);

create table if not exists invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  deal_id     uuid references deals(id) on delete set null,
  description text,
  amount_omr  numeric(18,3) not null default 0
);
create index if not exists invoice_items_invoice_idx on invoice_items(invoice_id);
create index if not exists invoice_items_deal_idx    on invoice_items(deal_id);

-- Commission collected from developers (the "collect on time" signal) --
create table if not exists collections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id      uuid references invoices(id) on delete set null,
  amount_omr      numeric(18,3) not null,
  received_date   date,
  method          text,
  reference       text,
  proof_file_id   uuid references files(id) on delete set null,
  recorded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz default now()
);
create index if not exists collections_invoice_idx on collections(invoice_id);

-- Agent payout vouchers ----------------------------------------------
create table if not exists payment_vouchers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  staff_id         uuid not null references profiles(id) on delete restrict,   -- agent being paid
  reference        text,
  amount_omr       numeric(18,3) not null default 0,
  issued_date      date,
  status           voucher_status not null default 'draft',
  approved_by      uuid references profiles(id) on delete set null,
  approved_at      timestamptz,
  paid_date        date,
  voucher_file_id  uuid references files(id) on delete set null,
  notes            text,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists vouchers_staff_idx  on payment_vouchers(staff_id);
create index if not exists vouchers_status_idx on payment_vouchers(status);

create table if not exists voucher_items (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references payment_vouchers(id) on delete cascade,
  deal_id     uuid references deals(id) on delete set null,
  description text,
  amount_omr  numeric(18,3) not null default 0
);
create index if not exists voucher_items_voucher_idx on voucher_items(voucher_id);
create index if not exists voucher_items_deal_idx    on voucher_items(deal_id);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['invoices','payment_vouchers'] loop
    execute format('drop trigger if exists trg_%1$I_touch on %1$I; create trigger trg_%1$I_touch before update on %1$I for each row execute function _touch_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table invoices         enable row level security;
alter table invoice_items    enable row level security;
alter table collections      enable row level security;
alter table payment_vouchers enable row level security;
alter table voucher_items    enable row level security;

create policy invoices_read on invoices for select using (organization_id = my_org() and can_see_money());
create policy invoices_write on invoices for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());

create policy invitems_read on invoice_items for select using (
  exists (select 1 from invoices i where i.id = invoice_items.invoice_id and i.organization_id = my_org() and can_see_money())
);
create policy invitems_write on invoice_items for all using (
  exists (select 1 from invoices i where i.id = invoice_items.invoice_id and i.organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head'))
) with check (
  exists (select 1 from invoices i where i.id = invoice_items.invoice_id and i.organization_id = my_org())
);

create policy collections_read on collections for select using (organization_id = my_org() and can_see_money());
create policy collections_write on collections for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());

create policy vouchers_read on payment_vouchers for select using (
  organization_id = my_org() and (can_see_money() or staff_id = auth.uid() or manages(staff_id))
);
create policy vouchers_write on payment_vouchers for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());

create policy vitems_read on voucher_items for select using (
  exists (select 1 from payment_vouchers v where v.id = voucher_items.voucher_id and v.organization_id = my_org()
          and (can_see_money() or v.staff_id = auth.uid() or manages(v.staff_id)))
);
create policy vitems_write on voucher_items for all using (
  exists (select 1 from payment_vouchers v where v.id = voucher_items.voucher_id and v.organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head'))
) with check (
  exists (select 1 from payment_vouchers v where v.id = voucher_items.voucher_id and v.organization_id = my_org())
);

-- ==================== 0005_integration_seed.up.sql ====================
-- =====================================================================
-- 0005 (UP) — Integration bootstrap: org + owner identity + sync keys
-- Seeds the ONE organization and the owner (CEO) identity rows the FKs
-- need (config/identity — NOT mock business data), and adds idempotency
-- keys for the Zoho sync (external_id from Zoho is the upsert key).
-- Reversible: 0005_integration_seed.down.sql
-- =====================================================================

-- Owner auth identity. In owner-only mode nobody logs in through Supabase
-- auth; this row exists purely so profiles.id has a valid FK target.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', '498a03f4-841d-4580-b310-f3571d37efa7',
       'authenticated', 'authenticated', 'humood@alwalaaoman.com', now(),
       '{"provider":"email","providers":["email"],"role":"ADMIN"}'::jsonb,
       '{"name":"Humood AlAdhari","designation":"CEO"}'::jsonb, now(), now()
where not exists (select 1 from auth.users where lower(email) = 'humood@alwalaaoman.com');

insert into organizations (id, name)
values ('6a32be59-155d-4662-9058-3a74fb2b6872', 'Alwalaa Real Estate')
on conflict (id) do nothing;

insert into profiles (id, organization_id, full_name, role)
select u.id, '6a32be59-155d-4662-9058-3a74fb2b6872', 'Humood AlAdhari', 'owner'
from auth.users u where lower(u.email) = 'humood@alwalaaoman.com'
on conflict (id) do update set organization_id = excluded.organization_id, role = 'owner';

insert into staff_profiles (id, organization_id, role, status)
select u.id, '6a32be59-155d-4662-9058-3a74fb2b6872', 'ceo', 'active'
from auth.users u where lower(u.email) = 'humood@alwalaaoman.com'
on conflict (id) do update set role = 'ceo';

-- Zoho sync idempotency: immutable Zoho IDs are the upsert keys.
alter table invoices    add column if not exists external_id text;
alter table collections add column if not exists external_id text;
alter table leads       add column if not exists external_id text;
alter table deals       add column if not exists external_id text;
create unique index if not exists invoices_org_ext_uniq    on invoices(organization_id, external_id)    where external_id is not null;
create unique index if not exists collections_org_ext_uniq on collections(organization_id, external_id) where external_id is not null;
create unique index if not exists leads_org_ext_uniq       on leads(organization_id, external_id)       where external_id is not null;
create unique index if not exists deals_org_ext_uniq       on deals(organization_id, external_id)       where external_id is not null;

-- Seed the Oman leave categories now that the org row exists (the HR module's
-- own seed ran before the org and found nothing). Idempotent.
do $$
declare o record;
begin
  for o in select id from organizations loop
    insert into leave_types (organization_id, code, name_en, name_ar, paid, default_days_per_year, oman_labour_note) values
      (o.id,'annual','Annual Leave','إجازة سنوية',true,30,'RD 53/2023 — verify'),
      (o.id,'sick','Sick Leave','إجازة مرضية',true,null,'Tiered pay per law — verify'),
      (o.id,'emergency','Emergency Leave','إجازة طارئة',true,null,'Per contract policy'),
      (o.id,'maternity','Maternity Leave','إجازة أمومة',true,98,'RD 53/2023 — verify'),
      (o.id,'paternity','Paternity Leave','إجازة أبوة',true,7,'Verify'),
      (o.id,'bereavement','Bereavement Leave','إجازة وفاة',true,null,'Verify by relation'),
      (o.id,'marriage','Marriage Leave','إجازة زواج',true,3,'Verify'),
      (o.id,'hajj','Hajj Leave','إجازة حج',true,15,'Once in service — verify'),
      (o.id,'unpaid','Unpaid Leave','إجازة بدون راتب',false,null,'By approval')
    on conflict (organization_id, code) do nothing;
  end loop;
end $$;


-- ==================== 0006_sync_keys_and_catalog.up.sql ====================
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

-- ==================== 0007_projects_seed.up.sql ====================
-- =====================================================================
-- 0007 (UP) — Authoritative project catalog (20 signed master plans)
-- Idempotent UPSERT on the natural key (organization_id, name) added in 0006.
-- category + ownership_eligibility drive the copilots' hard eligibility rule:
--   ITC            → all_nationalities  (foreign investors OK; the residency story)
--   future_cities  → gcc_omani_only     (Sultan Haitham City)
--   surooh         → gcc_omani_only
-- Ministry follows the app's ownership rule: ITC = Ministry of Heritage and
-- Tourism; Future Cities + Surooh = Ministry of Housing and Urban Planning
-- (pending final MoHUP confirmation).
-- Config data (not mock business data). Reversible: 0007_projects_seed.down.sql
-- =====================================================================

insert into projects (organization_id, name, developer, location, category, ownership_eligibility, ministry, branded_residence, notes)
values
  -- ITC — all nationalities (Ministry of Heritage and Tourism) ---------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Jebel Sifah / Hawana Salalah','Muriya','Sifah / Salalah','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Al Mouj Muscat','Al Mouj Muscat (MAF)','Seeb','ITC','all_nationalities','Ministry of Heritage and Tourism','St. Regis',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','AIDA','Dar Global (with OMRAN)','Yiti','ITC','all_nationalities','Ministry of Heritage and Tourism','Trump / Marriott / Nickelodeon / Fendi Casa',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','The Sustainable City — Yiti','Diamond Developers','Yiti','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Muscat Bay','Saraya Bandar Jissah','Bandar Jissah','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Opal','Alnama','Muscat Hills','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Golf Hills / The Pearl','Alosool','Muscat Hills','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Vistal','Leo Development','Al Mouj','ITC','all_nationalities','Ministry of Heritage and Tourism','Victoria Swarovski',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Bellevue','Ideal Buildings','Al Mouj','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Residences at Mandarin Oriental','Eagle Hills','Shatti Al Qurum','ITC','all_nationalities','Ministry of Heritage and Tourism','Mandarin Oriental',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Yamal','Talaat Mostafa Group (with Al Muhaidib)','Al Manuma, Seeb','ITC','all_nationalities','Ministry of Heritage and Tourism',null,'Flag: confirm ITC vs Housing classification'),
  -- Future Cities — GCC/Omani only, Sultan Haitham City (MoHUP) --------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Wadi Zaha','Al Ahly Sabbour','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Sarooj Oasis','Sarooj Development','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Wafa','Al Abrar','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Yenaier Residences / Hay Al We''am','Adrak / Adanté','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Jood','Talaat Mostafa Group (with Al Muhaidib)','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Ahlam','Dream Villa','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Nuha','Tibian','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  -- Surooh — GCC/Omani only (MoHUP) -----------------------------------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Naseem','Adrak / Adanté','Barka','surooh','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Majd','Almajd Real Estate','Sohar','surooh','gcc_omani_only','Ministry of Housing and Urban Planning',null,null)
on conflict (organization_id, name) do update set
  developer             = excluded.developer,
  location              = excluded.location,
  category              = excluded.category,
  ownership_eligibility = excluded.ownership_eligibility,
  ministry              = excluded.ministry,
  branded_residence     = excluded.branded_residence,
  notes                 = coalesce(excluded.notes, projects.notes),
  updated_at            = now();
