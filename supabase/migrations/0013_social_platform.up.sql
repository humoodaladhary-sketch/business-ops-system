-- =====================================================================
-- 0013 (UP) — Social platform connections (Phase 1 of the automation plan)
-- Connects Alwalaa's social accounts to the OS: a per-platform account
-- registry, a locked secrets table (tokens NEVER share a row with data the
-- app can read via anon/authenticated), a publishing queue where every post
-- carries an idempotency key + dry-run flag, and metrics snapshots for the
-- marketing KPIs. Publishing itself is adapter-based in the app; nothing
-- posts automatically — dry-run first, explicit audited publish after.
-- Requires 0000 (organizations, profiles, files).
-- Additive + reversible: 0013_social_platform.down.sql
-- =====================================================================

do $$ begin
  create type social_platform as enum
    ('facebook','instagram','tiktok','youtube','linkedin','x','threads','whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_post_status as enum
    ('draft','scheduled','dry_run_ok','posting','posted','failed','cancelled');
exception when duplicate_object then null; end $$;

-- --- Account registry (no secrets here) --------------------------------
create table if not exists social_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  platform         social_platform not null,
  handle           text not null,                    -- e.g. @alwalaa.om
  display_name     text,
  external_account_id text,                          -- page id / IG business id / channel id
  status           text not null default 'disconnected',  -- disconnected|connected|error
  status_detail    text,                             -- last verify error, human-readable
  last_verified_at timestamptz,
  metadata         jsonb,                            -- platform-specific extras (never secrets)
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (organization_id, platform, handle)
);
create index if not exists social_accounts_org_idx on social_accounts(organization_id);

drop trigger if exists trg_social_accounts_touch on social_accounts;
create trigger trg_social_accounts_touch before update on social_accounts
  for each row execute function _touch_updated_at();

-- --- Secrets: NO RLS policies — service-role / direct connections only --
create table if not exists social_account_secrets (
  account_id     uuid primary key references social_accounts(id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  token_expires_at timestamptz,
  updated_at     timestamptz default now()
);

drop trigger if exists trg_social_account_secrets_touch on social_account_secrets;
create trigger trg_social_account_secrets_touch before update on social_account_secrets
  for each row execute function _touch_updated_at();

-- --- Publishing queue ---------------------------------------------------
create table if not exists social_posts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  account_id       uuid not null references social_accounts(id) on delete cascade,
  body             text not null,
  link_url         text,
  media_file_ids   uuid[] not null default '{}',     -- files(id) — approved media only
  status           social_post_status not null default 'draft',
  scheduled_at     timestamptz,                      -- publish no earlier than this (needs the cron phase)
  posted_at        timestamptz,
  external_post_id text,                             -- platform's id after posting
  error            text,
  -- Guards required on every automated write path:
  idempotency_key  text not null,                    -- unique per intended real-world post
  dry_run_at       timestamptz,                      -- when the last successful dry-run validated it
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists social_posts_org_idx     on social_posts(organization_id);
create index if not exists social_posts_status_idx  on social_posts(status);
create index if not exists social_posts_account_idx on social_posts(account_id);

drop trigger if exists trg_social_posts_touch on social_posts;
create trigger trg_social_posts_touch before update on social_posts
  for each row execute function _touch_updated_at();

-- --- Metrics snapshots (for the marketing KPIs; api or manual) ----------
create table if not exists social_metrics_snapshots (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  account_id       uuid not null references social_accounts(id) on delete cascade,
  captured_at      timestamptz not null default now(),
  followers        integer,
  posts_count      integer,
  metrics          jsonb,                            -- platform-specific detail
  source           text not null default 'api'       -- api|manual
);
create index if not exists social_metrics_acct_idx on social_metrics_snapshots(account_id, captured_at desc);

-- --- RLS ----------------------------------------------------------------
alter table social_accounts          enable row level security;
alter table social_account_secrets   enable row level security;  -- and NO policies: locked
alter table social_posts             enable row level security;
alter table social_metrics_snapshots enable row level security;

create policy social_accounts_read on social_accounts for select using (organization_id = my_org());
create policy social_accounts_write on social_accounts for all using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('marketing_manager','operations_manager'))
) with check (organization_id = my_org());

create policy social_posts_read on social_posts for select using (organization_id = my_org());
create policy social_posts_write on social_posts for all using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('marketing_manager','operations_manager'))
) with check (organization_id = my_org());

create policy social_metrics_read on social_metrics_snapshots for select using (organization_id = my_org());
create policy social_metrics_write on social_metrics_snapshots for all using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('marketing_manager','operations_manager'))
) with check (organization_id = my_org());
