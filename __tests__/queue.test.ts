import { MAX_UPLOAD_ATTEMPTS } from '@/constants/limits';
import { backoffMs, nextState, pickNext, STALE_UPLOADING_MS } from '@/lib/queue';

const item = (over: Partial<Parameters<typeof nextState>[0]> = {}) =>
  ({ id: 'p', syncState: 'pending', attempts: 0, uploadingSince: null, lastError: null, nextAttemptAt: null, takenAt: '2026-10-17T10:00:00Z', ...over }) as Parameters<typeof nextState>[0];

const NOW = '2026-10-17T12:00:00.000Z';

test('pending -> uploading records when it started', () => {
  const s = nextState(item(), { type: 'start', now: NOW });
  expect(s.syncState).toBe('uploading');
  expect(s.uploadingSince).toBe(NOW);
});

test('uploading -> synced clears error and timer', () => {
  const s = nextState(item({ syncState: 'uploading', uploadingSince: NOW, lastError: 'x' }), { type: 'ok' });
  expect(s).toMatchObject({ syncState: 'synced', uploadingSince: null, lastError: null });
});

test('error increments attempts, schedules a retry, and fails at the max', () => {
  const retry = nextState(item({ syncState: 'uploading', attempts: 2 }), { type: 'error', message: 'net', now: NOW });
  expect(retry).toMatchObject({ syncState: 'pending', attempts: 3, lastError: 'net', uploadingSince: null });
  expect(Date.parse(retry.nextAttemptAt!) - Date.parse(NOW)).toBe(backoffMs(3));

  const dead = nextState(item({ syncState: 'uploading', attempts: MAX_UPLOAD_ATTEMPTS - 1 }), { type: 'error', message: 'net', now: NOW });
  expect(dead).toMatchObject({ syncState: 'failed', attempts: MAX_UPLOAD_ATTEMPTS });
});

test('a permanent error fails immediately', () => {
  const s = nextState(item({ syncState: 'uploading' }), { type: 'error', message: 'limit_photos_per_project', now: NOW, permanent: true });
  expect(s.syncState).toBe('failed');
});

test('sweep resets stale uploading rows, leaves fresh ones', () => {
  const stale = new Date(Date.parse(NOW) - STALE_UPLOADING_MS - 1).toISOString();
  expect(nextState(item({ syncState: 'uploading', uploadingSince: stale }), { type: 'sweep', now: NOW }).syncState).toBe('pending');
  expect(nextState(item({ syncState: 'uploading', uploadingSince: NOW }), { type: 'sweep', now: NOW }).syncState).toBe('uploading');
});

test('retry resets a failed row', () => {
  expect(nextState(item({ syncState: 'failed', attempts: 8, lastError: 'x' }), { type: 'retry' })).toMatchObject({ syncState: 'pending', attempts: 0, lastError: null, nextAttemptAt: null });
  expect(nextState(item({ syncState: 'synced' }), { type: 'retry' }).syncState).toBe('synced');
});

test('backoff doubles from 2s and caps at 5 minutes', () => {
  expect(backoffMs(1)).toBe(2000);
  expect(backoffMs(2)).toBe(4000);
  expect(backoffMs(3)).toBe(8000);
  expect(backoffMs(20)).toBe(300000);
});

test('pickNext takes the oldest pending row whose retry time has passed', () => {
  const a = item({ id: 'a', takenAt: '2026-10-17T09:00:00Z', nextAttemptAt: '2026-10-17T12:30:00Z' }); // not yet
  const b = item({ id: 'b', takenAt: '2026-10-17T10:00:00Z' });
  const c = item({ id: 'c', takenAt: '2026-10-17T08:00:00Z', syncState: 'failed' });
  const d = item({ id: 'd', takenAt: '2026-10-17T11:00:00Z' });
  expect(pickNext([a, b, c, d], NOW)?.id).toBe('b');
  expect(pickNext([a, c], NOW)).toBeNull();
});
