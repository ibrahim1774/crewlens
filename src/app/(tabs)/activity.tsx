import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty } from '@/components/empty';
import { usePhotoUri } from '@/components/photo-tile';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { dayLabel, useActivity, type ActivityItem } from '@/lib/activity';
import { timeAgo } from '@/lib/time';
import type { Photo } from '@/types/models';

function Thumb({ photo, size }: { photo: Photo; size: number }) {
  const uri = usePhotoUri(photo, 'thumb');
  return (
    <View style={{ width: size, height: size, borderRadius: Radius.chip, backgroundColor: Colors.hairline, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" /> : null}
      {photo.syncState !== 'synced' ? <View style={{ position: 'absolute', right: 4, top: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1, borderColor: Colors.onCamera }} /> : null}
    </View>
  );
}

/** Who took the photos, by initials; documents carry no initials, so they get a document mark. */
function Avatar({ initials }: { initials: string | null }) {
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
      {initials === null ? (
        <SymbolView name="doc.text" size={15} tintColor={Colors.onCamera} />
      ) : (
        <Mono size={10} color={Colors.onCamera} bold>{initials || '—'}</Mono>
      )}
    </View>
  );
}

function Card({ item }: { item: ActivityItem }) {
  const open = () => {
    if (item.kind === 'photos') router.push({ pathname: '/photo/[id]', params: { id: item.photos[0].id, jobId: item.job.id } });
    else router.push({ pathname: '/document/[id]', params: { id: item.doc.id } });
  };
  const toJob = () => router.push({ pathname: '/job/[id]', params: { id: item.job.id } });
  const size = 64;
  return (
    <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, padding: Space.sm, gap: Space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Avatar initials={item.kind === 'photos' ? item.initials : null} />
        <View style={{ flex: 1 }}>
          <Heading size={17} numberOfLines={1}>
            {item.kind === 'photos'
              ? `${item.initials || 'Someone'} added ${item.photos.length} ${item.photos.length === 1 ? 'photo' : 'photos'}`
              : item.event === 'sent'
                ? `Invoice sent by ${item.doc.sentVia ?? 'share'}`
                : item.event === 'edited'
                  ? `Document edited · V${item.doc.version}`
                  : 'Document added'}
          </Heading>
          <Pressable onPress={toJob} accessibilityRole="link" hitSlop={6}>
            <Mono size={11} color={Colors.slate} numberOfLines={1}>{item.job.name} · {timeAgo(item.at)}</Mono>
          </Pressable>
        </View>
      </View>
      {item.kind === 'photos' ? (
        <Pressable onPress={open} accessibilityRole="button" style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {item.photos.slice(0, 5).map((p) => (
            <Thumb key={p.id} photo={p} size={size} />
          ))}
          {item.photos.length > 5 ? (
            <View style={{ width: size, height: size, borderRadius: Radius.chip, backgroundColor: Colors.canvas, borderWidth: 1, borderColor: Colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
              <Mono size={12} bold>+{item.photos.length - 5}</Mono>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <Pressable onPress={open} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.sm, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.canvas }}>
          <View style={{ width: 30, height: 38, borderRadius: 3, backgroundColor: item.doc.kind === 'pdf' ? Colors.ink : Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
            <Mono size={8} color={Colors.onCamera} bold>{item.doc.kind === 'pdf' ? 'PDF' : 'IMG'}</Mono>
          </View>
          <View style={{ flex: 1 }}>
            <Heading size={15} numberOfLines={1}>{item.doc.name}</Heading>
            <Mono size={10} color={Colors.ink2}>{item.doc.sentTo ? `To ${item.doc.sentTo} · ` : ''}{item.doc.pages ? `${item.doc.pages} ${item.doc.pages === 1 ? 'page' : 'pages'} · ` : ''}Version {item.doc.version}</Mono>
          </View>
          <SymbolView name="chevron.right" size={12} tintColor={Colors.ink2} />
        </Pressable>
      )}
    </View>
  );
}

/** Day-by-day stream of what the crew shot and sent, across every job. */
export default function Activity() {
  const insets = useSafeAreaInsets();
  const items = useActivity();
  const sections = useMemo(() => {
    const out: { key: string; title: string; data: ActivityItem[] }[] = [];
    for (const it of items) {
      const title = dayLabel(it.at);
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(it);
      else out.push({ key: `${title}-${it.key}`, title, data: [it] });
    }
    return out;
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: Space.md, paddingTop: Space.sm, paddingBottom: Space.sm }}>
        <Heading size={30} bold>Activity</Heading>
        <Body size={13} color={Colors.ink2}>What your crew shot and sent, every job, newest first.</Body>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: Space.md, paddingBottom: 120, gap: Space.sm, flexGrow: 1 }}
        renderSectionHeader={({ section }) => <Mono size={11} color={Colors.ink2} style={{ paddingTop: Space.sm }}>{section.title}</Mono>}
        renderItem={({ item }) => <Card item={item} />}
        ListEmptyComponent={<Empty title="Nothing yet." body="Photos and documents show up here the moment anyone on the crew adds them." action={{ title: 'Open camera', onPress: () => router.push('/camera') }} />}
      />
    </View>
  );
}
