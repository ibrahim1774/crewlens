/**
 * The document editor runs inside a WebView: pdf.js renders pages to canvases, an overlay layer
 * holds text, checks, dates, signatures and the Crew Lens stamp, and export flattens each page to
 * a JPEG that the app prints into a new PDF. Coordinates are stored in PDF points so the export
 * matches the screen exactly.
 */

export interface EditorInput {
  kind: 'pdf' | 'image';
  base64: string;
  mime: string;
  pdfjsSource: string;
  workerSource: string;
  accent: string;
  ink: string;
  stampLines: [string, string];
}

export type EditorTool = 'none' | 'text' | 'check' | 'date' | 'sign' | 'stamp';

/** JSON for inline script use: a closing tag inside a string must never end the script element. */
function js(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

export function buildEditorHtml(i: EditorInput): string {
  const cfg = js({ kind: i.kind, mime: i.mime, accent: i.accent, ink: i.ink, stampLines: i.stampLines });
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#E9E7E1;font-family:-apple-system,Helvetica,Arial,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  #pages{padding:12px 12px 120px}
  .page{position:relative;margin:0 auto 12px;background:#fff;box-shadow:0 1px 0 #C9C7C0;touch-action:pan-y}
  .page canvas{display:block;width:100%;height:auto}
  .ov{position:absolute;left:0;top:0;right:0;bottom:0}
  .el{position:absolute;transform-origin:top left;white-space:pre;line-height:1.15;color:${i.ink};font-weight:600}
  .el.sel{outline:2px solid ${i.accent};outline-offset:2px}
  .el img{display:block;width:100%;height:auto;pointer-events:none}
  .del{position:absolute;right:-14px;top:-14px;width:26px;height:26px;border-radius:13px;background:${i.accent};color:#fff;font:700 15px/26px sans-serif;text-align:center;display:none}
  .el.sel .del{display:block}
  .grip{position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;border-radius:4px;background:${i.ink};display:none}
  .el.sel .grip{display:block}
  .el[contenteditable]{min-width:40px;outline:none;-webkit-user-select:text;user-select:text}
  #pad{position:fixed;left:0;right:0;bottom:0;top:0;background:rgba(21,22,26,.86);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:50}
  #pad canvas{background:#fff;border-radius:6px;touch-action:none}
  #pad .bar{display:flex;gap:12px;margin-top:14px}
  #pad button{font:600 16px/44px sans-serif;padding:0 20px;border-radius:6px;border:0;color:#fff;background:#3D5A80}
  #pad button.ok{background:${i.accent}}
  #hint{position:fixed;left:12px;right:12px;bottom:14px;background:${i.ink};color:#F7F6F2;font:600 13px/36px -apple-system;text-align:center;border-radius:6px;display:none;z-index:40}
</style></head>
<body>
<div id="pages"></div>
<div id="hint"></div>
<div id="pad"><canvas id="padc"></canvas><div class="bar"><button id="padclear">Clear</button><button id="padcancel">Cancel</button><button id="padok" class="ok">Use signature</button></div></div>
<script type="module">
const CFG = ${cfg};
const BASE64 = ${js(i.base64.replace(/[^A-Za-z0-9+/=]/g, ""))};
const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
window.onerror = (msg, src, line) => post({ type: 'error', message: String(msg) + ' @' + line });

let pdfjs = null, pdfDoc = null;
const pages = []; // {idx, wpt, hpt, scale, el, canvas, ov, items:[], render(scale)->Promise<canvas>}
let tool = 'none', selected = null;
const undoStack = [];

const b64ToBytes = (b) => { const bin = atob(b); const out = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k); return out; };

async function loadPdfjs() {
  const src = ${js(i.pdfjsSource)};
  const worker = ${js(i.workerSource)};
  const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  mod.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }));
  return mod;
}

function hint(t) { const h = document.getElementById('hint'); if (!t) { h.style.display = 'none'; return; } h.textContent = t; h.style.display = 'block'; }

