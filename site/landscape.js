// Value-chain market map: one lane per industry, upstream → midstream → downstream columns of logo tiles.
const STAGES = [
  { id: 'up', name: '上游', en: 'Upstream' },
  { id: 'mid', name: '中游', en: 'Midstream' },
  { id: 'down', name: '下游', en: 'Downstream' },
];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createLandscape(root, { industries, logo, onHover, chainBtn = () => '' }) {
  let focus = null, hoverId = null, last = [];

  function tile(c) {
    const cls = ['tile', c.proN >= 4 ? 'big' : '', c.proN ? '' : 'lite'].filter(Boolean).join(' ');
    return `<a class="${cls}" href="#/c/${c.id}" data-id="${c.id}" title="${esc(c.name)}">
      <span class="tl">${logo(c)}</span><span class="tn">${esc(c.name)}</span>${c.proN >= 2 ? `<em class="tb" title="曼報 Pro 談過 ${c.proN} 篇" aria-label="曼報 Pro 談過 ${c.proN} 篇"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>${c.proN}</em>` : ''}${chainBtn(c)}</a>`;
  }

  function render(companies) {
    last = companies;
    const byInd = new Map(industries.map((i) => [i.id, []]));
    for (const c of companies) byInd.get(c.industry)?.push(c);
    const rank = (a, b) => b.proN - a.proN || b.src.length - a.src.length || a.name.localeCompare(b.name);
    const lanes = industries.map((ind, n) => {
      const list = byInd.get(ind.id) ?? [];
      if (!list.length) return '';
      const segs = ind.segments ?? [];
      const cells = STAGES.map((st) => {
        const html = segs.filter((g) => g.stage === st.id).map((g) => {
          const cs = list.filter((c) => (c.segment ?? segs.at(-1)?.id) === g.id).sort(rank);
          return cs.length ? `<div class="seg"><h4>${esc(g.name)}<span>${cs.length}</span></h4><div class="tiles">${cs.map(tile).join('')}</div></div>` : '';
        }).join('');
        return `<div class="cell s-${st.id}${html ? "" : " empty"}"><span class="stage-tag">${st.name}</span>${html}</div>`;
      }).join('');
      return `<section class="lane" id="lane-${ind.id}" data-lane="${ind.id}" style="--c1:${ind.c1};--c2:${ind.c2};--n:${n}" aria-label="${esc(ind.name)}">
        <header class="lane-name"><b>${esc(ind.name)}</b><i>${esc(ind.en)}</i><span>${list.length} 家</span></header>${cells}</section>`;
    }).join('');
    const shown = industries.filter((ind) => (byInd.get(ind.id) ?? []).length);
    root.innerHTML = `<nav class="jump" aria-label="跳到產業">${shown.map((ind) => `<a href="#lane-${ind.id}" data-lane="${ind.id}" style="--c1:${ind.c1}"><i></i>${esc(ind.name)}<span>${byInd.get(ind.id).length}</span></a>`).join('')}</nav>
      <div class="chain-cols" aria-hidden="true"><span></span>${STAGES.map((s) => `<span class="col-${s.id}"><b>${s.name}</b><i>${s.en}</i></span>`).join('')}<em class="legend-n"><em class="tb"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>8</em>＝曼報 Pro 談過的篇數</em></div>
      <div class="lanes">${lanes || '<p class="empty">目前的篩選條件下沒有公司</p>'}</div>`;
    apply();
    watchLanes();
  }

  // Tile shortcut straight into the supply-chain explorer
  const openChain = (e) => {
    const t = e.target.closest('.tchain');
    if (!t) return false;
    e.preventDefault(); e.stopPropagation();
    location.hash = `#/chain/${t.dataset.chain}`;
    return true;
  };
  root.addEventListener('click', openChain, true);
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tchain')) openChain(e); });
  // Quick nav: smooth jump without touching the hash router, and mark the lane in view
  root.addEventListener('click', (e) => {
    const a = e.target.closest('.jump a');
    if (!a) return;
    e.preventDefault();
    const lane = root.querySelector(`#lane-${CSS.escape(a.dataset.lane)}`);
    const off = (document.querySelector('.top')?.offsetHeight ?? 60) + (root.querySelector('.jump')?.offsetHeight ?? 0) + 12;
    scrollTo({ top: lane.getBoundingClientRect().top + scrollY - off, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  let io = null;
  function watchLanes() {
    io?.disconnect();
    io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) {
        const id = e.target.dataset.lane;
        for (const a of root.querySelectorAll('.jump a')) a.classList.toggle('on', a.dataset.lane === id);
        root.querySelector(`.jump a[data-lane="${CSS.escape(id)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
    }, { rootMargin: '-35% 0px -60% 0px' });
    for (const l of root.querySelectorAll('.lane')) io.observe(l);
  }

  function apply() {
    // Hover only outlines related tiles; dimming is reserved for an explicit pick or search
    root.classList.toggle('focusing', !!focus);
    for (const el of root.querySelectorAll('.tile')) {
      const id = el.dataset.id;
      el.classList.toggle('cur', focus?.cur === id);
      el.classList.toggle('rel', !!(focus?.rel?.has(id) || hoverRel?.has(id)));
      el.classList.toggle('hit', !!focus?.match?.has(id));
    }
  }

  let hoverRel = null, hoverT = 0;
  root.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.tile');
    if (!el || e.pointerType === 'touch') return;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => { hoverId = el.dataset.id; hoverRel = onHover(hoverId); if (hoverRel.size) apply(); }, 90);
  });
  root.addEventListener('pointerout', (e) => {
    if (e.relatedTarget?.closest?.('.tile')) return;
    clearTimeout(hoverT);
    if (hoverId) { hoverId = null; hoverRel = null; apply(); }
  });

  let pending = null;
  function recenter(smooth) {
    if (!pending || performance.now() > pending.until) return (pending = null);
    const el = root.querySelector(`.tile[data-id="${CSS.escape(pending.id)}"]`);
    const calm = !smooth || matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  }
  new ResizeObserver(() => recenter(false)).observe(root);
  addEventListener('wheel', () => (pending = null), { passive: true });
  addEventListener('touchmove', () => (pending = null), { passive: true });

  return {
    setCompanies: render,
    setFocus(f) { focus = f; apply(); },
    refresh() { render(last); },
    reveal(id) {
      // Lanes reflow when the panel opens or logos load; keep re-centering until layout settles
      pending = { id, until: performance.now() + 1200 };
      requestAnimationFrame(() => recenter(true));
    },
  };
}
