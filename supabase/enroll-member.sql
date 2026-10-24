-- When the admin adds a member, give them the next membership ID,
-- the username KISLAP-26-XXX, and a default password.
-- Advisers added into an adviser position keep an adviser username
-- and do not take a membership ID.
--
-- Run this once in the Supabase SQL Editor after supabase/accounts.sql.
-- Re-running it does not change passwords that already exist.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'officer', 'director', 'assistant', 'member', 'adviser'));

create or replace function public.enroll_member(
  p_name text,
  p_photo_url text default null,
  p_photo_path text default null,
  p_position_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := btrim(coalesce(p_name, ''));
  norm text;
  new_member uuid;
  slot int;
  pos_level text;
  pos_taken uuid;
  acct_role text := 'member';
  track_role text := 'member';
  uname text;
  pwd text;
  email text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can add members.';
  end if;
  if clean = '' then
    raise exception 'Name is required.';
  end if;

  norm := trim(regexp_replace(upper(clean), '[^A-Z0-9Ñ]+', ' ', 'g'));
  if exists (
    select 1
    from public.members
    where trim(regexp_replace(upper(full_name), '[^A-Z0-9Ñ]+', ' ', 'g')) = norm
  ) then
    raise exception '% is already on the member list.', clean;
  end if;

  if p_position_id is not null then
    select level, member_id into pos_level, pos_taken
    from public.positions
    where id = p_position_id;
    if pos_level is null then
      raise exception 'That position was not found.';
    end if;
    if pos_taken is not null then
      raise exception 'That position is already filled.';
    end if;
    if pos_level in ('officer', 'director', 'assistant', 'member') then
      acct_role := pos_level;
      track_role := pos_level;
    elsif pos_level = 'adviser' then
      acct_role := 'adviser';
    end if;
  end if;

  insert into public.members (full_name, photo_url, photo_path)
  values (clean, nullif(btrim(coalesce(p_photo_url, '')), ''), nullif(btrim(coalesce(p_photo_path, '')), ''))
  returning id into new_member;

  pwd := public.random_password();

  if acct_role = 'adviser' then
    uname := trim(both '.' from regexp_replace(upper(clean), '[^A-Z0-9]+', '.', 'g'));
    if uname !~ '^[A-Z0-9]+(\.[A-Z0-9]+)+$' then
      raise exception 'Use a first and last name for an adviser.';
    end if;
    email := lower(uname) || '@advisers.kislap.app';
    perform public.provision_login(email, pwd, uname, null, 'adviser', clean, true, false);
  else
    select t.member_no into slot
    from public.membership_tracker t
    where btrim(t.full_name) = ''
      and t.member_id is null
    order by t.member_no
    limit 1
    for update;

    if slot is null then
      select coalesce(max(t.member_no), 0) + 1 into slot from public.membership_tracker t;
      insert into public.membership_tracker (member_no, member_id, full_name, tracker_role)
      values (slot, new_member, clean, track_role);
    else
      update public.membership_tracker
      set member_id = new_member,
          full_name = clean,
          tracker_role = track_role,
          gforms = false,
          registration_form = false,
          photo_2x2 = false,
          interview = false,
          membership_fee = false
      where member_no = slot;
    end if;

    uname := 'KISLAP-26-' || lpad(slot::text, 3, '0');
    email := lower(uname) || '@members.kislap.app';
    perform public.provision_login(email, pwd, uname, slot, acct_role, clean, true, false);
  end if;

  if p_position_id is not null then
    update public.positions
    set member_id = new_member
    where id = p_position_id;
  end if;

  perform public.log_audit(
    'member_enrolled',
    'Added ' || clean || ' as ' || uname,
    jsonb_build_object('member_no', slot, 'username', uname)
  );

  return jsonb_build_object(
    'id', new_member,
    'full_name', clean,
    'member_no', slot,
    'username', uname,
    'password', pwd
  );
end;
$$;

create or replace function public.enroll_members(p_names text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item text;
  created jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can add members.';
  end if;
  if p_names is null or cardinality(p_names) = 0 then
    raise exception 'Add at least one name.';
  end if;
  foreach item in array p_names loop
    if btrim(coalesce(item, '')) <> '' then
      created := created || jsonb_build_array(public.enroll_member(btrim(item), null, null, null));
    end if;
  end loop;
  if created = '[]'::jsonb then
    raise exception 'Add at least one name.';
  end if;
  return created;
end;
$$;

create or replace function public.delete_enrolled_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  slot int;
  person text;
  adviser_name text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can remove members.';
  end if;

  select full_name into person from public.members where id = p_member_id;
  if person is null then
    return;
  end if;

  select member_no into slot
  from public.membership_tracker
  where member_id = p_member_id
  limit 1;

  if slot is not null then
    delete from auth.users
    where id in (
      select id from public.profiles
      where member_no = slot
        and role <> 'admin'
    );
    update public.membership_tracker
    set member_id = null,
        full_name = '',
        tracker_role = 'member',
        gforms = false,
        registration_form = false,
        photo_2x2 = false,
        interview = false,
        membership_fee = false
    where member_no = slot;
  else
    adviser_name := trim(regexp_replace(upper(person), '[^A-Z0-9Ñ]+', ' ', 'g'));
    delete from auth.users
    where id in (
      select id
      from public.profiles
      where role = 'adviser'
        and member_no is null
        and trim(regexp_replace(upper(full_name), '[^A-Z0-9Ñ]+', ' ', 'g')) = adviser_name
    );
  end if;

  delete from public.members where id = p_member_id;

  perform public.log_audit(
    'member_removed',
    'Removed ' || person,
    jsonb_build_object('member_no', slot)
  );
end;
$$;

grant execute on function public.enroll_member(text, text, text, uuid) to authenticated;
grant execute on function public.enroll_members(text[]) to authenticated;
grant execute on function public.delete_enrolled_member(uuid) to authenticated;
