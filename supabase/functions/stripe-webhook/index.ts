// Stripe -> Crew Lens. Verifies the signature, dedupes, refetches the subscription and mirrors it into
// billing_subscriptions, then recomputes the owner's company tier. Auth: Stripe signature only.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { adminClient } from '../_shared/http.ts';
import { applyBilling, idOf, Stripe, stripeClient, stripeIsLive, syncSubscription } from '../_shared/stripe.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function subscriptionIdOf(event: Stripe.Event): { subId: string | null; cs: string | null } {
  // deno-lint-ignore no-explicit-any
  const o = event.data.object as any;
  switch (event.type) {
    case 'checkout.session.completed':
      return { subId: idOf(o.subscription), cs: o.id ?? null };
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return { subId: o.id ?? null, cs: null };
    case 'invoice.paid':
    case 'invoice.payment_failed':
      // Older API versions: invoice.subscription. Newer: invoice.parent.subscription_details.subscription.
      return { subId: idOf(o.subscription ?? o.parent?.subscription_details?.subscription), cs: null };
    default:
      return { subId: null, cs: null };
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return reply({ error: 'bad_signature' }, 400);
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (_) {
    return reply({ error: 'bad_signature' }, 400);
  }
  if (event.livemode !== stripeIsLive()) return reply({ ignored: 'livemode' });

  const admin = adminClient();
  const { error: dupErr } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === '23505') return reply({ duplicate: true });
    console.error('stripe-webhook dedupe', dupErr.message);
    return reply({ error: 'db' }, 500);
  }

  try {
    const { subId, cs } = subscriptionIdOf(event);
    if (!subId) return reply({ ignored: event.type });
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['customer'] });
    // deno-lint-ignore no-explicit-any
    const o = event.data.object as any;
    const email = event.type === 'checkout.session.completed' ? (o.customer_details?.email ?? o.customer_email ?? null) : null;
    const synced = await syncSubscription(stripe, admin, sub, { checkoutSessionId: cs, email });
    if (!synced) return reply({ ignored: 'not_crewlens' });
    if (synced.userId) await applyBilling(admin, synced.userId);
    return reply({ ok: true });
  } catch (e) {
    console.error('stripe-webhook', event.type, e instanceof Error ? e.message : 'error');
    await admin.from('stripe_events').delete().eq('id', event.id);
    return reply({ error: 'server' }, 500);
  }
});
