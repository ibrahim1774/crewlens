import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Empty } from '@/components/empty';
import { Sheet, SheetRow } from '@/components/sheet';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { deleteDocument, docsAllowed, DocumentsNotAllowed, formatSize, pickAndImport, pullDocuments, rename, useDocuments } from '@/lib/documents';
import { useJob } from '@/lib/jobs';
import { useVersion } from '@/lib/store';
import type { Doc } from '@/types/models';

function sentLabel(d: Doc): string | null {
  if (!d.sentAt || !d.sentVia) return null;
  const when = new Date(d.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `SENT · ${d.sentVia.toUpperCase()} · ${when}`;
}

function DocRow({ doc, onPress, onMore }: { doc: Doc; onPress: () => void; onMore: () => void }) {
  const sent = sentLabel(doc);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      testID={`doc-${doc.id}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: Space.md, padding: Space.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 52, height: 64, borderRadius: Radius.chip, backgroundColor: doc.kind === 'pdf' ? Colors.ink : Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
        <Mono size={11} color={Colors.onCamera} bold>{doc.kind === 'pdf' ? 'PDF' : 'IMG'}</Mono>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
        <Heading size={19} numberOfLines={1}>{doc.name}</Heading>
        <Mono size={11}>
          {doc.pages ? `${doc.pages} ${doc.pages === 1 ? 'PAGE' : 'PAGES'} · ` : ''}{formatSize(doc.sizeBytes)} · V{doc.version}
        </Mono>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          {sent ? <Mono size={11} color={Colors.ok} bold>{sent}</Mono> : <Mono size={11} color={Colors.ink2}>NOT SENT YET</Mono>}
          {doc.syncState !== 'synced' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: doc.syncState === 'failed' ? Colors.flag : Colors.hairline }} /> : null}
        </View>
      </View>
      <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel="More" style={{ justifyContent: 'center', paddingHorizontal: Space.xs }}>
        <SymbolView name="ellipsis" size={18} tintColor={Colors.ink2} />
      </Pressable>
    </Pressable>
  );
}

export default function Documents() {
  const { id, pick } = useLocalSearchParams<{ id: string; pick?: string }>();
  const insets = useSafeAreaInsets();
  const job = useJob(id);
  const docs = useDocuments(id);
  useVersion();
  const allowed = docsAllowed();
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState<Doc | null>(null);
  const autoPicked = useRef(false);

  useEffect(() => {
    track('documents_opened', { count: docs.length });
    if (id) pullDocuments(id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const upload = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const doc = await pickAndImport(id);
      if (doc) {
        track('document_uploaded', { kind: doc.kind, size: doc.sizeBytes ?? 0 });
        router.push({ pathname: '/document/[id]', params: { id: doc.id } });
      }
    } catch (e) {
      if (e instanceof DocumentsNotAllowed) Alert.alert('Documents are on Pro', 'Upgrade to upload, edit and send paperwork.');
      else Alert.alert('Could not add that file', e instanceof Error && e.message === 'unsupported_type' ? 'Use a PDF, JPEG or PNG.' : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (pick === '1' && allowed && !autoPicked.current) {
      autoPicked.current = true;
      void upload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, allowed]);

  const confirmDelete = (doc: Doc) => {
    setMore(null);
    Alert.alert('Delete document?', `${doc.name} and every version of it will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(doc.id).then(() => track('document_deleted')) },
    ]);
  };

  const renameDoc = (doc: Doc) => {
    setMore(null);
    Alert.prompt('Rename', undefined, (name) => name && rename(doc.id, name), 'plain-text', doc.name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md, paddingVertical: Space.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" testID="docs-back">
          <SymbolView name="chevron.left" size={22} tintColor={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading size={26} bold>Documents</Heading>
          <Mono size={11} color={Colors.ink2} numberOfLines={1}>{(job?.name ?? '').toUpperCase()} · {docs.length} {docs.length === 1 ? 'FILE' : 'FILES'}</Mono>
        </View>
        {allowed ? (
          <Pressable onPress={upload} accessibilityRole="button" testID="docs-upload" disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: Space.md, borderRadius: Radius.card, backgroundColor: Colors.flag, opacity: busy ? 0.6 : 1 }}>
            <SymbolView name="plus" size={14} tintColor={Colors.surface} />
            <Heading size={15} color={Colors.surface}>Upload</Heading>
          </Pressable>
        ) : null}
      </View>

      {!allowed ? (
        <View style={{ margin: Space.md, padding: Space.md, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, gap: Space.sm }}>
          <Mono size={11} color={Colors.flag} bold>PRO FEATURE</Mono>
          <Heading size={24} bold>Keep the paperwork with the photos.</Heading>
          <Body color={Colors.ink2}>Upload the invoice, proposal or contract for this job, edit and sign it on your phone, then text or email it to the client. Included in Pro and Crew.</Body>
          <Button title="See plans" onPress={() => router.push({ pathname: '/(auth)/paywall', params: { upgrade: '1' } })} testID="docs-upgrade" />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: Space.md, gap: Space.sm, flexGrow: 1 }}
          renderItem={({ item }) => <DocRow doc={item} onPress={() => router.push({ pathname: '/document/[id]', params: { id: item.id } })} onMore={() => setMore(item)} />}
          ListEmptyComponent={<Empty title="No documents yet." body="Upload an invoice, proposal, contract or permit. Edit and sign it here, then send it by text or email." />}
        />
      )}

      <Sheet visible={!!more} onClose={() => setMore(null)} title={more?.name}>
        <SheetRow title="Open" onPress={() => { const d = more; setMore(null); if (d) router.push({ pathname: '/document/[id]', params: { id: d.id } }); }} />
        <SheetRow title="Rename" onPress={() => more && renameDoc(more)} />
        <SheetRow title="Delete" subtitle="Removes every version for everyone" destructive onPress={() => more && confirmDelete(more)} />
      </Sheet>
    </View>
  );
}
