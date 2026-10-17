export type GateRoute = '/(auth)/welcome' | '/(auth)/name' | '/(tabs)' | null;

/**
 * Where a launch should land. Returns null while a signed-in user's membership is still being
 * checked, so a returning user is never bounced into "create a company".
 */
export function routeFor(s: { session: boolean; membershipChecked: boolean; company: boolean }): GateRoute {
  if (!s.session) return '/(auth)/welcome';
  if (s.company) return '/(tabs)';
  if (!s.membershipChecked) return null;
  return '/(auth)/name';
}
