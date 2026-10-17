-- Crew invites: an owner mints a short code; a signed-in person with no company joins with it.
-- Seats come from companies.seats (billing-owned). Codes expire after 7 days and are single-use.

create table if not exists public.invites (
  code text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id),
  used_at timestamptz
);
alter table public.invites enable row level security;
create policy invites_select on public.invites for select to authenticated
  using (company_id in (select my_company_ids()));
create policy invites_delete on public.invites for delete to authenticated
  using (company_id in (select my_owned_company_ids()));
grant select, delete on public.invites to authenticated;

-- Owners mint codes through this function so the seat check cannot be skipped.
create or replace function public.create_invite()
returns invites language plpgsql security definer set search_path = public as $$
declare c_id uuid; c companies; taken int; inv invites; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select company_id into c_id from members where user_id = auth.uid() and role = 'owner' limit 1;
  if c_id is null then raise exception 'not_owner' using errcode = '42501'; end if;
  select * into c from companies where id = c_id;
  select count(*) into taken from members where company_id = c_id;
  if taken >= c.seats then raise exception 'limit:seats' using errcode = 'P0001'; end if;
  loop
    code := '';
    for i in 1..6 loop code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from invites where invites.code = code);
  end loop;
  insert into invites (code, company_id, created_by) values (code, c_id, auth.uid()) returning * into inv;
  return inv;
end $$;
revoke all on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- A signed-in person with no company redeems a code and becomes a member.
create or replace function public.join_company(p_code text, p_display_name text, p_initials text)
returns companies language plpgsql security definer set search_path = public as $$
declare inv invites; c companies; taken int;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already_member' using errcode = '23505'; end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if inv.code is null or inv.used_at is not null or inv.expires_at < now() then raise exception 'invite_invalid' using errcode = 'P0002'; end if;
  select * into c from companies where id = inv.company_id;
  select count(*) into taken from members where company_id = c.id;
  if taken >= c.seats then raise exception 'limit:seats' using errcode = 'P0001'; end if;
  insert into members (user_id, company_id, role, display_name, initials) values (auth.uid(), c.id, 'member', p_display_name, p_initials);
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return c;
end $$;
revoke all on function public.join_company(text, text, text) from public, anon;
grant execute on function public.join_company(text, text, text) to authenticated;

-- Seats: Solo and Pro have one, Crew has three until billing raises it. Existing rows keep their value.
alter table public.companies alter column seats set default 1;
