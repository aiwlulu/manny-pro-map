const KIND = {
  pro: { label: '曼報 Pro', short: 'Pro' },
  'pro-podcast': { label: 'Pro Podcast', short: 'Pro 🎧' },
  newsletter: { label: '免費電子報', short: '電子報' },
  podcast: { label: '曼報 Podcast', short: '🎧' },
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
const LINK_LABEL = { website: '官網', wikipedia: 'Wikipedia', wikipedia_zh: '維基百科', investor: '投資人關係', crunchbase: 'Crunchbase' };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => s.toLowerCase().normalize('NFKC').replace(/\s+/g, '');

// Per-viewer storage; failures fall back to memory
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const read = new Set(store.get('pm-read', []));
const kinds = new Set(store.get('pm-kinds', KIND_ORDER));
let onlyUnread = false;

const data = await fetch('data.json').then((r) => r.json());
const src = new Map(data.sources.map((s) => [s.id, s]));
const cos = new Map(data.companies.map((c) => [c.id, c]));
const ind = new Map(data.industries.map((i, n) => [i.id, { ...i, n }]));

// Region gradients walk the Built (blue) → Different (red) spectrum
const STOPS = ['#7cc6e4', '#8aa6e6', '#a99ce0', '#c9a2d9', '#e58aa0', '#ee6a55'];
const lerp = (a, b, t) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, '0')).join('');
const colorAt = (t) => { const x = t * (STOPS.length - 1), i = Math.min(Math.floor(x), STOPS.length - 2); return lerp(STOPS[i], STOPS[i + 1], x - i); };
const N = data.industries.length;
for (const i of ind.values()) i.grad = `linear-gradient(90deg, ${colorAt(i.n / N)}, ${colorAt(Math.min(1, (i.n + 1.6) / N))})`;

// Sources sorted Pro first, newest first
for (const c of cos.values()) {
  c.src = (c.sources ?? []).map((id) => src.get(id)).filter(Boolean)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.date.localeCompare(a.date));
  c.proN = c.src.filter((s) => PRO_KINDS.has(s.kind)).length;
  c.rels = [];
}
for (const c of cos.values())
  for (const r of c.relations ?? []) {
    const t = cos.get(r.target);
    if (!t) continue;
    c.rels.push({ id: t.id, label: REL[r.type][0], note: r.note });
    t.rels.push({ id: c.id, label: REL[r.type][1], note: r.note });
  }
const bySrc = new Map();
for (const c of cos.values()) for (const s of c.src) (bySrc.get(s.id) ?? bySrc.set(s.id, []).get(s.id)).push(c);

const visible = (c) => c.src.some((s) => kinds.has(s.kind));
const isDone = (c) => { const key = c.proN ? c.src.filter((s) => PRO_KINDS.has(s.kind)) : c.src; return key.length > 0 && key.every((s) => read.has(s.id)); };
const display = (c) => `${esc(c.name)}${c.zh && c.zh !== c.name ? ` <span class="zh">${esc(c.zh)}</span>` : ''}`;

/* ---------- Header stats & filters ---------- */
function renderStats() {
  const pro = data.sources.filter((s) => PRO_KINDS.has(s.kind));
  const done = pro.filter((s) => read.has(s.id)).length;
  $('#stats').innerHTML = `${cos.size} 家公司 · ${data.sources.length} 篇文章與節目 · 你已讀 Pro <strong>${done}</strong> / ${pro.length}`;
  $('#built').textContent = data.builtAt;
}
function renderFilters() {
  const el = $('#filters');
  el.innerHTML = KIND_ORDER.map((k) => `<button class="chipbtn ${kinds.has(k) ? 'on' : ''}" data-k="${k}"><span class="dot ${k}"></span>${KIND[k].label}</button>`).join('')
    + `<button class="chipbtn ${onlyUnread ? 'on' : ''}" data-k="unread">只看未讀</button>`;
  el.onclick = (e) => {
    const k = e.target.closest('button')?.dataset.k;
    if (!k) return;
    if (k === 'unread') onlyUnread = !onlyUnread;
    else { kinds.has(k) ? kinds.delete(k) : kinds.add(k); if (!kinds.size) kinds.add(k); store.set('pm-kinds', [...kinds]); }
    renderFilters(); renderMap();
  };
}

