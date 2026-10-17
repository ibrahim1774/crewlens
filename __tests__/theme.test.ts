import { Colors, Radius } from '@/constants/theme';

test('exactly one action colour in the palette', () => {
  const oranges = Object.values(Colors).filter((c) => c === '#E8521E');
  expect(oranges).toHaveLength(1);
});

test('no pill radii on cards', () => {
  expect(Radius.card).toBeLessThanOrEqual(8);
  expect(Radius.chip).toBeLessThanOrEqual(2);
});
