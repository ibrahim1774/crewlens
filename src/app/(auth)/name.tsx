import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { initialsFor, useCompany } from '@/lib/company';
import { meta } from '@/lib/db';

export default function Name() {
  const [name, setName] = useState('');
  const company = useCompany();
  // A slow membership lookup resolved after the gate: this user already has a company.
  // Only while this screen is showing: it stays mounted under the later steps, and the company
  // those steps create must not yank the person out of onboarding.
  useFocusEffect(
    useCallback(() => {
      if (company) router.replace('/');
    }, [company]),
  );
  useEffect(() => {
    track('onboarding_step', { step: 'name' });
    meta.get('pending_name').then((n) => n && setName(n));
  }, []);

  const next = async () => {
    await meta.set('pending_name', name.trim());
    router.push('/(auth)/company');
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={next} disabled={name.trim().length < 2} testID="name-continue" />
          {/* Tapped Get started by mistake? Sign in leaves the empty guest account for the real one. */}
          <Button title="Already have an account? Sign in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} testID="name-sign-in" />
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            testID="name-back">
            <SymbolView name="chevron.left" size={14} weight="semibold" tintColor={Colors.ink} />
            <Mono size={13} color={Colors.ink} bold>Back</Mono>
          </Pressable>
          <Mono color={Colors.ink2} size={11}>{stepLabel('name')}</Mono>
        </View>
        <Heading size={34} bold>Who is shooting?</Heading>
        <Body color={Colors.ink2}>Your initials go on every photo you take, so the office knows who was on site without asking.</Body>
      </View>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Jo Smith" autoFocus testID="name" />
      <View style={{ gap: Space.xs }}>
        <Mono color={Colors.ink2} size={11}>Preview</Mono>
        <Stamp photo={{ takenAt: new Date().toISOString(), lat: 40.7128, lng: -74.006 }} initials={initialsFor(name)} />
      </View>
    </Screen>
  );
}
