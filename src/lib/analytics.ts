import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import PostHog from 'posthog-react-native';
import AppsFlyer from 'react-native-appsflyer';

/**
 * One place for analytics. Events go to PostHog (product analytics) and
 * AppsFlyer (install attribution). Keys are public client keys from .env.
 */

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const APPSFLYER_KEY = process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY ?? '';
const APPLE_APP_ID = process.env.EXPO_PUBLIC_APPLE_APP_ID ?? '';

// Only a project API key (phc_…) works from a client; a personal key (phx_…) is rejected with 401 on every flush.
const posthogKeyValid = POSTHOG_KEY.startsWith('phc_');
if (POSTHOG_KEY && !posthogKeyValid) console.warn('PostHog: EXPO_PUBLIC_POSTHOG_KEY must be a project key starting with phc_; analytics disabled.');

export const posthog = posthogKeyValid
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, captureAppLifecycleEvents: true })
  : null;

let appsFlyerStarted = false;
let sessionReady = false;
let consentSettled = false;

/**
 * Initialises AppsFlyer at launch. SDK 7 never auto-starts: `start()` must run
 * after the session-ready event, and we also wait until tracking consent is settled.
 */
export async function initAttribution() {
  if (!APPSFLYER_KEY || !APPLE_APP_ID) return;
  try {
    // Order matters: the native SDK throws if the listener is registered before init.
    await AppsFlyer.init({ devKey: APPSFLYER_KEY, appId: APPLE_APP_ID });
    await AppsFlyer.registerSessionReadyListener(() => {
      sessionReady = true;
      void startAttribution();
    });
    if (__DEV__) await AppsFlyer.enableDebug({ enabled: true });
    const { status } = await getTrackingPermissionsAsync();
    // If the user already answered the tracking prompt, don't wait for it again.
    if (status !== 'undetermined') {
      consentSettled = true;
      void startAttribution();
    }
  } catch (e) {
    console.warn('AppsFlyer init failed', e);
  }
}

type AfEvent = { eventName: string; eventValues: Record<string, unknown> };
/** Events raised before AppsFlyer starts (the tracking prompt comes after sign-up) wait here. */
const pending: AfEvent[] = [];
const MAX_PENDING = 50;

function sendAf(e: AfEvent) {
  if (!APPSFLYER_KEY) return;
  if (!appsFlyerStarted) {
    if (pending.length < MAX_PENDING) pending.push(e);
    return;
  }
  AppsFlyer.logEvent(e).catch(() => {});
}

async function startAttribution() {
  if (appsFlyerStarted || !APPSFLYER_KEY || !sessionReady || !consentSettled) return;
  appsFlyerStarted = true;
  try {
    await AppsFlyer.start();
    for (const e of pending.splice(0)) AppsFlyer.logEvent(e).catch(() => {});
  } catch (e) {
    appsFlyerStarted = false;
    console.warn('AppsFlyer start failed', e);
  }
}

/** Test hook: how many AppsFlyer events are waiting for the SDK to start. */
export function pendingAttributionEvents(): number {
  return pending.length;
}

/** Asks for App Tracking Transparency consent (once), then starts attribution either way. */
export async function requestTrackingThenStart() {
  try {
    const { status } = await getTrackingPermissionsAsync();
    if (status === 'undetermined') await requestTrackingPermissionsAsync();
  } catch {
    // Permission API unavailable: attribution still runs without the IDFA.
  }
  consentSettled = true;
  await startAttribution();
}

type Props = Record<string, string | number | boolean | null>;

export function track(event: string, props?: Props) {
  posthog?.capture(event, props);
  sendAf({ eventName: event, eventValues: props ?? {} });
}

/**
 * Sign-up finished (company created or crew joined). Sent under AppsFlyer's standard name so
 * Meta can optimise for it as fb_mobile_complete_registration.
 */
export function trackRegistration(method: 'create' | 'join') {
  posthog?.capture('af_complete_registration', { method });
  sendAf({ eventName: 'af_complete_registration', eventValues: { af_registration_method: method } });
}

/**
 * Purchase milestones under AppsFlyer's standard event names, so ad networks linked in
 * AppsFlyer (Meta, TikTok…) can optimise for trials and subscriptions. Also sent to PostHog.
 */
export function trackConversion(kind: 'trial' | 'subscribe', productId: string, price: number, currency: string) {
  const event = kind === 'trial' ? 'af_start_trial' : 'af_subscribe';
  posthog?.capture(event, { product: productId, price, currency });
  sendAf({
    eventName: event,
    eventValues: {
      af_content_id: productId,
      af_currency: currency,
      // A trial has no revenue yet; a paid subscription start does.
      ...(kind === 'subscribe' ? { af_revenue: price } : { af_price: price }),
    },
  });
}

/** Person properties (role, crew size, how they heard of us). Never PII. */
export function identify(props: Props) {
  posthog?.capture('$set', { $set: props });
}

export function screen(name: string, props?: Props) {
  posthog?.screen(name, props);
}
