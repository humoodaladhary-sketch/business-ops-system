-- =====================================================================
-- 0011 (DOWN) — Reverses 0011_visual_media.up.sql
-- Drops hero_slides and the media-governance columns added to files.
-- Data loss is limited to hero-banner content and image rights metadata;
-- the underlying files/storage objects are untouched.
-- =====================================================================

drop trigger if exists trg_hero_slides_touch on hero_slides;
drop policy if exists hero_slides_read  on hero_slides;
drop policy if exists hero_slides_write on hero_slides;
drop table if exists hero_slides;
drop type if exists hero_slide_status;

drop index if exists files_approval_idx;
drop index if exists files_kind_idx;

alter table files drop column if exists source_type;
alter table files drop column if exists source_url;
alter table files drop column if exists owner_name;
alter table files drop column if exists license_type;
alter table files drop column if exists license_allows_hero;
alter table files drop column if exists license_allows_reports;
alter table files drop column if exists attribution;
alter table files drop column if exists classification;
alter table files drop column if exists approval_status;
alter table files drop column if exists alt_text;
alter table files drop column if exists focal_x;
alter table files drop column if exists focal_y;
alter table files drop column if exists focal_x_mobile;
alter table files drop column if exists focal_y_mobile;
alter table files drop column if exists width_px;
alter table files drop column if exists height_px;
alter table files drop column if exists blur_data_url;
alter table files drop column if exists dominant_color;
alter table files drop column if exists location_label;
alter table files drop column if exists last_verified_at;
alter table files drop column if exists uploaded_by;
