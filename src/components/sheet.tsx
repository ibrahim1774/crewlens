import type { PropsWithChildren } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heading } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';

type Props = PropsWithChildren<{ visible: boolean; onClose: () => void; title?: string }>;

/** Bottom sheet on a dim scrim. Flat surface, 6px top corners, hairline. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(21,22,26,0.5)' }} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: Colors.surface,
          borderTopLeftRadius: Radius.card,
          borderTopRightRadius: Radius.card,
          borderTopWidth: 1,
          borderColor: Colors.hairline,
          padding: Space.md,
          paddingBottom: insets.bottom + Space.md,
          gap: Space.sm,
        }}>
        {title ? <Heading size={22}>{title}</Heading> : null}
        {children}
      </View>
    </Modal>
  );
}

type RowProps = { title: string; subtitle?: string; onPress?: () => void; disabled?: boolean; destructive?: boolean; testID?: string };

export function SheetRow({ title, subtitle, onPress, disabled, destructive, testID }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({
        paddingVertical: Space.md,
        borderBottomWidth: 1,
        borderColor: Colors.hairline,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        gap: 2,
      })}>
      <Heading size={18} color={destructive ? Colors.flag : Colors.ink}>{title}</Heading>
      {subtitle ? <Heading size={13} color={Colors.ink2} style={{ fontFamily: 'Inter_400Regular' }}>{subtitle}</Heading> : null}
    </Pressable>
  );
}
