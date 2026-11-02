-- Per-member admin-side page access.
-- Run once in the Supabase SQL Editor after supabase/accounts.sql.
-- Only the real admin can grant or change these pages.
-- Grantable pages: registrations, members, assign, tracker, users, audit.

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

create or replace function public.save_staff_page_access(p_member_no int, p_pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pages text[] := coalesce(p_pages, '{}');
  v_allowed text[] := array['registrations', 'members', 'assign', 'tracker', 'users', 'audit'];
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
    raise exception 'Choose only allowed admin pages.';
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

-- Allow granted staff to read the pages they were offered.
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
