// Stripe client, env helpers and the subscription -> billing_subscriptions sync shared by webhook and claim.
import Stripe from 'npm:stripe@^17';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isTestAllowed, mergeTier, periodFromPriceId, PERIODS, planKey, TIERS, tierFromPriceId, type Tier } from './billing-rules.ts';

export { Stripe };

export function stripeClient(): Stripe {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() });
}

/** The six price ids from env, keyed by their env names. */
export function priceEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const t of TIERS) for (const p of PERIODS) out[planKey(t, p)] = Deno.env.get(planKey(t, p));
  return out;
}

export const siteUrl = (): string => (Deno.env.get('SITE_URL') ?? 'https://primehub.dev/crewlens').replace(/\/+$/, '');
export const stripeIsLive = (): boolean => Deno.env.get('STRIPE_MODE') === 'live';

type Sub = Stripe.Subscription;

/** current_period_end lives on the subscription in older API versions and on its items in newer ones. */
export function periodEndOf(sub: Sub): string | null {
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  const secs = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
  return typeof secs === 'number' ? new Date(secs * 1000).toISOString() : null;
}

export const idOf = (x: string | { id: string } | null | undefined): string | null => (!x ? null : typeof x === 'string' ? x : x.id);

/** A subscription is ours only if tagged app=crewlens AND priced with one of our six prices. */
export function ourPlan(sub: Sub) {
  if (sub.metadata?.app !== 'crewlens') return null;
  const priceId = sub.items?.data?.[0]?.price?.id;
  const env = priceEnv();
  const tier = tierFromPriceId(priceId, env);
  const period = periodFromPriceId(priceId, env);
  return tier && period ? { tier, period } : null;
}

/**
 * Upserts the stripe row for a (fresh) subscription. Never overwrites an existing user_id; sets it from
 * subscription metadata only on a first insert (and in test mode only for allowlisted user ids), and only when that user still exists.
 * Returns the stored row's user id (or null), or undefined when the subscription is not ours.
 */
export async function syncSubscription(
  stripe: Stripe,
  admin: SupabaseClient,
  sub: Sub,
  opts: { checkoutSessionId?: string | null; email?: string | null } = {},
): Promise<{ userId: string | null; tier: Tier; status: string } | undefined> {
  const plan = ourPlan(sub);
  if (!plan) return undefined;
  const customerId = idOf(sub.customer as string | { id: string } | null);
  let email = opts.email ?? null;
  const cust = sub.customer;
  if (!email && cust && typeof cust !== 'string' && !('deleted' in cust && cust.deleted)) email = (cust as Stripe.Customer).email ?? null;
  if (!email && customerId) {
    const c = await stripe.customers.retrieve(customerId);
    if (!c.deleted) email = c.email ?? null;
  }

  const { data: existing, error: exErr } = await admin.from('billing_subscriptions').select('user_id').eq('source', 'stripe').eq('external_id', sub.id).maybeSingle();
  if (exErr) throw new Error(`select: ${exErr.message}`);

  const row: Record<string, unknown> = {
    source: 'stripe',
    external_id: sub.id,
    tier: plan.tier,
    period: plan.period,
    status: sub.status,
    current_period_end: periodEndOf(sub),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: customerId,
    livemode: !!sub.livemode,
    email,
    updated_at: new Date().toISOString(),
  };
  if (opts.checkoutSessionId) row.checkout_session_id = opts.checkoutSessionId;

  if (!existing?.user_id) {
    const metaUser = sub.metadata?.user_id;
    if (metaUser) {
      // Only link an account that still exists (a deleted user would break the foreign key and 500 the webhook).
      const { data } = await admin.auth.admin.getUserById(metaUser);
      if (data?.user && isTestAllowed(data.user.id, !!sub.livemode, Deno.env.get('CREWLENS_TEST_USER_IDS'))) row.user_id = data.user.id;
    }
  }

  const { data: saved, error } = await admin.from('billing_subscriptions').upsert(row, { onConflict: 'source,external_id' }).select('user_id').single();
  if (error) throw new Error(`upsert: ${error.message}`);

  // Best effort: tag the customer so other apps' webhooks can tell it is ours.
  if (customerId && !(typeof cust !== 'string' && cust && (cust as Stripe.Customer).metadata?.app === 'crewlens')) {
    try { await stripe.customers.update(customerId, { metadata: { app: 'crewlens' } }); } catch (_) { /* not critical */ }
  }
  return { userId: (saved?.user_id as string | null) ?? null, tier: plan.tier, status: sub.status };
}

/** The user's effective tier from their rows (same rule as apply_billing). */
export async function userTier(admin: SupabaseClient, userId: string): Promise<Tier> {
  const { data } = await admin.from('billing_subscriptions').select('tier,status,current_period_end').eq('user_id', userId);
  return mergeTier((data ?? []) as { tier: Tier; status: string; current_period_end: string | null }[], Date.now());
}

export async function applyBilling(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.rpc('apply_billing', { p_user: userId });
  if (error) throw new Error(`apply_billing: ${error.message}`);
}
