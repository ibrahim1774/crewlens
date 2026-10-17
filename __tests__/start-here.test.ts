import { START_STEPS, startHereProgress } from '@/lib/start-here';

test('a brand-new account sees the card at 0%', () => {
  const p = startHereProgress({ jobs: 0, photos: 0, linkShared: false, documents: 0, dismissed: false });
  expect(p).toEqual({ done: [], pct: 0, visible: true });
});

test('steps complete in any order and the card hides when all four are done', () => {
  expect(startHereProgress({ jobs: 1, photos: 0, linkShared: true, documents: 0, dismissed: false })).toMatchObject({ done: ['job', 'link'], pct: 50, visible: true });
  expect(startHereProgress({ jobs: 2, photos: 9, linkShared: true, documents: 1, dismissed: false })).toMatchObject({ done: ['job', 'photo', 'link', 'doc'], pct: 100, visible: false });
});

test('dismissing hides the card even when steps remain', () => {
  expect(startHereProgress({ jobs: 1, photos: 1, linkShared: false, documents: 0, dismissed: true }).visible).toBe(false);
  expect(START_STEPS).toHaveLength(4);
});
