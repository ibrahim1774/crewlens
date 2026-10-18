import { Colors, Fonts, Radius } from '@/constants/theme';

test('black and white with exactly one warning red', () => {
  expect(Colors.flag).toBe(Colors.ink);
  const reds = Object.values(Colors).filter((c) => c === '#D92D20');
  expect(reds).toHaveLength(1);
  expect(Colors.surface).toBe('#FFFFFF');
});

test('soft cards and pill buttons', () => {
  expect(Radius.card).toBeGreaterThanOrEqual(16);
  expect(Radius.pill).toBeGreaterThanOrEqual(999);
});

test('the evidence stamp keeps its monospace face while the UI uses Figtree', () => {
  expect(Fonts.mono).toMatch(/Mono/);
  expect(Fonts.body).toMatch(/^Figtree_/);
  expect(Fonts.heading).toMatch(/^Figtree_/);
});
