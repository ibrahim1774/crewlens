import { Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Props = TextProps & { color?: string; size?: number; bold?: boolean };

/** Condensed grotesque for job names, headings and tab labels. */
export function Heading({ style, color = Colors.ink, size = 24, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.headingBold : Fonts.heading, fontSize: size, color, letterSpacing: -0.2 }, style]}
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

/** Monospace for stamps, timestamps, coordinates and counts. The signature element. */
export function Mono({ style, color = Colors.slate, size = 12, bold, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: bold ? Fonts.monoMedium : Fonts.mono, fontSize: size, color, letterSpacing: 0.2 }, style]}
    />
  );
}
