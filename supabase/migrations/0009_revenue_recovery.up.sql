-- =====================================================================
-- 0009 (UP) — Revenue recovery: the deal-to-cash chain
-- Turns receivables visibility into a workable chase: invoices link to the
-- deals that earned them, due dates carry verification provenance, and every
-- follow-up (draft → approved → sent → responded) is a durable record.
-- Requires 0004 (invoices/collections) and 0002 (deals).
-- Additive + reversible: 0009_revenue_recovery.down.sql
-- =====================================================================

-- Due-date provenance: a due date only drives overdue math once verified.
alter table invoices add column if not exists due_date_verified boolean not null default false;
alter table invoices add column if not exists due_date_basis    text;   -- e.g. 'contract 45 days from SPA', 'Zoho terms'
alter table invoices add column if not exists dispute_reason    text;

-- Invoice ↔ deal linkage ----------------------------------------------
create table if not exists invoice_deal_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id      uuid not null references invoices(id) on delete cascade,
  deal_id         uuid not null references deals(id) on delete cascade,
  source          text not null default 'manual',      -- manual | copilot | import
  note            text,
  linked_by       uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  unique (invoice_id, deal_id)
);
create index if not exists idl_org_idx     on invoice_deal_links(organization_id);
create index if not exists idl_invoice_idx on invoice_deal_links(invoice_id);
create index if not exists idl_deal_idx    on invoice_deal_links(deal_id);

-- Collection follow-ups (the chase log) --------------------------------
do $$ begin
  create type followup_kind as enum (
    'due_reminder','first_overdue','second_escalation','management_escalation',
    'dispute_clarification','partial_balance','remittance_confirmation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type followup_status as enum ('draft','approved','sent','responded','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists collection_followups (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id      uuid not null references invoices(id) on delete cascade,
  kind            followup_kind not null,
  status          followup_status not null default 'draft',
  channel         text not null default 'whatsapp_draft',   -- draft-only until Respond.io is connected
  message         text not null,                            -- the approved wording that was/will be sent
  due_at          timestamptz,                              -- when this follow-up should happen
  sent_at         timestamptz,
  response        text,                                     -- what the payer said
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists cfu_org_idx     on collection_followups(organization_id);
create index if not exists cfu_invoice_idx on collection_followups(invoice_id);
create index if not exists cfu_status_idx  on collection_followups(status);

drop trigger if exists trg_collection_followups_touch on collection_followups;
create trigger trg_collection_followups_touch before update on collection_followups
  for each row execute function _touch_updated_at();

-- RLS (same money boundary as invoices: finance + exec) ----------------
alter table invoice_deal_links   enable row level security;
alter table collection_followups enable row level security;

create policy idl_read on invoice_deal_links for select using (
  organization_id = my_org() and can_see_money()
);
create policy idl_write on invoice_deal_links for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());

create policy cfu_read on collection_followups for select using (
  organization_id = my_org() and can_see_money()
);
create policy cfu_write on collection_followups for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'finance_head')
) with check (organization_id = my_org());
