import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';

import { track } from '@/lib/analytics';
import { getCompany, getMember } from '@/lib/company';
import * as db from '@/lib/db';
import type { Fix } from '@/lib/jobs';
import { useVersion } from '@/lib/store';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { runQueue } from '@/lib/uploader';
import type { Photo } from '@/types/models';

export const FULL_LONG_EDGE = 2048;
export const FULL_QUALITY = 0.82;
export const THUMB_LONG_EDGE = 320;
export const THUMB_QUALITY = 0.7;

/** Object key shared by the photos and thumbs buckets. */
export function storageKey(companyId: string, jobId: string, photoId: string): string {
  return `${companyId}/${jobId}/${photoId}.jpg`;
}

/** Fits (w, h) inside longEdge on its longer side without upscaling. */
export function targetSize(width: number, height: number, longEdge: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= longEdge) return { width, height };
  const scale = longEdge / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dayParts(iso: string, timeZone?: string) {
  const d = new Date(iso);
  if (!timeZone) return { y: d.getFullYear(), mo: d.getMonth(), day: d.getDate(), dow: d.getDay() };
  const f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
  const parts = f.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { y: Number(get('year')), mo: Number(get('month')) - 1, day: Number(get('day')), dow: DAYS.indexOf(get('weekday').toUpperCase()) };
}

export interface DayGroup<T> {
  key: string;
  label: string;
  photos: T[];
}