/* ---------- Map ---------- */
let focus = null; // { cur, rel:Set, match:Set|null }
function chip(c) {
  const sz = c.proN >= 4 ? 's3' : c.proN >= 2 ? 's2' : '';
  const ks = KIND_ORDER.filter((k) => c.src.some((s) => s.kind === k));
  let cls = `co ${sz}`;
  if (isDone(c)) cls += ' done';
  if (focus) {
    if (focus.cur === c.id) cls += ' cur';
    else if (focus.rel?.has(c.id)) cls += ' rel';
    else if (!focus.match?.has(c.id)) cls += ' dim';
  }
  return `<button class="${cls}" data-id="${c.id}" title="${esc(c.name)}"><span class="nm">${display(c)}</span><span class="dots">${ks.map((k) => `<span class="dot ${k}"></span>`).join('')}</span></button>`;
}
function renderMap() {
  const groups = data.industries.map((i) => ({ i: ind.get(i.id), list: [] }));
  const gi = new Map(groups.map((g) => [g.i.id, g]));
  for (const c of cos.values()) {
    if (!visible(c) || (onlyUnread && isDone(c))) continue;
    gi.get(c.industry)?.list.push(c);
  }
  const html = groups.filter((g) => g.list.length).map(({ i, list }) => {
    list.sort((a, b) => b.proN - a.proN || b.src.length - a.src.length || a.name.localeCompare(b.name));
    return `<section class="region" style="--g:${i.grad}"><h2>${esc(i.name)}<span class="en">${esc(i.en)}</span><span class="n">${list.length}</span></h2><div class="cos">${list.map(chip).join('')}</div></section>`;
  }).join('');
  $('#map').innerHTML = html || `<p class="empty">${cos.size ? '目前的篩選條件下沒有公司。' : '資料整理中，很快就會補上 🗺️'}</p>`;
}
$('#map').addEventListener('click', (e) => { const id = e.target.closest('.co')?.dataset.id; if (id) go(`#/c/${id}`); });

/* ---------- People ---------- */
function renderPeople() {
  const ppl = [];
  for (const c of cos.values()) for (const p of c.people ?? []) ppl.push({ ...p, c });
  ppl.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const groups = new Map();
  for (const p of ppl) { const L = /[a-z]/i.test(p.name[0]) ? p.name[0].toUpperCase() : '#'; (groups.get(L) ?? groups.set(L, []).get(L)).push(p); }
  $('#people').innerHTML = [...groups].map(([L, list]) => `<div class="letter"><h3>${L}</h3>${list.map((p) =>
    `<button class="person" data-id="${p.c.id}"><span class="pn">${esc(p.name)}${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}</span><span class="pc">${esc(p.c.name)}${p.role ? ` · ${esc(p.role)}` : ''}</span></button>`).join('')}</div>`).join('');
}
$('#people').addEventListener('click', (e) => { const id = e.target.closest('.person')?.dataset.id; if (id) go(`#/c/${id}`); });

