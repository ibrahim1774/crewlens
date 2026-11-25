// A signed-in account claims a paid Checkout session (never linked by email). One-time and server-checked.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { findDuplicate, isTestAllowed } from '../_shared/billing-rules.ts';
import { adminClient, getUser, guard, json, readJson } from '../_shared/http.ts';
import { applyBilling, idOf, stripeClient, syncSubscription, userTier } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const g = guard(req);
  if (g) return g;
  try {
    const admin = adminClient();
    const user = await getUser(req, admin);
    if (!user) return json(req, { error: 'auth' }, 401);
    const cs = String((await readJson(req)).cs ?? '');
    if (!/^cs_[A-Za-z0-9_]+$/.test(cs)) return json(req, { error: 'not_complete' }, 409);

    const stripe = stripeClient();
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(cs, { expand: ['subscription', 'subscription.customer'] });
    } catch (e) {
      if ((e as { code?: string }).code === 'resource_missing') return json(req, { error: 'not_complete' }, 409);
      throw e;
    }
    const sub = session.subscription && typeof session.subscription !== 'string' ? session.subscription : null;
    if (session.metadata?.app !== 'crewlens' || session.status !== 'complete' || !sub) return json(req, { error: 'not_complete' }, 409);
    if (!isTestAllowed(user.id, !!session.livemode, Deno.env.get('CREWLENS_TEST_USER_IDS'))) return json(req, { error: 'test_not_allowed' }, 403);

    // Store the row first in case the webhook has not arrived yet (user_id comes from metadata only for an account that still exists).
    const synced = await syncSubscription(stripe, admin, sub, { checkoutSessionId: cs, email: session.customer_details?.email ?? null });
    if (!synced) return json(req, { error: 'not_complete' }, 409);

    // Already claimed by somebody else: never touch it (and never cancel it) on this user's behalf.
    const { data: mine } = await admin.from('billing_subscriptions').select('user_id').eq('checkout_session_id', cs).maybeSingle();
    if (mine?.user_id && mine.user_id !== user.id) return json(req, { error: 'claimed_by_other' }, 409);

    // Double billing guard: the user (or their company's owner) already pays elsewhere -> undo this payment.
    {
      const holders = [user.id];
      const { data: mem } = await admin.from('members').select('company_id').eq('user_id', user.id).limit(1).maybeSingle();
      if (mem?.company_id) {
        const { data: owner } = await admin.from('members').select('user_id').eq('company_id', mem.company_id).eq('role', 'owner').limit(1).maybeSingle();
        if (owner?.user_id && owner.user_id !== user.id) holders.push(owner.user_id as string);
      }
      const { data: others, error: othersErr } = await admin.from('billing_subscriptions')
        .select('source,external_id,status,current_period_end').in('user_id', holders);
      if (othersErr) throw new Error(`duplicates: ${othersErr.message}`);
      const dup = findDuplicate((others ?? []) as Parameters<typeof findDuplicate>[0], sub.id, Date.now());
      if (dup) {
        if (sub.status !== 'canceled') await stripe.subscriptions.cancel(sub.id);
        const invoiceId = idOf(sub.latest_invoice as string | { id: string } | null);
        if (invoiceId) {
          // deno-lint-ignore no-explicit-any
          const inv = (await stripe.invoices.retrieve(invoiceId)) as any;
          const pi = idOf(inv.payment_intent);
          if (pi && (inv.amount_paid ?? 0) > 0) {
            try { await stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: `crewlens-dup-${invoiceId}` }); }
            catch (e) { console.error('stripe-claim refund', e instanceof Error ? e.message : 'error'); throw e; }
          }
        }
        await admin.from('billing_subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('source', 'stripe').eq('external_id', sub.id);
        return json(req, { error: 'duplicate_refunded', source: dup }, 409);
      }
    }

    const { data: claimed, error } = await admin
      .from('billing_subscriptions')
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq('checkout_session_id', cs)
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .select('id');
    if (error) throw new Error(`claim: ${error.message}`);
    if (!claimed?.length) return json(req, { error: 'claimed_by_other' }, 409);

    await applyBilling(admin, user.id);
    // Best effort: tag Stripe so later webhooks and the portal know the owner. The claim already stands without it.
    try {
      await stripe.subscriptions.update(sub.id, { metadata: { user_id: user.id } });
      const customerId = idOf(sub.customer as string | { id: string });
      if (customerId) await stripe.customers.update(customerId, { metadata: { app: 'crewlens', user_id: user.id } });
    } catch (e) {
      console.error('stripe-claim metadata', e instanceof Error ? e.message : 'error');
    }
    return json(req, { ok: true, tier: await userTier(admin, user.id), status: sub.status });
  } catch (e) {
    console.error('stripe-claim', e instanceof Error ? e.message : 'error');
    return json(req, { error: 'server' }, 500);
  }
});