/** Groups by local calendar day, newest day first, newest photo first inside each day. */
export function groupByDay<T extends { takenAt: string }>(photos: T[], timeZone?: string): DayGroup<T>[] {
  const map = new Map<string, { parts: ReturnType<typeof dayParts>; photos: T[] }>();
  for (const p of photos) {
    const parts = dayParts(p.takenAt, timeZone);
    const key = `${parts.y}-${String(parts.mo + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const g = map.get(key) ?? { parts, photos: [] };
    g.photos.push(p);
    map.set(key, g);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, g]) => {
      const photos = [...g.photos].sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
      const n = photos.length;
      const label = `${DAYS[g.parts.dow]} ${MONTHS[g.parts.mo]} ${String(g.parts.day).padStart(2, '0')} · ${n} ${n === 1 ? 'PHOTO' : 'PHOTOS'}`;
      return { key, label, photos };
    });
}

async function render(uri: string, width: number, height: number, longEdge: number, quality: number): Promise<{ uri: string; width: number; height: number }> {
  const size = targetSize(width, height, longEdge);
  const ctx = ImageManipulator.manipulate(uri);
  if (size.width !== width || size.height !== height) ctx.resize(size);
  const image = await ctx.renderAsync();
  try {
    const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height };
  } finally {
    image.release();
  }
}

export interface VideoInput {
  jobId: string;
  uri: string;
  durationS: number;
  fix: Fix | null;
}

/** Files a recorded clip under the job with a still thumbnail; the clip itself is not re-encoded. */
export async function captureVideo(input: VideoInput): Promise<Photo> {
  const company = getCompany();
  const member = getMember();
  if (!company || !member) throw new Error('no_company');
  const id = Crypto.randomUUID();
  const dir = new Directory(Paths.document, 'photos', input.jobId);
  if (!dir.exists) dir.create({ intermediates: true });
  const videoFile = new File(dir, `${id}.mp4`);
  new File(input.uri).move(videoFile);
  const still = await VideoThumbnails.getThumbnailAsync(videoFile.uri, { time: 400, quality: 0.8 });
  const thumb = await render(still.uri, still.width, still.height, THUMB_LONG_EDGE, THUMB_QUALITY);
  const thumbFile = new File(dir, `${id}.thumb.jpg`);
  new File(thumb.uri).move(thumbFile);
  try {
    new File(still.uri).delete();
  } catch {
    // cache file already gone
  }
  const photo: Photo = {
    id,
    jobId: input.jobId,
    companyId: company.id,
    takerId: member.userId,
    takerInitials: member.initials,
    kind: 'video',
    localUri: videoFile.uri,
    localThumbUri: thumbFile.uri,
    storagePath: null,
    thumbPath: null,
    width: still.width,
    height: still.height,
    durationS: Math.round(input.durationS * 10) / 10,
    takenAt: new Date().toISOString(),
    lat: input.fix?.lat ?? null,
    lng: input.fix?.lng ?? null,
    accuracyM: input.fix?.accuracyM ?? null,
    syncState: 'pending',
    attempts: 0,
    lastError: null,
    uploadingSince: null,
    nextAttemptAt: null,
  };
  await db.photos.upsert(photo);
  track('video_recorded', { seconds: photo.durationS ?? 0 });
  void runQueue();
  return photo;
}

/** "0:12" for a clip length. */
export function formatDuration(s: number | null): string {
  const n = Math.max(0, Math.round(s ?? 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

export interface CaptureInput {
  jobId: string;
  uri: string;
  width: number;
  height: number;
  fix: Fix | null;
}

/**
 * Turns a camera capture into a stored, queued photo. Fully offline:
 * compresses, writes thumb and full to Documents/photos/<job>/, inserts the local row, starts the uploader.
 */
export async function capture(input: CaptureInput): Promise<Photo> {
  const company = getCompany();
  const member = getMember();
  if (!company || !member) throw new Error('no_company');

  const id = Crypto.randomUUID();
  const dir = new Directory(Paths.document, 'photos', input.jobId);
  if (!dir.exists) dir.create({ intermediates: true });

  const full = await render(input.uri, input.width, input.height, FULL_LONG_EDGE, FULL_QUALITY);
  const thumb = await render(input.uri, input.width, input.height, THUMB_LONG_EDGE, THUMB_QUALITY);

  const fullFile = new File(dir, `${id}.jpg`);
  const thumbFile = new File(dir, `${id}.thumb.jpg`);
  new File(full.uri).move(fullFile);
  new File(thumb.uri).move(thumbFile);
  try {
    new File(input.uri).delete();
  } catch {
    // cache file already gone
  }

  const photo: Photo = {
    id,
    jobId: input.jobId,
    companyId: company.id,
    takerId: member.userId,
    takerInitials: member.initials,
    kind: 'photo',
    localUri: fullFile.uri,
    localThumbUri: thumbFile.uri,
    storagePath: null,
    thumbPath: null,
    width: full.width,
    height: full.height,
    durationS: null,
    takenAt: new Date().toISOString(),
    lat: input.fix?.lat ?? null,
    lng: input.fix?.lng ?? null,
    accuracyM: input.fix?.accuracyM ?? null,
    syncState: 'pending',
    attempts: 0,
    lastError: null,
    uploadingSince: null,
    nextAttemptAt: null,
  };
  await db.photos.upsert(photo);

  const job = await db.jobs.get(input.jobId);
  if (job && !job.coverPhotoId) await db.jobs.setCover(input.jobId, id);

  track('photo_captured', { has_gps: photo.lat != null, offline: !supabaseConfigured });
  runQueue().catch(() => {});
  return photo;
}

/** Live list of a job's photos plus whether the first read has completed. */
export function useJobPhotosState(jobId: string | undefined): { photos: Photo[]; loaded: boolean } {
  const v = useVersion();
  const [state, setState] = useState<{ photos: Photo[]; loaded: boolean }>({ photos: [], loaded: false });
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    db.photos.listByJob(jobId).then((photos) => alive && setState({ photos, loaded: true }));
    return () => {
      alive = false;
    };
  }, [jobId, v]);
  return state;
}

/** Live list of a job's photos. */
export function useJobPhotos(jobId: string | undefined): Photo[] {
  return useJobPhotosState(jobId).photos;
}

/** Photos on a job at or over the plan cap? */
export async function atPhotoCap(jobId: string, cap: number): Promise<boolean> {
  return (await db.photos.countByJob(jobId, 'photo')) >= cap;
}

/** Removes a photo locally now and on the server via a tombstone the uploader replays. */
export async function deletePhoto(p: Photo): Promise<void> {
  for (const uri of [p.localUri, p.localThumbUri]) {
    if (!uri) continue;
    try {
      new File(uri).delete();
    } catch {
      // already gone
    }
  }
  await db.photos.remove(p.id);
  const job = await db.jobs.get(p.jobId);
  if (job?.coverPhotoId === p.id) {
    const rest = await db.photos.listByJob(p.jobId);
    await db.jobs.setCover(p.jobId, rest[0]?.id ?? null);
  }
  // Always tombstone: an upload may have landed even if the local row never saw the response.
  await db.tombstones.add({ id: p.id, kind: 'photo', key: storageKey(p.companyId, p.jobId, p.id), companyId: p.companyId });
  runQueue().catch(() => {});
}

/** Pulls remote photos for a job into SQLite (metadata only; images stream via signed URLs). */
export async function pullPhotos(jobId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const { data, error } = await supabase.from('photos').select('*').eq('project_id', jobId);
  if (error || !data) return;
  const pending = new Set((await db.tombstones.list()).filter((t) => t.kind === 'photo').map((t) => t.id));
  for (const r of data) {
    const existing = await db.photos.get(r.id);
    if (existing || pending.has(r.id)) continue;
    await db.photos.upsert({
      id: r.id,
      jobId: r.project_id,
      companyId: r.company_id,
      takerId: r.taker_id,
      takerInitials: r.taker_initials,
      kind: r.kind,
      localUri: null,
      localThumbUri: null,
      storagePath: r.storage_path,
      thumbPath: r.thumb_path,
      width: r.width ?? 0,
      height: r.height ?? 0,
      durationS: r.duration_s,
      takenAt: r.taken_at,
      lat: r.lat,
      lng: r.lng,
      accuracyM: r.accuracy_m,
      syncState: 'synced',
      attempts: 0,
      lastError: null,
      uploadingSince: null,
      nextAttemptAt: null,
    });
  }
}

const signedCache = new Map<string, { url: string; exp: number }>();

/** Signed URL for a remote object, cached for 50 minutes. */
export async function signedUrl(bucket: 'photos' | 'thumbs', key: string): Promise<string | null> {
  const k = `${bucket}/${key}`;
  const hit = signedCache.get(k);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(key, 3600);
  if (!data?.signedUrl) return null;
  signedCache.set(k, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
