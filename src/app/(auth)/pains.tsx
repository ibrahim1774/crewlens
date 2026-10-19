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
import { HEADACHES, PHOTO_HOMES, type Headache, type PhotoHome } from '@/lib/cost';
import { meta } from '@/lib/db';

/** Where job photos live today and what hurts most. The next screen turns these into what it costs them. */
export default function Pains() {
  const [home, setHome] = useState<PhotoHome | ''>('');
  const [headache, setHeadache] = useState<Headache | ''>('');

  useEffect(() => {
    track('onboarding_step', { step: 'pains' });
  }, []);

  const next = async (skipped: boolean) => {
    await meta.set('profile_photo_home', skipped ? null : home || null);
    await meta.set('profile_headache', skipped ? null : headache || null);
    if (!skipped) identify({ photo_home: home || null, headache: headache || null });
    track(skipped ? 'pains_skipped' : 'pains_saved', { photo_home: home || null, headache: headache || null });
    router.push('/(auth)/cost');
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={() => next(false)} disabled={!home || !headache} testID="pains-continue" />
          <Button title="Skip" variant="ghost" onPress={() => next(true)} testID="pains-skip" />
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('pains')}</Mono>
        <Heading size={34} bold>How it goes today</Heading>
        <Body color={Colors.ink2}>Two taps. We use them to show you what the mess is costing, and what changes.</Body>
      </View>
      <Chips label="WHERE DO JOB PHOTOS LIVE NOW" options={PHOTO_HOMES} value={home} onChange={setHome} testPrefix="home" />
      <Chips label="YOUR BIGGEST HEADACHE" options={HEADACHES} value={headache} onChange={setHeadache} testPrefix="headache" />
    </Screen>
  );
}
