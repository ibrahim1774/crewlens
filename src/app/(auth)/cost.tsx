import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { costReport, MINUTES_PER_DAY, type CostReport } from '@/lib/cost';
import { meta } from '@/lib/db';

/** "What that's costing you", from their own answers: hours lost hunting for photos, their pains, then the fixes. */
export default function Cost() {
  const [report, setReport] = useState<CostReport | null>(null);
  const [crew, setCrew] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all(['profile_crew', 'profile_photo_home', 'profile_headache'].map((k) => meta.get(k))).then(([c, photoHome, headache]) => {
      const r = costReport({ crew: c, photoHome, headache });
      setCrew(c);
      setReport(r);
      track('onboarding_step', { step: 'cost', hours: r.hoursPerMonth });
    });
  }, []);

  const people = report?.people ?? 1;
  return (
    <Screen footer={<Button title="Fix this" onPress={() => router.push('/(auth)/permissions')} disabled={!report} testID="cost-continue" />}>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('cost')}</Mono>
        <Heading size={34} bold>{"Here's what that's costing you"}</Heading>
      </View>
      {report ? (
        <>
          <Animated.View entering={FadeInDown.duration(350)} style={{ borderRadius: Radius.card, backgroundColor: Colors.ink, padding: Space.lg, gap: 4 }} testID="cost-hours">
            <Heading size={44} bold color={Colors.surface}>{`About ${report.hoursPerMonth} hours`}</Heading>
            <Body size={16} color={Colors.surface}>{`a month spent looking for job photos${crew && people > 1 ? ` across a crew of ${crew}` : ''}.`}</Body>
            <Mono size={11} color="rgba(255,255,255,0.6)" style={{ marginTop: Space.sm }}>
              {`Estimate: ${MINUTES_PER_DAY} minutes a day per person, 22 work days.`}
            </Mono>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(350)} style={{ gap: Space.sm }}>
            <Mono color={Colors.ink2} size={11}>WHAT YOU TOLD US</Mono>
            {report.pains.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: Space.sm }}>
                <SymbolView name="xmark.circle.fill" size={20} tintColor={Colors.danger} />
                <Body style={{ flex: 1 }}>{p}</Body>
              </View>
            ))}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(300).duration(350)} style={{ gap: Space.sm }}>
            <Mono color={Colors.ink2} size={11}>WITH CREW LENS</Mono>
            {report.fixes.map((f) => (
              <View key={f.title} style={{ flexDirection: 'row', gap: Space.sm }}>
                <SymbolView name="checkmark.circle.fill" size={20} tintColor={Colors.ok} />
                <View style={{ flex: 1 }}>
                  <Heading size={17} bold>{f.title}</Heading>
                  <Body size={14} color={Colors.ink2}>{f.body}</Body>
                </View>
              </View>
            ))}
          </Animated.View>
        </>
      ) : null}
    </Screen>
  );
}
