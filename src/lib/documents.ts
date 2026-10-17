import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { documentsIncluded } from '@/constants/plans';
import { getCompany, getMember } from '@/lib/company';
import { ready } from '@/lib/db';
import { hasEntitlement } from '@/lib/paywall';
import { effectiveTier } from '@/lib/plan';
import { notify, useVersion } from '@/lib/store';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { Doc, DocKind, SentVia } from '@/types/models';

/**
 * Documents: the invoice, proposal or contract that belongs next to a job's photos.
 * Local file + SQLite row first, then the `documents` bucket and table. Pro and Crew only.
 */

type Row = {
  id: string; job_id: string; company_id: string; name: string; kind: DocKind; local_uri: string | null; storage_path: string | null;
  size_bytes: number | null; pages: number | null; version: number; created_by: string; sent_to: string | null; sent_via: SentVia | null;
  sent_at: string | null; sync_state: Doc['syncState']; created_at: string; updated_at: string;
};

function map(r: Row): Doc {
  return {
    id: r.id, jobId: r.job_id, companyId: r.company_id, name: r.name, kind: r.kind, localUri: r.local_uri, storagePath: r.storage_path,
    sizeBytes: r.size_bytes, pages: r.pages, version: r.version, createdBy: r.created_by, sentTo: r.sent_to, sentVia: r.sent_via,
    sentAt: r.sent_at, syncState: r.sync_state, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Whether this company's plan includes documents right now. */
export function docsAllowed(): boolean {
  const company = getCompany();
  return documentsIncluded(effectiveTier(company?.tier ?? null, hasEntitlement()));
}

/** One object per version; objects are never overwritten, so a crew member cannot swap another's file. */
export function docStorageKey(companyId: string, jobId: string, id: string, kind: DocKind, version = 1): string {
  return `${companyId}/${jobId}/${id}.v${version}.${kind === 'pdf' ? 'pdf' : 'jpg'}`;
}

export function kindFor(mime: string | null | undefined, name: string): DocKind | null {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (m.startsWith('image/') || /\.(jpe?g|png|heic)$/i.test(name)) return 'image';
  return null;
}

/** Human size: 0 → "0 KB", 1536 → "2 KB", 2.5 MB → "2.5 MB". */
export function formatSize(bytes: number | null): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listDocuments(jobId: string): Promise<Doc[]> {
  const db = await ready();
  const rows = await db.getAllAsync<Row>('select * from documents where job_id = ? order by updated_at desc', jobId);
  return rows.map(map);
}

/** Every document in the company, newest first, for the Activity feed. */
export async function listAllDocuments(limit = 100): Promise<Doc[]> {
  const db = await ready();
  const rows = await db.getAllAsync<Row>('select * from documents order by updated_at desc limit ?', limit);
  return rows.map(map);
}

export async function countDocuments(jobId: string): Promise<number> {
  const db = await ready();
  const r = await db.getFirstAsync<{ n: number }>('select count(*) as n from documents where job_id = ?', jobId);
  return r?.n ?? 0;
}

export async function countAllDocuments(): Promise<number> {
  const db = await ready();
  const r = await db.getFirstAsync<{ n: number }>('select count(*) as n from documents');
  return r?.n ?? 0;
}

export async function getDocument(id: string): Promise<Doc | null> {
  const db = await ready();
  const r = await db.getFirstAsync<Row>('select * from documents where id = ?', id);
  return r ? map(r) : null;
}

export function useDocuments(jobId: string | undefined): Doc[] {
  const v = useVersion();
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => {
    let alive = true;
    if (!jobId) return;
    listDocuments(jobId).then((d) => alive && setDocs(d));
    return () => {
      alive = false;
    };
  }, [jobId, v]);
  return docs;
}

export function useDocument(id: string | undefined): Doc | null {
  const v = useVersion();
  const [doc, setDoc] = useState<Doc | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    getDocument(id).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, [id, v]);
  return doc;
}

async function update(id: string, patch: Record<string, string | number | null>): Promise<void> {
  const db = await ready();
  const keys = Object.keys(patch);
  if (!keys.length) return;
  await db.runAsync(`update documents set ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`, ...keys.map((k) => patch[k]), new Date().toISOString(), id);
  notify();
}

export class DocumentsNotAllowed extends Error {
  constructor() {
    super('documents_not_allowed');
    this.name = 'DocumentsNotAllowed';
  }
}

/** Opens the system picker for a PDF or image and files it under the job. Returns null if cancelled. */
export async function pickAndImport(jobId: string): Promise<Doc | null> {
  if (!docsAllowed()) throw new DocumentsNotAllowed();
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return importFile(jobId, { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null });
}

