import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty } from '@/components/empty';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useJobs } from '@/lib/jobs';
import { describeExpiry, linkUrl, listLinks, revokeLink } from '@/lib/links';
import { useVersion } from '@/lib/store';
import { timeAgo } from '@/lib/time';
import type { ShareLink } from '@/types/models';

function Row({ link, jobName, onCopy, onRevoke, onOpenJob }: { link: ShareLink; jobName: string; onCopy: () => void; onRevoke: () => void; onOpenJob: () => void }) {
  const dead = !!link.revokedAt || describeExpiry(link.expiresAt) === 'Expired';
  return (
    <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, padding: Space.sm, gap: 6, opacity: dead ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <SymbolView name={link.type === 'live' ? 'dot.radiowaves.left.and.right' : 'photo.on.rectangle'} size={18} tintColor={dead ? Colors.ink2 : Colors.slate} />
        <Pressable onPress={onOpenJob} accessibilityRole="link" style={{ flex: 1 }}>
          <Heading size={18} numberOfLines={1}>{jobName}</Heading>
          <Mono size={10} color={Colors.ink2}>
            {link.type === 'live' ? 'Live link' : 'Gallery'} · {timeAgo(link.createdAt)} · {link.revokedAt ? 'Revoked' : describeExpiry(link.expiresAt)}
          </Mono>
        </Pressable>
      </View>
      <Mono size={11} numberOfLines={1} color={Colors.slate}>{linkUrl(link.token)}</Mono>
      {!dead ? (
        <View style={{ flexDirection: 'row', gap: Space.sm }}>
          <Pressable onPress={onCopy} accessibilityRole="button" testID={`link-copy-${link.id}`} style={{ flex: 1, height: 36, borderRadius: Radius.card, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Heading size={14} color={Colors.surface}>Copy link</Heading>
          </Pressable>
          <Pressable onPress={onRevoke} accessibilityRole="button" testID={`link-revoke-${link.id}`} style={{ flex: 1, height: 36, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
            <Heading size={14} color={Colors.danger}>Revoke</Heading>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Every link the company has sent, with copy and revoke. Loads from the server; works read-only offline. */
export default function Shared() {
  const insets = useSafeAreaInsets();
  const jobs = useJobs();
  const v = useVersion();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLinks(await listLinks());
    } catch {
      setLinks((l) => l ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, v]);

  const name = (id: string) => jobs.find((j) => j.id === id)?.name ?? 'Job';
  const copy = async (l: ShareLink) => {
    const url = linkUrl(l.token);
    await Clipboard.setStringAsync(url);
    track('link_copied', { type: l.type, from: 'shared_tab' });
    await Share.share({ message: `${name(l.jobId)} — photos from Crew Lens: ${url}`, url }).catch(() => null);
  };
  const revoke = (l: ShareLink) =>
    Alert.alert('Revoke this link?', 'Anyone who has it will see "expired". You can make a new one from the job.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => revokeLink(l.id).then(load).then(() => track('link_revoked', { type: l.type })).catch(() => Alert.alert('Could not revoke', 'Check your connection.')) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: Space.md, paddingTop: Space.sm, paddingBottom: Space.sm }}>
        <Heading size={30} bold>Shared</Heading>
        <Body size={13} color={Colors.ink2}>Every link you have sent. Copy it again or shut it off.</Body>
      </View>
      <FlatList
        data={links ?? []}
        keyExtractor={(l) => l.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={Colors.slate} />}
        contentContainerStyle={{ paddingHorizontal: Space.md, paddingBottom: 120, gap: Space.sm, flexGrow: 1 }}
        renderItem={({ item }) => <Row link={item} jobName={name(item.jobId)} onCopy={() => copy(item)} onRevoke={() => revoke(item)} onOpenJob={() => router.push({ pathname: '/job/[id]', params: { id: item.jobId } })} />}
        ListEmptyComponent={
          links === null ? null : (
            <Empty title="No links yet." body="Open a job, tap Share, and send the client one live link. It shows up here." action={jobs[0] ? { title: `Share ${jobs[0].name}`, onPress: () => router.push({ pathname: '/job/[id]', params: { id: jobs[0].id } }) } : undefined} />
          )
        }
      />
    </View>
  );
}
