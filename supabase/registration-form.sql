-- Membership registration form.
-- Run once in Supabase → SQL Editor after membership-tracker.sql.
-- Safe to run again. Saved answers and tracker checkboxes are kept.
-- A member can update their own submitted or approved form. Approval status stays as it is.

create table if not exists public.registrations (
  member_no              int primary key references public.membership_tracker(member_no) on delete cascade,
  surname                text not null,
  first_name             text not null,
  middle_name            text not null default '',
  suffix                 text not null default '',
  sex                    text not null check (sex in ('male', 'female')),
  age                    int not null check (age between 1 and 120),
  date_of_birth          date not null,
  civil_status           text not null check (civil_status in ('single', 'married', 'other')),
  address                text not null,
  barangay               text not null,
  city                   text not null,
  province               text not null,
  contact_number         text not null,
  email                  text not null,
  facebook_name          text not null default '',
  pwd                    text check (pwd is null or pwd in ('yes', 'no', 'prefer_not')),
  registered_voter       text check (registered_voter is null or registered_voter in ('yes', 'no', 'prefer_not')),
  religion               text not null default '',
  skills                 text not null default '',
  education_level        text not null,
  school_name            text not null,
  grade_level            text not null default '',
  course                 text not null default '',
  school_work_status     text not null,
  guardian_name          text not null,
  guardian_contact       text not null,
  guardian_relationship  text not null,
  alt_contact_name       text not null default '',
  alt_contact_number     text not null default '',
  interests              text[] not null default '{}',
  preferred_committee    text not null default '',
  other_interests        text not null default '',
  availability           text[] not null default '{}',
  photo_status           text not null check (photo_status in ('submitted', 'pending')),
  applicant_printed_name text not null,
  applicant_signature    text not null,
  date_signed            date not null,
  guardian_signature     text not null default '',
  guardian_signed_date   date,
  privacy_consent        boolean not null,
  announcements_consent  boolean not null,
  photo_public_consent   boolean not null default false,
  privacy_signature      text not null,
  privacy_date           date not null,
  date_received          date,
  interview_date         date,
  application_status     text check (application_status is null or application_status in ('pending', 'approved', 'declined')),
  interview_assessment   text check (interview_assessment is null or interview_assessment in ('recommended', 'review', 'not_recommended')),
  assigned_position      text not null default '',
  remarks                text not null default '',
  reviewed_by            text not null default '',
  approval_date          date,
  submitted_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.registrations
  add column if not exists father_name text not null default '',
  add column if not exists mother_name text not null default '',
  add column if not exists elementary_school text not null default '',
  add column if not exists high_school text not null default '',
  add column if not exists college_school text not null default '',
  add column if not exists strand text not null default '';

alter table public.registrations enable row level security;

drop policy if exists "Admin read registrations" on public.registrations;
create policy "Admin read registrations"
  on public.registrations
  for select to authenticated
  using (public.is_admin());

revoke all on public.registrations from anon, authenticated;
grant select on public.registrations to authenticated;

create or replace function public.submit_registration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  v_interests text[];
  v_availability text[];
  v_name text;
begin
  if payload is null then
    raise exception 'Registration form is empty.';
  end if;

  begin
    n := (payload->>'member_no')::int;
  exception when others then
    raise exception 'Enter a valid membership ID, such as KISLAP-26-001.';
  end;

  if n is null or n < 1 then
    raise exception 'Enter a valid membership ID, such as KISLAP-26-001.';
  end if;

  if not exists (select 1 from public.membership_tracker where member_no = n) then
    raise exception 'Membership ID % was not found. Use the ID given by KISLAP.', 'KISLAP-26-' || lpad(n::text, 3, '0');
  end if;

  if exists (select 1 from public.registrations where member_no = n)
     and not public.is_admin()
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and member_no = n
     )
  then
    raise exception 'You can only update your own registration.';
  end if;

  if coalesce(payload->>'surname', '') = ''
    or coalesce(payload->>'first_name', '') = ''
    or coalesce(payload->>'father_name', '') = ''
    or coalesce(payload->>'mother_name', '') = ''
    or coalesce(payload->>'sex', '') not in ('male', 'female')
    or coalesce(payload->>'civil_status', '') not in ('single', 'married', 'other')
    or coalesce(payload->>'address', '') = ''
    or coalesce(payload->>'barangay', '') = ''
    or coalesce(payload->>'city', '') = ''
    or coalesce(payload->>'province', '') = ''
    or coalesce(payload->>'contact_number', '') = ''
    or coalesce(payload->>'email', '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or coalesce(payload->>'education_level', '') not in (
      'elementary', 'secondary', 'junior_high', 'senior_high', 'vocational',
      'college_undergraduate', 'college_graduate', 'postgraduate', 'other'
    )
    or coalesce(payload->>'school_name', '') = ''
    or coalesce(payload->>'school_work_status', '') not in ('student', 'employed', 'self_employed', 'unemployed', 'other')
    or coalesce(payload->>'guardian_name', '') = ''
    or coalesce(payload->>'guardian_contact', '') = ''
    or coalesce(payload->>'guardian_relationship', '') = ''
    or coalesce(payload->>'photo_status', '') not in ('submitted', 'pending')
    or coalesce(payload->>'applicant_printed_name', '') = ''
    or coalesce(payload->>'applicant_signature', '') = ''
    or coalesce(payload->>'privacy_signature', '') = ''
    or coalesce(payload->>'privacy_consent', '') <> 'true'
    or coalesce(payload->>'announcements_consent', '') <> 'true'
    or (payload->>'age') !~ '^[0-9]+$'
    or (payload->>'age')::int < 1
    or (payload->>'age')::int > 120
    or (payload->>'date_of_birth') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (payload->>'date_signed') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (payload->>'privacy_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  then
    raise exception 'Please complete every required field before submitting.';
  end if;

  if (payload->>'age')::int < 18 and (
    coalesce(payload->>'guardian_signature', '') = ''
    or coalesce(payload->>'guardian_signed_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) then
    raise exception 'Applicants under 18 need a parent or guardian signature and date.';
  end if;

  select coalesce(array_agg(item), '{}')
  into v_interests
  from jsonb_array_elements_text(coalesce(payload->'interests', '[]'::jsonb)) as item
  where btrim(item) <> '';

  select coalesce(array_agg(item), '{}')
  into v_availability
  from jsonb_array_elements_text(coalesce(payload->'availability', '[]'::jsonb)) as item
  where btrim(item) <> '';

  if cardinality(v_interests) < 1 or cardinality(v_availability) < 1 then
    raise exception 'Choose at least one volunteer area and one availability.';
  end if;

  insert into public.registrations (
    member_no, surname, first_name, middle_name, suffix, father_name, mother_name, sex, age, date_of_birth, civil_status,
    address, barangay, city, province, contact_number, email, facebook_name, pwd, registered_voter,
    religion, skills, education_level, school_name, elementary_school, high_school, college_school, strand, grade_level, course, school_work_status,
    guardian_name, guardian_contact, guardian_relationship, alt_contact_name, alt_contact_number,
    interests, preferred_committee, other_interests, availability, photo_status,
    applicant_printed_name, applicant_signature, date_signed, guardian_signature, guardian_signed_date,
    privacy_consent, announcements_consent, photo_public_consent, privacy_signature, privacy_date,
    date_received, interview_date, application_status, interview_assessment, assigned_position,
    remarks, reviewed_by, approval_date
  )
  values (
    n,
    btrim(payload->>'surname'),
    btrim(payload->>'first_name'),
    coalesce(btrim(payload->>'middle_name'), ''),
    coalesce(btrim(payload->>'suffix'), ''),
    btrim(payload->>'father_name'),
    btrim(payload->>'mother_name'),
    payload->>'sex',
    (payload->>'age')::int,
    (payload->>'date_of_birth')::date,
    payload->>'civil_status',
    btrim(payload->>'address'),
    btrim(payload->>'barangay'),
    btrim(payload->>'city'),
    btrim(payload->>'province'),
    btrim(payload->>'contact_number'),
    btrim(payload->>'email'),
    coalesce(btrim(payload->>'facebook_name'), ''),
    nullif(payload->>'pwd', ''),
    nullif(payload->>'registered_voter', ''),
    coalesce(btrim(payload->>'religion'), ''),
    coalesce(btrim(payload->>'skills'), ''),
    payload->>'education_level',
    btrim(payload->>'school_name'),
    coalesce(btrim(payload->>'elementary_school'), ''),
    coalesce(btrim(payload->>'high_school'), ''),
    coalesce(btrim(payload->>'college_school'), ''),
    coalesce(btrim(payload->>'strand'), ''),
    coalesce(btrim(payload->>'grade_level'), ''),
    coalesce(btrim(payload->>'course'), ''),
    payload->>'school_work_status',
    btrim(payload->>'guardian_name'),
    btrim(payload->>'guardian_contact'),
    btrim(payload->>'guardian_relationship'),
    coalesce(btrim(payload->>'alt_contact_name'), ''),
    coalesce(btrim(payload->>'alt_contact_number'), ''),
    v_interests,
    coalesce(btrim(payload->>'preferred_committee'), ''),
    coalesce(btrim(payload->>'other_interests'), ''),
    v_availability,
    payload->>'photo_status',
    btrim(payload->>'applicant_printed_name'),
    btrim(payload->>'applicant_signature'),
    (payload->>'date_signed')::date,
    coalesce(btrim(payload->>'guardian_signature'), ''),
    nullif(payload->>'guardian_signed_date', '')::date,
    true,
    true,
    coalesce(payload->>'photo_public_consent', '') = 'true',
    btrim(payload->>'privacy_signature'),
    (payload->>'privacy_date')::date,
    case when public.is_admin() then nullif(payload->>'date_received', '')::date else null end,
    case when public.is_admin() then nullif(payload->>'interview_date', '')::date else null end,
    case when public.is_admin() then nullif(payload->>'application_status', '') else 'pending' end,
    case when public.is_admin() then nullif(payload->>'interview_assessment', '') else null end,
    case when public.is_admin() then coalesce(btrim(payload->>'assigned_position'), '') else '' end,
    case when public.is_admin() then coalesce(btrim(payload->>'remarks'), '') else '' end,
    case when public.is_admin() then coalesce(btrim(payload->>'reviewed_by'), '') else '' end,
    case when public.is_admin() then nullif(payload->>'approval_date', '')::date else null end
  )
  on conflict (member_no) do update set
    surname = excluded.surname,
    first_name = excluded.first_name,
    middle_name = excluded.middle_name,
    suffix = excluded.suffix,
    father_name = excluded.father_name,
    mother_name = excluded.mother_name,
    sex = excluded.sex,
    age = excluded.age,
    date_of_birth = excluded.date_of_birth,
    civil_status = excluded.civil_status,
    address = excluded.address,
    barangay = excluded.barangay,
    city = excluded.city,
    province = excluded.province,
    contact_number = excluded.contact_number,
    email = excluded.email,
    facebook_name = excluded.facebook_name,
    pwd = excluded.pwd,
    registered_voter = excluded.registered_voter,
    religion = excluded.religion,
    skills = excluded.skills,
    education_level = excluded.education_level,
    school_name = excluded.school_name,
    elementary_school = excluded.elementary_school,
    high_school = excluded.high_school,
    college_school = excluded.college_school,
    strand = excluded.strand,
    grade_level = excluded.grade_level,
    course = excluded.course,
    school_work_status = excluded.school_work_status,
    guardian_name = excluded.guardian_name,
    guardian_contact = excluded.guardian_contact,
    guardian_relationship = excluded.guardian_relationship,
    alt_contact_name = excluded.alt_contact_name,
    alt_contact_number = excluded.alt_contact_number,
    interests = excluded.interests,
    preferred_committee = excluded.preferred_committee,
    other_interests = excluded.other_interests,
    availability = excluded.availability,
    photo_status = excluded.photo_status,
    applicant_printed_name = excluded.applicant_printed_name,
    applicant_signature = excluded.applicant_signature,
    date_signed = excluded.date_signed,
    guardian_signature = excluded.guardian_signature,
    guardian_signed_date = excluded.guardian_signed_date,
    privacy_consent = excluded.privacy_consent,
    announcements_consent = excluded.announcements_consent,
    photo_public_consent = excluded.photo_public_consent,
    privacy_signature = excluded.privacy_signature,
    privacy_date = excluded.privacy_date,
    date_received = case when public.is_admin() then excluded.date_received else registrations.date_received end,
    interview_date = case when public.is_admin() then excluded.interview_date else registrations.interview_date end,
    application_status = case when public.is_admin() then excluded.application_status else registrations.application_status end,
    interview_assessment = case when public.is_admin() then excluded.interview_assessment else registrations.interview_assessment end,
    assigned_position = case when public.is_admin() then excluded.assigned_position else registrations.assigned_position end,
    remarks = case when public.is_admin() then excluded.remarks else registrations.remarks end,
    reviewed_by = case when public.is_admin() then excluded.reviewed_by else registrations.reviewed_by end,
    approval_date = case when public.is_admin() then excluded.approval_date else registrations.approval_date end,
    updated_at = now();

  v_name := upper(btrim(concat_ws(
    ' ',
    btrim(payload->>'first_name'),
    nullif(btrim(payload->>'middle_name'), ''),
    btrim(payload->>'surname'),
    nullif(btrim(payload->>'suffix'), '')
  )));

  update public.membership_tracker
  set
    registration_form = true,
    full_name = case when btrim(full_name) = '' then v_name else full_name end
  where member_no = n;

  if exists (select 1 from public.membership_tracker where member_no = n and member_id is null and btrim(full_name) <> '') then
    insert into public.members (full_name)
    select t.full_name
    from public.membership_tracker t
    where t.member_no = n
      and not exists (
        select 1 from public.members m
        where upper(btrim(m.full_name)) = upper(btrim(t.full_name))
      );

    update public.membership_tracker t
    set member_id = m.id
    from public.members m
    where t.member_no = n
      and t.member_id is null
      and upper(btrim(m.full_name)) = upper(btrim(t.full_name));
  end if;

  return jsonb_build_object('ok', true, 'member_no', n);
end;
$$;

revoke all on function public.submit_registration(jsonb) from public, anon, authenticated;
grant execute on function public.submit_registration(jsonb) to anon, authenticated;
