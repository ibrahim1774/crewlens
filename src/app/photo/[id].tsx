import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';
import { Alert, Dimensions, FlatList, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePhotoUri } from '@/components/photo-tile';
import { Stamp } from '@/components/stamp';
import { Mono } from '@/components/text';
import { Colors, Space } from '@/constants/theme';
import { deletePhoto, useJobPhotosState } from '@/lib/photos';
import type { Photo } from '@/types/models';

const { width: W } = Dimensions.get('window');

function VideoPage({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={{ width: W, height: '100%' }} contentFit="contain" nativeControls />;
}

function Page({ photo }: { photo: Photo }) {
  const uri = usePhotoUri(photo, 'full');
  return (
    <View style={{ width: W, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {!uri ? <Mono color={Colors.onCamera}>LOADING</Mono> : photo.kind === 'video' ? <VideoPage uri={uri} /> : <Image source={{ uri }} style={{ width: W, height: '100%' }} contentFit="contain" transition={150} />}
    </View>
  );
}

function Action({ name, label, onPress, tint = Colors.onCamera }: { name: string; label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ alignItems: 'center', gap: 4, width: 72, opacity: pressed ? 0.6 : 1 })}>
      <SymbolView name={name as never} size={22} tintColor={tint} />
      <Mono size={10} color={tint}>{label.toUpperCase()}</Mono>
    </Pressable>
  );
}

/** Full-screen pager over a job's photos with the stamp and actions at the bottom. */
export default function PhotoViewer() {
  const insets = useSafeAreaInsets();
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId: string }>();
  const { photos, loaded } = useJobPhotosState(jobId);
  const start = useMemo(() => Math.max(0, photos.findIndex((p) => p.id === id)), [photos, id]);
  const [index, setIndex] = useState<number | null>(null);
  const list = useRef<FlatList<Photo>>(null);
  const exportRef = useRef<View>(null);
  const [exporting, setExporting] = useState<Photo | null>(null);
  const current = index != null ? photos[index] ?? photos[photos.length - 1] : undefined;

  useEffect(() => {
    if (loaded && index == null) setIndex(start);
  }, [loaded, start, index]);
  useEffect(() => {
    // Only leave on a real transition to zero, never on the pre-load empty list.
    if (loaded && photos.length === 0) router.back();
  }, [loaded, photos.length]);

  /** Renders the photo with its stamp burned in and returns a file URI. The stored original is untouched. */
  const stamped = async (p: Photo): Promise<string | null> => {
    if (!p.localUri) {
      Alert.alert('Not downloaded', 'This photo lives in the cloud. Share the job link instead.');
      return null;
    }
    setExporting(p);
    await new Promise((r) => setTimeout(r, 120));
    try {
      return await captureRef(exportRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
    } finally {
      setExporting(null);
    }
  };

  const share = async () => {
    if (!current) return;
    const uri = await stamped(current);
    if (uri) await Share.share({ url: uri });
  };

  const save = async () => {
    if (!current) return;
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') return;
    const uri = await stamped(current);
    if (!uri) return;
    await MediaLibrary.createAssetAsync(uri);
    Alert.alert('Saved to Photos', 'With the stamp burned in.');
  };

  const remove = () => {
    if (!current) return;
    Alert.alert('Delete photo?', 'This removes it from the job for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePhoto(current).catch(() => {}) },
    ]);
  };

  if (!current || index == null) return <View style={{ flex: 1, backgroundColor: Colors.camera }} />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.camera }}>
      {exporting?.localUri ? (
        <View ref={exportRef} collapsable={false} style={{ position: 'absolute', left: -10000, width: exporting.width || 2048, height: exporting.height || 1536 }}>
          <Image source={{ uri: exporting.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <View style={{ position: 'absolute', left: 32, bottom: 32, transform: [{ scale: Math.max(2, (exporting.width || 2048) / 700) }], transformOrigin: 'left bottom' }}>
            <Stamp photo={exporting} initials={exporting.takerInitials} tone="dark" size={13} />
          </View>
        </View>
      ) : null}
      <FlatList
        ref={list}
        data={photos}
        horizontal
        pagingEnabled
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <Page photo={item} />}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        showsHorizontalScrollIndicator={false}
      />
      <View style={{ position: 'absolute', top: insets.top, left: Space.sm, right: Space.md, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="xmark" size={22} tintColor={Colors.onCamera} />
        </Pressable>
        <Mono color={Colors.onCamera} style={{ flex: 1, textAlign: 'center' }}>{index + 1} / {photos.length}</Mono>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + Space.sm, paddingHorizontal: Space.md, gap: Space.md, backgroundColor: 'rgba(11,11,13,0.6)', paddingTop: Space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Stamp photo={current} initials={current.takerInitials} tone="dark" size={13} />
          <Mono size={11} color={current.syncState === 'synced' ? Colors.ok : current.syncState === 'failed' ? Colors.flag : Colors.onCamera}>
            {current.syncState.toUpperCase()}
          </Mono>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Action name="square.and.arrow.up" label="Share" onPress={share} />
          <Action name="square.and.arrow.down" label="Save" onPress={save} />
          <Action name="trash" label="Delete" onPress={remove} tint={Colors.flag} />
        </View>
      </View>
    </View>
  );
}
