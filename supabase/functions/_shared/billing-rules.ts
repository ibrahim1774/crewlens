// Pure billing rules shared by the Stripe and Superwall edge functions. No Deno APIs, so Jest can import it.
export type Tier = 'solo' | 'pro' | 'crew';
export type Period = 'monthly' | 'yearly';
export const TIERS: Tier[] = ['solo', 'pro', 'crew'];
export const PERIODS: Period[] = ['monthly', 'yearly'];
export const SEATS: Record<Tier, number> = { solo: 1, pro: 1, crew: 3 };

const RANK: Record<Tier, number> = { solo: 1, pro: 2, crew: 3 };
export const rank = (t: Tier): number => RANK[t] ?? 0;

/** Statuses that grant access (past_due keeps access while Stripe retries the card). */
export function isEntitledStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export type BillingRow = { tier: Tier; status: string; current_period_end?: string | number | null };

/** Days after current_period_end that a paid-looking row keeps access (renewal webhooks and retries can lag). */
export const GRACE_DAYS = 3;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

/** A row grants access: entitled status and not more than the grace period past its period end. */
export function isRowActive(r: BillingRow, nowMs: number): boolean {
  if (!isEntitledStatus(r.status)) return false;
  if (r.current_period_end != null) {
    const end = typeof r.current_period_end === 'number' ? r.current_period_end : Date.parse(r.current_period_end);
    if (!Number.isNaN(end) && end + GRACE_MS <= nowMs) return false;
  }
  return true;
}

/** Highest tier among active rows (3 days of grace after the period end); 'solo' when none. */
export function mergeTier(rows: BillingRow[], nowMs: number): Tier {
  let best: Tier | null = null;
  for (const r of rows) {
    if (!isRowActive(r, nowMs)) continue;
    if (best === null || rank(r.tier) > rank(best)) best = r.tier;
  }
  return best ?? 'solo';
}

export type SourcedRow = { source: 'apple' | 'stripe'; external_id: string; status: string; current_period_end?: string | number | null };

/** Another active entitlement besides `newSubId` (Apple wins the label when both exist); null when there is none. */
export function findDuplicate(rows: SourcedRow[], newSubId: string, nowMs: number): 'apple' | 'stripe' | null {
  let found: 'apple' | 'stripe' | null = null;
  for (const r of rows) {
    if (r.source === 'stripe' && r.external_id === newSubId) continue;
    if (!isRowActive({ tier: 'solo', status: r.status, current_period_end: r.current_period_end }, nowMs)) continue;
    if (r.source === 'apple') return 'apple';
    found = 'stripe';
  }
  return found;
}

/** For the billing portal: the newest active row, else the newest row. `rowsNewestFirst` must already be sorted. */
export function pickPortalRow<T extends { status: string; current_period_end?: string | number | null }>(rowsNewestFirst: T[], nowMs: number): T | null {
  return rowsNewestFirst.find((r) => isRowActive({ tier: 'solo', status: r.status, current_period_end: r.current_period_end }, nowMs)) ?? rowsNewestFirst[0] ?? null;
}

/** Only Pro has the 3-day trial. */
export const trialDaysFor = (tier: Tier): number => (tier === 'pro' ? 3 : 0);

/** Env var holding the Stripe price id, e.g. STRIPE_PRICE_PRO_YEARLY. */
export const planKey = (tier: Tier, period: Period): string => `STRIPE_PRICE_${tier.toUpperCase()}_${period.toUpperCase()}`;

type Env = Record<string, string | undefined>;

function planFromPriceId(priceId: string | null | undefined, env: Env): { tier: Tier; period: Period } | null {
  if (!priceId) return null;
  for (const tier of TIERS) for (const period of PERIODS) if (env[planKey(tier, period)] === priceId) return { tier, period };
  return null;
}
export const tierFromPriceId = (priceId: string | null | undefined, env: Env): Tier | null => planFromPriceId(priceId, env)?.tier ?? null;
export const periodFromPriceId = (priceId: string | null | undefined, env: Env): Period | null => planFromPriceId(priceId, env)?.period ?? null;

/** Live payments always count. Test-mode payments count only for auth user ids on the allowlist (comma separated uuids). */
export function isTestAllowed(userId: string | null | undefined, livemode: boolean, allowlistCsv: string | null | undefined): boolean {
  if (livemode) return true;
  const id = (userId ?? '').trim().toLowerCase();
  if (!id) return false;
  return (allowlistCsv ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(id);
}

/** Exact match, or a pattern with one or more '*' that each match a run of [a-z0-9-] (never dots or slashes). */
export function originAllowed(origin: string | null | undefined, csv: string | null | undefined): boolean {
  if (!origin) return false;
  for (const raw of (csv ?? '').split(',')) {
    const p = raw.trim();
    if (!p) continue;
    if (!p.includes('*')) {
      if (p === origin) return true;
      continue;
    }
    const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+') + '$', 'i');
    if (re.test(origin)) return true;
  }
  return false;
}
