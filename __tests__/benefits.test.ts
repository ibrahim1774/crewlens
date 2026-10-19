import { BENEFITS } from '@/constants/benefits';

test('five benefits, each short enough to read at a glance', () => {
  expect(BENEFITS).toHaveLength(5);
  for (const b of BENEFITS) {
    expect(b.title.length).toBeLessThanOrEqual(32);
    expect(b.body.length).toBeLessThanOrEqual(48);
    expect(b.body.endsWith('.')).toBe(true);
  }
});
