-- Invite codes from a CSPRNG, seat accounting serialized on the company row, initials derived server-side.

create extension if not exists pgcrypto;

create or replace function public.initials_for(p_name text) returns text
language sql immutable as $$
  select coalesce(nullif(upper(
    case
      when array_length(regexp_split_to_array(trim(p_name), '\s+'), 1) >= 2
        then substr((regexp_split_to_array(trim(p_name), '\s+'))[1], 1, 2) || substr((regexp_split_to_array(trim(p_name), '\s+'))[2], 1, 1)
      else substr(trim(p_name), 1, 3)
    end), ''), 'CRW');
$$;

create or replace function public.create_invite()
returns invites language plpgsql security definer set search_path = public as $$
declare c_id uuid; c companies; taken int; inv invites; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; b bytea;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select company_id into c_id from members where user_id = auth.uid() and role = 'owner' limit 1;
  if c_id is null then raise exception 'not_owner' using errcode = '42501'; end if;
  select * into c from companies where id = c_id for update;
  select count(*) into taken from members where company_id = c_id;
  if taken + (select count(*) from invites where company_id = c_id and used_at is null and expires_at > now()) >= c.seats then
    raise exception 'limit:seats' using errcode = 'P0001';
  end if;
  loop
    b := gen_random_bytes(6); code := '';
    for i in 1..6 loop code := code || substr(chars, 1 + (get_byte(b, i - 1) % length(chars)), 1); end loop;
    exit when not exists (select 1 from invites where invites.code = code);
  end loop;
  insert into invites (code, company_id, created_by) values (code, c_id, auth.uid()) returning * into inv;
  return inv;
end $$;

drop function if exists public.join_company(text, text, text);
create or replace function public.join_company(p_code text, p_display_name text)
returns companies language plpgsql security definer set search_path = public as $$
declare inv invites; c companies; taken int; nm text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  nm := left(trim(coalesce(p_display_name, '')), 60);
  if char_length(nm) < 1 then raise exception 'name_required' using errcode = '22023'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already_member' using errcode = '23505'; end if;
  if p_code !~ '^[A-Za-z0-9]{6}$' then raise exception 'invite_invalid' using errcode = 'P0002'; end if;
  select * into inv from invites where code = upper(p_code) for update;
  if inv.code is null or inv.used_at is not null or inv.expires_at < now() then raise exception 'invite_invalid' using errcode = 'P0002'; end if;
  select * into c from companies where id = inv.company_id for update;
  select count(*) into taken from members where company_id = c.id;
  if taken >= c.seats then raise exception 'limit:seats' using errcode = 'P0001'; end if;
  insert into members (user_id, company_id, role, display_name, initials) values (auth.uid(), c.id, 'member', nm, initials_for(nm));
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return c;
end $$;
revoke all on function public.join_company(text, text) from public, anon;
grant execute on function public.join_company(text, text) to authenticated;
revoke all on function public.initials_for(text) from public, anon;
grant execute on function public.initials_for(text) to authenticated;

-- Seats are also enforced on every insert path, under the company row lock.
create or replace function public.members_enforce_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare s int; n int;
begin
  select seats into s from companies where id = new.company_id for update;
  select count(*) into n from members where company_id = new.company_id;
  if n >= s then raise exception 'limit:seats' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists members_enforce_seats on public.members;
create trigger members_enforce_seats before insert on public.members for each row execute function public.members_enforce_seats();