export async function importFile(jobId: string, file: { uri: string; name: string; mimeType: string | null; size: number | null }): Promise<Doc> {
  if (!docsAllowed()) throw new DocumentsNotAllowed();
  const company = getCompany();
  const member = getMember();
  if (!company || !member) throw new Error('no_company');
  const kind = kindFor(file.mimeType, file.name);
  if (!kind) throw new Error('unsupported_type');
  const id = Crypto.randomUUID();
  const dir = new Directory(Paths.document, 'docs', jobId);
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${id}.${kind === 'pdf' ? 'pdf' : 'jpg'}`);
  new File(file.uri).copy(dest);
  const now = new Date().toISOString();
  const db = await ready();
  await db.runAsync(
    'insert into documents (id, job_id, company_id, name, kind, local_uri, storage_path, size_bytes, pages, version, created_by, sync_state, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id, jobId, company.id, file.name.replace(/\.(pdf|jpe?g|png)$/i, ''), kind, dest.uri, docStorageKey(company.id, jobId, id, kind), file.size ?? (dest.size ?? null), null, 1, member.userId, 'pending', now, now,
  );
  notify();
  void syncDocument(id);
  const doc = await getDocument(id);
  if (!doc) throw new Error('insert_failed');
  return doc;
}

/** Uploads the current file and upserts the row. Safe to call again; failures leave the row pending. */
export async function syncDocument(id: string): Promise<void> {
  if (!supabaseConfigured) return;
  const doc = await getDocument(id);
  if (!doc || !doc.localUri || !doc.storagePath) return;
  try {
    const bytes = await new File(doc.localUri).bytes();
    const up = await supabase.storage.from('documents').upload(doc.storagePath, bytes, { contentType: doc.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
    // An object that already exists is this version, already uploaded: not an error.
    if (up.error && !/exists|duplicate|409/i.test(up.error.message)) throw up.error;
    const { error } = await supabase.from('documents').upsert({
      id: doc.id, company_id: doc.companyId, project_id: doc.jobId, name: doc.name, kind: doc.kind, storage_path: doc.storagePath,
      size_bytes: doc.sizeBytes, pages: doc.pages, version: doc.version, created_by: doc.createdBy, sent_to: doc.sentTo, sent_via: doc.sentVia, sent_at: doc.sentAt,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await update(id, { sync_state: 'synced' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await update(id, { sync_state: msg.includes('limit:documents') ? 'failed' : 'pending' });
  }
}

/** Replaces the file with an edited export. The previous file is kept as <id>.v<n>.pdf for the record. */
export async function saveVersion(id: string, newFileUri: string, pages: number | null): Promise<Doc> {
  const doc = await getDocument(id);
  if (!doc || !doc.localUri) throw new Error('missing');
  const current = new File(doc.localUri);
  const dir = current.parentDirectory;
  if (current.exists) current.move(new File(dir, `${id}.v${doc.version}.pdf`));
  const dest = new File(dir, `${id}.pdf`);
  new File(newFileUri).move(dest);
  await update(id, { local_uri: dest.uri, kind: 'pdf', storage_path: docStorageKey(doc.companyId, doc.jobId, id, 'pdf', doc.version + 1), version: doc.version + 1, pages, size_bytes: dest.size ?? null, sync_state: 'pending' });
  void syncDocument(id);
  const fresh = await getDocument(id);
  if (!fresh) throw new Error('missing');
  return fresh;
}

export async function setPages(id: string, pages: number): Promise<void> {
  await update(id, { pages });
}

export async function rename(id: string, name: string): Promise<void> {
  await update(id, { name: name.trim() || 'Document', sync_state: 'pending' });
  void syncDocument(id);
}

export async function markSent(id: string, via: SentVia, to: string | null): Promise<void> {
  await update(id, { sent_via: via, sent_to: to, sent_at: new Date().toISOString(), sync_state: 'pending' });
  void syncDocument(id);
}

export async function deleteDocument(id: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  try {
    if (doc.localUri) {
      const f = new File(doc.localUri);
      const dir = f.parentDirectory;
      for (const sibling of dir.exists ? dir.list() : []) {
        if (sibling instanceof File && sibling.name.startsWith(doc.id)) sibling.delete();
      }
    }
  } catch {
    // Already gone locally.
  }
  const db = await ready();
  await db.runAsync('delete from documents where id = ?', id);
  notify();
  if (supabaseConfigured && doc.storagePath) {
    const prefix = `${doc.companyId}/${doc.jobId}`;
    const { data: objects } = await supabase.storage.from('documents').list(prefix, { search: doc.id });
    const keys = (objects ?? []).map((o) => `${prefix}/${o.name}`);
    if (keys.length) await supabase.storage.from('documents').remove(keys).catch(() => null);
    await supabase.from('documents').delete().eq('id', id).then(() => null, () => null);
  }
}

/** Pulls the job's documents from the server for a device that did not create them. Files download on open. */
export async function pullDocuments(jobId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const { data } = await supabase.from('documents').select('*').eq('project_id', jobId);
  if (!data) return;
  const db = await ready();
  for (const r of data as Record<string, string | number | null>[]) {
    const existing = await db.getFirstAsync<{ id: string }>('select id from documents where id = ?', r.id as string);
    if (existing) continue;
    await db.runAsync(
      'insert into documents (id, job_id, company_id, name, kind, local_uri, storage_path, size_bytes, pages, version, created_by, sent_to, sent_via, sent_at, sync_state, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      r.id as string, r.project_id as string, r.company_id as string, r.name as string, r.kind as string, null, r.storage_path as string, (r.size_bytes as number) ?? null, (r.pages as number) ?? null, (r.version as number) ?? 1,
      r.created_by as string, (r.sent_to as string) ?? null, (r.sent_via as string) ?? null, (r.sent_at as string) ?? null, 'synced', r.created_at as string, r.updated_at as string,
    );
  }
  notify();
}

/** Downloads a server-only document to the local docs folder so it can be viewed, edited and sent. */
export async function ensureLocal(doc: Doc): Promise<string> {
  if (doc.localUri && new File(doc.localUri).exists) return doc.localUri;
  if (!doc.storagePath) throw new Error('no_file');
  const { data, error } = await supabase.storage.from('documents').download(doc.storagePath);
  if (error || !data) throw error ?? new Error('download_failed');
  const dir = new Directory(Paths.document, 'docs', doc.jobId);
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${doc.id}.${doc.kind === 'pdf' ? 'pdf' : 'jpg'}`);
  dest.write(new Uint8Array(await data.arrayBuffer()));
  await update(doc.id, { local_uri: dest.uri });
  return dest.uri;
}
