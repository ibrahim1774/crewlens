import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSyncExternalStore } from 'react';

import { clearCompany, fetchMembership, getMember, setMembershipChecked } from '@/lib/company';
import { meta, resetLocal } from '@/lib/db';
import { SUPABASE_URL, supabase, supabaseConfigured } from '@/lib/supabase';

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

/** Where the email's link lands: the app itself. Must be in the Supabase redirect allow-list. */
export const AUTH_CALLBACK_URL = 'crewlens://auth/callback';

export async function sendEmailCode(email: string): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: AUTH_CALLBACK_URL },
  });
  if (error) throw error;
}

/**
 * Parses the PKCE code Supabase appends to the callback URL. Pure, so it is unit-tested.
 * Only `?code=` is accepted: a code is useless without the verifier this device stored when it
 * asked for the email, so a crafted link cannot sign a victim into someone else's account.
 * Raw access/refresh tokens in a URL are rejected for the same reason.
 */
export function parseAuthCallback(url: string): { code: string } | { error: string } | null {
  if (!url.startsWith(`${AUTH_CALLBACK_URL}?`) && !url.startsWith(`${AUTH_CALLBACK_URL}#`) && url !== AUTH_CALLBACK_URL) return null;
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const err = params.get('error_description') ?? params.get('error') ?? hashParams.get('error_description') ?? hashParams.get('error');
  if (err) return { error: err };
  const code = params.get('code');
  if (code && /^[A-Za-z0-9._~-]{8,256}$/.test(code)) return { code };
  return { error: 'missing_code' };
}

/**
 * Completes sign-in from the magic link in the email. Returns true when a session was set.
 * The same email also carries a 6-digit code once custom SMTP templates include {{ .Token }}.
 */
export async function handleAuthUrl(url: string): Promise<boolean> {
  const parsed = parseAuthCallback(url);
  if (!parsed) return false;
  if ('error' in parsed) throw new Error(parsed.error);
  const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);
  if (error) throw error;
  if (data.user) await ensureMembershipChecked(data.user.id);
  return true;
}

/** The emailed sign-in code is 6 digits; pasted or autofilled text may carry spaces or words. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw error;
  if (data.user) await ensureMembershipChecked(data.user.id);
}

/** Deletes the account on the server, then clears this device. Throws 'remove_members_first' for an owner with a crew. */
export async function deleteAccount(): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error('not_signed_in');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'delete_failed');
  await supabase.auth.signOut().catch(() => null);
  await clearLocalIdentity();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearLocalIdentity();
}
