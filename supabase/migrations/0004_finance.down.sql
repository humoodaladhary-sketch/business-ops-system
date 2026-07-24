-- =====================================================================
-- 0004 (DOWN) — reverse Finance module
-- =====================================================================
drop policy if exists vitems_write on voucher_items;
drop policy if exists vitems_read on voucher_items;
drop policy if exists vouchers_write on payment_vouchers;
drop policy if exists vouchers_read on payment_vouchers;
drop policy if exists collections_write on collections;
drop policy if exists collections_read on collections;
drop policy if exists invitems_write on invoice_items;
drop policy if exists invitems_read on invoice_items;
drop policy if exists invoices_write on invoices;
drop policy if exists invoices_read on invoices;

drop table if exists voucher_items;
drop table if exists payment_vouchers;
drop table if exists collections;
drop table if exists invoice_items;
drop table if exists invoices;

drop type if exists voucher_status;
drop type if exists invoice_status;
