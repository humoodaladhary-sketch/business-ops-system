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
