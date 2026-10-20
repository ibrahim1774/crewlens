import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

function Row({ icon, title, why }: { icon: string; title: string; why: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface }}>
      <SymbolView name={icon as never} size={24} tintColor={Colors.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Heading size={18}>{title}</Heading>
        <Body size={13} color={Colors.ink2}>{why}</Body>
      </View>
    </View>
  );
}

/**
 * Asked once they have paid and saved the account, right before the first photo. One Continue shows the two
 * iOS prompts in turn and always moves on: whatever they answer, the app works and asks again where it's needed.
 */
export default function Permissions() {
  const [camera, requestCamera] = useCameraPermissions();
  const [location, requestLocation] = Location.useForegroundPermissions();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('onboarding_step', { step: 'permissions' });
  }, []);

  const next = async () => {
    setBusy(true);
    try {
      const cam = camera?.granted ? camera : camera?.canAskAgain === false ? camera : await requestCamera();
      const loc = location?.granted ? location : location?.canAskAgain === false ? location : await requestLocation();
      track('permissions_answered', { camera: !!cam?.granted, location: !!loc?.granted });
    } finally {
      setBusy(false);
      router.replace('/(auth)/first-job');
    }
  };

  return (
    <Screen footer={<Button title="Continue" onPress={next} loading={busy} testID="permissions-continue" />}>
      <View style={{ gap: Space.sm, marginTop: Space.lg }}>
        <Heading size={34} bold>Photos that file themselves</Heading>
        <Body color={Colors.ink2}>Next, iOS asks about two things. You can change either one later in Settings.</Body>
      </View>
      <Row icon="camera" title="Camera" why="Take job-site photos and videos inside Crew Lens." />
      <Row icon="location" title="Location while using the app" why="Files each photo to the job you're standing at and stamps where it was taken." />
    </Screen>
  );
}
