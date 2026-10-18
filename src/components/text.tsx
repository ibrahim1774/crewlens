import { Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Props = TextProps & { color?: string; size?: number; bold?: boolean };

/** Headings: Figtree, semibold by default, extra bold for display titles. */
export function Heading({ style, color = Colors.ink, size = 24, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.headingBold : Fonts.heading, fontSize: size, color, letterSpacing: bold ? -0.4 : -0.2 }, style]}
    />
  );
}

/** Body copy. */
export function Body({ style, color = Colors.ink, size = 15, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.bodyMedium : Fonts.body, fontSize: size, color, lineHeight: Math.round(size * 1.4) }, style]}
    />
  );
}

/** Small labels, counters and meta lines. */
export function Mono({ style, color = Colors.ink2, size = 12, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.labelBold : Fonts.label, fontSize: size + 1, color, letterSpacing: 0.3 }, style]}
    />
  );
}

/** The evidence stamp only: monospace so time and coordinates line up like a printed record. */
export function StampText({ style, color = Colors.ink, size = 12, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.monoMedium : Fonts.mono, fontSize: size, color, letterSpacing: 0.2 }, style]}
    />
  );
}
