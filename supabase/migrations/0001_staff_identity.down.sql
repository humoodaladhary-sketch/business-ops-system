-- =====================================================================
-- 0001 (DOWN) — reverse staff identity & role model
-- =====================================================================
drop policy if exists staff_admin_write on staff_profiles;
drop policy if exists staff_self_read on staff_profiles;

drop function if exists manages(uuid);
drop function if exists can_see_money();
drop function if exists can_see_all_leads();
drop function if exists is_exec();
drop function if exists my_org();
drop function if exists my_staff_role();

drop table if exists staff_profiles;

drop type if exists staff_status;
drop type if exists agent_segment;
drop type if exists staff_role;
