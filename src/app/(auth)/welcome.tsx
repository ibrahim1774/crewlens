import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Stamp } from '@/components/stamp';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

export default function Welcome() {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    track('onboarding_step', { step: 'welcome' });
    const t = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Screen footer={<Button title="Get started" onPress={() => router.push('/(auth)/sign-in')} />}>
      <View style={{ flex: 1, justifyContent: 'center', gap: Space.lg }}>
        <View
          style={{
            height: 260,
            borderRadius: Radius.card,
            backgroundColor: Colors.ink,
            justifyContent: 'flex-end',
            padding: Space.md,
            borderWidth: 1,
            borderColor: Colors.hairline,
          }}>
          <Mono color={Colors.onCamera} size={11} style={{ position: 'absolute', top: Space.md, left: Space.md }}>
            JOB 001 · YOUR JOB SITE
          </Mono>
          <Stamp photo={{ takenAt: now, lat: null, lng: null }} initials="YOU" tone="dark" size={13} />
        </View>
        <View style={{ gap: Space.sm }}>
          <Heading size={40} bold>Every photo, filed and stamped.</Heading>
          <Body color={Colors.ink2}>
            Open the camera on site. Crew Lens picks the job you are standing at, stamps the time, place and who shot it, and shares the whole job with one link.
          </Body>
        </View>
      </View>
    </Screen>
  );
}
