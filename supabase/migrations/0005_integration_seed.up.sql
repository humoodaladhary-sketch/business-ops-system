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
