import { TextInput, View, type TextInputProps } from 'react-native';

import { Mono } from '@/components/text';
import { Colors, Fonts, Radius, Space } from '@/constants/theme';

type Props = TextInputProps & { label: string };

/** Text input with a monospace label above and a hairline box. */
export function Field({ label, style, ...rest }: Props) {
  return (
    <View style={{ gap: Space.xs }}>
      <Mono size={11} color={Colors.ink2}>{label.toUpperCase()}</Mono>
      <TextInput
        placeholderTextColor={Colors.ink2}
        {...rest}
        style={[
          {
            height: 52,
            borderWidth: 1,
            borderColor: Colors.hairline,
            borderRadius: Radius.card,
            backgroundColor: Colors.surface,
            paddingHorizontal: Space.md,
            fontFamily: Fonts.body,
            fontSize: 16,
            color: Colors.ink,
          },
          style,
        ]}
      />
    </View>
  );
}
