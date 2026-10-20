import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { registersAt } from '@/constants/onboarding';
import { Colors, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getSession, isGuest, startGuest } from '@/lib/auth';
import { createCompany, fetchMembership, TRADES } from '@/lib/company';
import { meta } from '@/lib/db';

export default function CompanyScreen() {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<string>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    track('onboarding_step', { step: 'company' });
  }, []);

  const next = async () => {
    setBusy(true);
    try {
      // A relaunch can land here with the guest account gone (signed out or reinstalled): make a new one.
      if (!getSession()) await startGuest();
      const session = getSession();
      if (!session) throw new Error('network');
      const displayName = (await meta.get('pending_name')) ?? session.user.email ?? 'Owner';
      await createCompany({ userId: session.user.id, name, trade: trade.toLowerCase(), displayName });
      await meta.set('profile_trade', trade);
      await meta.set('pending_name', null);
      track('company_created', { trade: trade.toLowerCase() });
      if (registersAt({ step: 'company', guest: isGuest() })) trackRegistration('create');
      router.push('/(auth)/tailor');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('already_member')) {
        // The account already owns a company; load it instead of failing.
        const uid = getSession()?.user.id;
        if (uid) await fetchMembership(uid).catch(() => null);
        router.replace('/');
        return;
      }
      Alert.alert('Could not create company', msg.includes('network') || msg.includes('fetch') ? 'Check your connection and try again.' : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={<Button title="Continue" onPress={next} loading={busy} disabled={name.trim().length < 2 || !trade} />}>
      <View style={{ gap: Space.sm }}>
        <Heading size={34} bold>Your company</Heading>
        <Body color={Colors.ink2}>Every job, photo and document lives under the company, not on one person&apos;s phone. Nothing walks off when someone leaves.</Body>
      </View>
      {/* Trade first: the chips stay above the keyboard, so Continue never hides behind it. */}
      <Chips label="TRADE" options={TRADES} value={trade as (typeof TRADES)[number] | ''} onChange={setTrade} testPrefix="trade" />
      <Field label="Company name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" placeholder="Smith Roofing" testID="company" />
    </Screen>
  );
}
