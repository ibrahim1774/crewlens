// Creates a Stripe Checkout session for a Crew Lens plan. The price id comes from env, never from the client.
// Auth: optional bearer token (a signed-in buyer is tied to the session); verify_jwt is off in config.toml.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { isRowActive, PERIODS, planKey, TIERS, trialDaysFor, type Period, type Tier } from '../_shared/billing-rules.ts';
import { adminClient, getUser, guard, json, readJson } from '../_shared/http.ts';
import { siteUrl, stripeClient } from '../_shared/stripe.ts';

type Row = { source: string; status: string; current_period_end: string | null };
const live = (r: Row) => isRowActive({ tier: 'solo', status: r.status, current_period_end: r.current_period_end }, Date.now());

Deno.serve(async (req) => {
  const g = guard(req);
  if (g) return g;
  try {
    const body = await readJson(req);
    const plan = body.plan as Tier, period = body.period as Period;
    if (!TIERS.includes(plan) || !PERIODS.includes(period)) return json(req, { error: 'bad_plan' }, 400);
    const price = Deno.env.get(planKey(plan, period));
    if (!price) return json(req, { error: 'not_configured' }, 500);

    const admin = adminClient();
    const user = await getUser(req, admin);
    if (user) {
      // The user's own rows plus their company owner's (a crew member is covered by the owner's plan).
      const holders = new Set([user.id]);
      const { data: mine } = await admin.from('members').select('company_id').eq('user_id', user.id);
      const ids = (mine ?? []).map((m) => m.company_id);
      if (ids.length) {
        const { data: owners } = await admin.from('members').select('user_id').in('company_id', ids).eq('role', 'owner');
        for (const o of owners ?? []) holders.add(o.user_id);
      }
      const { data: rows } = await admin.from('billing_subscriptions').select('user_id,source,status,current_period_end').in('user_id', [...holders]);
      const all = (rows ?? []) as (Row & { user_id: string })[];
      if (all.some((r) => r.source === 'apple' && live(r))) return json(req, { error: 'apple_active' }, 409);
      if (all.some((r) => r.source === 'stripe' && r.user_id === user.id && live(r))) return json(req, { error: 'already_subscribed', portal: true }, 409);
    }

    const stripe = stripeClient();
    const meta: Record<string, string> = { app: 'crewlens', ...(user ? { user_id: user.id } : {}) };
    const trial = trialDaysFor(plan);
    const site = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      // Crew Lens's own payment method configuration (cards + Apple/Google Pay; Link, bank, Cash App off) so the
      // shared account's defaults never apply. Without it, cards only.
      ...(Deno.env.get('STRIPE_PAYMENT_METHOD_CONFIG')
        ? { payment_method_configuration: Deno.env.get('STRIPE_PAYMENT_METHOD_CONFIG')! }
        : { payment_method_types: ['card' as const] }),
      allow_promotion_codes: false,
      subscription_data: { metadata: meta, ...(trial > 0 ? { trial_period_days: trial } : {}) },
      metadata: meta,
      ...(user ? { client_reference_id: user.id } : {}),
      ...(user?.email ? { customer_email: user.email } : {}),
      success_url: `${site}/welcome/?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/`,
    });
    return json(req, { url: session.url });
  } catch (e) {
    console.error('stripe-checkout', e instanceof Error ? e.message : 'error');
    return json(req, { error: 'server' }, 500);
  }
});
