import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { initialsFor, useCompany } from '@/lib/company';
import { meta } from '@/lib/db';

export default function Name() {
  const [name, setName] = useState('');
  const company = useCompany();
  useEffect(() => {
    // A slow membership lookup resolved after the gate: this user already has a company.
    if (company) router.replace('/(tabs)');
  }, [company]);
  useEffect(() => {
    track('onboarding_step', { step: 'name' });
    meta.get('pending_name').then((n) => n && setName(n));
  }, []);

  const next = async () => {
    await meta.set('pending_name', name.trim());
    router.push('/(auth)/company');
  };

  return (
    <Screen footer={<Button title="Continue" onPress={next} disabled={name.trim().length < 2} />}>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>STEP 3 OF 10</Mono>
        <Heading size={34} bold>Your name</Heading>
        <Body color={Colors.ink2}>Your initials go on every photo you take, so the office knows who shot it.</Body>
      </View>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Jo Smith" autoFocus testID="name" />
      <View style={{ gap: Space.xs }}>
        <Mono color={Colors.ink2} size={11}>PREVIEW</Mono>
        <Stamp photo={{ takenAt: new Date().toISOString(), lat: 40.7128, lng: -74.006 }} initials={initialsFor(name)} />
      </View>
    </Screen>
  );
}
