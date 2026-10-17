// Validate data/*.yaml and compile to site/data.json. Exit 1 on any error.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const load = (p) => parse(readFileSync(p, 'utf8'));
const industries = load('data/industries.yaml');
const sources = load('data/sources.yaml') ?? [];
const errors = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = [];

const MANNY_HOSTS = ['pro.manny-li.com', 'manny-li.com', 'www.manny-li.com', 'eepurl.com', 'open.firstory.fm', 'podcasts.apple.com'];
const RELATION_TYPES = ['acquired', 'invested', 'competitor', 'partner', 'supplier', 'customer', 'spinoff', 'parent'];
// What flows along a supply link; mirrored in site/chain.js
const SUPPLY_KINDS = ['hardware', 'software', 'cloud', 'service', 'content'];
const CURRENCIES = ['USD', 'TWD', 'JPY', 'EUR', 'KRW', 'GBP', 'SEK', 'CNY', 'HKD', 'CAD'];
const indIds =new Set(industries.map((i) => i.id));
const segIds = new Map(industries.map((i) => [i.id, new Set((i.segments ?? []).map((g) => g.id))]));
const srcIds = new Set();
for (const s of sources) {
  if (srcIds.has(s.id)) err('sources.yaml', `duplicate id ${s.id}`);
  srcIds.add(s.id);
  if (!MANNY_HOSTS.includes(new URL(s.url).hostname)) err('sources.yaml', `${s.id} url must point to Manny's own site`);
}

// Direct Commons thumbnail URL; saves the two redirects of Special:FilePath
function thumb(file, w) {
  const f = file.replace(/ /g, '_');
  const h = createHash('md5').update(f).digest('hex');
  const e = encodeURIComponent(f);
  const ext = /\.(svg|tiff?|pdf)$/i.test(f) ? '.png' : '';
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${e}/${w}px-${e}${ext}`;
}
const companies = [];
for (const f of readdirSync('data/companies').filter((f) => f.endsWith('.yaml')).sort()) {
  const c = load(`data/companies/${f}`);
  c.id = f.replace(/\.yaml$/, '');
  const at = `companies/${f}`;
  if (!/^[a-z0-9-]+$/.test(c.id)) err(at, 'file name must be kebab-case');
  if (!c.name) err(at, 'name is required');
  if (!indIds.has(c.industry)) err(at, `unknown industry "${c.industry}"`);
  else if (c.segment && !segIds.get(c.industry).has(c.segment)) err(at, `segment "${c.segment}" is not in industry ${c.industry}`);
  if (!c.summary) err(at, 'summary is required');
  else if ([...c.summary].length > 90) err(at, `summary too long (${[...c.summary].length} > 90 chars)`);
  for (const s of c.sources ?? []) if (!srcIds.has(s)) err(at, `unknown source ${s}`);
  // Extended: not covered by Manny, so its links must carry the sources
  if (!c.sources?.length && !c.extended) err(at, 'at least one Manny source is required (or extended: true)');
  for (const [k, u] of Object.entries(c.links ?? {})) {
    // Only http(s): a javascript: URL here would run on click
    let ok = false;
    try { ok = ['http:', 'https:'].includes(new URL(u).protocol); } catch {}
    if (!ok) err(at, `links.${k} must be an http(s) URL`);
    if (!/^[a-z_]+$/.test(k)) err(at, `links key "${k}" must be lowercase letters`);
  }
  if (c.logo?.file) c.logo.thumb = thumb(c.logo.file, 250);
  for (const p of c.people ?? []) if (p.photo?.file) { p.photo.thumb = thumb(p.photo.file, 120); p.photo.big = thumb(p.photo.file, 250); }
  if (!c.logo && existsSync(`site/logos/${c.id}.png`)) c.icon = `logos/${c.id}.png`;
  companies.push(c);
}
const https = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
// Revenue mix from the latest annual report; shares are % of total revenue
for (const c of companies) {
  const v = c.revenue, at = `companies/${c.id}.yaml`;
  if (!v) continue;
  if (!v.fy) err(at, 'revenue.fy is required');
  if (!https(v.source)) err(at, 'revenue needs an https source');
  if (v.total != null && !CURRENCIES.includes(v.currency)) err(at, `revenue.currency must be one of ${CURRENCIES.join(', ')}`);
  const segs = v.segments ?? [];
  if (!segs.length && !v.note) err(at, 'revenue needs segments, or a note saying why there are none');
  const seen = new Set();
  for (const g of segs) {
    if (!/^[a-z0-9-]+$/.test(g.id ?? '')) err(at, `revenue segment id "${g.id}" must be kebab-case`);
    if (seen.has(g.id)) err(at, `duplicate revenue segment ${g.id}`);
    seen.add(g.id);
    if (!g.name) err(at, `revenue segment ${g.id} needs a name`);
    if (g.share != null && !(g.share >= 0 && g.share <= 100)) err(at, `revenue segment ${g.id} share must be 0–100`);
  }
  // Rough mix is enough; only warn when it may have shifted
  const fy = +String(v.fy).match(/\d{4}/)?.[0];
  if (fy && fy < new Date().getFullYear() - 2) warn.push(`${at}: revenue is ${v.fy}, consider updating`);
  const sum = segs.reduce((s, g) => s + (g.share ?? 0), 0);
  if (segs.length && segs.every((g) => g.share != null) && Math.abs(sum - 100) > 2) err(at, `revenue shares sum to ${sum.toFixed(1)}, not 100`);
}
const ids = new Set(companies.map((c) => c.id));
const byId = new Map(companies.map((c) => [c.id, c]));
for (const c of companies)
  for (const r of c.relations ?? []) {
    const at = `companies/${c.id}.yaml`;
    if (!RELATION_TYPES.includes(r.type)) err(at, `unknown relation type ${r.type}`);
    if (!ids.has(r.target)) { err(at, `relation target ${r.target} not found`); continue; }
    if (['supplier', 'customer'].includes(r.type)) {
      if (!https(r.source)) err(at, `${r.type} ${r.target} needs an https source`);
      if (!SUPPLY_KINDS.includes(r.kind)) err(at, `${r.type} ${r.target} needs kind: ${SUPPLY_KINDS.join(' | ')}`);
      // segment: which of the supplier's revenue lines this sale belongs to
      const sup = r.type === 'supplier' ? c : byId.get(r.target);
      if (r.segment && !sup.revenue?.segments?.some((g) => g.id === r.segment)) err(at, `${r.target}: segment "${r.segment}" is not in ${sup.id}'s revenue`);
      if (r.share) {
        if (!(r.share.pct > 0 && r.share.pct <= 100)) err(at, `${r.target}: share.pct must be 0–100`);
        if (!r.share.fy || !https(r.share.source)) err(at, `${r.target}: share needs fy and an https source`);
      }
    }
    if (r.type === 'invested' && r.source && !https(r.source)) err(at, `invested ${r.target} source must be https`);
  }

