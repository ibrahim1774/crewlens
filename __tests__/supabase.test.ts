import { LimitError, limitErrorFrom } from '@/lib/supabase';

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
