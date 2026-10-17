// Supply-chain views: a compact flow for the side panel and a full-screen explorer two hops each way.
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// What flows along a supply link; keys mirror SUPPLY_KINDS in scripts/build.mjs
export const KINDS = {
  hardware: { label: '硬體', hint: '晶片、設備、零組件、整機' },
  software: { label: '軟體與 AI', hint: '軟體授權、AI 模型、引擎' },
  cloud: { label: '雲端算力', hint: '雲端、資料中心、算力租用' },
  service: { label: '服務與數據', hint: '支付、數據、網路、物流、發射' },
  content: { label: '內容授權', hint: '影視、音樂版權與製作' },
};
const KIND_KEYS = Object.keys(KINDS);
const extTag = (c) => (c.extended ? '<span class="xt" title="曼報尚未專文談過，為補足關係而列出">延伸</span>' : '');
const kindTag = (k) => (KINDS[k] ? `<span class="kd" style="--k:var(--k-${k})">${KINDS[k].label}</span>` : '');

const CUR = { USD: '美元', TWD: '新台幣', JPY: '日圓', EUR: '歐元', KRW: '韓元', GBP: '英鎊', SEK: '瑞典克朗', CNY: '人民幣', HKD: '港幣', CAD: '加幣' };
// Billions → 億 / 兆, the way Taiwanese financial press writes it
export function money(bn, cur) {
  const yi = bn * 10;
  const n = yi >= 10000 ? `${(yi / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 兆` : `${Math.round(yi).toLocaleString('zh-TW')} 億`;
  return `約 ${n}${CUR[cur] ?? cur}`;
}
const pct = (x) => (x < 1 ? '<1%' : `${Math.round(x)}%`);
export const segOf = (c, id) => c?.revenue?.segments?.find((g) => g.id === id);

// up/down: Map<id, [{ c, what, kind, segment, share, source, detail, year }]>
// owners/holds: Map<id, [{ c, rel: 'invested' | 'parent', amount, stake, year, detail, source }]>
export function buildChain(companies) {
  const up = new Map(), down = new Map(), owners = new Map(), holds = new Map(), byId = new Map(companies.map((c) => [c.id, c]));
  const push = (m, id, x) => (m.get(id) ?? m.set(id, []).get(id)).push(x);
  const add = (from, to, r) => {
    if (!from || !to || from === to) return;
    const ev = { what: r.note, kind: r.kind, segment: r.segment, share: r.share, source: r.source, detail: r.detail, year: r.year };
    const dup = down.get(from.id)?.find((x) => x.c === to);
    if (dup) {
      // Same link listed twice: keep the better-documented one
      if (!dup.source && ev.source) { Object.assign(dup, ev); Object.assign(up.get(to.id).find((x) => x.c === from), ev); }
      return;
    }
    push(down, from.id, { c: to, ...ev });
    push(up, to.id, { c: from, ...ev });
  };
  for (const c of companies)
    for (const r of c.relations ?? []) {
      const t = byId.get(r.target);
      if (!t) continue;
      if (r.type === 'supplier') add(c, t, r);
      if (r.type === 'customer') add(t, c, r);
      if (r.type === 'invested' || r.type === 'parent') {
        const ev = { rel: r.type, amount: r.amount, stake: r.stake, year: r.year, detail: r.detail ?? r.note, source: r.source };
        if (holds.get(c.id)?.some((x) => x.c === t)) continue;
        push(holds, c.id, { c: t, ...ev });
        push(owners, t.id, { c, ...ev });
      }
    }
  // Money loop: X invests in Y and Y buys from X (either side may act through a subsidiary)
  const par = new Map();
  for (const c of companies) for (const r of c.relations ?? []) if (r.type === 'parent') par.set(r.target, c.id);
  const top = (id) => par.get(id) ?? id;
  const loop = new Map();
  for (const [x, l] of holds) for (const h of l) {
    if (h.rel !== 'invested') continue;
    const back = [];
    for (const [s, dl] of down) if (top(s) === top(x)) for (const d of dl) if (top(d.c.id) === top(h.c.id)) back.push({ seller: byId.get(s), buyer: d.c, ...d });
    if (back.length) loop.set(`${x}>${h.c.id}`, back);
  }
  const rank = (a, b) => b.c.proN - a.c.proN || a.c.name.localeCompare(b.c.name);
  const capRank = (a, b) => (a.rel === 'parent' ? 0 : 1) - (b.rel === 'parent' ? 0 : 1) || !!b.loop - !!a.loop || !!b.amount - !!a.amount || rank(a, b);
  for (const [x, l] of holds) for (const h of l) h.loop = loop.get(`${x}>${h.c.id}`);
  for (const [y, l] of owners) for (const o of l) o.loop = loop.get(`${o.c.id}>${y}`);
  for (const m of [up, down]) for (const l of m.values()) l.sort(rank);
  for (const m of [owners, holds]) for (const l of m.values()) l.sort(capRank);
  const get = (m) => (id) => m.get(id) ?? [];
  return {
    up: get(up), down: get(down), owners: get(owners), holds: get(holds), top,
    supply: (id) => !!(up.get(id)?.length || down.get(id)?.length),
    has: (id) => !!(up.get(id)?.length || down.get(id)?.length || owners.get(id)?.length || holds.get(id)?.length),
  };
}

