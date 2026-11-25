// Tells the welcome page what a Checkout session bought (no auth: the session id is the unguessable key).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { periodFromPriceId, tierFromPriceId } from '../_shared/billing-rules.ts';
import { adminClient, guard, json, readJson } from '../_shared/http.ts';
import { priceEnv, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const g = guard(req);
  if (g) return g;
  try {
    const cs = String((await readJson(req)).cs ?? '');
    if (!/^cs_[A-Za-z0-9_]+$/.test(cs)) return json(req, { error: 'not_found' }, 404);
    const stripe = stripeClient();
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(cs, { expand: ['line_items'] });
    } catch (e) {
      if ((e as { code?: string }).code === 'resource_missing') return json(req, { error: 'not_found' }, 404);
      throw e;
    }
    if (session.metadata?.app !== 'crewlens') return json(req, { error: 'not_found' }, 404);
    const priceId = session.line_items?.data?.[0]?.price?.id;
    const env = priceEnv();
    const { data: claimedRow } = await adminClient().from('billing_subscriptions').select('id').eq('checkout_session_id', cs).not('user_id', 'is', null).maybeSingle();
    return json(req, {
      email: session.customer_details?.email ?? session.customer_email ?? null,
      plan: tierFromPriceId(priceId, env),
      period: periodFromPriceId(priceId, env),
      complete: session.status === 'complete',
      claimed: !!claimedRow,
    });
  } catch (e) {
    console.error('stripe-session', e instanceof Error ? e.message : 'error');
    return json(req, { error: 'server' }, 500);
  }
});
