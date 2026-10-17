import { File } from 'expo-file-system';
import { AppState } from 'react-native';

import { track } from '@/lib/analytics';
import * as db from '@/lib/db';
import { pushJob } from '@/lib/jobs';
import { nextState, pickNext } from '@/lib/queue';
import { limitErrorFrom, supabase, supabaseConfigured } from '@/lib/supabase';
import type { Photo } from '@/types/models';

/**
 * Drains the upload queue one photo at a time: thumb, then full image, then the photos row.
 * Safe to call often; concurrent calls collapse into the running one.
 */
let running: Promise<void> | null = null;

export function runQueue(): Promise<void> {
  if (!running) {
    running = drain().finally(() => {
      running = null;
    });
  }
  return running;
}

async function persist(p: Photo) {
  await db.photos.setSync(p.id, {
    syncState: p.syncState,
    attempts: p.attempts,
    lastError: p.lastError,
    uploadingSince: p.uploadingSince,
    nextAttemptAt: p.nextAttemptAt,
    storagePath: p.storagePath,
    thumbPath: p.thumbPath,
  });
}

async function drain() {
  if (!supabaseConfigured) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  // Sweep rows orphaned by a killed app.
  const now = new Date().toISOString();
  for (const p of await db.photos.listUnsynced()) {
    const swept = nextState(p, { type: 'sweep', now });
    if (swept !== p) await persist(swept);
  }

  for (;;) {
    const next = pickNext(await db.photos.listUnsynced(), new Date().toISOString());
    if (!next) return;
    await uploadOne(next);
  }
}

async function uploadOne(p: Photo) {
  const started = nextState(p, { type: 'start', now: new Date().toISOString() });
  await persist(started);
  try {
    const job = await db.jobs.get(p.jobId);
    if (!job) throw Object.assign(new Error('job_missing'), { permanent: true });
    if (!job.remote) await pushJob(job.id);

    const key = `${p.companyId}/${p.jobId}/${p.id}.jpg`;
    if (!p.localThumbUri || !p.localUri) throw Object.assign(new Error('local_file_missing'), { permanent: true });

    const thumb = await new File(p.localThumbUri).bytes();
    const t = await supabase.storage.from('thumbs').upload(key, thumb, { contentType: 'image/jpeg', upsert: true });
    if (t.error) throw t.error;

    const full = await new File(p.localUri).bytes();
    const f = await supabase.storage.from('photos').upload(key, full, { contentType: 'image/jpeg', upsert: true });
    if (f.error) throw f.error;

    const { error } = await supabase.from('photos').upsert(
      {
        id: p.id,
        project_id: p.jobId,
        company_id: p.companyId,
        taker_id: p.takerId,
        taker_initials: p.takerInitials,
        kind: p.kind,
        storage_path: key,
        thumb_path: key,
        width: p.width,
        height: p.height,
        duration_s: p.durationS,
        taken_at: p.takenAt,
        lat: p.lat,
        lng: p.lng,
        accuracy_m: p.accuracyM,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (error) {
      const limit = limitErrorFrom(error);
      if (limit) throw Object.assign(new Error(limit.kind === 'photos_per_job' ? 'limit_photos_per_project' : limit.kind), { permanent: true });
      throw error;
    }

    await persist(nextState({ ...started, storagePath: key, thumbPath: key }, { type: 'ok' }));
    track('photo_synced', { attempts: started.attempts + 1 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const permanent = typeof e === 'object' && e !== null && 'permanent' in e && Boolean((e as { permanent: unknown }).permanent);
    const failed = nextState(started, { type: 'error', message, now: new Date().toISOString(), permanent });
    await persist(failed);
    if (failed.syncState === 'failed') track('sync_failed', { reason: message, permanent });
  }
}

/** Marks every failed photo pending again and drains. */
export async function retryFailed(): Promise<void> {
  for (const p of await db.photos.listUnsynced()) {
    const r = nextState(p, { type: 'retry' });
    if (r !== p) await persist(r);
  }
  await runQueue();
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Runs the queue on launch, when the app returns to the foreground, and every 30 s while active. */
export function startUploader(): () => void {
  runQueue().catch(() => {});
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      runQueue().catch(() => {});
      if (!timer) timer = setInterval(() => runQueue().catch(() => {}), 30_000);
    } else if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
  if (!timer) timer = setInterval(() => runQueue().catch(() => {}), 30_000);
  return () => {
    sub.remove();
    if (timer) clearInterval(timer);
    timer = null;
  };
}