for (const c of companies.filter((c) => c.extended)) {
  const linked = companies.some((o) => (o.relations ?? []).some((r) => https(r.source) && (o.id === c.id || r.target === c.id) && ['supplier', 'customer', 'invested', 'parent'].includes(r.type)));
  if (!linked) err(`companies/${c.id}.yaml`, 'extended company needs at least one sourced supply or investment link');
  if (c.sources?.length) err(`companies/${c.id}.yaml`, 'extended companies have no Manny sources; drop extended: true instead');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const used = new Set(companies.flatMap((c) => c.sources ?? []));
// Optional: which sources mention each person (generated by the maintainer pipeline)
const peopleSources = existsSync('data/people-sources.json') ? JSON.parse(readFileSync('data/people-sources.json', 'utf8')) : {};
for (const [n, ids] of Object.entries(peopleSources)) for (const id of ids) {
  if (!srcIds.has(id)) err('people-sources.json', `${n}: unknown source ${id}`);
  used.add(id);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
writeFileSync('site/data.json', JSON.stringify({
  builtAt: new Date().toISOString().slice(0, 10),
  version: JSON.parse(readFileSync('package.json', 'utf8')).version,
  industries,
  sources: sources.filter((s) => used.has(s.id)),
  companies,
  peopleSources,
}));
// Characters outside the font subset render in the system font; remind to rerun the subsetter
if (existsSync('site/fonts/chars.txt')) {
  const have = new Set(readFileSync('site/fonts/chars.txt', 'utf8'));
  const missing = new Set([...JSON.stringify(companies) + JSON.stringify(sources)].filter((ch) => ch.codePointAt(0) > 0x2e7f && !have.has(ch)));
  if (missing.size) console.warn(`note: ${missing.size} characters not in the font subset; run scripts/subset-fonts.py`);
}
if (warn.length) console.warn(`note: ${warn.length} stale revenue entries\n  ${warn.join('\n  ')}`);
console.log(`ok: ${companies.length} companies, ${used.size} sources`);
