import * as db from '@/lib/db';
import { notify, useVersion } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Company, Member, Tier } from '@/types/models';

export const TRADES = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting',
  'Restoration', 'Remodeling', 'Cleaning', 'Inspection', 'Solar', 'Other',
] as const;

/** Up to three letters that identify the person on a stamp. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '???';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  const third = parts[2]?.[0] ?? parts[1][1] ?? '';
  return (parts[0][0] + parts[1][0] + third).toUpperCase().slice(0, 3);
}

let company: Company | null = null;
let member: Member | null = null;
let loaded = false;

/** Reads the cached company and member from SQLite. Call once at boot. */
export async function loadCachedCompany(): Promise<void> {
  company = await db.meta.getJSON<Company>('company');
  member = await db.meta.getJSON<Member>('member');
  loaded = true;
  notify();
}

async function cache(c: Company | null, m: Member | null) {
  company = c;
  member = m;
  await db.meta.setJSON('company', c);
  await db.meta.setJSON('member', m);
  notify();
}

/** Looks up the signed-in user's membership on the server. Returns null if none. */
export async function fetchMembership(userId: string): Promise<{ company: Company; member: Member } | null> {
  const { data, error } = await supabase
    .from('members')
    .select('user_id, company_id, role, display_name, initials, companies(id, name, trade, tier, seats, created_at)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const c = data.companies as unknown as { id: string; name: string; trade: string; tier: Tier; seats: number; created_at: string } | null;
  if (!c) return null;
  const result = {
    company: { id: c.id, name: c.name, trade: c.trade, tier: c.tier, seats: c.seats, createdAt: c.created_at },
    member: { userId: data.user_id, companyId: data.company_id, role: data.role as Member['role'], displayName: data.display_name, initials: data.initials },
  };
  await cache(result.company, result.member);
  return result;
}

/** Creates the company and the owner's membership for a brand-new user. */
export async function createCompany(input: { userId: string; name: string; trade: string; displayName: string }): Promise<{ company: Company; member: Member }> {
  const { data: c, error } = await supabase
    .from('companies')
    .insert({ name: input.name.trim(), trade: input.trade })
    .select('id, name, trade, tier, seats, created_at')
    .single();
  if (error || !c) throw error ?? new Error('company_create_failed');
  const initials = initialsFor(input.displayName);
  const { error: mErr } = await supabase.from('members').insert({
    user_id: input.userId, company_id: c.id, role: 'owner', display_name: input.displayName.trim(), initials,
  });
  if (mErr) throw mErr;
  const result = {
    company: { id: c.id, name: c.name, trade: c.trade, tier: c.tier as Tier, seats: c.seats, createdAt: c.created_at },
    member: { userId: input.userId, companyId: c.id, role: 'owner' as const, displayName: input.displayName.trim(), initials },
  };
  await cache(result.company, result.member);
  return result;
}

export async function clearCompany(): Promise<void> {
  await cache(null, null);
}

export function getCompany(): Company | null {
  return company;
}
export function getMember(): Member | null {
  return member;
}
export function companyLoaded(): boolean {
  return loaded;
}

export function useCompany(): Company | null {
  useVersion();
  return company;
}
export function useMember(): Member | null {
  useVersion();
  return member;
}
