-- Shared calendar birthdays for all signed-in members.
-- Run once in the Supabase SQL Editor after supabase/registration-form.sql.
-- Returns month/day of birth from e-registration forms (no full form data).

create or replace function public.list_calendar_birthdays()
returns table (
  member_no int,
  full_name text,
  birth_month int,
  birth_day int,
  birth_year int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  return query
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
      'Member ' || r.member_no::text
    ) as full_name,
    extract(month from r.date_of_birth)::int as birth_month,
    extract(day from r.date_of_birth)::int as birth_day,
    extract(year from r.date_of_birth)::int as birth_year
  from public.registrations r
  left join public.membership_tracker t on t.member_no = r.member_no
  where r.date_of_birth is not null
  order by extract(month from r.date_of_birth), extract(day from r.date_of_birth), r.member_no;
end;
$$;

grant execute on function public.list_calendar_birthdays() to authenticated;
revoke all on function public.list_calendar_birthdays() from anon;
