import { usePlacement, useSuperwall, useSuperwallEvents, useUser } from 'expo-superwall';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { track, trackConversion } from '@/lib/analytics';
import { useSession } from '@/lib/auth';
import { awaitBilling, billingAnswer, webEntitled } from '@/lib/billing';
import { decideEntitled } from '@/lib/gate';
import { paywallEnabled } from '@/lib/plan';
import { syncRevenueCatPurchases } from '@/lib/revenuecat';
import { notify, useVersion } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { waitAtMost } from '@/lib/time';

/** Placements configured in the Superwall dashboard (Crew Lens campaign). */
export type Placement = 'onboarding_complete' | 'subscription_lapsed' | 'upgrade_tapped';

export const SUPERWALL_KEY = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ?? '';
/** True only when the flag is on and a key exists; the provider is mounted only then. */
export const superwallActive = paywallEnabled && SUPERWALL_KEY.length > 0;

let entitled = !paywallEnabled;
/**
 * Settles once Superwall knows this account's alias. Superwall keeps the first user id a purchase is made under,
 * so a paywall shown before this would credit the purchase to an anonymous id the webhook can't match.
 */
let identified: Promise<unknown> = Promise.resolve();
/** True once Superwall has reported ACTIVE or INACTIVE at least once this launch. */
let statusReported = false;
/** Paid through Superwall (the App Store) or on the web. */
export function hasEntitlement(): boolean {
  return entitled || webEntitled();
}

/**
 * Whether the signed-in owner has paid, for the launch gate. null = not known: Superwall has not reported its
 * status or the server has not answered. Never false on a guess, so an App Store payer is not sent to the paywall.
 */
export function useEntitledState(): { entitled: boolean | null; waiting: boolean } {
  useVersion();
  const { session } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return decideEntitled({
    paywallEnabled,
    superwallActive,
    superwall: entitled ? 'active' : statusReported ? 'inactive' : 'unknown',
    server: billingAnswer(session?.user.id ?? null),
    web: webEntitled(),
    timedOut,
  });
}

export function useEntitled(): boolean | null {
  return useEntitledState().entitled;
}

/** Mirrors Superwall's subscription status into app state and ties the Superwall user to the signed-in account. Render once under the provider. */
export function SubscriptionSync() {
  const { subscriptionStatus, identify } = useUser();
  const { session } = useSession();

  useEffect(() => {
    if (!session?.user.id) return;
    // Opaque alias from the server, so purchases can only ever be attributed to this account.
    identified = Promise.resolve(supabase.rpc('superwall_alias')).then(
      async ({ data }) => {
        if (typeof data === 'string') await identify(data).catch(() => {});
      },
      () => null,
    );
  }, [identify, session?.user.id]);

  useEffect(() => {
    if (subscriptionStatus?.status === 'ACTIVE') entitled = true;
    if (subscriptionStatus?.status === 'INACTIVE') entitled = false;
    if (subscriptionStatus?.status === 'ACTIVE' || subscriptionStatus?.status === 'INACTIVE') statusReported = true;
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
      void syncRevenueCatPurchases();
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
  return async (placement: Placement, onAccess?: () => void, _params?: Record<string, string>) => {
    await waitAtMost(awaitBilling(), 3000);
    if (webEntitled()) {
      track('placement_registered', { placement, paywall: 'web' });
      onAccess?.();
      return;
    }
    track('placement_registered', { placement, paywall: 'off' });
    onAccess?.();
  };
}

function useSuperwallPaywall() {
  const { registerPlacement } = usePlacement({
    onError: (error) => console.warn('Superwall placement error', error),
  });

  /** `params` reach the paywall as placement parameters: the person's answers, for audience rules and copy. */
  return async (placement: Placement, onAccess?: () => void, params?: Record<string, string>) => {
    const now = Date.now();
    if (now - lastRequest < 2000) return;
    lastRequest = now;
    await waitAtMost(awaitBilling(), 3000);
    // Paid on the web: the plan is already active, so Superwall is never opened.
    if (webEntitled()) {
      track('placement_registered', { placement, paywall: 'web' });
      onAccess?.();
      return;
    }
    track('placement_registered', { placement });
    try {
      await waitAtMost(identified, 5000);
      await registerPlacement({ placement, params, feature: onAccess });
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
      void syncRevenueCatPurchases();
      track('restore_tapped', { result: JSON.stringify(result).slice(0, 80) });
      Alert.alert('Restore purchases', 'If this Apple ID has an active Crew Lens subscription, it has been restored.');
    } catch {
      Alert.alert('Restore purchases', 'We could not reach the App Store. Try again in a moment.');
    }
  };
}
