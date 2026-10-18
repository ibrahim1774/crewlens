import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Sheet, SheetRow } from '@/components/sheet';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { getCompany, getMember, initialsFor } from '@/lib/company';
import { ensureLocal, markSent, saveVersion, setPages, useDocument } from '@/lib/documents';
import { getLastFix } from '@/lib/jobs';
import { buildEditorHtml, type EditorTool } from '@/lib/pdf-editor-html';
import { stampLines } from '@/lib/stamp';
import type { Doc, SentVia } from '@/types/models';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFJS_LIB = require('@/assets/pdfjs/pdf.min.pdfjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFJS_WORKER = require('@/assets/pdfjs/pdf.worker.min.pdfjs');

let pdfjsCache: Promise<{ pdfjs: string; worker: string }> | null = null;
/** pdf.js ships inside the app under a private extension; read once, inlined into the editor page. */
function loadPdfjs() {
  if (!pdfjsCache) {
    pdfjsCache = (async () => {
      const [a, b] = await Promise.all([
        Asset.fromModule(PDFJS_LIB).downloadAsync(),
        Asset.fromModule(PDFJS_WORKER).downloadAsync(),
      ]);
      return { pdfjs: await new File(a.localUri!).text(), worker: await new File(b.localUri!).text() };
    })();
  }
  return pdfjsCache;
}

type ExportedPage = { index: number; wpt: number; hpt: number; data: string };

const TOOLS: { tool: EditorTool; icon: string; label: string }[] = [
  { tool: 'text', icon: 'textformat', label: 'Text' },
  { tool: 'check', icon: 'checkmark', label: 'Check' },
  { tool: 'date', icon: 'calendar', label: 'Date' },
  { tool: 'sign', icon: 'signature', label: 'Sign' },
  { tool: 'stamp', icon: 'mappin.and.ellipse', label: 'Stamp' },
];

function ToolButton({ icon, label, on, onPress, testID }: { icon: string; label: string; on?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} testID={testID} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, paddingVertical: Space.sm, borderRadius: Radius.card, backgroundColor: on ? Colors.flag : 'transparent', opacity: pressed ? 0.6 : 1 })}>
      <SymbolView name={icon as never} size={20} tintColor={on ? Colors.surface : Colors.ink} />
      <Mono size={10} color={on ? Colors.surface : Colors.ink2}>{label}</Mono>
    </Pressable>
  );
}

