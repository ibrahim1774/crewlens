import { friendlyAuthError, isRetryableAuthError, withRetry } from '@/lib/auth';

test('network failures and server errors are retried; client errors are not', () => {
  expect(isRetryableAuthError({ status: 0, message: 'Network request failed' })).toBe(true);
  expect(isRetryableAuthError({ status: 503 })).toBe(true);
  expect(isRetryableAuthError({ status: 521 })).toBe(true);
  expect(isRetryableAuthError({ status: 429 })).toBe(true);
  expect(isRetryableAuthError({ message: 'fetch failed' })).toBe(true);
  expect(isRetryableAuthError({ status: 422 })).toBe(false);
  expect(isRetryableAuthError({ status: 401 })).toBe(false);
});

test('withRetry succeeds on a later attempt', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('down'), { status: 521 });
      return 'ok';
    },
    3,
    [1, 1]
  );
  expect(result).toBe('ok');
  expect(calls).toBe(3);
});

test('withRetry gives up after the last attempt and throws the last error', async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => {
        calls++;
        throw Object.assign(new Error('still down'), { status: 503 });
      },
      3,
      [1, 1]
    )
  ).rejects.toThrow('still down');
  expect(calls).toBe(3);
});

test('withRetry does not retry a client error', async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => {
        calls++;
        throw Object.assign(new Error('Anonymous sign-ins are disabled'), { status: 422 });
      },
      3,
      [1, 1]
    )
  ).rejects.toThrow('Anonymous sign-ins are disabled');
  expect(calls).toBe(1);
});

test('a Google account already linked to another user becomes account_exists', () => {
  expect(friendlyAuthError({ message: 'Identity is already linked to another user' }).message).toBe('account_exists');
  expect(friendlyAuthError({ code: 'identity_already_exists', message: 'x' }).message).toBe('account_exists');
});

import { MIN_PASSWORD, passwordProblem } from '@/lib/auth';

test('passwords need at least 8 characters', () => {
  expect(MIN_PASSWORD).toBe(8);
  expect(passwordProblem('1234567')).toMatch(/at least 8/);
  expect(passwordProblem('12345678')).toBeNull();
  expect(passwordProblem('')).not.toBeNull();
});

test('password errors read like a person wrote them', () => {
  expect(friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).message).toMatch(/email and password don.t match/i);
  expect(friendlyAuthError({ code: 'weak_password', message: 'Password should be at least 8 characters' }).message).toMatch(/at least 8/);
  expect(friendlyAuthError({ code: 'user_already_exists', message: 'User already registered' }).message).toBe('account_exists');
});

import { parseAuthCallback } from '@/lib/auth';

test('the real "Google already linked" callback from Supabase becomes account_exists', () => {
  // Captured from production on 2026-11-06 when a guest tried to link a Google account another user owns.
  const url =
    'crewlens://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user&sb=';
  const parsed = parseAuthCallback(url);
  expect(parsed).toEqual({ error: 'Identity is already linked to another user' });
  expect(friendlyAuthError({ message: (parsed as { error: string }).error }).message).toBe('account_exists');
});
