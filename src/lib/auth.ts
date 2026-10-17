import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSyncExternalStore } from 'react';

import { clearCompany, fetchMembership, getMember, setMembershipChecked } from '@/lib/company';
import { meta, resetLocal } from '@/lib/db';
import { supabase, supabaseConfigured } from '@/lib/supabase';

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
  supabase.auth.onAuthStateChange((event, s) => {
    const previousUser = session?.user.id ?? getMember()?.userId ?? null;
    session = s;
    // A different account (or a sign-out) must never see the previous account's cached company or photos.
    if (event === 'SIGNED_OUT' || (s && previousUser && s.user.id !== previousUser)) {
      void clearLocalIdentity();
    }
    if (event === 'SIGNED_IN' && s && !getMember()) {
      // Returning user on a fresh install or after sign-out: find their company before the gate decides.
      void ensureMembershipChecked(s.user.id);
    }
    emit();
  });
  return session;
}

/**
 * Looks up membership with a timeout so a bad connection never hangs the gate. On failure the gate
 * still proceeds (membershipChecked = true) and a user with a company will reach the tabs on the
 * next successful boot; a true first-time user sees the name step either way.
 */
export async function ensureMembershipChecked(userId: string, timeoutMs = 6000): Promise<void> {
  setMembershipChecked(false);
  try {
    await Promise.race([fetchMembership(userId), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))]);
  } catch {
    // offline or slow; fall through
  } finally {
    setMembershipChecked(true);
  }
}

/** Drops everything cached for the previous account. */
export async function clearLocalIdentity(): Promise<void> {
  setMembershipChecked(false);
  await clearCompany();
  await meta.set('pending_name', null);
  await meta.set('onboarded', null);
  await resetLocal();
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
const NOT_CONFIGURED = 'Cloud sign-in is not set up on this build yet.';

export async function signInWithApple(): Promise<{ fullName: string | null }> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw error;
  const { data } = await supabase.auth.getUser();
  if (data.user) await ensureMembershipChecked(data.user.id);
  const n = credential.fullName;
  const fullName = n ? [n.givenName, n.familyName].filter(Boolean).join(' ') : '';
  return { fullName: fullName || null };
}

export async function sendEmailCode(email: string): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw error;
  if (data.user) await ensureMembershipChecked(data.user.id);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearLocalIdentity();
}
