-- KISLAP AI Agent Workforce (pilot)
-- Run in Supabase SQL Editor after staff-page-access.sql / youth-profiling.sql.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.agent_definitions (
  id text primary key,
  name text not null,
  desk text not null default '',
  description text not null default '',
  kind text not null check (kind in ('membership_ops', 'youth_insights', 'concierge')),
  admin_only boolean not null default false,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agent_definitions(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'waiting_approval', 'done', 'failed')),
  trigger_source text not null default 'office',
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  summary text not null default '',
  error_message text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_member int,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_agent_created_idx on public.agent_runs (agent_id, created_at desc);
create index if not exists agent_runs_status_idx on public.agent_runs (status);

create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_id text not null references public.agent_definitions(id) on delete cascade,
  title text not null,
  detail text not null default '',
  proposal_type text not null default 'note'
    check (proposal_type in ('note', 'tracker_reminder', 'outreach', 'draft_message')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists agent_proposals_status_idx on public.agent_proposals (status, created_at desc);
create index if not exists agent_proposals_run_idx on public.agent_proposals (run_id);

-- Seed pilot agents
insert into public.agent_definitions (id, name, desk, description, kind, admin_only, enabled, sort_order)
values
  (
    'membership_ops',
    'Membership Ops',
    'Volunteer and Membership / Secretariat',
    'Scans tracker gaps and pending eRegForms, then drafts next-action checklists for staff.',
    'membership_ops',
    false,
    true,
    1
  ),
  (
    'youth_insights',
    'Youth Insights',
    'Research Development / Youth Leadership',
    'Summarizes youth profiling coverage, Interested to Join, PWD, and Upcoming SK signals for planning.',
    'youth_insights',
    true,
    true,
    2
  )
on conflict (id) do update set
  name = excluded.name,
  desk = excluded.desk,
  description = excluded.description,
  kind = excluded.kind,
  admin_only = excluded.admin_only,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.agent_definitions enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_proposals enable row level security;

drop policy if exists "Staff read agent definitions" on public.agent_definitions;
create policy "Staff read agent definitions" on public.agent_definitions
  for select to authenticated
  using (public.has_page_access('agents') or public.is_admin());

drop policy if exists "Staff read agent runs" on public.agent_runs;
create policy "Staff read agent runs" on public.agent_runs
  for select to authenticated
  using (public.has_page_access('agents') or public.is_admin());

drop policy if exists "Staff read agent proposals" on public.agent_proposals;
create policy "Staff read agent proposals" on public.agent_proposals
  for select to authenticated
  using (public.has_page_access('agents') or public.is_admin());

revoke all on public.agent_definitions from anon;
revoke all on public.agent_runs from anon;
revoke all on public.agent_proposals from anon;
grant select on public.agent_definitions to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.agent_proposals to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.can_run_agent(p_agent_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin_only boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;
  if not public.has_page_access('agents') then
    return false;
  end if;
  if not public.has_page_access('agents_run') then
    return false;
  end if;
  select admin_only into v_admin_only from public.agent_definitions where id = p_agent_id and enabled;
  if v_admin_only is null then
    return false;
  end if;
  if v_admin_only then
    return false;
  end if;
  return true;
end;
$$;

grant execute on function public.can_run_agent(text) to authenticated;

create or replace function public.create_agent_run(
  p_agent_id text,
  p_trigger_source text default 'office',
  p_input jsonb default '{}'::jsonb
)
returns public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_runs;
  v_member int;
  v_def public.agent_definitions;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;

  select * into v_def from public.agent_definitions where id = p_agent_id and enabled;
  if v_def.id is null then
    raise exception 'That agent is not available.';
  end if;

  if v_def.admin_only and not public.is_admin() then
    raise exception 'Only the admin can run this agent.';
  end if;

  if not public.is_admin() then
    if not public.has_page_access('agents') or not public.has_page_access('agents_run') then
      raise exception 'You do not have permission to run agents.';
    end if;
  end if;

  select member_no into v_member from public.profiles where id = auth.uid();

  insert into public.agent_runs (
    agent_id, status, trigger_source, input, created_by, created_by_member, started_at
  )
  values (
    p_agent_id,
    'running',
    coalesce(nullif(btrim(p_trigger_source), ''), 'office'),
    coalesce(p_input, '{}'::jsonb),
    auth.uid(),
    v_member,
    now()
  )
  returning * into v_row;

  perform public.log_audit(
    'agent_run_started',
    'Started agent run: ' || v_def.name,
    jsonb_build_object('run_id', v_row.id, 'agent_id', p_agent_id, 'trigger_source', v_row.trigger_source)
  );

  return v_row;
end;
$$;

grant execute on function public.create_agent_run(text, text, jsonb) to authenticated;

create or replace function public.finish_agent_run(
  p_run_id uuid,
  p_status text,
  p_summary text default '',
  p_result jsonb default '{}'::jsonb,
  p_error_message text default '',
  p_proposals jsonb default '[]'::jsonb
)
returns public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_runs;
  v_item jsonb;
  v_status text := coalesce(nullif(btrim(p_status), ''), 'done');
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;

  if v_status not in ('done', 'failed', 'waiting_approval') then
    raise exception 'Invalid run status.';
  end if;

  select * into v_row from public.agent_runs where id = p_run_id;
  if v_row.id is null then
    raise exception 'Agent run not found.';
  end if;

  if v_row.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'You can only finish your own agent runs.';
  end if;

  update public.agent_runs
  set
    status = v_status,
    summary = coalesce(p_summary, ''),
    result = coalesce(p_result, '{}'::jsonb),
    error_message = coalesce(p_error_message, ''),
    finished_at = now()
  where id = p_run_id
  returning * into v_row;

  if jsonb_typeof(coalesce(p_proposals, '[]'::jsonb)) = 'array' then
    for v_item in select * from jsonb_array_elements(p_proposals)
    loop
      insert into public.agent_proposals (
        run_id, agent_id, title, detail, proposal_type, payload, status
      )
      values (
        v_row.id,
        v_row.agent_id,
        coalesce(nullif(btrim(v_item->>'title'), ''), 'Proposal'),
        coalesce(v_item->>'detail', ''),
        coalesce(nullif(btrim(v_item->>'proposal_type'), ''), 'note'),
        coalesce(v_item->'payload', '{}'::jsonb),
        'pending'
      );
    end loop;
  end if;

  if exists (select 1 from public.agent_proposals where run_id = v_row.id and status = 'pending')
     and v_status = 'done' then
    update public.agent_runs set status = 'waiting_approval' where id = v_row.id returning * into v_row;
  end if;

  perform public.log_audit(
    'agent_run_finished',
    'Finished agent run (' || v_row.status || ')',
    jsonb_build_object('run_id', v_row.id, 'agent_id', v_row.agent_id, 'status', v_row.status)
  );

  return v_row;
end;
$$;

grant execute on function public.finish_agent_run(uuid, text, text, jsonb, text, jsonb) to authenticated;

create or replace function public.resolve_agent_proposal(
  p_proposal_id uuid,
  p_status text,
  p_note text default ''
)
returns public.agent_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_proposals;
  v_status text := lower(coalesce(nullif(btrim(p_status), ''), ''));
  v_pending int;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;

  if v_status not in ('approved', 'rejected') then
    raise exception 'Choose approved or rejected.';
  end if;

  if not public.is_admin()
     and not (public.has_page_access('agents') and public.has_page_access('agents_run')) then
    raise exception 'You do not have permission to resolve agent proposals.';
  end if;

  select * into v_row from public.agent_proposals where id = p_proposal_id;
  if v_row.id is null then
    raise exception 'Proposal not found.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'That proposal was already resolved.';
  end if;

  update public.agent_proposals
  set
    status = v_status,
    resolved_by = auth.uid(),
    resolved_at = now(),
    resolution_note = coalesce(p_note, '')
  where id = p_proposal_id
  returning * into v_row;

  select count(*) into v_pending
  from public.agent_proposals
  where run_id = v_row.run_id and status = 'pending';

  if v_pending = 0 then
    update public.agent_runs
    set status = 'done', finished_at = coalesce(finished_at, now())
    where id = v_row.run_id and status = 'waiting_approval';
  end if;

  perform public.log_audit(
    'agent_proposal_' || v_status,
    'Agent proposal ' || v_status || ': ' || v_row.title,
    jsonb_build_object('proposal_id', v_row.id, 'run_id', v_row.run_id, 'agent_id', v_row.agent_id)
  );

  return v_row;
end;
$$;

grant execute on function public.resolve_agent_proposal(uuid, text, text) to authenticated;

-- Keep staff allowlist in sync (includes agents keys)
create or replace function public.save_staff_page_access(p_member_no int, p_pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pages text[] := coalesce(p_pages, '{}');
  v_allowed text[] := array[
    'documents', 'documents_create', 'documents_update', 'documents_delete',
    'registrations', 'registrations_edit', 'registrations_review',
    'members', 'members_create', 'members_update', 'members_delete',
    'assign', 'assign_write',
    'tracker', 'tracker_write',
    'users', 'audit',
    'youth_profiling', 'youth_profiling_create', 'youth_profiling_update', 'youth_profiling_delete',
    'agents', 'agents_run'
  ];
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change page access.';
  end if;
  if p_member_no is null or p_member_no < 1 then
    raise exception 'Choose a member.';
  end if;
  if not exists (select 1 from public.membership_tracker where member_no = p_member_no) then
    raise exception 'That membership ID was not found.';
  end if;
  if exists (
    select 1 from unnest(v_pages) page where page is null or page <> all(v_allowed)
  ) then
    raise exception 'Choose only allowed admin pages and actions.';
  end if;

  select full_name into v_name from public.membership_tracker where member_no = p_member_no;

  if cardinality(v_pages) = 0 then
    delete from public.staff_page_access where member_no = p_member_no;
  else
    insert into public.staff_page_access (member_no, pages, updated_at)
    values (p_member_no, v_pages, now())
    on conflict (member_no) do update set pages = excluded.pages, updated_at = now();
  end if;

  perform public.log_audit(
    'staff_page_access',
    'Updated page access for ' || coalesce(v_name, 'member'),
    jsonb_build_object('member_no', p_member_no, 'pages', to_jsonb(v_pages))
  );
end;
$$;

grant execute on function public.save_staff_page_access(int, text[]) to authenticated;
