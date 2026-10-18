import { groupByDay, storageKey, targetSize } from '@/lib/photos';

test('storage key is company/job/photo.jpg', () => {
  expect(storageKey('c', 'j', 'p')).toBe('c/j/p.jpg');
});

test('target size keeps the aspect ratio and never upscales', () => {
  expect(targetSize(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
  expect(targetSize(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  expect(targetSize(1000, 500, 2048)).toEqual({ width: 1000, height: 500 });
  expect(targetSize(4032, 3024, 320)).toEqual({ width: 320, height: 240 });
});

test('groups photos by local day, newest day and newest photo first, with a label', () => {
  const g = groupByDay(
    [
      { id: 'a', takenAt: '2026-10-17T10:00:00Z' },
      { id: 'b', takenAt: '2026-10-16T10:00:00Z' },
      { id: 'c', takenAt: '2026-10-17T12:00:00Z' },
    ],
    'UTC'
  );
  expect(g.map((x) => x.key)).toEqual(['2026-10-17', '2026-10-16']);
  expect(g[0].photos.map((p) => p.id)).toEqual(['c', 'a']);
  expect(g[0].label).toBe('Saturday · Oct 17');
  expect(g[0].count).toBe('2 photos');
  expect(g[1].label).toBe('Friday · Oct 16');
  expect(g[1].count).toBe('1 photo');
});
