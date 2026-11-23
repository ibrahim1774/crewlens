import { fetchWithTimeout, LimitError, limitErrorFrom, REQUEST_TIMEOUT_MS } from '@/lib/supabase';

test('maps the active projects trigger error', () => {
  const e = limitErrorFrom({ message: 'limit_active_projects', hint: '25', code: 'P0001' });
  expect(e).toBeInstanceOf(LimitError);
  expect(e).toMatchObject({ kind: 'active_jobs', limit: 25 });
});

test('maps the photos trigger error without a hint', () => {
  expect(limitErrorFrom({ message: 'limit_photos_per_project' })).toMatchObject({ kind: 'photos_per_job', limit: null });
});

test('ignores unrelated errors', () => {
  expect(limitErrorFrom(new Error('network'))).toBeNull();
  expect(limitErrorFrom(null)).toBeNull();
});

describe('fetchWithTimeout', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  // A fetch that never answers unless its signal aborts, like a stale socket.
  const hangingFetch = jest.fn((_input: unknown, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    }),
  );

  test('gives up on a request that never answers', async () => {
    jest.useFakeTimers();
    global.fetch = hangingFetch as unknown as typeof fetch;
    const p = fetchWithTimeout('https://x.supabase.co/rest/v1/share_links', { method: 'POST' });
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);
    await expect(p).rejects.toThrow('Network request timed out');
  });

  test('leaves storage uploads alone (big files take longer)', () => {
    global.fetch = jest.fn(() => Promise.resolve('ok')) as unknown as typeof fetch;
    void fetchWithTimeout('https://x.supabase.co/storage/v1/object/photos/a.jpg', { method: 'POST' });
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.signal).toBeUndefined();
  });

  test('still honours an abort the caller asked for', async () => {
    global.fetch = hangingFetch as unknown as typeof fetch;
    const caller = new AbortController();
    const p = fetchWithTimeout('https://x.supabase.co/rest/v1/jobs', { signal: caller.signal });
    caller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
