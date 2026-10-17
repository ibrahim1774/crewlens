export type GateRoute = '/(auth)/intro' | '/(auth)/welcome' | '/(auth)/name' | '/(tabs)' | null;

/**
 * Where a launch should land. Returns null while a signed-in user's membership is still being
 * checked. Signed-out launches always land on welcome; the product tour is opened from there.
 * `introSeen` is accepted for callers that track the tour but no longer changes the route.
 */
export function routeFor(s: { session: boolean; membershipChecked: boolean; company: boolean; introSeen?: boolean | null }): GateRoute {
  if (!s.session) return '/(auth)/welcome';
  if (s.company) return '/(tabs)';
  if (!s.membershipChecked) return null;
  return '/(auth)/name';
}
