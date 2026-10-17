import { rankJobs } from '@/lib/jobs';
import type { Job } from '@/types/models';

const job = (id: string, lat: number | null, lng: number | null, last: string | null, status: Job['status'] = 'active'): Job =>
  ({ id, name: id, lat, lng, lastPhotoAt: last, status }) as Job;

test('nearby within 300m sorted by distance, archived excluded', () => {
  const here = { lat: 40.0, lng: -74.0 };
  const near = job('a', 40.001, -74.0, null); // ~111 m
  const far = job('b', 40.01, -74.0, null); // ~1.1 km
  const nearer = job('c', 40.0005, -74.0, null); // ~55 m
  const archived = job('z', 40.0005, -74.0, null, 'archived');
  const r = rankJobs([near, far, nearer, archived], here);
  expect(r.nearby.map((j) => j.id)).toEqual(['c', 'a']);
  expect(r.recent).toEqual([]);
  expect(r.all.map((j) => j.id)).toEqual(['b']);
  expect(r.archived.map((j) => j.id)).toEqual(['z']);
});

test('no location: nearby empty, recent by last photo desc, rest alphabetical', () => {
  const r = rankJobs([job('b', 1, 1, '2026-02-01'), job('a', 1, 1, '2026-01-01'), job('d', 1, 1, null), job('c', 1, 1, null)], null);
  expect(r.nearby).toEqual([]);
  expect(r.recent.map((j) => j.id)).toEqual(['b', 'a']);
  expect(r.all.map((j) => j.id)).toEqual(['c', 'd']);
});

test('jobs without coordinates are never nearby', () => {
  const r = rankJobs([job('a', null, null, null)], { lat: 0, lng: 0 });
  expect(r.nearby).toEqual([]);
  expect(r.all.map((j) => j.id)).toEqual(['a']);
});
