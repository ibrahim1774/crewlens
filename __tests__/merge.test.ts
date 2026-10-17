import { shouldOverwriteLocal } from '@/lib/jobs';

test('server rows never overwrite dirty local rows', () => {
  expect(shouldOverwriteLocal({ dirty: true } as never)).toBe(false);
  expect(shouldOverwriteLocal({ dirty: false } as never)).toBe(true);
  expect(shouldOverwriteLocal(null)).toBe(true);
});
