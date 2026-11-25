-- Web billing (Stripe) next to Apple IAP. One table of subscriptions per user, one function that turns them
-- into the company's tier. Written only by edge functions with the service role; the app reads through
-- my_entitlement(). Plan: docs/superpowers/plans/2026-11-24-web-checkout.md (Revision 2).

create table billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('apple','stripe')),
  external_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  tier text not null check (tier in ('solo','pro','crew')),
  period text not null check (period in ('monthly','yearly')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  checkout_session_id text unique,
  livemode boolean not null default false,
  email text,
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index billing_subscriptions_user on billing_subscriptions(user_id);
alter table billing_subscriptions enable row level security;
revoke all on table billing_subscriptions from anon, authenticated;

create table stripe_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;
revoke all on table stripe_events from anon, authenticated;

-- Highest active tier among a user's rows. NULL when the user has no rows at all (existing Apple payers
-- predate this table and keep whatever tier the company has). 'solo' when rows exist but none is active.
create or replace function billing_tier_for(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from billing_subscriptions where user_id = p_user) then null
    else coalesce((
      select b.tier from billing_subscriptions b
      where b.user_id = p_user
        and b.status in ('active','trialing','past_due')
        and (b.current_period_end is null or b.current_period_end + interval '3 days' > now())
      order by case b.tier when 'crew' then 3 when 'pro' then 2 else 1 end desc
      limit 1
    ), 'solo')
  end
$$;
revoke all on function billing_tier_for(uuid) from public, anon, authenticated;

-- Sets tier + seats on every company the user owns. protect_billing_columns lets the update through because
-- the edge functions call this with the service-role JWT (auth.jwt() role = service_role) or as postgres.
create or replace function apply_billing(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  t := billing_tier_for(p_user);
  if t is null then return; end if;
  update companies
     set tier = t, seats = case t when 'crew' then 3 else 1 end
   where id in (select company_id from members where user_id = p_user and role = 'owner')
     and (tier is distinct from t or seats is distinct from (case t when 'crew' then 3 else 1 end));
end $$;
revoke all on function apply_billing(uuid) from public, anon, authenticated;
grant execute on function apply_billing(uuid) to service_role;

-- Same body as 0001 (signature and grants unchanged); a new company starts on the owner's paid tier if they
-- already have billing rows (a web buyer who pays first and creates the company afterwards).
create or replace function create_company_with_owner(p_name text, p_trade text, p_display_name text, p_initials text)
returns companies language plpgsql security definer set search_path = public as $$
declare c companies; t text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  t := billing_tier_for(auth.uid());
  if t is null then
    insert into companies(name, trade) values (trim(p_name), p_trade) returning * into c;
  else
    insert into companies(name, trade, tier, seats)
      values (trim(p_name), p_trade, t, case t when 'crew' then 3 else 1 end) returning * into c;
  end if;
  insert into members(user_id, company_id, role, display_name, initials)
    values (auth.uid(), c.id, 'owner', trim(p_display_name), p_initials);
  return c;
end $$;
revoke all on function create_company_with_owner(text, text, text, text) from public, anon, authenticated;
grant execute on function create_company_with_owner(text, text, text, text) to authenticated;

-- What the app asks: is the signed-in user covered by a paid plan (their own, or their company owner's)?
create or replace function my_entitlement() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); holder uuid; r billing_subscriptions;
begin
  if u is null then return jsonb_build_object('active', false); end if;
  select m2.user_id into holder
    from members m1 join members m2 on m2.company_id = m1.company_id and m2.role = 'owner'
   where m1.user_id = u
   order by (m1.role = 'owner') desc
   limit 1;
  holder := coalesce(holder, u);
  select * into r from billing_subscriptions b
   where b.user_id = holder
     and b.status in ('active','trialing','past_due')
     and (b.current_period_end is null or b.current_period_end + interval '3 days' > now())
   order by case b.tier when 'crew' then 3 when 'pro' then 2 else 1 end desc, b.current_period_end desc nulls first
   limit 1;
  if not found then return jsonb_build_object('active', false); end if;
  return jsonb_build_object('active', true, 'source', r.source, 'tier', r.tier, 'status', r.status,
    'period_end', r.current_period_end, 'cancel_at_period_end', r.cancel_at_period_end);
end $$;
revoke all on function my_entitlement() from public, anon, authenticated;
grant execute on function my_entitlement() to authenticated;
