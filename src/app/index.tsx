import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useCompany, useMembershipChecked } from '@/lib/company';
import { routeFor } from '@/lib/gate';
import { useIntroSeen } from '@/lib/intro';

/** Routing gate. Waits for the membership check so a returning user is never sent to "create a company". */
export default function Index() {
  const { session } = useSession();
  const company = useCompany();
  const checked = useMembershipChecked();
  const introSeen = useIntroSeen();
  const route = routeFor({ session: !!session, membershipChecked: checked, company: !!company, introSeen });
  if (!route) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', gap: Space.sm }}>
        <ActivityIndicator color={Colors.slate} />
        <Mono>{session ? 'Finding your company…' : 'Loading…'}</Mono>
      </View>
    );
  }
  return <Redirect href={route} />;
}
