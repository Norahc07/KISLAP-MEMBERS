-- Shared calendar birthdays for all signed-in members.
-- Run once in the Supabase SQL Editor after supabase/registration-form.sql.
-- Birthdays come from e-registration date_of_birth (same source as /registrations Preview).

create or replace function public.list_calendar_birthdays()
returns table (
  member_no int,
  full_name text,
  birth_month int,
  birth_day int,
  birth_year int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.member_no,
    coalesce(
      nullif(btrim(t.full_name), ''),
      nullif(
        btrim(concat_ws(
          ' ',
          nullif(btrim(r.first_name), ''),
          nullif(btrim(r.middle_name), ''),
          nullif(btrim(r.surname), ''),
          nullif(btrim(r.suffix), '')
        )),
        ''
      ),
      'KISLAP-26-' || lpad(r.member_no::text, 3, '0')
    ) as full_name,
    cast(extract(month from r.date_of_birth) as integer) as birth_month,
    cast(extract(day from r.date_of_birth) as integer) as birth_day,
    cast(extract(year from r.date_of_birth) as integer) as birth_year
  from public.registrations r
  left join public.membership_tracker t on t.member_no = r.member_no
  where auth.uid() is not null
    and r.date_of_birth is not null
  order by
    cast(extract(month from r.date_of_birth) as integer),
    cast(extract(day from r.date_of_birth) as integer),
    r.member_no;
$$;

grant execute on function public.list_calendar_birthdays() to authenticated;
revoke all on function public.list_calendar_birthdays() from anon;
