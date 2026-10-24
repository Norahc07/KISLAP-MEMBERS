-- Adviser sign-ins. Advisers are not members, so they do not get a
-- KISLAP-26-XXX membership username.
--
-- Run this once in the Supabase SQL Editor after supabase/accounts.sql.
-- Re-running it does not reset a password an adviser has already changed.
--
-- JOYMEE SODUSTA     username JOYMEE.SODUSTA     password JoyAdviser7
-- RICHMOND BANAAG    username RICHMOND.BANAAG   password RichAdviser7
--
-- Each adviser replaces that password on the first sign-in.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'officer', 'director', 'assistant', 'member', 'adviser'));

select public.provision_login(
  'joymee.sodusta@advisers.kislap.app',
  'JoyAdviser7',
  'JOYMEE.SODUSTA',
  null,
  'adviser',
  'JOYMEE SODUSTA',
  true,
  false
);

select public.provision_login(
  'richmond.banaag@advisers.kislap.app',
  'RichAdviser7',
  'RICHMOND.BANAAG',
  null,
  'adviser',
  'RICHMOND BANAAG',
  true,
  false
);