function makePage(idx, wpt, hpt) {
  const el = document.createElement('div'); el.className = 'page';
  const canvas = document.createElement('canvas');
  const ov = document.createElement('div'); ov.className = 'ov';
  el.appendChild(canvas); el.appendChild(ov);
  document.getElementById('pages').appendChild(el);
  const p = { idx, wpt, hpt, el, canvas, ov, items: [], scale: 1 };
  ov.addEventListener('click', (e) => { if (e.target !== ov) return; onTap(p, e); });
  pages.push(p);
  return p;
}

function layoutScale(wpt) { return (document.getElementById('pages').clientWidth - 24) / wpt; }

async function renderPdf() {
  pdfjs = await loadPdfjs();
  pdfDoc = await pdfjs.getDocument({ data: b64ToBytes(BASE64) }).promise;
  post({ type: 'pages', count: pdfDoc.numPages });
  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const p = makePage(n - 1, vp1.width, vp1.height);
    p.pdfPage = page;
    await drawPage(p);
  }
  post({ type: 'ready' });
}

async function drawPage(p) {
  const scale = layoutScale(p.wpt); p.scale = scale;
  const dpr = Math.min(3, window.devicePixelRatio || 2);
  const vp = p.pdfPage.getViewport({ scale: scale * dpr });
  p.canvas.width = vp.width; p.canvas.height = vp.height;
  p.canvas.style.height = (p.hpt * scale) + 'px';
  p.el.style.height = (p.hpt * scale) + 'px';
  await p.pdfPage.render({ canvasContext: p.canvas.getContext('2d'), viewport: vp }).promise;
  redraw(p);
}

function renderImage() {
  const img = new Image();
  img.onload = () => {
    const wpt = 612, hpt = Math.round(612 * img.naturalHeight / img.naturalWidth);
    const p = makePage(0, wpt, hpt); p.img = img;
    const scale = layoutScale(wpt); p.scale = scale;
    const dpr = Math.min(3, window.devicePixelRatio || 2);
    p.canvas.width = wpt * scale * dpr; p.canvas.height = hpt * scale * dpr;
    p.canvas.style.height = (hpt * scale) + 'px'; p.el.style.height = (hpt * scale) + 'px';
    p.canvas.getContext('2d').drawImage(img, 0, 0, p.canvas.width, p.canvas.height);
    post({ type: 'pages', count: 1 }); post({ type: 'ready' });
  };
  img.src = 'data:' + CFG.mime + ';base64,' + BASE64;
}

function select(item) { if (selected && selected.dom) selected.dom.classList.remove('sel'); selected = item; if (item && item.dom) item.dom.classList.add('sel'); }

function redraw(p) {
  p.ov.innerHTML = '';
  for (const it of p.items) {
    const d = document.createElement('div'); d.className = 'el';
    d.style.left = (it.x * p.scale) + 'px'; d.style.top = (it.y * p.scale) + 'px';
    if (it.type === 'image') { d.style.width = (it.w * p.scale) + 'px'; const im = document.createElement('img'); im.src = it.data; d.appendChild(im); }
    else { d.style.fontSize = (it.size * p.scale) + 'px'; d.textContent = it.text; if (it.type === 'text') { d.contentEditable = 'true'; d.addEventListener('input', () => { it.text = d.textContent; }); d.addEventListener('blur', () => { if (!d.textContent.trim()) { remove(p, it); } }); } }
    if (it.type === 'stamp') { d.style.background = 'rgba(11,11,13,.78)'; d.style.color = '#F7F6F2'; d.style.padding = (4 * p.scale) + 'px ' + (7 * p.scale) + 'px'; d.style.fontFamily = 'Menlo, monospace'; d.style.borderRadius = '2px'; d.style.fontWeight = '500'; }
    const del = document.createElement('div'); del.className = 'del'; del.textContent = '×'; del.addEventListener('click', (e) => { e.stopPropagation(); remove(p, it); });
    const grip = document.createElement('div'); grip.className = 'grip';
    d.appendChild(del); d.appendChild(grip);
    it.dom = d; p.ov.appendChild(d);
    if (selected === it) d.classList.add('sel');
    drag(p, it, d, grip);
    d.addEventListener('click', (e) => { e.stopPropagation(); select(it); });
  }
}

function remove(p, it) { const k = p.items.indexOf(it); if (k >= 0) { undoStack.push({ page: p, item: it, index: k }); p.items.splice(k, 1); } if (selected === it) selected = null; redraw(p); post({ type: 'dirty', dirty: true }); }

