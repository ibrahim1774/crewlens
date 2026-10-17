import { MAX_UPLOAD_ATTEMPTS } from '@/constants/limits';
import type { SyncState } from '@/types/models';

/** An `uploading` row older than this is assumed orphaned by a killed app and goes back to pending. */
export const STALE_UPLOADING_MS = 2 * 60 * 1000;

export interface QueueItem {
  id: string;
  syncState: SyncState;
  attempts: number;
  uploadingSince: string | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  takenAt: string;
}

export type QueueEvent =
  | { type: 'start'; now: string }
  | { type: 'ok' }
  | { type: 'error'; message: string; now: string; permanent?: boolean }
  | { type: 'sweep'; now: string }
  | { type: 'retry' };

/** 2 s, 4 s, 8 s ... capped at 5 minutes. */
export function backoffMs(attempt: number): number {
  return Math.min(2000 * 2 ** Math.max(0, attempt - 1), 300_000);
}

/** Pure transition for one photo's sync state. The uploader persists the result. */
export function nextState<T extends QueueItem>(item: T, e: QueueEvent): T {
  switch (e.type) {
    case 'start':
      return { ...item, syncState: 'uploading', uploadingSince: e.now };
    case 'ok':
      return { ...item, syncState: 'synced', uploadingSince: null, lastError: null, nextAttemptAt: null };
    case 'error': {
      const attempts = item.attempts + 1;
      const failed = e.permanent || attempts >= MAX_UPLOAD_ATTEMPTS;
      return {
        ...item,
        attempts,
        lastError: e.message,
        uploadingSince: null,
        syncState: failed ? 'failed' : 'pending',
        nextAttemptAt: failed ? null : new Date(Date.parse(e.now) + backoffMs(attempts)).toISOString(),
      };
    }
    case 'sweep':
      if (item.syncState === 'uploading' && item.uploadingSince && Date.parse(e.now) - Date.parse(item.uploadingSince) > STALE_UPLOADING_MS) {
        return { ...item, syncState: 'pending', uploadingSince: null };
      }
      return item;
    case 'retry':
      return item.syncState === 'failed' ? { ...item, syncState: 'pending', attempts: 0, lastError: null, nextAttemptAt: null } : item;
  }
}

/** Oldest pending row whose retry time has passed, or null. */
export function pickNext<T extends QueueItem>(items: T[], now: string): T | null {
  const t = Date.parse(now);
  const ready = items
    .filter((i) => i.syncState === 'pending' && (!i.nextAttemptAt || Date.parse(i.nextAttemptAt) <= t))
    .sort((a, b) => (a.takenAt < b.takenAt ? -1 : 1));
  return ready[0] ?? null;
}
