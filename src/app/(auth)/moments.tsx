import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { MOMENTS, type Moment, type MomentId } from '@/constants/moments';
import { Colors, Radius, Space } from '@/constants/theme';
import { identify, track } from '@/lib/analytics';
import { meta } from '@/lib/db';

function Row({ m, on, onPress, i }: { m: Moment; on: boolean; onPress: () => void; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(100 + i * 70).duration(300)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        testID={`moment-${m.id}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: Space.md,
          paddingHorizontal: Space.md,
          paddingVertical: 18,
          borderRadius: Radius.card,
          borderWidth: on ? 2 : 1,
          borderColor: on ? Colors.ink : Colors.hairline,
          backgroundColor: Colors.surface,
          opacity: pressed ? 0.85 : 1,
        })}>
        <SymbolView name={m.icon as never} size={20} tintColor={Colors.ink} />
        <Body size={16} bold style={{ flex: 1 }}>{m.label}</Body>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: on ? 0 : 1.5,
            borderColor: Colors.hairline,
            backgroundColor: on ? Colors.flag : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {on ? <SymbolView name="checkmark" size={13} weight="bold" tintColor={Colors.surface} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** "What slows you down?": five everyday moments, picked in order. Each one gets a short scene of the fix next. */
export default function Moments() {
  const [picked, setPicked] = useState<MomentId[]>([]);

  useEffect(() => {
    track('onboarding_step', { step: 'moments' });
    meta.get('profile_moments').then((saved) => {
      const known = new Set(MOMENTS.map((m) => m.id));
      if (saved) setPicked((saved.split(',') as MomentId[]).filter((id) => known.has(id)));
    });
  }, []);

  const toggle = (id: MomentId) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const next = async () => {
    await meta.set('profile_moments', picked.join(','));
    identify({ moments: picked.join(',') });
    track('moments_saved', { moments: picked.join(','), count: picked.length });
    router.push({ pathname: '/(auth)/scene', params: { i: '0' } });
  };

  return (
    <Screen
      footer={
        <Button title="Continue" onPress={next} disabled={!picked.length} testID="moments-continue" />
      }>
      <View style={{ gap: Space.sm }}>
        <Heading size={34} bold style={{ marginTop: Space.lg }}>What slows you down?</Heading>
        <Body color={Colors.ink2}>Pick all that apply. We&apos;ll show you how Crew Lens fixes each one.</Body>
      </View>
      <View style={{ gap: Space.sm }}>
        {MOMENTS.map((m, i) => (
          <Row key={m.id} m={m} i={i} on={picked.includes(m.id)} onPress={() => toggle(m.id)} />
        ))}
      </View>
    </Screen>
  );
}
