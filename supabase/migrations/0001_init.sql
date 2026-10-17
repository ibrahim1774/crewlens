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
alter table projects add constraint projects_id_company_unique unique (id, company_id);

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
  created_at timestamptz not null default now(),
  constraint photos_project_company foreign key (project_id, company_id) references projects(id, company_id) on delete cascade
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

-- Owners of the calling user's companies.
create or replace function my_owned_company_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select company_id from members where user_id = auth.uid() and role = 'owner' $$;

-- Companies are created only through create_company_with_owner(); no direct insert.
create policy companies_select on companies for select to authenticated using (id in (select my_company_ids()));
create policy companies_update on companies for update to authenticated
  using (id in (select my_owned_company_ids())) with check (id in (select my_owned_company_ids()));

-- Tier and seats are billing facts: only service_role (the billing webhook) may change them.
create or replace function protect_billing_columns() returns trigger language plpgsql as $$
begin
  if (new.tier is distinct from old.tier or new.seats is distinct from old.seats)
     and coalesce(auth.jwt() ->> 'role', current_setting('role', true)) <> 'service_role' then
    raise exception 'billing_columns_readonly' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger companies_billing before update on companies for each row execute function protect_billing_columns();

-- Members: no direct insert (invites arrive in phase 2 through a security definer function).
create policy members_select on members for select to authenticated
  using (user_id = auth.uid() or company_id in (select my_company_ids()));
create policy members_delete on members for delete to authenticated
  using (company_id in (select my_owned_company_ids()) and user_id <> auth.uid());

-- Never leave a company without an owner.
create or replace function protect_last_owner() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and not exists (
    select 1 from members where company_id = old.company_id and role = 'owner' and user_id <> old.user_id
  ) then
    raise exception 'last_owner' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger members_last_owner before delete on members for each row execute function protect_last_owner();

-- Bootstrap: a signed-in user with no company creates one and becomes its owner, atomically.
create or replace function create_company_with_owner(p_name text, p_trade text, p_display_name text, p_initials text)
returns companies language plpgsql security definer set search_path = public as $$
declare c companies;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  insert into companies(name, trade) values (trim(p_name), p_trade) returning * into c;
  insert into members(user_id, company_id, role, display_name, initials)
    values (auth.uid(), c.id, 'owner', trim(p_display_name), p_initials);
  return c;
end $$;
revoke all on function create_company_with_owner(text, text, text, text) from public;
grant execute on function create_company_with_owner(text, text, text, text) to authenticated;

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
