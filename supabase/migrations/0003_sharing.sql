create table share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  type text not null default 'live' check (type in ('live','gallery')),
  token text not null unique default replace(replace(encode(gen_random_bytes(9), 'base64'), '/', '_'), '+', '-'),
  photo_ids uuid[],
  expires_at timestamptz,
  revoked_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz not null default now()
);
create index share_links_project on share_links(project_id, type);

create table link_views (
  id bigserial primary key,
  link_id uuid not null references share_links(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ua_hash text
);

alter table share_links enable row level security;
alter table link_views enable row level security;
create policy links_rw on share_links for all to authenticated
  using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy views_read on link_views for select to authenticated
  using (link_id in (select id from share_links where company_id in (select my_company_ids())));

-- Solo links expire after plan_limits.link_days; other tiers never expire.
create or replace function set_link_expiry() returns trigger language plpgsql as $$
declare days int;
begin
  select pl.link_days into days from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  if days is not null and new.expires_at is null then
    new.expires_at := now() + make_interval(days => days);
  end if;
  return new;
end $$;
create trigger links_expiry before insert on share_links for each row execute function set_link_expiry();

-- Archiving a project freezes its live links: they keep working but stop updating.
create or replace function freeze_links_on_archive() returns trigger language plpgsql as $$
begin
  if new.status = 'archived' and old.status = 'active' then
    update share_links set frozen_at = now() where project_id = new.id and type = 'live' and frozen_at is null;
  elsif new.status = 'active' and old.status = 'archived' then
    update share_links set frozen_at = null where project_id = new.id and type = 'live';
  end if;
  return new;
end $$;
create trigger projects_freeze after update of status on projects for each row execute function freeze_links_on_archive();

-- Anonymous access path for the share page. Returns storage paths; the edge function signs them.
create or replace function get_shared_project(p_token text, p_ua_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l share_links; p projects;
begin
  select * into l from share_links where token = p_token;
  if not found or l.revoked_at is not null or (l.expires_at is not null and l.expires_at < now()) then
    return jsonb_build_object('status', 'expired');
  end if;
  select * into p from projects where id = l.project_id;
  insert into link_views(link_id, ua_hash) values (l.id, p_ua_hash);
  return jsonb_build_object(
    'status', 'ok',
    'type', l.type,
    'live', (l.type = 'live' and l.frozen_at is null),
    'name', p.name,
    'address', p.address,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id, 'kind', ph.kind, 'taken_at', ph.taken_at, 'lat', ph.lat, 'lng', ph.lng,
        'initials', ph.taker_initials, 'width', ph.width, 'height', ph.height,
        'storage_path', ph.storage_path, 'thumb_path', ph.thumb_path
      ) order by ph.taken_at desc)
      from photos ph
      where ph.project_id = p.id
        and (l.photo_ids is null or ph.id = any(l.photo_ids))
        and (l.frozen_at is null or ph.created_at <= l.frozen_at)
    ), '[]'::jsonb)
  );
end $$;
revoke all on function get_shared_project(text, text) from public;
grant execute on function get_shared_project(text, text) to service_role;
