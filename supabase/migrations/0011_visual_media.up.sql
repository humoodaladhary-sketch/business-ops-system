-- =====================================================================
-- 0011 (UP) — Visual media governance & hero slides
-- Extends the existing `files` table (the media substrate since 0000) with
-- the rights/quality metadata a published image must carry — license,
-- attribution, classification (photo vs render — never conflated), approval,
-- focal point, alt text — and adds `hero_slides`, the Command Portal's
-- editorial banner queue (scheduled, prioritized, pinned, audience-scoped).
-- No public buckets: images stay in the private ALWALAA bucket and are
-- served via short-lived signed URLs created server-side.
-- Requires 0000 (organizations, profiles, files, projects, units).
-- Additive + reversible: 0011_visual_media.down.sql
-- =====================================================================

-- --- Media governance columns on files ---------------------------------
alter table files add column if not exists source_type text;        -- alwalaa_owned|inventory|upload|developer|news_source|licensed_stock|branded
alter table files add column if not exists source_url text;         -- original URL when it came from outside
alter table files add column if not exists owner_name text;         -- rights owner / provider
alter table files add column if not exists license_type text;       -- owned|developer_approved|editorial|royalty_free|rights_managed|unknown
alter table files add column if not exists license_allows_hero boolean not null default false;
alter table files add column if not exists license_allows_reports boolean not null default false;
alter table files add column if not exists attribution text;        -- required credit line, null = none required
alter table files add column if not exists classification text;     -- photo|developer_render|arch_visualization|concept|stock|branded_graphic
alter table files add column if not exists approval_status text not null default 'pending';  -- pending|approved|rejected
alter table files add column if not exists alt_text text;
alter table files add column if not exists focal_x numeric(4,3);    -- 0..1, image focal point for cropping
alter table files add column if not exists focal_y numeric(4,3);
alter table files add column if not exists focal_x_mobile numeric(4,3);
alter table files add column if not exists focal_y_mobile numeric(4,3);
alter table files add column if not exists width_px integer;
alter table files add column if not exists height_px integer;
alter table files add column if not exists blur_data_url text;      -- tiny client-generated blur placeholder
alter table files add column if not exists dominant_color text;     -- #rrggbb
alter table files add column if not exists location_label text;     -- e.g. 'Al Mouj, Muscat'
alter table files add column if not exists last_verified_at timestamptz;
alter table files add column if not exists uploaded_by uuid references profiles(id) on delete set null;

create index if not exists files_approval_idx on files(approval_status);
create index if not exists files_kind_idx on files(kind);

-- --- Hero slides -------------------------------------------------------
do $$ begin
  create type hero_slide_status as enum ('draft','published','archived');
exception when duplicate_object then null; end $$;

create table if not exists hero_slides (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  content_type     text not null default 'announcement',  -- market_news|featured_property|featured_project|investment_opportunity|new_inventory|oman_update|announcement|collection_priority|campaign
  eyebrow          text,                                   -- small label above the title
  title            text not null,
  description      text,
  file_id          uuid references files(id) on delete set null,   -- approved image (null = branded fallback art)
  primary_label    text,
  primary_href     text,
  secondary_label  text,
  secondary_href   text,
  source_label     text,                                   -- shown for news-type slides
  starts_at        timestamptz,                            -- null = immediately
  ends_at          timestamptz,                            -- null = no expiry
  priority         integer not null default 100,           -- lower = earlier
  pinned           boolean not null default false,
  audience         text not null default 'all',            -- all|admin|agents
  status           hero_slide_status not null default 'draft',
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists hero_slides_org_idx    on hero_slides(organization_id);
create index if not exists hero_slides_status_idx on hero_slides(status);
create index if not exists hero_slides_window_idx on hero_slides(starts_at, ends_at);

drop trigger if exists trg_hero_slides_touch on hero_slides;
create trigger trg_hero_slides_touch before update on hero_slides
  for each row execute function _touch_updated_at();

-- RLS: read for the org; publish/approve is a leadership action.
alter table hero_slides enable row level security;

create policy hero_slides_read on hero_slides for select using (
  organization_id = my_org()
);
create policy hero_slides_write on hero_slides for all using (
  organization_id = my_org()
  and (is_exec() or my_staff_role() in ('sales_manager','operations_manager','marketing_manager'))
) with check (organization_id = my_org());
