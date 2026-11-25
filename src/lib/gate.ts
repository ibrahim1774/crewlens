export type GateRoute = '/(auth)/intro' | '/(auth)/welcome' | '/(auth)/name' | '/(auth)/paywall' | '/(auth)/save' | '/(tabs)' | null;

/**
 * Where a launch should land. Returns null while a signed-in user's membership is still being
 * checked. Signed-out launches always land on welcome; the product tour is opened from there.
 * A guest (the account "Get started" makes with no details) finishes onboarding before the tabs:
 * an owner goes to the plan step, which passes straight through once they have paid, then to saving
 * the account; a guest who joined a crew skips the plan and saves the account.
 * With the paywall on, a saved owner with no active plan (Superwall or server) goes to the plan step too, so signing in
 * with Apple or Google and quitting before paying does not leave the app open. `entitled` null means not known yet: never
 * route to the paywall on a guess. Members of a company are never sent to the paywall.
 * `introSeen` is accepted for callers that track the tour but no longer changes the route.
 */
export function routeFor(s: { session: boolean; guest?: boolean; membershipChecked: boolean; company: boolean; owner?: boolean; entitled?: boolean | null; introSeen?: boolean | null }): GateRoute {
  if (!s.session) return '/(auth)/welcome';
  if (s.company) {
    if (!s.guest) return s.owner === true && s.entitled === false ? '/(auth)/paywall' : '/(tabs)';
    return s.owner === false ? '/(auth)/save' : '/(auth)/paywall';
  }
  if (!s.membershipChecked) return null;
  return '/(auth)/name';
}

export type PlanStatus = 'active' | 'inactive' | 'unknown';

/**
 * Whether the signed-in owner has paid. `entitled` false ONLY when every source that could hold a plan has said
 * "no": Superwall (the App Store) explicitly reported INACTIVE (or is not running at all) AND the server answered
 * inactive. Anything still unknown stays null (the gate lets them in); `waiting` is true only until the 3 s timeout.
 */
export function decideEntitled(i: { paywallEnabled: boolean; superwallActive: boolean; superwall: PlanStatus; server: PlanStatus; web: boolean; timedOut: boolean }): { entitled: boolean | null; waiting: boolean } {
  if (!i.paywallEnabled || i.web || i.superwall === 'active' || i.server === 'active') return { entitled: true, waiting: false };
  const superwallNo = !i.superwallActive || i.superwall === 'inactive';
  if (superwallNo && i.server === 'inactive') return { entitled: false, waiting: false };
  return { entitled: null, waiting: !i.timedOut };
}
