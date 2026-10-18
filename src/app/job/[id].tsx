import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Pressable, SectionList, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Empty } from '@/components/empty';
import { PhotoTile, usePhotoUri } from '@/components/photo-tile';
import { Sheet, SheetRow } from '@/components/sheet';
import { useDocuments } from '@/lib/documents';
import { Body, Heading, Mono } from '@/components/text';
import { TIER_LABEL } from '@/constants/limits';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useCompany } from '@/lib/company';
import { archiveJob, deleteJob, unarchiveJob, useJob } from '@/lib/jobs';
import { createGalleryLink, getOrCreateLiveLink, linkUrl } from '@/lib/links';
import { groupByDay, pullPhotos, useJobPhotos } from '@/lib/photos';
import { effectiveTier, limitsFor } from '@/lib/plan';
import { LimitError } from '@/lib/supabase';
import { retryFailed } from '@/lib/uploader';
import type { Photo } from '@/types/models';

const COLS = 3;
const GAP = 2;
const { width: W } = Dimensions.get('window');
const TILE = Math.floor((W - GAP * (COLS - 1)) / COLS);

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function ActionButton({ name, label, onPress, testID }: { name: string; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: Space.sm, opacity: pressed ? 0.6 : 1 })}>
      <SymbolView name={name as never} size={22} tintColor={Colors.ink} />
      <Heading size={13}>{label}</Heading>
    </Pressable>
  );
}

