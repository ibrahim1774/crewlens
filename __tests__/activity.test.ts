import { buildActivity, dayLabel } from '@/lib/activity';
import type { Doc, Job, Photo } from '@/types/models';

const job = (id: string): Job => ({ id, companyId: 'c', name: `Job ${id}`, address: '', clientName: null, lat: null, lng: null, status: 'active', coverPhotoId: null, createdAt: 't', updatedAt: 't', archivedAt: null, remote: true, dirty: false, syncError: null, coverUri: null, coverRemote: null, photoCount: 0, pendingCount: 0, lastPhotoAt: null });
const photo = (id: string, jobId: string, at: string, initials = 'JOS'): Photo => ({ id, jobId, companyId: 'c', takerId: 'u', takerInitials: initials, kind: 'photo', localUri: null, localThumbUri: null, storagePath: null, thumbPath: null, width: 0, height: 0, durationS: null, takenAt: at, lat: null, lng: null, accuracyM: null, syncState: 'synced', attempts: 0, lastError: null, uploadingSince: null, nextAttemptAt: null });
const doc = (id: string, jobId: string, extra: Partial<Doc> = {}): Doc => ({ id, jobId, companyId: 'c', name: 'Invoice', kind: 'pdf', localUri: null, storagePath: null, sizeBytes: null, pages: null, version: 1, createdBy: 'u', sentTo: null, sentVia: null, sentAt: null, syncState: 'synced', createdAt: '2026-10-17T09:00:00Z', updatedAt: '2026-10-17T09:00:00Z', ...extra });
const NOW = Date.parse('2026-10-17T12:00:00Z');

test('photos on the same job by the same person within 30 minutes form one burst', () => {
  const items = buildActivity(
    [photo('a', 'j1', '2026-10-17T10:00:00Z'), photo('b', 'j1', '2026-10-17T10:10:00Z'), photo('c', 'j1', '2026-10-17T11:00:00Z'), photo('d', 'j2', '2026-10-17T10:05:00Z'), photo('e', 'j1', '2026-10-17T10:12:00Z', 'MRT')],
    [], [job('j1'), job('j2')], NOW,
  );
  expect(items.map((i) => (i.kind === 'photos' ? `${i.job.id}:${i.initials}:${i.photos.length}` : 'doc'))).toEqual(['j1:JOS:1', 'j1:MRT:1', 'j1:JOS:2', 'j2:JOS:1']);
});

test('documents produce added, edited and sent events, newest first, and ignore unknown jobs', () => {
  const items = buildActivity([], [doc('d1', 'j1', { version: 2, updatedAt: '2026-10-17T10:00:00Z', sentAt: '2026-10-17T11:00:00Z', sentVia: 'text' }), doc('d2', 'zzz')], [job('j1')], NOW);
  expect(items.map((i) => (i.kind === 'document' ? i.event : 'photos'))).toEqual(['sent', 'edited', 'added']);
});

test('day labels read today, yesterday, then the date', () => {
  const now = new Date('2026-10-17T15:00:00');
  expect(dayLabel('2026-10-17T09:00:00', now)).toBe('TODAY');
  expect(dayLabel('2026-10-16T23:00:00', now)).toBe('YESTERDAY');
  expect(dayLabel('2026-10-13T09:00:00', now)).toBe('TUE, OCT 13');
});
