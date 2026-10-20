-- Member logins, tracker access, and the admin audit log.
-- Run this once in the Supabase SQL Editor after schema.sql, seed.sql,
-- membership-tracker.sql, and registration-form.sql.
--
-- Admin sign-in: username admin, password admin1234, email admin@admin.com.
-- Every named tracker member gets username KISLAP-26-XXX and a random
-- initial password. They must replace it on first sign-in.
-- Re-running this file does not reset a password a member has already changed.
-- It does set the admin password back to admin1234.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  member_no int unique references public.membership_tracker(member_no) on delete set null,
  role text not null check (role in ('admin', 'officer', 'director', 'assistant', 'member')),
  full_name text not null default '',
  must_change_password boolean not null default true,
  initial_password text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  tracker_roles text[] not null default '{}',
  tracker_member_nos int[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_username text not null default '',
  action text not null,
  summary text not null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Read profiles" on public.profiles;
create policy "Read profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Read settings" on public.app_settings;
create policy "Read settings" on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists "Read audit log" on public.audit_log;
create policy "Read audit log" on public.audit_log
  for select to authenticated
  using (public.is_admin());

revoke all on public.profiles from anon;
revoke all on public.app_settings from anon;
revoke all on public.audit_log from anon;
grant select on public.profiles to authenticated;
grant select on public.app_settings to authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.log_audit(p_action text, p_summary text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select username into v_username from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_id, actor_username, action, summary, detail)
  values (
    auth.uid(),
    coalesce(v_username, auth.jwt() ->> 'email', ''),
    left(coalesce(p_action, ''), 80),
    left(coalesce(p_summary, ''), 400),
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

drop function if exists public.complete_password_change();

create or replace function public.complete_password_change(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if length(coalesce(btrim(p_password), '')) < 8 then
    raise exception 'Use at least 8 characters.';
  end if;
  update public.profiles
  set must_change_password = false,
      initial_password = p_password
  where id = auth.uid();
  perform public.log_audit('password_changed', 'Changed the account password', '{}'::jsonb);
end;
$$;

create or replace function public.save_tracker_access(p_roles text[], p_member_nos int[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roles text[] := coalesce(p_roles, '{}');
  v_members int[] := coalesce(p_member_nos, '{}');
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change tracker access.';
  end if;
  if exists (select 1 from unnest(v_roles) role where role not in ('officer', 'director', 'assistant', 'member')) then
    raise exception 'Choose a tracker role of officer, director, assistant, or member.';
  end if;
  update public.app_settings
  set tracker_roles = v_roles,
      tracker_member_nos = v_members,
      updated_at = now()
  where id = 1;
  perform public.log_audit(
    'tracker_access',
    'Updated who can open the membership tracker',
    jsonb_build_object('roles', v_roles, 'member_nos', v_members)
  );
end;
$$;

create or replace function public.registrations_owner_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop trigger if exists registrations_owner on public.registrations;
create trigger registrations_owner
  before insert or update on public.registrations
  for each row execute function public.registrations_owner_check();

drop policy if exists "Member reads own registration" on public.registrations;
create policy "Member reads own registration" on public.registrations
  for select to authenticated
  using (
    public.is_admin()
    or member_no = (select member_no from public.profiles where id = auth.uid())
  );

grant execute on function public.log_audit(text, text, jsonb) to authenticated;
grant execute on function public.complete_password_change(text) to authenticated;
grant execute on function public.save_tracker_access(text[], int[]) to authenticated;

create or replace function public.random_password()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  result text := '';
  i int;
begin
  for i in 1..10 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.provision_login(
  p_email text,
  p_password text,
  p_username text,
  p_member_no int,
  p_role text,
  p_name text,
  p_must_change boolean,
  p_reset_password boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := gen_random_uuid();
  existing uuid;
  has_profile boolean;
begin
  select id into existing from auth.users where lower(email) = lower(p_email) limit 1;

  if existing is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', p_username, 'full_name', p_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      uid::text,
      uid,
      jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  else
    uid := existing;
    if p_reset_password then
      update auth.users
      set encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = uid;
    end if;
    if not exists (select 1 from auth.identities where user_id = uid and provider = 'email') then
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        uid::text,
        uid,
        jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    end if;
  end if;

  select exists (select 1 from public.profiles where id = uid) into has_profile;

  if not has_profile then
    if existing is not null and not p_reset_password then
      update auth.users
      set encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = uid;
    end if;
    insert into public.profiles (id, username, member_no, role, full_name, must_change_password, initial_password)
    values (
      uid,
      p_username,
      p_member_no,
      p_role,
      coalesce(p_name, ''),
      p_must_change,
      case when p_must_change then p_password else null end
    );
  else
    update public.profiles
    set username = p_username,
        member_no = p_member_no,
        role = p_role,
        full_name = coalesce(p_name, full_name)
    where id = uid;
    if p_reset_password then
      update public.profiles
      set must_change_password = p_must_change,
          initial_password = case when p_must_change then p_password else null end
      where id = uid;
    end if;
  end if;

  return uid;
end;
$$;

do $$
declare
  rec record;
  pwd text;
  uname text;
begin
  perform public.provision_login(
    'admin@admin.com',
    'admin1234',
    'admin',
    null,
    'admin',
    'KISLAP Admin',
    false,
    true
  );

  for rec in
    select member_no, full_name, tracker_role
    from public.membership_tracker
    where btrim(full_name) <> ''
    order by member_no
  loop
    uname := 'KISLAP-26-' || lpad(rec.member_no::text, 3, '0');
    pwd := public.random_password();
    perform public.provision_login(
      lower(uname) || '@members.kislap.app',
      pwd,
      uname,
      rec.member_no,
      rec.tracker_role,
      rec.full_name,
      true,
      false
    );
  end loop;
end;
$$;

revoke all on function public.provision_login(text, text, text, int, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.random_password() from public, anon, authenticated;
