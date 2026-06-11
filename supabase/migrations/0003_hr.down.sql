-- =====================================================================
-- 0003 (DOWN) — reverse HR module
-- =====================================================================
drop policy if exists candidates_all on candidates;
drop policy if exists openings_write on job_openings;
drop policy if exists openings_read on job_openings;
drop policy if exists reviews_write on performance_reviews;
drop policy if exists reviews_read on performance_reviews;
drop policy if exists attendance_write on attendance;
drop policy if exists attendance_read on attendance;
drop policy if exists leavebal_write on leave_balances;
drop policy if exists leavebal_read on leave_balances;
drop policy if exists leavereq_write on leave_requests;
drop policy if exists leavereq_read on leave_requests;
drop policy if exists leavetypes_write on leave_types;
drop policy if exists leavetypes_read on leave_types;
drop policy if exists contracts_write on employment_contracts;
drop policy if exists contracts_read on employment_contracts;

drop table if exists candidates;
drop table if exists job_openings;
drop table if exists performance_reviews;
drop table if exists attendance;
drop table if exists leave_balances;
drop table if exists leave_requests;
drop table if exists leave_types;
drop table if exists employment_contracts;

drop type if exists candidate_stage;
drop type if exists opening_status;
drop type if exists review_status;
drop type if exists attendance_status;
drop type if exists leave_request_status;
drop type if exists contract_status;
drop type if exists contract_type;
