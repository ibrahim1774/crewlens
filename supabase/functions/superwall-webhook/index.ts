// Superwall → Crew Lens. Superwall posts subscription events here; we record them as an 'apple' row in
// billing_subscriptions and let apply_billing() turn all of the owner's rows (Apple + Stripe) into the company's
// billing facts (tier, seats), which only the service role may write. The app never sets its own tier.
// Auth: Superwall sends the shared secret in the Authorization header configured on the webhook.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Tier = 'solo' | 'pro' | 'crew';

const GRANT = new Set(['initial_purchase', 'renewal', 'uncancellation', 'product_change']);
const REVOKE = new Set(['expiration']);

/** com.ibrahim1774.crewlens.<tier>.<period> → tier. Exported shape kept simple for tests elsewhere. */
export function tierFor(productId: string | null | undefined): Tier | null {
  const m = /^com\.ibrahim1774\.crewlens\.(solo|pro|crew)\.(monthly|yearly)$/.exec(productId ?? '');
  return m ? (m[1] as Tier) : null;
}

export function periodFor(productId: string | null | undefined): 'monthly' | 'yearly' | null {
  const m = /^com\.ibrahim1774\.crewlens\.(solo|pro|crew)\.(monthly|yearly)$/.exec(productId ?? '');
  return m ? (m[2] as 'monthly' | 'yearly') : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = Deno.env.get('SUPERWALL_WEBHOOK_SECRET') ?? '';
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return new Response('unauthorized', { status: 401 });

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const data = body.data ?? {};
  const name = String(body.type ?? data.name ?? '');
  // The SDK identifies with an opaque alias minted by superwall_alias(); raw user ids are never accepted.
  // Aliases are stored lowercase; some stores report UUIDs in capitals.
  const alias = String(data.originalAppUserId ?? '').toLowerCase();
  const productId = String((name === 'product_change' ? data.newProductId : data.productId) ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(alias)) return Response.json({ ok: true, skipped: 'no_alias' });
  if (data.environment === 'SANDBOX' && Deno.env.get('ALLOW_SANDBOX') !== 'true') return Response.json({ ok: true, skipped: 'sandbox' });

  const tier = tierFor(productId);
  if (!tier || (!GRANT.has(name) && !REVOKE.has(name))) return Response.json({ ok: true, skipped: name });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: who } = await supabase.from('superwall_aliases').select('user_id').eq('alias', alias).maybeSingle();
  if (!who) return Response.json({ ok: true, skipped: 'unknown_alias' });
  const uid = who.user_id as string;
  const live = data.environment !== 'SANDBOX';
  const { data: existing } = await supabase.from('billing_subscriptions').select('tier').eq('source', 'apple').eq('external_id', alias).maybeSingle();

  if (REVOKE.has(name)) {
    // An expiration only lowers the plan it was for.
    if (existing) {
      if (existing.tier !== tier) return Response.json({ ok: true, skipped: 'stale_expiration' });
    } else {
      // Payer from before this table existed: no row yet, so compare with the owner's company tier as before.
      const { data: m } = await supabase.from('members').select('companies(tier)').eq('user_id', uid).eq('role', 'owner').maybeSingle();
      const current = (m as unknown as { companies: { tier: Tier } | null } | null)?.companies?.tier;
      if (current !== tier) return Response.json({ ok: true, skipped: 'stale_expiration' });
    }
  }

  const { error } = await supabase.from('billing_subscriptions').upsert({
    source: 'apple',
    external_id: alias,
    user_id: uid,
    tier,
    period: periodFor(productId),
    status: GRANT.has(name) ? 'active' : 'expired',
    livemode: live,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'source,external_id' });
  if (error) return new Response('db', { status: 500 });
  const { error: applyErr } = await supabase.rpc('apply_billing', { p_user: uid });
  if (applyErr) return new Response('db', { status: 500 });
  return Response.json({ ok: true, user: uid, tier, status: GRANT.has(name) ? 'active' : 'expired' });
});
