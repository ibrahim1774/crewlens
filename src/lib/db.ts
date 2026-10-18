import * as SQLite from 'expo-sqlite';

import { mapJobRow, mapPhotoRow, type JobRow, type PhotoRow } from '@/lib/db-map';
import { notify } from '@/lib/store';
import type { Job, JobStatus, Photo, SyncState } from '@/types/models';

const SCHEMA = `
pragma journal_mode = wal;
create table if not exists meta (key text primary key, value text);
create table if not exists jobs (
  id text primary key, company_id text not null, name text not null, address text default '', client_name text,
  lat real, lng real, status text not null default 'active', cover_photo_id text,
  created_at text not null, updated_at text not null, archived_at text, remote integer not null default 0,
  dirty integer not null default 0, sync_error text
);
create table if not exists documents (
  id text primary key, job_id text not null, company_id text not null, name text not null, kind text not null default 'pdf',
  local_uri text, storage_path text, size_bytes integer, pages integer, version integer not null default 1,
  created_by text not null, sent_to text, sent_via text, sent_at text, sync_state text not null default 'pending',
  created_at text not null, updated_at text not null
);
create index if not exists documents_job on documents(job_id, updated_at desc);
create table if not exists tombstones (
  id text primary key, kind text not null, key text, company_id text, created_at text not null
);
create table if not exists photos (
  id text primary key, job_id text not null, company_id text not null, taker_id text not null, taker_initials text not null default '',
  kind text not null default 'photo', local_uri text, local_thumb_uri text, storage_path text, thumb_path text,
  width integer, height integer, duration_s real, taken_at text not null, lat real, lng real, accuracy_m real,
  sync_state text not null default 'pending', attempts integer not null default 0, last_error text,
  uploading_since text, next_attempt_at text
);
create index if not exists photos_job on photos(job_id, taken_at desc);
create index if not exists photos_sync on photos(sync_state);
`;

const JOB_SELECT = `
select j.*,
  (select count(*) from photos p where p.job_id = j.id) as photo_count,
  (select count(*) from photos p where p.job_id = j.id and p.sync_state <> 'synced') as pending_count,
  (select max(taken_at) from photos p where p.job_id = j.id) as last_photo_at,
  coalesce((select local_thumb_uri from photos p where p.id = j.cover_photo_id),
           (select local_thumb_uri from photos p where p.job_id = j.id order by taken_at desc limit 1)) as cover_uri,
  coalesce((select thumb_path from photos p where p.id = j.cover_photo_id),
           (select thumb_path from photos p where p.job_id = j.id order by taken_at desc limit 1)) as cover_thumb_path
from jobs j`;

const MIGRATIONS = [
  'alter table jobs add column dirty integer not null default 0',
  'alter table jobs add column sync_error text',
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function ready(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('crewlens.db');
      await db.execAsync(SCHEMA);
      for (const m of MIGRATIONS) {
        try {
          await db.execAsync(m);
        } catch {
          // column already exists
        }
      }
      return db;
    })();
  }
  return dbPromise;
}

export const meta = {
  async get(key: string): Promise<string | null> {
    const db = await ready();
    const row = await db.getFirstAsync<{ value: string }>('select value from meta where key = ?', key);
    return row?.value ?? null;
  },
  async set(key: string, value: string | null): Promise<void> {
    const db = await ready();
    if (value === null) await db.runAsync('delete from meta where key = ?', key);
    else await db.runAsync('insert into meta(key, value) values (?, ?) on conflict(key) do update set value = excluded.value', key, value);
    notify();
  },
  async getJSON<T>(key: string): Promise<T | null> {
    const v = await this.get(key);
    return v ? (JSON.parse(v) as T) : null;
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  },
};

