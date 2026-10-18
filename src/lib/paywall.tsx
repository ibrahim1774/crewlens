import { usePlacement, useSuperwall, useSuperwallEvents, useUser } from 'expo-superwall';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { track, trackConversion } from '@/lib/analytics';
import { useSession } from '@/lib/auth';
import { paywallEnabled } from '@/lib/plan';
import { notify } from '@/lib/store';
import { supabase } from '@/lib/supabase';

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
    // Opaque alias from the server, so purchases can only ever be attributed to this account.
    supabase.rpc('superwall_alias').then(
      ({ data }) => {
        if (typeof data === 'string') identify(data).catch(() => {});
      },
      () => null,
    );
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

/** Restore Purchases (App Review 3.1.2). With Superwall off there is nothing to restore. */
export function useRestorePurchases() {
  // superwallActive is fixed for the life of the process, so the hook choice never changes between renders.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return superwallActive ? useSuperwallRestore() : flagOffRestore;
}

async function flagOffRestore() {
  track('restore_tapped', { paywall: 'off' });
  Alert.alert('Restore purchases', 'Your account already has full access. Purchases restore here once plans are live.');
}

function useSuperwallRestore() {
  const { restorePurchases } = useSuperwall();
  return async () => {
    try {
      const result = await restorePurchases();
      track('restore_tapped', { result: JSON.stringify(result).slice(0, 80) });
      Alert.alert('Restore purchases', 'If this Apple ID has an active Crew Lens subscription, it has been restored.');
    } catch {
      Alert.alert('Restore purchases', 'We could not reach the App Store. Try again in a moment.');
    }
  };
}
