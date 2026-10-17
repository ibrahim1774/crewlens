-- Documents: invoices, proposals, contracts and any PDF or image a crew keeps next to a job's photos.
-- Pro and Crew only; the client enforces the tier, the trigger below enforces it server-side too.

create table if not exists public.documents (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  name text not null,
  kind text not null default 'pdf' check (kind in ('pdf','image')),
  storage_path text not null,
  size_bytes integer,
  pages integer,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  sent_to text,
  sent_via text check (sent_via in ('text','email','share')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade
);
create index if not exists documents_project_idx on public.documents(project_id, updated_at desc);

alter table public.documents enable row level security;
create policy documents_rw on public.documents for all to authenticated
  using (company_id in (select my_company_ids()))
  with check (company_id in (select my_company_ids()) and created_by = auth.uid());

-- Solo companies cannot store documents. Mirrors the client gate so a modified client cannot bypass it.
create or replace function public.documents_require_pro() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select tier into t from companies where id = new.company_id;
  if t is null or t = 'solo' then
    raise exception 'limit:documents' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists documents_require_pro on public.documents;
create trigger documents_require_pro before insert on public.documents
  for each row execute function public.documents_require_pro();

insert into storage.buckets (id, name, public) values ('documents','documents',false) on conflict (id) do nothing;
create policy documents_media_rw on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_company_ids()))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_company_ids()));

grant select, insert, update, delete on public.documents to authenticated;
