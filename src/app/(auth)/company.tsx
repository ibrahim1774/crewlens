import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { getSession } from '@/lib/auth';
import { createCompany, TRADES } from '@/lib/company';
import { meta } from '@/lib/db';

export default function CompanyScreen() {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<string>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    track('onboarding_step', { step: 'company' });
  }, []);

  const next = async () => {
    const session = getSession();
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }
    setBusy(true);
    try {
      const displayName = (await meta.get('pending_name')) ?? session.user.email ?? 'Owner';
      await createCompany({ userId: session.user.id, name, trade: trade.toLowerCase(), displayName });
      await meta.set('pending_name', null);
      track('company_created', { trade: trade.toLowerCase() });
      router.push('/(auth)/permissions');
    } catch (e) {
      Alert.alert('Could not create company', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Continue" onPress={next} loading={busy} disabled={name.trim().length < 2 || !trade} />}>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>STEP 3 OF 4</Mono>
        <Heading size={34} bold>Your company</Heading>
        <Body color={Colors.ink2}>Jobs, photos and links belong to the company, so your crew can share them.</Body>
      </View>
      <Field label="Company name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Smith Roofing" testID="company" />
      <View style={{ gap: Space.xs }}>
        <Mono color={Colors.ink2} size={11}>TRADE</Mono>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
          {TRADES.map((t) => {
            const on = t === trade;
            return (
              <Pressable
                key={t}
                onPress={() => setTrade(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingHorizontal: Space.md,
                  height: 40,
                  justifyContent: 'center',
                  borderRadius: Radius.chip,
                  borderWidth: 1,
                  borderColor: on ? Colors.ink : Colors.hairline,
                  backgroundColor: on ? Colors.ink : Colors.surface,
                }}>
                <Heading size={16} color={on ? Colors.surface : Colors.ink}>{t}</Heading>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
