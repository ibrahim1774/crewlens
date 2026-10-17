import { docStorageKey, formatSize, kindFor } from '@/lib/documents';

test('storage keys are company/job/doc with the right extension', () => {
  expect(docStorageKey('c1', 'j1', 'd1', 'pdf')).toBe('c1/j1/d1.pdf');
  expect(docStorageKey('c1', 'j1', 'd1', 'image')).toBe('c1/j1/d1.jpg');
});

test('kind is read from the mime type, then the file name, else rejected', () => {
  expect(kindFor('application/pdf', 'x')).toBe('pdf');
  expect(kindFor(null, 'Invoice 0412.PDF')).toBe('pdf');
  expect(kindFor('image/png', 'scan')).toBe('image');
  expect(kindFor(null, 'photo.HEIC')).toBe('image');
  expect(kindFor('text/plain', 'notes.txt')).toBeNull();
});

test('sizes read like a file manager', () => {
  expect(formatSize(null)).toBe('0 KB');
  expect(formatSize(1536)).toBe('2 KB');
  expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
});
