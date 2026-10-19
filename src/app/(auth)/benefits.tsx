import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { BENEFITS } from '@/constants/benefits';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { startGuest } from '@/lib/auth';

/** Between the welcome video and the questions: why crews use it, one row per benefit, landing one by one. */
export default function Benefits() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    track('onboarding_step', { step: 'benefits' });
  }, []);

  // A guest account, no details asked: the questions, company and plan hang off it, and the phone number comes last.
  const next = async () => {
    setBusy(true);
    try {
      await startGuest();
      router.push('/(auth)/name');
    } catch {
      Alert.alert('No connection', 'Crew Lens needs the internet to set up your account. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={next} loading={busy} testID="benefits-continue" />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <Heading size={34} bold style={{ marginTop: Space.lg }}>
        {'Why crews use\nCrew Lens'}
      </Heading>
      <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, overflow: 'hidden' }}>
        {BENEFITS.map((b, i) => (
          <Animated.View
            key={b.title}
            entering={FadeInDown.delay(150 + i * 120).duration(350)}
            style={{ flexDirection: 'row', gap: Space.md, padding: Space.md, borderTopWidth: i ? 1 : 0, borderColor: Colors.hairline }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.flag, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <SymbolView name="checkmark" size={14} weight="bold" tintColor={Colors.surface} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Heading size={18} bold>{b.title}</Heading>
              <Body size={15} color={Colors.ink2}>{b.body}</Body>
            </View>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
