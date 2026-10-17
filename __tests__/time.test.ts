import { plural, timeAgo } from '@/lib/time';

const now = Date.parse('2026-10-17T12:00:00Z');
test('relative times', () => {
  expect(timeAgo(null, now)).toBe('no photos');
  expect(timeAgo('2026-10-17T11:59:40Z', now)).toBe('just now');
  expect(timeAgo('2026-10-17T11:56:00Z', now)).toBe('4m');
  expect(timeAgo('2026-10-17T09:00:00Z', now)).toBe('3h');
  expect(timeAgo('2026-10-15T12:00:00Z', now)).toBe('2d');
  expect(timeAgo('2026-10-03T12:00:00Z', now)).toBe('Oct 3');
});
test('plural', () => {
  expect(plural(1, 'photo')).toBe('1 photo');
  expect(plural(3, 'photo')).toBe('3 photos');
});
