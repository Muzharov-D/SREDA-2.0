/* ========================================================================== */
/*  NEURAL — движок нейронной карты Среды                                     */
/*  Нейроны = живые сотрудники (люди/цифровые/кластеры-отделы).               */
/*  Синапсы = передачи работы; толщина = объём, цвет = тип.                   */
/*  Импульс = конкретная задача: волна бежит по синапсу и «зажигает»          */
/*  принимающий нейрон; гейт = импульс застревает и мигает красным.           */
/*  API: const map = neuralMap(stage, {nodes, links, layout, onClick});       */
/*       map.impulse(a, b, {label, color, blocked, dur});  map.fire(id);     */
/* ========================================================================== */

function neuralMap(stage, opts){
  const NS = 'http://www.w3.org/2000/svg';
  /* бинарное кодирование сотрудников: ВСЕ люди — синие круги, ВСЕ цифровые — изумрудные ромбы.
     Отделы различаются подписями/кластерами/линиями, но не цветом людей. */
  const KIND_COLOR = { h: '#60a5fa', d: '#36c994' };
  const nodes = opts.nodes, links = opts.links || [];
  const byId = {}; nodes.forEach(n => byId[n.id] = n);
  const pos = {};            // id -> [x, y]
  const pathOf = {};         // 'a→b' -> path string (для импульсов)
  let alive = true;

  /* каркас: svg для синапсов + div-нейроны */
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'nm-links'); svg.setAttribute('preserveAspectRatio', 'none');
  stage.appendChild(svg);

  const nodeEls = {};
  nodes.forEach(n => {
    const el = document.createElement('div');
    el.className = `nm-node k-${n.kind || 'h'} st-${n.status || 'ok'}` + (n.cls ? ' ' + n.cls : '');
    el.dataset.id = n.id;
    el.style.setProperty('--c', KIND_COLOR[n.kind] || n.color || 'var(--acc)');
    if (n.size) el.style.setProperty('--sz', n.size + 'px');
    el.innerHTML = `<div class="nm-av">${n.av || ''}</div><b class="nm-name">${n.label || ''}</b>${n.sub ? `<small class="nm-sub">${n.sub}</small>` : ''}`;
    el.title = n.title || '';
    stage.appendChild(el);
    nodeEls[n.id] = el;
    if (opts.onClick) el.addEventListener('click', () => opts.onClick(n));
    /* ховер: подсветить все синапсы нейрона, остальные притушить */
    el.addEventListener('mouseenter', () => {
      svg.classList.add('dimmed');
      links.forEach((l, i) => { if (l.a === n.id || l.b === n.id){
        const p = svg.querySelector(`[data-l="${i}"]`); if (p) p.classList.add('hot');
        const other = nodeEls[l.a === n.id ? l.b : l.a]; if (other) other.classList.add('near');
      } });
    });
    el.addEventListener('mouseleave', () => {
      svg.classList.remove('dimmed');
      svg.querySelectorAll('.hot').forEach(p => p.classList.remove('hot'));
      stage.querySelectorAll('.nm-node.near').forEach(x => x.classList.remove('near'));
    });
  });

  function curve(a, b){
    const [ax, ay] = pos[a], [bx, by] = pos[b];
    const mx = (ax + bx) / 2 + (by - ay) * 0.14, my = (ay + by) / 2 - (bx - ax) * 0.14;
    return `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}`;
  }

  function draw(){
    const r = stage.getBoundingClientRect(); if (!r.width || !alive) return;
    const P = opts.layout(r.width, r.height);            // {id:[x,y]}
    nodes.forEach(n => { const p = P[n.id]; if (!p) return; pos[n.id] = p;
      nodeEls[n.id].style.left = p[0] + 'px'; nodeEls[n.id].style.top = p[1] + 'px'; });
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    svg.innerHTML = links.map((l, i) => {
      if (!pos[l.a] || !pos[l.b]) return '';
      const d = curve(l.a, l.b); pathOf[l.a + '→' + l.b] = d;
      const w = Math.max(1, Math.min(7, 1 + (l.w || 1) * 0.16));
      return `<path data-l="${i}" d="${d}" stroke="${l.color || 'rgba(154,160,150,.5)'}" stroke-width="${w}" stroke-opacity="${l.op != null ? l.op : 0.22}" fill="none" class="nm-syn"/>`;
    }).join('');
  }
  draw(); requestAnimationFrame(draw); setTimeout(draw, 160);
  const onResize = () => draw();
  window.addEventListener('resize', onResize);
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => draw()) : null;
  if (ro) ro.observe(stage);

  /* нейрон «возбуждается»: вспышка + всплывашка с текстом */
  function fire(id, label){
    const el = nodeEls[id]; if (!el) return;
    el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire');
    if (label){
      const pop = document.createElement('div'); pop.className = 'nm-pop';
      pop.textContent = label;
      pop.style.left = pos[id][0] + 'px'; pop.style.top = (pos[id][1] - 30) + 'px';
      stage.appendChild(pop);
      setTimeout(() => pop.classList.add('out'), 1700);
      setTimeout(() => pop.remove(), 2200);
    }
    setTimeout(() => el.classList.remove('fire'), 850);
  }

  /* импульс: задача бежит по синапсу; blocked = застревает на гейте */
  function impulse(a, b, o){
    o = o || {};
    if (!pos[a] || !pos[b] || !alive) return;
    const d = pathOf[a + '→' + b] || pathOf[b + '→' + a] || curve(a, b);
    const dur = o.dur || 1.5;
    const imp = document.createElement('div');
    imp.className = 'nm-imp' + (o.label ? ' lbl' : '') + (o.kind ? ' k-' + o.kind : '');
    imp.style.setProperty('--c', o.color || 'var(--acc)');
    imp.style.offsetPath = `path('${d}')`;
    if (o.label) imp.textContent = o.label;
    stage.appendChild(imp);
    if (o.blocked){
      /* волна доходит до середины синапса и застревает: гейт закрыт */
      requestAnimationFrame(() => { imp.style.transition = `offset-distance ${dur * 0.55}s cubic-bezier(.5,.05,.6,1)`; imp.style.offsetDistance = '54%'; });
      setTimeout(() => { imp.classList.add('stuck'); }, dur * 550);
      setTimeout(() => { imp.classList.add('out'); }, dur * 550 + 1500);
      setTimeout(() => imp.remove(), dur * 550 + 2000);
      const tgt = nodeEls[b]; if (tgt){ tgt.classList.add('gated'); setTimeout(() => tgt.classList.remove('gated'), dur * 550 + 1600); }
    } else {
      requestAnimationFrame(() => {
        imp.style.transition = `offset-distance ${dur}s cubic-bezier(.45,.05,.35,1), opacity .35s ${dur - 0.3}s`;
        imp.style.offsetDistance = '100%'; imp.style.opacity = '0';
      });
      setTimeout(() => { if (alive) fire(b, o.pop); }, dur * 1000 - 200);
      setTimeout(() => imp.remove(), dur * 1000 + 200);
    }
    /* синапс светится, пока по нему бежит сигнал */
    const li = links.findIndex(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    if (li >= 0){ const p = svg.querySelector(`[data-l="${li}"]`);
      if (p){ p.classList.add('live'); setTimeout(() => p.classList.remove('live'), dur * 1000); } }
  }

  function destroy(){ alive = false; window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); }
  return { impulse, fire, draw, destroy, pos, els: nodeEls };
}

