import { registersAt } from '@/constants/onboarding';

test('registration counts once per person: at save for guests, at the company for people who signed in first', () => {
  expect(registersAt({ step: 'company', guest: true })).toBe(false);
  expect(registersAt({ step: 'save', guest: true })).toBe(true);
  expect(registersAt({ step: 'company', guest: false })).toBe(true);
});
