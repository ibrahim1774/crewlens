import { PLAN_LIMITS, type PlanLimits } from '@/constants/limits';
import type { Tier } from '@/types/models';

/** Off until the Superwall paywall exists. While off, everyone gets Pro limits. */
export const paywallEnabled = process.env.EXPO_PUBLIC_PAYWALL_ENABLED === 'true';

/**
 * The tier whose limits apply right now.
 * companyTier is what the company bought; hasEntitlement is what Superwall says is active.
 */
export function effectiveTier(companyTier: Tier | null, hasEntitlement: boolean, flag: boolean = paywallEnabled): Tier {
  if (!flag) return companyTier ?? 'pro';
  return hasEntitlement ? (companyTier ?? 'solo') : 'solo';
}

export function limitsFor(tier: Tier): PlanLimits {
  return PLAN_LIMITS[tier];
}
