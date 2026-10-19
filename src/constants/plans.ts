import type { Tier } from '@/types/models';

/** Store-facing plan catalogue. Prices are the approved App Store prices in USD. */
export interface Plan {
  tier: Tier;
  name: string;
  monthly: number;
  yearly: number;
  trialDays: number;
  blurb: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  { tier: 'solo', name: 'Solo', monthly: 9.99, yearly: 79.99, trialDays: 0, blurb: 'One person. Every photo stamped and filed.' },
  { tier: 'pro', name: 'Pro', monthly: 19.99, yearly: 159.99, trialDays: 3, blurb: 'Documents and invoices, video, links that never expire.', highlight: true },
  { tier: 'crew', name: 'Crew', monthly: 49.99, yearly: 399.99, trialDays: 0, blurb: 'Three seats and 500 active jobs for a whole crew.' },
];

export interface FeatureRow {
  label: string;
  /** One cell per plan in PLANS order. */
  values: [string, string, string];
  /** The row to call out on the Pro card. */
  flagship?: boolean;
}

export const FEATURES: FeatureRow[] = [
  { label: 'Active jobs', values: ['25', '100', '500'] },
  { label: 'Photos per job', values: ['100', '250', '500'] },
  { label: 'Video clips', values: ['—', '10 per job', '25 per job'] },
  { label: 'Live job links', values: ['30 days', 'Never expire', 'Never expire'] },
  { label: 'Documents & invoices', values: ['—', 'Edit, sign, text', 'Edit, sign, text'], flagship: true },
  { label: 'Seats', values: ['1', '1', '3'] },
];

export type Period = 'monthly' | 'yearly';

export function productId(tier: Tier, period: Period): string {
  return `com.ibrahim1774.crewlens.${tier}.${period}`;
}

export function priceLabel(plan: Plan, period: Period): string {
  const n = period === 'yearly' ? plan.yearly : plan.monthly;
  return `$${n.toFixed(2)}/${period === 'yearly' ? 'yr' : 'mo'}`;
}

/** Whole-percent saving of yearly over twelve months of monthly, for the toggle badge. */
export function yearlySavingPct(plan: Plan): number {
  return Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100);
}

export function ctaLabel(plan: Plan): string {
  return plan.trialDays > 0 ? `Start ${plan.trialDays}-day free trial` : `Continue with ${plan.name}`;
}

/** Documents are a Pro feature: Solo cannot upload or send paperwork. */
export function documentsIncluded(tier: Tier): boolean {
  return tier === 'pro' || tier === 'crew';
}

/** Bigger crews start on the Crew plan, everyone else on Pro (the one with the free trial). */
export function suggestedTier(crew: string | null): Tier {
  return crew === '6–15' || crew === '16+' ? 'crew' : 'pro';
}
