import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

const DEMO = require('@/assets/video/welcome.mp4');
const POSTER = require('@/assets/video/welcome-poster.jpg');
const ICON = require('@/assets/images/icon.png');

/**
 * The walkthrough, recorded from the real app: jobs, stamped photos, a link for the client, an invoice
 * signed and sent, with callouts on each benefit. Muted and looping; a still frame stands in when Reduce Motion is on.
 */
function Demo({ still }: { still: boolean }) {
  const player = useVideoPlayer(still ? null : DEMO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View
      style={{ flex: 1, alignSelf: 'center', aspectRatio: 2 / 3, maxWidth: '100%', borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.hairline }}
      accessible
      accessibilityLabel="Walkthrough: jobs sorted into folders, photos stamped with date and time, a share link sent to the client, and an invoice signed and sent from the phone"
      testID="welcome-demo">
      <Image source={POSTER} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
      {!still ? <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} /> : null}
    </View>
  );
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [still, setStill] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'welcome' });
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + Space.sm, paddingHorizontal: Space.md, gap: Space.md }}>
      <View style={{ alignItems: 'center', gap: Space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Image source={ICON} style={{ width: 30, height: 30, borderRadius: 8 }} />
          <Heading size={22} bold>Crew Lens</Heading>
        </View>
        <Heading size={29} bold style={{ textAlign: 'center', lineHeight: 31, letterSpacing: 0.2 }} testID="welcome-headline">
          {'EVERY PHOTO,\nSORTED BY JOB.\nALL IN ONE PLACE.'}
        </Heading>
        <Body size={15} color={Colors.ink2} style={{ textAlign: 'center' }}>
          Photos and documents, stamped with time and place, backed up, and shared with the client in one link.
        </Body>
      </View>
      <Demo still={still} />
      <Pressable onPress={() => router.push('/(auth)/intro')} accessibilityRole="link" hitSlop={8} style={{ alignSelf: 'center' }} testID="welcome-tour">
        <Mono size={13} color={Colors.ink} bold>See how it works</Mono>
      </Pressable>
      <View style={{ gap: Space.sm }}>
        <Button title="Get started" onPress={() => router.push('/(auth)/benefits')} testID="welcome-start" />
        <Button title="Sign in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} testID="welcome-sign-in" />
      </View>
    </View>
  );
}