export function segmentTrail(c, ind) {
  const segs = ind?.segments ?? [];
  if (segs.length < 2) return '';
  const order = { up: 0, mid: 1, down: 2 };
  return `<ol class="trail">${[...segs].sort((a, b) => order[a.stage] - order[b.stage]).map((g) => `<li class="${g.id === c.segment ? 'on' : ''}">${esc(g.name)}</li>`).join('')}</ol>`;
}

const SRC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const evidence = (x, label = '來源') => (x.source ? `<a class="ev" href="${esc(x.source)}" target="_blank" rel="noopener noreferrer" title="${esc([x.detail, host(x.source)].filter(Boolean).join(' · '))}">${label}${SRC}</a>` : '');

// Stacked bar of revenue lines; `hot` marks the line a link flows through
export function revenueBar(c, { hot = null, full = false } = {}) {
  const v = c.revenue;
  if (!v || (!v.segments?.length && !full)) return '';
  const segs = v.segments ?? [];
  const shares = segs.length > 0 && segs.every((g) => g.share != null);
  const head = `<span class="rv-h" title="取自最近一個完整財年的年報，四捨五入的約略比例"><b>營收結構</b><em>${esc(v.fy)}${v.total != null ? ` · ${money(v.total, v.currency)}` : ''}</em>${full ? evidence(v, v.private ? '來源' : '財報') : ''}</span>`;
  const bar = shares ? `<span class="rv-bar">${segs.map((g, n) => `<i data-seg="${esc(g.id)}" class="${g.id === hot ? 'hot' : ''}" style="--w:${g.share};--n:${n}" title="${esc(`${g.name} ${pct(g.share)}`)}"></i>`).join('')}</span>` : '';
  const list = full && segs.length ? `<ul class="rv-l">${segs.map((g, n) => `<li data-seg="${esc(g.id)}" class="${g.id === hot ? 'hot' : ''}" style="--n:${n}"><i></i><span>${esc(g.name)}</span>${g.share != null ? `<b>${pct(g.share)}</b>` : ''}</li>`).join('')}</ul>` : '';
  return `<div class="rv${full ? ' full' : ''}">${head}${bar}${list}${full && v.note ? `<p class="rv-n">${esc(v.note)}</p>` : ''}</div>`;
}

// "影像與感測 · 佔 Sony 營收 11%" or a disclosed customer concentration
function flowNote(x, sup, { seg = true } = {}) {
  const g = seg ? segOf(sup, x.segment) : null, bits = [];
  if (g) bits.push(`${esc(g.name)}${g.share != null ? `，佔 ${esc(sup.name)} 營收 <b>${pct(g.share)}</b>` : ''}`);
  if (x.share) bits.push(`佔 ${esc(sup.name)} 營收 <b>${pct(x.share.pct)}</b>`);
  return bits.length ? `<span class="fl" title="${x.share ? esc(`${x.share.fy} 年報揭露`) : '供應方的營收區塊與佔比'}">${bits.join(' · ')}</span>` : '';
}
const capNote = (x) => [x.rel === 'parent' ? '旗下事業' : '', x.amount, x.stake && `持股 ${x.stake}`, x.year && `${x.year}`].filter(Boolean).map(esc).join(' · ');

