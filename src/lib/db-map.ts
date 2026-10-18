import type { Job, JobStatus, MediaKind, Photo, SyncState } from '@/types/models';

/** Raw SQLite row shapes. Kept separate from db.ts so the mappers are testable without native SQLite. */
export interface JobRow {
  id: string; company_id: string; name: string; address: string; client_name: string | null;
  lat: number | null; lng: number | null; status: string; cover_photo_id: string | null;
  created_at: string; updated_at: string; archived_at: string | null; remote: number; dirty?: number; sync_error?: string | null;
  photo_count: number | null; pending_count: number | null; last_photo_at: string | null; cover_uri?: string | null; cover_remote?: string | null;
}

export interface PhotoRow {
  id: string; job_id: string; company_id: string; taker_id: string; taker_initials: string; kind: string;
  local_uri: string | null; local_thumb_uri: string | null; storage_path: string | null; thumb_path: string | null;
  width: number | null; height: number | null; duration_s: number | null; taken_at: string;
  lat: number | null; lng: number | null; accuracy_m: number | null; sync_state: string; attempts: number | null;
  last_error: string | null; uploading_since: string | null; next_attempt_at: string | null;
}

/** "photos/<key>" or "thumbs/<key>" from the job query; anything else is ignored. */
function parseRemote(v: string | null): { bucket: 'photos' | 'thumbs'; key: string } | null {
  const m = v ? /^(photos|thumbs)\/(.+)$/.exec(v) : null;
  return m ? { bucket: m[1] as 'photos' | 'thumbs', key: m[2] } : null;
}

export function mapJobRow(r: JobRow): Job {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    address: r.address ?? '',
    clientName: r.client_name,
    lat: r.lat,
    lng: r.lng,
    status: r.status as JobStatus,
    coverPhotoId: r.cover_photo_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    remote: !!r.remote,
    dirty: !!r.dirty,
    syncError: r.sync_error ?? null,
    coverUri: r.cover_uri ?? null,
    coverRemote: parseRemote(r.cover_remote ?? null),
    lastPhotoAt: r.last_photo_at,
    photoCount: r.photo_count ?? 0,
    pendingCount: r.pending_count ?? 0,
  };
}

export function mapPhotoRow(r: PhotoRow): Photo {
  return {
    id: r.id,
    jobId: r.job_id,
    companyId: r.company_id,
    takerId: r.taker_id,
    takerInitials: r.taker_initials,
    kind: r.kind as MediaKind,
    localUri: r.local_uri,
    localThumbUri: r.local_thumb_uri,
    storagePath: r.storage_path,
    thumbPath: r.thumb_path,
    width: r.width ?? 0,
    height: r.height ?? 0,
    durationS: r.duration_s,
    takenAt: r.taken_at,
    lat: r.lat,
    lng: r.lng,
    accuracyM: r.accuracy_m,
    syncState: r.sync_state as SyncState,
    attempts: r.attempts ?? 0,
    lastError: r.last_error,
    uploadingSince: r.uploading_since,
    nextAttemptAt: r.next_attempt_at,
  };
}
