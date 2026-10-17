import { View } from 'react-native';

import { Heading } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useCompany } from '@/lib/company';

export default function Jobs() {
  const company = useCompany();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <Heading size={28}>{company?.name ?? 'Jobs'}</Heading>
    </View>
  );
}