/* ---------- Panel ---------- */
function srcList(list) {
  return `<ul class="src">${list.map((s) => `<li class="${read.has(s.id) ? 'read' : ''}">
    <input type="checkbox" data-src="${esc(s.id)}" ${read.has(s.id) ? 'checked' : ''} aria-label="標記已讀">
    <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
    <span class="sm">${s.date}${s.column ? ` · ${esc(s.column)}` : ''}</span></li>`).join('')}</ul>`;
}
function openPanel(html) {
  const p = $('#panel');
  p.innerHTML = `<button class="close" aria-label="關閉">×</button>${html}<p class="note">連結皆指向曼報原站，內容著作權屬原作者。勾選的已讀紀錄只存在這台裝置。</p>`;
  p.hidden = false; $('#scrim').hidden = false; p.scrollTop = 0; document.body.classList.add('open');
}
function showCompany(c) {
  const i = ind.get(c.industry);
  const meta = [c.founded && `${c.founded} 年成立`, c.hq].filter(Boolean).join(' · ');
  const links = Object.entries(c.links ?? {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${LINK_LABEL[k] ?? k} ↗</a>`).join('');
  const ppl = (c.people ?? []).map((p) => `<li><span class="pn">${esc(p.name)}</span>${p.zh ? ` <span class="muted">${esc(p.zh)}</span>` : ''}${p.role ? `<span class="role">${esc(p.role)}</span>` : ''}${p.interviewed ? '<span class="iv">受訪</span>' : ''}</li>`).join('');
  const rels = c.rels.map((r) => `<button data-go="${r.id}" title="${esc(r.note ?? '')}"><span class="rt">${r.label}</span>${esc(cos.get(r.id).name)}</button>`).join('');
  const sections = KIND_ORDER.map((k) => { const l = c.src.filter((s) => s.kind === k); return l.length ? `<h3><span class="dot ${k}"></span>${KIND[k].label}<span class="c">${l.length}</span></h3>${srcList(l)}` : ''; }).join('');
  openPanel(`<span class="ind" style="--g:${i?.grad}">${esc(i?.name ?? '')}</span>
    <h2>${esc(c.name)}${c.zh && c.zh !== c.name ? `<span class="zhn">${esc(c.zh)}</span>` : ''}</h2>
    ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
    <p class="sum">${esc(c.summary)}</p>
    ${links ? `<div class="links">${links}</div>` : ''}
    ${ppl ? `<h3>創辦人與關鍵人物</h3><ul class="ppl">${ppl}</ul>` : ''}
    ${rels ? `<h3>關係</h3><div class="rels">${rels}</div>` : ''}
    ${sections}`);
  focus = { cur: c.id, rel: new Set(c.rels.map((r) => r.id)), match: null };
  setView('map'); renderMap();
  $(`.co[data-id="${c.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function showSource(s) {
  const list = bySrc.get(s.id) ?? [];
  openPanel(`<span class="ind" style="--g:var(--grad-diff)">${KIND[s.kind].label}</span>
    <h2 style="font-size:22px">${esc(s.title)}</h2><div class="meta">${s.date}${s.column ? ` · ${esc(s.column)}` : ''}</div>
    <div class="links" style="margin-top:12px"><a href="${esc(s.url)}" target="_blank" rel="noopener">到曼報閱讀 ↗</a></div>
    <h3>這篇談到的公司<span class="c">${list.length}</span></h3><div class="rels">${list.map((c) => `<button data-go="${c.id}">${esc(c.name)}</button>`).join('')}</div>`);
  focus = { cur: null, rel: null, match: new Set(list.map((c) => c.id)) };
  setView('map'); renderMap();
}
$('#panel').addEventListener('click', (e) => {
  if (e.target.closest('.close')) return go('#/');
  const g = e.target.closest('[data-go]')?.dataset.go;
  if (g) go(`#/c/${g}`);
});
$('#panel').addEventListener('change', (e) => {
  const id = e.target.dataset.src;
  if (!id) return;
  e.target.checked ? read.add(id) : read.delete(id);
  e.target.closest('li').classList.toggle('read', e.target.checked);
  store.set('pm-read', [...read]); renderStats(); renderMap();
});
$('#scrim').onclick = () => go('#/');

/* ---------- Search ---------- */
const index = [];
for (const c of cos.values()) {
  index.push({ t: 'c', key: norm(`${c.name} ${c.zh ?? ''} ${(c.aliases ?? []).join(' ')}`), label: c.name, sub: c.zh ?? '', go: `#/c/${c.id}` });
  for (const p of c.people ?? []) index.push({ t: 'p', key: norm(`${p.name} ${p.zh ?? ''}`), label: `${p.name}${p.zh ? ` ${p.zh}` : ''}`, sub: c.name, go: `#/c/${c.id}` });
}
for (const s of data.sources) index.push({ t: 's', key: norm(s.title), label: s.title, sub: `${KIND[s.kind].short} · ${s.date}`, go: `#/s/${encodeURIComponent(s.id)}` });
const T = { c: '公司', p: '人物', s: '文章' };
let hits = [], sel = 0;
function search(q) {
  const k = norm(q);
  if (!k) { $('#results').hidden = true; if (focus?.search) { focus = null; renderMap(); } return; }
  hits = index.filter((x) => x.key.includes(k)).sort((a, b) => (a.key.startsWith(k) ? 0 : 1) - (b.key.startsWith(k) ? 0 : 1) || 'cps'.indexOf(a.t) - 'cps'.indexOf(b.t)).slice(0, 30);
  sel = 0;
  $('#results').innerHTML = hits.length ? hits.map((h, n) => `<button data-n="${n}" class="${n === sel ? 'sel' : ''}"><span class="kind">${T[h.t]}</span><span>${esc(h.label)}</span><span class="sub">${esc(h.sub)}</span></button>`).join('') : '<div class="empty" style="padding:14px">沒有結果</div>';
  $('#results').hidden = false;
  const match = new Set(hits.filter((h) => h.t !== 's').map((h) => h.go.slice(4)));
  for (const h of hits.filter((h) => h.t === 's')) for (const c of bySrc.get(decodeURIComponent(h.go.slice(4))) ?? []) match.add(c.id);
  focus = { cur: null, rel: null, match, search: true }; renderMap();
}
const q = $('#q');
q.addEventListener('input', () => search(q.value));
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; search.mark?.(); [...$('#results').children].forEach((b, n) => b.classList.toggle('sel', n === sel)); }
  if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
  if (e.key === 'Escape') { q.value = ''; search(''); q.blur(); }
});
$('#results').addEventListener('click', (e) => { const n = e.target.closest('button')?.dataset.n; if (n) pick(hits[n]); });
function pick(h) { $('#results').hidden = true; go(h.go); }
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); } if (e.key === 'Escape' && !$('#panel').hidden) go('#/'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#results').hidden = true; });

/* ---------- Views & routing ---------- */
function setView(v) {
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.view === v);
  for (const x of ['map', 'people', 'about']) $(`#view-${x}`).hidden = x !== v;
  $('.hero').hidden = v === 'about';
}
document.querySelector('.tabs').onclick = (e) => { const v = e.target.closest('button')?.dataset.view; if (v) go(v === 'map' ? '#/' : `#/${v}`); };
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
function route() {
  const [, a, b] = location.hash.split('/');
  if (a === 'c' && cos.has(b)) return showCompany(cos.get(b));
  if (a === 's' && src.has(decodeURIComponent(b))) return showSource(src.get(decodeURIComponent(b)));
  $('#panel').hidden = true; $('#scrim').hidden = true; focus = null; document.body.classList.remove('open');
  if (a === 'people') { setView('people'); renderPeople(); }
  else if (a === 'about') setView('about');
  else { setView('map'); renderMap(); }
}
addEventListener('hashchange', route);
renderStats(); renderFilters(); route();
