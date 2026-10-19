import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { momentsFor, type Moment, type MomentId } from '@/constants/moments';
import { stepLabel } from '@/constants/onboarding';
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
          paddingVertical: 12,
          borderRadius: Radius.card,
          borderWidth: on ? 2 : 1,
          borderColor: on ? Colors.ink : Colors.hairline,
          backgroundColor: Colors.surface,
          opacity: pressed ? 0.85 : 1,
        })}>
        <SymbolView name={m.icon as never} size={20} tintColor={Colors.ink} />
        <Body size={15} bold style={{ flex: 1 }}>{m.label}</Body>
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

/** "Has this happened to you?": everyday moments, picked in order. Each one gets a short scene of the fix next. */
export default function Moments() {
  const [list, setList] = useState<Moment[]>([]);
  const [picked, setPicked] = useState<MomentId[]>([]);

  useEffect(() => {
    track('onboarding_step', { step: 'moments' });
    Promise.all([meta.get('profile_crew'), meta.get('profile_moments')]).then(([crew, saved]) => {
      setList(momentsFor({ crew }));
      if (saved) setPicked(saved.split(',') as MomentId[]);
    });
  }, []);

  const toggle = (id: MomentId) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const next = async (none: boolean) => {
    const chosen = none ? [] : picked;
    await meta.set('profile_moments', chosen.join(','));
    identify({ moments: chosen.join(',') || null });
    track(none ? 'moments_none' : 'moments_saved', { moments: chosen.join(','), count: chosen.length });
    router.push({ pathname: '/(auth)/scene', params: { i: '0' } });
  };

  return (
    <Screen
      footer={
        <>
          <Button title={picked.length ? `Show me how (${picked.length})` : 'Pick any that sound familiar'} onPress={() => next(false)} disabled={!picked.length} testID="moments-continue" />
          <Button title="None of these" variant="ghost" onPress={() => next(true)} testID="moments-none" />
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('moments')}</Mono>
        <Heading size={30} bold>Has this happened to you?</Heading>
        <Body color={Colors.ink2}>Pick as many as you like. We&apos;ll show you how Crew Lens handles each one.</Body>
      </View>
      <View style={{ gap: 6 }}>
        {list.map((m, i) => (
          <Row key={m.id} m={m} i={i} on={picked.includes(m.id)} onPress={() => toggle(m.id)} />
        ))}
      </View>
    </Screen>
  );
}
