/* ========================================================================== */
/*  CORTEX — нервная система компании на одном экране (canvas)                */
/*  Все 314 сотрудников — нейроны: люди-круги и цифровые-ромбы, собранные     */
/*  в 8 кластеров-отделов вокруг ядра. Синапсы соединяют конкретных людей.    */
/*  Импульс = задача; волна-дыхание идёт от ядра; гейт = импульс застревает.  */
/*  Колесо мыши — зум: довернул на отделе → провалился в его пульс.           */
/*  API: const cx = cortexMap(stage, opts) → методы внизу файла.              */
/* ========================================================================== */

function cortexMap(stage, opts){
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'cx-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;                 // мир = css-пиксели сцены
  let k = 1, ox = 0, oy = 0;        // зум и сдвиг (мир → экран: s = w*k + o)
  let alive = true, t = 0, last = performance.now();

  /* --- данные ------------------------------------------------------------ */
  const clusters = opts.clusters;   // [{id,label,icon,color,people[],digital[],hc,dhc}]
  const nodes = [];                 // {x0,y0,x,y,r,type,named,color,ci,ref,phase,flash}
  const byCluster = {};             // id → {c, center:[x,y], R, nodes:[indices]}
  const impulses = [];              // живые задачи в полёте
  let wave = null;                  // волна-дыхание от ядра
  const labels = {};                // DOM-чипы кластеров

  const GOLD = Math.PI * (3 - Math.sqrt(5)); // филлотаксис

  /* геометрия кластера: люди — ядро, цифровой рой — кольцо вокруг */
  function clusterGeom(c){
    const Rh = 13 + Math.sqrt(c.people.length) * 7.4;
    const Rd = Rh + 8 + Math.min(14, c.digital.length * 0.16);
    return { Rh, Rd, R: Rd + 5 };
  }

  function buildCluster(c, gx, gy, scale){
    const g = clusterGeom(c);
    const Rh = g.Rh * scale, Rd = g.Rd * scale;
    const entry = { c, center: [gx, gy], R: g.R * scale, nodes: [] };
    byCluster[c.id] = entry;
    const push = (ref, type, named, x, y, r) => {
      const idx = nodes.length;
      nodes.push({ x0: x, y0: y, x, y, r, type, named,
        color: type === 'h' ? c.color : '#36c994', ci: c.id, ref: ref || {},
        phase: (idx * 0.61) % (Math.PI * 2), flash: 0 });
      entry.nodes.push(idx);
    };
    const nH = c.people.length;
    c.people.forEach((p, i) => {
      const rr = Rh * Math.sqrt((i + 0.55) / nH);
      const a = i * GOLD + gx * 0.01;
      push(p, 'h', !!p.named, gx + Math.cos(a) * rr, gy + Math.sin(a) * rr * 0.92,
        (p.named ? 4.6 : 2.7) * Math.max(0.8, scale));
    });
    const nD = c.digital.length;
    c.digital.forEach((d, i) => {
      const a = i / nD * Math.PI * 2 + gy * 0.013;
      const rr = Rd + ((i % 2) ? -4 : 3);
      push(d, 'd', !!d.named, gx + Math.cos(a) * rr, gy + Math.sin(a) * rr * 0.9,
        (d.named ? 3.9 : 2.3) * Math.max(0.8, scale));
    });
    return entry;
  }

  function layout(){
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height; if (!W) return;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    nodes.length = 0;
    const cx0 = W / 2, cy0 = H / 2;
    /* эллипс считается от размера кластеров — всё гарантированно в кадре */
    const maxR0 = Math.max(...clusters.map(c => clusterGeom(c).R));
    const CHIP = 64;                              // место под чип-подпись (две строки + отступ)
    let scale = 1, RY = H / 2 - maxR0 - CHIP;
    if (RY < 140){ scale = Math.max(0.55, (H / 2 - CHIP - 140) / maxR0); RY = H / 2 - maxR0 * scale - CHIP; }
    RY = Math.max(118, RY);
    const RX = Math.max(200, Math.min(W / 2 - maxR0 * scale - 80, 660));
    clusters.forEach((c, i) => {
      const a = -Math.PI / 2 + i / clusters.length * Math.PI * 2;
      const rf = (i % 2) ? 0.86 : 1;
      buildCluster(c, cx0 + Math.cos(a) * RX * rf, cy0 + Math.sin(a) * RY * rf, scale);
    });
    if (opts.coreEl){ opts.coreEl.style.left = cx0 + 'px'; opts.coreEl.style.top = cy0 + 'px'; }
  }

  /* DOM-чипы кластеров (кликабельные подписи отделов) */
  clusters.forEach(c => {
    const el = document.createElement('button');
    el.className = 'cx-label'; el.style.setProperty('--c', c.color);
    el.innerHTML = `<b>${c.icon} ${c.label}</b><i>👤 ${c.hc} · 🤖 ${c.dhc}</i>`;
    el.title = 'Открыть пульс отдела';
    el.onclick = () => opts.onDive && opts.onDive(c.id);
    stage.appendChild(el); labels[c.id] = el;
  });

  /* подсказка зума */
  const hint = document.createElement('div');
  hint.className = 'cx-hint';
  hint.textContent = 'колесо мыши — приблизиться · докрутите на отделе, чтобы нырнуть в его пульс';
  stage.appendChild(hint);

  /* тултип нейрона */
  const tip = document.createElement('div');
  tip.className = 'cx-tip'; tip.style.display = 'none';
  stage.appendChild(tip);

  /* --- геометрия --------------------------------------------------------- */
  const coreC = () => [W / 2, H / 2];
  function synCurve(A, B){
    const [ccx, ccy] = coreC();
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    let dx = mx - ccx, dy = my - ccy;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const push = 70 + 9000 / (dl + 60);
    return [mx + dx * push, my + dy * push];
  }
  const qPoint = (A, C, B, tt) => {
    const u = 1 - tt;
    return [u * u * A[0] + 2 * u * tt * C[0] + tt * tt * B[0],
            u * u * A[1] + 2 * u * tt * C[1] + tt * tt * B[1]];
  };

  function findNode(clusterId, name, type){
    const e = byCluster[clusterId]; if (!e) return null;
    const list = e.nodes.filter(i => nodes[i].named && (!type || nodes[i].type === type));
    if (name){ const hit = list.find(i => nodes[i].ref.name === name); if (hit != null) return hit; }
    if (!list.length) return e.nodes[0];
    return list[(Math.random() * list.length) | 0];
  }
  function randNode(clusterId, namedOnly){
    const e = byCluster[clusterId]; if (!e) return null;
    const pool = namedOnly ? e.nodes.filter(i => nodes[i].named) : e.nodes;
    return pool[(Math.random() * pool.length) | 0];
  }

  /* --- импульсы ----------------------------------------------------------- */
  function impulse(ai, bi, o){
    o = o || {};
    if (ai == null || bi == null) return Promise.resolve(false);
    const A = [nodes[ai].x0, nodes[ai].y0], B = [nodes[bi].x0, nodes[bi].y0];
    const C = o.viaCore !== false && nodes[ai].ci !== nodes[bi].ci ? synCurve(A, B)
      : [(A[0] + B[0]) / 2 + (B[1] - A[1]) * 0.18, (A[1] + B[1]) / 2 - (B[0] - A[0]) * 0.18];
    return new Promise(res => {
      impulses.push({ A, C, B, t: 0, dur: o.dur || (nodes[ai].ci === nodes[bi].ci ? 1.4 : 2.3),
        color: o.color || nodes[ai].color, label: o.label || '', size: o.size || 3.4,
        stuck: !!o.stuck, stuckAt: 0.56, ttl: 0, bi, done: ok => res(ok) });
    });
  }
  function corePulse(clusterId, label, color){
    const bi = randNode(clusterId);
    if (bi == null) return;
    const [ccx, ccy] = coreC();
    const B = [nodes[bi].x0, nodes[bi].y0];
    impulses.push({ A: [ccx, ccy], C: [(ccx + B[0]) / 2 + (B[1] - ccy) * 0.15, (ccy + B[1]) / 2 - (B[0] - ccx) * 0.15],
      B, t: 0, dur: 1.6, color: color || byCluster[clusterId].c.color, label: label || '', size: 3.2,
      stuck: false, ttl: 0, bi, done: () => {} });
  }

  /* --- отрисовка ----------------------------------------------------------- */
  function draw(dt){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(ox, oy); ctx.scale(k, k);

    const [ccx, ccy] = coreC();

    /* спицы ядро → кластеры */
    ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
    clusters.forEach(c => { const e = byCluster[c.id];
      ctx.strokeStyle = c.color; ctx.globalAlpha = 0.10;
      ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(e.center[0], e.center[1]); ctx.stroke(); });
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    /* межкластерные синапсы (толщина = объём передач) */
    (opts.synapses || []).forEach(s => {
      const ea = byCluster[s.a], eb = byCluster[s.b]; if (!ea || !eb) return;
      const A = ea.center, B = eb.center, C = synCurve(A, B);
      ctx.strokeStyle = '#34d399';
      ctx.globalAlpha = 0.06 + s.w / 320 + Math.sin(t * 0.8 + s.w) * 0.015;
      ctx.lineWidth = Math.max(0.8, Math.min(5, s.w * 0.13));
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(C[0], C[1], B[0], B[1]); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* ореолы кластеров */
    clusters.forEach(c => { const e = byCluster[c.id];
      const g = ctx.createRadialGradient(e.center[0], e.center[1], e.R * 0.2, e.center[0], e.center[1], e.R * 1.45);
      g.addColorStop(0, c.color + '14'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.center[0], e.center[1], e.R * 1.45, 0, 7); ctx.fill();
      if (opts.gated && opts.gated(c.id)){
        ctx.strokeStyle = '#f87171'; ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.15;
        ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(e.center[0], e.center[1], e.R + 9, 0, 7); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      } });

    /* волна-дыхание */
    if (wave){
      wave.r += dt * 170;
      ctx.strokeStyle = 'rgba(54,201,148,.16)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(ccx, ccy, wave.r, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(54,201,148,.30)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ccx, ccy, wave.r, 0, 7); ctx.stroke();
      if (wave.r > Math.hypot(W, H) * 0.62) wave = null;
    }

    /* нейроны */
    nodes.forEach(n => {
      n.x = n.x0 + Math.sin(t * 0.7 + n.phase) * 1.7;
      n.y = n.y0 + Math.cos(t * 0.55 + n.phase * 1.3) * 1.7;
      let glow = n.flash;
      if (wave){ const d = Math.abs(Math.hypot(n.x - ccx, n.y - ccy) - wave.r); if (d < 46) glow = Math.max(glow, 0.55 * (1 - d / 46)); }
      if (n.flash > 0) n.flash = Math.max(0, n.flash - dt * 1.6);
      if (glow > 0.02){
        ctx.fillStyle = n.color; ctx.globalAlpha = 0.30 * glow;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7 * glow, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = n.named ? 0.95 : 0.55;
      ctx.fillStyle = n.color;
      if (n.type === 'h'){ ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill(); }
      else { ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-n.r, -n.r, n.r * 2, n.r * 2); ctx.restore(); }
      ctx.globalAlpha = 1;
    });

    /* семантический зум: приблизился — проявились имена живых сотрудников */
    if (k > 1.4){
      const aN = Math.min(1, (k - 1.4) / 0.45);
      ctx.font = '600 9.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(18,19,16,.85)';
      nodes.forEach(n => { if (!n.named || !n.ref.name) return;
        ctx.globalAlpha = aN * 0.92;
        ctx.strokeText(n.ref.name, n.x, n.y + n.r + 10);
        ctx.fillStyle = '#e6e7e0'; ctx.fillText(n.ref.name, n.x, n.y + n.r + 10);
      });
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    /* подсвеченный нейрон под курсором */
    if (hover != null){ const n = nodes[hover];
      ctx.strokeStyle = '#f1f0ea'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }

    /* импульсы */
    for (let i = impulses.length - 1; i >= 0; i--){
      const p = impulses[i];
      if (p.stuck && p.t >= p.stuckAt){
        p.ttl += dt;
        const P = qPoint(p.A, p.C, p.B, p.stuckAt);
        const blink = 0.4 + Math.abs(Math.sin(p.ttl * 6)) * 0.6;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#f87171'; ctx.shadowColor = '#f87171'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(P[0], P[1], 4.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        drawImpLabel(P, p.label || '⛔ гейт закрыт', '#f87171', blink);
        ctx.globalAlpha = 1;
        if (p.ttl > 2.4){ p.done(false); impulses.splice(i, 1); }
        continue;
      }
      p.t += dt / p.dur;
      if (p.t >= 1){
        if (p.bi != null) nodes[p.bi].flash = 1;
        p.done(true); impulses.splice(i, 1);
        if (opts.onArrive) opts.onArrive(p);
        continue;
      }
      const P = qPoint(p.A, p.C, p.B, p.t);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(P[0], P[1], p.size, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (p.label && p.t > 0.08 && p.t < 0.92) drawImpLabel(P, p.label, p.color, 1);
    }

    /* DOM-чипы кластеров двигаются вместе с зумом */
    clusters.forEach(c => { const e = byCluster[c.id]; const el = labels[c.id];
      el.style.left = (e.center[0] * k + ox) + 'px';
      el.style.top = ((e.center[1] - e.R - 13) * k + oy) + 'px'; });
    if (opts.coreEl){
      opts.coreEl.style.left = (ccx * k + ox) + 'px';
      opts.coreEl.style.top = (ccy * k + oy) + 'px';
      opts.coreEl.style.setProperty('--zoom', k.toFixed(3));
    }
  }
  function drawImpLabel(P, text, color, alpha){
    ctx.font = '600 10.5px Inter, sans-serif';
    const wT = ctx.measureText(text).width;
    ctx.globalAlpha = 0.88 * alpha;
    ctx.fillStyle = 'rgba(18,19,16,.92)'; ctx.strokeStyle = color; ctx.lineWidth = 0.8;
    const x = P[0] + 9, y = P[1] - 19, h = 16;
    ctx.beginPath(); ctx.roundRect(x, y, wT + 12, h, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1f0ea'; ctx.fillText(text, x + 6, y + 11.5);
    ctx.globalAlpha = 1;
  }

  /* --- цикл ---------------------------------------------------------------- */
  function frame(now){
    if (!alive) return;
    if (!document.body.contains(canvas)){ destroy(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (W) draw(dt);
    requestAnimationFrame(frame);
  }

  /* --- взаимодействие ------------------------------------------------------ */
  let hover = null, dragging = false, moved = 0, mx = 0, my = 0;
  const world = (e) => { const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left - ox) / k, (e.clientY - r.top - oy) / k]; };
  function hitNode(wx, wy){
    let best = null, bd = 81; // радиус ловли 9px
    nodes.forEach((n, i) => { const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
      const rr = (n.r + 6) ** 2; if (d < rr && d < bd){ best = i; bd = d; } });
    return best;
  }
  canvas.addEventListener('mousemove', e => {
    const [wx, wy] = world(e);
    if (dragging){ ox += e.clientX - mx; oy += e.clientY - my; mx = e.clientX; my = e.clientY; moved += 2; return; }
    hover = hitNode(wx, wy);
    canvas.style.cursor = hover != null ? 'pointer' : (k > 1 ? 'grab' : 'default');
    if (hover != null){ const n = nodes[hover];
      tip.style.display = 'block';
      tip.style.left = (n.x * k + ox) + 'px'; tip.style.top = ((n.y - n.r - 8) * k + oy) + 'px';
      tip.innerHTML = n.named
        ? `<b>${n.ref.name}</b><small>${n.ref.sub || ''}${n.ref.now ? ' · сейчас: ' + n.ref.now : ''}</small><i>клик — профиль</i>`
        : `<b>${n.type === 'h' ? 'Специалист' : 'Типовой цифровой'}</b><small>${byCluster[n.ci].c.label}${n.ref && n.ref.sub ? ' · ' + n.ref.sub : ''}</small><i>клик — команда отдела</i>`;
    } else tip.style.display = 'none';
  });
  canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; hover = null; });
  canvas.addEventListener('mousedown', e => { if (k > 1){ dragging = true; moved = 0; mx = e.clientX; my = e.clientY; canvas.style.cursor = 'grabbing'; } });
  window.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('click', e => {
    if (moved > 4){ moved = 0; return; }
    const [wx, wy] = world(e);
    const i = hitNode(wx, wy);
    if (i != null && opts.onNode){ opts.onNode(nodes[i]); }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const wx = (sx - ox) / k, wy = (sy - oy) / k;
    k = Math.max(1, Math.min(2.6, k * (e.deltaY < 0 ? 1.12 : 0.89)));
    ox = sx - wx * k; oy = sy - wy * k;
    if (k <= 1.01){ k = 1; ox = 0; oy = 0; }
    /* докрутил до упора над кластером → ныряем в пульс отдела */
    if (k >= 2.55 && opts.onDive){
      let best = null, bd = 1e9;
      clusters.forEach(c => { const e2 = byCluster[c.id];
        const d = (e2.center[0] - wx) ** 2 + (e2.center[1] - wy) ** 2; if (d < bd){ bd = d; best = c.id; } });
      if (best && bd < (byCluster[best].R + 130) ** 2){ k = 1; ox = 0; oy = 0; opts.onDive(best, true); }
    }
  }, { passive: false });

  const onResize = () => { k = 1; ox = 0; oy = 0; layout(); };
  window.addEventListener('resize', onResize);
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => { if (!W) layout(); }) : null;
  if (ro) ro.observe(stage);

  function destroy(){ alive = false; window.removeEventListener('resize', onResize); if (ro) ro.disconnect();
    impulses.forEach(p => p.done(false)); impulses.length = 0; }

  layout(); requestAnimationFrame(n => { last = n; layout(); frame(n); });

  return {
    impulse, corePulse, findNode, randNode,
    localPulse(clusterId, label){
      const e = byCluster[clusterId]; if (!e || e.nodes.length < 2) return;
      const a = randNode(clusterId), b = randNode(clusterId);
      if (a === b) return;
      return impulse(a, b, { label, color: nodes[a].color, dur: 1.2 });
    },
    surgeWave(){ wave = { r: 10 }; },
    nodeInfo(i){ return nodes[i]; },
    destroy,
  };
}
