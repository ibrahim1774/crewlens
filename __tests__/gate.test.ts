import { routeFor } from '@/lib/gate';

test('no session goes to welcome', () => {
  expect(routeFor({ session: false, membershipChecked: false, company: false })).toBe('/(auth)/welcome');
});

test('signed in but membership not yet checked waits instead of sending to name', () => {
  expect(routeFor({ session: true, membershipChecked: false, company: false })).toBeNull();
});

test('signed in, checked, no company goes to name', () => {
  expect(routeFor({ session: true, membershipChecked: true, company: false })).toBe('/(auth)/name');
});

test('signed in with a company goes to tabs', () => {
  expect(routeFor({ session: true, membershipChecked: true, company: true })).toBe('/(tabs)');
  expect(routeFor({ session: true, membershipChecked: false, company: true })).toBe('/(tabs)');
});

test('first launch with no session goes to welcome, which offers the tour', () => {
  expect(routeFor({ session: false, membershipChecked: false, company: false, introSeen: false })).toBe('/(auth)/welcome');
  expect(routeFor({ session: false, membershipChecked: false, company: false, introSeen: null })).toBe('/(auth)/welcome');
});

test('no session after the tour was seen goes to welcome', () => {
  expect(routeFor({ session: false, membershipChecked: false, company: false, introSeen: true })).toBe('/(auth)/welcome');
});

test('a signed-in user never sees the tour again', () => {
  expect(routeFor({ session: true, membershipChecked: true, company: true, introSeen: false })).toBe('/(tabs)');
});

// Guests: "Get started" makes an account with no details, so the company and the purchase exist before sign-up.
test('a guest still answering questions goes back to them', () => {
  expect(routeFor({ session: true, guest: true, membershipChecked: true, company: false })).toBe('/(auth)/name');
  expect(routeFor({ session: true, guest: true, membershipChecked: false, company: false })).toBeNull();
});

test('a guest owner with a company goes to the plan step, which passes straight through once they have paid', () => {
  expect(routeFor({ session: true, guest: true, membershipChecked: true, company: true, owner: true })).toBe('/(auth)/paywall');
});

test('a guest who joined a crew goes to save their account, never to the paywall', () => {
  expect(routeFor({ session: true, guest: true, membershipChecked: true, company: true, owner: false })).toBe('/(auth)/save');
});

test('a saved account with a company always goes to the tabs', () => {
  expect(routeFor({ session: true, guest: false, membershipChecked: true, company: true, owner: true })).toBe('/(tabs)');
});
