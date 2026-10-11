// Writes / checks the Content-Security-Policy <meta> in each page. `node scripts/csp.mjs` updates, `--check` verifies.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PAGES = ['site/index.html', 'site/guide.html', 'site/404.html'];
const check = process.argv.includes('--check');
let bad = 0;
for (const f of PAGES) {
  const html = readFileSync(f, 'utf8');
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://upload.wikimedia.org https://commons.wikimedia.org https://thumb.wikimedia.org",
    "media-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const re = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
  if (check) {
    if (!html.includes(tag)) { console.error(`${f}: CSP is stale, run node scripts/csp.mjs`); bad++; }
    continue;
  }
  const next = re.test(html) ? html.replace(re, tag) : html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  ${tag}\n  <meta name="referrer" content="strict-origin-when-cross-origin">`);
  writeFileSync(f, next);
  console.log(f, hashes.length, 'inline scripts');
}
if (bad) process.exit(1);
