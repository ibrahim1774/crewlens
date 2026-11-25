import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { isGuest, useSession } from '@/lib/auth';
import { useCompany, useMember, useMembershipChecked } from '@/lib/company';
import { routeFor } from '@/lib/gate';
import { useIntroSeen } from '@/lib/intro';
import { useEntitledState } from '@/lib/paywall';

/** Routing gate. Waits for the membership check so a returning user is never sent to "create a company". */
export default function Index() {
  const { session } = useSession();
  const company = useCompany();
  const member = useMember();
  const checked = useMembershipChecked();
  const introSeen = useIntroSeen();
  const { entitled, waiting: planWaiting } = useEntitledState();
  const owner = member ? member.role === 'owner' : undefined;
  const guest = isGuest(session);
  const route = routeFor({ session: !!session, membershipChecked: checked, guest, company: !!company, owner, entitled, introSeen });
  // A saved owner whose plan is still being checked waits here (at most about 3 s) rather than flashing the tabs or the paywall.
  const waiting = !!session && !guest && !!company && owner === true && planWaiting;
  if (!route || waiting) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', gap: Space.sm }}>
        <ActivityIndicator color={Colors.slate} />
        <Mono>{session ? 'Finding your company…' : 'Loading…'}</Mono>
      </View>
    );
  }
  // Sent to the plan step by the gate, not by onboarding: after paying they go to the tabs.
  if (route === '/(auth)/paywall' && !guest) return <Redirect href={{ pathname: '/(auth)/paywall', params: { gate: '1' } }} />;
  return <Redirect href={route} />;
}
