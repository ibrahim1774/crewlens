import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

/** Sessions live in the keychain, not AsyncStorage. */
const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

/** How long a database, auth or function call may take before it fails instead of spinning forever. */
export const REQUEST_TIMEOUT_MS = 20000;

/**
 * Every request the client makes goes through here. Auth refreshes are shared: while one is in
 * flight, every other call waits on it, so a refresh whose socket never answers used to freeze
 * the whole app (a Share button spinning until restart). Now it fails after REQUEST_TIMEOUT_MS
 * and the next call refreshes again. Storage uploads and downloads are left alone: a big photo
 * or PDF on a slow site connection can legitimately take longer.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/storage/v1/')) return fetch(input, init);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const caller = init?.signal;
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener('abort', () => controller.abort());
  }
  return fetch(input, { ...init, signal: controller.signal })
    .catch((e: unknown) => {
      // Same wording as React Native's own network failure, so existing "check your connection" paths apply.
      if (timedOut) throw new TypeError('Network request timed out');
      throw e;
    })
    .finally(() => clearTimeout(timer));
}

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
  global: { fetch: fetchWithTimeout },
});

// Supabase's guidance for React Native: refresh the session only while the app is on screen, so a
// refresh never starts on a socket iOS suspended in the background; coming back starts it again.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});

/** Postgres raises these from the plan-limit triggers. */
export type LimitKind = 'active_jobs' | 'photos_per_job';

export class LimitError extends Error {
  constructor(public kind: LimitKind, public limit: number | null) {
    super(kind);
    this.name = 'LimitError';
  }
}

/** Turns a PostgREST error into a LimitError when it came from a limit trigger, else null. */
export function limitErrorFrom(e: unknown): LimitError | null {
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  const hint = typeof e === 'object' && e && 'hint' in e ? Number((e as { hint: unknown }).hint) : NaN;
  const limit = Number.isFinite(hint) ? hint : null;
  if (msg.includes('limit_active_projects')) return new LimitError('active_jobs', limit);
  if (msg.includes('limit_photos_per_project')) return new LimitError('photos_per_job', limit);
  return null;
}
