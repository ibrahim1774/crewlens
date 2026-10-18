// Minimal App Store Connect API client. Usage: node tools/asc.mjs GET /v1/bundleIds [jsonBody]
import { createSign, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const key = createPrivateKey(readFileSync(resolve(root, env.ASC_KEY_PATH)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`;
const sig = createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');

const [method, path, body] = process.argv.slice(2);
const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
  method,
  headers: { Authorization: `Bearer ${unsigned}.${sig}`, 'Content-Type': 'application/json' },
  body: body || undefined,
});
const text = await res.text();
console.log(res.status);
console.log(text);
