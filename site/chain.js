// Supply-chain views: a compact flow for the side panel and a full-screen explorer two hops each way.
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// up/down: Map<id, [{ c, what }]>
export function buildChain(companies) {
  const up = new Map(), down = new Map(), byId = new Map(companies.map((c) => [c.id, c]));
  const add = (from, to, what) => {
    if (!from || !to || from === to) return;
    const d = down.get(from.id) ?? down.set(from.id, []).get(from.id);
    const dup = d.find((x) => x.c === to);
    if (dup) {
      // Same link listed twice: keep the one that says what is supplied
      if (!dup.what && what) { dup.what = what; up.get(to.id).find((x) => x.c === from).what = what; }
      return;
    }
    d.push({ c: to, what });
    (up.get(to.id) ?? up.set(to.id, []).get(to.id)).push({ c: from, what });
  };
  for (const c of companies)
    for (const r of c.relations ?? []) {
      const t = byId.get(r.target);
      if (r.type === 'supplier') add(c, t, r.note);
      if (r.type === 'customer') add(t, c, r.note);
    }
  const rank = (a, b) => b.c.proN - a.c.proN || a.c.name.localeCompare(b.c.name);
  for (const m of [up, down]) for (const l of m.values()) l.sort(rank);
  return { up: (id) => up.get(id) ?? [], down: (id) => down.get(id) ?? [] };
}

export function segmentTrail(c, ind) {
  const segs = ind?.segments ?? [];
  if (segs.length < 2) return '';
  const order = { up: 0, mid: 1, down: 2 };
  return `<ol class="trail">${[...segs].sort((a, b) => order[a.stage] - order[b.stage]).map((g) => `<li class="${g.id === c.segment ? 'on' : ''}">${esc(g.name)}</li>`).join('')}</ol>`;
}

export function miniChain(c, chain, { avatar }) {
  const ups = chain.up(c.id), downs = chain.down(c.id);
  const row = (x) => `<a class="mc-node" href="#/c/${x.c.id}">${avatar(x.c, 'xs')}<span class="mc-n">${esc(x.c.name)}</span>${x.what ? `<span class="mc-w">${esc(x.what)}</span>` : ''}</a>`;
  if (!ups.length && !downs.length) return '<p class="mc-empty">尚無整理好的上下游關係，歡迎到 GitHub 補充。</p>';
  return `<div class="mini-chain">
    ${ups.length ? `<div class="mc-col"><span class="mc-h">上游 · 供應給它</span>${ups.slice(0, 6).map(row).join('')}${ups.length > 6 ? `<span class="mc-more">還有 ${ups.length - 6} 家</span>` : ''}</div>` : ''}
    <div class="mc-self">${avatar(c, 'xs')}<b>${esc(c.name)}</b></div>
    ${downs.length ? `<div class="mc-col"><span class="mc-h">下游 · 它供應給</span>${downs.slice(0, 6).map(row).join('')}${downs.length > 6 ? `<span class="mc-more">還有 ${downs.length - 6} 家</span>` : ''}</div>` : ''}
  </div>`;
}

