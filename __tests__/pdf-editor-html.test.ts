import { buildEditorHtml } from '@/lib/pdf-editor-html';

const base = { kind: 'pdf' as const, base64: 'AAAA', mime: 'application/pdf', pdfjsSource: 'export const GlobalWorkerOptions={};export function getDocument(){}', workerSource: '// worker', accent: '#E8521E', ink: '#15161A', stampLines: ['14:42 · OCT 17 2026', '40.7128N 74.0060W · JOS'] as [string, string] };

test('the editor page embeds the document, pdf.js and the stamp lines', () => {
  const html = buildEditorHtml(base);
  expect(html).toContain('const BASE64 = "AAAA"');
  expect(html).toContain('GlobalWorkerOptions');
  expect(html).toContain('40.7128N 74.0060W · JOS');
  expect(html).toContain('"kind":"pdf"');
});

test('tools, undo, export and deselect are reachable from the app', () => {
  const html = buildEditorHtml({ ...base, kind: 'image', mime: 'image/jpeg' });
  for (const cmd of ["cmd === 'tool'", "cmd === 'undo'", "cmd === 'export'", "cmd === 'deselect'"]) expect(html).toContain(cmd);
  expect(html).toContain('"kind":"image"');
});

test('document data is never interpolated as raw script', () => {
  const html = buildEditorHtml({ ...base, pdfjsSource: '</script><script>alert(1)</script>' });
  expect(html).not.toContain('</script><script>alert(1)</script>');
});
