-- Per-member admin-side page + CRUD access.
-- Run once in the Supabase SQL Editor after supabase/accounts.sql
-- (and after organization-documents.sql / enroll-member.sql / registration-form.sql if those are already installed).
-- Only the real admin can grant or change these permissions.
--
-- Grantable keys:
--   documents, documents_create, documents_update, documents_delete
--   registrations, registrations_edit, registrations_review
--   members, members_create, members_update, members_delete
--   assign, assign_write
--   tracker, tracker_write
--   users, audit

create table if not exists public.staff_page_access (
  member_no int primary key references public.membership_tracker(member_no) on delete cascade,
  pages text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint staff_page_access_pages_not_empty check (cardinality(pages) > 0)
);

create index if not exists staff_page_access_pages_idx on public.staff_page_access using gin (pages);

alter table public.staff_page_access enable row level security;

drop policy if exists "Read staff page access" on public.staff_page_access;
create policy "Read staff page access" on public.staff_page_access
  for select to authenticated
  using (
    public.is_admin()
    or member_no = (select member_no from public.profiles where id = auth.uid())
  );

revoke all on public.staff_page_access from anon;
grant select on public.staff_page_access to authenticated;

create or replace function public.has_page_access(p_page text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member int;
  v_role text;
  v_pages text[];
  v_tracker_roles text[];
  v_tracker_members int[];
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;

  select member_no, role into v_member, v_role
  from public.profiles
  where id = auth.uid();

  if v_member is not null then
    select pages into v_pages
    from public.staff_page_access
    where member_no = v_member;
    if v_pages is not null and p_page = any(v_pages) then
      return true;
    end if;
  end if;

  if p_page = 'tracker' then
    select tracker_roles, tracker_member_nos
      into v_tracker_roles, v_tracker_members
    from public.app_settings
    where id = 1;
    if v_role = any(coalesce(v_tracker_roles, '{}')) then
      return true;
    end if;
    if v_member is not null and v_member = any(coalesce(v_tracker_members, '{}')) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function public.has_page_access(text) to authenticated;

create or replace function public.can_edit_registrations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.has_page_access('registrations_edit')
    or public.has_page_access('registrations_review');
$$;

create or replace function public.can_review_registrations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.has_page_access('registrations_review');
$$;

grant execute on function public.can_edit_registrations() to authenticated;
grant execute on function public.can_review_registrations() to authenticated;

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
    'users', 'audit'
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

create or replace function public.list_staff_access()
returns table (
  member_no int,
  full_name text,
  username text,
  pages text[],
  via_role boolean,
  via_direct boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roles text[];
  v_members int[];
begin
  if not public.is_admin() then
    raise exception 'Only the admin can list staff access.';
  end if;

  select tracker_roles, tracker_member_nos
    into v_roles, v_members
  from public.app_settings
  where id = 1;

  return query
  with sources as (
    select a.member_no, a.pages, true as via_direct, false as via_role
    from public.staff_page_access a
    union all
    select t.member_no, array['tracker']::text[], false, true
    from public.membership_tracker t
    join public.profiles p on p.member_no = t.member_no
    where p.role = any(coalesce(v_roles, '{}'))
    union all
    select m.member_no, array['tracker']::text[], true, false
    from unnest(coalesce(v_members, '{}')) as m(member_no)
  ),
  aggregated as (
    select
      s.member_no,
      array_agg(distinct page order by page) as pages,
      bool_or(s.via_direct) as via_direct,
      bool_or(s.via_role) as via_role
    from sources s
    cross join lateral unnest(s.pages) as page
    group by s.member_no
  )
  select
    a.member_no,
    coalesce(t.full_name, ''),
    coalesce(p.username, 'KISLAP-26-' || lpad(a.member_no::text, 3, '0')),
    a.pages,
    a.via_role,
    a.via_direct
  from aggregated a
  left join public.membership_tracker t on t.member_no = a.member_no
  left join public.profiles p on p.member_no = a.member_no
  order by a.member_no;
end;
$$;

grant execute on function public.list_staff_access() to authenticated;

-- Registrations read + staff edit ownership
drop policy if exists "Admin read registrations" on public.registrations;
drop policy if exists "Staff read registrations" on public.registrations;
create policy "Staff read registrations" on public.registrations
  for select to authenticated
  using (public.has_page_access('registrations'));

drop policy if exists "Member reads own registration" on public.registrations;
create policy "Member reads own registration" on public.registrations
  for select to authenticated
  using (
    public.has_page_access('registrations')
    or member_no = (select member_no from public.profiles where id = auth.uid())
  );

create or replace function public.registrations_owner_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_edit_registrations() then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and member_no = new.member_no
  ) then
    raise exception 'You can only submit the registration for your own membership ID.';
  end if;
  return new;
end;
$$;

drop policy if exists "Read profiles" on public.profiles;
create policy "Read profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_page_access('users'));

drop policy if exists "Read audit log" on public.audit_log;
create policy "Read audit log" on public.audit_log
  for select to authenticated
  using (public.has_page_access('audit'));

drop policy if exists "Admin reads sessions" on public.user_sessions;
create policy "Admin reads sessions" on public.user_sessions
  for select to authenticated
  using (public.has_page_access('users'));

create or replace function public.online_user_ids()
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_page_access('users') then
    return;
  end if;
  return query
    select distinct s.user_id
    from public.user_sessions s
    where s.last_seen > now() - interval '45 seconds';
end;
$$;

-- Documents CRUD
drop policy if exists "Admin write organization documents" on public.organization_documents;
drop policy if exists "Staff insert organization documents" on public.organization_documents;
drop policy if exists "Staff update organization documents" on public.organization_documents;
drop policy if exists "Staff delete organization documents" on public.organization_documents;

create policy "Staff insert organization documents"
  on public.organization_documents
  for insert to authenticated
  with check (public.has_page_access('documents_create'));

create policy "Staff update organization documents"
  on public.organization_documents
  for update to authenticated
  using (public.has_page_access('documents_update'))
  with check (public.has_page_access('documents_update'));

create policy "Staff delete organization documents"
  on public.organization_documents
  for delete to authenticated
  using (public.has_page_access('documents_delete'));

drop policy if exists "Org documents admin insert" on storage.objects;
drop policy if exists "Org documents admin update" on storage.objects;
drop policy if exists "Org documents admin delete" on storage.objects;
drop policy if exists "Org documents staff insert" on storage.objects;
drop policy if exists "Org documents staff update" on storage.objects;
drop policy if exists "Org documents staff delete" on storage.objects;

create policy "Org documents staff insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'org-documents' and public.has_page_access('documents_create'));

create policy "Org documents staff update"
  on storage.objects for update to authenticated
  using (bucket_id = 'org-documents' and public.has_page_access('documents_update'));

create policy "Org documents staff delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-documents'
    and (
      public.has_page_access('documents_delete')
      or public.has_page_access('documents_update')
    )
  );

