-- Crew Lens core schema. Applied through the Supabase MCP / CLI; kept here as the record.
create extension if not exists pgcrypto;

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text not null default 'other',
  tier text not null default 'pro' check (tier in ('solo','pro','crew')),
  seats int not null default 1,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  display_name text not null,
  initials text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table projects (
  id uuid primary key,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text not null default '',
  client_name text,
  lat double precision,
  lng double precision,
  status text not null default 'active' check (status in ('active','archived')),
  cover_photo_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_company on projects(company_id, status);

create table photos (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  taker_id uuid not null,
  taker_initials text not null default '',
  kind text not null default 'photo' check (kind in ('photo','video')),
  storage_path text not null,
  thumb_path text not null,
  width int,
  height int,
  duration_s real,
  taken_at timestamptz not null,
  lat double precision,
  lng double precision,
  accuracy_m real,
  device_id text,
  created_at timestamptz not null default now()
);
create index photos_project on photos(project_id, taken_at desc);

-- Companies the calling user belongs to. security definer so RLS policies can use it without recursion.
create or replace function my_company_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select company_id from members where user_id = auth.uid() $$;

alter table companies enable row level security;
alter table members enable row level security;
alter table projects enable row level security;
alter table photos enable row level security;

-- A signed-in user may create a company (then immediately a membership). Reads/updates need membership.
create policy companies_insert on companies for insert to authenticated with check (true);
create policy companies_select on companies for select to authenticated using (id in (select my_company_ids()));
create policy companies_update on companies for update to authenticated using (id in (select my_company_ids()));

create policy members_insert_self on members for insert to authenticated with check (user_id = auth.uid());
create policy members_select on members for select to authenticated using (user_id = auth.uid() or company_id in (select my_company_ids()));
create policy members_delete on members for delete to authenticated using (company_id in (select my_company_ids()));

create policy projects_rw on projects for all to authenticated
  using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy photos_rw on photos for all to authenticated
  using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));

-- Storage: object keys are <company_id>/<project_id>/<photo_id>.jpg in both buckets.
insert into storage.buckets (id, name, public) values ('photos','photos',false), ('thumbs','thumbs',false)
  on conflict (id) do nothing;
create policy media_rw on storage.objects for all to authenticated
  using (bucket_id in ('photos','thumbs') and (storage.foldername(name))[1]::uuid in (select my_company_ids()))
  with check (bucket_id in ('photos','thumbs') and (storage.foldername(name))[1]::uuid in (select my_company_ids()));