export default function DocumentEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const doc = useDocument(id);
  const web = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>('none');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [send, setSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exported = useRef<ExportedPage[]>([]);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    track('document_opened', { kind: doc?.kind ?? null, version: doc?.version ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!doc || loadedFor.current === `${doc.id}:${doc.version}`) return;
    loadedFor.current = `${doc.id}:${doc.version}`;
    (async () => {
      try {
        const uri = await ensureLocal(doc);
        const [base64, lib] = await Promise.all([new File(uri).base64(), loadPdfjs()]);
        const fix = getLastFix();
        const lines = stampLines({ takenAt: new Date().toISOString(), lat: fix?.lat ?? null, lng: fix?.lng ?? null }, initialsFor(getMember()?.displayName ?? 'You'));
        setHtml(buildEditorHtml({ kind: doc.kind, base64, mime: doc.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', pdfjsSource: lib.pdfjs, workerSource: lib.worker, accent: Colors.ink, ink: Colors.ink, stampLines: lines }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load_failed');
      }
    })();
  }, [doc]);

  const run = useCallback((cmd: string, arg?: string) => {
    web.current?.injectJavaScript(`window.__crew && window.__crew(${JSON.stringify(cmd)}, ${JSON.stringify(arg ?? null)}); true;`);
  }, []);

  const pick = (t: EditorTool) => {
    const next = tool === t ? 'none' : t;
    setTool(next);
    run('tool', next);
  };

  const finishSave = useCallback(
    async (d: Doc) => {
      const pages = [...exported.current].sort((a, b) => a.index - b.index);
      exported.current = [];
      if (!pages.length) throw new Error('no_pages');
      const body = pages
        .map((p) => `<div style="width:${p.wpt}pt;height:${p.hpt}pt;page-break-after:always;overflow:hidden"><img src="${p.data}" style="width:${p.wpt}pt;height:${p.hpt}pt;display:block"/></div>`)
        .join('');
      const out = await Print.printToFileAsync({ html: `<html><head><meta charset="utf-8"><style>@page{margin:0}body{margin:0}</style></head><body>${body}</body></html>`, width: pages[0].wpt, height: pages[0].hpt, margins: { left: 0, top: 0, right: 0, bottom: 0 } });
      const fresh = await saveVersion(d.id, out.uri, pages.length);
      track('document_saved', { version: fresh.version, pages: pages.length });
      setDirty(false);
    },
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (m.type === 'ready') setReady(true);
      if (m.type === 'pages' && doc && typeof m.count === 'number' && doc.pages !== m.count) void setPages(doc.id, m.count);
      if (m.type === 'dirty') setDirty(!!m.dirty);
      if (m.type === 'tool') setTool(m.tool as EditorTool);
      if (m.type === 'page') exported.current.push({ index: m.index as number, wpt: m.wpt as number, hpt: m.hpt as number, data: m.data as string });
      if (m.type === 'exported' && doc) {
        finishSave(doc)
          .catch(() => Alert.alert('Could not save', 'Try again.'))
          .finally(() => setSaving(false));
      }
      if (m.type === 'error') {
        setSaving(false);
        setError(String(m.message));
      }
    },
    [doc, finishSave],
  );

  const save = () => {
    if (!dirty || saving) return;
    setSaving(true);
    exported.current = [];
    run('deselect');
    run('export');
  };

  const close = () => {
    if (dirty) {
      Alert.alert('Discard changes?', 'Save first to keep what you added.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  };

  const record = (via: SentVia) => {
    if (!doc) return;
    track('document_sent', { via });
    Alert.prompt('Who did you send it to?', 'Kept on the document for the record.', [
      { text: 'Skip', style: 'cancel', onPress: () => void markSent(doc.id, via, null) },
      { text: 'Save', onPress: (to?: string) => void markSent(doc.id, via, to?.trim() || null) },
    ], 'plain-text');
  };

  const sendVia = async (via: SentVia) => {
    if (!doc?.localUri) return;
    setSend(false);
    if (dirty) {
      Alert.alert('Save first', 'Your edits are not in the file yet. Save, then send.');
      return;
    }
    const company = getCompany();
    const filename = `${doc.name}.${doc.kind === 'pdf' ? 'pdf' : 'jpg'}`;
    const mime = doc.kind === 'pdf' ? 'application/pdf' : 'image/jpeg';
    const message = `${doc.name} from ${company?.name ?? 'Crew Lens'}`;
    try {
      if (via === 'text') {
        if (!(await SMS.isAvailableAsync())) {
          Alert.alert('Messages is not available on this device.');
          return;
        }
        const { result } = await SMS.sendSMSAsync([], message, { attachments: { uri: doc.localUri, mimeType: mime, filename } });
        if (result === 'sent' || result === 'unknown') record('text');
        return;
      }
      if (via === 'email') {
        if (!(await MailComposer.isAvailableAsync())) {
          Alert.alert('Mail is not set up on this device.', 'Use Share instead.');
          return;
        }
        const { status } = await MailComposer.composeAsync({ subject: message, body: `Attached: ${filename}`, attachments: [doc.localUri] });
        if (status === 'sent') record('email');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(doc.localUri, { mimeType: mime, UTI: doc.kind === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg', dialogTitle: filename });
        record('share');
      }
    } catch {
      // Composer dismissed.
    }
  };

  const source = useMemo(() => (html ? { html, baseUrl: 'https://editor.crewlens.app/' } : null), [html]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md, paddingVertical: Space.sm }}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" testID="doc-close">
          <SymbolView name="xmark" size={20} tintColor={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading size={20} numberOfLines={1}>{doc?.name ?? 'Document'}</Heading>
          <Mono size={10} color={Colors.ink2}>{doc ? `Version ${doc.version}${doc.pages ? ` · ${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'}` : ''}${dirty ? ' · Unsaved' : ''}` : ''}</Mono>
        </View>
        <Pressable onPress={() => run('undo')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Undo" testID="doc-undo" style={{ padding: 6 }}>
          <SymbolView name="arrow.uturn.backward" size={18} tintColor={Colors.ink} />
        </Pressable>
        <Pressable onPress={() => setSend(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send" testID="doc-send" style={{ padding: 6 }}>
          <SymbolView name="paperplane" size={18} tintColor={Colors.ink} />
        </Pressable>
        <Pressable onPress={save} disabled={!dirty || saving} accessibilityRole="button" testID="doc-save" style={{ height: 36, paddingHorizontal: Space.md, borderRadius: Radius.card, backgroundColor: dirty ? Colors.flag : Colors.hairline, alignItems: 'center', justifyContent: 'center', minWidth: 70 }}>
          {saving ? <ActivityIndicator color={Colors.surface} /> : <Heading size={15} color={dirty ? Colors.surface : Colors.ink2}>Save</Heading>}
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {source ? (
          <WebView
            ref={web}
            source={source}
            originWhitelist={['*']}
            onMessage={onMessage}
            allowsInlineMediaPlayback
            javaScriptEnabled
            scrollEnabled
            bounces={false}
            allowFileAccess
            style={{ flex: 1, backgroundColor: Colors.canvas }}
            testID="doc-webview"
          />
        ) : null}
        {!ready && !error ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: Space.sm }}>
            <ActivityIndicator color={Colors.slate} />
            <Mono>Opening</Mono>
          </View>
        ) : null}
        {error ? (
          <View style={{ position: 'absolute', left: Space.md, right: Space.md, top: Space.md, padding: Space.md, borderRadius: Radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.danger, gap: 4 }}>
            <Heading size={18}>Could not open this document</Heading>
            <Body size={13} color={Colors.ink2}>{error}</Body>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: Space.sm, paddingTop: Space.xs, paddingBottom: insets.bottom + Space.xs, borderTopWidth: 1, borderColor: Colors.hairline, backgroundColor: Colors.surface }}>
        {TOOLS.map((t) => (
          <ToolButton key={t.tool} icon={t.icon} label={t.label} on={tool === t.tool} onPress={() => pick(t.tool)} testID={`tool-${t.tool}`} />
        ))}
        <Pressable onPress={save} disabled={!dirty || saving} accessibilityRole="button" accessibilityLabel="Save" testID="tool-save" style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, paddingVertical: Space.sm, borderRadius: Radius.card, backgroundColor: dirty ? Colors.flag : 'transparent', opacity: pressed ? 0.6 : dirty ? 1 : 0.4 })}>
          {saving ? <ActivityIndicator color={Colors.surface} /> : <SymbolView name="square.and.arrow.down" size={20} tintColor={dirty ? Colors.surface : Colors.ink} />}
          <Mono size={10} color={dirty ? Colors.surface : Colors.ink2}>Save</Mono>
        </Pressable>
      </View>

      <Sheet visible={send} onClose={() => setSend(false)} title="Send to the client">
        <SheetRow title="Text message" subtitle="Opens Messages with the file attached" onPress={() => sendVia('text')} />
        <SheetRow title="Email" subtitle="Opens Mail with the file attached" onPress={() => sendVia('email')} />
        <SheetRow title="Share…" subtitle="AirDrop, WhatsApp, Files and more" onPress={() => sendVia('share')} />
      </Sheet>
    </View>
  );
}
