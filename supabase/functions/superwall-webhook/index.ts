// Superwall → Crew Lens. Superwall posts subscription events here; we turn them into the company's
// billing facts (tier, seats), which only the service role may write. The app never sets its own tier.
// Auth: Superwall sends the shared secret in the Authorization header configured on the webhook.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Tier = 'solo' | 'pro' | 'crew';

const SEATS: Record<Tier, number> = { solo: 1, pro: 1, crew: 3 };
const GRANT = new Set(['initial_purchase', 'renewal', 'uncancellation', 'product_change']);
const REVOKE = new Set(['expiration']);

/** com.ibrahim1774.crewlens.<tier>.<period> → tier. Exported shape kept simple for tests elsewhere. */
export function tierFor(productId: string | null | undefined): Tier | null {
  const m = /^com\.ibrahim1774\.crewlens\.(solo|pro|crew)\.(monthly|yearly)$/.exec(productId ?? '');
  return m ? (m[1] as Tier) : null;
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
  const alias = String(data.originalAppUserId ?? '');
  const productId = String((name === 'product_change' ? data.newProductId : data.productId) ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(alias)) return Response.json({ ok: true, skipped: 'no_alias' });
  if (data.environment === 'SANDBOX' && Deno.env.get('ALLOW_SANDBOX') !== 'true') return Response.json({ ok: true, skipped: 'sandbox' });

  const tier = tierFor(productId);
  if (!tier || (!GRANT.has(name) && !REVOKE.has(name))) return Response.json({ ok: true, skipped: name });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: who } = await supabase.from('superwall_aliases').select('user_id').eq('alias', alias).maybeSingle();
  if (!who) return Response.json({ ok: true, skipped: 'unknown_alias' });
  // The purchaser must own the company; a crew member's purchase never changes someone else's plan.
  const { data: m } = await supabase.from('members').select('company_id, companies(tier)').eq('user_id', who.user_id).eq('role', 'owner').maybeSingle();
  if (!m) return Response.json({ ok: true, skipped: 'not_owner' });
  const current = (m as unknown as { companies: { tier: Tier } | null }).companies?.tier ?? 'solo';
  let next: Tier;
  if (GRANT.has(name)) next = tier;
  else if (current === tier) next = 'solo'; // an expiration only lowers the plan it was for
  else return Response.json({ ok: true, skipped: 'stale_expiration' });
  const { error } = await supabase.from('companies').update({ tier: next, seats: SEATS[next] }).eq('id', m.company_id);
  if (error) return new Response('db', { status: 500 });
  return Response.json({ ok: true, company: m.company_id, tier: next });
});
