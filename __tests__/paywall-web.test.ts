const mockRegister = jest.fn(async () => {});
let mockEntitlement: unknown = { active: true, source: 'stripe', tier: 'pro' };

jest.mock('expo-superwall', () => ({
  usePlacement: () => ({ registerPlacement: mockRegister }),
  useSuperwallEvents: () => {},
  useUser: () => ({ subscriptionStatus: { status: 'INACTIVE' }, identify: async () => {} }),
  useSuperwall: () => ({ restorePurchases: async () => ({}) }),
}));
jest.mock('@/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async (name: string) => (name === 'my_entitlement' ? { data: mockEntitlement, error: null } : { data: 'alias', error: null }),
  },
}));
jest.mock('@/lib/db', () => ({ meta: { getJSON: async () => null, setJSON: async () => {} } }));

type PaywallModule = typeof import('@/lib/paywall');
type BillingModule = typeof import('@/lib/billing');
let paywall: PaywallModule;
let billing: BillingModule;

beforeAll(() => {
  process.env.EXPO_PUBLIC_PAYWALL_ENABLED = 'true';
  process.env.EXPO_PUBLIC_SUPERWALL_API_KEY = 'pk_test';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  paywall = require('@/lib/paywall');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  billing = require('@/lib/billing');
});

beforeEach(() => {
  mockRegister.mockClear();
  billing.__resetBillingForTests();
});

test('a web-entitled account skips Superwall and gets access', async () => {
  expect(paywall.superwallActive).toBe(true);
  await billing.refreshEntitlement();
  expect(paywall.hasEntitlement()).toBe(true);
  const show = paywall.usePaywall();
  const onAccess = jest.fn();
  await show('upgrade_tapped', onAccess);
  expect(onAccess).toHaveBeenCalledTimes(1);
  expect(mockRegister).not.toHaveBeenCalled();
});

test('an account with no web plan still opens Superwall', async () => {
  mockEntitlement = { active: false, source: null };
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000); // past the 2 s repeat guard
  await billing.refreshEntitlement();
  expect(paywall.hasEntitlement()).toBe(false);
  const show = paywall.usePaywall();
  await show('onboarding_complete', jest.fn());
  expect(mockRegister).toHaveBeenCalledTimes(1);
});
