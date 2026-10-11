import { icon } from './icons.js';
import { createMap } from './map.js';
import { createLandscape } from './landscape.js';
import { buildChain, miniChain, renderExplorer, segmentTrail } from './chain.js';

const KIND = {
  pro: { label: '曼報 Pro', short: 'Pro', ic: 'file' },
  'pro-podcast': { label: 'Pro Podcast', short: 'Pro Podcast', ic: 'headphones' },
  newsletter: { label: '免費電子報', short: '電子報', ic: 'mail' },
  podcast: { label: '曼報 Podcast', short: 'Podcast', ic: 'headphones' },
};
const KIND_ORDER = Object.keys(KIND);
const PRO_KINDS = new Set(['pro', 'pro-podcast']);
const REL = {
  acquired: ['收購', '被收購'],
  invested: ['投資', '獲投資'],
  competitor: ['競爭', '競爭'],
  partner: ['合作', '合作'],
  supplier: ['供應', '客戶'],
  customer: ['客戶', '供應'],
  spinoff: ['分拆出', '分拆自'],
  parent: ['旗下', '母公司'],
};
const LINK_LABEL = { website: '官網', wikipedia: 'Wikipedia', wikipedia_zh: '維基百科', investor: '投資人關係' };
const COMMONS = (file, w = 160) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => s.toLowerCase().normalize('NFKC').replace(/\s+/g, '');
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = () => matchMedia('(min-width: 900px)').matches;

// Per-viewer storage; failures fall back to memory
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const read = new Set(store.get('pm-read', []));
const kinds = new Set(store.get('pm-kinds', KIND_ORDER).filter((k) => KIND[k]));
if (!kinds.size) KIND_ORDER.forEach((k) => kinds.add(k));
let onlyUnread = false;

// Images fade in once decoded; broken ones disappear instead of showing an icon
document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('bad'); }, true);

const data = await fetch('data.json').then((r) => r.json());
document.body.classList.add('ready');
delete document.documentElement.dataset.boot;
const src = new Map(data.sources.map((s) => [s.id, s]));
const cos = new Map(data.companies.map((c) => [c.id, c]));

// Industry colours walk the Built (blue) → Different (red) spectrum
const STOPS = ['#6fc3e6', '#86a7ea', '#a49be2', '#c79ad8', '#e486a0', '#ee6a55'];
const lerp = (a, b, t) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, '0')).join('');
const colorAt = (t) => { const x = Math.min(1, t) * (STOPS.length - 1), i = Math.min(Math.floor(x), STOPS.length - 2); return lerp(STOPS[i], STOPS[i + 1], x - i); };
const N = data.industries.length;
const industries = data.industries.map((i, n) => ({ ...i, c1: colorAt(n / N), c2: colorAt((n + 1.5) / N) }));
const ind = new Map(industries.map((i) => [i.id, i]));
const grad = (i) => `linear-gradient(120deg, ${i.c1}, ${i.c2})`;

for (const c of cos.values()) {
  c.src = (c.sources ?? []).map((id) => src.get(id)).filter(Boolean)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.date.localeCompare(a.date));
  c.proN = c.src.filter((s) => PRO_KINDS.has(s.kind)).length;
  c.rels = [];
  // Commons logo first; official-site icon as fallback
  if (c.logo?.file) c.logo.url = COMMONS(c.logo.file, 250);
  else if (c.icon) c.logo = { url: c.icon, site: true };
}
for (const c of cos.values())
  for (const r of c.relations ?? []) {
    const t = cos.get(r.target);
    if (!t || !REL[r.type]) continue;
    c.rels.push({ id: t.id, label: REL[r.type][0], note: r.note });
    t.rels.push({ id: c.id, label: REL[r.type][1], note: r.note });
  }
const chain = buildChain([...cos.values()]);
const bySrc = new Map();
for (const c of cos.values()) for (const s of c.src) (bySrc.get(s.id) ?? bySrc.set(s.id, []).get(s.id)).push(c);