export function renderExplorer(root, c, chain, { avatar, industryOf, peers, icon }) {
  const L1u = chain.up(c.id), L1d = chain.down(c.id);
  const seen = new Set([c.id, ...L1u.map((x) => x.c.id), ...L1d.map((x) => x.c.id)]);
  const hop = (list, dir) => {
    const out = new Map();
    for (const x of list)
      for (const y of chain[dir](x.c.id))
        if (!seen.has(y.c.id)) (out.get(y.c.id) ?? out.set(y.c.id, { c: y.c, via: [] }).get(y.c.id)).via.push({ id: x.c.id, what: y.what });
    return [...out.values()].sort((a, b) => b.via.length - a.via.length || b.c.proN - a.c.proN).slice(0, 14);
  };
  const L2u = hop(L1u, 'up'), L2d = hop(L1d, 'down');
  const card = (x, col, what) => {
    const i = industryOf(x);
    return `<a class="cx-node${col === 'mid' ? ' center' : ''}" href="#/chain/${x.id}" data-id="${x.id}" data-col="${col}" style="--c1:${i.c1}">
      ${avatar(x, col === 'mid' ? 'lg' : 'md')}<span class="cx-t"><b>${esc(x.name)}</b><i>${esc(i.name)}</i>${what ? `<em>${esc(what)}</em>` : ''}</span></a>`;
  };
  const col = (key, title, items) => (items.length ? `<section class="cx-col" data-col="${key}"><h3>${title}<span>${items.length}</span></h3>${items.join('')}</section>` : `<section class="cx-col empty" data-col="${key}"><h3>${title}</h3><p>—</p></section>`);
  const ps = peers(c);
  root.innerHTML = `
    <header class="cx-head">
      <div><span class="eyebrow">產業鏈 Value Chain</span><h2>${esc(c.name)} 的上下游</h2></div>
      <div class="cx-actions"><a class="cx-btn" href="#/c/${c.id}">${icon('building')}公司資料</a><button class="iconbtn cx-close" aria-label="關閉">${icon('x')}</button></div>
    </header>
    <div class="cx-body">
      <svg class="cx-edges" aria-hidden="true"></svg>
      <div class="cx-grid${L2u.length ? '' : ' no-u2'}${L2d.length ? '' : ' no-d2'}">
        ${L2u.length ? col('u2', '上游的上游', L2u.map((x) => card(x.c, 'u2', x.via.length > 1 ? `供應 ${x.via.length} 家上游` : x.via[0].what))) : ''}
        ${col('u1', '上游', L1u.map((x) => card(x.c, 'u1', x.what)))}
        <section class="cx-col" data-col="mid"><h3>本公司</h3>${card(c, 'mid')}</section>
        ${col('d1', '下游', L1d.map((x) => card(x.c, 'd1', x.what)))}
        ${L2d.length ? col('d2', '下游的下游', L2d.map((x) => card(x.c, 'd2', x.via.length > 1 ? `經 ${x.via.length} 家下游` : x.via[0].what))) : ''}
      </div>
      ${ps.length ? `<div class="cx-peers"><h3>同區段的同業</h3><div>${ps.map((p) => `<a href="#/chain/${p.id}">${avatar(p, 'xs')}${esc(p.name)}</a>`).join('')}</div></div>` : ''}
      <p class="cx-note">上下游關係為讀者依公開資料整理的參考，只列名單內的公司；點任一家可沿著產業鏈繼續探索。</p>
    </div>`;

  // Edges: center ↔ L1, and L2 ↔ the L1 nodes they connect through
  const edges = [
    ...L1u.map((x) => [x.c.id, c.id]),
    ...L1d.map((x) => [c.id, x.c.id]),
    ...L2u.flatMap((x) => x.via.map((v) => [x.c.id, v.id])),
    ...L2d.flatMap((x) => x.via.map((v) => [v.id, x.c.id])),
  ];
  const svg = root.querySelector('.cx-edges'), body = root.querySelector('.cx-body');
  const node = (id, side) => {
    const cols = side === 'out' ? ['u2', 'u1', 'mid', 'd1'] : ['u1', 'mid', 'd1', 'd2'];
    return cols.map((k) => root.querySelector(`.cx-node[data-id="${CSS.escape(id)}"][data-col="${k}"]`)).find(Boolean);
  };
  const draw = () => {
    const box = body.getBoundingClientRect();
    svg.setAttribute('width', body.scrollWidth); svg.setAttribute('height', body.scrollHeight);
    svg.innerHTML = edges.map(([a, b], n) => {
      const A = node(a, 'out'), B = node(b, 'in');
      if (!A || !B || getComputedStyle(svg).display === 'none') return '';
      const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      const x1 = ra.right - box.left + body.scrollLeft, y1 = ra.top + ra.height / 2 - box.top + body.scrollTop;
      const x2 = rb.left - box.left + body.scrollLeft, y2 = rb.top + rb.height / 2 - box.top + body.scrollTop;
      const dx = Math.max(30, (x2 - x1) / 2);
      return `<path data-a="${a}" data-b="${b}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" style="--i:${n % 12}"/>`;
    }).join('');
  };
  requestAnimationFrame(draw);
  const ro = new ResizeObserver(() => requestAnimationFrame(draw));
  ro.observe(body);
  // Hovering a node lights up its edges
  body.addEventListener('pointerover', (e) => {
    const id = e.target.closest('.cx-node')?.dataset.id;
    for (const p of svg.children) p.classList.toggle('hot', !!id && (p.dataset.a === id || p.dataset.b === id));
    svg.classList.toggle('hovering', !!id);
  });
  return () => ro.disconnect();
}
