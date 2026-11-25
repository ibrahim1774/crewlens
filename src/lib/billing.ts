import { Alert } from 'react-native';

import { meta } from '@/lib/db';
import { notify, useVersion } from '@/lib/store';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export type BillingSource = 'apple' | 'stripe';

export interface Entitlement {
  active: boolean;
  source: BillingSource | null;
  tier: string | null;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const CACHE_KEY = 'entitlement';

let current: Entitlement | null = null;
let currentUser: string | null = null;
let cacheLoadedFor: string | null = null;
let settled = false;
let inflight: Promise<void> | null = null;
let markReady: () => void = () => {};

function newReady(): Promise<void> {
  return new Promise<void>((resolve) => {
    markReady = resolve;
  });
}

/** Settles after the first refresh attempt for the current account (or as soon as a cached answer is known). Replaced when the account changes. */
export let billingReady: Promise<void> = newReady();

function settle() {
  if (settled) return;
  settled = true;
  markReady();
  notify();
}

/**
 * Switches the tracked account. A different id (including signing in from signed-out) forgets the old answer and
 * starts a fresh, unsettled state, so nothing reads "unpaid" before the new account's refresh finishes.
 */
export function setBillingUser(uid: string | null) {
  if (uid === currentUser) return;
  current = null;
  cacheLoadedFor = null;
  currentUser = uid;
  inflight = null;
  if (settled) {
    settled = false;
    billingReady = newReady();
  }
  notify();
}

/** What the server said for this account: unknown until it answers (an error or another account stays unknown). */
export function billingAnswer(uid: string | null): 'active' | 'inactive' | 'unknown' {
  if (!uid || uid !== currentUser || !current) return 'unknown';
  return current.active ? 'active' : 'inactive';
}

/** True once the first refresh attempt has finished or a cached answer exists. */
export function billingSettled(): boolean {
  return settled;
}

/** Waits for the first attempt and for any refresh that is running right now. */
export async function awaitBilling(): Promise<void> {
  await billingReady;
  if (inflight) await inflight.catch(() => {});
}

/** The server's answer is active, whoever is billing it (App Store or web). */
export function serverEntitled(): boolean {
  return current?.active === true;
}

/** Paid on the web with Stripe. */
export function webEntitled(): boolean {
  return current?.active === true && current.source === 'stripe';
}

export function billingSource(): BillingSource | null {
  return current?.active ? current.source : null;
}

export function getEntitlement(): Entitlement | null {
  return current;
}

/** Re-renders the caller whenever billing changes; returns who bills the active plan. */
export function useBillingSource(): BillingSource | null {
  useVersion();
  return billingSource();
}

/** Forgets the account's answer (sign-out). */
export function resetBilling() {
  setBillingUser(null);
}

function parse(raw: unknown): Entitlement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const source = r.source === 'apple' || r.source === 'stripe' ? r.source : null;
  return {
    active: r.active === true,
    source,
    tier: typeof r.tier === 'string' ? r.tier : null,
    status: typeof r.status === 'string' ? r.status : null,
    periodEnd: typeof r.period_end === 'string' ? r.period_end : typeof r.periodEnd === 'string' ? r.periodEnd : null,
    cancelAtPeriodEnd: r.cancel_at_period_end === true || r.cancelAtPeriodEnd === true,
  };
}

async function loadCache(uid: string) {
  if (cacheLoadedFor === uid) return;
  cacheLoadedFor = uid;
  try {
    const cached = await meta.getJSON<{ uid: string; value: Entitlement }>(CACHE_KEY);
    if (cached && cached.uid === uid && currentUser === uid && !current) {
      current = parse(cached.value);
      // A cold offline launch still knows; no need to make the gate wait for the network.
      if (current) settle();
      notify();
    }
  } catch {
    // no cache
  }
}

async function run(): Promise<void> {
  let uid: string | null = null;
  try {
    if (!supabaseConfigured) return;
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user.id ?? null;
    setBillingUser(uid);
    if (!uid) return;
    await loadCache(uid);
    const { data: ent, error } = await supabase.rpc('my_entitlement');
    if (error) return; // keep the last value (unknown stays unknown)
    const next = parse(ent);
    if (!next || currentUser !== uid) return;
    current = next;
    notify();
    await meta.setJSON(CACHE_KEY, { uid, value: next }).catch(() => {});
  } catch {
    // keep the last value
  } finally {
    // A refresh for an account that has since changed must not settle the new account's state.
    if (currentUser === uid) settle();
  }
}

/** Asks the server who is paying for this account. Never throws; on any failure the last value stays. */
export function refreshEntitlement(): Promise<void> {
  if (inflight) return inflight;
  const p: Promise<void> = run().finally(() => {
    if (inflight === p) inflight = null;
  });
  inflight = p;
  return p;
}

/** For tests. */
export function __resetBillingForTests() {
  current = null;
  currentUser = null;
  cacheLoadedFor = null;
  inflight = null;
  settled = false;
  billingReady = newReady();
}

/** Shown instead of the paywall when the plan is billed on the web. No link, no price (App Store rules). */
export const WEB_BILLED_MESSAGE = 'Your plan is billed on the web. Change it from your Crew Lens account online.';

/** Runs `open` (the paywall) unless the plan is billed on the web, in which case it explains where to change it. */
export function openUpgrade(open: () => void) {
  if (billingSource() === 'stripe') Alert.alert('Your plan', WEB_BILLED_MESSAGE);
  else open();
}
