-- Removes everything created by schema.sql and seed.sql so you can run them again.
-- WARNING: deletes all members, committees and positions.
-- Auth users (admin@admin.com) and uploaded photo files are NOT touched.

drop function if exists public.online_user_ids();
drop function if exists public.end_session(text);
drop function if exists public.pulse_session(text);
drop function if exists public.save_profile_photo(text, text);
drop function if exists public.complete_password_change(text);
drop table if exists public.user_sessions cascade;
drop function if exists public.provision_login(text, text, text, int, text, text, boolean, boolean);
drop function if exists public.random_password();
drop function if exists public.save_tracker_access(text[], int[]);
drop function if exists public.complete_password_change();
drop function if exists public.log_audit(text, text, jsonb);
drop function if exists public.registrations_owner_check() cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.profiles cascade;
drop function if exists public.submit_registration(jsonb);
drop table if exists public.registrations cascade;
drop table if exists public.membership_tracker cascade;
drop table if exists public.positions cascade;
drop table if exists public.units     cascade;
drop table if exists public.members   cascade;
drop table if exists public.admins    cascade;

-- cascade also removes the avatar storage policies that depend on it
drop function if exists public.is_admin() cascade;
