import { File } from 'expo-file-system';
import * as Print from 'expo-print';

/**
 * Word files become PDFs on the phone, at import: mammoth reads the .docx into HTML (text, headings,
 * bold/italic, lists, tables, images) and expo-print lays it out on letter pages. From then on it is an
 * ordinary PDF document, so the editor, sharing and sync need no Word-specific code. Exact Word layout
 * (headers, footers, columns, text boxes) is not kept. Old binary .doc files can't be read: the person
 * is asked to save as PDF or .docx instead.
 */

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOC_MIME = 'application/msword';

export type WordKind = 'docx' | 'doc';

export function wordKind(mime: string | null | undefined, name: string): WordKind | null {
  const m = (mime ?? '').toLowerCase();
  if (m === DOCX_MIME || /\.docx$/i.test(name)) return 'docx';
  if (m === DOC_MIME || /\.doc$/i.test(name)) return 'doc';
  return null;
}

/** "Estimate 1042.docx" -> "Estimate 1042.pdf". */
export function pdfName(name: string): string {
  return `${name.replace(/\.docx?$/i, '')}.pdf`;
}

/** UTF-8 only. Hermes may not ship TextDecoder, and mammoth decodes every part of the .docx with one. */
export class Utf8Decoder {
  constructor(encoding = 'utf-8') {
    if (!/^utf-?8$/i.test(encoding)) throw new Error(`unsupported encoding ${encoding}`);
  }
  decode(input?: ArrayBufferView | ArrayBuffer): string {
    if (!input) return '';
    const b = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let out = '';
    let k = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0; // skip BOM
    while (k < b.length) {
      const c = b[k++];
      let cp: number;
      if (c < 0x80) cp = c;
      else if (c >= 0xc0 && c < 0xe0) cp = ((c & 0x1f) << 6) | (b[k++] & 0x3f);
      else if (c >= 0xe0 && c < 0xf0) cp = ((c & 0x0f) << 12) | ((b[k++] & 0x3f) << 6) | (b[k++] & 0x3f);
      else if (c >= 0xf0) cp = ((c & 0x07) << 18) | ((b[k++] & 0x3f) << 12) | ((b[k++] & 0x3f) << 6) | (b[k++] & 0x3f);
      else cp = 0xfffd;
      out += String.fromCodePoint(cp);
    }
    return out;
  }
}

function ensureTextDecoder() {
  const g = globalThis as { TextDecoder?: unknown };
  if (typeof g.TextDecoder === 'undefined') g.TextDecoder = Utf8Decoder;
}

type Mammoth = { convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };

/** .docx bytes -> body HTML. Throws 'word_unreadable' if the file isn't a Word document or has nothing in it. */
export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  ensureTextDecoder();
  // The self-contained browser build: no Node fs/zip modules for Metro to resolve. Loaded on first use only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth/mammoth.browser') as Mammoth;
  let html: string;
  try {
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    html = (await mammoth.convertToHtml({ arrayBuffer: ab })).value;
  } catch {
    throw new Error('word_unreadable');
  }
  if (!html.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(html)) throw new Error('word_unreadable');
  return html;
}

/** Letter page, plain document styling. The 0.75 in margins come from the print options (iOS ignores @page margins). */
export function wordPageHtml(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:612pt 792pt}
body{margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.35;color:#111}
h1{font-size:20pt;margin:0 0 10pt}h2{font-size:15pt;margin:14pt 0 8pt}h3,h4,h5,h6{font-size:12pt;margin:12pt 0 6pt}
p{margin:0 0 8pt}ul,ol{margin:0 0 8pt;padding-left:22pt}
table{border-collapse:collapse;width:100%;margin:0 0 10pt;page-break-inside:auto}tr{page-break-inside:avoid}
td,th{border:0.75pt solid #999;padding:4pt 6pt;vertical-align:top}td p,th p{margin:0}
img{max-width:100%;height:auto}
</style></head><body>${body}</body></html>`;
}

/** Reads a picked .docx and prints it to a PDF file. Returns the PDF's uri and page count. */
export async function convertWordToPdf(uri: string): Promise<{ uri: string; pages: number | null }> {
  const bytes = await new File(uri).bytes();
  const body = await docxToHtml(bytes);
  const out = await Print.printToFileAsync({ html: wordPageHtml(body), width: 612, height: 792, margins: { left: 54, top: 54, right: 54, bottom: 54 } });
  return { uri: out.uri, pages: out.numberOfPages ?? null };
}
