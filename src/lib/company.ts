import * as db from '@/lib/db';
import { notify, useVersion } from '@/lib/store';
import { supabase, supabaseConfigured } from '@/lib/supabase';

const NOT_CONFIGURED = 'The cloud connection is not set up on this build yet.';
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

/** Redeems an invite code for a signed-in user with no company. */
export async function joinCompany(input: { userId: string; code: string; displayName: string }): Promise<{ company: Company; member: Member }> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const { error } = await supabase.rpc('join_company', { p_code: input.code.trim().toUpperCase(), p_display_name: input.displayName });
  if (error) throw new Error(error.message.includes('invite_invalid') ? 'invite_invalid' : error.message.includes('limit:seats') ? 'limit:seats' : error.message.includes('already_member') ? 'already_member' : error.message);
  const m = await fetchMembership(input.userId);
  if (!m) throw new Error('join_failed');
  return m;
}

export interface Invite {
  code: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export async function createInvite(): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_invite');
  if (error) throw new Error(error.message.includes('limit:seats') ? 'limit:seats' : error.message.includes('not_owner') ? 'not_owner' : error.message);
  const r = data as { code: string; created_at: string; expires_at: string; used_at: string | null };
  return { code: r.code, createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at };
}

export async function listInvites(): Promise<Invite[]> {
  const c = getCompany();
  if (!c || !supabaseConfigured) return [];
  const { data } = await supabase.from('invites').select('code, created_at, expires_at, used_at').eq('company_id', c.id).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  return (data ?? []).map((r) => ({ code: r.code, createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at }));
}

export async function deleteInvite(code: string): Promise<void> {
  await supabase.from('invites').delete().eq('code', code);
}

export async function listMembers(): Promise<Member[]> {
  const c = getCompany();
  if (!c || !supabaseConfigured) return getMember() ? [getMember() as Member] : [];
  const { data } = await supabase.from('members').select('user_id, company_id, role, display_name, initials').eq('company_id', c.id).order('created_at', { ascending: true });
  return (data ?? []).map((r) => ({ userId: r.user_id, companyId: r.company_id, role: r.role, displayName: r.display_name, initials: r.initials }));
}

export async function removeMember(userId: string): Promise<void> {
  const c = getCompany();
  if (!c) throw new Error('no_company');
  const { error } = await supabase.from('members').delete().eq('company_id', c.id).eq('user_id', userId);
  if (error) throw error;
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
