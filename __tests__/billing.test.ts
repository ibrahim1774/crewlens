const mockStore = new Map<string, string>();
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
let mockRpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockRpc = jest.fn(async () => mockRpcResult);

jest.mock('@/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: mockSession } }) },
    rpc: (...a: unknown[]) => (mockRpc as unknown as (...x: unknown[]) => unknown)(...a),
  },
}));
jest.mock('@/lib/db', () => ({
  meta: {
    getJSON: async (k: string) => (mockStore.has(k) ? JSON.parse(mockStore.get(k) as string) : null),
    setJSON: async (k: string, v: unknown) => void mockStore.set(k, JSON.stringify(v)),
  },
}));

import { __resetBillingForTests, billingAnswer, billingSettled, setBillingUser, billingSource, openUpgrade, refreshEntitlement, serverEntitled, webEntitled } from '@/lib/billing';

const stripe = { active: true, source: 'stripe', tier: 'pro', status: 'active', period_end: '2027-01-01T00:00:00Z', cancel_at_period_end: false };
const apple = { ...stripe, source: 'apple' };

beforeEach(() => {
  mockStore.clear();
  mockSession = { user: { id: 'u1' } };
  mockRpcResult = { data: null, error: null };
  mockRpc.mockClear();
  __resetBillingForTests();
});

test('a stripe subscription is web and server entitled', async () => {
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  expect(webEntitled()).toBe(true);
  expect(serverEntitled()).toBe(true);
  expect(billingSource()).toBe('stripe');
  expect(billingSettled()).toBe(true);
});

test('an apple subscription is server entitled but not web entitled', async () => {
  mockRpcResult = { data: apple, error: null };
  await refreshEntitlement();
  expect(webEntitled()).toBe(false);
  expect(serverEntitled()).toBe(true);
  expect(billingSource()).toBe('apple');
});

test('an inactive answer entitles nothing', async () => {
  mockRpcResult = { data: { active: false, source: null }, error: null };
  await refreshEntitlement();
  expect(serverEntitled()).toBe(false);
  expect(billingSource()).toBeNull();
});

test('an error keeps the last value', async () => {
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  mockRpcResult = { data: null, error: { message: 'offline' } };
  await refreshEntitlement();
  expect(webEntitled()).toBe(true);
});

test('no mockSession skips the server call', async () => {
  mockSession = null;
  await refreshEntitlement();
  expect(mockRpc).not.toHaveBeenCalled();
  expect(serverEntitled()).toBe(false);
});

test('a cold offline launch reads the cached answer for the same account', async () => {
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  __resetBillingForTests();
  mockRpcResult = { data: null, error: { message: 'offline' } };
  await refreshEntitlement();
  expect(webEntitled()).toBe(true);
});

test('a cached answer for another account is ignored', async () => {
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  __resetBillingForTests();
  mockSession = { user: { id: 'u2' } };
  mockRpcResult = { data: null, error: { message: 'offline' } };
  await refreshEntitlement();
  expect(webEntitled()).toBe(false);
});

test('upgrade opens the paywall unless the plan is billed on the web', async () => {
  const open = jest.fn();
  openUpgrade(open);
  expect(open).toHaveBeenCalledTimes(1);
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  openUpgrade(open);
  expect(open).toHaveBeenCalledTimes(1);
});

test('an RPC error leaves the answer unknown, never inactive', async () => {
  mockRpcResult = { data: null, error: { message: 'offline' } };
  await refreshEntitlement();
  expect(billingAnswer('u1')).toBe('unknown');
  expect(billingSettled()).toBe(true);
});

test('an answer is only visible for the account it belongs to', async () => {
  mockRpcResult = { data: { active: false, source: null }, error: null };
  await refreshEntitlement();
  expect(billingAnswer('u1')).toBe('inactive');
  expect(billingAnswer('u2')).toBe('unknown');
});

test('signing in from signed-out resets to unknown with a fresh ready promise', async () => {
  mockSession = null;
  await refreshEntitlement();
  expect(billingSettled()).toBe(true);
  const before = require('@/lib/billing').billingReady;
  setBillingUser('u1');
  expect(billingSettled()).toBe(false);
  expect(billingAnswer('u1')).toBe('unknown');
  expect(require('@/lib/billing').billingReady).not.toBe(before);
  mockSession = { user: { id: 'u1' } };
  mockRpcResult = { data: { active: false, source: null }, error: null };
  await refreshEntitlement();
  expect(billingSettled()).toBe(true);
  expect(billingAnswer('u1')).toBe('inactive');
});

test('switching accounts drops the old answer until the new refresh finishes', async () => {
  mockRpcResult = { data: stripe, error: null };
  await refreshEntitlement();
  expect(billingAnswer('u1')).toBe('active');
  setBillingUser('u2');
  expect(billingAnswer('u1')).toBe('unknown');
  expect(billingAnswer('u2')).toBe('unknown');
  expect(serverEntitled()).toBe(false);
  expect(billingSettled()).toBe(false);
});
