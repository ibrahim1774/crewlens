import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { timeAgo } from '@/lib/time';
import type { Job } from '@/types/models';

type Props = { job: Job; coverUri?: string | null; onPress: () => void; distanceM?: number | null };

/** 72px cover, condensed name, address, monospace activity line. Unsynced count in flag. */
export function JobRow({ job, coverUri, onPress, distanceM }: Props) {
  const archived = job.status === 'archived';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: Space.md,
        padding: Space.sm,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.hairline,
        borderRadius: Radius.card,
        opacity: pressed ? 0.8 : archived ? 0.6 : 1,
      })}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={{ width: 72, height: 72, borderRadius: Radius.chip, backgroundColor: Colors.canvas }} contentFit="cover" />
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: Radius.chip, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="mappin" size={22} tintColor={Colors.slate} />
        </View>
      )}
      <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
        <Heading size={19} numberOfLines={1}>{job.name}</Heading>
        <Body size={13} color={Colors.ink2} numberOfLines={1}>{job.address || 'No address'}</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: 2 }}>
          <Mono size={11}>
            {distanceM != null ? `${Math.round(distanceM)} M · ` : ''}
            {timeAgo(job.lastPhotoAt).toUpperCase()} · {job.photoCount} {job.photoCount === 1 ? 'PHOTO' : 'PHOTOS'}
          </Mono>
          {job.pendingCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.flag }} />
              <Mono size={11} color={Colors.flag}>{job.pendingCount} UNSYNCED</Mono>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
