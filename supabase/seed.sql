-- Initial KISLAP Youth Volunteers roster.
-- Run after schema.sql. Does nothing if positions already exist.

create or replace function pg_temp.seed_pos(p_unit text, p_title text, p_level text, p_sort int, p_member text default null)
returns void
language plpgsql
as $$
declare
  v_unit   uuid;
  v_member uuid;
begin
  select id into v_unit from public.units where name = p_unit;
  if p_member is not null then
    select id into v_member from public.members where full_name = p_member limit 1;
    if v_member is null then
      insert into public.members(full_name) values (p_member) returning id into v_member;
    end if;
  end if;
  insert into public.positions(unit_id, title, level, sort_order, member_id)
  values (v_unit, p_title, p_level, p_sort, v_member);
end $$;

create or replace function pg_temp.seed_committee(p_sort int, p_name text, p_director text, p_assistant text, p_members text[] default '{}')
returns void
language plpgsql
as $$
declare
  m text;
  i int := 3;
begin
  insert into public.units(name, kind, sort_order) values (p_name, 'committee', p_sort) on conflict (name) do nothing;
  perform pg_temp.seed_pos(p_name, p_name || ' Director', 'director', 1, p_director);
  perform pg_temp.seed_pos(p_name, 'Asst. Director', 'assistant', 2, p_assistant);
  foreach m in array p_members loop
    perform pg_temp.seed_pos(p_name, 'Member', 'member', i, m);
    i := i + 1;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from public.positions) then
    raise notice 'Positions already exist — skipping seed.';
    return;
  end if;

  insert into public.units(name, kind, sort_order)
  values ('Executive Board of Officers', 'executive', 0)
  on conflict (name) do nothing;

  perform pg_temp.seed_pos('Executive Board of Officers', 'Adviser',                   'adviser', 0);
  perform pg_temp.seed_pos('Executive Board of Officers', 'President / Chairperson',   'officer', 1, 'MARLO ESTOCADO');
  perform pg_temp.seed_pos('Executive Board of Officers', 'Internal Vice President',   'officer', 2, 'ELLA DE LA CRUZ');
  perform pg_temp.seed_pos('Executive Board of Officers', 'External Vice President',   'officer', 3, 'MARK JERALD URGELLES');
  perform pg_temp.seed_pos('Executive Board of Officers', 'Secretary',                 'officer', 4, 'NICA ELLA BRIOLA');
  perform pg_temp.seed_pos('Executive Board of Officers', 'Treasurer',                 'officer', 5, 'MARIANNE MAE ELANO');
  perform pg_temp.seed_pos('Executive Board of Officers', 'Auditor',                   'officer', 6, 'FRANCINE SARDAÑA');
  perform pg_temp.seed_pos('Executive Board of Officers', 'Public Information Officer','officer', 7, 'JONALYN GENERALE');

  perform pg_temp.seed_committee(1,  'Volunteer and Membership',          'LAMUEL TAMPOC',          'JETT HARLEY CUARTO',      array['CARL MALKIEL ALMARINEZ']);
  perform pg_temp.seed_committee(2,  'Community Outreach and Partnership','MINIE MURCIA',           null);
  perform pg_temp.seed_committee(3,  'Environmental and Sustainability',  null,                     null);
  perform pg_temp.seed_committee(4,  'Youth Leadership and Training',     'FRANCES CARLA LIBRANDA', 'NADINE ALMIRAÑEZ');
  perform pg_temp.seed_committee(5,  'Project Development',               'JANRICK PANESA',         'ARL ABIEL DADIOS');
  perform pg_temp.seed_committee(6,  'Finance and Audit',                 'J-DEL SUBERANO',         null);
  perform pg_temp.seed_committee(7,  'Research Development',              'JHOANA MAE AUSTRIA',     null);
  perform pg_temp.seed_committee(8,  'Educational Resources',             null,                     null);
  perform pg_temp.seed_committee(9,  'Social Inclusion and Equality',     'KIMUEL NOTA',            null);
  perform pg_temp.seed_committee(10, 'Media and Publicity',               'LESLIE BOY AMOR',        'AC',                      array['LUIGI AMARILLO']);
  perform pg_temp.seed_committee(11, 'Safety and Security',               'LANDERICH LADRERA',      null);
  perform pg_temp.seed_committee(12, 'Health and Well-being',             null,                     null);
  perform pg_temp.seed_committee(13, 'Economic and Innovation',           null,                     null);
  perform pg_temp.seed_committee(14, 'Secretariat',                       'ANTONETTE SANTOS',       'GRACHELLE TINTIN CERILLA');
end $$;
