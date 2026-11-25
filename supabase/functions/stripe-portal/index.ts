// Opens the Stripe Billing Portal (dedicated configuration) for the signed-in user's web subscription.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { pickPortalRow } from '../_shared/billing-rules.ts';
import { adminClient, getUser, guard, json } from '../_shared/http.ts';
import { siteUrl, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const g = guard(req);
  if (g) return g;
  try {
    const admin = adminClient();
    const user = await getUser(req, admin);
    if (!user) return json(req, { error: 'auth' }, 401);
    const configuration = Deno.env.get('STRIPE_PORTAL_CONFIG');
    if (!configuration) return json(req, { error: 'not_configured' }, 500);
    const { data: rows } = await admin.from('billing_subscriptions').select('stripe_customer_id,status,current_period_end')
      .eq('user_id', user.id).eq('source', 'stripe').not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false }).limit(20);
    const row = pickPortalRow(rows ?? [], Date.now());
    if (!row?.stripe_customer_id) return json(req, { error: 'no_subscription' }, 404);
    const portal = await stripeClient().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${siteUrl()}/account/`,
      configuration,
    });
    return json(req, { url: portal.url });
  } catch (e) {
    console.error('stripe-portal', e instanceof Error ? e.message : 'error');
    return json(req, { error: 'server' }, 500);
  }
});
