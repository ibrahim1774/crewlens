import { Pressable, View } from 'react-native';

import { Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';

/** One-tap answer chips under a small label. Selected is black, like every selected state in the app. */
export function Chips<T extends string>({ label, options, value, onChange, testPrefix }: { label: string; options: readonly T[]; value: T | ''; onChange: (v: T) => void; testPrefix: string }) {
  return (
    <View style={{ gap: Space.xs }}>
      <Mono color={Colors.ink2} size={11}>{label}</Mono>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`${testPrefix}-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              style={{
                paddingHorizontal: Space.md,
                height: 40,
                justifyContent: 'center',
                borderRadius: Radius.chip,
                borderWidth: 1,
                borderColor: on ? Colors.ink : Colors.hairline,
                backgroundColor: on ? Colors.ink : Colors.surface,
              }}>
              <Heading size={16} color={on ? Colors.surface : Colors.ink}>{o}</Heading>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
