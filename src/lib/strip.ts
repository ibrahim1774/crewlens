import { distanceM, type LatLng } from '@/lib/geo';
import { rankJobs } from '@/lib/jobs';
import type { Job } from '@/types/models';

export interface StripChip {
  id: string;
  label: string;
  distanceM: number | null;
}

export interface StripState {
  chips: StripChip[];
  selected: string;
}

/**
 * Chips for the camera strip: "+ New job here" first, then nearby (closest first), recent, the rest.
 * Selection: a requested job (deep link or manual tap) wins and moves to the front; else the nearest
 * job; else the new-job chip.
 */
export function stripOrder(jobs: Job[], here: LatLng | null, requested: string | null): StripState {
  const r = rankJobs(jobs, here);
  const ordered = [...r.nearby, ...r.recent, ...r.all];
  const toChip = (j: Job): StripChip => ({
    id: j.id,
    label: j.name,
    distanceM: here && j.lat != null && j.lng != null ? distanceM(here, { lat: j.lat, lng: j.lng }) : null,
  });

  const req = requested ? ordered.find((j) => j.id === requested) : undefined;
  const list = req ? [req, ...ordered.filter((j) => j.id !== req.id)] : ordered;

  const chips: StripChip[] = [{ id: 'new', label: 'New job here', distanceM: null }, ...list.map(toChip)];
  const selected = req ? req.id : r.nearby[0]?.id ?? 'new';
  return { chips, selected };
}
