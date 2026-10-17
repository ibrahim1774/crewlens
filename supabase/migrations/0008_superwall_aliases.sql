-- The app identifies to Superwall with an opaque alias minted here, never with the user id, so a
-- device cannot claim another account's subscription events.
create table if not exists public.superwall_aliases (
  alias text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.superwall_aliases enable row level security;
-- No direct access: the RPC below is the only reader/writer for authenticated users; the webhook uses service_role.
revoke all on public.superwall_aliases from anon, authenticated;

create or replace function public.superwall_alias()
returns text language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select alias into a from superwall_aliases where user_id = auth.uid();
  if a is null then
    a := 'cl_' || encode(gen_random_bytes(18), 'hex');
    insert into superwall_aliases (alias, user_id) values (a, auth.uid());
  end if;
  return a;
end $$;
revoke all on function public.superwall_alias() from public, anon;
grant execute on function public.superwall_alias() to authenticated;
