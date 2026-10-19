import * as SMS from 'expo-sms';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useCompany } from '@/lib/company';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6823989964';

/** Step 9: invite the crew. Sends the download link by text; seats are managed on the Crew plan. */
export default function Crew() {
  const company = useCompany();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'crew' });
  }, []);

  const message = `Join ${company?.name ?? 'our crew'} on Crew Lens. Download it here and sign in with your email, I will add you to our jobs: ${APP_STORE_URL}`;

  const invite = async () => {
    track('crew_invite_tapped');
    try {
      if (await SMS.isAvailableAsync()) {
        const { result } = await SMS.sendSMSAsync([], message);
        if (result === 'sent') setSent(true);
        return;
      }
      await Share.share({ message });
      setSent(true);
    } catch {
      // The composer was dismissed; nothing to do.
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
          <Button title={sent ? 'Continue' : 'Invite by text'} onPress={sent ? next : invite} testID="crew-invite" />
          {!sent ? <Button title="Just me for now" variant="ghost" onPress={next} testID="crew-skip" /> : null}
        </>
      }>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('crew')}</Mono>
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
        <Mono size={11} color={Colors.ink2}>Crew plan · 3 seats included</Mono>
        <Body size={13} color={Colors.ink2}>The text carries the download link. Once they sign in, add them to the company from the You tab.</Body>
      </View>
    </Screen>
  );
}
