import { linkUrl, SHARE_BASE_URL, describeExpiry } from '@/lib/links';

test('builds the public url from the token', () => {
  expect(linkUrl('abc_-9')).toBe(`${SHARE_BASE_URL}/s/abc_-9`);
  expect(SHARE_BASE_URL.startsWith('https://')).toBe(true);
  expect(SHARE_BASE_URL.endsWith('/')).toBe(false);
});

test('describes expiry in plain words', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  expect(describeExpiry(null, now)).toBe('Never expires');
  expect(describeExpiry('2026-11-16T12:00:00Z', now)).toBe('Expires in 30 days');
  expect(describeExpiry('2026-10-18T11:00:00Z', now)).toBe('Expires in 1 day');
  expect(describeExpiry('2026-10-17T10:00:00Z', now)).toBe('Expired');
});
