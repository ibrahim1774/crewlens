import * as SMS from 'expo-sms';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { inviteText } from '@/constants/invite';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { createInvite, useCompany } from '@/lib/company';

/** Invite the crew: a one-time code and the download link by text. Seats come with the plan. */
export default function Crew() {
  const company = useCompany();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const seats = company?.seats ?? 1;

  useEffect(() => {
    track('onboarding_step', { step: 'crew' });
  }, []);

  const invite = async () => {
    track('crew_invite_tapped');
    setBusy(true);
    try {
      const inv = await createInvite();
      const message = inviteText(company?.name, inv.code);
      if (await SMS.isAvailableAsync()) {
        const { result } = await SMS.sendSMSAsync([], message);
        if (result === 'sent') setSent(true);
        return;
      }
      await Share.share({ message });
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'limit:seats') {
        Alert.alert('Your plan is just you', 'The Crew plan includes three seats. You can switch any time from Plans in the You tab.');
      } else if (msg) {
        Alert.alert('Could not create an invite', 'Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    track(sent ? 'crew_invited' : 'crew_skipped');
    router.push('/(auth)/share-docs');
  };

  return (
    <Screen
      footer={
        <>
          <Button title={sent ? 'Continue' : 'Invite by text'} onPress={sent ? next : invite} loading={busy} testID="crew-invite" />
          {!sent ? <Button title="Just me for now" variant="ghost" onPress={next} testID="crew-skip" /> : null}
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Heading size={34} bold>Who is on the job with you?</Heading>
        <Body color={Colors.ink2}>Everyone shoots into the same job with their own initials. You see the whole site from the truck, and no photo lives on just one person&apos;s phone.</Body>
      </View>
      <View style={{ borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, padding: Space.md, gap: Space.sm }}>
        <View style={{ flexDirection: 'row', gap: Space.sm }}>
          {['YOU', 'MRT', 'KLW'].map((t, i) => (
            <View key={t} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: i === 0 ? Colors.ink : Colors.slate, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 1 : 0.45 }}>
              <Mono size={11} color={Colors.onCamera} bold>{t}</Mono>
            </View>
          ))}
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name="plus" size={14} tintColor={Colors.ink} />
          </View>
        </View>
        <Mono size={11} color={Colors.ink2}>{seats === 1 ? '1 seat on your plan' : `${seats} seats on your plan`}</Mono>
        <Body size={13} color={Colors.ink2}>The text carries a one-time code and the download link. They tap Get started, then &quot;Joining a crew?&quot;, and land in your jobs.</Body>
      </View>
    </Screen>
  );
}
