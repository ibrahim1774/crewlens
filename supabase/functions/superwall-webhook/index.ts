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
  const userId = String(data.originalAppUserId ?? '');
  const productId = String((name === 'product_change' ? data.newProductId : data.productId) ?? '');
  if (!userId || userId.startsWith('$SuperwallAlias:')) return Response.json({ ok: true, skipped: 'no_user' });
  if (data.environment === 'SANDBOX' && Deno.env.get('ALLOW_SANDBOX') !== 'true') return Response.json({ ok: true, skipped: 'sandbox' });

  const tier = tierFor(productId);
  let next: Tier | null = null;
  if (GRANT.has(name) && tier) next = tier;
  if (REVOKE.has(name)) next = 'solo';
  if (!next) return Response.json({ ok: true, skipped: name });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // The purchaser must own the company; a crew member's purchase never changes someone else's plan.
  const { data: m } = await supabase.from('members').select('company_id').eq('user_id', userId).eq('role', 'owner').maybeSingle();
  if (!m) return Response.json({ ok: true, skipped: 'not_owner' });
  const { error } = await supabase.from('companies').update({ tier: next, seats: SEATS[next] }).eq('id', m.company_id);
  if (error) return new Response('db', { status: 500 });
  return Response.json({ ok: true, company: m.company_id, tier: next });
});
