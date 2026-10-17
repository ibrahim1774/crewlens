import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/** Sessions live in the keychain, not AsyncStorage. */
const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
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
