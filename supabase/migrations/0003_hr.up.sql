-- =====================================================================
-- 0003 (UP) — HR module
-- Employees, contracts, leaves (Oman labour categories — configurable),
-- attendance, KPIs/reviews, recruitment. Requires 0001 (helpers).
-- RLS: each employee sees their own; managers see reports; HR + exec full.
-- Reversible: 0003_hr.down.sql
-- =====================================================================

do $$ begin create type contract_type as enum ('full_time','part_time','fixed_term','consultant'); exception when duplicate_object then null; end $$;
do $$ begin create type contract_status as enum ('active','ended','terminated'); exception when duplicate_object then null; end $$;
do $$ begin create type leave_request_status as enum ('pending','approved','rejected','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type attendance_status as enum ('present','absent','late','half_day','remote','on_leave','holiday'); exception when duplicate_object then null; end $$;
do $$ begin create type review_status as enum ('draft','shared','acknowledged'); exception when duplicate_object then null; end $$;
do $$ begin create type opening_status as enum ('open','on_hold','filled','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type candidate_stage as enum ('applied','screening','interview','offer','hired','rejected'); exception when duplicate_object then null; end $$;

create table if not exists employment_contracts (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references organizations(id) on delete cascade,
  staff_id                    uuid not null references profiles(id) on delete cascade,
  type                        contract_type not null default 'full_time',
  start_date                  date not null,
  end_date                    date,
  basic_salary_omr            numeric(18,3),
  allowances                  jsonb not null default '{}',
  annual_leave_entitlement_days int not null default 30,
  probation_end_date          date,
  contract_file_id            uuid references files(id) on delete set null,
  status                      contract_status not null default 'active',
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);
create index if not exists contracts_staff_idx on employment_contracts(staff_id);
create index if not exists contracts_org_idx   on employment_contracts(organization_id);

create table if not exists leave_types (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  code                  text not null,
  name_en               text not null,
  name_ar               text,
  paid                  boolean not null default true,
  default_days_per_year numeric(5,1),
  oman_labour_note      text,
  active                boolean not null default true,
  created_at            timestamptz default now(),
  unique (organization_id, code)
);

create table if not exists leave_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  staff_id         uuid not null references profiles(id) on delete cascade,
  leave_type_id    uuid not null references leave_types(id) on delete restrict,
  start_date       date not null,
  end_date         date not null,
  working_days     numeric(5,1),
  reason           text,
  status           leave_request_status not null default 'pending',
  approved_by      uuid references profiles(id) on delete set null,
  approved_at      timestamptz,
  evidence_file_id uuid references files(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists leave_req_staff_idx  on leave_requests(staff_id);
create index if not exists leave_req_status_idx on leave_requests(status);

create table if not exists leave_balances (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  staff_id          uuid not null references profiles(id) on delete cascade,
  leave_type_id     uuid not null references leave_types(id) on delete cascade,
  year              int not null,
  entitled_days     numeric(5,1) not null default 0,
  carried_over_days numeric(5,1) not null default 0,
  taken_days        numeric(5,1) not null default 0,
  updated_at        timestamptz default now(),
  unique (staff_id, leave_type_id, year)
);

create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  work_date       date not null,
  check_in        timestamptz,
  check_out       timestamptz,
  status          attendance_status not null default 'present',
  worked_hours    numeric(5,2),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (staff_id, work_date)
);
create index if not exists attendance_date_idx on attendance(work_date);

create table if not exists performance_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  period          text not null,
  reviewer_id     uuid references profiles(id) on delete set null,
  kpis            jsonb not null default '{}',
  rating          numeric(3,1),
  strengths       text,
  improvements    text,
  status          review_status not null default 'draft',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists reviews_staff_idx on performance_reviews(staff_id);

create table if not exists job_openings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title           text not null,
  department      text,
  role            staff_role,
  headcount       int not null default 1,
  status          opening_status not null default 'open',
  jd_file_id      uuid references files(id) on delete set null,
  opened_by       uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists candidates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  opening_id      uuid references job_openings(id) on delete set null,
  name            text not null,
  email           text,
  phone_e164      text,
  stage           candidate_stage not null default 'applied',
  rating          numeric(3,1),
  cv_file_id      uuid references files(id) on delete set null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists candidates_opening_idx on candidates(opening_id);
create index if not exists candidates_stage_idx   on candidates(stage);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['employment_contracts','leave_requests','attendance','performance_reviews','job_openings','candidates'] loop
    execute format('drop trigger if exists trg_%1$I_touch on %1$I; create trigger trg_%1$I_touch before update on %1$I for each row execute function _touch_updated_at();', t);
  end loop;
end $$;

-- Seed standard Oman leave categories (CONFIG, not business data).
-- ⚠️ HR must verify day-counts against the current Oman Labour Law (RD 53/2023);
-- every value here is editable in the app.
do $$
declare o record;
begin
  for o in select id from organizations loop
    insert into leave_types (organization_id, code, name_en, name_ar, paid, default_days_per_year, oman_labour_note) values
      (o.id,'annual','Annual Leave','إجازة سنوية',true,30,'RD 53/2023 — verify'),
      (o.id,'sick','Sick Leave','إجازة مرضية',true,null,'Tiered pay per law — verify'),
      (o.id,'emergency','Emergency Leave','إجازة طارئة',true,null,'Per contract policy'),
      (o.id,'maternity','Maternity Leave','إجازة أمومة',true,98,'RD 53/2023 — verify'),
      (o.id,'paternity','Paternity Leave','إجازة أبوة',true,7,'Verify'),
      (o.id,'bereavement','Bereavement Leave','إجازة وفاة',true,null,'Verify by relation'),
      (o.id,'marriage','Marriage Leave','إجازة زواج',true,3,'Verify'),
      (o.id,'hajj','Hajj Leave','إجازة حج',true,15,'Once in service — verify'),
      (o.id,'unpaid','Unpaid Leave','إجازة بدون راتب',false,null,'By approval')
    on conflict (organization_id, code) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table employment_contracts enable row level security;
alter table leave_types          enable row level security;
alter table leave_requests       enable row level security;
alter table leave_balances       enable row level security;
alter table attendance           enable row level security;
alter table performance_reviews  enable row level security;
alter table job_openings         enable row level security;
alter table candidates           enable row level security;

create policy contracts_read on employment_contracts for select using (
  organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager')
);
create policy contracts_write on employment_contracts for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy leavetypes_read on leave_types for select using (organization_id = my_org());
create policy leavetypes_write on leave_types for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy leavereq_read on leave_requests for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy leavereq_write on leave_requests for all using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager'));

create policy leavebal_read on leave_balances for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy leavebal_write on leave_balances for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy attendance_read on attendance for select using (
  organization_id = my_org() and (staff_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy attendance_write on attendance for all using (
  organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (staff_id = auth.uid() or is_exec() or my_staff_role() = 'hr_manager'));

create policy reviews_read on performance_reviews for select using (
  organization_id = my_org() and (staff_id = auth.uid() or reviewer_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
);
create policy reviews_write on performance_reviews for all using (
  organization_id = my_org() and (reviewer_id = auth.uid() or manages(staff_id) or is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

create policy openings_read on job_openings for select using (organization_id = my_org());
create policy openings_write on job_openings for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org());

-- Candidates carry PII: HR + exec only.
create policy candidates_all on candidates for all using (
  organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager')
) with check (organization_id = my_org() and (is_exec() or my_staff_role() = 'hr_manager'));
