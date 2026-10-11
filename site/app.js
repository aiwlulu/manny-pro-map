import { icon } from './icons.js';
import { createMap } from './map.js';

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

const data = await fetch('data.json').then((r) => r.json());
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
  if (c.logo?.file) c.logo.url = COMMONS(c.logo.file, 200);
}
for (const c of cos.values())
  for (const r of c.relations ?? []) {
    const t = cos.get(r.target);
    if (!t || !REL[r.type]) continue;
    c.rels.push({ id: t.id, label: REL[r.type][0], note: r.note });
    t.rels.push({ id: c.id, label: REL[r.type][1], note: r.note });
  }
const bySrc = new Map();
for (const c of cos.values()) for (const s of c.src) (bySrc.get(s.id) ?? bySrc.set(s.id, []).get(s.id)).push(c);

const keySrc = (c) => (c.proN ? c.src.filter((s) => PRO_KINDS.has(s.kind)) : c.src);
const isDone = (c) => { const k = keySrc(c); return k.length > 0 && k.every((s) => read.has(s.id)); };
const visible = (c) => c.src.some((s) => kinds.has(s.kind)) && !(onlyUnread && isDone(c));
const weight = (c) => 1 + c.proN * 2.2 + (c.src.length - c.proN) * 0.6;
const countBy = (c) => KIND_ORDER.map((k) => [k, c.src.filter((s) => s.kind === k).length]).filter(([, n]) => n);
const initials = (name) => { const w = name.replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 && !/^\p{Script=Han}/u.test(w[0]) ? w[0][0] + w[1][0] : [...(w[0] ?? '?')].slice(0, 2).join('')).toUpperCase(); };
const avatar = (c, cls = '') => `<span class="av ${cls}" style="--g:${grad(ind.get(c.industry) ?? industries.at(-1))}">${c.logo?.url ? `<img src="${esc(c.logo.url)}" alt="" loading="lazy">` : esc(initials(c.name))}</span>`;
const markDone = () => { for (const c of cos.values()) c.done = isDone(c); };
markDone();

/* ---------- Map ---------- */
const panelW = () => ($('#panel').hidden || !wide() ? 0 : $('#panel').offsetWidth);
const map = createMap($('#bubble'), {
  industries,
  weight,
  prefersReduced: reduced,
  onPick: (id) => go(`#/c/${id}`),
  onHover: (c) => `<b>${esc(c.name)}</b>${c.zh && c.zh !== c.name ? `<span>${esc(c.zh)}</span>` : ''}<em>${countBy(c).map(([k, n]) => `${KIND[k].short} ${n}`).join(' · ')}</em>`,
  safeArea: (W, H) => {
    const card = $('#card');
    const cw = wide() && card.offsetParent ? card.offsetWidth + 40 : 0;
    const ch = !wide() && card.offsetParent ? card.offsetHeight + 16 : 0;
    return { left: cw, right: panelW(), top: ch, bottom: wide() ? 0 : ($('#panel').hidden ? 0 : H * 0.55) };
  },
});
function renderMap() {
  const list = [...cos.values()].filter(visible);
  map.setCompanies(list);
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
  const ppl = new Set([...cos.values()].flatMap((c) => (c.people ?? []).map((p) => p.name))).size;
  $('#kpis').innerHTML = `<div><dt>Pro 文章與節目</dt><dd>${pro.length}</dd></div><div><dt>人物</dt><dd>${ppl}</dd></div>
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
  renderFilters(); renderMap(); renderList();
};

/* ---------- List view ---------- */
function renderList() {
  const html = industries.map((i) => {
    const list = [...cos.values()].filter((c) => c.industry === i.id && visible(c)).sort((a, b) => b.proN - a.proN || b.src.length - a.src.length || a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<section class="region" style="--g:${grad(i)}"><h2>${esc(i.name)}<span class="en">${esc(i.en)}</span><span class="n">${list.length}</span></h2><div class="cos">${list.map((c) =>
      `<a class="co ${c.proN >= 4 ? 's3' : c.proN >= 2 ? 's2' : ''} ${c.done ? 'done' : ''}" href="#/c/${c.id}">${avatar(c, 'sm')}<span class="nm">${esc(c.name)}${c.zh && c.zh !== c.name ? ` <span class="zh">${esc(c.zh)}</span>` : ''}</span>${c.done ? icon('check', 'ok') : ''}</a>`).join('')}</div></section>`;
  }).join('');
  $('#list').innerHTML = html || `<p class="empty">${icon('map', 'lg')}<br>${cos.size ? '目前的篩選條件下沒有公司' : '資料整理中，很快就會補上'}</p>`;
}

