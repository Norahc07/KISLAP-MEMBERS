-- KISLAP Kabataan — Mauban Youth Profiling and Volunteerism Survey
-- Run once in the Supabase SQL Editor after supabase/staff-page-access.sql
--
-- Grantable staff keys added:
--   youth_profiling, youth_profiling_create, youth_profiling_update, youth_profiling_delete
-- Analytics remain admin-only (is_admin), not grantable.

create table if not exists public.youth_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,

  -- Eligibility / consent
  age_eligible boolean,
  resides_mauban boolean,
  consent_agreed boolean,
  age_band text,
  guardian_name text,
  guardian_permission boolean,
  youth_assent boolean,

  -- Personal
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  suffix text not null default '',
  nickname text not null default '',
  date_of_birth date,
  sex text,
  civil_status text,
  pwd text check (pwd is null or pwd in ('yes', 'no', 'prefer_not')),
  pwd_details text not null default '',
  barangay text not null default '',
  registered_voter text,
  voter_barangay text,
  voter_barangay_other text,
  is_household_head text,
  household_relationship text,
  household_relationship_other text,
  address text not null default '',
  current_address text not null default '',
  permanent_address text not null default '',
  contact_number text not null default '',
  email text not null default '',

  -- Education
  educational_status text,
  school_name text not null default '',
  course_strand text not null default '',
  continue_education text,

  -- Employment
  employment_status text,
  livelihood_interest text,
  opportunities text[] not null default '{}',

  -- Skills / interests
  skills text[] not null default '{}',
  other_skills text not null default '',
  skills_to_develop text[] not null default '{}',
  interests text[] not null default '{}',
  free_time text not null default '',

  -- Volunteerism
  volunteered_before text,
  volunteer_activities text[] not null default '{}',
  volunteer_motivations text[] not null default '{}',
  volunteer_interest text,
  volunteer_frequency text,
  availability_days text[] not null default '{}',
  availability_time text,

  -- Community
  community_issues text[] not null default '{}',
  barangay_programs_needed text not null default '',
  proposed_project text not null default '',
  desired_changes text not null default '',

  -- KISLAP programs
  kislap_programs text[] not null default '{}',
  contribution_areas text[] not null default '{}',
  volunteer_encouragement text not null default '',

  -- Membership / recruitment
  kislap_familiarity text,
  membership_interest text,
  contact_opt_in text,
  preferred_contact_method text not null default '',
  preferred_contact_details text not null default '',
  communications_agreement text,

  -- Additional
  suggestions text not null default '',
  additional_notes text not null default '',

  -- Meta
  status text not null default 'submitted' check (status in ('draft', 'submitted')),
  collected_by int,
  collected_by_user uuid references auth.users(id) on delete set null,
  collection_barangay text not null default '',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youth_profiles_barangay_idx on public.youth_profiles (barangay);
create index if not exists youth_profiles_membership_interest_idx on public.youth_profiles (membership_interest);
create index if not exists youth_profiles_collected_by_idx on public.youth_profiles (collected_by);
create index if not exists youth_profiles_status_idx on public.youth_profiles (status);
create index if not exists youth_profiles_volunteer_interest_idx on public.youth_profiles (volunteer_interest);
create index if not exists youth_profiles_pwd_idx on public.youth_profiles (pwd);

alter table public.youth_profiles enable row level security;

drop policy if exists "Staff read youth profiles" on public.youth_profiles;
create policy "Staff read youth profiles" on public.youth_profiles
  for select to authenticated
  using (public.has_page_access('youth_profiling'));

drop policy if exists "Staff insert youth profiles" on public.youth_profiles;
create policy "Staff insert youth profiles" on public.youth_profiles
  for insert to authenticated
  with check (public.has_page_access('youth_profiling_create'));

drop policy if exists "Staff update youth profiles" on public.youth_profiles;
create policy "Staff update youth profiles" on public.youth_profiles
  for update to authenticated
  using (public.has_page_access('youth_profiling_update'))
  with check (public.has_page_access('youth_profiling_update'));

drop policy if exists "Staff delete youth profiles" on public.youth_profiles;
create policy "Staff delete youth profiles" on public.youth_profiles
  for delete to authenticated
  using (public.has_page_access('youth_profiling_delete'));

