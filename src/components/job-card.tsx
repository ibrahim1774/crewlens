import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { timeAgo } from '@/lib/time';
import type { Job } from '@/types/models';

type Props = { job: Job; onPress: () => void; distanceM?: number | null };

/** Photo-forward job card: the latest photo fills the card, name and address sit on it. */
export function JobCard({ job, onPress, distanceM }: Props) {
  const archived = job.status === 'archived';
  const meta = [
    distanceM != null ? `${distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`} away` : null,
    job.photoCount === 0 ? 'No photos yet' : `${job.photoCount} ${job.photoCount === 1 ? 'photo' : 'photos'} · ${timeAgo(job.lastPhotoAt)}`,
  ].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.name}, ${job.address || 'no address'}, ${meta}`}
      style={({ pressed }) => ({
        borderRadius: Radius.card,
        backgroundColor: Colors.surface,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : archived ? 0.7 : 1,
        borderWidth: 1,
        borderColor: Colors.hairline,
      })}>
      <View style={{ height: 168, backgroundColor: Colors.hairline }}>
        {job.coverUri ? (
          <Image source={{ uri: job.coverUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <SymbolView name="camera" size={26} tintColor={Colors.ink2} />
            <Mono size={12}>Take the first photo</Mono>
          </View>
        )}
        {archived ? (
          <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Mono size={11} color={Colors.ink} bold>Archived</Mono>
          </View>
        ) : null}
        {job.pendingCount > 0 ? (
          <View style={{ position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.danger }} />
            <Mono size={11} color={Colors.ink} bold>{job.pendingCount} uploading</Mono>
          </View>
        ) : null}
      </View>
      <View style={{ padding: Space.md, gap: 2 }}>
        <Heading size={19} numberOfLines={1}>{job.name}</Heading>
        <Body size={14} color={Colors.ink2} numberOfLines={1}>{job.address || 'No address'}</Body>
        <Mono size={12} style={{ marginTop: 2 }}>{meta}</Mono>
      </View>
    </Pressable>
  );
}
