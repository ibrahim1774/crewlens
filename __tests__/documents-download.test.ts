import { File } from 'expo-file-system';

import { ensureLocal } from '@/lib/documents';
import type { Doc } from '@/types/models';

const mockSigned = jest.fn(async (_path: string, _secs: number) => ({ data: { signedUrl: 'https://storage.test/signed/d1' }, error: null }));
// Supabase's download() hands back a React Native Blob, which has no arrayBuffer(): reading it that way throws.
const mockDownload = jest.fn(async () => ({ data: { size: 3 }, error: null }));
jest.mock('@/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: { storage: { from: () => ({ createSignedUrl: (p: string, s: number) => mockSigned(p, s), download: () => mockDownload() }) } },
}));

const serverOnly: Doc = {
  id: 'd1', jobId: 'j1', companyId: 'c1', name: 'Invoice', kind: 'pdf', localUri: null, storagePath: 'c1/j1/d1.v1.pdf',
  sizeBytes: 3, pages: 1, version: 1, createdBy: 'u1', sentTo: null, sentVia: null, sentAt: null, syncState: 'synced',
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
};

test('a document only on the server downloads straight to the job docs folder', async () => {
  const fetchFile = jest.spyOn(File, 'downloadFileAsync');
  const uri = await ensureLocal(serverOnly);
  expect(mockSigned).toHaveBeenCalledWith('c1/j1/d1.v1.pdf', expect.any(Number));
  expect(fetchFile).toHaveBeenCalledWith('https://storage.test/signed/d1', expect.anything(), expect.anything());
  expect(mockDownload).not.toHaveBeenCalled();
  expect(uri).toBe('file:///documents/docs/j1/d1.pdf');
});
