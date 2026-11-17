-- Additive current + permanent address fields for youth profiling.
-- Run after youth-profiling.sql (safe if columns already exist).
-- Then re-run supabase/youth-profiling.sql so upsert_youth_profile picks up the new fields.

alter table public.youth_profiles
  add column if not exists current_address text not null default '',
  add column if not exists permanent_address text not null default '',
  add column if not exists current_street text not null default '',
  add column if not exists current_province text not null default '',
  add column if not exists current_city text not null default '',
  add column if not exists current_barangay text not null default '',
  add column if not exists permanent_street text not null default '',
  add column if not exists permanent_province text not null default '',
  add column if not exists permanent_city text not null default '',
  add column if not exists permanent_barangay text not null default '';

-- Backfill current address from legacy single address field when empty
update public.youth_profiles
set current_address = address
where coalesce(nullif(btrim(current_address), ''), '') = ''
  and coalesce(nullif(btrim(address), ''), '') <> '';

-- Prefer structured street for older free-text rows
update public.youth_profiles
set current_street = current_address
where coalesce(nullif(btrim(current_street), ''), '') = ''
  and coalesce(nullif(btrim(current_address), ''), '') <> ''
  and coalesce(nullif(btrim(current_province), ''), '') = '';

update public.youth_profiles
set permanent_street = permanent_address
where coalesce(nullif(btrim(permanent_street), ''), '') = ''
  and coalesce(nullif(btrim(permanent_address), ''), '') <> ''
  and coalesce(nullif(btrim(permanent_province), ''), '') = '';