// One entry per person, with every company they appear under
const people = new Map();
for (const c of cos.values())
  for (const p of c.people ?? []) {
    const id = slugify(p.name);
    const e = people.get(id) ?? people.set(id, { id, name: p.name, zh: '', photo: null, roles: [] }).get(id);
    e.zh ||= p.zh ?? '';
    e.photo ||= p.photo ?? null;
    e.roles.push({ c, role: p.role ?? '', interviewed: !!p.interviewed });
  }

const keySrc = (c) => (c.proN ? c.src.filter((s) => PRO_KINDS.has(s.kind)) : c.src);
const isDone = (c) => { const k = keySrc(c); return k.length > 0 && k.every((s) => read.has(s.id)); };
const visible = (c) => c.src.some((s) => kinds.has(s.kind)) && !(onlyUnread && isDone(c));
const weight = (c) => 1 + c.proN * 2.2 + (c.src.length - c.proN) * 0.6;
const countBy = (c) => KIND_ORDER.map((k) => [k, c.src.filter((s) => s.kind === k).length]).filter(([, n]) => n);
const initials = (name) => { const w = name.replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 && !/^\p{Script=Han}/u.test(w[0]) ? w[0][0] + w[1][0] : [...(w[0] ?? '?')].slice(0, 2).join('')).toUpperCase(); };
const gOf = (c) => grad(ind.get(c.industry) ?? industries.at(-1));
const avatar = (c, cls = '') => `<span class="av ${cls}${c.logo?.url ? ' img' : ''}" style="--g:${gOf(c)}">${c.logo?.url ? `<img src="${esc(c.logo.url)}" alt="" loading="lazy" decoding="async">` : esc(initials(c.name))}</span>`;
const face = (p, cls = '') => (p.photo?.file ? `<img class="ph ${cls}" src="${esc(COMMONS(p.photo.file, 120))}" alt="" loading="lazy" decoding="async">` : `<span class="ph ini ${cls}">${esc(initials(p.name))}</span>`);
const markDone = () => { for (const c of cos.values()) c.done = isDone(c); };
markDone();

/* ---------- Views: value-chain landscape + bubble map ---------- */
const panelW = () => ($('#panel').hidden || !wide() ? 0 : $('#panel').offsetWidth);
const map = createMap($('#bubble'), {
  industries,
  weight,
  prefersReduced: reduced,
  onPick: (id) => go(`#/c/${id}`),
  onHover: (c) => `<b>${esc(c.name)}</b>${c.zh && c.zh !== c.name ? `<span>${esc(c.zh)}</span>` : ''}<em>${countBy(c).map(([k, n]) => `${KIND[k].short} ${n}`).join(' · ')}</em>`,
  safeArea: (W, H) => {
    const card = $('#card');
    const cw = wide() ? card.offsetWidth + 40 : 0;
    const ch = !wide() ? card.offsetHeight + 16 : 0;
    return { left: cw, right: panelW(), top: ch, bottom: wide() ? 0 : ($('#panel').hidden ? 0 : H * 0.55) };
  },
});
const land = createLandscape($('#lanes'), {
  industries,
  logo: (c) => (c.logo?.url ? `<img src="${esc(c.logo.url)}" alt="" loading="lazy" decoding="async">` : `<span class="mono" style="--g:${gOf(c)}">${esc(initials(c.name))}</span>`),
  onHover: (id) => new Set(cos.get(id)?.rels.map((r) => r.id)),
});
const views = { setFocus: (f) => { map.setFocus(f); land.setFocus(f); } };
function renderViews() {
  const list = [...cos.values()].filter(visible);
  map.setCompanies(list);
  land.setCompanies(list);
  if (!list.length) $('#bubble').dataset.empty = cos.size ? '目前的篩選條件下沒有公司' : '資料整理中，很快就會補上';
  else delete $('#bubble').dataset.empty;
}