function drag(p, it, d, grip) {
  let start = null, mode = 'move';
  const down = (e) => { const t = e.touches ? e.touches[0] : e; mode = e.target === grip ? 'resize' : 'move'; start = { x: t.clientX, y: t.clientY, ix: it.x, iy: it.y, iw: it.w, is: it.size }; select(it); if (mode === 'resize') e.preventDefault(); };
  const move = (e) => { if (!start) return; const t = e.touches ? e.touches[0] : e; const dx = (t.clientX - start.x) / p.scale, dy = (t.clientY - start.y) / p.scale;
    if (mode === 'move') { it.x = Math.max(0, start.ix + dx); it.y = Math.max(0, start.iy + dy); d.style.left = (it.x * p.scale) + 'px'; d.style.top = (it.y * p.scale) + 'px'; }
    else if (it.type === 'image') { it.w = Math.max(30, start.iw + dx); d.style.width = (it.w * p.scale) + 'px'; }
    else { it.size = Math.max(6, start.is + dy * 0.5); d.style.fontSize = (it.size * p.scale) + 'px'; }
    if (e.cancelable && (mode === 'resize' || Math.abs(dx) + Math.abs(dy) > 2)) e.preventDefault(); post({ type: 'dirty', dirty: true }); };
  const up = () => { start = null; };
  d.addEventListener('touchstart', down, { passive: false }); d.addEventListener('touchmove', move, { passive: false }); d.addEventListener('touchend', up);
  d.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
}

function add(p, it) { p.items.push(it); undoStack.push({ page: p, item: it, index: -1 }); redraw(p); select(it); post({ type: 'dirty', dirty: true }); }

