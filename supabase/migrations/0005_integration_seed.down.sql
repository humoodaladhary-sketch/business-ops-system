-- =====================================================================
-- 0005 (DOWN) — reverse integration bootstrap
-- =====================================================================
drop index if exists deals_org_ext_uniq;
drop index if exists leads_org_ext_uniq;
drop index if exists collections_org_ext_uniq;
drop index if exists invoices_org_ext_uniq;
alter table deals       drop column if exists external_id;
alter table leads       drop column if exists external_id;
alter table collections drop column if exists external_id;
alter table invoices    drop column if exists external_id;

delete from staff_profiles where id in (select id from auth.users where lower(email) = 'humood@alwalaaoman.com');
delete from profiles       where id in (select id from auth.users where lower(email) = 'humood@alwalaaoman.com');
delete from organizations  where id = '6a32be59-155d-4662-9058-3a74fb2b6872';
-- auth.users row intentionally kept (harmless; may be referenced by Supabase auth logs)
