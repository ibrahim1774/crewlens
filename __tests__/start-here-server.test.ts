// After signing in on a new phone (or after sign-out), the local flags are empty. The Start here
// card must ask the server whether a link was ever shared or a document uploaded.
const mockCounts: Record<string, number> = { share_links: 0, documents: 0 };
const mockEq = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => {
          mockEq(table, col, val);
          return Promise.resolve({ count: mockCounts[table], error: null });
        },
      }),
    }),
  },
}));
jest.mock('@/lib/company', () => ({ getCompany: () => ({ id: 'c1' }) }));
jest.mock('@/lib/db', () => ({ meta: { get: jest.fn(), set: jest.fn() } }));
jest.mock('@/lib/documents', () => ({ countAllDocuments: jest.fn() }));
jest.mock('@/lib/jobs', () => ({ useJobs: () => [] }));
jest.mock('@/lib/store', () => ({ notify: jest.fn(), useVersion: () => 0 }));

import { serverStartFacts } from '@/lib/start-here';

beforeEach(() => mockEq.mockClear());

test('a link shared and a document uploaded before sign-in still count', async () => {
  mockCounts.share_links = 2;
  mockCounts.documents = 1;
  await expect(serverStartFacts()).resolves.toEqual({ linkShared: true, documents: 1 });
  expect(mockEq).toHaveBeenCalledWith('share_links', 'company_id', 'c1');
  expect(mockEq).toHaveBeenCalledWith('documents', 'company_id', 'c1');
});

test('nothing on the server means nothing done', async () => {
  mockCounts.share_links = 0;
  mockCounts.documents = 0;
  await expect(serverStartFacts()).resolves.toEqual({ linkShared: false, documents: 0 });
});
