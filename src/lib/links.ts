import { getCompany } from '@/lib/company';
import { meta } from '@/lib/db';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { ShareLink } from '@/types/models';

/** Public share page origin. Vercel subdomain until a custom domain exists. */
export const SHARE_BASE_URL = (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://crewlens-share.vercel.app').replace(/\/+$/, '');

export function linkUrl(token: string): string {
  return `${SHARE_BASE_URL}/s/${token}`;
}

/** "Never expires", "Expires in 30 days", "Expires in 1 day", "Expired". */
export function describeExpiry(expiresAt: string | null, now: number = Date.now()): string {
  if (!expiresAt) return 'Never expires';
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return 'Expired';
  const days = Math.max(1, Math.round(ms / 86_400_000));
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
}

function map(r: { id: string; company_id: string; project_id: string; type: 'live' | 'gallery'; token: string; expires_at: string | null; revoked_at: string | null; created_at: string }): ShareLink {
  return { id: r.id, companyId: r.company_id, jobId: r.project_id, type: r.type, token: r.token, expiresAt: r.expires_at, revokedAt: r.revoked_at, createdAt: r.created_at };
}

const COLS = 'id, company_id, project_id, type, token, expires_at, revoked_at, created_at';

/** Reuses the job's unrevoked, unexpired live link or creates one. Requires a connection. */
export async function getOrCreateLiveLink(jobId: string): Promise<ShareLink> {
  void meta.set('link_shared', '1');
  const company = getCompany();
  if (!company) throw new Error('no_company');
  if (!supabaseConfigured) throw new Error('Sharing needs the cloud connection, which is not set up yet.');

  const existing = await supabase
    .from('share_links')
    .select(COLS)
    .eq('project_id', jobId)
    .eq('type', 'live')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && (!existing.data.expires_at || Date.parse(existing.data.expires_at) > Date.now())) return map(existing.data);

  const created = await supabase.from('share_links').insert({ company_id: company.id, project_id: jobId, type: 'live' }).select(COLS).single();
  if (created.error || !created.data) throw created.error ?? new Error('link_create_failed');
  return map(created.data);
}

export async function revokeLink(id: string): Promise<void> {
  const { error } = await supabase.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function listLinks(): Promise<ShareLink[]> {
  const company = getCompany();
  if (!company || !supabaseConfigured) return [];
  const { data } = await supabase.from('share_links').select(COLS).eq('company_id', company.id).order('created_at', { ascending: false });
  return (data ?? []).map(map);
}
