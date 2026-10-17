import { stripOrder } from '@/lib/strip';
import type { Job } from '@/types/models';

const job = (id: string, lat: number | null, last: string | null): Job => ({ id, name: id, lat, lng: lat, lastPhotoAt: last, status: 'active' }) as Job;

test('nearest job first and selected, then recent, then the rest; new-job chip is always present', () => {
  const here = { lat: 40.0, lng: 40.0 };
  const jobs = [job('far', 41, '2026-10-17T10:00:00Z'), job('near', 40.0005, null), job('old', null, '2026-01-01T00:00:00Z'), job('none', null, null)];
  const r = stripOrder(jobs, here, null);
  expect(r.chips.map((c) => c.id)).toEqual(['new', 'near', 'far', 'old', 'none']);
  expect(r.selected).toBe('near');
});

test('with no nearby job the new-job chip is selected', () => {
  const r = stripOrder([job('a', 10, null)], { lat: 40, lng: 40 }, null);
  expect(r.selected).toBe('new');
});

test('a requested job wins over the nearest and is moved to the front', () => {
  const here = { lat: 40.0, lng: 40.0 };
  const r = stripOrder([job('near', 40.0005, null), job('req', 10, null)], here, 'req');
  expect(r.selected).toBe('req');
  expect(r.chips.map((c) => c.id)).toEqual(['new', 'req', 'near']);
});

test('archived jobs never appear', () => {
  const r = stripOrder([{ ...job('z', 40, null), status: 'archived' }], { lat: 40, lng: 40 }, null);
  expect(r.chips.map((c) => c.id)).toEqual(['new']);
});
