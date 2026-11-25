// Deletes the signed-in user's account (App Review 5.1.1(v)).
// - A crew member: their membership and login are removed; the company's jobs and photos stay.
// - A sole owner: the whole company is removed, including every photo, thumbnail and document file.
// - An owner with other members: refused until the members are removed, so nobody loses a team's record by accident.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^17';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function removePrefix(admin: ReturnType<typeof createClient>, bucket: string, companyId: string) {
  const { data: folders } = await admin.storage.from(bucket).list(companyId, { limit: 1000 });
  for (const f of folders ?? []) {
    const prefix = `${companyId}/${f.name}`;
    for (;;) {
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (!files?.length) break;
      await admin.storage.from(bucket).remove(files.map((x) => `${prefix}/${x.name}`));
      if (files.length < 1000) break;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user) return json({ error: 'unauthorized' }, 401);
  const uid = who.user.id;

  const { data: memberships } = await admin.from('members').select('company_id, role').eq('user_id', uid);
  for (const m of memberships ?? []) {
    if (m.role !== 'owner') {
      await admin.from('members').delete().eq('company_id', m.company_id).eq('user_id', uid);
      continue;
    }
    const { count } = await admin.from('members').select('user_id', { count: 'exact', head: true }).eq('company_id', m.company_id).neq('user_id', uid);
    if ((count ?? 0) > 0) return json({ error: 'remove_members_first' }, 409);
    for (const bucket of ['photos', 'thumbs', 'documents']) await removePrefix(admin, bucket, m.company_id);
    const { error } = await admin.from('companies').delete().eq('id', m.company_id);
    if (error) return json({ error: 'company_delete_failed' }, 500);
  }
  // Web subscriptions: cancel at Stripe right away so a deleted account is never billed again, then drop the rows.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (stripeKey) {
    const { data: subs } = await admin.from('billing_subscriptions').select('external_id, status').eq('user_id', uid).eq('source', 'stripe');
    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
    for (const s of subs ?? []) {
      if (s.status === 'canceled' || s.status === 'incomplete_expired') continue;
      try {
        await stripe.subscriptions.cancel(s.external_id);
      } catch (e) {
        if ((e as { code?: string }).code !== 'resource_missing') return json({ error: 'subscription_cancel_failed' }, 502);
      }
    }
  }
  await admin.from('billing_subscriptions').delete().eq('user_id', uid);
  await admin.from('superwall_aliases').delete().eq('user_id', uid);
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return json({ error: 'user_delete_failed' }, 500);
  return json({ ok: true });
});
