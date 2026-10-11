// Zoomable circle-packing map: industries are bubbles, companies are bubbles inside.
import { hierarchy, pack, zoom, zoomIdentity, select, easeCubicInOut } from './vendor/d3.js';

const SIZE = 1000;
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = (name) => {
  const w = name.replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (w.length > 1 && !/^\p{Script=Han}/u.test(w[0]) ? w[0][0] + w[1][0] : [...(w[0] ?? '?')].slice(0, 2).join('')).toUpperCase();
};

export function createMap(root, { industries, weight, onPick, onHover, safeArea, prefersReduced }) {
  root.innerHTML = `<div class="bm-world"><div class="bm-ind"></div><svg class="bm-labels" aria-hidden="true"></svg><svg class="bm-lines" aria-hidden="true"><defs>
      <linearGradient id="bm-lg" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="var(--red-a)"/><stop offset="1" stop-color="var(--blue-b)"/></linearGradient></defs><g></g></svg>
    <div class="bm-nodes" role="list"></div></div><div class="bm-tip" hidden></div>
    <div class="bm-ctl"><button data-z="in" aria-label="放大" title="放大"></button><button data-z="out" aria-label="縮小" title="縮小"></button><button data-z="fit" aria-label="重設視角，顯示全部" title="顯示全部"></button></div>`;
  const indEl = root.querySelector('.bm-ind');
  const nodesEl = root.querySelector('.bm-nodes');
  const lines = root.querySelector('.bm-lines g');
  const tip = root.querySelector('.bm-tip');
  const labels = root.querySelector('.bm-labels');
  const world = root.querySelector('.bm-world');
  const queue = [];
  let W = 0, H = 0, t = zoomIdentity, nodes = [], groups = [], byId = new Map(), focus = null, raf = 0, first = true;

  let mix = 1; // 0..1 interpolation between old and new layout
  let td = zoomIdentity; // transform the DOM was last laid out with
  let settle = 0;
  const z = zoom().scaleExtent([0.4, 14])
    .on('start', () => { tip.hidden = true; root.classList.add('moving'); })
    .on('zoom', (e) => {
      t = e.transform;
      if (!W || mix < 1) return schedule();
      const s = t.k / td.k;
      world.style.transform = `translate(${t.x - td.x * s}px, ${t.y - td.y * s}px) scale(${s})`;
      clearTimeout(settle);
      settle = setTimeout(() => schedule(), 180);
    })
    .on('end', () => { clearTimeout(settle); root.classList.remove('moving'); schedule(); });
  const sel = select(root).call(z).on('dblclick.zoom', null);

  function layout(companies) {
    const data = { children: industries.map((i) => ({ ind: i, children: companies.filter((c) => c.industry === i.id).map((c) => ({ c })) })).filter((g) => g.children.length) };
    const h = hierarchy(data).sum((d) => (d.c ? weight(d.c) : 0)).sort((a, b) => b.value - a.value);
    pack().size([SIZE, SIZE]).padding((d) => (d.depth === 0 ? 18 : 3.5))(h);
    const prev = new Map(nodes.map((n) => [n.c.id, n]));
    groups = h.children ?? [];
    nodes = h.leaves().filter((l) => l.data.c).map((l) => {
      const p = prev.get(l.data.c.id);
      const words = l.data.c.name.split(/\s+/);
      return { c: l.data.c, word: Math.max(...words.map((w) => w.length)), len: [...l.data.c.name].reduce((a, ch) => a + (/[\u3000-\u9fff]/.test(ch) ? 1.8 : 1), 0), g: l.parent.data.ind, x: l.x, y: l.y, r: l.r, x0: p?.x ?? l.x, y0: p?.y ?? l.y, r0: p?.r ?? 0 };
    });
    byId = new Map(nodes.map((n) => [n.c.id, n]));
  }

  function build() {
    indEl.innerHTML = groups.map((g, n) => `<div class="bm-g" data-g="${g.data.ind.id}" role="button" aria-label="放大 ${esc(g.data.ind.name)}" style="--c1:${g.data.ind.c1};--c2:${g.data.ind.c2};--d:${n * 40}ms"></div>`).join('');
    // Arc labels: one <text> per glyph, placed along the bubble's top edge in draw()
    const glyphs = (str, cls) => [...str].map((ch) => ({ ch, cls, w: /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 15 : ch === ' ' ? 4 : /[A-Z&]/.test(ch) ? 8 : 6.6 }));
    labels.innerHTML = groups.map((g) => {
      g.gl = [...glyphs(g.data.ind.name, 'z'), { ch: '', cls: 'gap', w: 9 }, ...glyphs(g.data.ind.en, 'e')];
      return `<g style="--c1:${g.data.ind.c1}">${g.gl.map((x) => `<text class="${x.cls}" text-anchor="middle">${esc(x.ch)}</text>`).join('')}</g>`;
    }).join('');
    groups.forEach((g, i) => { g.lab = labels.children[i]; g.gl.forEach((x, j) => (x.el = g.lab.children[j])); });
    nodesEl.innerHTML = nodes.map((n) => {
      const c = n.c, d = Math.round(Math.hypot(n.x - SIZE / 2, n.y - SIZE / 2) * 1.1);
      const logo = c.logo?.url ? `<img crossorigin="anonymous" src="${esc(c.logo.url)}" alt="" loading="lazy" decoding="async">` : '';
      return `<button class="bm-n${logo ? ' has-logo' : ''}${c.proN ? '' : ' lite'}" role="listitem" data-id="${c.id}" data-name="${esc(c.name)}" aria-label="${esc(c.name)}${c.zh ? ` ${esc(c.zh)}` : ''}" style="--c1:${n.g.c1};--c2:${n.g.c2};--d:${d}ms">
        <span class="bm-in">${logo}<span class="bm-ini">${esc(initials(c.name))}</span><span class="bm-nm">${esc(c.name)}</span><span class="bm-zh">${esc(c.zh && c.zh !== c.name ? c.zh : '')}</span></span></button>`;
    }).join('');
    for (const el of nodesEl.children) byId.get(el.dataset.id).el = el;
    groups.forEach((g, i) => (g.el = indEl.children[i]));
    root.classList.toggle('intro', first && !prefersReduced());
    first = false;
    applyFocus();
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }
  function draw() {
    raf = 0;
    td = t;
    world.style.transform = '';
    const k = t.k;
    for (const g of groups) {
      const r = g.r * k, s = g.el.style;
      s.transform = `translate(${t.applyX(g.x) - r}px, ${t.applyY(g.y) - r}px)`;
      s.width = s.height = `${2 * r}px`;
      const on = r > 46, full = r > 120;
      g.lab.classList.toggle('on', on);
      if (on) {
        const cx = t.applyX(g.x), cy = t.applyY(g.y), R = r + 9;
        const shown = full ? g.gl : g.gl.filter((x) => x.cls === 'z');
        const total = shown.reduce((a, x) => a + x.w, 0);
        let acc = 0;
        for (const x of g.gl) x.el.style.display = shown.includes(x) ? '' : 'none';
        for (const x of shown) {
          const a = -Math.PI / 2 + (acc + x.w / 2 - total / 2) / R;
          x.el.setAttribute('transform', `translate(${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}) rotate(${((a * 180) / Math.PI + 90).toFixed(1)})`);
          acc += x.w;
        }
      }
    }
    for (const n of nodes) {
      const x = n.x0 + (n.x - n.x0) * mix, y = n.y0 + (n.y - n.y0) * mix, rr = n.r0 + (n.r - n.r0) * mix;
      const r = rr * k, s = n.el.style;
      n.sx = t.applyX(x); n.sy = t.applyY(y); n.sr = r;
      s.transform = `translate(${n.sx - r}px, ${n.sy - r}px)`;
      s.width = s.height = `${2 * r}px`;
      // Shrink the name until its longest word and two lines fit inside the circle
      const fs = Math.min(Math.min(18, Math.max(9.5, r / 3.4)), (1.75 * r) / (n.word * 0.56), (2 * 1.5 * r) / (n.len * 0.56));
      const tier = r < 7 ? 0 : r >= 16 && fs >= 8.5 ? (r >= 46 ? 3 : 2) : 1;
      if (n.tier !== tier) { n.el.dataset.t = tier; n.tier = tier; }
      if (Math.abs((n.fs ?? 0) - fs) > 0.25) { s.setProperty('--fs', `${fs}px`); n.fs = fs; }
      // Focused bubbles grow to a readable size whatever the zoom
      const boost = Math.max(1, 22 / Math.max(r, 1));
      if (n.boost !== boost) { s.setProperty('--boost', boost.toFixed(2)); n.boost = boost; }
    }
    drawLines();
  }

  let links = [];
  function buildLines() {
    const cur = focus?.cur && byId.get(focus.cur);
    links = cur ? [...(focus.rel ?? [])].map((id) => byId.get(id)).filter(Boolean).map((o) => [cur, o]) : [];
    lines.innerHTML = links.map((_, i) => `<path pathLength="1" style="--i:${i}"/>`).join('');
    drawLines();
  }
  function drawLines() {
    links.forEach(([a, o], i) => {
      if (a.sx == null || o.sx == null) return schedule(); // not drawn yet
      const mx = (a.sx + o.sx) / 2, my = (a.sy + o.sy) / 2, dx = o.sx - a.sx, dy = o.sy - a.sy, bend = 0.22 * (i % 2 ? -1 : 1);
      lines.children[i]?.setAttribute('d', `M${a.sx},${a.sy} Q${mx - dy * bend},${my + dx * bend} ${o.sx},${o.sy}`);
    });
  }

  function applyFocus() {
    root.classList.toggle('focusing', !!focus);
    for (const n of nodes) {
      const id = n.c.id, cl = n.el.classList;
      cl.toggle('cur', focus?.cur === id);
      cl.toggle('rel', !!focus?.rel?.has(id));
      cl.toggle('hit', !!focus?.match?.has(id));
    }
    buildLines();
  }

  // Visible region excludes overlays (title card / side panel)
  function view() {
    const a = safeArea(W, H);
    return { x: a.left, y: a.top, w: W - a.left - a.right, h: H - a.top - a.bottom };
  }
  function fitBox(x0, y0, x1, y1, maxK = 14, dur = 750) {
    const v = view(), pad = 28;
    const k = Math.min(maxK, (v.w - pad * 2) / (x1 - x0), (v.h - pad * 2) / (y1 - y0));
    const tr = zoomIdentity.translate(v.x + v.w / 2, v.y + v.h / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (prefersReduced() || !dur ? sel : sel.transition().duration(dur).ease(easeCubicInOut)).call(z.transform, tr);
  }
  const fitAll = (dur) => { const g = groups.length ? groups : [{ x: SIZE / 2, y: SIZE / 2, r: SIZE / 2 }]; fitBox(Math.min(...g.map((n) => n.x - n.r)), Math.min(...g.map((n) => n.y - n.r)), Math.max(...g.map((n) => n.x + n.r)), Math.max(...g.map((n) => n.y + n.r)), 14, dur); };

  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    for (const v of root.querySelectorAll('.bm-labels, .bm-lines')) v.setAttribute('viewBox', `0 0 ${W} ${H}`);
    schedule();
  }
  new ResizeObserver(() => {
    if (!root.clientWidth) return;
    const f = !W; resize();
    if (f) { fitAll(0); queue.splice(0).forEach((fn) => fn()); }
  }).observe(root);
  const whenReady = (fn) => (W ? fn() : queue.push(fn));

  // Events
  nodesEl.addEventListener('click', (e) => { const id = e.target.closest('.bm-n')?.dataset.id; if (id) onPick(id); });
  indEl.addEventListener('click', (e) => {
    const id = e.target.closest('.bm-g')?.dataset.g, g = groups.find((x) => x.data.ind.id === id);
    if (g) fitBox(g.x - g.r, g.y - g.r, g.x + g.r, g.y + g.r);
  });
  nodesEl.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.bm-n');
    if (!el || e.pointerType === 'touch') return;
    const n = byId.get(el.dataset.id);
    tip.innerHTML = onHover(n.c);
    tip.hidden = false;
    const r = root.getBoundingClientRect(), tw = tip.offsetWidth;
    tip.style.transform = `translate(${Math.min(W - tw - 8, Math.max(8, n.sx - tw / 2))}px, ${n.sy - n.sr - tip.offsetHeight - 10 < 8 ? n.sy + n.sr + 10 : n.sy - n.sr - tip.offsetHeight - 10}px)`;
    void r;
  });
  nodesEl.addEventListener('pointerout', (e) => { if (!e.relatedTarget?.closest?.('.bm-n')) tip.hidden = true; });
  root.querySelector('.bm-ctl').addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.z;
    if (a === 'fit') fitAll();
    else if (a) sel.transition().duration(300).call(z.scaleBy, a === 'in' ? 1.6 : 1 / 1.6);
  });
  root.addEventListener('pointerdown', () => { tip.hidden = true; });

  return {
    setCompanies(companies) {
      const had = nodes.length;
      layout(companies); build();
      if (!had) { mix = 1; schedule(); return; }
      mix = 0;
      const t0 = performance.now(), D = prefersReduced() ? 0 : 650;
      const step = (now) => { mix = D ? easeCubicInOut(Math.min(1, (now - t0) / D)) : 1; draw(); if (mix < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
    setFocus(f) { focus = f; applyFocus(); },
    refresh() { applyFocus(); },
    zoomTo(id) { whenReady(() => this._zoomTo(id)); },
    zoomToSet(ids) { whenReady(() => this._zoomToSet(ids)); },
    _zoomTo(id) {
      const n = byId.get(id);
      if (!n) return;
      const grp = groups.find((g) => g.data.ind.id === n.g.id);
      const pts = [n, grp, ...[...(focus?.rel ?? [])].map((r) => byId.get(r)).filter(Boolean)].filter(Boolean);
      const pad = 16;
      fitBox(Math.min(...pts.map((p) => p.x - p.r)) - pad, Math.min(...pts.map((p) => p.y - p.r)) - pad, Math.max(...pts.map((p) => p.x + p.r)) + pad, Math.max(...pts.map((p) => p.y + p.r)) + pad, 70 / n.r);
    },
    _zoomToSet(ids) {
      const pts = ids.map((i) => byId.get(i)).filter(Boolean);
      if (!pts.length) return;
      const pad = 20;
      fitBox(Math.min(...pts.map((p) => p.x - p.r)) - pad, Math.min(...pts.map((p) => p.y - p.r)) - pad, Math.max(...pts.map((p) => p.x + p.r)) + pad, Math.max(...pts.map((p) => p.y + p.r)) + pad, 6);
    },
    fitAll: (d) => whenReady(() => fitAll(d)),
    has: (id) => byId.has(id),
  };
}
