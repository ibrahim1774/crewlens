-- Superwall only reports originalAppUserId for UUIDv4 app user ids, so the opaque alias is a UUID.
delete from public.superwall_aliases where alias !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create or replace function public.superwall_alias()
returns text language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select alias into a from superwall_aliases where user_id = auth.uid();
  if a is null then
    a := gen_random_uuid()::text;
    insert into superwall_aliases (alias, user_id) values (a, auth.uid());
  end if;
  return a;
end $$;
