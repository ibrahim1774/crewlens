-- Plan limits live in the database so the client cannot bypass them.
create table plan_limits (
  tier text primary key,
  active_projects int not null,
  photos_per_project int not null,
  videos_per_project int not null,
  video_max_s int not null,
  link_days int
);
insert into plan_limits values
  ('solo', 25, 100, 0, 0, 30),
  ('pro', 100, 250, 10, 60, null),
  ('crew', 500, 500, 25, 120, null);
alter table plan_limits enable row level security;
create policy plan_limits_read on plan_limits for select using (true);

create or replace function enforce_project_limit() returns trigger language plpgsql as $$
declare lim int; cnt int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  select pl.active_projects into lim from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  select count(*) into cnt from projects where company_id = new.company_id and status = 'active' and id <> new.id;
  if cnt >= lim then
    raise exception 'limit_active_projects' using errcode = 'P0001', hint = lim::text;
  end if;
  return new;
end $$;
create trigger projects_limit before insert or update of status on projects
  for each row execute function enforce_project_limit();

create or replace function enforce_photo_limit() returns trigger language plpgsql as $$
declare lim int; cnt int;
begin
  -- A retried upload of a photo that already landed must not count against the cap.
  if exists (select 1 from photos where id = new.id) then return new; end if;
  select case when new.kind = 'video' then pl.videos_per_project else pl.photos_per_project end into lim
    from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  select count(*) into cnt from photos where project_id = new.project_id and kind = new.kind;
  if cnt >= lim then
    raise exception 'limit_photos_per_project' using errcode = 'P0001', hint = lim::text;
  end if;
  return new;
end $$;
create trigger photos_limit before insert on photos for each row execute function enforce_photo_limit();