/* ---------- Title card ---------- */
function countUp(el, to) {
  if (reduced()) { el.textContent = to; return; }
  const t0 = performance.now(), D = 1100;
  const step = (now) => { const p = Math.min(1, (now - t0) / D); el.textContent = Math.round(to * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderStats() {
  const pro = data.sources.filter((s) => PRO_KINDS.has(s.kind));
  const done = pro.filter((s) => read.has(s.id)).length;
  $('#kpis').innerHTML = `<div><dt>Pro 文章與節目</dt><dd>${pro.length}</dd></div><div><dt>人物</dt><dd>${people.size}</dd></div>
    <div class="prog"><dt>你已讀 Pro</dt><dd>${done}<small>/${pro.length}</small></dd><span class="bar"><i style="width:${pro.length ? (done / pro.length) * 100 : 0}%"></i></span></div>`;
  $('#built').textContent = data.builtAt;
}
const PRESENT = KIND_ORDER.filter((k) => data.sources.some((s) => s.kind === k));
function renderFilters() {
  $('#filters').innerHTML = PRESENT.map((k) => `<button class="chipbtn ${kinds.has(k) ? 'on' : ''}" data-k="${k}" aria-pressed="${kinds.has(k)}"><span class="dot ${k}"></span>${KIND[k].label}</button>`).join('')
    + `<button class="chipbtn ghost ${onlyUnread ? 'on' : ''}" data-k="unread" aria-pressed="${onlyUnread}">只看未讀</button>`;
}
$('#filters').onclick = (e) => {
  const k = e.target.closest('button')?.dataset.k;
  if (!k) return;
  if (k === 'unread') onlyUnread = !onlyUnread;
  else { kinds.has(k) ? kinds.delete(k) : kinds.add(k); if (!kinds.size) kinds.add(k); store.set('pm-kinds', [...kinds]); }
  renderFilters(); renderViews();
};

/* ---------- People ---------- */
const roleLine = (p, max = 3) => p.roles.slice(0, max).map((r) => `${esc(r.c.name)}${r.role ? ` ${esc(r.role)}` : ''}`).join('　·　') + (p.roles.length > max ? `　+${p.roles.length - max}` : '');
let pplFilter = 'all';
function renderPeople() {
  const all = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const list = all.filter((p) => pplFilter === 'all' || (pplFilter === 'iv' ? p.roles.some((r) => r.interviewed) : p.roles.length > 1));
  const groups = new Map();
  for (const p of list) { const L = /[a-z]/i.test(p.name[0]) ? p.name[0].toUpperCase() : '#'; (groups.get(L) ?? groups.set(L, []).get(L)).push(p); }
  const count = (f) => all.filter((p) => f === 'all' || (f === 'iv' ? p.roles.some((r) => r.interviewed) : p.roles.length > 1)).length;
  $('#people-bar').innerHTML = `<div class="pf">${[['all', '全部'], ['iv', '曼報訪談過'], ['multi', '跨多家公司']].map(([k, l]) => `<button class="chipbtn ${pplFilter === k ? 'on' : ''}" data-pf="${k}">${l}<span>${count(k)}</span></button>`).join('')}</div>
    <nav class="az" aria-label="依字母跳轉">${[...groups.keys()].map((L) => `<a href="#L-${L}" data-l="${L}">${L}</a>`).join('')}</nav>`;
  $('#people').innerHTML = [...groups].map(([L, ps]) => `<div class="letter" id="L-${L}"><h3>${L}</h3>${ps.map((p) =>
    `<a class="person" href="#/p/${p.id}">${face(p)}<span class="pw"><span class="pn">${esc(p.name)}${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}${p.roles.length > 1 ? `<em class="multi">${p.roles.length} 家公司</em>` : ''}</span><span class="pc">${roleLine(p)}</span></span></a>`).join('')}</div>`).join('')
    || `<p class="empty">${icon('user', 'lg')}<br>資料整理中</p>`;
}

$('#people-bar').addEventListener('click', (e) => {
  const f = e.target.closest('[data-pf]')?.dataset.pf;
  if (f) { pplFilter = f; renderPeople(); return; }
  const L = e.target.closest('.az a')?.dataset.l;
  if (!L) return;
  e.preventDefault();
  const off = $('.top').offsetHeight + $('#people-bar').offsetHeight + 8;
  scrollTo({ top: $(`#L-${L}`).getBoundingClientRect().top + scrollY - off, behavior: reduced() ? 'auto' : 'smooth' });
});

/* ---------- Panel ---------- */
const credits = [];
function credit(img, what) { if (img?.file) credits.push(`${what}：<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(img.file)}" target="_blank" rel="noopener">${esc(img.author || 'Wikimedia Commons')}</a>${img.license ? `，${esc(img.license)}` : ''}`); }
function srcList(list) {
  return `<ul class="src">${list.map((s) => `<li class="${read.has(s.id) ? 'read' : ''}">
    <label class="ck"><input type="checkbox" data-src="${esc(s.id)}" ${read.has(s.id) ? 'checked' : ''}><span>${icon('check')}</span><b class="sr">標記已讀</b></label>
    <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
    <span class="sm">${s.date}${s.column ? ` · ${esc(s.column)}` : ''}</span></li>`).join('')}</ul>`;
}
function openPanel(html, extra = '') {
  const p = $('#panel');
  p.innerHTML = `<button class="close iconbtn" aria-label="關閉">${icon('x')}</button><div class="pin">${html}
    ${credits.length ? `<p class="note">圖片來源：${credits.join('；')}</p>` : ''}${extra}
    <p class="note">連結皆指向曼報原站，內容著作權屬原作者。已讀紀錄只存在這台裝置。</p></div>`;
  credits.length = 0;
  const was = p.hidden;
  p.hidden = false; $('#scrim').hidden = false; p.scrollTop = 0;
  document.body.classList.add('open');
  document.documentElement.style.setProperty('--pw', `${p.offsetWidth}px`);
  if (was && !reduced()) p.animate([{ transform: wide() ? 'translateX(24px)' : 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function closePanel() { $('#panel').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('open'); }
// Keep the current map view (landscape or bubbles) when a panel opens
let mapView = store.get('pm-view', 'chain') === 'map' ? 'map' : 'chain';
function focusCompany(c) {
  if (!['chain', 'map'].includes(curView)) setView(mapView);
  views.setFocus({ cur: c.id, rel: new Set(c.rels.map((r) => r.id)) });
  if (curView === 'map') requestAnimationFrame(() => map.zoomTo(c.id));
  else land.reveal(c.id);
}
function showCompany(c) {
  const i = ind.get(c.industry) ?? industries.at(-1);
  const seg = i.segments?.find((g) => g.id === c.segment);
  const meta = [c.founded && `${c.founded} 年成立`, c.hq].filter(Boolean).join(' · ');
  const links = Object.entries(c.links ?? {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${LINK_LABEL[k] ?? k}${icon('external')}</a>`).join('');
  credit(c.logo, `${c.name} logo`);
  const ppl = (c.people ?? []).map((p) => {
    credit(p.photo, p.name);
    const pe = people.get(slugify(p.name));
    const also = pe?.roles.filter((r) => r.c.id !== c.id) ?? [];
    return `<li>${face(p)}<span><a class="pn" href="#/p/${pe?.id}">${esc(p.name)}</a>${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}<span class="role">${esc(p.role ?? '')}${p.interviewed ? '<em class="iv">受訪</em>' : ''}</span>
      ${also.length ? `<span class="also">也在 ${also.map((r) => `<a href="#/c/${r.c.id}">${esc(r.c.name)}</a>`).join('、')}</span>` : ''}</span></li>`;
  }).join('');
  const rels = c.rels.map((r) => `<a href="#/c/${r.id}" title="${esc(r.note ?? '')}">${avatar(cos.get(r.id), 'xs')}<span class="rt">${r.label}</span>${esc(cos.get(r.id).name)}</a>`).join('');
  const stats = countBy(c).map(([k, n]) => `<div><dd>${n}</dd><dt>${k.includes('podcast') ? '集' : '篇'}${KIND[k].label}</dt></div>`).join('');
  const sections = KIND_ORDER.map((k) => { const l = c.src.filter((s) => s.kind === k); return l.length ? `<h3>${icon(KIND[k].ic)}${KIND[k].label}<span class="c">${l.length}</span></h3>${srcList(l)}` : ''; }).join('');
  openPanel(`<header class="ph-head" style="--g:${grad(i)}">${avatar(c, 'lg')}
      <div><span class="ind">${esc(i.name)}${seg ? ` · ${esc(seg.name)}` : ''}</span><h2>${esc(c.name)}</h2>${c.zh && c.zh !== c.name ? `<p class="zhn">${esc(c.zh)}</p>` : ''}</div></header>
    ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
    <p class="sum">${esc(c.summary)}</p>
    ${links ? `<div class="links">${links}</div>` : ''}
    <dl class="pstats">${stats}</dl>
    <h3>${icon('map')}產業鏈<a class="h3-btn" href="#/chain/${c.id}">展開${icon('fit')}</a></h3>
    ${segmentTrail(c, i)}
    ${miniChain(c, chain, { avatar })}
    ${ppl ? `<h3>${icon('user')}創辦人與關鍵人物</h3><ul class="ppl">${ppl}</ul>` : ''}
    ${rels ? `<h3>${icon('building')}關係</h3><div class="rels">${rels}</div>` : ''}
    ${sections}`, c.logo?.site ? '<p class="note">Logo 取自該公司官網圖示，僅用於識別。</p>' : '');
  focusCompany(c);
}
function showPerson(p) {
  credit(p.photo, p.name);
  const ivs = p.roles.filter((r) => r.interviewed).length;
  openPanel(`<header class="ph-head" style="--g:linear-gradient(120deg,var(--blue-a),var(--red-b))">${p.photo?.file ? `<img class="ph xl" src="${esc(COMMONS(p.photo.file, 250))}" alt="">` : `<span class="ph ini xl">${esc(initials(p.name))}</span>`}
      <div><span class="ind">人物${ivs ? ' · 曼報訪談過' : ''}</span><h2>${esc(p.name)}</h2>${p.zh ? `<p class="zhn">${esc(p.zh)}</p>` : ''}</div></header>
    <h3>${icon('building')}公司與身分<span class="c">${p.roles.length}</span></h3>
    <ul class="roles">${p.roles.map((r) => `<li><a href="#/c/${r.c.id}">${avatar(r.c, 'sm')}<span><b>${esc(r.c.name)}</b><span class="role">${esc(r.role || '—')}${r.interviewed ? '<em class="iv">受訪</em>' : ''}</span></span>${icon('external', 'go')}</a></li>`).join('')}</ul>`);
  if (!['chain', 'map'].includes(curView)) setView(mapView);
  views.setFocus({ match: new Set(p.roles.map((r) => r.c.id)) });
  if (curView === 'map') requestAnimationFrame(() => map.zoomToSet(p.roles.map((r) => r.c.id)));
  else land.reveal(p.roles[0].c.id);
}
function showSource(s) {
  const list = bySrc.get(s.id) ?? [];
  openPanel(`<header class="ph-head" style="--g:linear-gradient(120deg,var(--red-a),var(--blue-b))"><span class="av lg">${icon(KIND[s.kind].ic)}</span>
      <div><span class="ind">${KIND[s.kind].label}${s.column ? ` · ${esc(s.column)}` : ''}</span><h2 class="t">${esc(s.title)}</h2></div></header>
    <p class="meta">${s.date}</p>
    <div class="links"><a class="primary" href="${esc(s.url)}" target="_blank" rel="noopener">到曼報閱讀${icon('external')}</a></div>
    <h3>${icon('building')}這篇談到的公司<span class="c">${list.length}</span></h3><div class="rels">${list.map((c) => `<a href="#/c/${c.id}">${avatar(c, 'xs')}${esc(c.name)}</a>`).join('')}</div>`);
  if (!['chain', 'map'].includes(curView)) setView(mapView);
  views.setFocus({ match: new Set(list.map((c) => c.id)) });
  if (curView === 'map') requestAnimationFrame(() => map.zoomToSet(list.map((c) => c.id)));
  else if (list[0]) land.reveal(list[0].id);
}
$('#panel').addEventListener('click', (e) => { if (e.target.closest('.close')) go(mapView === 'map' ? '#/bubbles' : '#/'); });
$('#panel').addEventListener('change', (e) => {
  const id = e.target.dataset.src;
  if (!id) return;
  e.target.checked ? read.add(id) : read.delete(id);
  e.target.closest('li').classList.toggle('read', e.target.checked);
  store.set('pm-read', [...read]); markDone(); renderStats(); map.refresh(); land.refresh();
});
$('#scrim').onclick = () => go(mapView === 'map' ? '#/bubbles' : '#/');

/* ---------- Supply-chain explorer ---------- */
let cxCleanup = null;
const peers = (c) => [...cos.values()].filter((x) => x.id !== c.id && x.industry === c.industry && x.segment === c.segment).sort((a, b) => b.proN - a.proN).slice(0, 12);
function openExplorer(c) {
  const el = $('#cx');
  cxCleanup?.();
  const was = el.hidden;
  el.hidden = false;
  document.body.classList.add('cx-open');
  cxCleanup = renderExplorer(el, c, chain, { avatar, icon, peers, industryOf: (x) => ind.get(x.industry) ?? industries.at(-1) });
  el.scrollTop = 0;
  if (!reduced()) el.querySelector('.cx-grid').animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: was ? 360 : 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  if (!['chain', 'map'].includes(curView)) setView(mapView);
  views.setFocus({ cur: c.id, rel: new Set([...chain.up(c.id), ...chain.down(c.id)].map((x) => x.c.id)) });
}
function closeExplorer() {
  if ($('#cx').hidden) return;
  cxCleanup?.(); cxCleanup = null;
  $('#cx').hidden = true;
  document.body.classList.remove('cx-open');
}
$('#cx').addEventListener('click', (e) => { if (e.target.closest('.cx-close')) go(`#/c/${location.hash.split('/')[2]}`); });

/* ---------- Search ---------- */
const index = [];
for (const c of cos.values()) index.push({ t: 'c', key: norm(`${c.name} ${c.zh ?? ''} ${(c.aliases ?? []).join(' ')}`), label: c.name, sub: c.zh ?? '', go: `#/c/${c.id}`, ids: [c.id] });
for (const p of people.values()) index.push({ t: 'p', key: norm(`${p.name} ${p.zh}`), label: `${p.name}${p.zh ? ` ${p.zh}` : ''}`, sub: p.roles.map((r) => r.c.name).join('、'), go: `#/p/${p.id}`, ids: p.roles.map((r) => r.c.id) });
for (const s of data.sources) index.push({ t: 's', key: norm(s.title), label: s.title, sub: `${KIND[s.kind].short} · ${s.date}`, go: `#/s/${encodeURIComponent(s.id)}`, ids: (bySrc.get(s.id) ?? []).map((c) => c.id) });
const T = { c: '公司', p: '人物', s: '文章' };
const TI = { c: 'building', p: 'user', s: 'file' };
let hits = [], sel = 0;
const q = $('#q');
function search(v) {
  const k = norm(v);
  if (!k) { $('#results').hidden = true; if (!location.hash.match(/^#\/[csp]\//)) views.setFocus(null); return; }
  hits = index.filter((x) => x.key.includes(k)).sort((a, b) => (a.key.startsWith(k) ? 0 : 1) - (b.key.startsWith(k) ? 0 : 1) || 'cps'.indexOf(a.t) - 'cps'.indexOf(b.t)).slice(0, 30);
  sel = 0;
  $('#results').innerHTML = hits.length ? hits.map((h, n) => `<button role="option" data-n="${n}" class="${n === sel ? 'sel' : ''}"><span class="kind">${icon(TI[h.t])}${T[h.t]}</span><span class="lb">${esc(h.label)}</span><span class="sub">${esc(h.sub)}</span></button>`).join('') : '<p class="none">沒有符合的結果</p>';
  $('#results').hidden = false;
  views.setFocus({ match: new Set(hits.flatMap((h) => h.ids)) });
}
const qClear = $('#q-clear');
q.addEventListener('input', () => { qClear.hidden = !q.value; search(q.value); });
qClear.addEventListener('click', () => { q.value = ''; qClear.hidden = true; search(''); q.focus(); });
q.addEventListener('focus', () => q.value && search(q.value));
q.addEventListener('keydown', (e) => {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) {
    e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
    [...$('#results').children].forEach((b, n) => b.classList.toggle('sel', n === sel));
    $('#results').children[sel]?.scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
  if (e.key === 'Escape') { q.value = ''; qClear.hidden = true; search(''); q.blur(); }
});
$('#results').addEventListener('click', (e) => { const n = e.target.closest('button')?.dataset.n; if (n) pick(hits[n]); });
function pick(h) { $('#results').hidden = true; q.blur(); go(h.go); }
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  if (e.key === 'Escape' && !$('#cx').hidden) return go(`#/c/${location.hash.split('/')[2]}`);
  if (e.key === 'Escape' && !$('#panel').hidden && document.activeElement !== q) $('#scrim').onclick();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#results').hidden = true; });

/* ---------- Views & routing ---------- */
let curView = null;
function setView(v) {
  if (curView === v) return;
  curView = v;
  if (v === 'chain' || v === 'map') { mapView = v; store.set('pm-view', v); }
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.view === v);
  for (const x of ['chain', 'map', 'people', 'about']) $(`#view-${x}`).hidden = x !== v;
  document.body.dataset.view = v;
}
const HASH = { chain: '#/', map: '#/bubbles', people: '#/people', about: '#/about' };
document.querySelector('.tabs').onclick = (e) => { const v = e.target.closest('button')?.dataset.view; if (v) go(HASH[v]); };
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
function route() {
  const [, a, b] = location.hash.split('/');
  if (a !== 'chain') closeExplorer();
  if (a === 'c' && cos.has(b)) return showCompany(cos.get(b));
  if (a === 'p' && people.has(b)) return showPerson(people.get(b));
  if (a === 's' && src.has(decodeURIComponent(b ?? ''))) return showSource(src.get(decodeURIComponent(b)));
  if (a === 'chain' && cos.has(b)) return openExplorer(cos.get(b));
  const hadPanel = !$('#panel').hidden;
  closePanel();
  views.setFocus(null);
  if (a === 'people') { setView('people'); renderPeople(); }
  else if (a === 'about') setView('about');
  else if (a === 'bubbles') { setView('map'); if (hadPanel) map.fitAll(); }
  else setView(location.hash ? 'chain' : mapView);
}
addEventListener('hashchange', route);

/* ---------- Theme ---------- */
const sysDark = matchMedia('(prefers-color-scheme: dark)');
let theme = store.get('pm-theme', 'auto');
const effective = () => (theme === 'auto' ? (sysDark.matches ? 'dark' : 'light') : theme);
function applyTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const dark = effective() === 'dark';
  $('#theme').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme').setAttribute('aria-label', dark ? '切換為亮色模式' : '切換為暗色模式');
  $('#theme').title = dark ? '亮色模式' : '暗色模式';
}
$('#theme').onclick = () => {
  theme = effective() === 'dark' ? 'light' : 'dark';
  store.set('pm-theme', theme);
  if (document.startViewTransition && !reduced()) document.startViewTransition(applyTheme); else applyTheme();
};
sysDark.addEventListener('change', applyTheme);
applyTheme();

/* ---------- Boot ---------- */
if (!wide()) q.placeholder = '搜尋公司、人物';
const hdr = $('.top');
new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${hdr.offsetHeight}px`)).observe(hdr);
for (const [sel2, ic] of [['[data-z="in"]', 'plus'], ['[data-z="out"]', 'minus'], ['[data-z="fit"]', 'fit']]) $(sel2).innerHTML = icon(ic);
renderStats(); renderFilters(); renderViews();
countUp($('#n-co'), cos.size);
route();
