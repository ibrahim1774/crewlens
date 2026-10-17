import { clampSlide, INTRO_SLIDES } from '@/lib/intro';

test('the tour is exactly ten screens with unique keys and titles', () => {
  expect(INTRO_SLIDES).toHaveLength(10);
  expect(new Set(INTRO_SLIDES.map((s) => s.key)).size).toBe(10);
  expect(new Set(INTRO_SLIDES.map((s) => s.title)).size).toBe(10);
});

test('every slide has an image and copy that fits the screen', () => {
  for (const s of INTRO_SLIDES) {
    expect(s.image).toBeDefined();
    expect(s.eyebrow).toMatch(/^[A-Z0-9 \-·]+$/);
    expect(s.title.length).toBeLessThanOrEqual(52);
    expect(s.body.length).toBeLessThanOrEqual(150);
  }
});

test('only the problem slide has no stamp, and it says why', () => {
  const withoutStamp = INTRO_SLIDES.filter((s) => s.stamp === null);
  expect(withoutStamp.map((s) => s.key)).toEqual(['problem']);
  expect(withoutStamp[0].stampNote).toBe('NO JOB · NO TIME · NO PROOF');
});

test('clampSlide keeps a swipe index on a real slide', () => {
  expect(clampSlide(-1)).toBe(0);
  expect(clampSlide(3.4)).toBe(3);
  expect(clampSlide(3.6)).toBe(4);
  expect(clampSlide(42)).toBe(9);
  expect(clampSlide(Number.NaN)).toBe(0);
});
