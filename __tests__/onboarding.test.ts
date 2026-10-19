import { costReport, HEADACHES, PHOTO_HOMES } from '@/lib/cost';
import { stepLabel } from '@/constants/onboarding';

test('steps count in order and the total matches the flow', () => {
  expect(stepLabel('name')).toBe('Step 1 of 11');
  expect(stepLabel('paywall')).toBe('Step 7 of 11');
  expect(stepLabel('save')).toBe('Step 8 of 11');
  expect(stepLabel('share-docs')).toBe('Step 11 of 11');
});

test('hours spent hunting for photos scale with the crew they told us about', () => {
  expect(costReport({ crew: 'Just me' }).hoursPerMonth).toBe(4);
  expect(costReport({ crew: '2–5' }).hoursPerMonth).toBe(11);
  expect(costReport({ crew: '6–15' }).hoursPerMonth).toBe(37);
  expect(costReport({ crew: '16+' }).hoursPerMonth).toBe(59);
  expect(costReport({}).hoursPerMonth).toBe(4); // skipped: assume one person, never inflate
});

test('the pain and the fix follow their answers, with the headache first', () => {
  const r = costReport({ crew: '2–5', photoHome: 'Group texts', headache: 'Getting paid on time' });
  expect(r.pains[0]).toMatch(/text threads/);
  expect(r.fixes[0].title).toBe('Get paid faster');
  expect(r.fixes).toHaveLength(3);
  expect(new Set(r.fixes.map((f) => f.title)).size).toBe(3);
});

test('every answer has its own pain line and fix', () => {
  for (const home of PHOTO_HOMES) expect(costReport({ photoHome: home }).pains[0].length).toBeGreaterThan(10);
  const firstFixes = HEADACHES.map((h) => costReport({ headache: h }).fixes[0].title);
  expect(new Set(firstFixes).size).toBe(HEADACHES.length);
});

import { registersAt } from '@/constants/onboarding';

test('registration counts once per person: at save for guests, at the company for people who signed in first', () => {
  expect(registersAt({ step: 'company', guest: true })).toBe(false);
  expect(registersAt({ step: 'save', guest: true })).toBe(true);
  expect(registersAt({ step: 'company', guest: false })).toBe(true);
});