/* раскладка «кластеры на эллипсе, участники вокруг центра кластера» -------- */
/* groups: [{id, items:[nodeId,…]}] → {nodeId:[x,y], '#'+groupId:[x,y]}      */
function neuralClusterLayout(W, H, groups, o){
  o = o || {};
  const cx = W / 2, cy = H / 2;
  const RX = Math.min(W * (o.rx || 0.36), o.rxMax || 560), RY = Math.min(H * (o.ry || 0.36), o.ryMax || 230);
  const P = {};
  /* МАЛЫЙ ОТДЕЛ (≤12 узлов, сколько бы ни было функций): эллипс-лейаут
     вырождается в кучи внутри групп — вместо него ОДНО широкое кольцо:
     участники идут по кольцу группами подряд, подпись каждой функции —
     снаружи кольца на срединном угле своей группы. Никто ни на ком не лежит. */
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  if (total <= 12){
    const mr = Math.max(170, Math.min(RX, RY * 1.4));
    const all = []; groups.forEach(g => g.items.forEach(id => all.push({ id, g: g.id })));
    const ang = i => -Math.PI / 2 + i / all.length * Math.PI * 2;
    all.forEach((m, i) => { const a = ang(i); P[m.id] = [cx + Math.cos(a) * mr, cy + Math.sin(a) * mr * 0.62]; });
    groups.forEach(g => {
      const idxs = all.map((m, i) => m.g === g.id ? i : -1).filter(i => i >= 0);
      if (!idxs.length){ P['#' + g.id] = [cx, cy]; return; }
      const a = ang(idxs.reduce((s, i) => s + i, 0) / idxs.length);
      P['#' + g.id] = [cx + Math.cos(a) * (mr + 74), cy + Math.sin(a) * (mr * 0.62 + 52)];
    });
    if (o.center) P[o.center] = [cx, cy];
    return P;
  }
  groups.forEach((g, gi) => {
    const a = -Math.PI / 2 + gi / groups.length * Math.PI * 2;
    const rf = groups.length > 6 && gi % 2 ? 0.78 : 1;
    const gx = groups.length === 1 ? cx : cx + Math.cos(a) * RX * rf;
    const gy = groups.length === 1 ? cy : cy + Math.sin(a) * RY * rf;
    P['#' + g.id] = [gx, gy];
    const n = g.items.length;
    const mr = o.memberR || (34 + Math.min(40, n * 6));
    g.items.forEach((id, i) => {
      /* одиночный участник — НЕ на подпись кластера, а над ней */
      if (n === 1){ P[id] = [gx, gy - Math.max(44, mr * 0.8)]; return; }
      const ma = -Math.PI / 2 + i / n * Math.PI * 2 + gi * 0.7;
      P[id] = [gx + Math.cos(ma) * mr, gy + Math.sin(ma) * mr * 0.82];
    });
  });
  if (o.center) P[o.center] = [cx, cy];
  return P;
}
