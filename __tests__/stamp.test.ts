import { stampLines } from '@/lib/stamp';

test('stamp with gps', () => {
  expect(stampLines({ takenAt: '2026-10-17T14:42:00.000Z', lat: 40.7128, lng: -74.006 }, 'IBR', 'UTC')).toEqual([
    '14:42 · OCT 17 2026',
    '40.7128N 74.0060W · IBR',
  ]);
});

test('stamp without gps says NO GPS', () => {
  expect(stampLines({ takenAt: '2026-10-17T14:42:00.000Z', lat: null, lng: null }, 'IBR', 'UTC')[1]).toBe('NO GPS · IBR');
});

test('midnight is 00 not 24', () => {
  expect(stampLines({ takenAt: '2026-10-17T00:05:00.000Z', lat: null, lng: null }, 'AB', 'UTC')[0]).toBe('00:05 · OCT 17 2026');
});
