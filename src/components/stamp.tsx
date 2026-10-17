import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { stampLines, type Stampable } from '@/lib/stamp';

type Props = {
  photo: Stampable;
  initials: string;
  /** 'light' sits on canvas; 'dark' sits on a photo or the camera. */
  tone?: 'light' | 'dark';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The evidence stamp: when on line one, where and who on line two.
 * Monospace on a translucent block with 2px corners. Used on photos, in grids, in onboarding.
 */
export function Stamp({ photo, initials, tone = 'light', size = 12, style }: Props) {
  const [when, where] = stampLines(photo, initials);
  const dark = tone === 'dark';
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: dark ? 'rgba(11,11,13,0.72)' : 'rgba(247,246,242,0.88)',
          borderRadius: Radius.chip,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs,
          gap: 2,
        },
        style,
      ]}>
      <Mono size={size} color={dark ? Colors.onCamera : Colors.slate} bold>{when}</Mono>
      <Mono size={size} color={dark ? Colors.onCamera : Colors.slate}>{where}</Mono>
    </View>
  );
}
