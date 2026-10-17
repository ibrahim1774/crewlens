import { useEffect, useState } from 'react';

import { photos as photosDb } from '@/lib/db';
import { listAllDocuments } from '@/lib/documents';
import { useJobs } from '@/lib/jobs';
import { useVersion } from '@/lib/store';
import type { Doc, Job, Photo } from '@/types/models';

/** One line in the Activity feed: a burst of photos on a job, or a document event. */
export type ActivityItem =
  | { kind: 'photos'; key: string; at: string; job: Job; initials: string; photos: Photo[] }
  | { kind: 'document'; key: string; at: string; job: Job; doc: Doc; event: 'added' | 'edited' | 'sent' };

/** Groups photos into bursts: same job, same taker, within 30 minutes. Pure, newest first. */
export function buildActivity(photos: Photo[], docs: Doc[], jobs: Job[], now: number = Date.now()): ActivityItem[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const items: ActivityItem[] = [];
  const sorted = [...photos].sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  // Open bursts keyed by job + taker; a photo joins its burst when it is within 30 minutes of the burst's oldest shot.
  const open = new Map<string, Extract<ActivityItem, { kind: 'photos' }>>();
  for (const p of sorted) {
    const job = byId.get(p.jobId);
    if (!job) continue;
    const k = `${job.id}|${p.takerInitials}`;
    const burst = open.get(k);
    const t = Date.parse(p.takenAt);
    if (burst && Date.parse(burst.photos[burst.photos.length - 1].takenAt) - t <= 30 * 60_000) {
      burst.photos.push(p);
      continue;
    }
    const next: Extract<ActivityItem, { kind: 'photos' }> = { kind: 'photos', key: `ph-${p.id}`, at: p.takenAt, job, initials: p.takerInitials, photos: [p] };
    open.set(k, next);
    items.push(next);
  }
  for (const d of docs) {
    const job = byId.get(d.jobId);
    if (!job) continue;
    if (d.sentAt) items.push({ kind: 'document', key: `ds-${d.id}`, at: d.sentAt, job, doc: d, event: 'sent' });
    if (d.version > 1) items.push({ kind: 'document', key: `de-${d.id}`, at: d.updatedAt, job, doc: d, event: 'edited' });
    items.push({ kind: 'document', key: `da-${d.id}`, at: d.createdAt, job, doc: d, event: 'added' });
  }
  return items.filter((i) => Date.parse(i.at) <= now + 60_000).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'TODAY';
  if (sameDay(d, y)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export function useActivity(): ActivityItem[] {
  const v = useVersion();
  const jobs = useJobs();
  const [items, setItems] = useState<ActivityItem[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all([photosDb.listRecent(300), listAllDocuments(100)]).then(([p, d]) => alive && setItems(buildActivity(p, d, jobs)));
    return () => {
      alive = false;
    };
  }, [v, jobs]);
  return items;
}