-- Members / units / positions / tracker writes
drop policy if exists "Admin write" on public.members;
drop policy if exists "Staff insert members" on public.members;
drop policy if exists "Staff update members" on public.members;
drop policy if exists "Staff delete members" on public.members;

create policy "Staff insert members"
  on public.members for insert to authenticated
  with check (public.has_page_access('members_create'));

create policy "Staff update members"
  on public.members for update to authenticated
  using (public.has_page_access('members_update'))
  with check (public.has_page_access('members_update'));

create policy "Staff delete members"
  on public.members for delete to authenticated
  using (public.has_page_access('members_delete'));

drop policy if exists "Admin write" on public.units;
drop policy if exists "Staff write units" on public.units;
create policy "Staff write units"
  on public.units for all to authenticated
  using (public.has_page_access('assign_write'))
  with check (public.has_page_access('assign_write'));

drop policy if exists "Admin write" on public.positions;
drop policy if exists "Staff write positions" on public.positions;
create policy "Staff write positions"
  on public.positions for all to authenticated
  using (public.has_page_access('assign_write'))
  with check (public.has_page_access('assign_write'));

drop policy if exists "Admin write" on public.membership_tracker;
drop policy if exists "Staff write tracker" on public.membership_tracker;
create policy "Staff write tracker"
  on public.membership_tracker for all to authenticated
  using (public.has_page_access('tracker_write'))
  with check (public.has_page_access('tracker_write'));

-- Avatar uploads for member CRUD
drop policy if exists "Avatar admin insert" on storage.objects;
drop policy if exists "Avatar admin update" on storage.objects;
drop policy if exists "Avatar admin delete" on storage.objects;
drop policy if exists "Avatar staff insert" on storage.objects;
drop policy if exists "Avatar staff update" on storage.objects;
drop policy if exists "Avatar staff delete" on storage.objects;

create policy "Avatar staff insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      public.has_page_access('members_create')
      or public.has_page_access('members_update')
      or name = 'profiles/' || auth.uid()::text || '.jpg'
    )
  );

create policy "Avatar staff update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.has_page_access('members_create')
      or public.has_page_access('members_update')
      or name = 'profiles/' || auth.uid()::text || '.jpg'
    )
  );

create policy "Avatar staff delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.has_page_access('members_update')
      or public.has_page_access('members_delete')
      or name = 'profiles/' || auth.uid()::text || '.jpg'
    )
  );
