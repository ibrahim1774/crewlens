import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { meta } from '@/lib/db';
import { paywallEnabled } from '@/lib/plan';

/**
 * Placeholder until the Superwall paywall is designed. With the flag off this screen
 * just marks onboarding complete. With the flag on, Task 13 wires the placement here.
 */
export default function PaywallGate() {
  useEffect(() => {
    track('onboarding_step', { step: 'paywall', enabled: paywallEnabled });
  }, []);

  const finish = async () => {
    await meta.set('onboarded', '1');
    router.replace('/(tabs)');
  };

  return (
    <Screen footer={<Button title="Start using Crew Lens" onPress={finish} />}>
      <View style={{ flex: 1, justifyContent: 'center', gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>PLANS</Mono>
        <Heading size={34} bold>You are on Pro while we finish plans.</Heading>
        <Body color={Colors.ink2}>100 active jobs, 250 photos per job, video and live share links. Pricing arrives in the next update.</Body>
      </View>
    </Screen>
  );
}
