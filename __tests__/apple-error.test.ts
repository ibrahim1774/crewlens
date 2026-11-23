import { appleSignInError } from '@/lib/auth';

const err = (code: string, message = 'raw') => Object.assign(new Error(message), { code });

test('closing the Apple sheet is a quiet cancel', () => {
  expect(appleSignInError(err('ERR_REQUEST_CANCELED'))).toBeNull();
});

test('no Apple Account on the phone gets plain words, not "unknown reason"', () => {
  const e = appleSignInError(err('ERR_REQUEST_UNKNOWN', 'The authorization attempt failed for an unknown reason'));
  expect((e as Error).message).toMatch(/Apple Account in Settings/);
  expect((e as Error).message).not.toMatch(/unknown reason/);
});

test('anything else passes through unchanged', () => {
  const original = err('ERR_SOMETHING', 'Network down');
  expect(appleSignInError(original)).toBe(original);
  expect(appleSignInError('boom')).toBe('boom');
});