function today() { const d = new Date(); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

function onTap(p, e) {
  const r = p.ov.getBoundingClientRect();
  const x = (e.clientX - r.left) / p.scale, y = (e.clientY - r.top) / p.scale;
  if (tool === 'none') { select(null); return; }
  if (tool === 'text') { add(p, { type: 'text', text: 'Text', x, y, size: 12 }); setTimeout(() => { const d = p.items[p.items.length - 1].dom; d.focus(); document.execCommand && document.execCommand('selectAll', false, null); }, 30); }
  if (tool === 'check') add(p, { type: 'check', text: '✓', x, y, size: 16 });
  if (tool === 'date') add(p, { type: 'date', text: today(), x, y, size: 12 });
  if (tool === 'stamp') add(p, { type: 'stamp', text: CFG.stampLines[0] + '\\n' + CFG.stampLines[1], x, y, size: 8 });
  if (tool === 'sign') openPad((data) => add(p, { type: 'image', data, x, y, w: Math.min(200, p.wpt * 0.38), h: 0 }));
  setTool('none');
}

function setTool(t) { tool = t; post({ type: 'tool', tool: t }); hint(t === 'none' ? '' : t === 'sign' ? 'Tap where the signature goes' : t === 'text' ? 'Tap where the text goes' : t === 'check' ? 'Tap to place a check mark' : t === 'date' ? 'Tap to place today\\'s date' : 'Tap to place the stamp'); }

let padCb = null, padCtx = null, padDrawn = false;
function openPad(cb) {
  const pad = document.getElementById('pad'), c = document.getElementById('padc');
  const w = Math.min(window.innerWidth - 32, 520); c.width = w * 2; c.height = Math.round(w * 0.45) * 2; c.style.width = w + 'px'; c.style.height = Math.round(w * 0.45) + 'px';
  padCtx = c.getContext('2d'); padCtx.scale(2, 2); padCtx.lineWidth = 2.4; padCtx.lineCap = 'round'; padCtx.lineJoin = 'round'; padCtx.strokeStyle = '#15161A';
  padDrawn = false; padCb = cb; pad.style.display = 'flex';
}
(() => {
  const c = document.getElementById('padc'); let last = null;
  const pt = (e) => { const t = e.touches ? e.touches[0] : e; const r = c.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
  const s = (e) => { last = pt(e); e.preventDefault(); }; const m = (e) => { if (!last) return; const p = pt(e); padCtx.beginPath(); padCtx.moveTo(last.x, last.y); padCtx.lineTo(p.x, p.y); padCtx.stroke(); last = p; padDrawn = true; e.preventDefault(); }; const u = () => { last = null; };
  c.addEventListener('touchstart', s, { passive: false }); c.addEventListener('touchmove', m, { passive: false }); c.addEventListener('touchend', u); c.addEventListener('mousedown', s); c.addEventListener('mousemove', m); c.addEventListener('mouseup', u);
  document.getElementById('padclear').onclick = () => { padCtx.clearRect(0, 0, c.width, c.height); padDrawn = false; };
  document.getElementById('padcancel').onclick = () => { document.getElementById('pad').style.display = 'none'; };
  document.getElementById('padok').onclick = () => { document.getElementById('pad').style.display = 'none'; if (!padDrawn) return; const data = trimCanvas(c).toDataURL('image/png'); padCb && padCb(data); };
})();
function trimCanvas(c) {
  const ctx = c.getContext('2d'), w = c.width, h = c.height, img = ctx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (img[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 <= x0) return c; const out = document.createElement('canvas'); const pad = 8; out.width = x1 - x0 + pad * 2; out.height = y1 - y0 + pad * 2; out.getContext('2d').drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height); return out;
}

async function exportPages() {
  hint('Saving…');
  for (const p of pages) {
    const S = 2.2; // export scale in px per point
    const c = document.createElement('canvas'); c.width = Math.round(p.wpt * S); c.height = Math.round(p.hpt * S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    if (p.pdfPage) { const vp = p.pdfPage.getViewport({ scale: S }); await p.pdfPage.render({ canvasContext: ctx, viewport: vp }).promise; }
    else if (p.img) ctx.drawImage(p.img, 0, 0, c.width, c.height);
    for (const it of p.items) {
      if (it.type === 'image') { await new Promise((res) => { const im = new Image(); im.onload = () => { const h = it.w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, it.x * S, it.y * S, it.w * S, h * S); res(); }; im.onerror = res; im.src = it.data; }); continue; }
      const lines = String(it.text).split('\\n'); const lh = it.size * 1.15;
      if (it.type === 'stamp') { ctx.font = '500 ' + (it.size * S) + 'px Menlo, monospace'; const wmax = Math.max(...lines.map((l) => ctx.measureText(l).width)); ctx.fillStyle = 'rgba(11,11,13,0.78)'; ctx.fillRect(it.x * S, it.y * S, wmax + 14 * S, (lh * lines.length + 8) * S); ctx.fillStyle = '#F7F6F2'; }
      else { ctx.font = '600 ' + (it.size * S) + 'px -apple-system, Helvetica, Arial, sans-serif'; ctx.fillStyle = CFG.ink; }
      ctx.textBaseline = 'top';
      lines.forEach((l, k) => ctx.fillText(l, (it.x + (it.type === 'stamp' ? 7 : 0)) * S, (it.y + (it.type === 'stamp' ? 4 : 0) + k * lh) * S));
    }
    post({ type: 'page', index: p.idx, total: pages.length, wpt: p.wpt, hpt: p.hpt, data: c.toDataURL('image/jpeg', 0.9) });
  }
  hint(''); post({ type: 'exported' });
}

window.__crew = (cmd, arg) => {
  if (cmd === 'tool') setTool(arg);
  if (cmd === 'undo') { const u = undoStack.pop(); if (!u) return; if (u.index === -1) { const k = u.page.items.indexOf(u.item); if (k >= 0) u.page.items.splice(k, 1); } else u.page.items.splice(u.index, 0, u.item); select(null); redraw(u.page); post({ type: 'dirty', dirty: undoStack.length > 0 }); }
  if (cmd === 'export') exportPages().catch((e) => post({ type: 'error', message: String(e) }));
  if (cmd === 'deselect') select(null);
};
window.addEventListener('resize', () => pages.forEach((p) => (p.pdfPage ? drawPage(p) : null)));
(CFG.kind === 'pdf' ? renderPdf() : (renderImage(), Promise.resolve())).catch((e) => post({ type: 'error', message: String(e && e.message || e) }));
</script>
</body></html>`;
}
