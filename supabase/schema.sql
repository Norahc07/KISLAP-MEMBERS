-- KISLAP Youth Volunteers — Organization Manager schema
-- Run this whole file once in Supabase Dashboard → SQL Editor, then run seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  photo_url   text,
  photo_path  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  kind        text not null default 'committee' check (kind in ('executive', 'committee')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  title       text not null,
  level       text not null default 'member' check (level in ('officer', 'director', 'assistant', 'member')),
  sort_order  int  not null default 0,
  member_id   uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists positions_unit_idx   on public.positions(unit_id);
create index if not exists positions_member_idx on public.positions(member_id);

-- Emails listed here are allowed to create / edit / delete data.
create table if not exists public.admins (
  email text primary key
);

insert into public.admins(email) values ('admin@admin.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone can read, only admins can write
-- ---------------------------------------------------------------------------
alter table public.members   enable row level security;
alter table public.units     enable row level security;
alter table public.positions enable row level security;
alter table public.admins    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['members', 'units', 'positions'] loop
    execute format('drop policy if exists "Public read" on public.%I', t);
    execute format('drop policy if exists "Admin write" on public.%I', t);
    execute format('create policy "Public read" on public.%I for select using (true)', t);
    execute format('create policy "Admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for profile photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar public read"  on storage.objects;
drop policy if exists "Avatar admin insert" on storage.objects;
drop policy if exists "Avatar admin update" on storage.objects;
drop policy if exists "Avatar admin delete" on storage.objects;

create policy "Avatar public read"  on storage.objects for select using (bucket_id = 'avatars');
create policy "Avatar admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and public.is_admin());
create policy "Avatar admin update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and public.is_admin());
create policy "Avatar admin delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: push changes to every open browser
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['members', 'units', 'positions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
