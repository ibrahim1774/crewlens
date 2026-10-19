export type GateRoute = '/(auth)/intro' | '/(auth)/welcome' | '/(auth)/name' | '/(auth)/paywall' | '/(auth)/save' | '/(tabs)' | null;

/**
 * Where a launch should land. Returns null while a signed-in user's membership is still being
 * checked. Signed-out launches always land on welcome; the product tour is opened from there.
 * A guest (the account "Get started" makes with no details) finishes onboarding before the tabs:
 * an owner goes to the plan step, which passes straight through once they have paid, then to saving
 * the account; a guest who joined a crew skips the plan and saves the account.
 * `introSeen` is accepted for callers that track the tour but no longer changes the route.
 */
export function routeFor(s: { session: boolean; guest?: boolean; membershipChecked: boolean; company: boolean; owner?: boolean; introSeen?: boolean | null }): GateRoute {
  if (!s.session) return '/(auth)/welcome';
  if (s.company) {
    if (!s.guest) return '/(tabs)';
    return s.owner === false ? '/(auth)/save' : '/(auth)/paywall';
  }
  if (!s.membershipChecked) return null;
  return '/(auth)/name';
}
