import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { BENEFITS } from '@/constants/benefits';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

/** Between the welcome video and sign-in: why crews use it, one row per benefit, landing one by one. */
export default function Benefits() {
  useEffect(() => {
    track('onboarding_step', { step: 'benefits' });
  }, []);

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={() => router.push('/(auth)/sign-in')} testID="benefits-continue" />
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
