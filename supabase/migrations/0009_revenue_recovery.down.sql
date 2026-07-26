-- =====================================================================
-- 0009 (DOWN) — reverse revenue recovery
-- =====================================================================
drop policy if exists cfu_write on collection_followups;
drop policy if exists cfu_read  on collection_followups;
drop policy if exists idl_write on invoice_deal_links;
drop policy if exists idl_read  on invoice_deal_links;

drop trigger if exists trg_collection_followups_touch on collection_followups;
drop table if exists collection_followups;
drop table if exists invoice_deal_links;

drop type if exists followup_status;
drop type if exists followup_kind;

alter table invoices drop column if exists dispute_reason;
alter table invoices drop column if exists due_date_basis;
alter table invoices drop column if exists due_date_verified;
