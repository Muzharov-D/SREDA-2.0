/* ==========================================================================
   KAM2 — вход через опрос, из которого собирается Среда.
   Философия: никто не знает, что хочет от Среды. Поэтому мы не спрашиваем
   «что тебе нужно» — мы спрашиваем про симптомы (что съедает время, когда
   узнаёшь о проблемах, сколько людей зависит), а из ответов набираются веса
   по 4 осям. По профилю осей собирается набор модулей. «Бери только нужное»:
   по умолчанию собрано ядро, остальное лежит в «Добавить в Среду».

   Активация: ?org=kam (флаг __ORG_KAM ставит org-kam.js). Этот файл подключён
   ПОСЛЕ app.js и забирает под себя #nav и #stage, не форкая движок.
   ========================================================================== */
(function(){
  if (!window.__ORG_KAM) return;
  const ORG = window.__ORG || {};
  const DASH = (typeof DASHBOARD !== 'undefined') ? DASHBOARD : {};
  const LS_KEY = 'sreda_kam2_profile_v1';

  /* ---------------------------------------------------------------- утилиты */
  const $  = (s, r) => (r||document).querySelector(s);
  const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'null'); } catch(e){ return null; } };
  const save = p  => { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch(e){} };
  const clamp01 = x => Math.max(0, Math.min(1, x));

  /* ---------------------------------------------------------------- 4 оси   */
  const AXES = {
    do:   { key:'do',   icon:'⚡', label:'Делаю',   desc:'Среда — руки: ставлю задачу, получаю результат' },
    watch:{ key:'watch',icon:'📡', label:'Слежу',   desc:'Среда — вышка: вижу, где горит и кто отвечает' },
    help: { key:'help', icon:'🗓️', label:'Помогает', desc:'Среда — ассистент: ведёт мой день, ничего не забывает' },
    build:{ key:'build',icon:'🧩', label:'Строю',   desc:'Среда — платформа: собираю команды и процессы' },
  };
  const AX = ['do','watch','help','build'];

  /* ---------------------------------------------------------------- опрос   */
  /* Каждый ответ добавляет веса по осям. Вопросы — про симптомы, не про хотелки. */
  const SURVEY = [
    { q:'Что сейчас съедает больше всего вашего рабочего времени?',
      opts:[
        { t:'Рутина, которую в принципе можно кому-то передать',   w:{do:2} },
        { t:'Разбираюсь, что происходит у команды и в отделах',    w:{watch:2} },
        { t:'Держу в голове десятки мелких дел и всех дёргаю',      w:{help:2} },
        { t:'Настраиваю, как всё вообще должно быть устроено',      w:{build:2} },
      ]},
    { q:'Когда что-то идёт не так, вы обычно узнаёте об этом…',
      opts:[
        { t:'Первым — держу руку на пульсе',                       w:{watch:2} },
        { t:'Слишком поздно — хочу узнавать раньше',               w:{watch:1, help:1} },
        { t:'Никак заранее — просто иду и разгребаю сам',          w:{do:2} },
        { t:'И сразу меняю процесс, чтобы не повторялось',         w:{build:2} },
      ]},
    { q:'Сколько людей по работе зависит от вас?',
      opts:[
        { t:'Только я сам',                                        w:{do:2, help:1} },
        { t:'Небольшая команда',                                   w:{help:1, watch:1} },
        { t:'Несколько отделов',                                   w:{watch:2} },
        { t:'Вся компания — я её, по сути, и собираю',             w:{build:2, watch:1} },
      ]},
    { q:'Идеальному помощнику вы бы в первую очередь доверили…',
      opts:[
        { t:'Делать задачи за меня целиком',                       w:{do:2} },
        { t:'Следить и вовремя докладывать',                       w:{watch:2} },
        { t:'Вести мой день и ничего не забывать',                 w:{help:2} },
        { t:'Собрать под меня команду и процессы',                 w:{build:2} },
      ]},
    { q:'«Хороший рабочий день» — это когда…',
      opts:[
        { t:'Много всего сделано руками',                          w:{do:2} },
        { t:'Ничего не сгорело, всё под контролем',                w:{watch:2} },
        { t:'Разгрёб всё, что висело',                             w:{help:2} },
        { t:'Настроил так, что дальше идёт само',                  w:{build:2} },
      ]},
    { q:'Насколько вам важно видеть, КАК именно всё было сделано?',
      depth:true,
      opts:[
        { t:'Дайте результат — в кухню я не полезу',               w:{}, depth:0 },
        { t:'Хочу видеть, кто сделал и на чём основано',           w:{}, depth:1 },
      ]},
  ];

  /* ---------------------------------------------------------------- модули  */
  /* axes — близость модуля к каждой оси; core — якорь оси (гарантируется).   */
  const MODULES = [
    { id:'today',       icon:'🗓️', name:'Мой день',            hint:'что ждёт меня прямо сейчас',
      axes:{help:3, do:1, watch:1}, core:'help', render:renderToday },
    { id:'task',        icon:'⚡', name:'Поставить задачу',     hint:'опишите словами — рой разберёт',
      axes:{do:3, help:1}, core:'do', render:renderTask },
    { id:'intake',      icon:'📥', name:'Приёмка результатов',  hint:'что готово и ждёт вашего «ок»',
      axes:{do:2, watch:1}, render:renderIntake },
    { id:'pulse',       icon:'📡', name:'Пульс',                hint:'загрузка направлений и живая лента',
      axes:{watch:3}, core:'watch', render:renderPulse },
    { id:'flow',        icon:'🔗', name:'Путь по отделам',      hint:'кто кому что передаёт',
      axes:{watch:2, do:1}, render:renderFlow },
    { id:'sanctions',   icon:'🔐', name:'Решения и санкции',    hint:'где нужно ваше слово',
      axes:{watch:2, build:1}, render:renderSanctions },
    { id:'team',        icon:'👥', name:'Команда и отделы',     hint:'люди и их цифровые двойники',
      axes:{build:2, watch:1}, render:renderTeam },
    { id:'agents',      icon:'🤖', name:'Цифровые сотрудники',  hint:'штат агентов и их инструкции',
      axes:{build:2, do:1}, core:'build', render:renderAgents },
  ];

  /* ---------------------------------------------------------------- сборка  */
  function normalize(raw){
    const max = Math.max(1, ...AX.map(a=>raw[a]||0));
    const n = {}; AX.forEach(a=> n[a] = clamp01((raw[a]||0)/max)); return n;
  }
  function primaryAxis(prof){
    return AX.slice().sort((a,b)=> (prof[b]||0)-(prof[a]||0))[0];
  }
  function scoreModule(m, prof){
    let s=0; for(const a in m.axes){ s += (m.axes[a]||0) * (prof[a]||0); } return s;
  }
  /* из профиля -> упорядоченный список id модулей, попавших в сборку */
  function assemble(prof){
    const prim = primaryAxis(prof);
    const scored = MODULES.map(m=>({ m, s:scoreModule(m, prof) }))
                          .sort((a,b)=> b.s - a.s);
    const maxS = Math.max(1e-6, scored[0].s);
    const chosen = [];
    scored.forEach(({m,s})=>{
      const isCoreOfPrimary = (m.core === prim);
      if (isCoreOfPrimary || s >= maxS*0.42) chosen.push(m.id);
    });
    // гарантируем «Мой день» и «Поставить задачу» как минимальную опору
    ['today','task'].forEach(id=>{ if(!chosen.includes(id)) chosen.push(id); });
    // не заваливаем: не больше 5 в стартовой сборке
    return chosen.slice(0, 5);
  }

  /* ---------------------------------------------------------------- состояние */
  let profile = null;   // { raw:{}, norm:{}, depth:0|1, chosen:[ids] }
  let active  = null;   // текущий модуль id

  /* ---------------------------------------------------------------- стили   */
  function injectStyles(){
    if ($('#kam2Style')) return;
    const s = el('style'); s.id='kam2Style';
    s.textContent = `
    :root{ --k-bg:#121310; --k-panel:#1a1c17; --k-panel2:#20231c; --k-line:#2c3026;
      --k-txt:#e9e7de; --k-dim:#9a9b8f; --k-gold:#e8c468; --k-gold2:#f0d78a; }
    .k2-wrap{ display:flex; flex-direction:column; gap:18px; padding:22px 26px 60px; color:var(--k-txt); }
    /* ---- опрос ---- */
    .k2-survey{ position:fixed; inset:0; z-index:120; background:radial-gradient(1200px 600px at 70% -10%, #1c1f18 0%, #121310 60%);
      display:flex; align-items:center; justify-content:center; padding:24px; overflow:auto; }
    .k2-card{ width:min(680px,94vw); background:var(--k-panel); border:1px solid var(--k-line); border-radius:20px;
      padding:34px 34px 28px; box-shadow:0 30px 80px rgba(0,0,0,.5); }
    .k2-eyebrow{ color:var(--k-gold); font-size:12px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; }
    .k2-q{ font-size:23px; line-height:1.28; font-weight:700; margin:12px 0 22px; letter-spacing:-.01em; }
    .k2-opts{ display:flex; flex-direction:column; gap:11px; }
    .k2-opt{ text-align:left; background:var(--k-panel2); border:1px solid var(--k-line); color:var(--k-txt);
      border-radius:13px; padding:16px 18px; font-size:15.5px; line-height:1.35; cursor:pointer; transition:.14s; }
    .k2-opt:hover{ border-color:var(--k-gold); background:#262a20; transform:translateY(-1px); }
    .k2-progress{ display:flex; gap:6px; margin-top:24px; }
    .k2-dot{ flex:1; height:4px; border-radius:2px; background:var(--k-line); }
    .k2-dot.on{ background:var(--k-gold); }
    .k2-sub{ color:var(--k-dim); font-size:13.5px; margin-top:16px; }
    .k2-back{ background:none; border:none; color:var(--k-dim); font-size:13px; cursor:pointer; padding:6px 0; }
    .k2-back:hover{ color:var(--k-txt); }
    /* ---- результат сборки ---- */
    .k2-result h2{ font-size:26px; font-weight:800; letter-spacing:-.01em; margin:2px 0 4px; }
    .k2-axis-row{ display:flex; gap:10px; flex-wrap:wrap; margin:14px 0 6px; }
    .k2-axis{ display:flex; align-items:center; gap:8px; background:var(--k-panel2); border:1px solid var(--k-line);
      border-radius:999px; padding:7px 13px; font-size:13px; }
    .k2-axis b{ color:var(--k-gold); }
    .k2-bar{ width:64px; height:5px; border-radius:3px; background:var(--k-line); overflow:hidden; }
    .k2-bar i{ display:block; height:100%; background:var(--k-gold); }
    .k2-picked{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin:18px 0; }
    .k2-mod{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px; }
    .k2-mod .i{ font-size:22px; }
    .k2-mod .n{ font-weight:700; margin:8px 0 3px; }
    .k2-mod .h{ color:var(--k-dim); font-size:13px; line-height:1.4; }
    .k2-cta{ background:var(--k-gold); color:#1a1a12; border:none; font-weight:800; font-size:15px;
      border-radius:12px; padding:14px 26px; cursor:pointer; }
    .k2-cta:hover{ background:var(--k-gold2); }
    /* ---- кабинет ---- */
    .k2-nav{ display:flex; flex-direction:column; gap:4px; padding:10px; }
    .k2-nav-lbl{ color:var(--k-dim); font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:12px 12px 6px; }
    .k2-nav-item{ display:flex; align-items:center; gap:11px; padding:11px 12px; border-radius:11px; cursor:pointer;
      color:var(--k-txt); font-size:14.5px; border:1px solid transparent; }
    .k2-nav-item:hover{ background:var(--k-panel2); }
    .k2-nav-item.on{ background:var(--k-panel2); border-color:var(--k-line); }
    .k2-nav-item .ni{ font-size:17px; width:22px; text-align:center; }
    .k2-nav-item small{ display:block; color:var(--k-dim); font-size:11.5px; }
    .k2-add{ margin-top:8px; color:var(--k-gold); font-size:13px; cursor:pointer; padding:11px 12px; border:1px dashed var(--k-line); border-radius:11px; }
    .k2-add:hover{ background:var(--k-panel2); }
    .k2-head{ display:flex; align-items:baseline; gap:12px; margin-bottom:4px; }
    .k2-head h1{ font-size:22px; font-weight:800; letter-spacing:-.01em; }
    .k2-head .sub{ color:var(--k-dim); font-size:14px; }
    .k2-grid{ display:grid; gap:12px; }
    .k2-panel{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px 18px; }
    .k2-panel h3{ font-size:14px; font-weight:700; margin-bottom:12px; color:var(--k-txt); }
    .k2-item{ display:flex; align-items:flex-start; gap:12px; padding:11px 0; border-bottom:1px solid var(--k-line); }
    .k2-item:last-child{ border-bottom:none; }
    .k2-item .e{ font-size:19px; line-height:1.2; }
    .k2-item .b{ font-weight:600; font-size:14.5px; }
    .k2-item .m{ color:var(--k-dim); font-size:12.5px; margin-top:2px; }
    .k2-who{ color:var(--k-gold); font-size:12px; margin-top:3px; }
    .k2-tag{ display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid var(--k-line); color:var(--k-dim); }
    .k2-loadbar{ height:7px; border-radius:4px; background:var(--k-line); overflow:hidden; margin-top:6px; }
    .k2-loadbar i{ display:block; height:100%; }
    .k2-btn{ background:var(--k-gold); color:#1a1a12; border:none; font-weight:700; border-radius:10px; padding:11px 18px; cursor:pointer; }
    .k2-btn.ghost{ background:transparent; color:var(--k-txt); border:1px solid var(--k-line); }
    .k2-ta{ width:100%; min-height:120px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:12px;
      color:var(--k-txt); padding:14px; font-size:15px; resize:vertical; font-family:inherit; }
    .k2-chip{ display:inline-flex; gap:6px; align-items:center; background:var(--k-panel2); border:1px solid var(--k-line);
      border-radius:999px; padding:6px 12px; font-size:12.5px; margin:4px 6px 0 0; cursor:pointer; }
    .k2-chip:hover{ border-color:var(--k-gold); }
    .k2-reset{ position:fixed; bottom:16px; left:16px; z-index:60; background:var(--k-panel); border:1px solid var(--k-line);
      color:var(--k-dim); font-size:12px; border-radius:999px; padding:8px 14px; cursor:pointer; }
    .k2-reset:hover{ color:var(--k-txt); border-color:var(--k-gold); }
    .k2-agent{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px; margin-bottom:12px; }
    .k2-agent .ah{ display:flex; align-items:center; gap:11px; }
    .k2-agent .ah .e{ font-size:24px; }
    .k2-agent .ah b{ font-size:15px; }
    .k2-agent .ah small{ display:block; color:var(--k-dim); font-size:12px; }
    .k2-agent .mission{ font-size:14px; color:var(--k-txt); margin:12px 0; line-height:1.45; }
    .k2-agent ul{ margin:6px 0 6px 2px; padding:0; list-style:none; }
    .k2-agent li{ font-size:13px; color:var(--k-dim); padding:3px 0 3px 16px; position:relative; }
    .k2-agent li:before{ content:'·'; position:absolute; left:4px; color:var(--k-gold); }
    .k2-kpi{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .k2-kpi span{ background:var(--k-panel2); border:1px solid var(--k-line); border-radius:8px; padding:5px 9px; font-size:11.5px; }
    .k2-kpi b{ color:var(--k-gold); }
    `;
    document.head.appendChild(s);
  }

  /* ================================================================ ОПРОС  */
  function runSurvey(){
    injectStyles();
    let step = 0;
    const raw = {}; AX.forEach(a=> raw[a]=0);
    let depth = 1;

    const layer = el('div','k2-survey'); layer.id='k2Survey';
    document.body.appendChild(layer);

    function apply(w){ for(const a in w){ raw[a]=(raw[a]||0)+w[a]; } }

    function drawIntro(){
      layer.innerHTML='';
      const c = el('div','k2-card');
      c.innerHTML = `
        <div class="k2-eyebrow">Среда собирается под вас</div>
        <div class="k2-q">Никто заранее не знает, что ему нужно от Среды.<br>Поэтому мы не спросим «что вы хотите».</div>
        <div class="k2-sub">Ответьте на 6 коротких вопросов про вашу работу — и Среда соберёт себя сама. Лишнего не покажем: остальное всегда можно добрать.</div>
        <div style="margin-top:26px"><button class="k2-cta" id="k2Start">Начать · 6 вопросов ▶</button></div>`;
      layer.appendChild(c);
      $('#k2Start').onclick = ()=>{ step=0; drawStep(); };
    }

    function drawStep(){
      const s = SURVEY[step];
      layer.innerHTML='';
      const c = el('div','k2-card');
      const dots = SURVEY.map((_,i)=>`<div class="k2-dot ${i<=step?'on':''}"></div>`).join('');
      c.innerHTML = `
        <div class="k2-eyebrow">Вопрос ${step+1} из ${SURVEY.length}</div>
        <div class="k2-q">${esc(s.q)}</div>
        <div class="k2-opts" id="k2Opts"></div>
        <div class="k2-progress">${dots}</div>
        ${step>0?'<button class="k2-back" id="k2Back">← назад</button>':''}`;
      layer.appendChild(c);
      const box = $('#k2Opts', c);
      s.opts.forEach(o=>{
        const b = el('button','k2-opt', esc(o.t));
        b.onclick = ()=>{
          apply(o.w||{});
          if (s.depth) depth = o.depth;
          if (step < SURVEY.length-1){ step++; drawStep(); }
          else finish();
        };
        box.appendChild(b);
      });
      if (step>0) $('#k2Back',c).onclick = ()=>{ step--; drawStep(); };
    }

    function finish(){
      const norm = normalize(raw);
      profile = { raw, norm, depth, chosen: assemble(norm) };
      save(profile);
      drawResult();
    }

    function drawResult(){
      layer.innerHTML='';
      const c = el('div','k2-card k2-result');
      const prim = primaryAxis(profile.norm);
      const axisChips = AX.map(a=>{
        const v = Math.round((profile.norm[a]||0)*100);
        return `<div class="k2-axis">${AXES[a].icon} ${AXES[a].label}
          <span class="k2-bar"><i style="width:${v}%"></i></span></div>`;
      }).join('');
      const mods = profile.chosen.map(id=>{
        const m = MODULES.find(x=>x.id===id);
        return `<div class="k2-mod"><div class="i">${m.icon}</div>
          <div class="n">${esc(m.name)}</div><div class="h">${esc(m.hint)}</div></div>`;
      }).join('');
      c.innerHTML = `
        <div class="k2-eyebrow">Ваша Среда собрана</div>
        <h2>${AXES[prim].icon} ${AXES[prim].desc}</h2>
        <div class="k2-sub">Вот как распределились ваши ответы по осям Среды:</div>
        <div class="k2-axis-row">${axisChips}</div>
        <div class="k2-sub">Под это Среда включила ${profile.chosen.length} модуля. Остальное — в «Добавить в Среду», когда понадобится.</div>
        <div class="k2-picked">${mods}</div>
        <button class="k2-cta" id="k2Enter">Войти в мою Среду ▶</button>`;
      layer.appendChild(c);
      $('#k2Enter').onclick = ()=>{ layer.remove(); enterCabinet(); };
    }

    drawIntro();
  }

  /* ================================================================ КАБИНЕТ */
  function enterCabinet(){
    injectStyles();
    active = profile.chosen[0];
    // забираем nav и stage под себя
    renderNav2();
    renderActive();
    // репойнт брендовой кнопки и command-кнопки на нашу логику
    const brand = $('#brandHome'); if (brand){ brand.onclick = (e)=>{ e.preventDefault(); active=profile.chosen[0]; renderNav2(); renderActive(); }; }
    const cmd = $('#cmdBtn'); if (cmd){ cmd.onclick = (e)=>{ e.preventDefault(); if(!profile.chosen.includes('task')) addModule('task'); active='task'; renderNav2(); renderActive(); }; }
    // кнопка «пересобрать Среду»
    if (!$('#k2Reset')){
      const r = el('button','k2-reset','↺ пересобрать Среду'); r.id='k2Reset';
      r.onclick = ()=>{ localStorage.removeItem(LS_KEY); profile=null; location.hash=''; runSurvey(); };
      document.body.appendChild(r);
    }
  }

  function renderNav2(){
    const nav = $('#nav'); if(!nav) return;
    nav.innerHTML='';
    const wrap = el('div','k2-nav');
    wrap.innerHTML = `<div class="k2-nav-lbl">Моя Среда</div>`;
    profile.chosen.forEach(id=>{
      const m = MODULES.find(x=>x.id===id);
      const item = el('div','k2-nav-item'+(id===active?' on':''),
        `<span class="ni">${m.icon}</span><div><div>${esc(m.name)}</div><small>${esc(m.hint)}</small></div>`);
      item.onclick = ()=>{ active=id; renderNav2(); renderActive(); };
      wrap.appendChild(item);
    });
    const rest = MODULES.filter(m=>!profile.chosen.includes(m.id));
    if (rest.length){
      const add = el('div','k2-add', `+ Добавить в Среду (${rest.length})`);
      add.onclick = ()=> renderAddPanel(rest);
      wrap.appendChild(add);
    }
    nav.appendChild(wrap);
  }

  function addModule(id){
    if (!profile.chosen.includes(id)){ profile.chosen.push(id); save(profile); }
  }

  function renderAddPanel(rest){
    active = '__add';
    renderNav2();
    const stage = $('#stage'); if(!stage) return;
    stage.innerHTML='';
    const w = el('div','k2-wrap');
    w.innerHTML = `<div class="k2-head"><h1>Добавить в Среду</h1>
      <span class="sub">берите только то, что реально нужно — Среда не навязывает</span></div>`;
    const grid = el('div','k2-picked');
    rest.forEach(m=>{
      const card = el('div','k2-mod');
      card.style.cursor='pointer';
      card.innerHTML = `<div class="i">${m.icon}</div><div class="n">${esc(m.name)}</div>
        <div class="h">${esc(m.hint)}</div>
        <div style="margin-top:12px"><span class="k2-tag">+ добавить</span></div>`;
      card.onclick = ()=>{ addModule(m.id); active=m.id; renderNav2(); renderActive(); };
      grid.appendChild(card);
    });
    w.appendChild(grid);
    stage.appendChild(w);
  }

  function renderActive(){
    const stage = $('#stage'); if(!stage) return;
    const m = MODULES.find(x=>x.id===active);
    if (!m){ return; }
    stage.innerHTML='';
    const w = el('div','k2-wrap');
    stage.appendChild(w);
    m.render(w);
    const ann = $('#routeAnnounce'); if(ann) ann.textContent = m.name;
  }

  function head(title, sub){
    return `<div class="k2-head"><h1>${esc(title)}</h1><span class="sub">${esc(sub||'')}</span></div>`;
  }

  /* ================================================================ МОДУЛИ */
  const feed = () => (ORG.pulseFeed || []);
  const deptLabel = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.label:id; };
  const deptIcon  = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.icon:'•'; };

  /* --- Мой день: что ждёт меня (из ленты пульса, события людей 'h') -------- */
  function renderToday(w){
    const hero = (ORG.execPersona||'').split('·').pop().trim() || 'вас';
    w.innerHTML = head('Мой день', 'Среда собрала, что ждёт именно вас — не вся компания, а ваш стол');
    const waits = feed().filter(f=>f[0]==='h').slice(0,5);
    const drafts = feed().filter(f=>f[0]==='d').slice(0,4);
    const grid = el('div','k2-grid');
    grid.style.gridTemplateColumns='1fr 1fr';

    const p1 = el('div','k2-panel'); p1.innerHTML='<h3>Ждёт вашего слова</h3>';
    (DASH.approvals||[]).slice(0,4).forEach(a=>{
      p1.appendChild(rowEl('🔐', a.task, `${a.dept} · ${a.cost}`, null));
    });
    if(!(DASH.approvals||[]).length) waits.forEach(f=> p1.appendChild(rowEl('•', f[2], deptLabel(f[3]), f[1])));

    const p2 = el('div','k2-panel'); p2.innerHTML='<h3>Черновики от ваших цифровых сотрудников</h3>';
    drafts.forEach(f=> p2.appendChild(rowEl(deptIcon(f[3]), f[2], deptLabel(f[3]), profile.depth? f[1] : null)));

    grid.appendChild(p1); grid.appendChild(p2);
    w.appendChild(grid);
  }
  function rowEl(emoji, title, meta, who){
    const it = el('div','k2-item');
    it.innerHTML = `<div class="e">${emoji}</div><div><div class="b">${esc(title)}</div>
      <div class="m">${esc(meta||'')}</div>${who?`<div class="k2-who">подготовил: ${esc(who)}</div>`:''}</div>`;
    return it;
  }

  /* --- Поставить задачу ---------------------------------------------------- */
  function renderTask(w){
    w.innerHTML = head('Поставить задачу Среде', 'Опишите словами — оркестратор разберёт на подзадачи и подберёт исполнителей');
    const p = el('div','k2-panel');
    const ta = el('textarea','k2-ta'); ta.placeholder='Напр.: собери КП для банка «Гамма» к четвергу…';
    p.appendChild(ta);
    const ex = el('div'); ex.style.margin='12px 0';
    ['собрать КП к четвергу','подготовить статус-отчёт РЖД','проскорить новые лиды','сводка по воронке за неделю']
      .forEach(t=>{ const c=el('span','k2-chip','◆ '+t); c.onclick=()=>{ta.value=t;}; ex.appendChild(c); });
    p.appendChild(ex);
    const go = el('button','k2-btn','Запустить рой ▶');
    const out = el('div'); out.style.marginTop='16px';
    go.onclick = ()=>{
      const t = ta.value.trim(); if(!t){ ta.focus(); return; }
      out.innerHTML = `<div class="k2-panel"><h3>Среда разобрала задачу</h3>
        <div class="k2-item"><div class="e">🧩</div><div><div class="b">${esc(t)}</div>
        <div class="m">оркестратор подобрал 3 цифровых сотрудника из ваших отделов</div></div></div>
        <div class="k2-item"><div class="e">📈</div><div><div class="b">Продажи → черновик КП</div><div class="m">двойник менеджера · ~10 мин</div></div></div>
        <div class="k2-item"><div class="e">📣</div><div><div class="b">Маркетинг → battle card под клиента</div><div class="m">агент лидогенерации</div></div></div>
        <div class="k2-item"><div class="e">🔐</div><div><div class="b">Отправка — ждёт вашего «ок»</div><div class="m">санкция · только человек</div></div></div></div>`;
    };
    p.appendChild(go); p.appendChild(out);
    w.appendChild(p);
  }

  /* --- Приёмка результатов ------------------------------------------------- */
  function renderIntake(w){
    w.innerHTML = head('Приёмка результатов', 'Что цифровые сотрудники сделали и держат на вашей проверке');
    const p = el('div','k2-panel');
    feed().filter(f=>f[0]==='d').forEach(f=>{
      const it = el('div','k2-item');
      it.innerHTML = `<div class="e">${deptIcon(f[3])}</div><div style="flex:1"><div class="b">${esc(f[2])}</div>
        <div class="m">${esc(deptLabel(f[3]))}${profile.depth?` · ${esc(f[1])}`:''}</div></div>
        <div><span class="k2-tag" style="border-color:var(--k-gold);color:var(--k-gold)">принять</span></div>`;
      p.appendChild(it);
    });
    w.appendChild(p);
  }

  /* --- Пульс --------------------------------------------------------------- */
  function renderPulse(w){
    w.innerHTML = head('Пульс', 'Загрузка направлений и живая лента — вижу, где горит');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='1fr 1fr';
    const p1 = el('div','k2-panel'); p1.innerHTML='<h3>Загрузка направлений</h3>';
    const loadMap = ORG.load||{};
    (ORG.depts||[]).forEach(d=>{
      const v = loadMap[d.id]||0;
      const col = v>82?'#f0794a': v>70?'#e8c468':'#6bbf6b';
      const it = el('div'); it.style.padding='8px 0';
      it.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:13.5px">
        <span>${d.icon} ${esc(d.label)}</span><span style="color:${col}">${v}%</span></div>
        <div class="k2-loadbar"><i style="width:${v}%;background:${col}"></i></div>`;
      p1.appendChild(it);
    });
    const p2 = el('div','k2-panel'); p2.innerHTML='<h3>Живая лента</h3>';
    feed().slice(0,10).forEach(f=>{
      const tag = f[0]==='x'?'🔗': f[0]==='d'?'🤖':'🧑';
      p2.appendChild(rowEl(tag, f[2], (f[0]==='x'?f[1]:deptLabel(f[3])), null));
    });
    grid.appendChild(p1); grid.appendChild(p2);
    w.appendChild(grid);
  }

  /* --- Путь по отделам ----------------------------------------------------- */
  function renderFlow(w){
    w.innerHTML = head('Путь по отделам', 'Кто кому что передаёт — стыки, где теряется время');
    const p = el('div','k2-panel');
    feed().filter(f=>f[0]==='x').forEach(f=>{
      p.appendChild(rowEl('🔗', f[2], f[1], null));
    });
    // синтез по отделам как «что сейчас идёт»
    const p2 = el('div','k2-panel');
    p2.innerHTML='<h3>Что сейчас в работе по направлениям</h3>';
    (DASH.synthesis||[]).forEach(s=> p2.appendChild(rowEl(s.icon, s.text, s.dept, null)));
    w.appendChild(p); w.appendChild(p2);
  }

  /* --- Решения и санкции --------------------------------------------------- */
  function renderSanctions(w){
    w.innerHTML = head('Решения и санкции', 'Точки, где нужно ваше слово — и кто подготовил материал');
    const p = el('div','k2-panel');
    (DASH.approvals||[]).forEach(a=>{
      const riskCol = a.risk==='med'?'#e8c468': a.risk==='high'?'#f0794a':'#6bbf6b';
      const it = el('div','k2-item');
      it.innerHTML = `<div class="e">🔐</div><div style="flex:1"><div class="b">${esc(a.task)}</div>
        <div class="m">${esc(a.dept)} · ${esc(a.cost)} · <span style="color:${riskCol}">риск ${esc(a.risk)}</span></div></div>
        <div style="display:flex;gap:6px"><span class="k2-tag" style="border-color:var(--k-gold);color:var(--k-gold)">одобрить</span>
        <span class="k2-tag">отклонить</span></div>`;
      p.appendChild(it);
    });
    w.appendChild(p);
  }

  /* --- Команда и отделы ---------------------------------------------------- */
  function renderTeam(w){
    w.innerHTML = head('Команда и отделы', 'Люди и их цифровые двойники — весь штат департамента');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='repeat(auto-fill,minmax(300px,1fr))';
    (ORG.depts||[]).forEach(d=>{
      const p = el('div','k2-panel');
      const people = (ORG.team&&ORG.team[d.id])||[];
      const hc = (ORG.hc&&ORG.hc[d.id])||people.length;
      const dhc = (ORG.dhc&&ORG.dhc[d.id])||0;
      p.innerHTML = `<h3>${d.icon} ${esc(d.label)} <span class="k2-tag">${hc} чел · ${dhc} ЦС</span></h3>`;
      people.slice(0,3).forEach(pe=>{
        p.appendChild(rowEl(pe.emoji||'🧑', `${esc(pe.name)} ${esc(pe.surname)}`, `${esc(pe.role)}${pe.acc?' · '+esc(pe.acc):''}`, null));
      });
      grid.appendChild(p);
    });
    w.appendChild(grid);
  }

  /* --- Цифровые сотрудники (агенты + инструкции) --------------------------- */
  function renderAgents(w){
    w.innerHTML = head('Цифровые сотрудники', 'Штат агентов Среды и их должностные инструкции');
    const digital = ORG.digital||{};
    Object.keys(digital).forEach(dep=>{
      digital[dep].slice(0,2).forEach(a=>{
        const c = el('div','k2-agent');
        const ji = a.ji||{};
        const duties = (ji.duties||[]).slice(0,3).map(d=>`<li>${esc(d)}</li>`).join('');
        const kpi = (ji.kpi||[]).map(k=>`<span>${esc(k[0])} <b>${esc(k[1])}</b></span>`).join('');
        c.innerHTML = `
          <div class="ah"><div class="e">${a.emoji||'🤖'}</div>
            <div><b>${esc(a.title||a.name)}</b><small>${esc(a.fn||'')} · модель ${esc(a.model||'')} · ${esc(deptLabel(dep))}</small></div></div>
          ${ji.mission?`<div class="mission">${esc(ji.mission)}</div>`:''}
          ${duties?`<ul>${duties}</ul>`:''}
          ${kpi?`<div class="k2-kpi">${kpi}</div>`:''}`;
        w.appendChild(c);
      });
    });
  }

  /* ================================================================ BOOT   */
  function boot(){
    const stage = $('#stage');
    if (!stage){ return; } // app ещё не готов
    profile = load();
    if (profile && profile.chosen && profile.chosen.length){
      injectStyles();
      enterCabinet();
    } else {
      runSurvey();
    }
  }
  // app.js стартует на DOMContentLoaded; наш листенер добавлен позже — сработает после.
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(boot, 0));
  } else {
    setTimeout(boot, 0);
  }
})();
