import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Heading } from '@/components/text';
import { Colors, Space } from '@/constants/theme';

/** Replaced in Task 9. */
export default function Camera() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera, alignItems: 'center', justifyContent: 'center', gap: Space.md }}>
      <Heading color={Colors.onCamera}>Camera arrives in Task 9</Heading>
      <Button title="Close" variant="ghost" onPress={() => router.back()} />
    </View>
  );
}
