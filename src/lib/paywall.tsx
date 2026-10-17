import { usePlacement, useSuperwallEvents, useUser } from 'expo-superwall';
import { useEffect } from 'react';

import { track, trackConversion } from '@/lib/analytics';
import { useSession } from '@/lib/auth';
import { paywallEnabled } from '@/lib/plan';
import { notify } from '@/lib/store';

/** Placements configured in the Superwall dashboard (Crew Lens campaign). */
export type Placement = 'onboarding_complete' | 'subscription_lapsed' | 'upgrade_tapped';

export const SUPERWALL_KEY = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ?? '';
/** True only when the flag is on and a key exists; the provider is mounted only then. */
export const superwallActive = paywallEnabled && SUPERWALL_KEY.length > 0;

let entitled = !paywallEnabled;
export function hasEntitlement(): boolean {
  return entitled;
}

/** Mirrors Superwall's subscription status into app state and ties the Superwall user to the signed-in account. Render once under the provider. */
export function SubscriptionSync() {
  const { subscriptionStatus, identify } = useUser();
  const { session } = useSession();

  useEffect(() => {
    if (!session?.user.id) return;
    identify(session.user.id).catch(() => {});
  }, [identify, session?.user.id]);

  useEffect(() => {
    if (subscriptionStatus?.status === 'ACTIVE') entitled = true;
    if (subscriptionStatus?.status === 'INACTIVE') entitled = false;
    notify();
  }, [subscriptionStatus?.status]);

  useSuperwallEvents({
    onPaywallPresent: (info) => track('paywall_shown', { paywall: info.name ?? null }),
    onPaywallDismiss: (info, result) => track('paywall_closed', { paywall: info.name ?? null, result: result.type }),
    onSubscriptionStatusChange: (status) => track('subscription_status', { status: status.status }),
    onSuperwallEvent: ({ event }) => {
      if (event.event !== 'freeTrialStart' && event.event !== 'subscriptionStart') return;
      const product = event.product;
      trackConversion(event.event === 'freeTrialStart' ? 'trial' : 'subscribe', product.productIdentifier, product.price, product.currencyCode ?? 'USD');
    },
  });

  return null;
}

let lastRequest = 0;

/** Shows the paywall for a placement. `onAccess` runs if the user has (or gets) access. */
export function usePaywall() {
  // superwallActive is fixed for the life of the process, so the hook choice never changes between renders.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return superwallActive ? useSuperwallPaywall() : useFlagOffPaywall();
}

/** With the flag off there is no provider and no paywall: every placement grants access. */
function useFlagOffPaywall() {
  return async (placement: Placement, onAccess?: () => void) => {
    track('placement_registered', { placement, paywall: 'off' });
    onAccess?.();
  };
}

function useSuperwallPaywall() {
  const { registerPlacement } = usePlacement({
    onError: (error) => console.warn('Superwall placement error', error),
  });

  return async (placement: Placement, onAccess?: () => void) => {
    const now = Date.now();
    if (now - lastRequest < 2000) return;
    lastRequest = now;
    track('placement_registered', { placement });
    try {
      await registerPlacement({ placement, feature: onAccess });
    } catch (e) {
      console.warn('Superwall register failed', e);
    }
  };
}