export function miniChain(c, chain, { avatar }) {
  const ups = chain.up(c.id), downs = chain.down(c.id), own = chain.owners(c.id), hold = chain.holds(c.id);
  if (!ups.length && !downs.length && !own.length && !hold.length) return '';
  const row = (x, sup) => `<div class="mc-row"><a class="mc-node" href="#/c/${x.c.id}">${avatar(x.c, 'xs')}<span class="mc-n">${esc(x.c.name)}</span>${extTag(x.c)}</a>
    ${x.what ? `<span class="mc-w" style="--k:var(--k-${x.kind})">${esc(x.what)}</span>` : ''}${evidence(x)}${x.detail || x.segment || x.share ? `<span class="mc-d">${flowNote(x, sup)}${x.detail ? `<span>${esc(x.detail)}</span>` : ''}</span>` : ''}</div>`;
  const capRow = (x) => `<div class="mc-row"><a class="mc-node" href="#/c/${x.c.id}">${avatar(x.c, 'xs')}<span class="mc-n">${esc(x.c.name)}</span>${extTag(x.c)}</a>
    <span class="mc-w cap">${x.loop ? '⟲ ' : ''}${x.rel === 'parent' ? '股權' : '投資'}</span>${evidence(x)}${capNote(x) || x.detail ? `<span class="mc-d">${capNote(x)}${x.detail ? `<span>${esc(x.detail)}</span>` : ''}</span>` : ''}</div>`;
  const col = (title, list, fn, cls = '') => (list.length ? `<div class="mc-col ${cls}"><span class="mc-h">${title}</span>${list.slice(0, 6).map(fn).join('')}${list.length > 6 ? `<span class="mc-more">還有 ${list.length - 6} 家，展開產業鏈查看</span>` : ''}</div>` : '');
  return `<div class="mini-chain">${col('資金 · 投資它的', own, capRow, 'cap')}${col('上游 · 供應給它', ups, (x) => row(x, x.c))}<div class="mc-self">${avatar(c, 'xs')}<b>${esc(c.name)}</b></div>${col('下游 · 它供應給', downs, (x) => row(x, c))}${col('資金 · 它投資的', hold, capRow, 'cap')}</div>`;
}

