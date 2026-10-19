import { formatUSPhone, toE164US } from '@/lib/auth';

test('US numbers become +1 and ten digits however they are typed', () => {
  expect(toE164US('3476131906')).toBe('+13476131906');
  expect(toE164US('(347) 613-1906')).toBe('+13476131906');
  expect(toE164US('+1 347 613 1906')).toBe('+13476131906');
  expect(toE164US('1-347-613-1906')).toBe('+13476131906');
});

test('anything that is not a full US number is refused', () => {
  expect(toE164US('613-1906')).toBeNull();
  expect(toE164US('+44 20 7946 0958')).toBeNull();
  expect(toE164US('034 761 3190')).toBeNull(); // area codes never start with 0 or 1
  expect(toE164US('')).toBeNull();
});

test('the field shows the number as it is typed, US style', () => {
  expect(formatUSPhone('347')).toBe('(347');
  expect(formatUSPhone('3476')).toBe('(347) 6');
  expect(formatUSPhone('3476131906')).toBe('(347) 613-1906');
  expect(formatUSPhone('+1 (347) 613-1906')).toBe('(347) 613-1906');
});

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