/* ---------- People ---------- */
function renderPeople() {
  const ppl = [];
  for (const c of cos.values()) for (const p of c.people ?? []) ppl.push({ ...p, c });
  ppl.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const groups = new Map();
  for (const p of ppl) { const L = /[a-z]/i.test(p.name[0]) ? p.name[0].toUpperCase() : '#'; (groups.get(L) ?? groups.set(L, []).get(L)).push(p); }
  $('#people').innerHTML = [...groups].map(([L, list]) => `<div class="letter"><h3>${L}</h3>${list.map((p) =>
    `<a class="person" href="#/c/${p.c.id}">${p.photo?.file ? `<img class="ph" src="${esc(COMMONS(p.photo.file, 96))}" alt="" loading="lazy">` : `<span class="ph ini">${esc(initials(p.name))}</span>`}<span class="pn">${esc(p.name)}${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}</span><span class="pc">${esc(p.c.name)}${p.role ? ` · ${esc(p.role)}` : ''}</span></a>`).join('')}</div>`).join('')
    || `<p class="empty">${icon('user', 'lg')}<br>資料整理中</p>`;
}

/* ---------- Panel ---------- */
const credits = [];
function credit(img, what) { if (img?.file) credits.push(`${what}：<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(img.file)}" target="_blank" rel="noopener">${esc(img.author || 'Wikimedia Commons')}</a>${img.license ? `，${esc(img.license)}` : ''}`); }
function srcList(list) {
  return `<ul class="src">${list.map((s) => `<li class="${read.has(s.id) ? 'read' : ''}">
    <label class="ck"><input type="checkbox" data-src="${esc(s.id)}" ${read.has(s.id) ? 'checked' : ''}><span>${icon('check')}</span><b class="sr">標記已讀</b></label>
    <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
    <span class="sm">${s.date}${s.column ? ` · ${esc(s.column)}` : ''}</span></li>`).join('')}</ul>`;
}
function openPanel(html) {
  const p = $('#panel');
  p.innerHTML = `<button class="close iconbtn" aria-label="關閉">${icon('x')}</button><div class="pin">${html}
    ${credits.length ? `<p class="note">圖片來源：${credits.join('；')}</p>` : ''}
    <p class="note">連結皆指向曼報原站，內容著作權屬原作者。已讀紀錄只存在這台裝置。</p></div>`;
  credits.length = 0;
  const was = p.hidden;
  p.hidden = false; $('#scrim').hidden = false; p.scrollTop = 0;
  document.body.classList.add('open');
  document.documentElement.style.setProperty('--pw', `${p.offsetWidth}px`);
  if (was && !reduced()) p.animate([{ transform: wide() ? 'translateX(24px)' : 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function closePanel() { $('#panel').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('open'); }
function showCompany(c) {
  const i = ind.get(c.industry) ?? industries.at(-1);
  const meta = [c.founded && `${c.founded} 年成立`, c.hq].filter(Boolean).join(' · ');
  const links = Object.entries(c.links ?? {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${LINK_LABEL[k] ?? k}${icon('external')}</a>`).join('');
  credit(c.logo, `${c.name} logo`);
  const ppl = (c.people ?? []).map((p) => {
    credit(p.photo, p.name);
    return `<li>${p.photo?.file ? `<img class="ph" src="${esc(COMMONS(p.photo.file, 96))}" alt="" loading="lazy">` : `<span class="ph ini">${esc(initials(p.name))}</span>`}
      <span><span class="pn">${esc(p.name)}</span>${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}<span class="role">${esc(p.role ?? '')}${p.interviewed ? '<em class="iv">受訪</em>' : ''}</span></span></li>`;
  }).join('');
  const rels = c.rels.map((r) => `<a href="#/c/${r.id}" title="${esc(r.note ?? '')}">${avatar(cos.get(r.id), 'xs')}<span class="rt">${r.label}</span>${esc(cos.get(r.id).name)}</a>`).join('');
  const stats = countBy(c).map(([k, n]) => `<div><dd>${n}</dd><dt>${k.includes('podcast') ? '集' : '篇'}${KIND[k].label}</dt></div>`).join('');
  const sections = KIND_ORDER.map((k) => { const l = c.src.filter((s) => s.kind === k); return l.length ? `<h3>${icon(KIND[k].ic)}${KIND[k].label}<span class="c">${l.length}</span></h3>${srcList(l)}` : ''; }).join('');
  openPanel(`<header class="ph-head" style="--g:${grad(i)}">${avatar(c, 'lg')}
      <div><span class="ind">${esc(i.name)}</span><h2>${esc(c.name)}</h2>${c.zh && c.zh !== c.name ? `<p class="zhn">${esc(c.zh)}</p>` : ''}</div></header>
    ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
    <p class="sum">${esc(c.summary)}</p>
    ${links ? `<div class="links">${links}</div>` : ''}
    <dl class="pstats">${stats}</dl>
    ${ppl ? `<h3>${icon('user')}創辦人與關鍵人物</h3><ul class="ppl">${ppl}</ul>` : ''}
    ${rels ? `<h3>${icon('building')}關係</h3><div class="rels">${rels}</div>` : ''}
    ${sections}`);
  setView('map');
  map.setFocus({ cur: c.id, rel: new Set(c.rels.map((r) => r.id)) });
  requestAnimationFrame(() => map.zoomTo(c.id));
}
function showSource(s) {
  const list = bySrc.get(s.id) ?? [];
  openPanel(`<header class="ph-head" style="--g:linear-gradient(120deg,var(--red-a),var(--blue-b))"><span class="av lg">${icon(KIND[s.kind].ic)}</span>
      <div><span class="ind">${KIND[s.kind].label}${s.column ? ` · ${esc(s.column)}` : ''}</span><h2 class="t">${esc(s.title)}</h2></div></header>
    <p class="meta">${s.date}</p>
    <div class="links"><a class="primary" href="${esc(s.url)}" target="_blank" rel="noopener">到曼報閱讀${icon('external')}</a></div>
    <h3>${icon('building')}這篇談到的公司<span class="c">${list.length}</span></h3><div class="rels">${list.map((c) => `<a href="#/c/${c.id}">${avatar(c, 'xs')}${esc(c.name)}</a>`).join('')}</div>`);
  setView('map');
  map.setFocus({ match: new Set(list.map((c) => c.id)) });
  requestAnimationFrame(() => map.zoomToSet(list.map((c) => c.id)));
}
$('#panel').addEventListener('click', (e) => { if (e.target.closest('.close')) go('#/'); });
$('#panel').addEventListener('change', (e) => {
  const id = e.target.dataset.src;
  if (!id) return;
  e.target.checked ? read.add(id) : read.delete(id);
  e.target.closest('li').classList.toggle('read', e.target.checked);
  store.set('pm-read', [...read]); markDone(); renderStats(); map.refresh(); renderList();
});
$('#scrim').onclick = () => go('#/');

/* ---------- Search ---------- */
const index = [];
for (const c of cos.values()) {
  index.push({ t: 'c', key: norm(`${c.name} ${c.zh ?? ''} ${(c.aliases ?? []).join(' ')}`), label: c.name, sub: c.zh ?? '', go: `#/c/${c.id}`, id: c.id });
  for (const p of c.people ?? []) index.push({ t: 'p', key: norm(`${p.name} ${p.zh ?? ''}`), label: `${p.name}${p.zh ? ` ${p.zh}` : ''}`, sub: c.name, go: `#/c/${c.id}`, id: c.id });
}
for (const s of data.sources) index.push({ t: 's', key: norm(s.title), label: s.title, sub: `${KIND[s.kind].short} · ${s.date}`, go: `#/s/${encodeURIComponent(s.id)}`, sid: s.id });
const T = { c: '公司', p: '人物', s: '文章' };
const TI = { c: 'building', p: 'user', s: 'file' };
let hits = [], sel = 0;
const q = $('#q');
function search(v) {
  const k = norm(v);
  if (!k) { $('#results').hidden = true; if (!location.hash.match(/^#\/[cs]\//)) map.setFocus(null); return; }
  hits = index.filter((x) => x.key.includes(k)).sort((a, b) => (a.key.startsWith(k) ? 0 : 1) - (b.key.startsWith(k) ? 0 : 1) || 'cps'.indexOf(a.t) - 'cps'.indexOf(b.t)).slice(0, 30);
  sel = 0;
  $('#results').innerHTML = hits.length ? hits.map((h, n) => `<button role="option" data-n="${n}" class="${n === sel ? 'sel' : ''}"><span class="kind">${icon(TI[h.t])}${T[h.t]}</span><span class="lb">${esc(h.label)}</span><span class="sub">${esc(h.sub)}</span></button>`).join('') : '<p class="none">沒有符合的結果</p>';
  $('#results').hidden = false;
  const match = new Set(hits.filter((h) => h.id).map((h) => h.id));
  for (const h of hits.filter((h) => h.sid)) for (const c of bySrc.get(h.sid) ?? []) match.add(c.id);
  map.setFocus({ match });
}
q.addEventListener('input', () => search(q.value));
q.addEventListener('focus', () => q.value && search(q.value));
q.addEventListener('keydown', (e) => {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) {
    e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
    [...$('#results').children].forEach((b, n) => b.classList.toggle('sel', n === sel));
    $('#results').children[sel]?.scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
  if (e.key === 'Escape') { q.value = ''; search(''); q.blur(); }
});
$('#results').addEventListener('click', (e) => { const n = e.target.closest('button')?.dataset.n; if (n) pick(hits[n]); });
function pick(h) { $('#results').hidden = true; q.blur(); go(h.go); }
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  if (e.key === 'Escape' && !$('#panel').hidden && document.activeElement !== q) go('#/');
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#results').hidden = true; });

/* ---------- Views & routing ---------- */
let curView = null;
function setView(v) {
  if (curView === v) return;
  curView = v;
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.view === v);
  for (const x of ['map', 'list', 'people', 'about']) $(`#view-${x}`).hidden = x !== v;
  document.body.dataset.view = v;
}
document.querySelector('.tabs').onclick = (e) => { const v = e.target.closest('button')?.dataset.view; if (v) go(v === 'map' ? '#/' : `#/${v}`); };
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
function route() {
  const [, a, b] = location.hash.split('/');
  if (a === 'c' && cos.has(b)) return showCompany(cos.get(b));
  if (a === 's' && src.has(decodeURIComponent(b ?? ''))) return showSource(src.get(decodeURIComponent(b)));
  const hadPanel = !$('#panel').hidden;
  closePanel();
  map.setFocus(null);
  if (a === 'people') { setView('people'); renderPeople(); }
  else if (a === 'list') { setView('list'); renderList(); }
  else if (a === 'about') setView('about');
  else { setView('map'); if (hadPanel) map.fitAll(); }
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
const hdr = $('.top');
new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${hdr.offsetHeight}px`)).observe(hdr);
for (const [sel2, ic] of [['[data-z="in"]', 'plus'], ['[data-z="out"]', 'minus'], ['[data-z="fit"]', 'fit']]) $(sel2).innerHTML = icon(ic);
renderStats(); renderFilters(); renderMap(); renderList();
countUp($('#n-co'), cos.size);
route();
