import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Empty } from '@/components/empty';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { getLastFix, useJob } from '@/lib/jobs';
import { atPhotoCap, importFromLibrary } from '@/lib/photos';
import { effectiveTier, limitsFor } from '@/lib/plan';
import { useCompany } from '@/lib/company';

const COLS = 3;
const GAP = 2;
const TILE = Math.floor((Dimensions.get('window').width - GAP * (COLS - 1)) / COLS);

/** Pick photos already on the phone and file them to this job. Before-photos keep their original day. */
export default function ImportPhotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const job = useJob(id);
  const company = useCompany();
  const [perm, requestPerm] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const load = useCallback(async () => {
    const page = await MediaLibrary.getAssetsAsync({ mediaType: 'photo', first: 120, sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    setAssets(page.assets);
  }, []);

  useEffect(() => {
    track('import_opened');
    if (perm?.granted) void load();
  }, [perm?.granted, load]);

  const ask = async () => {
    const r = await requestPerm();
    if (!r.granted && !r.canAskAgain) Linking.openSettings();
  };

  const toggle = (aid: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(aid)) n.delete(aid);
      else n.add(aid);
      return n;
    });

  const run = async () => {
    if (!id || !selected.size) return;
    const cap = limitsFor(effectiveTier(company?.tier ?? null, true)).photosPerJob;
    setBusy(true);
    let count = 0;
    try {
      for (const aid of assets.filter((a) => selected.has(a.id)).map((a) => a.id)) {
        if (await atPhotoCap(id, cap)) {
          Alert.alert('Photo limit reached', `${cap} photos per job on your plan. ${count} imported.`);
          break;
        }
        await importFromLibrary(id, aid, getLastFix());
        count++;
        setDone(count);
      }
      track('photos_imported', { count });
      router.back();
    } catch (e) {
      Alert.alert('Import stopped', e instanceof Error && e.message === 'no_company' ? 'Sign in again to keep going.' : `${count} imported. Try the rest again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md, paddingVertical: Space.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" testID="import-back">
          <SymbolView name="chevron.left" size={22} tintColor={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading size={26} bold>Import photos</Heading>
          <Mono size={11} color={Colors.ink2} numberOfLines={1}>{(job?.name ?? '').toUpperCase()} · {selected.size} SELECTED</Mono>
        </View>
        {assets.length ? (
          <Pressable onPress={() => setSelected(selected.size === assets.length ? new Set() : new Set(assets.map((a) => a.id)))} accessibilityRole="button" hitSlop={8} testID="import-select-all">
            <Mono size={12} bold>{selected.size === assets.length ? 'NONE' : 'SELECT ALL'}</Mono>
          </Pressable>
        ) : null}
      </View>
      {!perm?.granted ? (
        <Empty title="Photos access is off." body="Crew Lens needs to read your library to file existing photos to this job. Nothing is uploaded until you pick it." action={{ title: 'Allow photos', onPress: ask }} />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
          renderItem={({ item }) => {
            const on = selected.has(item.id);
            return (
              <Pressable onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`asset-${item.id}`} style={{ width: TILE, height: TILE, backgroundColor: Colors.hairline }}>
                <Image source={{ uri: item.uri }} style={{ width: TILE, height: TILE }} contentFit="cover" />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: TILE, height: TILE, backgroundColor: on ? 'rgba(232,82,30,0.28)' : 'transparent', alignItems: 'flex-end', padding: 6 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.onCamera, backgroundColor: on ? Colors.flag : 'rgba(11,11,13,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <SymbolView name="checkmark" size={12} tintColor={Colors.onCamera} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Empty title="No photos on this phone yet." />}
        />
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.md, paddingBottom: insets.bottom + Space.md, backgroundColor: Colors.canvas, borderTopWidth: 1, borderColor: Colors.hairline, gap: 4 }}>
        <Button title={busy ? `Importing ${done} of ${selected.size}…` : selected.size ? `Import ${selected.size} ${selected.size === 1 ? 'photo' : 'photos'}` : 'Pick photos to import'} onPress={run} loading={busy} disabled={!selected.size} testID="import-run" />
        <Body size={11} color={Colors.ink2} style={{ textAlign: 'center' }}>Imported photos keep the day they were taken and get your initials. Originals stay in your library.</Body>
      </View>
    </View>
  );
}
