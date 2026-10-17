import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { meta } from '@/lib/db';
import { superwallActive, usePaywall } from '@/lib/paywall';

async function finish() {
  await meta.set('onboarded', '1');
  router.replace('/(tabs)');
}

/** With Superwall active this registers the onboarding placement; the feature callback is the gate. */
function SuperwallGate() {
  const show = usePaywall();
  useEffect(() => {
    show('onboarding_complete', () => {
      void finish();
    });
  }, [show]);
  return (
    <Screen footer={<Button title="Show plans" onPress={() => show('onboarding_complete', () => void finish())} />}>
      <View style={{ flex: 1, justifyContent: 'center', gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>PLANS</Mono>
        <Heading size={34} bold>Pick a plan to start.</Heading>
        <Body color={Colors.ink2}>Solo, Pro with a 3-day free trial, or Crew for teams.</Body>
      </View>
    </Screen>
  );
}

/** Until the paywall is designed, onboarding ends here on Pro limits. */
function PlaceholderGate() {
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

export default function PaywallGate() {
  useEffect(() => {
    track('onboarding_step', { step: 'paywall', superwall: superwallActive });
  }, []);
  return superwallActive ? <SuperwallGate /> : <PlaceholderGate />;
}
