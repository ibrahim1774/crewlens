import { ready, resetLocal } from '@/lib/db';
import { mapJobRow, mapPhotoRow } from '@/lib/db-map';

test('maps a job row with nulls and derived counts', () => {
  const j = mapJobRow({
    id: 'a', company_id: 'c', name: 'Johnson House', address: '', client_name: null, lat: null, lng: null,
    status: 'active', cover_photo_id: null, created_at: 't', updated_at: 't', archived_at: null, remote: 0,
    photo_count: 0, pending_count: 0, last_photo_at: null,
  });
  expect(j).toMatchObject({ id: 'a', lat: null, clientName: null, photoCount: 0, pendingCount: 0, lastPhotoAt: null, remote: false });
});

test('maps a job row with values', () => {
  const j = mapJobRow({
    id: 'a', company_id: 'c', name: 'n', address: '1 Main', client_name: 'Jo', lat: 40.1, lng: -74.2,
    status: 'archived', cover_photo_id: 'p', created_at: 't', updated_at: 't2', archived_at: 't3', remote: 1,
    photo_count: 3, pending_count: 1, last_photo_at: '2026-10-17T10:00:00Z', cover_uri: 'file:///t.jpg',
  });
  expect(j).toMatchObject({ coverUri: 'file:///t.jpg', lat: 40.1, lng: -74.2, status: 'archived', coverPhotoId: 'p', archivedAt: 't3', photoCount: 3, pendingCount: 1, remote: true });
});

test('maps a photo row', () => {
  const p = mapPhotoRow({
    id: 'p', job_id: 'j', company_id: 'c', taker_id: 'u', taker_initials: 'IBR', kind: 'photo',
    local_uri: 'file:///x.jpg', local_thumb_uri: null, storage_path: null, thumb_path: null, width: 2048, height: 1536,
    duration_s: null, taken_at: 't', lat: 1, lng: 2, accuracy_m: 5, sync_state: 'pending', attempts: 0, last_error: null,
    uploading_since: null, next_attempt_at: null,
  });
  expect(p).toMatchObject({ id: 'p', jobId: 'j', takerInitials: 'IBR', localUri: 'file:///x.jpg', localThumbUri: null, width: 2048, syncState: 'pending', attempts: 0 });
});

test('resetLocal wipes photos, jobs and tombstones but keeps the intro-seen flag', async () => {
  const sql: string[] = [];
  const db = await ready();
  const orig = db.execAsync;
  db.execAsync = async (s: string) => {
    sql.push(s);
  };
  try {
    await resetLocal();
  } finally {
    db.execAsync = orig;
  }
  const reset = sql.find((s) => s.includes('delete from meta'));
  expect(reset).toBeDefined();
  expect(reset).toContain("delete from meta where key <> 'intro_seen'");
  expect(reset).toContain('delete from photos');
  expect(reset).toContain('delete from jobs');
  expect(reset).toContain('delete from tombstones');
});
