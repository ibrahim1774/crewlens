export type GateRoute = '/(auth)/intro' | '/(auth)/welcome' | '/(auth)/name' | '/(tabs)' | null;

/**
 * Where a launch should land. Returns null while something is still being decided:
 * a signed-in user's membership check, or whether a signed-out launch has seen the tour.
 * `introSeen` is null until the local flag is read; callers that never show the tour omit it.
 */
export function routeFor(s: { session: boolean; membershipChecked: boolean; company: boolean; introSeen?: boolean | null }): GateRoute {
  if (!s.session) {
    if (s.introSeen === null) return null;
    return s.introSeen === false ? '/(auth)/intro' : '/(auth)/welcome';
  }
  if (s.company) return '/(tabs)';
  if (!s.membershipChecked) return null;
  return '/(auth)/name';
}
