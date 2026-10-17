import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { NEARBY_RADIUS_M } from '@/constants/limits';
import { track } from '@/lib/analytics';
import { getCompany } from '@/lib/company';
import * as db from '@/lib/db';
import { distanceM, type LatLng } from '@/lib/geo';
import { effectiveTier, limitsFor } from '@/lib/plan';
import { useVersion } from '@/lib/store';
import { LimitError, limitErrorFrom, supabase, supabaseConfigured } from '@/lib/supabase';
import type { Job } from '@/types/models';

export interface RankedJobs {
  nearby: Job[];
  recent: Job[];
  all: Job[];
  archived: Job[];
}

/**
 * Splits jobs for the Jobs tab and the camera strip.
 * nearby: active jobs within NEARBY_RADIUS_M of `here`, closest first.
 * recent: the rest with photos, newest photo first (max 10).
 * all: remaining active jobs alphabetically. archived: archived jobs, newest archive first.
 */
export function rankJobs(jobs: Job[], here: LatLng | null): RankedJobs {
  const active = jobs.filter((j) => j.status === 'active');
  const archived = jobs
    .filter((j) => j.status === 'archived')
    .sort((a, b) => ((b.archivedAt ?? '') > (a.archivedAt ?? '') ? 1 : -1));

  const scored = active.map((j) => ({
    j,
    d: here && j.lat != null && j.lng != null ? distanceM(here, { lat: j.lat, lng: j.lng }) : Infinity,
  }));
  const nearby = scored.filter((x) => x.d <= NEARBY_RADIUS_M).sort((a, b) => a.d - b.d).map((x) => x.j);
  const nearbyIds = new Set(nearby.map((j) => j.id));
  const rest = active.filter((j) => !nearbyIds.has(j.id));
  const recent = rest
    .filter((j) => j.lastPhotoAt)
    .sort((a, b) => ((b.lastPhotoAt ?? '') > (a.lastPhotoAt ?? '') ? 1 : -1))
    .slice(0, 10);
  const recentIds = new Set(recent.map((j) => j.id));
  const all = rest.filter((j) => !recentIds.has(j.id)).sort((a, b) => a.name.localeCompare(b.name));
  return { nearby, recent, all, archived };
}

/** Live list of local jobs. */
export function useJobs(): Job[] {
  const v = useVersion();
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    let alive = true;
    db.jobs.list().then((j) => alive && setJobs(j));
    return () => {
      alive = false;
    };
  }, [v]);
  return jobs;
}

export function useJob(id: string | undefined): Job | null {
  const v = useVersion();
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    db.jobs.get(id).then((j) => alive && setJob(j));
    return () => {
      alive = false;
    };
  }, [id, v]);
  return job;
}

export interface Fix extends LatLng {
  accuracyM: number | null;
  at: number;
}

let lastFix: Fix | null = null;
const fixListeners = new Set<() => void>();

export function getLastFix(): Fix | null {
  return lastFix;
}

function setFix(loc: Location.LocationObject) {
  lastFix = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracyM: loc.coords.accuracy ?? null, at: loc.timestamp };
  fixListeners.forEach((l) => l());
}

/** Refreshes the GPS fix: last known immediately, then a fresh position. Resolves to the best fix or null if denied. */
export async function refreshFix(): Promise<Fix | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (last) setFix(last);
    const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setFix(fresh);
    return lastFix;
  } catch {
    return lastFix;
  }
}

/** Subscribes to the shared fix and refreshes it on mount. */
export function useFix(): Fix | null {
  const [fix, set] = useState<Fix | null>(lastFix);
  useEffect(() => {
    const l = () => set(lastFix);
    fixListeners.add(l);
    refreshFix();
    return () => {
      fixListeners.delete(l);
    };
  }, []);
  return fix;
}