export default function JobScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const photos = useJobPhotos(id);
  const company = useCompany();
  const tier = effectiveTier(company?.tier ?? null, true);
  const docCount = useDocuments(job?.id).length;
  const [share, setShare] = useState(false);
  const [more, setMore] = useState(false);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) pullPhotos(id).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const sections = useMemo(() => groupByDay(photos).map((g) => ({ key: g.key, title: g.label, data: chunk(g.photos, COLS) })), [photos]);
  const failedPhotos = photos.filter((p) => p.syncState === 'failed');
  const failed = failedPhotos.length;
  const capped = failedPhotos.some((p) => p.lastError?.includes('limit_photos_per_project'));
  const cover = photos.find((p) => p.id === job?.coverPhotoId) ?? photos[0];
  const archived = job?.status === 'archived';

  const liveLink = async () => {
    if (!job) return;
    setLinking(true);
    try {
      const link = await getOrCreateLiveLink(job.id);
      const url = linkUrl(link.token);
      await Clipboard.setStringAsync(url);
      setShare(false);
      setCopied(true);
      track('link_created', { type: 'live' });
      await Share.share({ message: `${job.name} — live photos from ${company?.name ?? 'Crew Lens'}: ${url}`, url });
    } catch (e) {
      Alert.alert('Could not create link', e instanceof Error ? e.message : 'Check your connection and try again.');
    } finally {
      setLinking(false);
    }
  };

  const toggleSelect = (pid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  const selectAll = () => setSelected(new Set(photos.map((p) => p.id)));
  const startPicking = () => {
    setShare(false);
    setSelected(new Set());
    setSelecting(true);
    track('gallery_pick_started');
  };
  const cancelPicking = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const galleryLink = async () => {
    if (!job || !selected.size) return;
    setLinking(true);
    try {
      const link = await createGalleryLink(job.id, photos.filter((p) => selected.has(p.id)).map((p) => p.id));
      const url = linkUrl(link.token);
      await Clipboard.setStringAsync(url);
      setCopied(true);
      track('link_created', { type: 'gallery', photos: selected.size });
      cancelPicking();
      await Share.share({ message: `${job.name} — ${selected.size} photos from ${company?.name ?? 'Crew Lens'}: ${url}`, url });
    } catch (e) {
      Alert.alert('Could not create link', e instanceof Error ? e.message : 'Check your connection and try again.');
    } finally {
      setLinking(false);
    }
  };

  const toggleArchive = async () => {
    if (!job) return;
    setMore(false);
    try {
      if (archived) await unarchiveJob(job.id);
      else await archiveJob(job.id);
    } catch (e) {
      if (e instanceof LimitError) Alert.alert(`${TIER_LABEL[tier]} allows ${e.limit ?? limitsFor(tier).activeJobs} active jobs`, 'Archive another job first.');
    }
  };

  const remove = () => {
    if (!job) return;
    setMore(false);
    Alert.alert('Delete job?', `This deletes ${job.name} and all ${photos.length} photos for everyone. Archive keeps them.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteJob(job.id).then(() => router.back()) },
    ]);
  };

  if (!job) return <View style={{ flex: 1, backgroundColor: Colors.canvas }} />;

  const header = (
    <View>
      <View style={{ height: 240, backgroundColor: Colors.ink }}>
        {cover ? <PhotoCover photo={cover} /> : null}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.md, paddingTop: 60, backgroundColor: 'rgba(11,11,13,0.45)' }}>
          <Heading size={30} bold color={Colors.surface} numberOfLines={2}>{job.name}</Heading>
          <Body size={13} color="rgba(247,246,242,0.8)" numberOfLines={1}>{job.address || 'No address'}</Body>
          <Mono size={11} color={Colors.onCamera} style={{ marginTop: 4 }}>
            {photos.length} {photos.length === 1 ? 'PHOTO' : 'PHOTOS'}{archived ? ' · ARCHIVED' : ''}{job.clientName ? ` · ${job.clientName.toUpperCase()}` : ''}
          </Mono>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ position: 'absolute', top: insets.top, left: Space.sm, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="chevron.left" size={22} tintColor={Colors.onCamera} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.hairline, backgroundColor: Colors.surface }}>
        {!archived ? <ActionButton name="camera.fill" label="Camera" testID="job-camera" onPress={() => router.push({ pathname: '/camera', params: { jobId: job.id } })} /> : null}
        <ActionButton name="link" label={copied ? 'Copied' : 'Share'} testID="job-share" onPress={() => setShare(true)} />
        <ActionButton name="doc.text" label={docCount ? `Docs · ${docCount}` : 'Docs'} testID="job-docs" onPress={() => router.push({ pathname: '/job/[id]/documents', params: { id: job.id } })} />
        <ActionButton name="ellipsis" label="More" testID="job-more" onPress={() => setMore(true)} />
      </View>
      {selecting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.sm, paddingHorizontal: Space.md, backgroundColor: Colors.ink }} testID="gallery-bar">
          <Pressable onPress={cancelPicking} accessibilityRole="button" hitSlop={8} testID="gallery-cancel">
            <Mono size={12} color={Colors.onCamera} bold>CANCEL</Mono>
          </Pressable>
          <Mono size={12} color={Colors.onCamera} style={{ flex: 1, textAlign: 'center' }}>{selected.size} OF {photos.length} SELECTED</Mono>
          <Pressable onPress={selected.size === photos.length ? () => setSelected(new Set()) : selectAll} accessibilityRole="button" hitSlop={8} testID="gallery-select-all">
            <Mono size={12} color={Colors.onCamera} bold>{selected.size === photos.length ? 'NONE' : 'SELECT ALL'}</Mono>
          </Pressable>
        </View>
      ) : null}
      {failed > 0 ? (
        <Pressable onPress={() => (capped ? router.push({ pathname: '/job/new', params: { returnTo: 'job' } }) : retryFailed())} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderColor: Colors.hairline }}>
          <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={Colors.flag} />
          <Body size={13} style={{ flex: 1 }}>
            {capped ? `${TIER_LABEL[tier]} allows ${limitsFor(tier).photosPerJob} photos per job. ${failed} did not upload.` : `${failed} ${failed === 1 ? 'photo' : 'photos'} failed to upload.`}
          </Body>
          <Heading size={14} color={Colors.flag}>{capped ? 'New job' : 'Retry'}</Heading>
        </Pressable>
      ) : null}
      {job.syncError ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderColor: Colors.hairline }}>
          <SymbolView name="icloud.slash" size={16} tintColor={Colors.flag} />
          <Body size={13} style={{ flex: 1 }}>This job is over your active-job cap and is not syncing. Archive another job to free a slot.</Body>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((p) => p.id).join('|')}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Space.xl }}
        renderSectionHeader={({ section }) => (
          <Mono size={11} color={Colors.ink2} style={{ paddingHorizontal: Space.md, paddingTop: Space.md, paddingBottom: Space.xs }}>{section.title}</Mono>
        )}
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {row.map((p: Photo) => (
              <View key={p.id}>
                <PhotoTile photo={p} size={TILE} onPress={() => (selecting ? toggleSelect(p.id) : router.push({ pathname: '/photo/[id]', params: { id: p.id, jobId: job.id } }))} onRetry={() => retryFailed()} />
                {selecting ? (
                  <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: TILE, height: TILE, backgroundColor: selected.has(p.id) ? 'rgba(232,82,30,0.28)' : 'rgba(11,11,13,0.25)', alignItems: 'flex-end', padding: 6 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.onCamera, backgroundColor: selected.has(p.id) ? Colors.flag : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {selected.has(p.id) ? <SymbolView name="checkmark" size={12} tintColor={Colors.onCamera} /> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Empty
            title={archived ? 'No photos on this job.' : 'No photos yet.'}
            body={archived ? undefined : 'Open the camera and this job is already selected.'}
            action={archived ? undefined : { title: 'Open camera', onPress: () => router.push({ pathname: '/camera', params: { jobId: job.id } }) }}
          />
        }
      />

      {selecting ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.md, paddingBottom: insets.bottom + Space.md, backgroundColor: Colors.canvas, borderTopWidth: 1, borderColor: Colors.hairline }}>
          <Button title={selected.size ? `Share ${selected.size} ${selected.size === 1 ? 'photo' : 'photos'} as a link` : 'Pick the photos to share'} onPress={galleryLink} loading={linking} disabled={!selected.size} testID="gallery-share" />
        </View>
      ) : null}

      <Sheet visible={share} onClose={() => setShare(false)} title="Share this job">
        <SheetRow
          title={linking ? 'Creating link…' : 'Live link to this job'}
          subtitle={archived ? 'Frozen at archive time; still works' : limitsFor(tier).linkDays ? `Always shows the latest photos · expires in ${limitsFor(tier).linkDays} days` : 'Always shows the latest photos · never expires'}
          onPress={liveLink}
          disabled={linking}
        />
        <SheetRow title="Pick photos" subtitle={photos.length ? 'Choose some or select all. A fixed set the client keeps.' : 'Take a photo first'} onPress={photos.length ? startPicking : undefined} disabled={!photos.length} testID="share-pick" />
        <Button title="Cancel" variant="ghost" onPress={() => setShare(false)} style={{ marginTop: Space.sm }} />
      </Sheet>

      <Sheet visible={more} onClose={() => setMore(false)} title={job.name}>
        {!archived ? <SheetRow title="Import from Photos" subtitle="File photos you already took to this job" onPress={() => { setMore(false); router.push({ pathname: '/job/[id]/import', params: { id: job.id } }); }} testID="job-import" /> : null}
        <SheetRow title="Edit details" onPress={() => { setMore(false); router.push({ pathname: '/job/edit', params: { id: job.id } }); }} />
        <SheetRow title={archived ? 'Unarchive' : 'Archive'} subtitle={archived ? 'Counts toward active jobs again' : 'Keeps every photo, frees an active slot, freezes live links'} onPress={toggleArchive} />
        <SheetRow title="Delete job" subtitle="Removes every photo for everyone" destructive onPress={remove} />
        <Button title="Cancel" variant="ghost" onPress={() => setMore(false)} style={{ marginTop: Space.sm }} />
      </Sheet>
    </View>
  );
}

function PhotoCover({ photo }: { photo: Photo }) {
  const uri = usePhotoUri(photo, 'full');
  return uri ? <Image source={{ uri }} style={{ width: '100%', height: 240, borderRadius: Radius.chip }} contentFit="cover" /> : null;
}
