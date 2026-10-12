-- Removes everything created by schema.sql and seed.sql so you can run them again.
-- WARNING: deletes all members, committees and positions.
-- Auth users (admin@admin.com) and uploaded photo files are NOT touched.

drop table if exists public.positions cascade;
drop table if exists public.units     cascade;
drop table if exists public.members   cascade;
drop table if exists public.admins    cascade;

-- cascade also removes the avatar storage policies that depend on it
drop function if exists public.is_admin() cascade;
