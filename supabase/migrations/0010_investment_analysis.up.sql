-- =====================================================================
-- 0010 (UP) — Investment Intelligence: saved ROI analyses & reports
-- Persists Pro Mode investment analyses as reproducible snapshots: the full
-- input (assumptions, objectives, comparables) plus the deterministic result
-- JSON, versioned, so a saved report replays exactly even after unit data
-- changes. AI narratives are stored beside the result they narrate, with the
-- model id, and flagged internal vs client-safe.
-- Requires 0000 (organizations, profiles) and 0001 (RLS helpers).
-- Additive + reversible: 0010_investment_analysis.down.sql
-- =====================================================================

do $$ begin
  create type analysis_status as enum ('draft','saved','archived');
exception when duplicate_object then null; end $$;

create table if not exists investment_analyses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  title            text not null,                       -- e.g. 'AM-104 · Al Mouj · 2BR'
  unit_reference   text,                                -- live-inventory ref when prefilled
  status           analysis_status not null default 'draft',
  -- Reproducibility: the exact engine input and the exact structured result.
  input            jsonb not null,
  result           jsonb not null,
  formula_version  text not null,                       -- engine FORMULA_VERSION at save time
  analysis_version integer not null default 1,          -- bumped on each re-save of the same analysis
  -- AI narrative (optional, generated from `result` only)
  narrative_internal text,
  narrative_client   text,                              -- client-safe wording (no internal fields)
  narrative_model    text,                              -- e.g. 'claude-sonnet-5'
  narrative_at       timestamptz,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists inv_an_org_idx    on investment_analyses(organization_id);
create index if not exists inv_an_status_idx on investment_analyses(status);
create index if not exists inv_an_unit_idx   on investment_analyses(unit_reference);
create index if not exists inv_an_created_idx on investment_analyses(created_at desc);

drop trigger if exists trg_investment_analyses_touch on investment_analyses;
create trigger trg_investment_analyses_touch before update on investment_analyses
  for each row execute function _touch_updated_at();

-- RLS: analyses contain negotiation strategy (walk-away prices) — sales
-- leadership + exec read/write; agents read their own creations.
alter table investment_analyses enable row level security;

create policy inv_an_read on investment_analyses for select using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('sales_manager','operations_manager') or created_by = auth.uid())
);
create policy inv_an_write on investment_analyses for all using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('sales_manager','operations_manager') or created_by = auth.uid())
) with check (organization_id = my_org());