revoke all on public.youth_profiles from anon;
grant select, insert, update, delete on public.youth_profiles to authenticated;

create or replace function public.youth_profiles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists youth_profiles_touch on public.youth_profiles;
create trigger youth_profiles_touch
  before update on public.youth_profiles
  for each row execute function public.youth_profiles_touch();

-- Upsert by client_id for offline sync (idempotent)
create or replace function public.upsert_youth_profile(payload jsonb)
returns public.youth_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_row public.youth_profiles;
  v_member int;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;
  if not (
    public.has_page_access('youth_profiling_create')
    or public.has_page_access('youth_profiling_update')
  ) then
    raise exception 'You do not have permission to save youth profiles.';
  end if;

  v_client := nullif(payload->>'client_id', '')::uuid;
  if v_client is null then
    raise exception 'client_id is required.';
  end if;

  select member_no into v_member from public.profiles where id = auth.uid();

  insert into public.youth_profiles (
    client_id,
    age_eligible, resides_mauban, consent_agreed, age_band,
    guardian_name, guardian_permission, youth_assent,
    first_name, middle_name, last_name, suffix, nickname, date_of_birth,
    sex, civil_status, pwd, pwd_details, barangay, registered_voter, voter_barangay, voter_barangay_other,
    is_household_head, household_relationship, household_relationship_other,
    address, current_address, permanent_address, contact_number, email,
    educational_status, school_name, course_strand, continue_education,
    employment_status, livelihood_interest, opportunities,
    skills, other_skills, skills_to_develop, interests, free_time,
    volunteered_before, volunteer_activities, volunteer_motivations,
    volunteer_interest, volunteer_frequency, availability_days, availability_time,
    community_issues, barangay_programs_needed, proposed_project, desired_changes,
    kislap_programs, contribution_areas, volunteer_encouragement,
    kislap_familiarity, membership_interest, contact_opt_in,
    preferred_contact_method, preferred_contact_details, communications_agreement,
    suggestions, additional_notes,
    status, collected_by, collected_by_user, collection_barangay, synced_at
  )
  values (
    v_client,
    (payload->>'age_eligible')::boolean,
    (payload->>'resides_mauban')::boolean,
    (payload->>'consent_agreed')::boolean,
    nullif(payload->>'age_band', ''),
    coalesce(payload->>'guardian_name', ''),
    (payload->>'guardian_permission')::boolean,
    (payload->>'youth_assent')::boolean,
    coalesce(payload->>'first_name', ''),
    coalesce(payload->>'middle_name', ''),
    coalesce(payload->>'last_name', ''),
    coalesce(payload->>'suffix', ''),
    coalesce(payload->>'nickname', ''),
    nullif(payload->>'date_of_birth', '')::date,
    nullif(payload->>'sex', ''),
    nullif(payload->>'civil_status', ''),
    nullif(payload->>'pwd', ''),
    coalesce(payload->>'pwd_details', ''),
    coalesce(payload->>'barangay', ''),
    nullif(payload->>'registered_voter', ''),
    nullif(payload->>'voter_barangay', ''),
    coalesce(payload->>'voter_barangay_other', ''),
    nullif(payload->>'is_household_head', ''),
    nullif(payload->>'household_relationship', ''),
    coalesce(payload->>'household_relationship_other', ''),
    coalesce(nullif(payload->>'address', ''), payload->>'current_address', ''),
    coalesce(payload->>'current_address', payload->>'address', ''),
    coalesce(payload->>'permanent_address', ''),
    coalesce(payload->>'contact_number', ''),
    coalesce(payload->>'email', ''),
    nullif(payload->>'educational_status', ''),
    coalesce(payload->>'school_name', ''),
    coalesce(payload->>'course_strand', ''),
    nullif(payload->>'continue_education', ''),
    nullif(payload->>'employment_status', ''),
    nullif(payload->>'livelihood_interest', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'opportunities', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'skills', '[]'::jsonb))), '{}'),
    coalesce(payload->>'other_skills', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'skills_to_develop', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'interests', '[]'::jsonb))), '{}'),
    coalesce(payload->>'free_time', ''),
    nullif(payload->>'volunteered_before', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'volunteer_activities', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'volunteer_motivations', '[]'::jsonb))), '{}'),
    nullif(payload->>'volunteer_interest', ''),
    nullif(payload->>'volunteer_frequency', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'availability_days', '[]'::jsonb))), '{}'),
    nullif(payload->>'availability_time', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'community_issues', '[]'::jsonb))), '{}'),
    coalesce(payload->>'barangay_programs_needed', ''),
    coalesce(payload->>'proposed_project', ''),
    coalesce(payload->>'desired_changes', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'kislap_programs', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'contribution_areas', '[]'::jsonb))), '{}'),
    coalesce(payload->>'volunteer_encouragement', ''),
    nullif(payload->>'kislap_familiarity', ''),
    nullif(payload->>'membership_interest', ''),
    nullif(payload->>'contact_opt_in', ''),
    coalesce(payload->>'preferred_contact_method', ''),
    coalesce(payload->>'preferred_contact_details', ''),
    nullif(payload->>'communications_agreement', ''),
    coalesce(payload->>'suggestions', ''),
    coalesce(payload->>'additional_notes', ''),
    coalesce(nullif(payload->>'status', ''), 'submitted'),
    coalesce(nullif(payload->>'collected_by', '')::int, v_member),
    auth.uid(),
    coalesce(payload->>'collection_barangay', ''),
    now()
  )
  on conflict (client_id) do update set
    age_eligible = excluded.age_eligible,
    resides_mauban = excluded.resides_mauban,
    consent_agreed = excluded.consent_agreed,
    age_band = excluded.age_band,
    guardian_name = excluded.guardian_name,
    guardian_permission = excluded.guardian_permission,
    youth_assent = excluded.youth_assent,
    first_name = excluded.first_name,
    middle_name = excluded.middle_name,
    last_name = excluded.last_name,
    suffix = excluded.suffix,
    nickname = excluded.nickname,
    date_of_birth = excluded.date_of_birth,
    sex = excluded.sex,
    civil_status = excluded.civil_status,
    pwd = excluded.pwd,
    pwd_details = excluded.pwd_details,
    barangay = excluded.barangay,
    registered_voter = excluded.registered_voter,
    voter_barangay = excluded.voter_barangay,
    voter_barangay_other = excluded.voter_barangay_other,
    is_household_head = excluded.is_household_head,
    household_relationship = excluded.household_relationship,
    household_relationship_other = excluded.household_relationship_other,
    address = excluded.address,
    current_address = excluded.current_address,
    permanent_address = excluded.permanent_address,
    contact_number = excluded.contact_number,
    email = excluded.email,
    educational_status = excluded.educational_status,
    school_name = excluded.school_name,
    course_strand = excluded.course_strand,
    continue_education = excluded.continue_education,
    employment_status = excluded.employment_status,
    livelihood_interest = excluded.livelihood_interest,
    opportunities = excluded.opportunities,
    skills = excluded.skills,
    other_skills = excluded.other_skills,
    skills_to_develop = excluded.skills_to_develop,
    interests = excluded.interests,
    free_time = excluded.free_time,
    volunteered_before = excluded.volunteered_before,
    volunteer_activities = excluded.volunteer_activities,
    volunteer_motivations = excluded.volunteer_motivations,
    volunteer_interest = excluded.volunteer_interest,
    volunteer_frequency = excluded.volunteer_frequency,
    availability_days = excluded.availability_days,
    availability_time = excluded.availability_time,
    community_issues = excluded.community_issues,
    barangay_programs_needed = excluded.barangay_programs_needed,
    proposed_project = excluded.proposed_project,
    desired_changes = excluded.desired_changes,
    kislap_programs = excluded.kislap_programs,
    contribution_areas = excluded.contribution_areas,
    volunteer_encouragement = excluded.volunteer_encouragement,
    kislap_familiarity = excluded.kislap_familiarity,
    membership_interest = excluded.membership_interest,
    contact_opt_in = excluded.contact_opt_in,
    preferred_contact_method = excluded.preferred_contact_method,
    preferred_contact_details = excluded.preferred_contact_details,
    communications_agreement = excluded.communications_agreement,
    suggestions = excluded.suggestions,
    additional_notes = excluded.additional_notes,
    status = excluded.status,
    collected_by = coalesce(excluded.collected_by, youth_profiles.collected_by),
    collected_by_user = auth.uid(),
    collection_barangay = excluded.collection_barangay,
    synced_at = now(),
    updated_at = now()
  where public.has_page_access('youth_profiling_update')
     or public.has_page_access('youth_profiling_create')
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.upsert_youth_profile(jsonb) to authenticated;

