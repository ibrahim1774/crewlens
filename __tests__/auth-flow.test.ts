import { signInMode } from '@/lib/auth';

test('saving a guest account attaches the number to it instead of making a new account', () => {
  expect(signInMode({ guest: true, save: true })).toBe('link');
});

test('a guest who taps Sign in for an existing account leaves the guest account first', () => {
  expect(signInMode({ guest: true, save: false })).toBe('switch');
});

test('with no guest account, it is a normal sign-in', () => {
  expect(signInMode({ guest: false, save: false })).toBe('sign-in');
  expect(signInMode({ guest: false, save: true })).toBe('sign-in');
});

import { friendlyAuthError } from '@/lib/auth';

test('server errors read like a person wrote them', () => {
  expect(friendlyAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid' }).message).toMatch(/code didn.t work/i);
  expect(friendlyAuthError({ code: 'over_sms_send_rate_limit', message: 'x' }).message).toMatch(/wait a minute/i);
  expect(friendlyAuthError({ code: 'over_email_send_rate_limit', message: 'x' }).message).toMatch(/wait a minute/i);
  expect(friendlyAuthError({ code: 'phone_exists', message: 'x' }).message).toBe('account_exists');
  expect(friendlyAuthError({ code: 'email_exists', message: 'x' }).message).toBe('account_exists');
  expect(friendlyAuthError({ message: 'something new' }).message).toBe('something new');
});
