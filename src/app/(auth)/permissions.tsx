import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { stepLabel } from '@/constants/onboarding';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';

type RowProps = { icon: string; title: string; why: string; granted: boolean; onPress: () => void; blocked?: boolean };

function Row({ icon, title, why, granted, onPress, blocked }: RowProps) {
  return (
    <Pressable
      onPress={granted ? undefined : onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
        padding: Space.md,
        borderWidth: 1,
        borderColor: Colors.hairline,
        borderRadius: Radius.card,
        backgroundColor: Colors.surface,
      }}>
      <SymbolView name={icon as never} size={24} tintColor={granted ? Colors.ok : Colors.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Heading size={18}>{title}</Heading>
        <Body size={13} color={Colors.ink2}>{why}</Body>
      </View>
      <Mono size={11} color={granted ? Colors.ok : Colors.ink} bold>{granted ? 'On' : blocked ? 'Settings' : 'Allow'}</Mono>
    </Pressable>
  );
}

export default function Permissions() {
  const [camera, requestCamera] = useCameraPermissions();
  const [location, requestLocation] = Location.useForegroundPermissions();

  useEffect(() => {
    track('onboarding_step', { step: 'permissions' });
  }, []);

  // Camera and location are asked once they have paid and saved the account, right before the first photo.
  const next = () => router.replace('/(auth)/first-job');

  return (
    <Screen footer={<Button title="Continue" onPress={next} disabled={!camera?.granted} />}>
      <View style={{ gap: Space.sm }}>
        <Mono color={Colors.ink2} size={11}>{stepLabel('permissions')}</Mono>
        <Heading size={34} bold>Two permissions, zero sorting</Heading>
        <Body color={Colors.ink2}>Camera takes the photo. Location files it to the right job and stamps where it was taken, so you never sort a camera roll again.</Body>
      </View>
      <Row
        icon="camera"
        title="Camera"
        why={camera && !camera.granted && !camera.canAskAgain ? 'Camera was declined. Turn it on in Settings to continue.' : 'Take job-site photos inside the app.'}
        granted={!!camera?.granted}
        blocked={!!camera && !camera.granted && !camera.canAskAgain}
        onPress={() => (camera && !camera.canAskAgain ? Linking.openSettings() : requestCamera())}
      />
      <Row
        icon="location"
        title="Location while using"
        why={location && !location.granted && !location.canAskAgain ? 'Declined. Photos will say NO GPS unless you allow it in Settings.' : 'Pick the nearest job and stamp coordinates.'}
        granted={!!location?.granted}
        blocked={!!location && !location.granted && !location.canAskAgain}
        onPress={() => (location && !location.canAskAgain ? Linking.openSettings() : requestLocation())}
      />
    </Screen>
  );
}
