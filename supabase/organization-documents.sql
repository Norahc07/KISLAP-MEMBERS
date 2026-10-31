-- Organization documents for /documents (cards view).
-- Run once in Supabase SQL Editor.
-- Public read for all signed-in viewers; only admins can add / edit / delete.
-- File uploads go to the public `org-documents` storage bucket (PDF or image).

create table if not exists public.organization_documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null default 'Document',
  summary     text not null default '',
  issued_on   date,
  file_url    text not null,
  file_path   text,
  file_type   text not null check (file_type in ('image', 'pdf')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists organization_documents_sort_idx
  on public.organization_documents (sort_order, created_at);

alter table public.organization_documents enable row level security;

drop policy if exists "Public read organization documents" on public.organization_documents;
drop policy if exists "Admin write organization documents" on public.organization_documents;

create policy "Public read organization documents"
  on public.organization_documents
  for select
  using (true);

create policy "Admin write organization documents"
  on public.organization_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('org-documents', 'org-documents', true)
on conflict (id) do update set public = true;

drop policy if exists "Org documents public read" on storage.objects;
drop policy if exists "Org documents admin insert" on storage.objects;
drop policy if exists "Org documents admin update" on storage.objects;
drop policy if exists "Org documents admin delete" on storage.objects;

create policy "Org documents public read"
  on storage.objects
  for select
  using (bucket_id = 'org-documents');

create policy "Org documents admin insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'org-documents' and public.is_admin());

create policy "Org documents admin update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'org-documents' and public.is_admin());

create policy "Org documents admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'org-documents' and public.is_admin());

-- Seed the current four files from the app's public/documents folder (idempotent).
insert into public.organization_documents (
  id, title, kind, summary, issued_on, file_url, file_path, file_type, sort_order
) values
  (
    'a1111111-1111-4111-8111-111111111111',
    'Barangay Certification',
    'Certification',
    'Barangay Polo certifies that KISLAP Youth Volunteers is an organized youth group in Mauban, Quezon.',
    '2026-10-23',
    '/documents/barangay-certification.jpg',
    null,
    'image',
    10
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'Barangay Endorsement',
    'Endorsement',
    'Certificate of residency and endorsement issued for KISLAP Youth Volunteers and related legal purposes.',
    '2026-10-23',
    '/documents/barangay-endorsement.jpg',
    null,
    'image',
    20
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'Advisory Notice 26-001',
    'Advisory',
    'Official KISLAP advisory notice for members, officers, and partners.',
    null,
    '/documents/advisory-notice-26-001.pdf',
    null,
    'pdf',
    30
  ),
  (
    'a4444444-4444-4444-8444-444444444444',
    'Constitution & By-Laws',
    'Governing rules',
    'The final Constitution and By-Laws that guide KISLAP Youth Volunteers.',
    null,
    '/documents/constitution-by-laws.pdf',
    null,
    'pdf',
    40
  )
on conflict (id) do nothing;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.organization_documents';
  exception
    when duplicate_object then null;
  end;
end $$;
