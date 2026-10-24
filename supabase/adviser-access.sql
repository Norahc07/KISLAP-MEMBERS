-- Let advisers read registration forms that are already submitted and approved.
-- Run once in the Supabase SQL Editor after supabase/registration-form.sql.

create or replace function public.is_adviser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'adviser'
  );
$$;

grant execute on function public.is_adviser() to authenticated;

drop policy if exists "Adviser reads approved registrations" on public.registrations;
create policy "Adviser reads approved registrations"
  on public.registrations
  for select to authenticated
  using (public.is_adviser() and application_status = 'approved');
