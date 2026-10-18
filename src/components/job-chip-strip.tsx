import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import type { StripChip } from '@/lib/strip';

type Props = {
  chips: StripChip[];
  selected: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
};

/** Horizontal job picker along the bottom of the camera. The selected chip is the only orange thing on screen besides the shutter. */
export function JobChipStrip({ chips, selected, counts, onSelect }: Props) {
  const list = useRef<FlatList<StripChip>>(null);

  useEffect(() => {
    const i = chips.findIndex((c) => c.id === selected);
    if (i >= 0) list.current?.scrollToIndex({ index: i, viewPosition: 0.5, animated: true });
  }, [selected, chips]);

  return (
    <FlatList
      ref={list}
      horizontal
      data={chips}
      keyExtractor={(c) => c.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: Space.md, gap: Space.sm }}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item }) => {
        const on = item.id === selected;
        const count = counts[item.id] ?? 0;
        return (
          <Pressable
            onPress={() => onSelect(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`chip-${item.id}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 40,
              paddingHorizontal: Space.md,
              borderRadius: Radius.pill,
              backgroundColor: on ? Colors.onCamera : 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: on ? Colors.onCamera : 'rgba(255,255,255,0.3)',
            }}>
            {item.id === 'new' ? <SymbolView name="plus" size={14} tintColor={on ? Colors.ink : Colors.onCamera} /> : null}
            <Heading size={16} color={on ? Colors.ink : Colors.onCamera} numberOfLines={1} style={{ maxWidth: 180 }}>
              {item.label}
            </Heading>
            {item.distanceM != null ? <Mono size={10} color={on ? Colors.ink2 : Colors.onCamera}>{Math.round(item.distanceM)}M</Mono> : null}
            {count > 0 ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: on ? Colors.ink : Colors.onCamera, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Mono size={10} color={on ? Colors.onCamera : Colors.ink} bold>{count}</Mono>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
