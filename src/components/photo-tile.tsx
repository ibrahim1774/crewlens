import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Mono } from '@/components/text';
import { Colors } from '@/constants/theme';
import { formatDuration, signedUrl } from '@/lib/photos';
import type { Photo } from '@/types/models';

/** Resolves a displayable URI: local file first, else a signed remote URL. */
export function usePhotoUri(p: Photo, variant: 'thumb' | 'full'): string | null {
  const local = variant === 'thumb' ? p.localThumbUri ?? p.localUri : p.localUri ?? p.localThumbUri;
  const remoteKey = variant === 'thumb' ? p.thumbPath : p.storagePath;
  const [uri, setUri] = useState<string | null>(local);
  useEffect(() => {
    if (local) {
      setUri(local);
      return;
    }
    if (!remoteKey) return;
    let alive = true;
    signedUrl(variant === 'thumb' ? 'thumbs' : 'photos', remoteKey).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [local, remoteKey, variant]);
  return uri;
}

type Props = { photo: Photo; size: number; onPress: () => void; onRetry?: () => void };

/** Square thumbnail with a tiny time stamp; flag dot when unsynced; warning when failed. */
export function PhotoTile({ photo, size, onPress, onRetry }: Props) {
  const uri = usePhotoUri(photo, 'thumb');
  const time = new Date(photo.takenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const failed = photo.syncState === 'failed';
  const unsynced = photo.syncState !== 'synced' && !failed;
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${time}`} style={{ width: size, height: size, backgroundColor: Colors.hairline, borderRadius: 12, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={120} /> : null}
      <View style={{ position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
        <Mono size={9} color={Colors.onCamera}>{time}</Mono>
      </View>
      {photo.kind === 'video' ? (
        <View style={{ position: 'absolute', right: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(11,11,13,0.6)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
          <SymbolView name="play.fill" size={8} tintColor={Colors.onCamera} />
          <Mono size={9} color={Colors.onCamera}>{formatDuration(photo.durationS)}</Mono>
        </View>
      ) : null}
      {unsynced ? <View style={{ position: 'absolute', right: 6, top: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1, borderColor: Colors.onCamera }} /> : null}
      {failed ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry upload" style={{ position: 'absolute', right: 4, top: 4, backgroundColor: 'rgba(11,11,13,0.6)', borderRadius: 2, padding: 2 }}>
          <SymbolView name="exclamationmark.triangle.fill" size={14} tintColor={Colors.danger} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
