import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { registersAt } from '@/constants/onboarding';
import { Colors, Space } from '@/constants/theme';
import { track, trackRegistration } from '@/lib/analytics';
import { getSession, isGuest, startGuest } from '@/lib/auth';
import { fetchMembership, joinCompany } from '@/lib/company';
import { meta } from '@/lib/db';

/** A crew member with an invite code joins the owner's company: no company setup and no plan to pick, the seat is paid for. */
export default function Join() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'join' });
    meta.get('pending_name').then((n) => n && setName(n));
  }, []);

  const join = async () => {
    setBusy(true);
    try {
      // A relaunch can land here with the guest account gone (signed out or reinstalled): make a new one.
      if (!getSession()) await startGuest();
      const session = getSession();
      if (!session) throw new Error('network');
      await joinCompany({ userId: session.user.id, code, displayName: name.trim() });
      await meta.set('pending_name', null);
      track('company_joined');
      if (registersAt({ step: 'company', guest: isGuest() })) trackRegistration('join');
      // A guest saves the account next so the seat isn't lost with the phone; someone already signed in goes straight on.
      router.replace(isGuest() ? '/(auth)/save' : '/(auth)/permissions');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        msg === 'invite_invalid' ? 'That code did not work' : msg === 'limit:seats' ? 'No seats left' : msg === 'already_member' ? 'You already belong to a company' : 'Could not join',
        msg === 'invite_invalid' ? 'Codes are six letters and numbers and expire after 7 days. Ask the owner for a new one.' : msg === 'limit:seats' ? 'Ask the owner to add a seat on the Crew plan.' : msg === 'already_member' ? 'Opening your company.' : 'Check your connection and try again.',
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

  return (
    <Screen
      footer={
        <>
          <Button title="Join the crew" onPress={join} loading={busy} disabled={name.trim().length < 2 || code.length < 6} testID="join-continue" />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <View style={{ gap: Space.sm, marginTop: Space.lg }}>
        <Heading size={34} bold>Join your crew</Heading>
        <Body color={Colors.ink2}>Enter the code from the text your boss sent. Your photos land in the company&apos;s jobs with your initials.</Body>
      </View>
      <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Jo Smith" testID="join-name" />
      <Field
        label="Invite code"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABC234"
        testID="invite-code"
      />
      <Body size={13} color={Colors.ink2}>The owner sends it from Team in the You tab. It works once and expires in 7 days.</Body>
    </Screen>
  );
}