/** Best-effort street address for a point. Empty string when geocoding fails. */
export async function addressFor(p: LatLng): Promise<string> {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    if (!r) return '';
    const line1 = [r.streetNumber, r.street].filter(Boolean).join(' ');
    const line2 = [r.city, r.region].filter(Boolean).join(', ');
    return [line1, line2].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

export interface NewJob {
  name: string;
  address: string;
  clientName?: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Creates a job locally and on the server. Throws LimitError when the plan's active-job cap is hit,
 * checked locally first so offline users get the same answer.
 */
export async function createJob(input: NewJob): Promise<Job> {
  const company = getCompany();
  if (!company) throw new Error('no_company');
  const limits = limitsFor(effectiveTier(company.tier, true));
  const active = await db.jobs.countActive();
  if (active >= limits.activeJobs) throw new LimitError('active_jobs', limits.activeJobs);

  const now = new Date().toISOString();
  const job = {
    id: Crypto.randomUUID(),
    companyId: company.id,
    name: input.name.trim(),
    address: input.address.trim(),
    clientName: input.clientName?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    status: 'active' as const,
    coverPhotoId: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    remote: false,
  };
  await db.jobs.upsert(job);
  track('job_created', { has_location: job.lat != null });
  await pushJob(job.id).catch(() => {});
  const saved = await db.jobs.get(job.id);
  if (!saved) throw new Error('job_missing');
  return saved;
}

/** Upserts one local job to Supabase. Deletes the local row and rethrows on a server-side limit error. */
export async function pushJob(id: string): Promise<void> {
  if (!supabaseConfigured) return;
  const job = await db.jobs.get(id);
  if (!job) return;
  const { error } = await supabase.from('projects').upsert(
    {
      id: job.id,
      company_id: job.companyId,
      name: job.name,
      address: job.address,
      client_name: job.clientName,
      lat: job.lat,
      lng: job.lng,
      status: job.status,
      cover_photo_id: job.coverPhotoId,
      archived_at: job.archivedAt,
      updated_at: job.updatedAt,
    },
    { onConflict: 'id' }
  );
  if (error) {
    const limit = limitErrorFrom(error);
    if (limit && !job.remote) {
      await db.jobs.remove(job.id);
      throw limit;
    }
    throw error;
  }
  await db.jobs.setRemote(job.id, true);
}

export async function archiveJob(id: string): Promise<void> {
  await db.jobs.setStatus(id, 'archived');
  track('job_archived');
  await pushJob(id).catch(() => {});
}

export async function unarchiveJob(id: string): Promise<void> {
  const company = getCompany();
  if (!company) throw new Error('no_company');
  const limits = limitsFor(effectiveTier(company.tier, true));
  if ((await db.jobs.countActive()) >= limits.activeJobs) throw new LimitError('active_jobs', limits.activeJobs);
  await db.jobs.setStatus(id, 'active');
  await pushJob(id).catch(() => {});
}

export async function updateJob(id: string, patch: Partial<Pick<Job, 'name' | 'address' | 'clientName'>>): Promise<void> {
  const job = await db.jobs.get(id);
  if (!job) return;
  await db.jobs.upsert({ ...job, ...patch, updatedAt: new Date().toISOString() });
  await pushJob(id).catch(() => {});
}

export async function deleteJob(id: string): Promise<void> {
  await db.jobs.remove(id);
  if (!supabaseConfigured) return;
  await supabase.from('projects').delete().eq('id', id);
}

/** Pulls the company's jobs from Supabase into SQLite. Local pending rows win. */
export async function pullJobs(): Promise<void> {
  const company = getCompany();
  if (!company || !supabaseConfigured) return;
  const { data, error } = await supabase.from('projects').select('*').eq('company_id', company.id);
  if (error || !data) return;
  for (const r of data) {
    await db.jobs.upsert({
      id: r.id,
      companyId: r.company_id,
      name: r.name,
      address: r.address ?? '',
      clientName: r.client_name,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
      coverPhotoId: r.cover_photo_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      archivedAt: r.archived_at,
      remote: true,
    });
  }
}