export const jobs = {
  async list(): Promise<Job[]> {
    const db = await ready();
    const rows = await db.getAllAsync<JobRow>(`${JOB_SELECT} order by j.updated_at desc`);
    return rows.map(mapJobRow);
  },
  async get(id: string): Promise<Job | null> {
    const db = await ready();
    const row = await db.getFirstAsync<JobRow>(`${JOB_SELECT} where j.id = ?`, id);
    return row ? mapJobRow(row) : null;
  },
  async upsert(j: Omit<Job, 'lastPhotoAt' | 'photoCount' | 'pendingCount' | 'coverUri' | 'coverThumbPath'>): Promise<void> {
    const db = await ready();
    await db.runAsync(
      `insert into jobs(id, company_id, name, address, client_name, lat, lng, status, cover_photo_id, created_at, updated_at, archived_at, remote, dirty, sync_error)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set name = excluded.name, address = excluded.address, client_name = excluded.client_name,
         lat = excluded.lat, lng = excluded.lng, status = excluded.status, cover_photo_id = excluded.cover_photo_id,
         updated_at = excluded.updated_at, archived_at = excluded.archived_at, remote = excluded.remote,
         dirty = excluded.dirty, sync_error = excluded.sync_error`,
      j.id, j.companyId, j.name, j.address, j.clientName, j.lat, j.lng, j.status, j.coverPhotoId, j.createdAt, j.updatedAt, j.archivedAt, j.remote ? 1 : 0, j.dirty ? 1 : 0, j.syncError
    );
    notify();
  },
  async markDirty(id: string): Promise<void> {
    const db = await ready();
    await db.runAsync('update jobs set dirty = 1, updated_at = ? where id = ?', new Date().toISOString(), id);
    notify();
  },
  async markSynced(id: string): Promise<void> {
    const db = await ready();
    await db.runAsync('update jobs set remote = 1, dirty = 0, sync_error = null where id = ?', id);
    notify();
  },
  async setSyncError(id: string, error: string | null): Promise<void> {
    const db = await ready();
    await db.runAsync('update jobs set sync_error = ? where id = ?', error, id);
    notify();
  },
  async listDirty(): Promise<Job[]> {
    const db = await ready();
    const rows = await db.getAllAsync<JobRow>(`${JOB_SELECT} where j.dirty = 1 or j.remote = 0 order by j.created_at asc`);
    return rows.map(mapJobRow);
  },
  async setStatus(id: string, status: JobStatus): Promise<void> {
    const db = await ready();
    const now = new Date().toISOString();
    await db.runAsync('update jobs set status = ?, archived_at = ?, updated_at = ?, dirty = 1 where id = ?', status, status === 'archived' ? now : null, now, id);
    notify();
  },
  async setRemote(id: string, remote: boolean): Promise<void> {
    const db = await ready();
    await db.runAsync('update jobs set remote = ? where id = ?', remote ? 1 : 0, id);
    notify();
  },
  async setCover(id: string, photoId: string | null): Promise<void> {
    const db = await ready();
    await db.runAsync('update jobs set cover_photo_id = ? where id = ?', photoId, id);
    notify();
  },
  async remove(id: string): Promise<void> {
    const db = await ready();
    await db.runAsync('delete from photos where job_id = ?', id);
    await db.runAsync('delete from jobs where id = ?', id);
    notify();
  },
  async countActive(): Promise<number> {
    const db = await ready();
    const row = await db.getFirstAsync<{ n: number }>("select count(*) as n from jobs where status = 'active'");
    return row?.n ?? 0;
  },
};

