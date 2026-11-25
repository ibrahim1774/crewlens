import { decideEntitled, routeFor } from '@/lib/gate';

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

// Web checkout loophole: a saved owner with no active plan must not get the app for free.
const owner = { session: true, guest: false, membershipChecked: true, company: true, owner: true } as const;

test('a saved owner who has not paid goes to the paywall', () => {
  expect(routeFor({ ...owner, entitled: false })).toBe('/(auth)/paywall');
});

test('a saved owner who has paid, or whose status is unknown, goes to the tabs', () => {
  expect(routeFor({ ...owner, entitled: true })).toBe('/(tabs)');
  expect(routeFor({ ...owner, entitled: null })).toBe('/(tabs)');
  expect(routeFor({ ...owner })).toBe('/(tabs)');
});

test('a member is never sent to the paywall', () => {
  expect(routeFor({ ...owner, owner: false, entitled: false })).toBe('/(tabs)');
});

test('a guest is unchanged by entitlement', () => {
  expect(routeFor({ ...owner, guest: true, entitled: false })).toBe('/(auth)/paywall');
  expect(routeFor({ ...owner, guest: true, owner: false, entitled: false })).toBe('/(auth)/save');
});

test('a signed-in user with no company still starts at name', () => {
  expect(routeFor({ session: true, guest: false, membershipChecked: true, company: false, entitled: false })).toBe('/(auth)/name');
});

describe('decideEntitled', () => {
  const base = { paywallEnabled: true, superwallActive: true, superwall: 'unknown', server: 'unknown', web: false, timedOut: false } as const;
  test('paid anywhere is entitled', () => {
    expect(decideEntitled({ ...base, superwall: 'active', server: 'inactive' }).entitled).toBe(true);
    expect(decideEntitled({ ...base, server: 'active' }).entitled).toBe(true);
    expect(decideEntitled({ ...base, web: true }).entitled).toBe(true);
    expect(decideEntitled({ ...base, paywallEnabled: false }).entitled).toBe(true);
  });
  test('unpaid only when Superwall said inactive AND the server said inactive', () => {
    expect(decideEntitled({ ...base, superwall: 'inactive', server: 'inactive' })).toEqual({ entitled: false, waiting: false });
    expect(decideEntitled({ ...base, superwallActive: false, server: 'inactive' }).entitled).toBe(false);
  });
  test('an Apple payer whose Superwall status is still unknown after 3 s is never unpaid', () => {
    expect(decideEntitled({ ...base, server: 'inactive', timedOut: true })).toEqual({ entitled: null, waiting: false });
    expect(decideEntitled({ ...base, superwall: 'inactive', server: 'unknown', timedOut: true })).toEqual({ entitled: null, waiting: false });
    expect(routeFor({ ...owner, entitled: decideEntitled({ ...base, server: 'inactive', timedOut: true }).entitled })).toBe('/(tabs)');
  });
  test('waits until the timeout while unknown', () => {
    expect(decideEntitled({ ...base, server: 'inactive' })).toEqual({ entitled: null, waiting: true });
  });
});
