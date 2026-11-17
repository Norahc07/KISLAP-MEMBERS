-- Additive PWD fields for youth profiling.
-- Safe to run if youth-profiling.sql already created the table without PWD columns.
-- After this, re-run supabase/youth-profiling.sql so upsert + barangay stats pick up pwd fields
-- (CREATE TABLE IF NOT EXISTS is skipped; CREATE OR REPLACE FUNCTION updates).

alter table public.youth_profiles
  add column if not exists pwd text,
  add column if not exists pwd_details text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'youth_profiles_pwd_check'
  ) then
    alter table public.youth_profiles
      add constraint youth_profiles_pwd_check
      check (pwd is null or pwd in ('yes', 'no', 'prefer_not'));
  end if;
end $$;

create index if not exists youth_profiles_pwd_idx on public.youth_profiles (pwd);