export const photos = {
  async listByJob(jobId: string): Promise<Photo[]> {
    const db = await ready();
    const rows = await db.getAllAsync<PhotoRow>('select * from photos where job_id = ? order by taken_at desc', jobId);
    return rows.map(mapPhotoRow);
  },
  async get(id: string): Promise<Photo | null> {
    const db = await ready();
    const row = await db.getFirstAsync<PhotoRow>('select * from photos where id = ?', id);
    return row ? mapPhotoRow(row) : null;
  },
  async upsert(p: Photo): Promise<void> {
    const db = await ready();
    await db.runAsync(
      `insert into photos(id, job_id, company_id, taker_id, taker_initials, kind, local_uri, local_thumb_uri, storage_path, thumb_path,
         width, height, duration_s, taken_at, lat, lng, accuracy_m, sync_state, attempts, last_error, uploading_since, next_attempt_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set local_uri = excluded.local_uri, local_thumb_uri = excluded.local_thumb_uri,
         storage_path = excluded.storage_path, thumb_path = excluded.thumb_path, sync_state = excluded.sync_state,
         attempts = excluded.attempts, last_error = excluded.last_error, uploading_since = excluded.uploading_since,
         next_attempt_at = excluded.next_attempt_at`,
      p.id, p.jobId, p.companyId, p.takerId, p.takerInitials, p.kind, p.localUri, p.localThumbUri, p.storagePath, p.thumbPath,
      p.width, p.height, p.durationS, p.takenAt, p.lat, p.lng, p.accuracyM, p.syncState, p.attempts, p.lastError, p.uploadingSince, p.nextAttemptAt
    );
    notify();
  },
  async setSync(id: string, patch: { syncState: SyncState; attempts?: number; lastError?: string | null; uploadingSince?: string | null; nextAttemptAt?: string | null; storagePath?: string | null; thumbPath?: string | null }): Promise<void> {
    const db = await ready();
    const sets: string[] = ['sync_state = ?'];
    const args: SQLite.SQLiteBindValue[] = [patch.syncState];
    const map: [keyof typeof patch, string][] = [
      ['attempts', 'attempts'], ['lastError', 'last_error'], ['uploadingSince', 'uploading_since'],
      ['nextAttemptAt', 'next_attempt_at'], ['storagePath', 'storage_path'], ['thumbPath', 'thumb_path'],
    ];
    for (const [k, col] of map) {
      if (k in patch) {
        sets.push(`${col} = ?`);
        args.push((patch[k] ?? null) as SQLite.SQLiteBindValue);
      }
    }
    args.push(id);
    await db.runAsync(`update photos set ${sets.join(', ')} where id = ?`, args);
    notify();
  },
  async listUnsynced(): Promise<Photo[]> {
    const db = await ready();
    const rows = await db.getAllAsync<PhotoRow>("select * from photos where sync_state <> 'synced' order by taken_at asc");
    return rows.map(mapPhotoRow);
  },
  /** Newest photos across every job, for the Activity feed. */
  async listRecent(limit = 200): Promise<Photo[]> {
    const db = await ready();
    const rows = await db.getAllAsync<PhotoRow>('select * from photos order by taken_at desc limit ?', limit);
    return rows.map(mapPhotoRow);
  },
  async countByJob(jobId: string, kind: 'photo' | 'video'): Promise<number> {
    const db = await ready();
    const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from photos where job_id = ? and kind = ?', jobId, kind);
    return row?.n ?? 0;
  },
  async remove(id: string): Promise<void> {
    const db = await ready();
    await db.runAsync('delete from photos where id = ?', id);
    notify();
  },
  async countUnsynced(): Promise<{ pending: number; failed: number }> {
    const db = await ready();
    const row = await db.getFirstAsync<{ pending: number; failed: number }>(
      "select sum(case when sync_state in ('pending','uploading') then 1 else 0 end) as pending, sum(case when sync_state = 'failed' then 1 else 0 end) as failed from photos"
    );
    return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
  },
};

export interface Tombstone {
  id: string;
  kind: 'photo' | 'job';
  key: string | null;
  companyId: string | null;
  createdAt: string;
}

/** Deletions that still need to reach the server. */
export const tombstones = {
  async add(t: Omit<Tombstone, 'createdAt'>): Promise<void> {
    const db = await ready();
    await db.runAsync('insert or replace into tombstones(id, kind, key, company_id, created_at) values (?, ?, ?, ?, ?)', t.id, t.kind, t.key, t.companyId, new Date().toISOString());
  },
  async list(): Promise<Tombstone[]> {
    const db = await ready();
    const rows = await db.getAllAsync<{ id: string; kind: 'photo' | 'job'; key: string | null; company_id: string | null; created_at: string }>('select * from tombstones order by created_at asc');
    return rows.map((r) => ({ id: r.id, kind: r.kind, key: r.key, companyId: r.company_id, createdAt: r.created_at }));
  },
  async remove(id: string): Promise<void> {
    const db = await ready();
    await db.runAsync('delete from tombstones where id = ?', id);
  },
};

/** Wipes everything local. Used on sign out. */
export async function resetLocal(): Promise<void> {
  const db = await ready();
  await db.execAsync('delete from photos; delete from jobs; delete from documents; delete from meta where key <> \'intro_seen\'; delete from tombstones;');
  notify();
}
