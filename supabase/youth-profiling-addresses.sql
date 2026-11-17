-- Additive current + permanent address fields for youth profiling.
-- Run after youth-profiling.sql (safe if columns already exist).
-- Then re-run supabase/youth-profiling.sql so upsert_youth_profile picks up the new fields.

alter table public.youth_profiles
  add column if not exists current_address text not null default '',
  add column if not exists permanent_address text not null default '';

-- Backfill current address from legacy single address field when empty
update public.youth_profiles
set current_address = address
where coalesce(nullif(btrim(current_address), ''), '') = ''
  and coalesce(nullif(btrim(address), ''), '') <> '';
