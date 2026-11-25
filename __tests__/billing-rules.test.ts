import {
  findDuplicate, isEntitledStatus, isTestAllowed, pickPortalRow, mergeTier, originAllowed, periodFromPriceId, planKey, rank, tierFromPriceId, trialDaysFor,
} from '../supabase/functions/_shared/billing-rules';

const env = {
  STRIPE_PRICE_SOLO_MONTHLY: 'p_sm', STRIPE_PRICE_SOLO_YEARLY: 'p_sy', STRIPE_PRICE_PRO_MONTHLY: 'p_pm',
  STRIPE_PRICE_PRO_YEARLY: 'p_py', STRIPE_PRICE_CREW_MONTHLY: 'p_cm', STRIPE_PRICE_CREW_YEARLY: 'p_cy',
};
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-12-01T00:00:00Z');

describe('billing rules', () => {
  it('ranks tiers', () => {
    expect(rank('crew')).toBeGreaterThan(rank('pro'));
    expect(rank('pro')).toBeGreaterThan(rank('solo'));
  });
  it('entitled statuses', () => {
    for (const s of ['active', 'trialing', 'past_due']) expect(isEntitledStatus(s)).toBe(true);
    for (const s of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'expired', '', null, undefined]) expect(isEntitledStatus(s as string)).toBe(false);
  });
  it('mergeTier takes the highest active row', () => {
    expect(mergeTier([{ tier: 'solo', status: 'active' }, { tier: 'crew', status: 'trialing' }, { tier: 'pro', status: 'active' }], NOW)).toBe('crew');
  });
  it('mergeTier: Apple lapsed + Stripe active keeps Stripe tier', () => {
    expect(mergeTier([{ tier: 'crew', status: 'expired' }, { tier: 'pro', status: 'active', current_period_end: '2027-01-01T00:00:00Z' }], NOW)).toBe('pro');
  });
  it('mergeTier ignores rows past period end plus 3 days of grace and falls back to solo', () => {
    expect(mergeTier([{ tier: 'pro', status: 'active', current_period_end: '2026-11-20T00:00:00Z' }], NOW)).toBe('solo');
    expect(mergeTier([{ tier: 'pro', status: 'active', current_period_end: NOW - 4 * DAY }], NOW)).toBe('solo');
    expect(mergeTier([], NOW)).toBe('solo');
  });
  it('mergeTier keeps access for 3 days after the period end (active, trialing, past_due)', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(mergeTier([{ tier: 'pro', status, current_period_end: NOW - 2 * DAY }], NOW)).toBe('pro');
    }
    expect(mergeTier([{ tier: 'pro', status: 'canceled', current_period_end: NOW - DAY }], NOW)).toBe('solo');
  });
  it('findDuplicate: apple or another stripe subscription, never the new one', () => {
    const live = '2027-01-01T00:00:00Z';
    expect(findDuplicate([], 'sub_new', NOW)).toBeNull();
    expect(findDuplicate([{ source: 'stripe', external_id: 'sub_new', status: 'active', current_period_end: live }], 'sub_new', NOW)).toBeNull();
    expect(findDuplicate([{ source: 'apple', external_id: 'a1', status: 'active', current_period_end: live }], 'sub_new', NOW)).toBe('apple');
    expect(findDuplicate([{ source: 'stripe', external_id: 'sub_old', status: 'trialing', current_period_end: live }], 'sub_new', NOW)).toBe('stripe');
    expect(findDuplicate([{ source: 'stripe', external_id: 'sub_old', status: 'canceled', current_period_end: live }, { source: 'apple', external_id: 'a1', status: 'expired' }], 'sub_new', NOW)).toBeNull();
    expect(findDuplicate([{ source: 'stripe', external_id: 'sub_old', status: 'active', current_period_end: NOW - 5 * DAY }], 'sub_new', NOW)).toBeNull();
    expect(findDuplicate([{ source: 'stripe', external_id: 'sub_old', status: 'active' }, { source: 'apple', external_id: 'a1', status: 'active' }], 'sub_new', NOW)).toBe('apple');
  });
  it('pickPortalRow prefers the newest active row, else the newest row', () => {
    const rows = [
      { id: 1, status: 'canceled', current_period_end: '2027-01-01T00:00:00Z' },
      { id: 2, status: 'active', current_period_end: '2027-01-01T00:00:00Z' },
      { id: 3, status: 'active', current_period_end: '2027-02-01T00:00:00Z' },
    ];
    expect(pickPortalRow(rows, NOW)?.id).toBe(2);
    expect(pickPortalRow([rows[0]], NOW)?.id).toBe(1);
    expect(pickPortalRow([], NOW)).toBeNull();
  });
  it('trial only on pro', () => {
    expect(trialDaysFor('pro')).toBe(3);
    expect(trialDaysFor('solo')).toBe(0);
    expect(trialDaysFor('crew')).toBe(0);
  });
  it('planKey names the env var', () => {
    expect(planKey('pro', 'yearly')).toBe('STRIPE_PRICE_PRO_YEARLY');
    expect(planKey('solo', 'monthly')).toBe('STRIPE_PRICE_SOLO_MONTHLY');
  });
  it('maps price ids back to tier and period', () => {
    expect(tierFromPriceId('p_cy', env)).toBe('crew');
    expect(periodFromPriceId('p_cy', env)).toBe('yearly');
    expect(tierFromPriceId('p_sm', env)).toBe('solo');
    expect(periodFromPriceId('p_pm', env)).toBe('monthly');
    expect(tierFromPriceId('nope', env)).toBeNull();
    expect(tierFromPriceId(undefined, env)).toBeNull();
    expect(periodFromPriceId(null, {})).toBeNull();
  });
  it('test-mode payments need an allowlisted user id; live always passes', () => {
    const u1 = '11111111-1111-1111-1111-111111111111';
    const u2 = '22222222-2222-2222-2222-222222222222';
    expect(isTestAllowed(u1, true, '')).toBe(true);
    expect(isTestAllowed(u1, false, '')).toBe(false);
    expect(isTestAllowed(u1.toUpperCase(), false, `${u2}, ${u1}`)).toBe(true);
    expect(isTestAllowed(u1, false, u2)).toBe(false);
    expect(isTestAllowed(null, false, u1)).toBe(false);
  });
  it('origin allow-list: exact and one wildcard pattern', () => {
    const csv = 'https://primehub.dev,https://prime-hub-ai-10-month-*-ibrahims-projects-e5ab879e.vercel.app';
    expect(originAllowed('https://primehub.dev', csv)).toBe(true);
    expect(originAllowed('https://prime-hub-ai-10-month-abc123-ibrahims-projects-e5ab879e.vercel.app', csv)).toBe(true);
    expect(originAllowed('https://evil.com', csv)).toBe(false);
    expect(originAllowed('https://primehub.dev.evil.com', csv)).toBe(false);
    expect(originAllowed('https://prime-hub-ai-10-month-a.evil.com/-ibrahims-projects-e5ab879e.vercel.app', csv)).toBe(false);
    expect(originAllowed(null, csv)).toBe(false);
    expect(originAllowed('https://primehub.dev', '')).toBe(false);
  });
});
