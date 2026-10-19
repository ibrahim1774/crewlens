import { stepLabel } from '@/constants/onboarding';
import { HEADACHES, PHOTO_HOMES } from '@/constants/pains';

test('steps count in order: questions, the plan, the account, then permissions once they have paid', () => {
  expect(stepLabel('name')).toBe('Step 1 of 10');
  expect(stepLabel('pains')).toBe('Step 4 of 10');
  expect(stepLabel('paywall')).toBe('Step 5 of 10');
  expect(stepLabel('save')).toBe('Step 6 of 10');
  expect(stepLabel('permissions')).toBe('Step 7 of 10');
  expect(stepLabel('share-docs')).toBe('Step 10 of 10');
});

test('the pain answers are short and distinct', () => {
  for (const list of [PHOTO_HOMES, HEADACHES]) {
    expect(new Set(list).size).toBe(list.length);
    for (const o of list) expect(o.length).toBeLessThanOrEqual(26);
  }
});

import { registersAt } from '@/constants/onboarding';

test('registration counts once per person: at save for guests, at the company for people who signed in first', () => {
  expect(registersAt({ step: 'company', guest: true })).toBe(false);
  expect(registersAt({ step: 'save', guest: true })).toBe(true);
  expect(registersAt({ step: 'company', guest: false })).toBe(true);
});