-- Admin-only aggregate counts by barangay (no PII)
create or replace function public.youth_profiling_barangay_stats()
returns table (
  barangay text,
  total bigint,
  volunteer_yes bigint,
  membership_apply bigint,
  contact_opt_in_yes bigint,
  pwd_yes bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can view youth profiling analytics.';
  end if;
  return query
  select
    coalesce(nullif(btrim(p.barangay), ''), 'Unspecified') as barangay,
    count(*)::bigint as total,
    count(*) filter (where p.volunteer_interest = 'yes')::bigint as volunteer_yes,
    count(*) filter (where p.membership_interest = 'apply')::bigint as membership_apply,
    count(*) filter (where p.contact_opt_in = 'yes')::bigint as contact_opt_in_yes,
    count(*) filter (where p.pwd = 'yes')::bigint as pwd_yes
  from public.youth_profiles p
  where p.status = 'submitted'
  group by 1
  order by 1;
end;
$$;

grant execute on function public.youth_profiling_barangay_stats() to authenticated;

-- Extend allowed staff permission keys
create or replace function public.save_staff_page_access(p_member_no int, p_pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pages text[] := coalesce(p_pages, '{}');
  v_allowed text[] := array[
    'documents', 'documents_create', 'documents_update', 'documents_delete',
    'registrations', 'registrations_edit', 'registrations_review',
    'members', 'members_create', 'members_update', 'members_delete',
    'assign', 'assign_write',
    'tracker', 'tracker_write',
    'users', 'audit',
    'youth_profiling', 'youth_profiling_create', 'youth_profiling_update', 'youth_profiling_delete'
  ];
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change page access.';
  end if;
  if p_member_no is null or p_member_no < 1 then
    raise exception 'Choose a member.';
  end if;
  if not exists (select 1 from public.membership_tracker where member_no = p_member_no) then
    raise exception 'That membership ID was not found.';
  end if;
  if exists (
    select 1 from unnest(v_pages) page where page is null or page <> all(v_allowed)
  ) then
    raise exception 'Choose only allowed admin pages and actions.';
  end if;

  select full_name into v_name from public.membership_tracker where member_no = p_member_no;

  if cardinality(v_pages) = 0 then
    delete from public.staff_page_access where member_no = p_member_no;
    update public.app_settings
    set tracker_member_nos = array_remove(tracker_member_nos, p_member_no),
        updated_at = now()
    where id = 1;
    perform public.log_audit(
      'staff_page_access',
      'Removed admin page access for ' || coalesce(nullif(btrim(v_name), ''), 'member ' || p_member_no::text),
      jsonb_build_object('member_no', p_member_no, 'pages', '[]'::jsonb)
    );
    return;
  end if;

  insert into public.staff_page_access (member_no, pages, updated_at, updated_by)
  values (p_member_no, v_pages, now(), auth.uid())
  on conflict (member_no) do update
  set pages = excluded.pages,
      updated_at = now(),
      updated_by = auth.uid();

  if 'tracker' = any(v_pages) then
    update public.app_settings
    set tracker_member_nos = (
          select array_agg(distinct n order by n)
          from unnest(tracker_member_nos || p_member_no) as n
        ),
        updated_at = now()
    where id = 1;
  else
    update public.app_settings
    set tracker_member_nos = array_remove(tracker_member_nos, p_member_no),
        updated_at = now()
    where id = 1;
  end if;

  perform public.log_audit(
    'staff_page_access',
    'Updated admin page access for ' || coalesce(nullif(btrim(v_name), ''), 'member ' || p_member_no::text),
    jsonb_build_object('member_no', p_member_no, 'pages', to_jsonb(v_pages))
  );
end;
$$;

grant execute on function public.save_staff_page_access(int, text[]) to authenticated;
