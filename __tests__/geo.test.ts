import { distanceM, formatCoords } from '@/lib/geo';

test('distance between two points in metres', () => {
  // Empire State Building to Bryant Park, about 650 m
  const d = distanceM({ lat: 40.7484, lng: -73.9857 }, { lat: 40.7536, lng: -73.9832 });
  expect(d).toBeGreaterThan(600);
  expect(d).toBeLessThan(700);
});

test('zero distance for the same point', () => {
  expect(distanceM({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
});

test('formats coordinates with hemispheres', () => {
  expect(formatCoords(40.7128, -74.006)).toBe('40.7128N 74.0060W');
  expect(formatCoords(-33.8688, 151.2093)).toBe('33.8688S 151.2093E');
});