export function renderExplorer(root, c, chain, { avatar, industryOf, peers, icon, indirect = false, onToggle, hidden = new Set(), onFilter }) {
  const L1u = chain.up(c.id), L1d = chain.down(c.id), own = chain.owners(c.id), hold = chain.holds(c.id);
  const seen = new Set([c.id, ...L1u.map((x) => x.c.id), ...L1d.map((x) => x.c.id)]);
  const hop = (list, dir) => {
    const out = new Map();
    for (const x of list)
      for (const y of chain[dir](x.c.id))
        if (!seen.has(y.c.id)) (out.get(y.c.id) ?? out.set(y.c.id, { c: y.c, via: [] }).get(y.c.id)).via.push({ id: x.c.id, what: y.what, kind: y.kind });
    return [...out.values()].sort((a, b) => b.via.length - a.via.length || b.c.proN - a.c.proN).slice(0, 8);
  };
  // Second hop is opt-in: indirect links (a cloud's customers under a chip maker) read as a stretch
  const L2u = indirect ? hop(L1u, 'up') : [], L2d = indirect ? hop(L1d, 'down') : [];
  const canHop = hop(L1u, 'up').length + hop(L1d, 'down').length > 0;

  const card = (x, col, { what = '', kind = '', flow = '', ev = null, size = 'md' } = {}) => {
    const i = industryOf(x);
    return `<div class="cx-wrap" data-col="${col}"${kind ? ` data-kind="${kind}"` : ''}><a class="cx-node${x.extended ? ' ext' : ''}" href="#/chain/${x.id}" data-id="${x.id}" data-col="${col}" style="--c1:${i.c1}">
      ${avatar(x, size)}<span class="cx-t"><b>${esc(x.name)}</b><i>${esc(i.name)}${extTag(x)}</i>${what || kind ? `<em>${kindTag(kind)}${esc(what)}</em>` : ''}${flow}${revenueBar(x)}</span></a>${ev ? evidence(ev) : ''}</div>`;
  };
  const cross = (o) => {
    const t = [];
    const same = (x) => chain.top(x.c.id) === chain.top(o.id);
    const inv = own.find(same), held = hold.find(same);
    if (inv) t.push(inv.c === o ? `也投資 ${esc(c.name)}` : `母公司 ${esc(inv.c.name)} 投資 ${esc(c.name)}`);
    if (held) t.push(`${esc(c.name)} 也投資它`);
    if (L1u.some((x) => x.c === o) && L1d.some((x) => x.c === o)) t.push('互為客戶');
    return t.length ? `<span class="lp">${t.map((s) => `<span>⟲ ${s}</span>`).join('')}</span>` : '';
  };
  const supCard = (x, col, sup) => card(x.c, col, { what: x.what, kind: x.kind, flow: flowNote(x, sup, { seg: col !== 'd1' || !c.revenue?.segments?.length }) + cross(x.c), ev: x });
  const hopCard = (x, col, word) => card(x.c, col, { kind: x.via[0].kind, what: x.via.length > 1 ? `${word} ${x.via.length} 家` : x.via[0].what });
  const capCard = (x, col) => `<div class="cx-wrap" data-col="${col}" data-kind="capital"><a class="cx-node${x.extended || x.c.extended ? ' ext' : ''}${x.loop ? ' loop' : ''}" href="#/chain/${x.c.id}" data-id="${x.c.id}" data-col="${col}" style="--c1:${industryOf(x.c).c1}">
      ${avatar(x.c, 'md')}<span class="cx-t"><b>${esc(x.c.name)}${x.loop ? '<span class="lb" title="投資的錢以採購形式流回投資方">⟲ 資金回流</span>' : ''}</b><i>${esc(industryOf(x.c).name)}${extTag(x.c)}</i><em><span class="kd" style="--k:var(--k-capital)">${x.rel === 'parent' ? '股權' : '投資'}</span>${capNote(x)}</em>${x.detail ? `<span class="fl">${esc(x.detail)}</span>` : ''}${x.loop ? x.loop.map((b) => `<span class="fl back">↩ ${esc(b.buyer.name)} 向 ${esc(b.seller.name)} 採購${kindTag(b.kind)}${esc(b.what ?? '')}${b.detail ? `：${esc(b.detail)}` : ''}</span>`).join('') : ''}</span></a><span class="evs">${evidence(x, '投資來源')}${x.loop ? x.loop.map((b) => evidence(b, '採購來源')).join('') : ''}</span></div>`;

  // Group a column: upstream by what flows in, downstream by which revenue line it feeds
  const byKind = (list, fn) => KIND_KEYS.map((k) => [k, list.filter((x) => x.kind === k)]).filter(([, l]) => l.length)
    .map(([k, l]) => `<div class="cx-grp" data-kind="${k}"><h4 style="--k:var(--k-${k})"><i></i>${KINDS[k].label}<span>${l.length}</span></h4>${l.map(fn).join('')}</div>`).join('');
  const bySeg = (list, fn) => {
    const segs = c.revenue?.segments ?? [];
    if (!segs.length || !list.some((x) => x.segment)) return byKind(list, fn);
    const groups = [...segs.map((g, n) => [g, n, list.filter((x) => x.segment === g.id)]), [{ id: '', name: '其他' }, -1, list.filter((x) => !segOf(c, x.segment))]].filter(([, , l]) => l.length);
    return groups.map(([g, n, l]) => `<div class="cx-grp seg" data-seg="${esc(g.id)}"${n >= 0 ? ` style="--n:${n}"` : ''}><h4><i></i>${esc(g.name)}${g.share != null ? `<b>${pct(g.share)}</b>` : ''}<span>${l.length}</span></h4>${l.map(fn).join('')}</div>`).join('');
  };
  const col = (key, title, body, n) => (n ? `<section class="cx-col" data-col="${key}"><h3>${title}<span>${n}</span></h3>${body}</section>` : `<section class="cx-col empty" data-col="${key}"><h3>${title}</h3><p>—</p></section>`);

  const kinds = KIND_KEYS.map((k) => [k, [...L1u, ...L1d].filter((x) => x.kind === k).length]).filter(([, n]) => n);
  const capN = own.length + hold.length;
  const chip = (k, label, n) => `<button class="kchip${hidden.has(k) ? ' off' : ''}" data-k="${k}" style="--k:var(--k-${k})" aria-pressed="${!hidden.has(k)}" title="${esc(KINDS[k]?.hint ?? '股權投資與母子公司')}"><i></i>${label}<span>${n}</span></button>`;
  const legend = kinds.length + (capN ? 1 : 0) > 1 ? `<div class="cx-legend"><span class="cx-lg-t">關係類型</span>${kinds.map(([k, n]) => chip(k, KINDS[k].label, n)).join('')}${capN ? chip('capital', '資金與股權', capN) : ''}</div>` : '';

  const i = industryOf(c);
  const center = `<section class="cx-col" data-col="mid"><h3>本公司</h3><div class="cx-wrap" data-col="mid"><a class="cx-node center" href="#/c/${c.id}" data-id="${c.id}" data-col="mid" style="--c1:${i.c1}">
      ${avatar(c, 'lg')}<span class="cx-t"><b>${esc(c.name)}</b><i>${esc(i.name)}</i></span></a>${revenueBar(c, { full: true })}</div></section>`;
  const supplyN = L1u.length + L1d.length;
  const capRow = (key, title, list) => (list.length ? `<div class="cx-crow" data-col="${key}"><h4>${title}<span>${list.length}</span></h4><div class="cx-cards">${list.map((x) => capCard(x, key)).join('')}</div></div>` : '');
  const loops = [...own, ...hold].filter((x) => x.loop);
  const capital = capN ? `<section class="cx-cap"><h3>${icon('building')}資金與股權<span>誰持有 ${esc(c.name)}、${esc(c.name)} 又投資了誰</span></h3>
      ${loops.length ? `<p class="cx-loops" title="一方投資另一方，被投資方又向投資方採購：資金以營收形式回流"><b>⟲ 資金回流 ${loops.length} 組</b>${loops.map((x) => `<a href="#/chain/${x.c.id}">${esc(x.c.name)}</a>`).join('')}<span>投資的錢以採購形式流回投資方</span></p>` : ''}
      ${capRow('ci', `投資 ${esc(c.name)} 的 · 母公司`, own)}${capRow('co', `${esc(c.name)} 投資的 · 旗下事業`, hold)}</section>` : '';

  const ps = peers(c);
  root.innerHTML = `
    <header class="cx-head">
      <div><span class="eyebrow">產業鏈 Value Chain</span><h2>${esc(c.name)} 的上下游${capN ? '與資金' : ''}</h2></div>
      <div class="cx-actions">${canHop ? `<label class="tgl cx-tgl"><input type="checkbox" data-hop ${indirect ? 'checked' : ''}><span class="sw"></span>顯示間接關係</label>` : ''}<a class="cx-btn" href="#/c/${c.id}">${icon('building')}公司資料</a><button class="iconbtn cx-close" aria-label="關閉">${icon('x')}</button></div>
    </header>
    <div class="cx-body${[...hidden].map((k) => ` hide-${k}`).join('')}">
      <svg class="cx-edges" aria-hidden="true"></svg>
      ${legend}
      ${supplyN ? `<div class="cx-grid${L2u.length ? '' : ' no-u2'}${L2d.length ? '' : ' no-d2'}">
        ${L2u.length ? col('u2', '上游的上游', L2u.map((x) => hopCard(x, 'u2', '供應')).join(''), L2u.length) : ''}
        ${col('u1', '上游 · 供應給它', byKind(L1u, (x) => supCard(x, 'u1', x.c)), L1u.length)}
        ${center}
        ${col('d1', c.revenue?.segments?.length && L1d.some((x) => x.segment) ? '下游 · 依營收區塊' : '下游 · 它供應給', bySeg(L1d, (x) => supCard(x, 'd1', c)), L1d.length)}
        ${L2d.length ? col('d2', '下游的下游', L2d.map((x) => hopCard(x, 'd2', '經')).join(''), L2d.length) : ''}
      </div>` : c.revenue ? `<div class="cx-solo">${center}</div>` : ''}
      ${capital}
      ${ps.length ? `<div class="cx-peers"><h3>同區段的同業</h3><div>${ps.map((p) => `<a href="#/chain/${p.id}">${avatar(p, 'xs')}${esc(p.name)}</a>`).join('')}</div></div>` : ''}
      <p class="cx-note">上下游為讀者依公開資料（公司新聞稿、財報、主流媒體）整理的主要供應關係，只列地圖內的公司，每條直接關係附來源。連線顏色代表流動的是硬體、軟體、雲端算力、服務或內容；下游依本公司的營收區塊分組；營收佔比取自最近一個完整財年的年報，四捨五入成約略比例，用來看結構而非精確數字。「佔○○營收」只在供應方財報具名揭露時顯示。「⟲ 資金回流」代表一方投資另一方、被投資方又向投資方採購；虛線框的「延伸」公司為補足關係而列出，曼報尚未專文談過。打開「顯示間接關係」可看第二層，僅供探索。</p>
    </div>`;

  // Edges: [fromId, fromCol, toId, toCol, kind]
  const edges = [
    ...L1u.map((x) => [x.c.id, 'u1', c.id, 'mid', x.kind]),
    ...L1d.map((x) => [c.id, 'mid', x.c.id, 'd1', x.kind]),
    ...L2u.flatMap((x) => x.via.map((v) => [x.c.id, 'u2', v.id, 'u1', v.kind])),
    ...L2d.flatMap((x) => x.via.map((v) => [v.id, 'd1', x.c.id, 'd2', v.kind])),
  ];
  const svg = root.querySelector('.cx-edges'), body = root.querySelector('.cx-body');
  const node = (id, col) => root.querySelector(`.cx-node[data-id="${CSS.escape(id)}"][data-col="${col}"]`);
  const draw = () => {
    const box = body.getBoundingClientRect();
    svg.setAttribute('width', body.scrollWidth); svg.setAttribute('height', body.scrollHeight);
    if (getComputedStyle(svg).display === 'none') return;
    svg.innerHTML = edges.map(([a, ac, b, bc, k], n) => {
      const A = node(a, ac), B = node(b, bc);
      // Filtered-out cards have no box
      if (!A?.offsetParent || !B?.offsetParent) return '';
      const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      const x1 = ra.right - box.left + body.scrollLeft, y1 = ra.top + ra.height / 2 - box.top + body.scrollTop;
      const x2 = rb.left - box.left + body.scrollLeft, y2 = rb.top + rb.height / 2 - box.top + body.scrollTop;
      const dx = Math.max(30, (x2 - x1) / 2);
      return `<path class="k-${k}" data-a="${a}" data-b="${b}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" style="--i:${n % 12};--k:var(--k-${k})"/>`;
    }).join('');
  };
  requestAnimationFrame(draw);
  const ro = new ResizeObserver(() => requestAnimationFrame(draw));
  ro.observe(body);
  // Hovering a node lights up its edges; hovering a downstream group lights its revenue line
  body.addEventListener('pointerover', (e) => {
    const id = e.target.closest('.cx-node')?.dataset.id;
    for (const p of svg.children) p.classList.toggle('hot', !!id && (p.dataset.a === id || p.dataset.b === id));
    svg.classList.toggle('hovering', !!id);
    const seg = e.target.closest('[data-seg]')?.dataset.seg;
    for (const el of root.querySelectorAll('[data-col="mid"] [data-seg]')) el.classList.toggle('lit', !!seg && el.dataset.seg === seg);
  });
  root.querySelector('[data-hop]')?.addEventListener('change', (e) => onToggle?.(e.target.checked));
  root.querySelector('.cx-legend')?.addEventListener('click', (e) => {
    const b = e.target.closest('.kchip');
    if (!b) return;
    const k = b.dataset.k, off = !hidden.has(k);
    if (off) hidden.add(k); else hidden.delete(k);
    b.classList.toggle('off', off); b.setAttribute('aria-pressed', String(!off));
    body.classList.toggle(`hide-${k}`, off);
    onFilter?.([...hidden]);
    requestAnimationFrame(draw);
  });
  return () => ro.disconnect();
}
