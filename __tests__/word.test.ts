import { readFileSync } from 'fs';
import { join } from 'path';

import { uploadErrorMessage } from '@/lib/documents';
import { docxToHtml, pdfName, Utf8Decoder, wordKind, wordPageHtml } from '@/lib/word';

const sample = () => new Uint8Array(readFileSync(join(__dirname, '../test/fixtures/sample.docx')));

test('Word files are recognised by mime type, then by name', () => {
  expect(wordKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x')).toBe('docx');
  expect(wordKind(null, 'Estimate 1042.DOCX')).toBe('docx');
  expect(wordKind('application/msword', 'old')).toBe('doc');
  expect(wordKind(null, 'contract.doc')).toBe('doc');
  expect(wordKind('application/pdf', 'invoice.pdf')).toBeNull();
});

test('a converted Word file keeps its name with a .pdf ending', () => {
  expect(pdfName('Estimate 1042.docx')).toBe('Estimate 1042.pdf');
  expect(pdfName('Contract.DOC')).toBe('Contract.pdf');
});

test('a .docx becomes HTML with its text and formatting', async () => {
  const html = await docxToHtml(sample());
  expect(html).toContain('Estimate #1042');
  expect(html).toContain('<strong>Dana Lopez</strong>');
  expect(html).toContain('$8,400');
});

test('conversion still works where TextDecoder is missing (Hermes)', async () => {
  const g = globalThis as { TextDecoder?: unknown };
  const real = g.TextDecoder;
  delete g.TextDecoder;
  try {
    const html = await docxToHtml(sample());
    expect(html).toContain('Estimate #1042');
    expect(g.TextDecoder).toBe(Utf8Decoder);
  } finally {
    g.TextDecoder = real;
  }
});

test('the fallback decoder reads multi-byte UTF-8 and skips a BOM', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from('Café — 2×4 lumber 🔨', 'utf8')]);
  expect(new Utf8Decoder().decode(bytes)).toBe('Café — 2×4 lumber 🔨');
  expect(() => new Utf8Decoder('latin1')).toThrow();
});

test('a file that is not really a Word document is rejected in plain words', async () => {
  await expect(docxToHtml(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow('word_unreadable');
  expect(uploadErrorMessage(new Error('word_unreadable'))).toContain('Save As > PDF');
  expect(uploadErrorMessage(new Error('word_legacy'))).toContain('.docx');
  expect(uploadErrorMessage(new Error('unsupported_type'))).toContain('Word');
});

test('the page wrapper is letter size and carries the body', () => {
  const html = wordPageHtml('<p>Hello</p>');
  expect(html).toContain('size:612pt 792pt');
  expect(html).toContain('<body><p>Hello</p></body>');
});
