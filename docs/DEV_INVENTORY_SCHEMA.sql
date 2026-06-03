-- =====================================================================
-- Developer Inventory module — Supabase schema
-- Paste into the Supabase SQL editor and Run (after DATABASE_SCHEMA.sql,
-- though this module is independent and can be run on its own).
--
-- Backs src/storage/inventory/supabaseInventoryRepository.ts
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Canonical units (one row per Unit, keyed by derived id project|unitRef)
-- ---------------------------------------------------------------------
create table if not exists dev_units (
  id             text primary key,          -- `${project}|${unitRef}` slugified
  project        text not null,
  developer      text not null,
  unit_ref       text not null,
  unit_type      text not null,
  bedrooms       integer,
  bathrooms      integer,
  size_sqm       numeric,
  floor          text,
  view           text,
  price_omr      numeric,
  price_per_sqm  numeric,
  status         text not null default 'available',
  payment_plan   text,
  handover_date  text,
  itc_eligible   boolean not null default true,
  furnishing     text,
  source_raw     text not null default '',
  imported_at    text not null,
  notes          text,
  updated_at     timestamptz default now()
);

create index if not exists dev_units_project_idx on dev_units(project);
create index if not exists dev_units_type_idx on dev_units(unit_type);
create index if not exists dev_units_status_idx on dev_units(status);

-- ---------------------------------------------------------------------
-- Price movements (append-only — the source of "price increase" insight)
-- ---------------------------------------------------------------------
create table if not exists dev_price_movements (
  pk         uuid primary key default gen_random_uuid(),
  unit_id    text not null references dev_units(id) on delete cascade,
  project    text not null,
  unit_ref   text not null,
  old_price  numeric not null,
  new_price  numeric not null,
  delta_pct  numeric not null,
  at         text not null,                  -- ISO timestamp from the app
  created_at timestamptz default now()
);

create index if not exists dev_movements_unit_idx on dev_price_movements(unit_id);
create index if not exists dev_movements_at_idx on dev_price_movements(at desc);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table dev_units enable row level security;
alter table dev_price_movements enable row level security;

-- The app writes via the service-role key (bypasses RLS). These policies
-- allow authenticated reads once you add Supabase Auth (Milestone M5).
-- Until then, the service-role server routes are the only writers.
drop policy if exists dev_units_read on dev_units;
create policy dev_units_read on dev_units for select using (true);

drop policy if exists dev_movements_read on dev_price_movements;
create policy dev_movements_read on dev_price_movements for select using (true);
