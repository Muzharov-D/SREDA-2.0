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
    { q:'На что уходит время, которое вы не хотели бы на это тратить?',
      opts:[
        { t:'На рутину, которую по-хорошему пора кому-то отдать',      g:'Среда возьмёт это на себя', w:{do:2} },
        { t:'На выяснение, кто чем занят и что где застряло',          g:'Среда покажет, где горит',  w:{watch:2} },
        { t:'На то, чтобы всё помнить и никого не забыть дёрнуть',     g:'Среда станет вашей памятью',w:{help:2} },
        { t:'На настройку того, как это вообще должно работать',       g:'Среда даст конструктор',    w:{build:2} },
      ]},
    { q:'О том, что что-то пошло не так, вы узнаёте…',
      opts:[
        { t:'Раньше всех — я чувствую, когда что-то не так',          g:'включит Пульс',             w:{watch:2} },
        { t:'Позже, чем хотелось бы — новости доходят с опозданием',  g:'включит ранние сигналы',    w:{watch:1, help:1} },
        { t:'Когда уже пора тушить — и тушу сам',                     g:'даст задачи «под ключ»',    w:{do:2} },
        { t:'И сразу переделываю процесс, чтобы не повторялось',      g:'откроет настройку процессов',w:{build:2} },
      ]},
    { q:'Вы уехали на неделю без связи. Что будет с работой?',
      opts:[
        { t:'Встанет — почти всё держится на мне лично',             g:'Среда подставит руки',      w:{do:2, help:1} },
        { t:'Замедлится — команда справится, но не без меня',        g:'Среда прикроет день',       w:{help:1, watch:1} },
        { t:'Пойдёт по инерции — процессы держат',                   g:'Среда даст обзор сверху',   w:{watch:2} },
        { t:'Ничего — я как раз строю так, чтобы шло само',          g:'Среда даст платформу',      w:{build:2, watch:1} },
      ]},
    { q:'Идеальному сотруднику вы бы первым делом отдали…',
      opts:[
        { t:'Саму работу — пусть делает вместо меня',               g:'→ Поставить задачу',        w:{do:2} },
        { t:'Наблюдение — пусть следит и вовремя сигналит',         g:'→ Пульс и санкции',         w:{watch:2} },
        { t:'Мою голову — пусть помнит и напоминает',               g:'→ Мой день',                w:{help:2} },
        { t:'Стройку — пусть соберёт команду и процессы',           g:'→ Команда и агенты',        w:{build:2} },
      ]},
    { q:'Вечер. День удался, если…',
      opts:[
        { t:'Сделано много и руками',                               g:'усилит «Делаю»',            w:{do:2} },
        { t:'Нигде не полыхнуло, всё под контролем',                g:'усилит «Слежу»',            w:{watch:2} },
        { t:'Разгрёб всё, что висело на мне',                       g:'усилит «Помогает»',         w:{help:2} },
        { t:'Настроил так, что дальше пошло само',                  g:'усилит «Строю»',            w:{build:2} },
      ]},
    { q:'Насколько вам важно видеть, КАК именно всё сделано?',
      depth:true,
      opts:[
        { t:'Дайте результат — под капот не полезу',                g:'Среда спрячет кухню',       w:{}, depth:0 },
        { t:'Хочу видеть, кто сделал и на чём основано',            g:'Среда покажет авторов и источники', w:{}, depth:1 },
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
      padding:34px 34px 28px; box-shadow:0 30px 80px rgba(0,0,0,.5); animation:k2rise .5s cubic-bezier(.22,1,.36,1); }
    .k2-eyebrow{ color:var(--k-gold); font-size:12px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; }
    .k2-q{ font-size:23px; line-height:1.28; font-weight:700; margin:12px 0 22px; letter-spacing:-.01em; }
    .k2-opts{ display:flex; flex-direction:column; gap:11px; }
    .k2-opt{ text-align:left; background:var(--k-panel2); border:1px solid var(--k-line); color:var(--k-txt);
      border-radius:13px; padding:16px 18px; font-size:15.5px; line-height:1.35; cursor:pointer; transition:.14s; position:relative; }
    .k2-opt:hover{ border-color:var(--k-gold); background:#262a20; transform:translateY(-1px); }
    .k2-opt .gain{ display:block; margin-top:6px; font-size:12px; color:var(--k-dim); }
    .k2-opt:hover .gain{ color:var(--k-gold); }
    .k2-opt.chosen{ border-color:var(--k-gold); background:#2a2e22; }
    .k2-progress{ display:flex; gap:6px; margin-top:24px; }
    .k2-dot{ flex:1; height:4px; border-radius:2px; background:var(--k-line); transition:background .3s; }
    .k2-dot.on{ background:var(--k-gold); }
    .k2-sub{ color:var(--k-dim); font-size:13.5px; margin-top:16px; }
    .k2-back{ background:none; border:none; color:var(--k-dim); font-size:13px; cursor:pointer; padding:6px 0; margin-top:14px; }
    .k2-back:hover{ color:var(--k-txt); }
    @keyframes k2rise{ 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }

    /* ---- опрос: живая двухпанельная сборка ---- */
    .k2-survey.two{ align-items:stretch; justify-content:center; padding:0; }
    .k2-stage2{ display:grid; grid-template-columns:1.12fr .88fr; width:100%; max-width:1120px; margin:auto; }
    .k2-left{ padding:min(8vh,68px) clamp(24px,4vw,52px); display:flex; flex-direction:column; justify-content:center; }
    .k2-right{ background:linear-gradient(180deg,#191b15,#15170f); border-left:1px solid var(--k-line);
      padding:clamp(28px,5vh,46px) clamp(22px,2.6vw,34px); display:flex; flex-direction:column; min-height:100vh; }
    @media(max-width:860px){ .k2-stage2{ grid-template-columns:1fr; } .k2-right{ min-height:auto; border-left:none; border-top:1px solid var(--k-line); } .k2-left{ padding:30px 22px; } }
    .k2-right-h{ display:flex; align-items:center; justify-content:space-between; font-size:12px; letter-spacing:.14em;
      text-transform:uppercase; color:var(--k-dim); font-weight:700; }
    .k2-right-h .ttl{ color:var(--k-txt); }
    .k2-live{ display:inline-flex; align-items:center; gap:6px; color:var(--k-gold); font-size:10.5px; }
    .k2-live b{ width:7px; height:7px; border-radius:50%; background:var(--k-gold); animation:k2blink 1.4s infinite; }
    @keyframes k2blink{ 0%,100%{opacity:1} 50%{opacity:.25} }
    .k2-axes{ display:flex; flex-direction:column; gap:13px; margin:20px 0 26px; }
    .k2-ax{ position:relative; }
    .k2-ax .t{ display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; align-items:center; }
    .k2-ax .t .lab{ display:flex; gap:7px; align-items:center; }
    .k2-ax .t .p{ color:var(--k-dim); font-variant-numeric:tabular-nums; font-size:12px; transition:color .3s; }
    .k2-ax.hot .t .p{ color:var(--k-gold); font-weight:700; }
    .k2-ax .track{ height:8px; border-radius:5px; background:var(--k-line); overflow:visible; position:relative; }
    .k2-ax .track i{ display:block; height:100%; width:0; background:linear-gradient(90deg,#c9a545,#f0d78a);
      border-radius:5px; transition:width .65s cubic-bezier(.22,1,.36,1); }
    .k2-ax.bump .track i{ box-shadow:0 0 14px rgba(232,196,104,.65); }
    .k2-axbadge{ position:absolute; right:0; top:-24px; background:var(--k-gold); color:#191309; font-size:11px;
      font-weight:800; padding:2px 8px; border-radius:999px; animation:k2pop .55s ease; pointer-events:none; }
    @keyframes k2pop{ 0%{transform:translateY(10px) scale(.5);opacity:0} 45%{transform:translateY(-3px) scale(1.15);opacity:1} 100%{transform:translateY(0) scale(1);opacity:1} }
    .k2-tray-h{ font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--k-dim); margin-bottom:12px; font-weight:700; }
    .k2-tray-h b{ color:var(--k-gold); }
    .k2-tray{ display:flex; flex-direction:column; gap:9px; }
    .k2-tray-empty{ color:var(--k-dim); font-size:13px; line-height:1.45; padding:16px; border:1px dashed var(--k-line);
      border-radius:12px; text-align:center; }
    .k2-tcard{ display:flex; align-items:center; gap:12px; background:var(--k-panel); border:1px solid var(--k-line);
      border-radius:12px; padding:11px 13px; overflow:hidden; animation:k2card .5s cubic-bezier(.22,1,.36,1); }
    .k2-tcard.leaving{ animation:k2out .32s ease forwards; }
    .k2-tcard .ci{ font-size:19px; width:22px; text-align:center; }
    .k2-tcard .cn{ font-weight:600; font-size:14px; }
    .k2-tcard .ch{ color:var(--k-dim); font-size:11.5px; margin-top:1px; }
    @keyframes k2card{ 0%{transform:scale(.82) translateY(8px);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1) translateY(0);opacity:1} }
    @keyframes k2out{ to{opacity:0;transform:scale(.9);height:0;padding-top:0;padding-bottom:0;margin-top:-9px} }
    .k2-toast{ margin-top:auto; padding-top:18px; color:var(--k-gold); font-size:13px; line-height:1.4; min-height:22px;
      opacity:0; transform:translateY(6px); transition:opacity .32s, transform .32s; }
    .k2-toast.show{ opacity:1; transform:translateY(0); }
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
  /* Живой сборщик: каждый ответ на глазах достраивает Среду в правой панели. */
  function runSurvey(){
    injectStyles();
    let step = 0;
    const raw = {}; AX.forEach(a=> raw[a]=0);
    let depth = 1;
    let liveChosen = [];            // что уже «materialized» в панели
    const history = [];             // [{w, depth}] по шагам — для честного «назад»
    let locked = false;             // защита от двойного клика во время анимации

    const layer = el('div','k2-survey'); layer.id='k2Survey';
    document.body.appendChild(layer);

    /* ---- интро ---- */
    function drawIntro(){
      layer.classList.remove('two');
      layer.innerHTML='';
      const c = el('div','k2-card');
      c.innerHTML = `
        <div class="k2-eyebrow">Среда собирается под вас</div>
        <div class="k2-q">Никто заранее не знает, что ему нужно от Среды.<br>Поэтому мы не спросим «что вы хотите».</div>
        <div class="k2-sub">6 коротких вопросов про вашу работу — и вы увидите, как Среда собирается прямо у вас на глазах. Лишнего не покажем: остальное всегда можно добрать.</div>
        <div style="margin-top:26px"><button class="k2-cta" id="k2Start">Собрать мою Среду ▶</button></div>`;
      layer.appendChild(c);
      $('#k2Start').onclick = ()=>{ step=0; buildShell(); drawLeft(); };
    }

    /* ---- двухпанельная оболочка (строится один раз, панель справа живёт) --- */
    function buildShell(){
      layer.classList.add('two');
      layer.innerHTML = `
        <div class="k2-stage2">
          <div class="k2-left" id="k2Left"></div>
          <aside class="k2-right">
            <div class="k2-right-h"><span class="ttl">Ваша Среда</span>
              <span class="k2-live"><b></b> собирается</span></div>
            <div class="k2-axes" id="k2Axes"></div>
            <div class="k2-tray-h">Модули · <b id="k2Cnt">0</b></div>
            <div class="k2-tray" id="k2Tray">
              <div class="k2-tray-empty" id="k2Empty">пока пусто — отвечайте, и Среда начнёт собираться под вас</div>
            </div>
            <div class="k2-toast" id="k2Toast"></div>
          </aside>
        </div>`;
      const axes = $('#k2Axes', layer);
      AX.forEach(a=>{
        const row = el('div','k2-ax'); row.dataset.a = a;
        row.innerHTML = `<div class="t"><span class="lab">${AXES[a].icon} ${AXES[a].label}</span>
          <span class="p">0%</span></div><div class="track"><i></i></div>`;
        axes.appendChild(row);
      });
    }

    /* ---- левая колонка: вопрос + ответы ---- */
    function drawLeft(){
      const s = SURVEY[step];
      const dots = SURVEY.map((_,i)=>`<div class="k2-dot ${i<=step?'on':''}"></div>`).join('');
      const left = $('#k2Left', layer);
      left.innerHTML = `
        <div class="k2-eyebrow">Вопрос ${step+1} из ${SURVEY.length}</div>
        <div class="k2-q">${esc(s.q)}</div>
        <div class="k2-opts" id="k2Opts"></div>
        <div class="k2-progress">${dots}</div>
        ${step>0?'<button class="k2-back" id="k2Back">← назад</button>':''}`;
      const box = $('#k2Opts', left);
      s.opts.forEach(o=>{
        const b = el('button','k2-opt', `${esc(o.t)}${o.g?`<span class="gain">${esc(o.g)}</span>`:''}`);
        b.onclick = ()=> answer(o, s, b);
        box.appendChild(b);
      });
      if (step>0) $('#k2Back',left).onclick = goBack;
    }

    /* ---- ответ: применяем веса и оживляем панель ---- */
    function answer(o, s, btn){
      if (locked) return; locked = true;
      btn.classList.add('chosen');
      const w = o.w || {};
      for (const a in w) raw[a] = (raw[a]||0) + w[a];
      if (s.depth) depth = o.depth;
      history[step] = { w, depth: s.depth ? o.depth : null };
      updateRight(w);
      setTimeout(()=>{
        locked = false;
        if (step < SURVEY.length-1){ step++; drawLeft(); }
        else finish();
      }, 560);
    }

    function goBack(){
      if (locked || step===0) return;
      step--;
      const h = history[step];
      if (h && h.w){ for (const a in h.w) raw[a] = (raw[a]||0) - h.w[a]; }
      history.length = step;
      drawLeft();
      updateRight(null);   // панель честно «схлопывается» назад
    }

    /* ---- сердце: пересчёт осей и материализация модулей ---- */
    function countUp(node, to){
      const from = parseInt(node.textContent) || 0;
      const t0 = performance.now(), dur = 560;
      (function tick(t){
        const k = Math.min(1, (t - t0)/dur);
        node.textContent = Math.round(from + (to-from)*k) + '%';
        if (k < 1) requestAnimationFrame(tick);
      })(performance.now());
      // страховка: если rAF не тикает — гарантированно доводим до финального значения
      setTimeout(()=>{ node.textContent = to + '%'; }, dur + 140);
    }
    function updateRight(changedW){
      const norm = normalize(raw);
      const prim = primaryAxis(norm);
      AX.forEach(a=>{
        const row = layer.querySelector('.k2-ax[data-a="'+a+'"]'); if(!row) return;
        const pct = Math.round((norm[a]||0)*100);
        row.querySelector('i').style.width = pct + '%';
        countUp(row.querySelector('.p'), pct);
        row.classList.toggle('hot', a===prim && pct>0);
        if (changedW && changedW[a]){
          row.classList.add('bump');
          const bdg = el('div','k2-axbadge','+'+changedW[a]);
          row.querySelector('.track').appendChild(bdg);
          setTimeout(()=>{ bdg.remove(); row.classList.remove('bump'); }, 950);
        }
      });
      // модули
      const tray = $('#k2Tray', layer);
      const nc = assemble(norm);
      const added   = nc.filter(id=>!liveChosen.includes(id));
      const removed = liveChosen.filter(id=>!nc.includes(id));
      removed.forEach(id=>{
        const card = tray.querySelector('[data-m="'+id+'"]');
        if (card){ card.classList.add('leaving'); setTimeout(()=>card.remove(), 320); }
      });
      added.forEach(id=>{
        const m = MODULES.find(x=>x.id===id); if(!m) return;
        const card = el('div','k2-tcard'); card.dataset.m = id;
        card.innerHTML = `<span class="ci">${m.icon}</span>
          <div><div class="cn">${esc(m.name)}</div><div class="ch">${esc(m.hint)}</div></div>`;
        tray.appendChild(card);
      });
      liveChosen = nc.slice();
      $('#k2Cnt', layer).textContent = nc.length;
      const emp = $('#k2Empty', layer); if (emp) emp.style.display = nc.length ? 'none' : '';
      // подсказка «что добавилось»
      let msg = '';
      if (added.length){ const m = MODULES.find(x=>x.id===added[0]); msg = `▲ Среда добавила «${m.name}» — ${m.hint}`; }
      else if (removed.length){ msg = '▽ Среда убрала лишнее — держим только нужное'; }
      else if (changedW){ const a = Object.keys(changedW)[0]; if (a && AXES[a]) msg = `▲ усилилась ось «${AXES[a].label}»`; }
      if (msg) showToast(msg);
    }
    let toastTimer = null;
    function showToast(msg){
      const t = $('#k2Toast', layer); if(!t) return;
      t.textContent = msg; t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=> t.classList.remove('show'), 2600);
    }

    function finish(){
      const norm = normalize(raw);
      profile = { raw, norm, depth, chosen: assemble(norm) };
      save(profile);
      drawResult();
    }

    function drawResult(){
      layer.classList.remove('two');
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
