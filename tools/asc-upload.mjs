// Uploads an image to App Store Connect: reserve, PUT the parts, commit with an MD5.
// Usage:
//   node tools/asc-upload.mjs screenshots <appStoreVersionLocalizationId> <displayType> <file...>
//   node tools/asc-upload.mjs subreview <subscriptionId> <file>
import { createHash, createPrivateKey, createSign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const key = createPrivateKey(readFileSync(resolve(root, env.ASC_KEY_PATH)));

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`;
  const sig = createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${unsigned}.${sig}`;
}

async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/** Reserve → upload parts → commit. `type` is the asset resource, `rel` its parent relationship. */
async function uploadAsset(type, rel, file) {
  const bytes = readFileSync(file);
  const reserved = await api('POST', `/v1/${type}`, {
    data: { type, attributes: { fileName: basename(file), fileSize: statSync(file).size }, relationships: rel },
  });
  const { id } = reserved.data;
  for (const op of reserved.data.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload part → ${res.status}`);
  }
  const md5 = createHash('md5').update(bytes).digest('hex');
  await api('PATCH', `/v1/${type}/${id}`, { data: { type, id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  return id;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'screenshots') {
  const [locId, displayType, ...files] = args;
  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (set) {
    // Replace: clear the old shots so the order matches the files given.
    const old = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    for (const s of old.data) await api('DELETE', `/v1/appScreenshots/${s.id}`);
  } else {
    set = (await api('POST', '/v1/appScreenshotSets', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } },
    })).data;
  }
  for (const f of files) console.log(basename(f), await uploadAsset('appScreenshots', { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }, f));
} else if (mode === 'subreview') {
  const [subId, file] = args;
  const existing = await api('GET', `/v1/subscriptions/${subId}/appStoreReviewScreenshot`);
  if (existing.data) await api('DELETE', `/v1/subscriptionAppStoreReviewScreenshots/${existing.data.id}`);
  console.log(subId, await uploadAsset('subscriptionAppStoreReviewScreenshots', { subscription: { data: { type: 'subscriptions', id: subId } } }, file));
} else {
  console.error('usage: screenshots <locId> <displayType> <files...> | subreview <subscriptionId> <file>');
  process.exit(1);
}
