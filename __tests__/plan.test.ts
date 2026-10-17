import { effectiveTier, limitsFor } from '@/lib/plan';

test('with the paywall flag off every company is treated as pro', () => {
  expect(effectiveTier(null, false, false)).toBe('pro');
  expect(effectiveTier('solo', false, false)).toBe('solo');
});

test('with the paywall on and no entitlement the user is on solo limits', () => {
  expect(effectiveTier('crew', false, true)).toBe('solo');
  expect(effectiveTier('crew', true, true)).toBe('crew');
  expect(effectiveTier(null, true, true)).toBe('solo');
});

test('limits come from the plan table', () => {
  expect(limitsFor('solo').activeJobs).toBe(25);
  expect(limitsFor('crew').videoMaxS).toBe(120);
});
