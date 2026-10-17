import { View } from 'react-native';

import { Heading, Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', gap: Space.sm }}>
      <Heading size={32}>Crew Lens</Heading>
      <Mono>SCAFFOLD · OCT 17 2026</Mono>
    </View>
  );
}
