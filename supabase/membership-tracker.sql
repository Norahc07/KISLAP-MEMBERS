-- Membership Tracker for an existing KISLAP database.
-- Run once in Supabase → SQL Editor. Safe to run again:
-- existing checkboxes are kept, and rows already numbered are not overwritten.

create table if not exists public.membership_tracker (
  id                 uuid primary key default gen_random_uuid(),
  member_no          int not null unique check (member_no > 0),
  member_id          uuid references public.members(id) on delete set null,
  full_name          text not null default '',
  tracker_role       text not null default 'member' check (tracker_role in ('officer', 'director', 'assistant', 'member')),
  gforms             boolean not null default false,
  registration_form  boolean not null default false,
  photo_2x2          boolean not null default false,
  interview          boolean not null default false,
  membership_fee     boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists membership_tracker_member_idx on public.membership_tracker(member_id);

alter table public.membership_tracker enable row level security;

drop policy if exists "Public read" on public.membership_tracker;
drop policy if exists "Admin write" on public.membership_tracker;
create policy "Public read" on public.membership_tracker for select using (true);
create policy "Admin write" on public.membership_tracker
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.membership_tracker;
exception when duplicate_object then null;
end $$;

insert into public.membership_tracker (member_no, full_name, tracker_role)
values
  (1,  'MARLO ESTOCADO',            'officer'),
  (2,  'ELLA DE LA CRUZ',           'officer'),
  (3,  'MARK JERALD URGELLES',      'officer'),
  (4,  'NICA ELLA BRIOLA',          'officer'),
  (5,  'MARIANNE MAE ELANO',        'officer'),
  (6,  'FRANCINE SARDAÑA',          'officer'),
  (7,  'JONALYN GENERALE',          'officer'),
  (8,  'LAMUEL TAMPOC',             'director'),
  (9,  'MINIE MURCIA',              'director'),
  (10, 'OCEANNE VILLABROZA',        'director'),
  (11, 'FRANCES CARLA LIBRANDA',    'director'),
  (12, 'JANRICK PANESA',            'director'),
  (13, 'J-DEL SUBERANO',            'director'),
  (14, 'JHOANA MAE AUSTRIA',        'director'),
  (15, 'PRINCESS ASHLEY SAGUNTO',   'director'),
  (16, 'KIMUEL NOTA',               'director'),
  (17, 'LESLIE BOY AMOR',           'director'),
  (18, 'LANDERICH LADRERA',         'director'),
  (19, 'RHEALYN CABANELA',          'director'),
  (20, 'ELOISA JEAN NILOOBAN',      'director'),
  (21, 'ANTONETTE SANTOS',          'director'),
  (22, 'JETT HARLEY CUARTO',        'assistant'),
  (23, '',                          'assistant'),
  (24, 'JAYVEE GALANIDAJ',          'assistant'),
  (25, 'NADINE ALMIRAÑEZ',          'assistant'),
  (26, 'ARL ABIEL DADIOS',          'assistant'),
  (27, 'JOHN PATRICK MANDRIQUE',    'assistant'),
  (28, 'MEIYEN CALUCIN',            'assistant'),
  (29, 'ASHLY AKHILA ORELLANA',    'assistant'),
  (30, 'JOGEL LARA',                'assistant'),
  (31, 'AC ATENDIDO',               'assistant'),
  (32, 'JL TANGYAB',                'assistant'),
  (33, 'REISHA ERANISTA',           'assistant'),
  (34, 'JOMEL VENERABLE',           'assistant'),
  (35, 'GRACHELLE TINTIN CERILLA',  'assistant'),
  (36, 'CARL MALKIEL ALMARINEZ',    'member'),
  (37, 'KRISHA MAE RUCACORBA',      'member'),
  (38, 'LUIGI AMARILLO',            'member'),
  (39, 'JHOANNE FAGTANAC',          'member'),
  (40, 'GIRLIE BEBANCO',            'member'),
  (41, 'JUSTINE LLOYD MONTEMAYOR',  'member'),
  (42, 'KYLIE MERANA',              'member'),
  (43, 'CATHERINE ALQUIROS',        'member'),
  (44, '', 'member'),
  (45, '', 'member'),
  (46, '', 'member'),
  (47, '', 'member'),
  (48, '', 'member'),
  (49, '', 'member'),
  (50, '', 'member'),
  (51, '', 'member'),
  (52, '', 'member'),
  (53, '', 'member'),
  (54, '', 'member'),
  (55, '', 'member'),
  (56, '', 'member')
on conflict (member_no) do nothing;

-- Link tracker rows to members already in the database.
-- Names are compared without case or punctuation. Close spellings are listed by hand
-- so we don't create a second person for the same volunteer.
create or replace function pg_temp.norm_name(t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(upper(coalesce(t, '')), '[^A-Z0-9Ñ]+', ' ', 'g'));
$$;

update public.membership_tracker t
set member_id = picked.id
from (
  select distinct on (pg_temp.norm_name(full_name))
    id,
    pg_temp.norm_name(full_name) as norm
  from public.members
  order by pg_temp.norm_name(full_name), (full_name = upper(full_name)) desc, created_at
) picked
where t.member_id is null
  and t.full_name <> ''
  and pg_temp.norm_name(t.full_name) = picked.norm;

-- Same person, different spelling on the website.
update public.membership_tracker t
set member_id = m.id
from public.members m
where t.member_id is null
  and (
    (t.member_no = 15 and pg_temp.norm_name(m.full_name) = 'PRINCESS ASHLEY M SAGUNTO')
    or (t.member_no = 24 and pg_temp.norm_name(m.full_name) = 'JAYVEE GALANIDA')
    or (t.member_no = 31 and pg_temp.norm_name(m.full_name) = 'AC')
    or (t.member_no = 32 and pg_temp.norm_name(m.full_name) = 'JHOMEL TANGYAB')
    or (t.member_no = 42 and pg_temp.norm_name(m.full_name) in ('KYLIE MIRAÑA', 'KYLIE MIRANA'))
  );

-- Add roster names that are not on the website yet (currently CATHERINE ALQUIROS).
insert into public.members (full_name)
select t.full_name
from public.membership_tracker t
where t.full_name <> ''
  and t.member_id is null
  and not exists (
    select 1 from public.members m
    where pg_temp.norm_name(m.full_name) = pg_temp.norm_name(t.full_name)
  );

update public.membership_tracker t
set member_id = m.id
from public.members m
where t.member_id is null
  and t.full_name <> ''
  and pg_temp.norm_name(t.full_name) = pg_temp.norm_name(m.full_name);
