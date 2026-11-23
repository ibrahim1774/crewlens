import { Platform } from 'react-native';
import Purchases, { PURCHASES_ARE_COMPLETED_BY_TYPE, STOREKIT_VERSION } from 'react-native-purchases';
import AppsFlyer from 'react-native-appsflyer';

/**
 * RevenueCat as an observer only. Superwall stays the paywall and makes every purchase;
 * RevenueCat watches StoreKit (and Apple's server notifications) so trial conversions and
 * renewals reach AppsFlyer server-to-server, then Meta. Each customer carries the AppsFlyer id
 * so those events join the install that came from an ad.
 *
 * - Customers stay anonymous: no account id or email is sent.
 * - Never shows anything (in-app messages off) and never throws.
 * - Without a key (local dev, Jest) or off iOS every call is a no-op.
 */

let configured = false;

const warn = (what: string, e: unknown) => console.warn(`[revenuecat] ${what} failed:`, e);

/** Configures RevenueCat once, after AppsFlyer has started. Returns whether it is configured. */
export function startRevenueCat(): boolean {
  if (configured) return true;
  // Read literally so Expo inlines it at build time.
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
  if (!apiKey || Platform.OS !== 'ios') return false;
  try {
    Purchases.configure({
      apiKey,
      purchasesAreCompletedBy: { type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP, storeKitVersion: STOREKIT_VERSION.STOREKIT_2 },
      // Superwall owns every sheet the user sees.
      shouldShowInAppMessagesAutomatically: false,
    });
    configured = true;
  } catch (e) {
    warn('configure', e);
    return false;
  }
  Purchases.collectDeviceIdentifiers().catch((e) => warn('collectDeviceIdentifiers', e));
  AppsFlyer.getAppsFlyerUID()
    .then((id) => (id ? Purchases.setAppsflyerID(id) : undefined))
    .catch((e) => warn('setAppsflyerID', e));
  return true;
}

/** After a Superwall purchase or restore: hand StoreKit's transactions to RevenueCat now. Never rejects. */
export async function syncRevenueCatPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.syncPurchases();
  } catch (e) {
    warn('syncPurchases', e);
  }
}

/** Test only. */
export function resetRevenueCatForTests(): void {
  configured = false;
}
