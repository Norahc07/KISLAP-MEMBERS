-- Sign-in for PRECIOUS DANAO as KISLAP-26-023.
-- Her membership ID is already saved on tracker row 23.
-- Run once in the Supabase SQL Editor after supabase/accounts.sql.
-- Re-running does not reset a password she has already changed.
-- The default password then appears on the Users page.

update public.membership_tracker
set member_id = '2fa76b73-58b6-4338-8a91-be22b328a120',
    full_name = 'PRECIOUS DANAO',
    tracker_role = 'member'
where member_no = 23
  and (member_id is null or member_id = '2fa76b73-58b6-4338-8a91-be22b328a120');

do $$
declare
  pwd text := public.random_password();
begin
  if not exists (select 1 from public.profiles where member_no = 23) then
    perform public.provision_login(
      'kislap-26-023@members.kislap.app',
      pwd,
      'KISLAP-26-023',
      23,
      'member',
      'PRECIOUS DANAO',
      true,
      false
    );
  end if;
end $$;
