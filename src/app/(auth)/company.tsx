import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { registersAt, stepLabel } from '@/constants/onboarding';
import { Colors, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getSession, isGuest, startGuest } from '@/lib/auth';
import { createCompany, fetchMembership, joinCompany, TRADES } from '@/lib/company';
import { meta } from '@/lib/db';

export default function CompanyScreen() {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  useEffect(() => {
    track('onboarding_step', { step: 'company' });
  }, []);

  const join = async () => {
    setBusy(true);
    try {
      // A relaunch can land here with the guest account gone (signed out or reinstalled): make a new one.
      if (!getSession()) await startGuest();
      const session = getSession();
      if (!session) throw new Error('network');
      const displayName = (await meta.get('pending_name')) ?? session.user.email ?? 'Crew';
      await joinCompany({ userId: session.user.id, code, displayName });
      await meta.set('pending_name', null);
      track('company_joined');
      if (registersAt({ step: 'company', guest: isGuest() })) trackRegistration('join');
      router.push('/(auth)/permissions');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        msg === 'invite_invalid' ? 'That code did not work' : msg === 'limit:seats' ? 'No seats left' : msg === 'already_member' ? 'You already belong to a company' : 'Could not join',
        msg === 'invite_invalid' ? 'Codes are six characters and expire after 7 days. Ask the owner for a new one.' : msg === 'limit:seats' ? 'Ask the owner to add a seat on the Crew plan.' : 'Check your connection and try again.',
      );
      if (msg === 'already_member') {
        const uid = getSession()?.user.id;
        if (uid) await fetchMembership(uid).catch(() => null);
        router.replace('/');
      }
    } finally {
      setBusy(false);
    }
  };

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
      footer={
        joining ? (
          <>
            <Button title="Join the crew" onPress={join} loading={busy} disabled={code.trim().length < 6} testID="join-continue" />
            <Button title="Start my own company instead" variant="ghost" onPress={() => setJoining(false)} />
          </>
        ) : (
          <>
            <Button title="Continue" onPress={next} loading={busy} disabled={name.trim().length < 2 || !trade} />
            <Button title="Joining a crew? Enter the invite code" variant="ghost" onPress={() => setJoining(true)} testID="join-toggle" />
          </>
        )
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('company')}</Mono>
        <Heading size={34} bold>Your company</Heading>
        <Body color={Colors.ink2}>Every job, photo and document lives under the company, not on one person&apos;s phone. Nothing walks off when someone leaves.</Body>
      </View>
      {joining ? (
        <Field label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} autoCapitalize="characters" autoCorrect={false} placeholder="ABC234" testID="invite-code" />
      ) : null}
      {joining ? <Body size={13} color={Colors.ink2}>The owner sends it by text from Team in the You tab. It works once and expires in 7 days.</Body> : null}
      {/* Trade first: the chips stay above the keyboard, so Continue never hides behind it. */}
      {!joining ? <Chips label="TRADE" options={TRADES} value={trade as (typeof TRADES)[number] | ''} onChange={setTrade} testPrefix="trade" /> : null}
      {!joining ? <Field label="Company name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" placeholder="Smith Roofing" testID="company" /> : null}
    </Screen>
  );
}
