import { View } from 'react-native';

import { Button } from '@/components/button';
import { Body, Heading } from '@/components/text';
import { Colors, Space } from '@/constants/theme';

type Props = { title: string; body?: string; action?: { title: string; onPress: () => void; testID?: string } };

/** One heading, one line, one action. No illustrations. */
export function Empty({ title, body, action }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center', padding: Space.lg, gap: Space.sm }}>
      <Heading size={28}>{title}</Heading>
      {body ? <Body color={Colors.ink2}>{body}</Body> : null}
      {action ? <Button title={action.title} variant="ghost" onPress={action.onPress} testID={action.testID} style={{ marginTop: Space.sm, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}
