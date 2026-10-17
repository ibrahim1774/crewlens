// Public share endpoint. GET /share?token=... → job JSON with signed image URLs, or { status: "expired" }.
// Runs with the service role so anon callers never touch tables directly; every read goes through
// get_shared_project(), which checks expiry, revocation and company integrity and records the view.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ status: 'error', message: 'method' }, 405);

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return json({ status: 'expired' }, 404);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const uaHash = await sha256(req.headers.get('user-agent') ?? '');
  const { data, error } = await supabase.rpc('get_shared_project', { p_token: token, p_ua_hash: uaHash });
  if (error) return json({ status: 'error', message: 'lookup' }, 500);
  if (!data || data.status !== 'ok') return json({ status: 'expired' }, 404);

  type Row = { id: string; kind: string; taken_at: string; lat: number | null; lng: number | null; initials: string; width: number | null; height: number | null; storage_path: string; thumb_path: string };
  const photos = (data.photos ?? []) as Row[];
  const [full, thumbs] = await Promise.all([
    photos.length ? supabase.storage.from('photos').createSignedUrls(photos.map((p) => p.storage_path), 3600) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    photos.length ? supabase.storage.from('thumbs').createSignedUrls(photos.map((p) => p.thumb_path), 3600) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const fullMap = new Map((full.data ?? []).map((s) => [s.path, s.signedUrl]));
  const thumbMap = new Map((thumbs.data ?? []).map((s) => [s.path, s.signedUrl]));

  return json({
    status: 'ok',
    type: data.type,
    live: data.live,
    name: data.name,
    address: data.address,
    photos: photos.map((p) => ({
      id: p.id,
      kind: p.kind,
      taken_at: p.taken_at,
      lat: p.lat,
      lng: p.lng,
      initials: p.initials,
      width: p.width,
      height: p.height,
      url: fullMap.get(p.storage_path) ?? null,
      thumb: thumbMap.get(p.thumb_path) ?? null,
    })),
  });
});
