import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Space } from '@/constants/theme';
import { identify, track } from '@/lib/analytics';
import { meta } from '@/lib/db';

export const ROLES = ['Owner', 'Field', 'Office', 'Project manager', 'Other'] as const;
export const CREW_SIZES = ['Just me', '2–5', '6–15', '16+'] as const;
export const SOURCES = ['App Store', 'Google', 'A friend', 'Facebook or Instagram', 'TikTok or YouTube', 'Other'] as const;

/** Three quick answers that shape the first-run tips and the acquisition report. Skippable. */
export default function Tailor() {
  const [role, setRole] = useState<(typeof ROLES)[number] | ''>('');
  const [crew, setCrew] = useState<(typeof CREW_SIZES)[number] | ''>('');
  const [source, setSource] = useState<(typeof SOURCES)[number] | ''>('');

  useEffect(() => {
    track('onboarding_step', { step: 'tailor' });
  }, []);

  const next = async (skipped: boolean) => {
    if (!skipped) {
      await meta.set('profile_role', role || null);
      await meta.set('profile_crew', crew || null);
      await meta.set('profile_source', source || null);
      identify({ role: role || null, crew_size: crew || null, heard_from: source || null });
    }
    track(skipped ? 'tailor_skipped' : 'tailor_saved', { role: role || null, crew: crew || null, source: source || null });
    router.push('/(auth)/moments');
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={() => next(false)} disabled={!role || !crew} testID="tailor-continue" />
          <Button title="Skip" variant="ghost" onPress={() => next(true)} testID="tailor-skip" />
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('tailor')}</Mono>
        <Heading size={34} bold>Set it up for how you work</Heading>
        <Body color={Colors.ink2}>Thirty seconds. Owner alone or a six-truck crew, the first steps change. Nothing here is shared or sold.</Body>
      </View>
      <Chips label="YOUR ROLE" options={ROLES} value={role} onChange={setRole} testPrefix="role" />
      <Chips label="CREW SIZE" options={CREW_SIZES} value={crew} onChange={setCrew} testPrefix="crew" />
      <Chips label="HOW DID YOU HEAR ABOUT US" options={SOURCES} value={source} onChange={setSource} testPrefix="source" />
    </Screen>
  );
}
