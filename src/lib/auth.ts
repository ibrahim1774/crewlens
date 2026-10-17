import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSyncExternalStore } from 'react';

import { clearCompany } from '@/lib/company';
import { resetLocal } from '@/lib/db';
import { supabase } from '@/lib/supabase';

let session: Session | null = null;
let sessionLoaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Starts listening to auth changes. Resolves once the persisted session has been read. */
export async function initAuth(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  sessionLoaded = true;
  emit();
  supabase.auth.onAuthStateChange((_event, s) => {
    session = s;
    emit();
  });
  return session;
}

export function getSession(): Session | null {
  return session;
}

export function useSession(): { session: Session | null; loaded: boolean } {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
    () => session
  );
  return { session: snap, loaded: sessionLoaded };
}

/** Sign in with Apple. Returns the full name Apple shares on first sign-in, if any. */
export async function signInWithApple(): Promise<{ fullName: string | null }> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw error;
  const n = credential.fullName;
  const fullName = n ? [n.givenName, n.familyName].filter(Boolean).join(' ') : '';
  return { fullName: fullName || null };
}

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearCompany();
  await resetLocal();
}
