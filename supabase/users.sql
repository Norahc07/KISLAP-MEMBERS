-- Profile photos, the current password shown to the admin, and live sign-in status.
-- Run this once in the Supabase SQL Editor after supabase/accounts.sql.

alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists photo_path text;

update public.profiles p
set photo_url = m.photo_url,
    photo_path = m.photo_path
from public.membership_tracker t
join public.members m on m.id = t.member_id
where p.member_no = t.member_no
  and p.photo_url is null
  and m.photo_url is not null;

create table if not exists public.user_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists user_sessions_user_idx on public.user_sessions (user_id, last_seen desc);

alter table public.user_sessions enable row level security;

drop policy if exists "Admin reads sessions" on public.user_sessions;
create policy "Admin reads sessions" on public.user_sessions
  for select to authenticated
  using (public.is_admin());

grant select on public.user_sessions to authenticated;

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

create or replace function public.save_profile_photo(p_url text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  update public.profiles
  set photo_url = p_url,
      photo_path = p_path
  where id = auth.uid();

  update public.members m
  set photo_url = p_url,
      photo_path = p_path
  from public.profiles p
  join public.membership_tracker t on t.member_no = p.member_no
  where p.id = auth.uid()
    and t.member_id = m.id;
end;
$$;

create or replace function public.pulse_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or length(coalesce(p_session_id, '')) < 8 then
    return;
  end if;
  insert into public.user_sessions (id, user_id, last_seen)
  values (left(p_session_id, 80), auth.uid(), now())
  on conflict (id) do update
    set user_id = excluded.user_id,
        last_seen = now();
  delete from public.user_sessions
  where last_seen < now() - interval '2 minutes';
end;
$$;

create or replace function public.end_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from public.user_sessions
  where id = left(coalesce(p_session_id, ''), 80)
    and user_id = auth.uid();
end;
$$;

create or replace function public.online_user_ids()
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    select distinct s.user_id
    from public.user_sessions s
    where s.last_seen > now() - interval '45 seconds';
end;
$$;

grant execute on function public.complete_password_change(text) to authenticated;
grant execute on function public.save_profile_photo(text, text) to authenticated;
grant execute on function public.pulse_session(text) to authenticated;
grant execute on function public.end_session(text) to authenticated;
grant execute on function public.online_user_ids() to authenticated;

drop policy if exists "Own profile photo insert" on storage.objects;
drop policy if exists "Own profile photo update" on storage.objects;
create policy "Own profile photo insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = 'profiles/' || auth.uid()::text || '.jpg');
create policy "Own profile photo update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = 'profiles/' || auth.uid()::text || '.jpg');

do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_sessions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
