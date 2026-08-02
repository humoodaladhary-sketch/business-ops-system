-- =====================================================================
-- 0010 (DOWN) — Reverses 0010_investment_analysis.up.sql
-- Drops the saved-analysis store. Data loss is limited to saved Pro Mode
-- investment analyses and their AI narratives.
-- =====================================================================

drop trigger if exists trg_investment_analyses_touch on investment_analyses;
drop policy if exists inv_an_read  on investment_analyses;
drop policy if exists inv_an_write on investment_analyses;
drop table if exists investment_analyses;
drop type if exists analysis_status;
