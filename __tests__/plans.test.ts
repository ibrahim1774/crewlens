import { ctaLabel, documentsIncluded, FEATURES, PLANS, priceLabel, productId, yearlySavingPct } from '@/constants/plans';

test('three plans at the approved prices, Pro highlighted with the only trial', () => {
  expect(PLANS.map((p) => [p.tier, p.monthly, p.yearly])).toEqual([
    ['solo', 9.99, 79.99],
    ['pro', 19.99, 159.99],
    ['crew', 49.99, 399.99],
  ]);
  expect(PLANS.filter((p) => p.highlight).map((p) => p.tier)).toEqual(['pro']);
  expect(PLANS.filter((p) => p.trialDays > 0).map((p) => [p.tier, p.trialDays])).toEqual([['pro', 3]]);
});

test('documents and invoices are a Pro and Crew feature and the flagship row', () => {
  const row = FEATURES.find((f) => f.flagship);
  expect(row?.label).toBe('Documents & invoices');
  expect(row?.values[0]).toBe('—');
  expect(documentsIncluded('solo')).toBe(false);
  expect(documentsIncluded('pro')).toBe(true);
  expect(documentsIncluded('crew')).toBe(true);
});

test('labels and product ids follow the store naming', () => {
  expect(productId('pro', 'yearly')).toBe('com.ibrahim1774.crewlens.pro.yearly');
  expect(priceLabel(PLANS[1], 'monthly')).toBe('$19.99/mo');
  expect(priceLabel(PLANS[1], 'yearly')).toBe('$159.99/yr');
  expect(ctaLabel(PLANS[1])).toBe('Start 3-day free trial');
  expect(ctaLabel(PLANS[0])).toBe('Continue with Solo');
  expect(yearlySavingPct(PLANS[1])).toBe(33);
});

test('the plans table never prices something the store cannot sell', () => {
  for (const row of FEATURES) for (const v of row.values) expect(v).not.toMatch(/\$/);
});
