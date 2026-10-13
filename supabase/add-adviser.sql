-- Adds the Adviser level and a vacant Adviser position above the President.
-- Run once in Supabase → SQL Editor on a database that was set up before this change.

alter table public.positions drop constraint if exists positions_level_check;
alter table public.positions
  add constraint positions_level_check
  check (level in ('adviser', 'officer', 'director', 'assistant', 'member'));

insert into public.positions (unit_id, title, level, sort_order)
select u.id, 'Adviser', 'adviser', 0
from public.units u
where u.kind = 'executive'
  and not exists (
    select 1 from public.positions p where p.unit_id = u.id and p.level = 'adviser'
  )
order by u.sort_order
limit 1;
