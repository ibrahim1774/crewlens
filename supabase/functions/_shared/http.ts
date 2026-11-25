// CORS, JSON responses and caller auth for the Stripe edge functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { originAllowed } from './billing-rules.ts';

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const h: Record<string, string> = { Vary: 'Origin' };
  if (origin && originAllowed(origin, Deno.env.get('CREWLENS_WEB_ORIGINS'))) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'authorization, content-type, apikey, x-client-info';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
}

/** Handles OPTIONS and non-POST; returns a Response to send, or null to carry on. */
export function guard(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  return null;
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

/** The signed-in user for the request's bearer token, or null (missing, expired or not a user token). */
export async function getUser(req: Request, admin: SupabaseClient): Promise<User | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
