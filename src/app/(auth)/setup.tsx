import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { MOMENTS, fixFor, type Moment, type MomentId } from '@/constants/moments';
import { Colors, Radius, Space } from '@/constants/theme';
import { requestTrackingThenStart, track } from '@/lib/analytics';
import { useCompany } from '@/lib/company';
import { meta } from '@/lib/db';

/** Shown if the picks are missing (an older install): the three things Crew Lens is for. */
const DEFAULT: MomentId[] = ['camera_roll', 'sending', 'invoice'];

/** "Your Crew Lens": each thing they picked next to the feature that handles it, then the plans. */
export default function Setup() {
  const company = useCompany();
  const [rows, setRows] = useState<Moment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'setup' });
    meta.get('profile_moments').then((saved) => {
      const picked = saved ? (saved.split(',') as MomentId[]) : DEFAULT;
      setRows(picked.map((id) => MOMENTS.find((m) => m.id === id)).filter((m): m is Moment => !!m));
    });
  }, []);

  const next = async () => {
    setBusy(true);
    try {
      // The tracking prompt comes before the plan, so AppsFlyer is running when a trial or purchase happens.
      await requestTrackingThenStart();
      router.push('/(auth)/paywall');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button title="See plans" onPress={next} loading={busy} testID="setup-continue" />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <View style={{ gap: Space.sm, marginTop: Space.lg }}>
        <Mono color={Colors.ink2} size={11}>YOUR CREW LENS</Mono>
        <Heading size={34} bold>{company ? `Set up for\n${company.name}` : 'Your setup'}</Heading>
      </View>
      <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, overflow: 'hidden' }}>
        {rows.map((m, i) => (
          <Animated.View
            key={m.id}
            entering={FadeInDown.delay(150 + i * 120).duration(350)}
            style={{ flexDirection: 'row', gap: Space.md, padding: Space.md, borderTopWidth: i ? 1 : 0, borderColor: Colors.hairline }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.flag, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <SymbolView name="checkmark" size={14} weight="bold" tintColor={Colors.surface} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Heading size={18} bold>{fixFor(m.id)}</Heading>
              <Body size={14} color={Colors.ink2} style={{ textDecorationLine: 'line-through' }}>{m.label}</Body>
            </View>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
