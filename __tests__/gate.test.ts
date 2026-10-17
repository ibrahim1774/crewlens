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
