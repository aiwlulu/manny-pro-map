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
    const ev = { what: r.note, kind: r.kind, segment: r.segment, share: r.share, value: r.value, source: r.source, detail: r.detail, year: r.year };
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
        const ev = { rel: r.type, amount: r.amount, usd: r.usd_bn, stake: r.stake, year: r.year, detail: r.detail ?? r.note, source: r.source };
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
  // Money cycles of 2–3 parties with at least one investment; edges point the way money moves
  // (investor → investee, buyer → seller). Only chips and compute count as purchases here.
  const flows = new Map();
  const flow = (a, b, e) => { if (top(a) !== top(b)) (flows.get(top(a)) ?? flows.set(top(a), []).get(top(a))).push({ to: top(b), ...e }); };
  for (const [x, l] of holds) for (const h of l) if (h.rel === 'invested') flow(x, h.c.id, { t: 'inv', ev: h, from: byId.get(x) });
  for (const [s, dl] of down) for (const d of dl) if (['hardware', 'cloud'].includes(d.kind)) flow(d.c.id, s, { t: 'buy', ev: d, seller: byId.get(s), buyer: d.c });
  const cycles = [], seenCy = new Set();
  for (const s0 of flows.keys()) {
    const walk = (n, path, es) => {
      for (const e of flows.get(n) ?? []) {
        if (e.to === s0 && path.length >= 2 && [...es, e].some((x) => x.t === 'inv')) {
          const i = path.indexOf([...path].sort()[0]), key = [...path.slice(i), ...path.slice(0, i)].join('>');
          if (!seenCy.has(key)) { seenCy.add(key); const all = [...es, e]; cycles.push({ ids: [...path.slice(i), ...path.slice(0, i)], edges: [...all.slice(i), ...all.slice(0, i)] }); }
        } else if (!path.includes(e.to) && path.length < 3) walk(e.to, [...path, e.to], [...es, e]);
      }
    };
    walk(s0, [s0], []);
  }
  for (const cy of cycles) cy.nodes = cy.ids.map((id) => byId.get(id));
  const rank = (a, b) => b.c.proN - a.c.proN || a.c.name.localeCompare(b.c.name);
  const capRank = (a, b) => (a.rel === 'parent' ? 0 : 1) - (b.rel === 'parent' ? 0 : 1) || !!b.loop - !!a.loop || !!b.amount - !!a.amount || rank(a, b);
  for (const [x, l] of holds) for (const h of l) h.loop = loop.get(`${x}>${h.c.id}`);
  for (const [y, l] of owners) for (const o of l) o.loop = loop.get(`${o.c.id}>${y}`);
  for (const m of [up, down]) for (const l of m.values()) l.sort(rank);
  for (const m of [owners, holds]) for (const l of m.values()) l.sort(capRank);
  const get = (m) => (id) => m.get(id) ?? [];
  return {
    up: get(up), down: get(down), owners: get(owners), holds: get(holds), top,
    cycles: (id) => (id ? cycles.filter((cy) => cy.ids.includes(top(id))) : cycles),
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


const usd = (bn) => (bn >= 1000 ? `${(bn / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 兆美元` : `${(bn * 10).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 億美元`);
const flowText = (e) => (e.t === 'inv'
  ? { label: '投資', amount: e.ev.amount || (e.ev.usd ? usd(e.ev.usd) : ''), sub: e.ev.stake ? `持股 ${e.ev.stake}` : '' }
  : { label: `採購${e.ev.what ? ` ${e.ev.what}` : ''}`, amount: e.ev.value ? `${e.ev.value.prefix ?? ''}${usd(e.ev.value.usd_bn)}` : '', sub: e.ev.value?.basis ?? '' });
// Ring diagram: companies on a circle, arrows show where the money goes, numbered steps below carry the sources
let figN = 0;
function cycleFigure(cy, { focus = null } = {}) {
  // Start from the first investment so the story reads "invests → buys → buys back"
  const k = cy.edges.findIndex((e) => e.t === 'inv');
  const nodes = [...cy.nodes.slice(k), ...cy.nodes.slice(0, k)], edges = [...cy.edges.slice(k), ...cy.edges.slice(0, k)];
  const n = nodes.length, W = 400, H = n === 2 ? 240 : 330, R = 40, id = `cy${++figN}`;
  const pos = n === 2 ? [[64, 120], [336, 120]] : [[200, 62], [336, 262], [64, 262]];
  const cx = W / 2, cyy = n === 2 ? H / 2 : 195;
  const color = (e) => (e.t === 'inv' ? 'capital' : e.ev.kind);
  const paths = edges.map((e, i) => {
    const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % n];
    let a, b, q, l;
    if (n === 2) {
      // Top arc goes left → right, bottom arc returns
      const s = i === 0 ? -1 : 1, off = R * 0.82, dy = R * 0.57;
      a = [x1 + (s < 0 ? off : -off), y1 + s * dy]; b = [x2 + (s < 0 ? -off : off) - (s < 0 ? 4 : -4), y2 + s * dy];
      q = [cx, y1 + s * 78]; l = [cx, y1 + s * 74];
    } else {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      let nx = -uy, ny = ux;
      if (nx * ((x1 + x2) / 2 - cx) + ny * ((y1 + y2) / 2 - cyy) < 0) { nx = -nx; ny = -ny; }
      a = [x1 + ux * (R + 6), y1 + uy * (R + 6)]; b = [x2 - ux * (R + 10), y2 - uy * (R + 10)];
      q = [(x1 + x2) / 2 + nx * 16, (y1 + y2) / 2 + ny * 16]; l = [(x1 + x2) / 2 + nx * 40, (y1 + y2) / 2 + ny * 40];
    }
    return { e, d: `M${a[0]},${a[1]} Q${q[0]},${q[1]} ${b[0]},${b[1]}`, lx: l[0], ly: l[1], k: color(e) };
  });
  const pc = (v, m) => `${(v / m) * 100}%`;
  const kinds = [...new Set(paths.map((p) => p.k))];
  const label = (p) => { const t = flowText(p.e); return `<span class="cy-l" style="left:${pc(p.lx, W)};top:${pc(p.ly, H)};--k:var(--k-${p.k})"><b>${esc(t.label)}</b>${t.amount ? `<em>${esc(t.amount)}</em>` : ''}</span>`; };
  const node = (c, i) => `<a class="cy-n${c.extended ? ' ext' : ''}${focus && c.id === focus ? ' on' : ''}" href="#/chain/${c.id}" style="left:${pc(pos[i][0], W)};top:${pc(pos[i][1], H)};--c1:${IND(c).c1}">${AV(c)}<b>${esc(c.name)}</b></a>`;
  const step = (p, i) => { const t = flowText(p.e), a = nodes[i], b = nodes[(i + 1) % n];
    const via = p.e.t === 'buy' && p.e.seller.id !== b.id ? `（${esc(p.e.seller.name)}）` : '';
    return `<li style="--k:var(--k-${p.k})"><span class="cy-i">${i + 1}</span><span><b>${esc(a.name)}</b> → <b>${esc(b.name)}</b>${via}　${esc(t.label)}${t.amount ? ` <em>${esc(t.amount)}</em>` : ''}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>${evidence(p.e.ev.value?.source ? { ...p.e.ev, source: p.e.ev.value.source } : p.e.ev)}</li>`; };
  // Two-party loops also compare what went in with what came back
  let bars = '';
  if (n === 2 && (edges[0].ev.usd || edges[1].ev.value?.usd_bn)) {
    const back = edges[1];
    const vi = edges[0].ev.usd, vb = back.ev.value?.usd_bn, max = Math.max(vi ?? 0, vb ?? 0) || 1;
    const bar = (cls, v, text) => `<div class="lp-row ${cls}"><span class="lp-k">${cls === 'in' ? '投資' : '回流'}</span><span class="lp-bar">${v ? `<i style="--w:${Math.max(2, (v / max) * 100)}%"></i>` : '<i class="na"></i>'}</span><b>${v ? esc(text) : '金額未公開'}</b></div>`;
    const mult = vi && vb ? vb / vi : null;
    bars = `<div class="lp-bars" style="--k:var(--k-${back.ev.kind})">${bar('in', vi, flowText(edges[0]).amount)}${bar('out', vb, flowText(back).amount)}</div>
      ${mult ? `<p class="cy-m">回流約為投資的 <b>${mult >= 10 ? Math.round(mult) : mult.toFixed(1)} 倍</b>${back.ev.share ? ` · 佔 ${esc(back.seller.name)} 營收 <b>${pct(back.ev.share.pct)}</b>` : ''}</p>` : ''}`;
  }
  return `<figure class="cy n${n}">
    <div class="cy-stage" style="aspect-ratio:${W}/${H}">
      <svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${kinds.map((k) => `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--k-${k})"/></marker>`).join('')}</defs>
        ${paths.map((p) => `<path class="cy-p${p.e.t === 'inv' ? ' inv' : ''}" d="${p.d}" style="stroke:var(--k-${p.k})" marker-end="url(#${id}-${p.k})"/>`).join('')}</svg>
      ${n > 2 ? `<span class="cy-c" style="top:${pc(cyy + 10, H)}">資金循環</span>` : ''}
      ${nodes.map(node).join('')}${paths.map(label).join('')}
    </div>
    ${bars}
    <ol class="cy-steps">${paths.map(step).join('')}</ol>
  </figure>`;
}
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

let AV = () => '', IND = () => ({});
export function renderExplorer(root, c, chain, { avatar, industryOf, peers, icon, indirect = false, onToggle, hidden = new Set(), onFilter }) {
  AV = (x) => avatar(x, 'md'); IND = industryOf;
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
  // Capital cards: ownership (parent / subsidiary) vs minority investment, each with its own icon and colour
  const cys = chain.cycles(c.id).sort((a, b) => a.ids.length - b.ids.length);
  const cyPairs = new Set(cys.flatMap((cy) => cy.edges.filter((e) => e.t === 'inv').map((e) => `${chain.top(e.from.id)}>${e.to}`)));
  const ring = (x) => {
    const v = x.rel === 'parent' ? 100 : parseFloat(String(x.stake ?? '').replace(/[^\d.]/g, ''));
    return v > 0 && v <= 100 ? `<span class="stake" style="--p:${v}" title="持股 ${v}%"><span>${v === 100 ? '100' : Math.round(v)}<small>%</small></span></span>` : '';
  };
  const REL = { parent: ['own', 'network', '母公司'], sub: ['own', 'network', '旗下'], inv: ['inv', 'coins', '投資'] };
  const capCard = (x, col, kind) => {
    const [cls, ic, word] = REL[kind], loop = cyPairs.has(col === 'ci' ? `${chain.top(x.c.id)}>${chain.top(c.id)}` : `${chain.top(c.id)}>${chain.top(x.c.id)}`);
    return `<div class="cx-wrap" data-col="${col}" data-kind="capital"><a class="cx-node cap ${cls}${x.c.extended ? ' ext' : ''}${loop ? ' loop' : ''}" href="#/chain/${x.c.id}" data-id="${x.c.id}" data-col="${col}" style="--c1:${industryOf(x.c).c1}">
      ${avatar(x.c, 'md')}<span class="cx-t"><b>${esc(x.c.name)}</b><i>${esc(industryOf(x.c).name)}${extTag(x.c)}</i>
      <span class="cap-tags"><span class="rt ${cls}">${icon(ic)}${word}</span>${loop ? `<span class="rt loop" title="這筆投資在資金循環裡，見上方循環圖">${icon('repeat')}資金循環</span>` : ''}</span>
      ${[x.amount, x.year && `${x.year}`].filter(Boolean).length ? `<em>${[x.amount, x.year].filter(Boolean).map(esc).join(' · ')}</em>` : ''}${x.detail && x.rel !== 'parent' ? `<span class="fl">${esc(x.detail)}</span>` : ''}</span>${ring(x)}</a>${evidence(x)}</div>`;
  };
  const capRow = (key, kind, ic, title, hint, list) => (list.length ? `<div class="cx-crow ${REL[kind][0]}" data-col="${key}"><h4>${icon(ic)}${title}<span>${list.length}</span><em>${hint}</em></h4><div class="cx-cards">${list.map((x) => capCard(x, key, kind)).join('')}</div></div>` : '');
  const capLegend = `<div class="cap-key"><span class="rt own">${icon('network')}母公司／旗下</span>控股、合併報表<span class="rt inv">${icon('coins')}投資</span>少數股權<span class="rt loop">${icon('repeat')}資金循環</span>錢經採購流回投資方<span class="stake sm" style="--p:30"></span>持股比例</div>`;
  const capital = capN ? `<section class="cx-cap"><h3>${icon('building')}資金與股權<span>誰持有 ${esc(c.name)}、${esc(c.name)} 又投資了誰</span></h3>
      ${capLegend}
      ${cys.length ? `<div class="loops"><h4>${icon('repeat')}資金循環<span>${cys.length} 組</span><em>箭頭是錢的流向：投資進去的錢，經過採購晶片或算力又流回投資方</em><a class="cy-all" href="#/loops">看全部資金循環 →</a></h4><div class="loop-grid">${cys.map((cy) => cycleFigure(cy, { focus: chain.top(c.id) })).join('')}</div></div>` : ''}
      ${capRow('ci', 'parent', 'network', '母公司', `${esc(c.name)} 是它的旗下事業`, own.filter((x) => x.rel === 'parent'))}
      ${capRow('ci', 'inv', 'coins', `投資 ${esc(c.name)} 的公司`, '少數股權投資', own.filter((x) => x.rel !== 'parent'))}
      ${capRow('co', 'inv', 'coins', `${esc(c.name)} 投資的公司`, '少數股權投資', hold.filter((x) => x.rel !== 'parent'))}
      ${capRow('co', 'sub', 'network', '旗下事業', `由 ${esc(c.name)} 控股`, hold.filter((x) => x.rel === 'parent'))}</section>` : '';

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
      <p class="cx-note">上下游為讀者依公開資料（公司新聞稿、財報、主流媒體）整理的主要供應關係，只列地圖內的公司，每條直接關係附來源。連線顏色代表流動的是硬體、軟體、雲端算力、服務或內容；下游依本公司的營收區塊分組；營收佔比取自最近一個完整財年的年報，四捨五入成約略比例，用來看結構而非精確數字。「佔○○營收」只在供應方財報具名揭露時顯示。資金區以圖示區分控股（母公司／旗下）、少數股權投資與資金循環，圓環為持股比例；虛線框的「延伸」公司為補足關係而列出，曼報尚未專文談過。打開「顯示間接關係」可看第二層，僅供探索。</p>
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

// Every detected money cycle on one page
export function renderLoops(root, chain, { avatar, industryOf, icon }) {
  AV = (x) => avatar(x, 'md'); IND = industryOf;
  const all = chain.cycles();
  const by = (n) => all.filter((cy) => cy.ids.length === n);
  const sec = (title, note, list) => (list.length ? `<section class="lpg-sec"><h3>${title}<span>${list.length} 組</span></h3><p>${note}</p><div class="loop-grid">${list.map((cy) => cycleFigure(cy)).join('')}</div></section>` : '');
  const key = (k, label, dash) => `<span><svg viewBox="0 0 34 10" aria-hidden="true"><path d="M2,5 H30" style="stroke:var(--k-${k})" ${dash ? 'stroke-dasharray="6 5"' : ''}/></svg>${label}</span>`;
  root.innerHTML = `
    <header class="cx-head">
      <div><span class="eyebrow">資金循環 Money Loops</span><h2>AI 產業的資金循環</h2></div>
      <div class="cx-actions"><button class="iconbtn cx-close" aria-label="關閉">${icon('x')}</button></div>
    </header>
    <div class="cx-body lpg">
      <p class="lpg-intro">一家公司投資另一家，被投資方再（直接或經過第三家）向它採購晶片或算力，投資的錢就以營收的形式流回來。以下由地圖裡附來源的投資與採購關係自動找出，金額只採官方或主流媒體公開的數字；多為承諾或上限，不等於已付款。</p>
      <div class="lpg-key"><b>箭頭＝錢的流向</b>${key('capital', '投資', false)}${key('hardware', '採購晶片', true)}${key('cloud', '採購雲端算力', true)}</div>
      ${sec('三方循環', '錢繞一圈經過三家公司，例如投資 AI 公司、AI 公司租雲端、雲端業者再買晶片。', by(3))}
      ${sec('兩方循環', '投資方與被投資方互為客戶：投資進去，再以採購的形式流回。', by(2))}
    </div>`;
}
