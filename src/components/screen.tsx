import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Space } from '@/constants/theme';

type Props = PropsWithChildren<{ scroll?: boolean; footer?: React.ReactNode; padded?: boolean }>;

/** Canvas background, safe-area padding, optional pinned footer. */
export function Screen({ children, scroll = true, footer, padded = true }: Props) {
  const insets = useSafeAreaInsets();
  const pad = padded ? Space.md : 0;
  const body = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: pad, paddingTop: insets.top + Space.md, gap: Space.md, flexGrow: 1 }}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: pad, paddingTop: insets.top + Space.md }}>{children}</View>
  );
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: Colors.canvas }}>
      {body}
      {/* Content scrolling up under the clock and battery reads as a glitch; a strip of canvas keeps that area clean. */}
      {scroll ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: Colors.canvas }} /> : null}
      {footer ? <View style={{ padding: Space.md, paddingBottom: insets.bottom + Space.md, gap: Space.sm }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
