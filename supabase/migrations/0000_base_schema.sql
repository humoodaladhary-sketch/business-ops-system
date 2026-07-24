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
