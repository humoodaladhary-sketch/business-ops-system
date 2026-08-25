-- =====================================================================
-- 0013 (DOWN) — Reverses 0013_social_platform.up.sql
-- Drops the social-connection layer. Data loss: connected-account records
-- (including stored tokens), the post queue/history, metrics snapshots.
-- =====================================================================

drop table if exists social_metrics_snapshots;
drop table if exists social_posts;
drop table if exists social_account_secrets;
drop table if exists social_accounts;
drop type if exists social_post_status;
drop type if exists social_platform;
