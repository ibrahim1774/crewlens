import * as db from '@/lib/db';
import { notify, useVersion } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Company, Member, Tier } from '@/types/models';

export const TRADES = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting',
  'Restoration', 'Remodeling', 'Cleaning', 'Inspection', 'Solar', 'Other',
] as const;

/**
 * Up to three letters that identify the person on a stamp.
 * One name: first three letters. Two names: first two of the first name plus the last initial ("Jo Smith" → JOS).
 * Three or more: one initial each.
 */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '???';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  if (parts.length === 2) return (parts[0].slice(0, 2) + parts[1][0]).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join('').toUpperCase();
}

let company: Company | null = null;
let member: Member | null = null;
let loaded = false;
/** True once the server has been asked whether the signed-in user belongs to a company (or we have a cache). */
let membershipChecked = false;

export function setMembershipChecked(v: boolean) {
  membershipChecked = v;
  notify();
}
export function useMembershipChecked(): boolean {
  useVersion();
  return membershipChecked;
}

/** Reads the cached company and member from SQLite. Call once at boot. */
export async function loadCachedCompany(): Promise<void> {
  company = await db.meta.getJSON<Company>('company');
  member = await db.meta.getJSON<Member>('member');
  loaded = true;
  if (company) membershipChecked = true;
  notify();
}

async function cache(c: Company | null, m: Member | null) {
  company = c;
  member = m;
  if (c) membershipChecked = true;
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
  if (error) throw error;
  setMembershipChecked(true);
  if (!data) return null;
  const c = data.companies as unknown as { id: string; name: string; trade: string; tier: Tier; seats: number; created_at: string } | null;
  if (!c) return null;
  const result = {
    company: { id: c.id, name: c.name, trade: c.trade, tier: c.tier, seats: c.seats, createdAt: c.created_at },
    member: { userId: data.user_id, companyId: data.company_id, role: data.role as Member['role'], displayName: data.display_name, initials: data.initials },
  };
  await cache(result.company, result.member);
  return result;
}

/** Creates the company and the owner's membership for a brand-new user, atomically on the server. */
export async function createCompany(input: { userId: string; name: string; trade: string; displayName: string }): Promise<{ company: Company; member: Member }> {
  const initials = initialsFor(input.displayName);
  const { data: c, error } = await supabase
    .rpc('create_company_with_owner', {
      p_name: input.name.trim(),
      p_trade: input.trade,
      p_display_name: input.displayName.trim(),
      p_initials: initials,
    })
    .single();
  if (error || !c) throw error ?? new Error('company_create_failed');
  const row = c as { id: string; name: string; trade: string; tier: Tier; seats: number; created_at: string };
  const result = {
    company: { id: row.id, name: row.name, trade: row.trade, tier: row.tier, seats: row.seats, createdAt: row.created_at },
    member: { userId: input.userId, companyId: row.id, role: 'owner' as const, displayName: input.displayName.trim(), initials },
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
