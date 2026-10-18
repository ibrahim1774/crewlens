import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Heading } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const bg: Record<Variant, string> = { primary: Colors.flag, secondary: Colors.ink, ghost: 'transparent', danger: 'transparent' };
const fg: Record<Variant, string> = { primary: Colors.surface, secondary: Colors.surface, ghost: Colors.ink, danger: Colors.danger };

/** Pill buttons: solid black primary, outlined secondary. */
export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: Props) {
  const dim = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={dim}
      {...rest}
      style={({ pressed }) => [
        {
          height: 56,
          borderRadius: Radius.pill,
          backgroundColor: bg[variant],
          borderWidth: variant === 'ghost' || variant === 'danger' ? 1.5 : 0,
          borderColor: variant === 'danger' ? Colors.danger : Colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Space.lg,
          opacity: dim ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg[variant]} /> : <Heading size={17} color={fg[variant]}>{title}</Heading>}
    </Pressable>
  );
}
