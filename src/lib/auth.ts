import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
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

const NOT_CONFIGURED = 'Cloud sign-in is not set up on this build yet.';

/** The account "Get started" makes with no details, so the company and the purchase exist before sign-up. */
export function isGuest(s: Session | null = session): boolean {
  return s?.user.is_anonymous === true;
}

/** Network failures and 5xx responses are worth another try; a 4xx (anonymous sign-ins off, bad key) is not. */
export function isRetryableAuthError(e: { status?: number; name?: string; message?: string }): boolean {
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return false;
  return true;
}

/** Runs `fn` up to `attempts` times, waiting `delays[i]` ms between tries, while the error is retryable. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delays: number[] = [1500, 3000]): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryableAuthError((e ?? {}) as { status?: number }) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, delays[Math.min(i, delays.length - 1)]));
    }
  }
  throw last;
}

export const SERVER_UNREACHABLE = 'Crew Lens can’t reach its server right now. Check your connection and try again in a minute.';

export async function startGuest(): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  if (session) return;
  try {
    await withRetry(async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    });
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    // Keep a precise reason for 4xx (a configuration problem); everything else reads as "server unreachable".
    if (typeof status === 'number' && status >= 400 && status < 500) throw e;
    throw new Error(SERVER_UNREACHABLE);
  }
}

/**
 * link: attach the phone, email or Apple ID to the guest account, keeping its company and plan.
 * switch: a guest tapped Sign in for an account they already have, so leave the guest account first.
 * sign-in: nobody is signed in.
 */
export function signInMode(s: { guest: boolean; save: boolean }): 'link' | 'switch' | 'sign-in' {
  if (!s.guest) return 'sign-in';
  return s.save ? 'link' : 'switch';
}

async function prepare(save: boolean): Promise<'link' | 'sign-in'> {
  const mode = signInMode({ guest: isGuest(), save });
  if (mode === 'switch') await supabase.auth.signOut();
  return mode === 'link' ? 'link' : 'sign-in';
}

/**
 * Server errors in plain words. An address that already belongs to another account becomes
 * 'account_exists', which the form turns into its own message.
 */
export function friendlyAuthError(e: { code?: string; message: string }): Error {
  if (e.code === 'phone_exists' || e.code === 'email_exists' || e.code === 'user_already_exists' ||e.code === 'identity_already_exists' || /already (been )?(registered|linked|exists)/i.test(e.message)) {
    return new Error('account_exists');
  }
  if (e.code === 'otp_expired' || /expired or is invalid/i.test(e.message)) return new Error("That code didn't work. Check the 6 digits, or send a new code.");
  if (e.code?.startsWith('over_') || /rate limit/i.test(e.message)) return new Error('Too many codes in a row. Wait a minute and try again.');
  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(e.message)) return new Error('That email and password don’t match. Check them, or tap Forgot password.');
  if (e.code === 'weak_password' || /password.*(at least|weak|short)/i.test(e.message)) return new Error(PASSWORD_HINT);
  return e instanceof Error ? e : new Error(e.message);
}

/** Sign in with Apple, or attach Apple to the guest account when saving it. Returns the full name Apple shares on first sign-in, if any. */

export async function signInWithApple(save = false): Promise<{ fullName: string | null }> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const mode = await prepare(save);
  const { error } =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider: 'apple', token: credential.identityToken })
      : await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw friendlyAuthError(error);
  const { data } = await supabase.auth.getUser();
  if (data.user) await ensureMembershipChecked(data.user.id);
  const n = credential.fullName;
  const fullName = n ? [n.givenName, n.familyName].filter(Boolean).join(' ') : '';
  return { fullName: fullName || null };
}

/** Where the email's link lands: the app itself. Must be in the Supabase redirect allow-list. */
export const AUTH_CALLBACK_URL = 'crewlens://auth/callback';

/** The user closed the Google sheet without finishing. Callers treat this as a quiet cancel. */
export const GOOGLE_CANCELLED = 'google_cancelled';

/**
 * Sign in with Google, or attach Google to the guest account when saving it (keeps its company and plan).
 * Runs Supabase's OAuth flow in the system browser sheet and finishes with the PKCE code it returns.
 * Returns the name Google shares, if any.
 */
export async function signInWithGoogle(save = false): Promise<{ fullName: string | null }> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const mode = await prepare(save);
  const options = { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true };
  const { data, error } =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider: 'google', options })
      : await supabase.auth.signInWithOAuth({ provider: 'google', options });
  if (error) throw friendlyAuthError(error);
  if (!data.url) throw new Error('Could not reach Google. Check your connection and try again.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK_URL);
  if (result.type !== 'success') throw new Error(GOOGLE_CANCELLED);
  try {
    await handleAuthUrl(result.url);
  } catch (e) {
    // "Identity is already linked to another user" comes back in the callback URL, not from linkIdentity.
    throw friendlyAuthError(e instanceof Error ? { message: e.message } : { message: 'Could not sign in with Google.' });
  }
  const { data: u } = await supabase.auth.getUser();
  const name = u.user?.user_metadata?.full_name ?? u.user?.user_metadata?.name;
  return { fullName: typeof name === 'string' && name.trim() ? name.trim() : null };
}

export const MIN_PASSWORD = 8;
export const PASSWORD_HINT = `Use at least ${MIN_PASSWORD} characters for your password.`;

/** Null when the password is acceptable, else the sentence to show. Pure, so it is unit-tested. */
export function passwordProblem(password: string): string | null {
  return password.length >= MIN_PASSWORD ? null : PASSWORD_HINT;
}

/**
 * Creates the account with an email and password.
 * save: the guest account gets the email and password, keeping its company and plan.
 * Otherwise a plain sign-up (a guest who taps through from Sign in leaves the guest account first).
 * Confirm-email is off in Supabase, so there is no confirmation step: the account is usable at once.
 */
export async function signUpWithPassword(email: string, password: string, save = false): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const address = email.trim().toLowerCase();
  const mode = await prepare(save);
  if (mode === 'link') {
    const { error } = await supabase.auth.updateUser({ email: address, password });
    if (error) throw friendlyAuthError(error);
  } else {
    const { data, error } = await supabase.auth.signUp({ email: address, password });
    if (error) throw friendlyAuthError(error);
    // With email already registered and confirmations off, Supabase may return a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('account_exists');
  }
  const { data: u } = await supabase.auth.getUser();
  if (u.user) await ensureMembershipChecked(u.user.id);
}

/** Signs in to an existing account. A guest leaves the guest account first. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  // A guest who found they already have an account lands here with save=false after the prompt.
  if (isGuest()) await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw friendlyAuthError(error);
  if (data.user) await ensureMembershipChecked(data.user.id);
}

/** After the emailed code signed them in (Forgot password), set the new password. */
export async function setNewPassword(password: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw friendlyAuthError(error);
}

export async function sendEmailCode(email: string, save = false): Promise<void> {
  if (!supabaseConfigured) throw new Error(NOT_CONFIGURED);
  const address = email.trim().toLowerCase();
  const mode = await prepare(save);
  const { error } =
    mode === 'link'
      ? await supabase.auth.updateUser({ email: address }, { emailRedirectTo: AUTH_CALLBACK_URL })
      : await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: AUTH_CALLBACK_URL } });
  if (error) throw friendlyAuthError(error);
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

export async function verifyEmailCode(email: string, code: string, save = false): Promise<void> {
  const link = signInMode({ guest: isGuest(), save }) === 'link';
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: link ? 'email_change' : 'email' });
  if (error) throw friendlyAuthError(error);
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
