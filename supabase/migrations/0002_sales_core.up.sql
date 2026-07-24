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
