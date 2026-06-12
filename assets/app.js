/* ============================================================================
   СРЕДА — логика прототипа (vanilla JS, без сборки)
   ========================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function escHtml(s){ return String(s).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }

/* --- Загрузка данных из API (fallback на in-memory) --- */
/* экраны, которые читают данные из API и должны перерисоваться, когда живые данные доедут */
const API_SCREENS = ['talent', 'project', 'bills'];
async function loadApiData(){
  let fresh = false;
  try {
    const agents = await api('/agents');
    if(agents && agents.length){ window.__API_AGENTS = agents; window.__TLCAT = null; fresh = true; }
  } catch(e) { console.log('API agents unavailable, using in-memory'); }
  try {
    const projects = await api('/projects');
    if(projects && projects.length){ window.__API_PROJECTS = projects; fresh = true; }
  } catch(e) { console.log('API projects unavailable, using in-memory'); }
  try {
    const bills = await api('/bills');
    if(bills && bills.length){ window.__API_BILLS = bills; fresh = true; }
  } catch(e) { console.log('API bills unavailable, using in-memory'); }
  /* живые данные доехали — перерисуем текущий экран, если он зависит от API,
     чтобы скелетон-плейсхолдеры сменились реальными карточками без «прыжка» в пусто */
  window.__API_LOADING = false;
  if(fresh && typeof state !== 'undefined' && API_SCREENS.includes(state.screen)){
    try { renderStage(state.screen); decorateStage(state.screen); } catch(e) { /* рендер недоступен — игнор */ }
  }
}
/* флаг: первичная загрузка API ещё идёт — экраны могут показать скелетоны */
window.__API_LOADING = true;
/* скелетон-плейсхолдеры: N серых карточек с shimmer (класс .skeleton из styles.css) */
function skeletonCards(n, cls){ return Array.from({length:n||4},()=>`<div class="${cls||'tl-card'} skeleton" aria-hidden="true" style="min-height:96px"></div>`).join(''); }

/* печать текста по буквам — «живой» ИИ; начинается с короткой паузы на размышление */
function typeInto(node, text, scroller, done){
  if(!node){ if(done) done(); return; }
  node.classList.add('streaming'); let i=0;
  const tick=()=>{ node.textContent=text.slice(0,i); if(scroller) scroller.scrollTop=scroller.scrollHeight;
    if(i++<=text.length){ setTimeout(tick, 14); } else { node.classList.remove('streaming'); if(done) done(); } };
  setTimeout(tick, 360);
}
/* поток сообщения в чат-тред (юзер → цифровой сотрудник печатает → коммит в состояние) */
function streamChat(root, st, u, a){
  const thread=root.querySelector('#chatxThread');
  st.chat=st.chat||[];
  if(!thread){ st.chat.push({u}); st.chat.push({a}); return; }
  thread.insertAdjacentHTML('beforeend', `<div class="chatx-b user">${escHtml(u)}</div>`);
  const bot=el(`<div class="chatx-b bot"><span class="chatx-ic">◆</span><div class="chatx-stream"></div></div>`);
  thread.appendChild(bot); thread.scrollTop=thread.scrollHeight;
  typeInto(bot.querySelector('.chatx-stream'), a, thread, ()=>{ st.chat.push({u}); st.chat.push({a}); });
}

const state = { ws: 'dev', screen: 'dev', running: false };

/* --- Back-stack с контекстом: откуда пришли, скролл и заголовок экрана --- */
const NAV = {
  stack: [],
  maxDepth: 30,
  push(entry){ const top=this.stack[this.stack.length-1]; if(top && top.screen===entry.screen) return; this.stack.push(entry); if(this.stack.length>this.maxDepth) this.stack.shift(); },
  pop(){ return this.stack.pop() || null; },
  peek(){ return this.stack[this.stack.length-1] || null; },
  canBack(){ return this.stack.length>0; },
  reset(){ this.stack=[]; }
};

const scrollMem = {}; /* screen → scrollTop, восстановление при popstate */

function goBack(fallback){
  if(state.running){ toast('Идёт прогон — дождитесь завершения'); return; }
  const p = NAV.pop();
  if(!p){ navTo(fallback || (window.__PORTAL?'modules':'pulse')); return; }
  navTo(p.screen, {noPush:true});
  history.replaceState({screen:p.screen}, '', '#'+p.screen);
  if(p.scroll) requestAnimationFrame(()=>{ const w=document.getElementById('work'); if(w) w.scrollTop=p.scroll; });
}

let _toastT;
function toast(msg){
  let t = document.querySelector('.toast');
  if (!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = '✓ ' + msg; requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(_toastT); _toastT = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* --- Бейдж модели (общий) ------------------------------------------------ */
function modelBadge(id){
  const m = MODELS[id];
  return `<span class="mb ${m.cls}"><i></i>${m.name} <small>· ${m.why}</small></span>`;
}

/* ========================================================================== */
/*  НАВИГАЦИЯ                                                                  */
/* ========================================================================== */
const ROLE_IDS = ['dev','sales','marketing','design','analytics','hr','finance','legal'];
const ROLE_CAT = { dev:'dev', sales:'sales', marketing:'mkt', design:'design', analytics:'analytics', hr:'hr', finance:'fin', legal:'legal' };
const WORKSPACES = ROLE_IDS.map(id => { const d = DEPARTMENTS.find(x=>x.id===id);
  return { id, kind:'role', icon:d.icon, label:d.label, persona:d.persona,
    nav:[ {id:'asst:'+id,label:'Мой ассистент',icon:'💬'}, {id:id,label:'Рабочий стол',icon:'🖥️'}, {id:'flow:'+id,label:'Передачи',icon:'🔄'}, {id:'channel:'+id,label:'Канал отдела',icon:'💬'}, {id:'dpulse:'+id,label:'Пульс отдела',icon:'🫀'}, {id:'lib:'+id,label:'Умения и цифровые сотрудники',icon:'🧩'}, {id:'team:'+id,label:'Команда',icon:'👥'} ] };
}).concat([
  { id:'exec', kind:'mgmt', icon:'📊', label:'Менеджмент', persona:'CEO · Кирилл',
    nav:[ {id:'pulse',label:'Пульс компании',icon:'🫀'}, {id:'exec',label:'Дашборд компании',icon:'📊'}, {id:'company',label:'Оргструктура',icon:'🏢'}, {id:'flowx',label:'Передачи компании',icon:'🔄'}, {id:'project',label:'Проекты на ревью',icon:'📁'},
      {sep:'Платформа Среды'},
      {id:'modules',label:'С чего начать',icon:'🪜'}, {id:'talent',label:'Цифровой найм',icon:'🌊'}, {id:'forge',label:'Цифровое производство',icon:'🏭'}, {id:'bills',label:'Счета Среды',icon:'🧾'} ] },
  { id:'platform', kind:'ext', icon:'🌐', label:'Платформа Среды', persona:'Клиент без Inside',
    nav:[ {id:'modules',label:'С чего начать',icon:'🪜'}, {id:'talent',label:'Цифровой найм',icon:'🌊'}, {id:'forge',label:'Цифровое производство',icon:'🏭'}, {id:'bills',label:'Счета Среды',icon:'🧾'} ] },
  { id:'owner', kind:'owner', icon:'⚙️', label:'Владелец платформы', persona:'Платформа · Среда',
    nav:[ {id:'workers',label:'Штат цифровых сотрудников',icon:'🤖'},{id:'aibudget',label:'Бюджеты ИИ',icon:'💰'},{id:'router',label:'Маршрутизатор моделей',icon:'🔀'},{id:'audit',label:'Аудит и доступ',icon:'🛡️'},{id:'market',label:'Полная библиотека',icon:'📚'},{id:'studio',label:'Студия',icon:'🛠️'},
      {sep:'Видение'},
      {id:'power',label:'Суперсила',icon:'⚡'},{id:'path',label:'Путь',icon:'🧭'},{id:'core',label:'Контур',icon:'♾️'} ] },
]);

function renderNav(){
  const ws = WORKSPACES.find(w=>w.id===state.ws) || WORKSPACES[0];
  const nav = $('#nav'); nav.innerHTML = '';
  nav.appendChild(el(`<div class="nav-ws"><span class="nav-ws-ic">${ws.icon}</span><div><b>${ws.label}</b><small>${ws.kind==='role'?'изолированный кабинет':ws.kind==='owner'?'управление платформой':'управление'}</small></div></div>`));
  if (ws.kind==='owner') nav.appendChild(el(`<div class="nav-note">Управление Средой: цифровой штат, бюджеты, политики</div>`));
  /* детальные роуты (person:, worker:, …) подсвечивают родительский пункт nav */
  let hiId=state.screen, g=0;
  while(hiId && g++<6){ if(ws.nav.some(n=>n.id===hiId)) break; hiId=navParent(hiId); }
  hiId = hiId || state.screen;
  ws.nav.forEach(n=>{ let badge='';
    if (n.sep){ nav.appendChild(el(`<div class="nav-group">${n.sep}</div>`)); return; }
    if(n.id.indexOf('flow:')===0){ const rid=n.id.slice(5); const FS=flowState();
      const cnt=FLOWS.filter(f=>{ const c=FS[f.id]; return f.steps[c] && f.steps[c].role===rid; }).length;
      if(cnt) badge=`<span class="ni-badge">${cnt}</span>`; }
    const it=el(`<button class="nav-item ${n.id===hiId?'active':''}"><span class="ni-ic">${n.icon}</span><span class="ni-l">${n.label}</span>${badge}</button>`);
    it.onclick=()=>navTo(n.id); nav.appendChild(it); });
}

function navTo(id, opts={}){
  if(state.running){ toast('Идёт прогон — дождитесь завершения'); return; }
  if(id===state.screen) return;
  /* телепортация между кабинетами — только если текущий кабинет экрана не знает */
  const cur=WORKSPACES.find(w=>w.id===state.ws);
  if(!(cur && cur.nav.some(n=>n.id===id))){
    const ws=WORKSPACES.find(w=>w.nav.some(n=>n.id===id));
    if(ws && ws.id!==state.ws){ state.ws=ws.id; toast('Кабинет: '+ws.label); }
  }
  /* контекст для возврата: экран, скролл, заголовок */
  const w=document.getElementById('work');
  const fromScroll=w?w.scrollTop:0;
  scrollMem[state.screen]=fromScroll;
  if(!opts.noPush) NAV.push({screen:state.screen, scroll:fromScroll, label:screenLabel(state.screen)});
  state.screen=id; renderNav(); renderTopWho();
  renderStage(id);
  decorateStage(id);
  announceRoute(id);
  if(!opts.noPush) history.pushState({screen:id}, '', '#' + id);
}
const selectDept = navTo;

/* A11y: SPA-навигация немая для скринридеров — объявляем смену экрана через
   aria-live и переводим фокус на заголовок нового раздела (WCAG 3.2.3 / 4.1.3). */
function announceRoute(id){
  const live=document.getElementById('routeAnnounce');
  const w=document.getElementById('work');
  const h=w&&w.querySelector('.work-head h1,.work-head h2,h1,h2');
  const label=((h&&((h.childNodes[0]&&h.childNodes[0].textContent)||h.textContent))||screenLabel(id)||'').trim();
  if(live) live.textContent=label?('Раздел: '+label):'';
  if(h){ if(!h.hasAttribute('tabindex')) h.setAttribute('tabindex','-1'); try{h.focus({preventScroll:true});}catch(e){} }
}
function setWorkspace(id){ const ws=WORKSPACES.find(w=>w.id===id); if(!ws) return; state.ws=id; renderNav(); renderTopWho(); navTo(ws.nav[0].id); }

/* --- Родительская цепочка детальных роутов: крошки + подсветка sidebar --- */
function navParent(id){
  if(id.indexOf('gperson:')===0) return 'dpulse:'+id.split(':')[1];
  if(id.indexOf('gworker:')===0) return 'dpulse:'+id.split(':')[1];
  if(id.indexOf('person:')===0) return 'team:'+id.split(':')[1];
  if(id.indexOf('worker:')===0) return 'workers';
  if(id.indexOf('tagent:')===0) return 'talent';
  if(id.indexOf('fproj:')===0) return 'forge';
  if(id.indexOf('dpulse:')===0) return 'pulse';
  if(id.indexOf('domain:')===0) return 'federation';
  if(id.indexOf('diplomat:')===0) return 'federation';
  if(id.indexOf('channel:')===0) return 'team:'+id.slice(8);
  return null;
}
const EXTRA_LABELS = { federation:'Федерация доменов', contracts:'Междоменные контракты', arbitration:'Арбитраж', economy:'Внутренняя экономика' };
function workTitle(){
  const w=document.getElementById('work');
  const h=w && w.querySelector('.work-head h1,.work-head h2,h1,h2');
  if(!h) return '';
  return ((h.childNodes[0]&&h.childNodes[0].textContent)||h.textContent||'').trim();
}
function screenLabel(id){
  for(const w of WORKSPACES){ const n=w.nav.find(x=>x.id===id); if(n) return n.label; }
  if(EXTRA_LABELS[id]) return EXTRA_LABELS[id];
  return (id===state.screen && workTitle()) || id;
}
const trimLabel = s => s.length>28 ? s.slice(0,27)+'…' : s;

function crumbsHTML(id){
  if(!navParent(id)) return '';
  const chain=[]; let p=navParent(id), g=0;
  while(p && g++<6){ chain.unshift(p); p=navParent(p); }
  const cur = trimLabel(workTitle() || screenLabel(id));
  return `<nav class="nav-crumbs" aria-label="Хлебные крошки">`+
    chain.map(c=>`<a href="#${c}" onclick="navTo('${c}');return false;">${escHtml(trimLabel(screenLabel(c)))}</a><span class="nc-sep" aria-hidden="true">›</span>`).join('')+
    `<span class="nc-cur" aria-current="page">${escHtml(cur)}</span></nav>`;
}

/* Крошки и подпись «Назад» — поверх готового рендера, каркас .app/.topbar не трогаем.
   Внутренние перерисовки экрана (табы) затирают #work — observer возвращает крошки. */
function decorateStage(id){
  const work=document.getElementById('work');
  if(window.__decorObs){ window.__decorObs.disconnect(); window.__decorObs=null; }
  if(!work) return;
  const apply=()=>{
    if(!work.querySelector('.nav-crumbs')){
      const html=crumbsHTML(id);
      if(html) work.insertAdjacentHTML('afterbegin', html);
    }
    const p=NAV.peek();
    const btn=work.querySelector('.worker-profile-back');
    if(btn && p && !btn.dataset.ctx){ btn.dataset.ctx='1'; btn.textContent='← Назад · '+trimLabel(p.label||screenLabel(p.screen)); }
  };
  apply();
  window.__decorObs = new MutationObserver(apply);
  window.__decorObs.observe(work, {childList:true});
}

/* History API — кнопки назад/вперёд браузера работают и не дублируют стек */
window.addEventListener('popstate', () => {
  const screen = location.hash.slice(1) || (window.__PORTAL?'modules':'pulse');
  if(screen===state.screen) return;
  const top=NAV.peek();
  const isBack = top && top.screen===screen;
  if(isBack) NAV.pop();
  navTo(screen, {noPush:true});
  const pos = isBack ? (top.scroll||0) : (scrollMem[screen]||0);
  if(pos) requestAnimationFrame(()=>{ const w=document.getElementById('work'); if(w) w.scrollTop=pos; });
});

/* Keyboard shortcuts */
window.addEventListener('keydown', (e) => {
  // Esc = back
  if(e.key==='Escape'){ e.preventDefault(); goBack(); return; }
  // Alt+Left = back
  if(e.altKey && e.key==='ArrowLeft'){ e.preventDefault(); goBack(); return; }
  // Alt+Right = forward (not implemented yet, could use history.forward)
  if(e.altKey && e.key==='ArrowRight'){ e.preventDefault(); history.forward(); return; }
  // Cmd/Ctrl+1..8 = quick switch to first 8 nav items of current workspace
  if((e.metaKey || e.ctrlKey) && e.key>='1' && e.key<='8'){
    e.preventDefault();
    const ws = WORKSPACES.find(w=>w.id===state.ws) || WORKSPACES[0];
    const items = ws.nav.filter(n=>!n.sep);
    const idx = parseInt(e.key,10)-1;
    if(items[idx]) navTo(items[idx].id);
    return;
  }
  // Cmd/Ctrl+K = task modal (already exists)
});

function renderTopWho(){
  const ws = WORKSPACES.find(w=>w.id===state.ws) || WORKSPACES[0];
  $('#who').innerHTML = `<div class="ws-sw" id="wsBtn"><div class="av">${ws.icon}</div>
     <div><b style="font-size:12.5px">${ws.label}</b><small>${ws.persona}</small></div><span class="ws-caret">▾</span></div>`;
  $('#wsBtn').onclick = toggleWsMenu;
  renderFilialSw();
}
function renderFilialSw(){
  const f = FILIALS.find(x=>x.id===CURRENT_FILIAL) || FILIALS[0];
  const el2 = $('#filialSw'); if(!el2) return;
  el2.innerHTML = `<div class="fs-sw" id="fsBtn"><span class="fs-dot"></span><div><b>${f.city}</b><small>${f.name}</small></div><span class="fs-caret">▾</span></div>`;
  $('#fsBtn').onclick = toggleFsMenu;
}
function toggleFsMenu(e){ e&&e.stopPropagation(); let m=$('#fsMenu'); if(m){ m.remove(); return; }
  m=el(`<div id="fsMenu" class="ws-menu"></div>`);
  m.appendChild(el(`<div class="ws-menu-g">Филиалы</div>`));
  FILIALS.forEach(f=>{ const it=el(`<button class="ws-menu-i ${f.id===CURRENT_FILIAL?'on':''}"><span class="wm-ic">🏭</span><div><b>${f.city}</b><small>${f.name}</small></div></button>`);
    it.onclick=()=>{ m.remove(); /* CURRENT_FILIAL=f.id; */ toast('Переключение филиала'); renderFilialSw(); }; m.appendChild(it); });
  document.body.appendChild(m);
  const r=$('#fsBtn').getBoundingClientRect(); m.style.top=(r.bottom+8)+'px'; m.style.right=Math.max(12,(window.innerWidth-r.right))+'px';
  setTimeout(()=>document.addEventListener('click', closeFsMenu), 0);
}
function closeFsMenu(e){ const m=$('#fsMenu'); if(m && !m.contains(e.target)){ m.remove(); document.removeEventListener('click', closeFsMenu); } }
function toggleWsMenu(e){ e&&e.stopPropagation(); let m=$('#wsMenu'); if(m){ m.remove(); return; }
  m=el(`<div id="wsMenu" class="ws-menu"></div>`);
  [['Управление','mgmt'],['Внешний контур · без Inside','ext'],['Платформа','owner'],['Кабинеты ролей','role']].forEach(([t,k])=>{
    m.appendChild(el(`<div class="ws-menu-g">${t}</div>`));
    WORKSPACES.filter(w=>w.kind===k).forEach(w=>{ const it=el(`<button class="ws-menu-i ${w.id===state.ws?'on':''}"><span class="wm-ic">${w.icon}</span><div><b>${w.label}</b><small>${w.persona}</small></div></button>`);
      it.onclick=()=>{ m.remove(); setWorkspace(w.id); }; m.appendChild(it); }); });
  document.body.appendChild(m);
  const r=$('#wsBtn').getBoundingClientRect(); m.style.top=(r.bottom+8)+'px'; m.style.right=Math.max(12,(window.innerWidth-r.right))+'px';
  setTimeout(()=>document.addEventListener('click', closeWsMenu), 0);
}
function closeWsMenu(e){ const m=$('#wsMenu'); if(m && !m.contains(e.target)){ m.remove(); document.removeEventListener('click', closeWsMenu); } }

function swarmOf(role){ return ROLE_SWARM[role] || DEFAULT_SWARM; }
const DW_STATUS = { active:['● в строю','dws-on'], probation:['◐ испытательный срок','dws-prob'], paused:['○ на паузе','dws-off'] };
function renderTeam(root, id){ const cfg=COCKPITS[id]; const d=DEPARTMENTS.find(x=>x.id===id);
  const TEAM=cfg.team.map((t,i)=>Array.isArray(t)?{name:t[0],role:t[1],task:t[2],emoji:t[3],fn:t[4],i}:{...t,i});
  const DS=(DIGITAL_STAFF[id]||[]).map((w,i)=>({...w,i}));
  const groups={}; TEAM.forEach(p=>{ const g=p.fn||'Команда'; (groups[g]=groups[g]||[]).push(p); });
  DS.forEach(w=>{ const g=w.fn||'Команда'; (groups[g]=groups[g]||[]).push({...w, digital:true}); });
  const grouped=Object.keys(groups).length>1;
  const SH=cfg.shared.map(s=>Array.isArray(s)?{n:s[0],e:s[1]}:s);
  const M=cfg.metrics.map(m=>Array.isArray(m)?{k:m[0],b:m[1],a:m[2]}:{k:m.k,b:m.before,a:m.after});
  const hc=HEADCOUNT[id]||TEAM.length, dhc=DIGITAL_HEADCOUNT[id]||DS.length;
  const share=Math.round(dhc/(hc+dhc)*100);
  let sel={kind:'h', i:0};
  function draw(){
    const dc = DEPT_TASK[id].c;
    const TLH = tlHiredOf(id);
    let teamHtml=Object.keys(groups).map(g=>`${grouped?`<div class="team-fn">${g}<span>${groups[g].length}</span></div>`:''}<div class="dev-team">${groups[g].map(pp=> pp.digital
      ? `<div class="dev-p dgt ${sel.kind==='d'&&sel.i===pp.i?'on':''}" data-dw="${pp.i}"><span class="dp-av">${pp.emoji}</span><div><b>${pp.name} <i class="dgt-tag">цифровой</i></b><small>${pp.title} · ${pp.now}</small></div><span class="dp-swarm dgt">ДИ →</span><span class="dp-swarm prof" data-wjump="${pp.id}" title="Полный профиль">профиль →</span></div>`
      : `<div class="dev-p ${sel.kind==='h'&&sel.i===pp.i?'on':''}" data-p="${pp.i}">${humanAv(id, pp.name, dc, 'sm')}<div><b>${pp.name}</b><small>${pp.role} · ${pp.task}</small></div><span class="dp-swarm">рой · ${swarmOf(pp.role).a.length}</span><span class="dp-swarm prof" data-pjump="${id}:${pp.i}" title="Полный профиль">профиль →</span></div>`).join('')}</div>`).join('');
    if (TLH.length) teamHtml += `<div class="team-fn">🌊 Агенты Среды на контракте<span>${TLH.length}</span></div><div class="dev-team">${TLH.map((h,ti)=>{ const a=talentAgent(h.aid);
      return `<div class="dev-p tlh ${sel.kind==='t'&&sel.i===ti?'on':''}" data-tl="${ti}">${hexAv(a)}<div><b>${a.name} <i class="dgt-tag tl">агент Среды</i></b><small>${TL_ROLES[a.role].label} · ${h.sinceLbl} · принято: ${h.accepted}</small></div><span class="dp-swarm prof" data-tljump="${a.id}">контракт →</span></div>`; }).join('')}</div>`;

    let side='';
    if (sel.kind==='t' && TLH[sel.i]){
      const h=TLH[sel.i], a=talentAgent(h.aid);
      side=`<h2>🌊 Агент Среды · контракт</h2>
        <div class="rolecard hc">
          <div class="hc-h">${hexAv(a)}<div><b>${a.name}</b><small>${TL_ROLES[a.role].label} · ${a.grade} · ${tlPassId(a)}</small></div><span class="hc-lvl" style="color:var(--teal);border-color:rgba(45,212,191,.4)">${a.rating}★</span></div>
          ${gpField('Формат', h.mode==='staff'?'в штате · ₽'+a.priceMonth.toLocaleString('ru')+'/мес':'за результат · ₽'+a.priceTask.toLocaleString('ru'), 'sreda')}
          ${gpField('Контактная поверхность', 'витрины отдела: 2 из 6 · JIT-доступ', 'sreda')}
          ${gpField('Принято результатов', String(h.accepted), 'sreda')}
          <div class="hc-sec"><div class="hc-lab"><span>Отличие от Inside-цифровых</span></div>
            <div class="od-gov" style="margin:0">Контракт вместо должностной инструкции, урезанный периметр данных, оплата платформе за результат. Доверяете — кристаллизуйте в постоянный штат.</div></div>
          <button class="btn go ji-prof" data-tlprof="${a.id}">Открыть контракт и паспорт →</button>
        </div>`;
    } else if (sel.kind==='h'){
      const p=TEAM[sel.i], sw=swarmOf(p.role);
      const R=personRPG(id,p), Q=questsOf(id,p.name,p.task), load=loadOf(Q,R.lvl);
      const gateOpen = stepGate({role:id}).gated;
      side=`<h2>👤 ${LEX('emp')}</h2>
        <div class="rolecard hc">
          <div class="hc-h">${humanAv(id, p.name, dc, 'sm')}<div><b>${p.name}</b><small>${p.role}${p.fn&&p.fn!==p.role?' · '+p.fn:''}</small></div><span class="hc-lvl" title="${RPG_LVL_LBL[R.lvl]}">${LEX('lvlOf')(R.lvl)}</span></div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('load')}</span><b>${load}/100 · ${Q.length} в работе</b></div>${rpgBar(load, load>82?'hot':'')}</div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('skills')}</span></div>
            ${R.sk.map(s=>`<div class="hc-skill"><span>${s[0]}</span>${rpgDots(s[1])}<b>${s[1]}/10</b></div>`).join('')}</div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('quests')}</span></div>
            ${Q.map(q=>{ const blocked=q.gate&&gateOpen; const cls=blocked?'bad':q.prog>75?'ok':'';
              return `<div class="hc-q"><div class="hc-q-t"><b>${q.id?q.id+' · ':''}${q.t}</b><i class="${blocked?'q-bad':q.prog>75?'q-ok':'q-mid'}">${blocked?'⛔ гейт: sev1-риск':q.col}</i></div>${rpgBar(q.prog,cls)}</div>`; }).join('')}</div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('swarm')}</span><b>${sw.a.length} ${LEX('swarmSub')}</b></div>
            <div class="rc-duty"><b>Зона:</b> ${sw.d}</div>
            <div class="rc-swarm">${sw.a.map(a=>`<div class="rc-a">${a}</div>`).join('')}</div></div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('ach')}</span></div>
            ${R.ach.map(a=>`<div class="hc-ach">🏆 ${a}</div>`).join('')}</div>
          <button class="btn go ji-prof" data-pprof="${id}:${sel.i}">${LEX('fullProfile')}</button>
        </div>
        <h2 style="margin-top:14px">🧰 Командные рои <span class="tag">инструменты отдела · не штат</span></h2><div class="dev-shared">${SH.map(a=>`<div class="dev-sh"><span>${a.e}</span>${a.n}</div>`).join('')}</div>`;
    } else {
      const w=DS[sel.i]; const st=DW_STATUS[w.status]||DW_STATUS.active;
      const C=workerRPG(w); const manaPct=Math.round(C.mana.cur/C.mana.max*100);
      side=`<h2>🤖 ${LEX('dw')}</h2>
        <div class="rolecard ji-card hc crd">
          <div class="hc-h"><span class="rc-av dgt">${w.emoji}</span><div><b>${w.name} <i class="dgt-tag">цифровой</i></b><small>${w.title} · ${w.fn}</small></div><span class="hc-lvl dgt">${LEX('lvlOf')(C.lvl)}</span></div>
          <div class="ji-meta">
            <span class="ji-st ${st[1]}">${st[0]}</span>
            <span class="ji-lead">руководитель: <b>${w.lead}</b></span>
            ${modelBadge(w.model)}
          </div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('mana')}</span><b>${C.mana.cur}/${C.mana.max} · ${C.mana.unit}</b></div>${rpgBar(manaPct,'mp')}</div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('stats')}</span></div>
            ${C.stats.map(s=>`<div class="hc-skill"><span>${s[0]}</span>${rpgDots(s[1])}<b>${s[1]}/10</b></div>`).join('')}</div>
          <div class="ji-sec"><b>${LEX('mission')}</b><p>${w.ji.mission}</p></div>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('duties')}</span></div>
            ${C.spells.map(s=>`<div class="hc-spell"><span>${s[0]}</span>${rpgStars(s[1])}</div>`).join('')}</div>
          <div class="ji-sec lim"><b>${LEX('limits')}</b><ul>${C.curses.map(x=>`<li>⛔ ${x}</li>`).join('')}</ul></div>
          <div class="hc-sec"><div class="hc-lab"><span>${isRPG()?'Активный квест':'Активная задача'}</span></div>
            <div class="hc-q"><div class="hc-q-t"><b data-jinow>${w.now}</b><i class="q-mid">${C.prog}%</i></div>${rpgBar(C.prog)}</div>
            <div class="hc-art">${C.artifacts.map(a=>`<span>${a}</span>`).join('')}</div></div>
          <div class="ji-sec esc"><b>${LEX('esc')}</b><p>${w.ji.esc}</p></div>
          <button class="btn go ji-prof" data-jiprof="${w.id}">${LEX('fullProfile')}</button>
          <div class="ji-ask"><input type="text" placeholder="Задача для «${w.name}»…" data-jiask/><button class="btn go" data-jigo>→</button></div>
        </div>`;
    }

    root.innerHTML=workHead(d, `Штат «${cfg.role}»: ${hc} людей + ${dhc} цифровых сотрудников (${share}%)`) + `
    <div class="dev-metrics" style="grid-template-columns:repeat(${Math.min(M.length,6)},1fr)">${M.map(m=>`<div class="dm"><span>${m.k}</span><div class="dm-v"><s>${m.b}</s><b>${m.a}</b></div></div>`).join('')}</div>
    <div class="two-col" style="align-items:start">
      <div class="panel"><h2>👥 Штат отдела <span class="tag">${hc} людей · ${dhc} цифровых${grouped?' · '+Object.keys(groups).length+' функций':''}</span></h2>${teamHtml}
        <div class="team-more">показаны ключевые: <b>${TEAM.length}</b> людей и <b>${DS.length}</b> цифровых · ещё <b>${hc-TEAM.length}</b> специалистов и <b>${dhc-DS.length}</b> типовых цифровых позиций</div></div>
      <div class="panel team-side">${side}</div>
    </div>`;
    root.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ sel={kind:'h', i:+b.dataset.p}; draw(); });
    root.querySelectorAll('[data-dw]').forEach(b=>b.onclick=()=>{ sel={kind:'d', i:+b.dataset.dw}; draw(); });
    root.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{ sel={kind:'t', i:+b.dataset.tl}; draw(); });
    root.querySelectorAll('[data-tljump]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('tagent:'+b.dataset.tljump); });
    const tlp=root.querySelector('[data-tlprof]'); if(tlp) tlp.onclick=()=>navTo('tagent:'+tlp.dataset.tlprof);
    root.querySelectorAll('[data-pjump]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('person:'+b.dataset.pjump); });
    root.querySelectorAll('[data-wjump]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.wjump); });
    const prof=root.querySelector('[data-jiprof]'); if(prof) prof.onclick=()=>navTo('worker:'+prof.dataset.jiprof);
    const pprof=root.querySelector('[data-pprof]'); if(pprof) pprof.onclick=()=>navTo('person:'+pprof.dataset.pprof);
    const ask=root.querySelector('[data-jiask]'), go=root.querySelector('[data-jigo]');
    if(ask&&go){ const send=()=>{ const v=ask.value.trim(); if(!v){ toast('Опишите задачу'); return; }
      if (rpgPhraseCheck(v)){ ask.value=''; return; }
        const w=DS[sel.i]; w.now=v; root.querySelector('[data-jinow]').textContent=v; ask.value='';
        pushAudit({ who:cfg.role, what:`Задача цифровому сотруднику «${w.name}»: ${v}`, verdict:'allow' });
        toast(`Задача принята: «${w.name}» вернёт черновик руководителю (${w.lead.split(' · ')[0]})`); };
      go.onclick=send; ask.onkeydown=e=>{ if(e.key==='Enter') send(); }; }
  }
  draw();
}

/* ========================================================================== */
/*  ЛИЧНЫЙ АРСЕНАЛ — установленные умения/цифровые сотрудники ассистента (общая библиотека)  */
/* ========================================================================== */
const CAT2ROLE = { dev:'dev', sales:'sales', mkt:'marketing', design:'design', analytics:'analytics', hr:'hr', fin:'finance', legal:'legal' };
/* кто сидит в кабинете роли (имя + должность) — определяет рой ассистента под позицию */
const ASST_WHO = {
  dev:{name:'Игорь',role:'Тимлид'}, sales:{name:'Денис',role:'РОП'}, marketing:{name:'Аня',role:'Маркетолог (лид)'},
  design:{name:'Соня',role:'Арт-директор'}, analytics:{name:'Лена',role:'Продуктовый аналитик'},
  hr:{name:'Марина',role:'HRD'}, finance:{name:'Кост',role:'CFO'}, legal:{name:'Ден',role:'Юрдиректор'},
};
function installStore(){
  if (window.__INST) return window.__INST;
  const s = {};
  ROLE_IDS.forEach(id => { const P = PERSONAL[id] || { skills:[], agents:[] };
    const who = ASST_WHO[id], sw = who && ROLE_SWARM[who.role];  // рой ассистента = рой под его должность
    s[id] = { skills:[...P.skills], agents: sw ? [...sw.a] : [...P.agents], fresh:new Set() }; });
  return (window.__INST = s);
}
/* добавить skill/цифровой сотрудник в ассистента роли; вернёт true если реально установлено */
function installItem(roleId, kind, name){
  const s = installStore()[roleId]; if (!s) return false;
  const list = kind==='agent' ? s.agents : s.skills;
  if (list.some(x => x.toLowerCase() === name.toLowerCase())) return false;
  list.push(name); s.fresh.add(name); return true;
}
function isInstalled(roleId, kind, name){
  const s = installStore()[roleId]; if (!s) return false;
  return (kind==='agent' ? s.agents : s.skills).some(x => x.toLowerCase() === name.toLowerCase());
}
/* очередь апрувов с состоянием решений — переживает смену уровня и перерисовку */
function queueStore(id){ const Q = window.__QUEUE || (window.__QUEUE = {});
  if (!Q[id]) Q[id] = (APPROVALS[id]||[]).map(q => ({ ...q, done:null })); return Q[id]; }
/* единый аудит-лог рантайма: передачи, апрувы, ревью — виден на экране «Аудит» */
function auditLog(){ return window.__AUDITLOG || (window.__AUDITLOG = []); }
function nowHHMMSS(){ const d = new Date(); return [d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':'); }
function pushAudit(e){ 
  const entry = { time:nowHHMMSS(), model:'—', cost:0, verdict:'allow', emoji:'◆', dept:'Среда', ...e, act:(e.act||e.what||'') };
  auditLog().unshift(entry);
  // also persist to API (fire-and-forget)
  if(typeof apiPost==='function'){
    apiPost('/audit', { time: entry.time, who: entry.who, what: entry.act, verdict: entry.verdict, emoji: entry.emoji, dept: entry.dept }).catch(()=>{});
  }
}

/* данные с правами (слой №2): что ассистент видит по роли × уровню */
const SEN_ORDER = ['intern','spec','head','owner'];
const SEN_LBL = { intern:'Стажёр', spec:'Специалист', head:'Руководитель', owner:'Владелец' };
function dataScopeHTML(id, sen){
  const arr = ROLE_DATA[id]; if (!arr) return '';
  const cur = SEN_ORDER.indexOf(sen);
  const rows = arr.map(x=>{
    if (x.min==='denied') return `<div class="ds-row denied"><span class="ds-ic">⛔</span><span class="ds-n">${x.n}</span><span class="ds-s">закрыто · ${x.why}</span></div>`;
    const need = SEN_ORDER.indexOf(x.min);
    if (cur>=need) return `<div class="ds-row ok"><span class="ds-ic">✓</span><span class="ds-n">${x.n}</span><span class="ds-s">доступно</span></div>`;
    return `<div class="ds-row locked"><span class="ds-ic">🔒</span><span class="ds-n">${x.n}</span><span class="ds-s">с уровня «${SEN_LBL[x.min]}»</span></div>`;
  }).join('');
  const seen = arr.filter(x=>x.min!=='denied' && SEN_ORDER.indexOf(x.min)<=cur).length;
  return `<div class="panel"><h2>🔐 Данные с правами <span class="tag">${seen}/${arr.length} видно</span></h2>
    <div class="ds-sub">Ассистент видит ровно по <b>роли × уровню</b>. Чужой периметр закрыт даже владельцу другого домена.</div>
    <div class="ds-list">${rows}</div></div>`;
}

/* ========================================================================== */
/*  СЦЕНА — выбор «лица» среды под отдел                                       */
/* ========================================================================== */
/* мульти-чат личного ассистента: список тредов на роль, переживает перерисовку */
function asstChats(id, hi){ const S=(window.__ASSTCHATS||(window.__ASSTCHATS={}));
  if(!S[id]) S[id]={ list:[{ title:'Текущий чат', msgs:[{who:'a',text:hi}] }], active:0 };
  return S[id]; }
function renderAssistant(root, id){
  const P = PERSONAL[id]; const d = DEPARTMENTS.find(x=>x.id===id);
  const inst = installStore()[id];
  const who = ASST_WHO[id]; const mySw = who && ROLE_SWARM[who.role];
  let sen = 'spec';
  const chats = asstChats(id, P.hi);
  let msgs = chats.list[chats.active].msgs;
  /* очередь апрувов руководителя — общий стор (сюда же падают сабмиты стажёра) */
  const queue = queueStore(id);
  const msgHtml = (m, senO) => {
    if (m.who==='u') return `<div class="am am-u">${escHtml(m.text)}</div>`;
    if (m.note) return `<div class="am am-note">${m.note}</div>`;
    if (m.typing) return `<div class="am am-a am-typing"><span class="am-stream"></span></div>`;
    if (m.draft) return `<div class="am am-a"><div class="am-draft">📝 ${escHtml(m.draft)}</div>
      <div class="am-actions"><button class="btn go asst-approve">${senO.id==='intern'?'Отправить наставнику на ревью':senO.id==='head'?'Утвердить за команду':'Принять'}</button><button class="btn ghost asst-return">Вернуть на доработку</button><button class="btn ghost asst-openenv">Открыть в рабочей среде →</button></div></div>`;
    return `<div class="am am-a">${escHtml(m.text)}</div>`;
  };
  function ask(t){ const ch=chats.list[chats.active]; if(!ch._named){ ch.title=t.q.slice(0,20)+(t.q.length>20?'…':''); ch._named=true; }
    msgs.push({who:'u',text:t.q}); msgs.push({who:'a',typing:true}); draw();
    const node=root.querySelector('.am-typing .am-stream'), mw=root.querySelector('#asstMsgs');
    typeInto(node, '📝 '+t.draft, mw, ()=>{ msgs.pop(); msgs.push({who:'a',draft:t.draft}); draw(); }); }
  /* что происходит после «Принять» — зависит от уровня (конверт полномочий) */
  function onApprove(senO){
    if (senO.id==='intern'){
      const mentor = MENTOR[id] || 'наставник';
      const lastQ = [...msgs].reverse().find(m=>m.who==='u');
      /* сабмит стажёра уходит в очередь наставника (видно на уровне «Руководитель») */
      queue.unshift({ item:(lastQ?lastQ.text:'Черновик стажёра'), who:'Вы · стажёр', cost:'на ревью',
        risk:'low', note:'Черновик ассистента, отправлен наставнику на проверку.', done:null, fresh:true });
      msgs.push({who:'a',text:`Отправил «${mentor}» на ревью — на моём уровне всё идёт через проверку. Задача уже в очереди наставника.`});
      msgs.push({who:'note',note:`⏳ ${mentor} смотрит черновик…`});
      draw();
      setTimeout(()=>{ msgs.pop(); msgs.push({who:'a',text:`✅ ${mentor} проверил: 1 правка по форме, в остальном ок — принято и ушло в работу. Запись в аудит. Так я набираю репутацию и длину поводка.`});
        pushAudit({ who:'Стажёр · '+roleLabel(id), emoji:'🎓', act:'черновик принят наставником ('+mentor+')', dept:roleLabel(id) }); draw(); }, 1100);
      return;
    }
    if (senO.id==='head'){ msgs.push({who:'a',text:'Утвердил за команду в рамках бюджета отдела. Исполнение ушло рою, я держу чекпоинты на критичном. Запись в аудит.'});
      pushAudit({ who:'Руководитель · '+roleLabel(id), emoji:'🧑‍💼', act:'утвердил работу команды', dept:roleLabel(id) }); draw(); return; }
    if (senO.id==='owner'){ msgs.push({who:'a',text:'Принято. Необратимое — только через ваш апрув; красные линии конституции не задеты. Записано в аудит.'});
      pushAudit({ who:'Владелец', emoji:'⚙️', act:'утвердил необратимое действие', dept:roleLabel(id) }); draw(); return; }
    msgs.push({who:'a',text:'Принято и отправлено по процессу. Решил в рамках задачи, оформил итог. Записано в аудит.'});
    pushAudit({ who:'Специалист · '+roleLabel(id), emoji:'✅', act:'принял результат в работу', dept:roleLabel(id) }); draw();
  }
  /* правая колонка зависит от уровня — governance в действии (слой №4) */
  function senSide(senO){
    if (senO.id==='head'){
      const pend = queue.filter(q=>q.done===null).length;
      return `<div class="panel"><h2>✅ Очередь апрувов <span class="tag">${pend} ждут</span></h2>
        <div class="aq-sub">Работа команды, собранная роем и людьми — утверждайте или возвращайте.</div>
        ${queue.length?queue.map((q,i)=>`<div class="aq-item ${q.done||''} ${q.fresh&&!q.done?'fresh':''}" data-aq="${i}">
          <div class="aq-h"><b>${q.item}</b>${q.fresh?'<span class="aq-fresh">от стажёра</span>':''}<span class="risk ${q.risk}">${q.risk==='hi'?'высокий риск':q.risk==='med'?'средний':'низкий'}</span></div>
          <div class="aq-meta">${q.who} · ${q.cost}</div><div class="aq-note">${q.note}</div>
          ${q.done?`<div class="aq-verdict ${q.done}">${q.done==='ok'?'✓ утверждено · в работу':'↩ возвращено на доработку'}</div>`
            :`<div class="aq-acts"><button class="btn go aq-ok" data-i="${i}">Утвердить</button><button class="btn ghost aq-no" data-i="${i}">Вернуть</button></div>`}
        </div>`).join(''):`<div class="asst-empty">Очередь пуста — команда в потоке.</div>`}</div>`;
    }
    if (senO.id==='owner'){
      const ex = EXCEPTIONS[id]||[];
      return `<div class="panel"><h2>🚩 Сводка-исключения <span class="tag">${ex.length}</span></h2>
        <div class="aq-sub">Владелец не читает всё — видит только то, что вышло за норму и красные линии.</div>
        ${ex.length?ex.map(e=>`<div class="ex-item ${e.sev}"><span class="ex-dot"></span><div><b>${e.text}</b><small>${e.who}</small></div></div>`).join(''):`<div class="asst-empty">Исключений нет — всё в пределах политик.</div>`}
        <div class="od-gov" style="margin-top:10px">Норма исполняется автономно и попадает в аудит. Наверх всплывает только необратимое и нарушения конституции.</div></div>`;
    }
    if (senO.id==='intern'){
      return `<div class="panel asst-leash"><h2>🎓 Короткий поводок</h2>
        <div class="asst-leash-b">На уровне стажёра ассистент <b>только предлагает</b> — каждый черновик уходит «${MENTOR[id]||'наставнику'}» на ревью. Принятые работы копят репутацию → поводок удлиняется.</div>
        <div class="leash-bar"><i style="width:24%"></i></div><small class="leash-l">репутация · 24% до уровня «Специалист»</small></div>`;
    }
    return '';
  }
  function draw(){
    msgs = chats.list[chats.active].msgs;   // указываем на тред активного чата
    const senO = SENIORITY.find(s=>s.id===sen);
    const skN = inst.skills.length, agN = inst.agents.length;
    /* передачи: баннер виден всегда, со статусом (связь чат ↔ поток, обнаруживаемость) */
    const myFlows = FLOWS.filter(f=>f.steps.some(s=>s.role===id));
    const incoming = myFlows.filter(f=>{ const c=flowState()[f.id]; return f.steps[c] && f.steps[c].role===id; });
    const waiting = myFlows.filter(f=>{ const c=flowState()[f.id]; return f.steps[c] && f.steps[c].role!==id && f.steps.some((s,i)=>s.role===id && i>c); });
    const bannerHtml = incoming.length
      ? `<button class="asst-inflow in" id="asstInflow"><span class="aif-ic">🔄</span><div><b>Входящая работа: ${incoming[0].title}</b><small>коллега передал вам результат — сейчас ход за вами</small></div><span class="aif-go">Открыть в «Передачах» →</span></button>`
      : waiting.length
      ? `<button class="asst-inflow wait" id="asstInflow"><span class="aif-ic">⏳</span><div><b>Вы в потоке: ${waiting[0].title}</b><small>сейчас ход за коллегой — результат придёт к вам входящей работой</small></div><span class="aif-go">Смотреть «Передачи» →</span></button>`
      : myFlows.length
      ? `<button class="asst-inflow done" id="asstInflow"><span class="aif-ic">✓</span><div><b>Ваш шаг в потоке выполнен</b><small>${myFlows[0].title} — передано дальше, всё в аудите</small></div><span class="aif-go">Смотреть «Передачи» →</span></button>`
      : '';
    root.innerHTML = workHead(d, who?`Вы: ${who.name} · ${who.role} · рабочее место и личный ассистент`:'Моё рабочее место · личный ассистент') + `
    <div class="asst-top">
      <div class="asst-sen"><span class="asst-sen-l">Мой уровень:</span>${SENIORITY.map(s=>`<button data-sen="${s.id}" class="${s.id===sen?'on':''}">${s.label}</button>`).join('')}<span class="asst-sen-hint">↔ переключите — права, панели и видимые данные меняются</span></div>
      <div class="asst-can">Ассистент: <b>${senO.autonomy}</b> · охват: <b>${senO.scope}</b>
        ${who && personIdxByName(id, who.name)>=0 ? `<button class="btn ghost asst-myprof" data-myprof="${id}:${personIdxByName(id, who.name)}" style="margin-left:10px;padding:5px 11px;font-size:11.5px">Мой профиль →</button>` : ''}</div>
    </div>
    ${bannerHtml}
    <div class="asst">
      <div class="asst-chat">
        <div class="asst-tabs">${chats.list.map((ch,i)=>`<button class="asst-tab ${i===chats.active?'on':''}" data-chat="${i}" title="${escAttr(ch.title)}">${escHtml(ch.title.length>16?ch.title.slice(0,15)+'…':ch.title)}${chats.list.length>1?`<i class="asst-tab-x" data-chatx="${i}">×</i>`:''}</button>`).join('')}<button class="asst-tab new" id="asstNewChat">＋ Новый чат</button></div>
        <div class="asst-msgs" id="asstMsgs">${msgs.map(m=>msgHtml(m,senO)).join('')}</div>
        <div class="asst-chips">${P.tasks.map((t,i)=>`<button class="chip" data-task="${i}">${t.q}</button>`).join('')}</div>
        <div class="asst-input"><input id="asstIn" placeholder="Напишите ассистенту своими словами…"/><button class="send" id="asstSend">➤</button></div>
      </div>
      <aside class="asst-side">
        ${senSide(senO)}
        ${dataScopeHTML(id, sen)}
        <div class="panel"><h2>🧠 Мои умения <span class="tag">${skN}</span></h2>
          <div class="asst-skills">${inst.skills.map(s=>`<span class="asst-skill ${inst.fresh.has(s)?'fresh':''}">${s}</span>`).join('')}</div>
          <button class="asst-add" id="asstAddSk">＋ установить из библиотеки</button></div>
        <div class="panel"><h2>🤖 Мой рой <span class="tag">${agN}</span></h2>
          ${mySw?`<div class="asst-rolenote">под должность «${who.role}» · ${mySw.d}</div>`:''}
          ${inst.agents.map(a=>`<div class="asst-agent ${inst.fresh.has(a)?'fresh':''}">◆ ${a}</div>`).join('')}
          <button class="asst-add" id="asstAddAg">＋ нанять из библиотеки</button></div>
        <div class="panel asst-env"><b>Это одно из ${COMPANY_SIZE} рабочих мест компании.</b> Их связывает: общая библиотека · данные компании с правами · передача работы между людьми · governance. Вместе = <b style="color:var(--acc)">Среда</b>.</div>
      </aside>
    </div>`;
    root.querySelectorAll('[data-sen]').forEach(b=>b.onclick=()=>{ sen=b.dataset.sen; draw(); });
    root.querySelectorAll('[data-chat]').forEach(b=>b.onclick=(e)=>{ if(e.target.classList.contains('asst-tab-x')) return; chats.active=+b.dataset.chat; draw(); });
    root.querySelectorAll('[data-chatx]').forEach(x=>x.onclick=(e)=>{ e.stopPropagation(); const i=+x.dataset.chatx; chats.list.splice(i,1); if(chats.active>=chats.list.length) chats.active=chats.list.length-1; draw(); toast('Чат закрыт'); });
    const ncw=$('#asstNewChat',root); if(ncw) ncw.onclick=()=>{ chats.list.push({ title:'Новый чат', msgs:[{who:'a',text:P.hi}] }); chats.active=chats.list.length-1; draw(); toast('Открыт новый чат'); setTimeout(()=>{const inp=$('#asstIn',root); if(inp) inp.focus();},0); };
    root.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>ask(P.tasks[+b.dataset.task]));
    root.querySelectorAll('.asst-approve').forEach(b=>b.onclick=()=>onApprove(senO));
    root.querySelectorAll('.asst-return').forEach(b=>b.onclick=()=>{ msgs.push({who:'a',text:'Понял, доработал с учётом правок — на повторную проверку.'}); draw(); });
    root.querySelectorAll('.asst-openenv').forEach(b=>b.onclick=()=>{
      const lastU=[...msgs].reverse().find(m=>m.who==='u'); const q=(lastU?lastU.text:'').toLowerCase();
      const queue=[WORKBENCH[id], ...(WB_QUEUE[id]||[])];
      let idx=0, best=0;
      queue.forEach((w,i)=>{ const words=(w.title+' '+(w.kind||'')).toLowerCase().split(/[^а-яёa-z0-9]+/i);
        const score=words.filter(wd=>wd.length>3 && q.includes(wd)).length; if(score>best){ best=score; idx=i; } });
      const S=(window.__ENVST||(window.__ENVST={})); S[id]=S[id]||{active:0}; S[id].active=idx;
      navTo(id); if(idx>0) toast(`Открыт объект очереди: «${queue[idx].title}»`); });
    root.querySelectorAll('.aq-ok').forEach(b=>b.onclick=()=>{ const q=queue[+b.dataset.i]; q.done='ok';
      pushAudit({ who:'Руководитель · '+roleLabel(id), emoji:'✅', act:'утвердил: '+q.item, dept:roleLabel(id) }); draw(); toast('Утверждено — ушло в работу, запись в аудит'); });
    root.querySelectorAll('.aq-no').forEach(b=>b.onclick=()=>{ queue[+b.dataset.i].done='no'; draw(); toast('Возвращено автору на доработку'); });
    const inflow=$('#asstInflow',root); if(inflow) inflow.onclick=()=>navTo('flow:'+id);
    const myp=root.querySelector('[data-myprof]'); if(myp) myp.onclick=()=>navTo('person:'+myp.dataset.myprof);
    const addSk=$('#asstAddSk',root); if(addSk) addSk.onclick=()=>navTo('lib:'+id);
    const addAg=$('#asstAddAg',root); if(addAg) addAg.onclick=()=>navTo('lib:'+id);
    const send=()=>{ const v=$('#asstIn',root).value.trim(); if(!v) return; $('#asstIn',root).value='';
      if (rpgPhraseCheck(v)) return;
      const lc=v.toLowerCase();
      const hit = P.tasks.find(t=> t.q.toLowerCase().split(/[^а-яёa-z0-9]+/i).some(w=>w.length>3 && lc.includes(w)));
      if (hit) ask({ q:v, draft:hit.draft });
      else ask({ q:v, draft:'Уточните: какой результат нужен и по какому объекту (сделка/документ/тикет)? Соберу черновик и покажу на проверку — поправите руками. Подсказки — в чипах ниже.' }); };
    $('#asstSend',root).onclick=send; $('#asstIn',root).onkeydown=e=>{ if(e.key==='Enter') send(); };
    const mw=$('#asstMsgs',root); if(mw) mw.scrollTop=mw.scrollHeight;
  }
  draw();
  /* задача из глобальной модалки «Поставить задачу Среде» — приходит сюда и сразу уходит ассистенту */
  if (window.__PENDING_ASK && window.__PENDING_ASK.role===id){
    const v = window.__PENDING_ASK.text; delete window.__PENDING_ASK;
    setTimeout(()=>{ const inp=$('#asstIn',root); if(inp){ inp.value=v; $('#asstSend',root).click(); } }, 250);
  }
}

/* ========================================================================== */
/*  ПЕРЕДАЧА РАБОТЫ — слой связи: выход одного = вход другого                  */
/* ========================================================================== */
/* ========================================================================== */
/*  ПУЛЬС ОТДЕЛА — заземлённый живой поток задач у главы направления           */
/* ========================================================================== */
const DEPT_TASK = {
  dev:      { c:'#60a5fa', l:['PR #483','код-ревью','тест 143✓','деплой','миграция БД','фикс бага'] },
  sales:    { c:'#34d399', l:['КП','follow-up','лид','демо','скидка','реактивация'] },
  marketing:{ c:'#a78bfa', l:['лендинг','письмо','пост','SEO-аудит','креатив','UTM'] },
  design:   { c:'#a78bfa', l:['макет','UI-кит','прототип','иконки','a11y-чек','редизайн'] },
  analytics:{ c:'#22d3ee', l:['SQL-запрос','дашборд','когорта','воронка','прогноз','ETL'] },
  hr:       { c:'#f472b6', l:['скрининг','оффер','онбординг','1:1','вакансия','опрос'] },
  finance:  { c:'#fbbf24', l:['счёт','инвойс','бюджет','сверка','P&L','прогноз кэша'] },
  legal:    { c:'#f87171', l:['38-ФЗ','DPA','договор','NDA','претензия','ПДн-аудит'] },
};
const DP_CROSS = [ {t:'передача →',c:'#34d399'}, {t:'ревью',c:'#60a5fa'}, {t:'согласование',c:'#f87171'}, {t:'данные',c:'#22d3ee'} ];

/* ========================================================================== */
/*  ПУЛЬС КОМПАНИИ — сердце Среды: лого в центре, 8 отделов, живой поток      */
/* ========================================================================== */
const PULSE_LOGO = `
<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#f1f0ea" stroke-width="1.1" stroke-linejoin="round">
    <path d="M20 3 L34.7 11.5 L34.7 28.5 L20 37 L5.3 28.5 L5.3 11.5 Z" stroke-opacity=".95"/>
    <path d="M20 10.5 L28.2 15.25 L28.2 24.75 L20 29.5 L11.8 24.75 L11.8 15.25 Z" stroke-opacity=".4" stroke-width=".9"/>
    <g stroke-opacity=".55" stroke-width=".9">
      <path d="M20 3 L20 10.5"/><path d="M34.7 11.5 L28.2 15.25"/><path d="M34.7 28.5 L28.2 24.75"/>
      <path d="M20 37 L20 29.5"/><path d="M5.3 28.5 L11.8 24.75"/><path d="M5.3 11.5 L11.8 15.25"/>
    </g>
  </g>
  <circle class="pls-logo-halo" cx="20" cy="20" r="6.5" fill="#36c994" fill-opacity=".16"/>
  <circle class="pls-logo-dot" cx="20" cy="20" r="3.4" fill="#36c994"/>
</svg>`;

function renderPulse(root, d){
  root.innerHTML = workHead(d, `Нервная система компании · ${TOTAL_STAFF} нейронов: ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых (${DIGITAL_SHARE}% штата)`) + `
    <div class="pls-wrap">
      <div class="pls-stage cx-stage" id="cxStage" role="group" aria-label="Карта-пульс компании: отделы как кластеры нейронов">
        <div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Пульс компании по отделам: ${ROLE_IDS.map(r=>{ const dep=DEPARTMENTS.find(x=>x.id===r); const hc=(typeof HEADCOUNT!=='undefined'&&HEADCOUNT[r])||0; const dhc=(typeof DIGITAL_HEADCOUNT!=='undefined'&&DIGITAL_HEADCOUNT[r])||0; return `${dep?dep.label:r} — ${hc} людей и ${dhc} цифровых сотрудников`; }).join('; ')}. Клик по отделу — переход в его пульс, наведение на нейрон — имя и задача сотрудника.</div>
        <div class="pls-bgglow"></div>
        <div class="pls-core" id="plsCore" title="Запустить рой">
          <span class="pls-ring r1"></span><span class="pls-ring r2"></span>
          <div class="pls-logo">${PULSE_LOGO}</div>
          <b>СРЕДА</b>
        </div>
      </div>
      <aside class="pls-side">
        <button class="btn go pls-surge" id="plsSurge" title="Открыть пусковую: очередь проектов, которые можно запустить роем по всей компании">⚡ Запустить рой</button>
        <button class="btn ghost pls-proj" id="plsProj">🚀 ${MEGA_PROJECT.title} · ${projProgress().pct}%</button>
        <div class="side-normal">
        <div class="of-live"><span class="of-dot"></span><b id="pls-inflight">—</b> задач в работе <i>прямо сейчас</i></div>
        <div class="of-live"><span class="lg-mark d"></span><b id="pls-inf-d">—</b> делают цифровые сотрудники</div>
        <div class="of-live"><span class="lg-mark h" style="--c:#60a5fa"></span><b id="pls-inf-h">—</b> делают люди</div>
        <div class="of-live"><b id="pls-done">—</b> выполнено сегодня</div>
        <div class="of-live"><b id="pls-flows">—</b> сквозных потока активно</div>
        <div class="of-legend kind-legend">
          <span class="lg-h" style="--c:#60a5fa">человек · синий круг</span>
          <span class="lg-d">цифровой · изумрудный ромб</span>
          <span style="--c:#34d399">синапс = передача</span>
          <span style="--c:#f87171">⛔ застрял = гейт</span>
        </div>
        <div class="of-legend pls-legend">${ROLE_IDS.map(r=>{ const dep=DEPARTMENTS.find(x=>x.id===r);
          return `<span style="--c:${DEPT_TASK[r].c}">${dep.label.toLowerCase()}</span>`; }).join('')}</div>
        <div class="of-feed" id="plsFeed"></div>
        <div class="od-gov">Каждый нейрон — сотрудник из штатки: наведите — имя и задача, клик — профиль. Цепочки сделок бегут между конкретными людьми. <b>Колесо мыши</b> — приблизиться; докрутите на отделе — нырнёте в его пульс.</div>
        </div>
        <div class="side-proj" id="pjPanel" style="display:none"></div>
        <div class="side-proj" id="mpPanel" style="display:none"></div>
      </aside>
    </div>`;

  const stage=$('#cxStage',root), core=$('#plsCore',root);

  /* кластеры: реальные именные люди и цифровые, добитые типовыми до штатки */
  const clusters = ROLE_IDS.map(r=>{
    const dep=DEPARTMENTS.find(x=>x.id===r), cfg=COCKPITS[r], dt=DEPT_TASK[r];
    const named=cfg.team.map((tt,i)=>{ const p=Array.isArray(tt)?{name:tt[0],role:tt[1],task:tt[2]}:tt;
      return { name:p.name, sub:p.role, now:p.task, named:true, i }; });
    const hc=HEADCOUNT[r]||named.length, dhc=DIGITAL_HEADCOUNT[r]||0;
    const digsN=(DIGITAL_STAFF[r]||[]).map(w=>({ name:w.name, sub:w.title, now:w.now, named:true, id:w.id }));
    /* добивка до штата: КАЖДОМУ безымянному узлу — детерминированная личность */
    const genP=Array.from({length:Math.max(0,hc-named.length)},(_,gi)=>{ const g=genPerson(r,gi);
      return { name:g.full, sub:g.role, now:g.now, named:false, gen:true, gi, key:g.key }; });
    const genD=Array.from({length:Math.max(0,dhc-digsN.length)},(_,gi)=>{ const g=genWorker(r,gi);
      return { name:g.name, sub:g.title, now:g.now, named:false, gen:true, gi, key:g.key }; });
    return { id:r, label:dep.label, icon:dep.icon, color:dt.c, hc, dhc,
      people:[...named, ...genP],
      digital:[...digsN, ...genD] };
  });

  const feed=(mark, who, text, dgt)=>{ const f=$('#plsFeed',root); if(!f) return;
    const m = mark==='d' ? '<span class="lg-mark d"></span>'
      : mark==='x' ? '<span style="color:#34d399">→</span>'
      : mark==='g' ? '<span style="color:#f87171">⛔</span>'
      : `<span class="lg-mark h" style="--c:${mark}"></span>`;
    const row=el(`<div class="of-row fade-in">${m} <b>${who}</b>${dgt?' <i class="dgt-tag">цифровой</i>':''} ${text}</div>`);
    f.insertBefore(row,f.firstChild); while(f.children.length>6) f.removeChild(f.lastChild); };

  const cx = cortexMap(stage, {
    clusters, synapses:DEPT_SYN, coreEl:core,
    gated:(id)=>stepGate({role:id}).gated,
    onDive:(id,fromZoom)=>{ if(fromZoom) toast(`Ныряем в пульс «${roleLabel(id)}»`); navTo('dpulse:'+id); },
    onNode:(n)=>{ if(n.named&&n.type==='h') navTo('person:'+n.ci+':'+n.ref.i);
      else if(n.named&&n.type==='d') navTo('worker:'+n.ref.id);
      else if(n.ref&&n.ref.gen&&n.type==='h') navTo('gperson:'+n.ci+':'+n.ref.gi);
      else if(n.ref&&n.ref.gen&&n.type==='d') navTo('gworker:'+n.ci+':'+n.ref.gi);
      else navTo('team:'+n.ci); },
  });
  window.__CX = cx; /* отладочный хук для e2e-проверок */

  /* ── мегапроект CEO: трасса, живые статусы, доведение до конца ── */
  let projMode=false, projGen=0;
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const projBtnLbl=()=>{ const P=projProgress(); const n=ALL_PROJECTS().filter(p=>p.launched).length;
    return P.pct>=100 ? `✓ Проекты компании — завершены` : `🚀 Проекты компании · ${n} актив${n===1?'ен':'ны'} · ${P.pct}%`; };
  function projPanelHTML(){
    const tasks=projTasks();
    return ALL_PROJECTS().filter(p=>p.launched).map(pr=>{
      const ts=tasks.filter(t=>t.proj===pr.id);
      const done=ts.filter(t=>t.state==='done').length, pct=Math.round(done/ts.length*100);
      const byPhase={}; ts.forEach(t=>{ (byPhase[t.phase]=byPhase[t.phase]||[]).push(t); });
      return `<div class="pj-head"><b>${pr.icon} ${pr.title}</b><small>${pr.ask}</small>
        <small class="pj-meta">спонсор: ${pr.sponsor} · дедлайн ${pr.deadline}</small>
        ${rpgBar(pct,'ok')}<small class="pj-meta">${done}/${ts.length} задач готово${pct>=100?' · 🎉 завершён':''}</small></div>
      ${Object.keys(byPhase).map(phT=>{ const pts=byPhase[phT]; const ds=pts.filter(t=>t.state==='done').length;
        return `<div class="pj-phase"><b>${phT} <span>${ds}/${pts.length}</span></b>
        ${pts.map(t=>{ const s=PROJ_STATE[t.state];
          return `<button class="pj-task" data-pj="${t.dept}:${t.who}"><i style="color:${s[2]}">${s[0]}</i><div><b>${t.who} · ${roleLabel(t.dept)}</b><small>${t.t}${t.dw?' · 🤖 '+t.dw:''}</small></div><span style="color:${s[2]}">${s[1]}</span></button>`
          + (t.state==='blocked'?`<button class="pj-fix" data-fix="${t.dept}">⛔ снять sev1-риск — рабочий стол «${roleLabel(t.dept)}» →</button>`:''); }).join('')}
        </div>`; }).join('')}`;
    }).join('<div style="height:10px"></div>')
    + `<div class="od-gov">Трасса закрывает задачи «в работе» по всем активным проектам. ⛔ — реальный гейт. Новые проекты — кнопка «⚡ Запустить рой».</div>`;
  }
  function refreshProj(){
    const pp=$('#pjPanel',root); if(pp && projMode){ pp.innerHTML=projPanelHTML(); wireProj(); }
    const pb=$('#plsProj',root); if(pb && !projMode) pb.innerHTML=projBtnLbl();
    cx.setFocus(projMode ? projTasks().flatMap(t=>[cx.findNode(t.dept,t.who,'h'), t.dw?cx.findNode(t.dept,t.dw,'d'):null]).filter(x=>x!=null) : null);
  }
  function wireProj(){
    root.querySelectorAll('[data-pj]').forEach(b=>b.onclick=()=>{ const [dp,who]=b.dataset.pj.split(':');
      const i=personIdxByName(dp,who); if(i>=0) navTo('person:'+dp+':'+i); else navTo('team:'+dp); });
    root.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{ toast('Рабочий стол юриста: исправьте sev1-пункт договора руками — гейт откроется'); navTo(b.dataset.fix); });
  }
  function celebrate(){
    if(projStore().launched) return; projStore().launched=true;
    cx.surgeWave();
    ROLE_IDS.forEach((r,i)=>setTimeout(()=>cx.corePulse(r,'🚀 Среда запущена','#e8c468'), i*180));
    setTimeout(()=>cx.surgeWave(), 900);
    feed('x','🚀 '+MEGA_PROJECT.title,'— все 17 задач закрыты, продукт запущен');
    pushAudit({ who:MEGA_PROJECT.sponsor, what:'Мегапроект завершён: '+MEGA_PROJECT.title+' — продукт запущен', verdict:'allow' });
    toast('🎉 «Среда» запущена — проект пройден от задачи CEO до релиза');
  }
  async function projTrace(gen){
    while(projMode && gen===projGen && document.body.contains(stage)){
      const tasks=projTasks();                      /* статусы пересчитываются каждый круг */
      let prev=null;
      for(const t of tasks){
        if(!projMode||gen!==projGen||!document.body.contains(stage)) return;
        const ni=cx.findNode(t.dept, t.who, 'h'); if(ni==null) continue;
        const col=PROJ_STATE[t.state][2], blocked=t.state==='blocked';
        /* цифровой напарник несёт черновик человеку — гибридная пара в деле */
        if(t.dw && t.state!=='wait'){ const di=cx.findNode(t.dept, t.dw, 'd');
          if(di!=null) cx.impulse(di, ni, { label:'🤖 '+t.dw+' · черновик', color:'#36c994', dur:1.3 }); }
        if(prev==null){ cx.corePulse(t.dept, '🚀 '+t.t, col); await sleep(1400); }
        else await cx.impulse(prev, ni, { label:(blocked?'⛔ ':'')+t.t, color:col, dur:1.8, size:4, stuck:blocked,
          pop:t.state==='done'?`${t.who}: готово · ${t.out}`:'' });
        if(blocked) feed('g', `${t.who} · ${roleLabel(t.dept)}`, `гейт sev1 — «${t.t}» ждёт человека. Снять: рабочий стол юриста`);
        /* трасса дошла до работающего — задача закрывается */
        if(!blocked && t.state==='active' && Math.random()<0.6){
          projComplete(t.dept, t.who);
          feed(DEPT_TASK[t.dept].c, t.who, `закрыл(а) задачу проекта: «${t.t}» ✓`);
          refreshProj();
          if(projProgress().pct>=100){ celebrate(); refreshProj(); }
        }
        prev=ni;
      }
      await sleep(2400);
    }
  }
  function setProj(on){
    projMode=on; projGen++;
    const pb=$('#plsProj',root), pn=root.querySelector('.side-normal'), pp=$('#pjPanel',root);
    const mp=$('#mpPanel',root); if(mp&&on){ mp.style.display='none'; const sb=$('#plsSurge',root); if(sb) sb.innerHTML='⚡ Запустить рой'; }
    if(pb){ pb.classList.toggle('on',on); pb.innerHTML = on ? '← Обычный пульс' : projBtnLbl(); }
    if(pn) pn.style.display=on?'none':'';
    if(pp){ pp.style.display=on?'':'none'; if(on){ pp.innerHTML=projPanelHTML(); wireProj(); } }
    cx.setFocus(on ? projTasks().flatMap(t=>[cx.findNode(t.dept,t.who,'h'), t.dw?cx.findNode(t.dept,t.dw,'d'):null]).filter(x=>x!=null) : null);
    if(on){ pushAudit({ who:MEGA_PROJECT.sponsor, what:'Поставил задачу: '+MEGA_PROJECT.title+' — трасса проекта на пульсе', verdict:'allow' });
      toast('CEO поставил задачу — компания подсветила исполнителей, трасса побежала'); projTrace(projGen); }
  }
  const pjBtn=$('#plsProj',root); if(pjBtn){ pjBtn.onclick=()=>setProj(!projMode); pjBtn.innerHTML=projBtnLbl(); }

  const synTotal=DEPT_SYN.reduce((a,s)=>a+s.w,0);
  const pickSyn=()=>{ let r=Math.random()*synTotal; for(const s of DEPT_SYN){ if((r-=s.w)<0) return s; } return DEPT_SYN[0]; };
  const randDept = () => ROLE_IDS[Math.floor(Math.random()*ROLE_IDS.length)];

  /* сюжет: сквозная цепочка из FLOWS бежит по конкретным людям; гейт её останавливает */
  let storyI=0, storyBusy=false;
  async function runStory(){
    if(storyBusy) return; storyBusy=true;
    const f=FLOWS[storyI++ % FLOWS.length];
    feed('x', f.icon+' '+f.title, '— цепочка пошла по компании');
    for(let i=0;i<f.steps.length-1;i++){
      const s=f.steps[i], nx=f.steps[i+1];
      const blocked = stepGate(nx).gated;
      const ai=cx.findNode(s.role, s.who, 'h'), bi=cx.findNode(nx.role, nx.who, 'h');
      const ok=await cx.impulse(ai, bi, { label:s.out, color:'#34d399', dur:2.6, size:4, stuck:blocked });
      if(blocked){ feed('g', `${nx.who} · ${roleLabel(nx.role)}`, `гейт закрыт (sev1) — «${s.out}» ждёт решения человека`); break; }
      if(!ok) break;
      feed(DEPT_TASK[nx.role].c, nx.who, `принял(а): ${s.out}`);
    }
    storyBusy=false;
  }

  const FEED=[
    ['d','Алгоритм','собрал черновик PR #'+(480+(Date.now()%40)),'dev'],
    ['d','Скоринг','квалифицировал 9 лидов','sales'],
    ['h','Оля','поправила скидку и приняла КП «Гамма»','sales'],
    ['d','Голос','текст лендинга готов — на проверку Поле','marketing'],
    ['h','Игорь','утвердил merge PR #482','dev'],
    ['d','Витрина','пересчитал воронку','analytics'],
    ['h','Ира','сняла sev1-риск в договоре','legal'],
    ['d','Кодекс','проверка по 38-ФЗ пройдена','legal'],
    ['d','Кит','4 варианта макета — на ревью Вере','design'],
    ['h','Вера','приняла вариант B чекаута','design'],
    ['d','Регресс','прогон тестов · 143 ✓','dev'],
    ['d','Скрин','скрининг 48 откликов готов','hr'],
    ['h','Марина','утвердила оффер финалисту','hr'],
    ['d','Модель','пересчёт сценария кэш-флоу','finance'],
    ['h','Рома','подтвердил сверку июня','finance'],
    ['x','Оля → Ира','КП «Гамма» передано в Юр','sales']];
  let done = 12480 + Math.floor(Math.random()*200), tick=0;
  const baseInf = Math.round(DIGITAL_SIZE*1.6);
  clearInterval(window.__pulseTimer);
  window.__pulseTimer=setInterval(()=>{
    if(!document.body.contains(stage)){ clearInterval(window.__pulseTimer); cx.destroy(); return; }
    tick++;
    /* фоновая жизнь приглушается в режиме проекта — сцена принадлежит трассе */
    if(!projMode) for(let q=0;q<2;q++){
      const r=randDept(), dt=DEPT_TASK[r];
      const isD=Math.random()<0.62;
      let who='';
      if(Math.random()<0.4){
        if(isD){ const pool=DIGITAL_STAFF[r]||[]; if(pool.length) who=pool[Math.floor(Math.random()*pool.length)].name; }
        else { const t=COCKPITS[r].team; const p=t[Math.floor(Math.random()*t.length)]; who=Array.isArray(p)?p[0]:p.name; }
      }
      const task=(isRPG()&&Math.random()<0.04)?'🐴 Плотва · срочный квест':dt.l[Math.floor(Math.random()*dt.l.length)];
      cx.localPulse(r, who?(isD?'🤖 ':'👤 ')+who+' · '+task:'');
    }
    /* задача из ядра в отдел */
    if(!projMode && tick%2===0){ const r=randDept(), dt=DEPT_TASK[r];
      cx.corePulse(r, Math.random()<0.4?dt.l[Math.floor(Math.random()*dt.l.length)]:'', dt.c); }
    /* передача по межотделовому синапсу — между конкретными людьми */
    if(!projMode && Math.random()<0.5){ const s=pickSyn();
      cx.impulse(cx.findNode(s.a,null,'h'), cx.findNode(s.b,null,'h'),
        { label:Math.random()<0.55?s.art[Math.floor(Math.random()*s.art.length)]:'', color:'#34d399', dur:2.3 }); }
    /* сюжетная цепочка сделки и волна-дыхание */
    if(!projMode && tick%12===5) runStory();
    if(tick%9===2) cx.surgeWave();
    done += 3+Math.floor(Math.random()*4);
    const infV=Math.max(1,baseInf+Math.round((Math.random()-0.5)*60));
    const infD=Math.round(infV*0.62), infH=infV-infD;
    const inf=$('#pls-inflight',root); if(inf) inf.textContent=infV.toLocaleString('ru');
    const ifd=$('#pls-inf-d',root); if(ifd) ifd.textContent=infD.toLocaleString('ru');
    const ifh=$('#pls-inf-h',root); if(ifh) ifh.textContent=infH.toLocaleString('ru');
    const dn=$('#pls-done',root); if(dn) dn.textContent=done.toLocaleString('ru');
    const FS=flowState(); const fl=$('#pls-flows',root); if(fl) fl.textContent=FLOWS.filter(f=>FS[f.id]<f.steps.length).length;
    if(tick%3===1){ const f=FEED[Math.floor(Math.random()*FEED.length)];
      feed(f[0]==='d'?'d':f[0]==='x'?'x':DEPT_TASK[f[3]].c, f[1], f[2], f[0]==='d'); }
  }, 760);

  /* ── «Запустить рой» = пусковая установка: очередь сформированных запросов ── */
  let launchMode=false;
  function launchPanelHTML(){
    const launched=ALL_PROJECTS().filter(p=>p.launched), queue=ALL_PROJECTS().filter(p=>!p.launched);
    const tasks=projTasks();
    return `<div class="pj-head"><b>⚡ Пусковая Среды</b><small>Сформированные запросы компании: бриф готов, исполнители подобраны. Запуск раздаёт задачи людям и цифровым — проект оживает на карте.</small></div>
    ${launched.length?`<div class="pj-phase"><b>В полёте <span>${launched.length}</span></b>
      ${launched.map(pr=>{ const ts=tasks.filter(t=>t.proj===pr.id); const pct=Math.round(ts.filter(t=>t.state==='done').length/ts.length*100);
        return `<button class="pj-task" data-mpgo="1"><i>${pr.icon}</i><div><b>${pr.title}</b><small>${ts.length} задач · ${pct}%</small></div><span style="color:var(--acc)">трасса →</span></button>`; }).join('')}</div>`:''}
    ${queue.length?`<div class="pj-phase"><b>Сформированные запросы <span>${queue.length}</span></b>
      ${queue.map(pr=>{ const n=pr.phases.reduce((a,ph)=>a+ph.tasks.length,0);
        const deps=[...new Set(pr.phases.flatMap(ph=>ph.tasks.map(t=>roleLabel(t.dept))))].join(' · ');
        return `<div class="mp-q"><div class="mp-qh"><i>${pr.icon}</i><div><b>${pr.title}</b><small>${pr.ask}</small><small class="pj-meta">${n} задач · ${deps} · ${pr.deadline}</small></div></div>
          <button class="btn go" data-mplaunch="${pr.id}">⚡ Запустить рой</button></div>`; }).join('')}</div>`
      :'<div class="od-gov empty-note">Очередь пуста — все запросы запущены.</div>'}
    <div class="od-gov">Уровни запуска: проекты компании — здесь · задачи отдела — «⚡» на пульсе отдела · обычная задача — ⌘K «Поставить задачу Среде».</div>`;
  }
  function setLaunch(on){
    launchMode=on; if(on&&projMode) setProj(false);
    const pn=root.querySelector('.side-normal'), mp=$('#mpPanel',root), sb=$('#plsSurge',root);
    if(pn) pn.style.display=(on||projMode)?'none':'';
    if(mp){ mp.style.display=on?'':'none'; if(on){ mp.innerHTML=launchPanelHTML(); wireLaunch(); } }
    if(sb) sb.innerHTML = on?'← Закрыть пусковую':'⚡ Запустить рой';
  }
  function wireLaunch(){
    root.querySelectorAll('[data-mpgo]').forEach(b=>b.onclick=()=>{ setLaunch(false); setProj(true); });
    root.querySelectorAll('[data-mplaunch]').forEach(b=>b.onclick=()=>{
      const pr=ALL_PROJECTS().find(p=>p.id===b.dataset.mplaunch); mpLaunch(pr.id);
      cx.surgeWave();
      pr.phases.flatMap(ph=>ph.tasks).forEach((t,i)=>setTimeout(()=>cx.corePulse(t.dept,'🚀 '+t.t,PROJ_STATE[queueTaskState(pr,t)][2]), 250*i));
      pushAudit({ who:pr.sponsor, what:'Запустил рой: '+pr.title+' — задачи розданы исполнителям', verdict:'allow' });
      toast(`«${pr.title}» запущен — ${pr.phases.reduce((a,ph)=>a+ph.tasks.length,0)} задач разлетелись по отделам`);
      const pb=$('#plsProj',root); if(pb&&!projMode) pb.innerHTML=projBtnLbl();
      setLaunch(true);
    });
  }
  $('#plsSurge',root).onclick = ()=>setLaunch(!launchMode);
  core.onclick = ()=>setLaunch(true);
}

/* ========================================================================== */
/*  ПУЛЬС ОТДЕЛА — живой поток задач в границах одного отдела                */
/* ========================================================================== */
/* распределение штата по функциям пропорционально именным позициям (метод наибольших остатков) */
function allocByWeights(total, weights){
  const sumW = weights.reduce((a,b)=>a+b,0) || 1;
  const raw = weights.map(w => total * w / sumW);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((a,b)=>a+b,0);
  const order = raw.map((r,i)=>[r-base[i],i]).sort((a,b)=>b[0]-a[0]);
  for(let k=0; k<rest; k++) base[order[k % order.length][1]]++;
  return base;
}
function renderDeptPulse(root, roleId){
  const d = DEPARTMENTS.find(x=>x.id===roleId) || {icon:'🫀',label:roleId};
  const cfg = COCKPITS[roleId]; if(!cfg){ root.innerHTML=workHead(d,'Пульс отдела')+'<div class="flow-empty">нет данных отдела</div>'; return; }
  const dt=DEPT_TASK[roleId]||{c:'#34d399',l:['задача']};
  const team = cfg.team.map((t,i)=>Array.isArray(t)?{name:t[0],role:t[1],task:t[2],emoji:t[3],fn:t[4],i}:{...t,i});
  const digs = (DIGITAL_STAFF[roleId]||[]).map((w,i)=>({...w,i}));
  const hc=HEADCOUNT[roleId]||team.length, dhc=DIGITAL_HEADCOUNT[roleId]||digs.length;
  const groupsH={}; team.forEach(p=>{ const f=p.fn||'Команда'; (groupsH[f]=groupsH[f]||[]).push(p); });
  const fns=Object.keys(groupsH);
  const digsByFn={}; digs.forEach(w=>{ const f=fns.indexOf(w.fn)>=0?w.fn:fns[0]; (digsByFn[f]=digsByFn[f]||[]).push(w); });
  /* числа сходятся со штатом: hc и dhc разложены по функциям */
  const hAlloc = allocByWeights(hc, fns.map(f=>groupsH[f].length));
  const dAlloc = allocByWeights(dhc, fns.map(f=>groupsH[f].length + (digsByFn[f]?digsByFn[f].length:0)));
  const gated = stepGate({role:roleId}).gated;
  const leadId = 'h'+team[0].i;
  /* мегапроект CEO в этом отделе */
  const PJ = (typeof projTasksOf==='function') ? projTasksOf(roleId) : [];
  const pjByName = {}; PJ.forEach(t=>pjByName[t.who]=t);

  /* нейроны: каждый узел — живой сотрудник из штата */
  const nodes=[];
  fns.forEach((f,fi)=>nodes.push({ id:'#'+f, kind:'cluster', label:f, sub:`👤 ${hAlloc[fi]} · 🤖 ${dAlloc[fi]}`, color:dt.c, title:'Открыть команду' }));
  team.forEach(p=>{ const q=questsOf(roleId,p.name,p.task);
    const st=(p.i===0&&gated)?'block':(rpgHash(p.name+roleId)%5===0?'wait':'ok');
    nodes.push({ id:'h'+p.i, kind:'h', label:p.name, sub:p.role, av:humanAv(roleId,p.name,'#60a5fa','nm'),
      color:'#60a5fa', size:48+q.length*5, status:st, cls:pjByName[p.name]?'proj':'',
      title:`${p.name} · ${p.role}${pjByName[p.name]?' · 🚀 в мегапроекте':''} — открыть профиль`, p }); });
  digs.forEach(w=>nodes.push({ id:'d'+w.i, kind:'d', label:w.name, sub:'цифровой', av:`<span class="nm-em">${w.emoji}</span>`,
    color:'#36c994', size:42, status:w.status==='paused'?'wait':'ok', title:`${w.name} · ${w.title} — открыть профиль`, w }));
  /* добивка до штата: КАЖДОМУ безымянному нейрону — детерминированная личность.
     Распределяем по функциям, как в Пульсе компании; роуты ведут в gperson/gworker. */
  const genH=[], genD=[];
  if (typeof genPerson==='function'){
    const needH=Math.max(0,hc-team.length), needD=Math.max(0,dhc-digs.length);
    for(let gi=0;gi<needH;gi++){ const g=genPerson(roleId,gi); const f=fns[gi%fns.length];
      nodes.push({ id:'gh'+gi, kind:'h', gen:true, gi, fn:f, label:g.full, sub:g.role,
        av:`<span class="nm-em" style="font-style:normal">${g.name[0]}</span>`,
        color:'#60a5fa', size:40, status:'ok', title:`${g.full} · ${g.role} — открыть профиль` });
      genH.push({ id:'gh'+gi, f }); }
    for(let gi=0;gi<needD;gi++){ const g=genWorker(roleId,gi); const f=fns[gi%fns.length];
      nodes.push({ id:'gd'+gi, kind:'d', gen:true, gi, fn:f, label:g.name, sub:'цифровой',
        av:`<span class="nm-em">${g.emoji}</span>`,
        color:'#36c994', size:36, status:'ok', title:`${g.name} · ${g.title} — открыть профиль` });
      genD.push({ id:'gd'+gi, f }); }
  }
  /* агенты Среды на контракте — «жидкие» нейроны на контактной поверхности */
  const tlh = tlHiredOf(roleId).map((h,i)=>({ h, a:talentAgent(h.aid), i }));
  tlh.forEach(x=>nodes.push({ id:'t'+x.i, kind:'d', cls:'tlq', label:x.a.name.split(' ')[0], sub:'агент Среды',
    av:`<span class="nm-em" style="font-style:normal">${x.a.name[0]}</span>`, color:'#36c994', size:44, status:'ok',
    title:`${x.a.name} · контракт Talent — открыть`, t:x }));

  /* синапсы: руководитель ↔ функции, цепочки внутри функций, цифровой → его человек */
  const links=[];
  fns.forEach(f=>{ if(!groupsH[f].some(p=>p.i===team[0].i)) links.push({ a:leadId, b:'#'+f, w:groupsH[f].length*1.7, color:dt.c, op:.13 }); });
  fns.forEach(f=>{ const g=groupsH[f];
    if(g.length) links.push({ a:'#'+f, b:'h'+g[0].i, w:2, color:dt.c, op:.16 });
    for(let k=0;k<g.length-1;k++) links.push({ a:'h'+g[k].i, b:'h'+g[k+1].i, w:1.6, color:dt.c, op:.20 }); });
  digs.forEach(w=>{ const ln=(w.lead||'').split(' · ')[0]; const t=team.find(p=>p.name===ln);
    links.push({ a:'d'+w.i, b:t?'h'+t.i:'#'+(fns.indexOf(w.fn)>=0?w.fn:fns[0]), w:2.4, color:'#36c994', op:.26 }); });
  tlh.forEach(x=>links.push({ a:'t'+x.i, b:leadId, w:2.2, color:'#2dd4bf', op:.32 }));
  genH.forEach(x=>links.push({ a:x.id, b:'#'+x.f, w:1.3, color:dt.c, op:.10 }));
  genD.forEach(x=>links.push({ a:x.id, b:'#'+x.f, w:1.3, color:'#36c994', op:.12 }));

  root.innerHTML = workHead(d, `Пульс отдела «${cfg.role}» · ${hc} людей + ${dhc} цифровых · каждый нейрон — живой сотрудник`) + `
    ${PJ.length?`<div class="pj-strip"><b>🚀 ${MEGA_PROJECT.title} в отделе · ${PJ.length}</b>
      ${PJ.map(t=>{ const s=PROJ_STATE[t.state];
        return `<button class="pj-chip" data-pjp="${t.who}" style="--c:${s[2]}"><i>${s[0]}</i><b>${t.who}${t.dw?' + 🤖 '+t.dw:''}</b><small>${t.t}</small></button>`; }).join('')}</div>`:''}
    <div class="dp-wrap">
      <div class="dp-stage nm-stage" id="dpStage" role="group" aria-label="Карта-пульс отдела «${cfg.role}»: функции и сотрудники как нейроны"><div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Пульс отдела «${cfg.role}»: ${hc} людей и ${dhc} цифровых сотрудников по функциям — ${fns.map((f,fi)=>`${f}: ${hAlloc[fi]} людей и ${dAlloc[fi]} цифровых`).join('; ')}. Клик по нейрону — профиль сотрудника.</div></div>
      <aside class="dp-side">
        <button class="btn go pls-surge" id="dpSurge" title="Открыть пусковую отдела: очередь задач бэклога, которые можно запустить роем">⚡ Запустить рой</button>
        <div class="side-proj" id="dpQueue" style="display:none"></div>
        <div class="of-live"><span class="of-dot"></span><b id="dp-inflight">—</b> задач в работе <i>в отделе</i></div>
        <div class="of-live"><span class="lg-mark d"></span><b id="dp-inf-d">—</b> делают цифровые сотрудники</div>
        <div class="of-live"><span class="lg-mark h" style="--c:#60a5fa"></span><b id="dp-inf-h">—</b> делают люди</div>
        <div class="of-live"><b id="dp-done">—</b> выполнено сегодня</div>
        <div class="of-legend kind-legend">
          <span class="lg-h" style="--c:#60a5fa">человек · синий круг</span>
          <span class="lg-d">цифровой · изумрудный ромб</span>
          <span style="--c:#f87171">⛔ гейт: импульс застрял</span>
        </div>
        <div class="of-feed" id="dpFeed"></div>
        <div class="od-gov">Размер нейрона — загрузка, свечение — статус. Импульс — реальная задача: дошёл → нейрон «возбудился». <b style="color:#f87171">Красный застрявший импульс</b> — гейт закрыт (sev1). Наведите на нейрон — увидите его связи. Клик — профиль.</div>
      </aside>
    </div>`;
  const stage=$('#dpStage',root);
  const map = neuralMap(stage, { nodes, links,
    layout:(W,H)=>neuralClusterLayout(W,H, fns.map(f=>({ id:f, items:[...groupsH[f].map(p=>'h'+p.i), ...(digsByFn[f]||[]).map(w=>'d'+w.i), ...genH.filter(x=>x.f===f).map(x=>x.id), ...genD.filter(x=>x.f===f).map(x=>x.id)] })), { memberR:50, rx:.36, ry:.34 }),
    onClick:(n)=>{ if(n.gen&&n.kind==='h') navTo('gperson:'+roleId+':'+n.gi); else if(n.gen&&n.kind==='d') navTo('gworker:'+roleId+':'+n.gi); else if(n.kind==='h') navTo('person:'+roleId+':'+n.p.i); else if(n.t) navTo('tagent:'+n.t.a.id); else if(n.kind==='d') navTo('worker:'+n.w.id); else navTo('team:'+roleId); } });
  root.querySelectorAll('[data-pjp]').forEach(b=>b.onclick=()=>{ const i=personIdxByName(roleId, b.dataset.pjp);
    if(i>=0) navTo('person:'+roleId+':'+i); });

  /* ── пусковая отдела: запуск задач из бэклога доски ── */
  let dq=false;
  function dpQueueHTML(){
    const bk=(cfg.board&&cfg.board.backlog)||[];
    return `<div class="pj-head"><b>⚡ Очередь отдела</b><small>Бэклог доски «${cfg.role}»: запуск назначает исполнителя, задача уходит «В работу», импульс — на карте.</small></div>
    ${bk.length?bk.map((it,i)=>`<div class="mp-q"><div class="mp-qh"><i>📋</i><div><b>${it.id}</b><small>${it.t}</small></div></div>
      <button class="btn go" data-dql="${i}">⚡ Запустить</button></div>`).join('')
      :'<div class="od-gov empty-note">Бэклог пуст. Обычная задача — ⌘K «Поставить задачу Среде».</div>'}`;
  }
  function setDQ(on){ dq=on; const q=$('#dpQueue',root), sb=$('#dpSurge',root);
    if(q){ q.style.display=on?'':'none'; if(on){ q.innerHTML=dpQueueHTML(); wireDQ(); } }
    if(sb) sb.innerHTML=on?'← Закрыть очередь':'⚡ Запустить рой'; }
  function wireDQ(){
    root.querySelectorAll('[data-dql]').forEach(b=>b.onclick=()=>{
      const it=cfg.board.backlog[+b.dataset.dql]; if(!it) return;
      const ex=team[1+Math.floor(Math.random()*(team.length-1))]||team[0];
      cfg.board.backlog=cfg.board.backlog.filter(x=>x!==it);
      (cfg.board.work=cfg.board.work||[]).push({ ...it, who:ex.name, agents:['backend','review'] });
      map.impulse(leadId, 'h'+ex.i, { label:'⚡ '+it.id+' · '+it.t, color:dt.c, dur:1.6, pop:ex.name+': принял · '+it.id });
      pushAudit({ who:(Array.isArray(cfg.team[0])?cfg.team[0][0]:cfg.team[0].name)+' · '+cfg.role, what:`Запустил из бэклога: ${it.id} «${it.t}» → ${ex.name}`, verdict:'allow' });
      toast(`${it.id} запущена — исполнитель ${ex.name}, задача на доске «В работе»`);
      setDQ(true);
    });
  }
  const dsb=$('#dpSurge',root); if(dsb) dsb.onclick=()=>setDQ(!dq);

  const FEEDV=[['собрал черновик:',dt.l[0]],['закрыл',dt.l[1]||dt.l[0]],['проверил',dt.l[2]||dt.l[0]],['передал дальше','результат']];
  const baseInf=Math.round((hc+dhc)*0.6);
  let done=Math.round(hc*7 + Math.random()*40), tick=0;
  clearInterval(window.__pulseTimer);
  window.__pulseTimer=setInterval(()=>{
    if(!document.body.contains(stage)){ clearInterval(window.__pulseTimer); map.destroy(); return; }
    tick++;
    for(let k=0;k<2;k++){
      const l=links[Math.floor(Math.random()*links.length)];
      const rev=Math.random()<0.5; const a=rev?l.b:l.a, b=rev?l.a:l.b;
      const an=nodes.find(n=>n.id===a), bn=nodes.find(n=>n.id===b);
      const isD=a[0]==='d'||b[0]==='d';
      const task=(isRPG()&&Math.random()<0.06)?'🐴 Плотва · срочный квест':dt.l[Math.floor(Math.random()*dt.l.length)];
      const who=an&&an.kind!=='cluster'?an.label:'';
      const lbl=Math.random()<0.42?((isD?'🤖 ':'👤 ')+(who?who+' · ':'')+task):'';
      const pop=(Math.random()<0.4&&bn&&bn.kind!=='cluster')?`${bn.label}: принял · ${task}`:'';
      map.impulse(a,b,{ label:lbl, color:isD?'#36c994':dt.c, kind:isD?'d':'h', dur:1.3+Math.random()*0.7, pop });
    }
    /* тормозной синапс: сигнал идёт, но гейт закрыт — нейрон не возбуждается */
    if(gated && tick%8===0){ const src=team[1]||team[0];
      map.impulse('h'+src.i, leadId, { label: roleId==='dev'?'⛔ PR #482 · sev1-гейт':'⛔ '+cfg.gate+' · sev1-гейт', color:'#f87171', blocked:true, dur:1.7 }); }
    /* импульсы мегапроекта: лид → исполнитель, у заблокированной задачи — стоп */
    if(PJ.length && tick%6===2){ const t=PJ[Math.floor(Math.random()*PJ.length)];
      const tn=team.find(p=>p.name===t.who);
      if(tn && 'h'+tn.i!==leadId) map.impulse(leadId, 'h'+tn.i,
        { label:'🚀 '+t.t, color:PROJ_STATE[t.state][2], blocked:t.state==='blocked', dur:1.6,
          pop:t.state==='done'?t.who+': готово · '+t.out:'' }); }
    done+=3+Math.floor(Math.random()*3); const di=$('#dp-done',root); if(di) di.textContent=done.toLocaleString('ru');
    const inf=Math.max(1,baseInf+Math.round((Math.random()-0.5)*baseInf*0.4));
    const infD=Math.round(inf*0.62), infH=inf-infD;
    const i1=$('#dp-inflight',root); if(i1) i1.textContent=inf.toLocaleString('ru');
    const i2=$('#dp-inf-d',root); if(i2) i2.textContent=infD.toLocaleString('ru');
    const i3=$('#dp-inf-h',root); if(i3) i3.textContent=infH.toLocaleString('ru');
    const feed=$('#dpFeed',root); if(feed){
      const isD = Math.random()<0.6; const v=FEEDV[Math.floor(Math.random()*FEEDV.length)];
      const row = isD && digs.length
        ? el(`<div class="of-row fade-in"><span class="lg-mark d"></span> <b>${digs[Math.floor(Math.random()*digs.length)].name}</b> <i class="dgt-tag">цифровой</i> ${v[0]} ${v[1]}</div>`)
        : el(`<div class="of-row fade-in"><span class="lg-mark h" style="--c:${dt.c}"></span> <b>${team[Math.floor(Math.random()*team.length)].name}</b> ${v[0]} ${v[1]}</div>`);
      feed.insertBefore(row,feed.firstChild); while(feed.children.length>5) feed.removeChild(feed.lastChild); }
  }, 820);
}

function flowState(){ return window.__FLOWST || (window.__FLOWST = { gamma:0, launch:2, hire:1 }); }
function flowRet(){ return window.__FLOWRET || (window.__FLOWRET = {}); }
function roleLabel(rid){ const d=DEPARTMENTS.find(x=>x.id===rid); return d?d.label:rid; }
/* гейт передачи: пока в рабочей среде роли открыт критичный риск (sev1) — передавать нельзя */
function stepGate(step){
  const WB = WORKBENCH[step.role]; if (!WB) return { gated:false, open1:0 };
  const sroot = (window.__ENVST||{})[step.role];
  const st = sroot && sroot._0;   // item0 — объект, релевантный потоку
  const idx1 = WB.draft.map((c,i)=>i).filter(i=>WB.draft[i].issue && WB.draft[i].issue.sev===1);
  const open1 = idx1.filter(i=>!(st && st.fixed && st.fixed.has(i))).length;
  return { gated:open1>0, open1, total1:idx1.length, kind:WB.kind };
}
/* компактный статус всех потоков — для дашборда CEO и экрана «Передачи компании» */
function flowStatusHTML(clickable){
  const FS = flowState();
  return FLOWS.map(f=>{ const cur=FS[f.id], done=cur>=f.steps.length, at=done?null:f.steps[cur];
    return `<div class="fx-row">
      <div class="fx-h"><b>${f.icon} ${f.title}</b>${done?'<span class="fx-done">✓ завершён</span>':`<span class="fx-at">ход за: ${at.who} · ${roleLabel(at.role)}</span>`}</div>
      <div class="fx-lane">${f.steps.map((s,i)=>{ const stt=i<cur?'done':i===cur?'active':'wait';
        const node = clickable?`<button class="fx-node ${stt}" data-go="${s.role}" title="${s.who} · ${roleLabel(s.role)}">${s.av}</button>`
          :`<span class="fx-node ${stt}" title="${s.who} · ${roleLabel(s.role)}">${s.av}</span>`;
        return node + (i<f.steps.length-1?`<i class="fx-arr ${i<cur?'lit':''}">→</i>`:''); }).join('')}</div>
    </div>`; }).join('');
}
/* След сделки «Гамма» — единый прослеживаемый объект (источник: flowState().gamma) */
function dealTraceHTML(){
  const f = FLOWS.find(x=>x.id==='gamma'); const cur = flowState().gamma;
  return `<div class="dt">${f.steps.map((s,i)=>{ const stt=i<cur?'done':i===cur?'active':'wait';
    return `<button class="dt-step ${stt}" data-go="flow:${s.role}"><span class="dt-ic">${s.av}</span>
      <div class="dt-b"><b>${s.who} · ${roleLabel(s.role)}</b><small>${i<cur?'✓ передал: '+s.out:i===cur?'● сейчас: '+s.act.toLowerCase():'ждёт'}</small></div>
      <span class="dt-art">${s.out}</span></button>${i<f.steps.length-1?'<div class="dt-link"></div>':''}`; }).join('')}</div>`;
}
function renderCompany(root){
  const d = { icon:'🏢', label:'Компания' };
  const order = ROLE_IDS;
  const max = Math.max(...order.map(r=>(HEADCOUNT[r]||0)+(DIGITAL_HEADCOUNT[r]||0)));
  const teamOf = r => COCKPITS[r].team.map((t,i)=>Array.isArray(t)?{name:t[0],role:t[1],fn:t[4],i}:{name:t.name,role:t.role,fn:t.fn,i});
  const fnGroups = r => { const g={}; teamOf(r).forEach(p=>{ const f=p.fn||'Команда'; (g[f]=g[f]||[]).push(p); });
    (DIGITAL_STAFF[r]||[]).forEach(w=>{ const f=w.fn||'Команда'; (g[f]=g[f]||[]).push({name:w.name,role:w.title,digital:true,id:w.id}); }); return g; };
  const totalFns = order.reduce((a,r)=>a+Object.keys(fnGroups(r)).length,0);
  let exp = null;
  function draw(){
    root.innerHTML = workHead(d, `Оргструктура · ${TOTAL_STAFF} в штате: ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых сотрудников в 8 отделах`) + `
    <div class="grid-kpi" style="margin-bottom:14px">
      <div class="kpi"><div class="l">Всего в штате</div><div class="v">${TOTAL_STAFF}</div><div class="d flat">● люди и цифровые вместе</div></div>
      <div class="kpi"><div class="l">Людей</div><div class="v">${COMPANY_SIZE}</div><div class="d flat">● решения и вкус — за ними</div></div>
      <div class="kpi"><div class="l">Цифровых сотрудников</div><div class="v">${DIGITAL_SIZE}</div><div class="d up">▲ ${DIGITAL_SHARE}% штата · у каждого ДИ</div></div>
      <div class="kpi"><div class="l">Функций / дисциплин</div><div class="v">${totalFns}</div><div class="d up">▲ детально по ролям</div></div>
    </div>
    <div class="oc-grid">${order.map(r=>{
      const dep=DEPARTMENTS.find(x=>x.id===r), hc=HEADCOUNT[r], dhc=DIGITAL_HEADCOUNT[r], groups=fnGroups(r), fns=Object.keys(groups), lead=teamOf(r)[0], open=exp===r;
      return `<div class="oc-dep ${open?'open':''}">
        <button class="oc-head" data-exp="${r}"><span class="oc-ic">${dep.icon}</span><div class="oc-id"><b>${dep.label}</b><small>лид: ${lead.name} · ${lead.role}</small></div><span class="oc-hc">${hc}<i>👤</i> ${dhc}<i>🤖</i></span><span class="oc-caret">${open?'▾':'▸'}</span></button>
        <div class="oc-bar oc-split"><i style="width:${Math.round(hc/max*100)}%"></i><u style="width:${Math.round(dhc/max*100)}%"></u></div>
        ${open
          ? `<div class="oc-tree">${fns.map(f=>`<div class="oc-fn"><div class="oc-fn-h">${f}<span>${groups[f].length}</span></div><div class="oc-people">${groups[f].map(p=> p.digital
              ?`<span class="oc-p dgt" data-wgo="${p.id}">🤖 ${p.name} · ${p.role}</span>`
              :`<span class="oc-p hmn" data-pgo="${r}:${p.i}" title="Открыть профиль">${p.name} · ${p.role}</span>`).join('')}</div></div>`).join('')}
              <div class="oc-tree-foot"><span>ключевые позиции · всего ${hc} людей и ${dhc} цифровых</span><button class="btn go oc-open" data-go="${r}">Открыть штат →</button></div></div>`
          : `<div class="oc-fns">${fns.slice(0,6).map(f=>`<span>${f}</span>`).join('')}${fns.length>6?`<span class="oc-more">+${fns.length-6}</span>`:''}</div><div class="oc-meta">${fns.length} функций · нажмите, чтобы раскрыть</div>`}
      </div>`; }).join('')}</div>
    <div class="od-gov" style="margin-top:13px">Одна Среда = одна компания. ${COMPANY_SIZE} людей и ${DIGITAL_SIZE} цифровых сотрудников в одном штатном расписании: у людей — рои под должность, у цифровых — должностные инструкции и руководители-люди. Всё связано библиотекой, данными с правами, передачами и governance.</div>`;
    root.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{ exp = exp===b.dataset.exp?null:b.dataset.exp; draw(); });
    root.querySelectorAll('.oc-open[data-go]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('team:'+b.dataset.go); });
    root.querySelectorAll('.oc-p[data-wgo]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.wgo); });
    root.querySelectorAll('.oc-p[data-pgo]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('person:'+b.dataset.pgo); });
  }
  draw();
}
function renderFlowExec(root){
  const d = { icon:'🔄', label:'Передачи компании' };
  const FS = flowState();
  const active = FLOWS.filter(f=>FS[f.id]<f.steps.length).length;
  root.innerHTML = workHead(d, `Вся работа компании как поток: выход одного отдела = вход другого — это и делает ${COMPANY_SIZE} личных чатов одной Средой`) + `
    <div class="flow-intro">CEO не управляет задачами — он видит, как работа <b style="color:var(--acc)">течёт между людьми</b> и где затык. Каждая передача — в аудите, ничего не теряется в личных переписках.</div>
    <div class="grid-kpi" style="margin-bottom:13px">
      <div class="kpi"><div class="l">В штате</div><div class="v">${TOTAL_STAFF}</div><div class="d flat">● ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых</div></div>
      <div class="kpi"><div class="l">Потоков активно</div><div class="v">${active}</div><div class="d up">live</div></div>
      <div class="kpi"><div class="l">Передач в аудите</div><div class="v">${auditLog().length}</div><div class="d up">▲ прозрачно</div></div>
      <div class="kpi"><div class="l">Потеряно в переписках</div><div class="v">0</div><div class="d up">▲ всё в потоке</div></div>
    </div>
    <div class="panel"><h2>🔄 Сквозные потоки <span class="tag">кликните этап — провалитесь в кабинет роли</span></h2>
      <div class="fx-list">${flowStatusHTML(true)}</div>
      <div class="od-gov" style="margin-top:11px">Личный кабинет — атом, потоки передач — соединительная ткань: так ${COMPANY_SIZE} рабочих мест действуют как одна компания, и ни одна задача не теряется в переписках.</div></div>`;
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navTo('flow:'+b.dataset.go));
}
function renderFlow(root, roleId){
  const FS = flowState();
  const d = DEPARTMENTS.find(x=>x.id===roleId) || {icon:'🔄',label:'Передачи'};
  const mine = FLOWS.filter(f => f.steps.some(s=>s.role===roleId));
  if (!mine.length){ root.innerHTML = workHead(d,'Передача работы между людьми') +
    `<div class="flow-empty">🔄 У этой роли пока нет активных передач. Когда коллега завершит свой шаг и передаст результат вам — он появится здесь как входящая работа.</div>`; return; }
  let fv = (mine.find(f => f.steps[FS[f.id]] && f.steps[FS[f.id]].role===roleId) || mine[0]).id;
  let sel = -1;

  /* статус роли в потоке: ход за мной / жду / уже передал */
  const laneState = (f) => { const c=FS[f.id]; const my=f.steps.map((s,i)=>s.role===roleId?i:-1).filter(i=>i>=0);
    return { c, active:my.includes(c), future:my.some(i=>i>c), passed:my.some(i=>i<c), done:c>=f.steps.length-1 && my.includes(f.steps.length-1) }; };

  function feed(){
    const inbox = mine.filter(f=>laneState(f).active);
    const waiting = mine.filter(f=>{const s=laneState(f); return !s.active && s.future;});
    const passed = mine.filter(f=>{const s=laneState(f); return !s.active && s.passed;});
    const grp = (title, arr, cls) => arr.length?`<div class="feed-g"><div class="feed-g-h ${cls}">${title} <b>${arr.length}</b></div>
      ${arr.map(f=>{const s=laneState(f); const st=f.steps[s.c];
        return `<button class="feed-i" data-fv="${f.id}"><span>${f.icon}</span><div><b>${f.title}</b><small>${cls==='in'?'ваш ход: '+st.act.toLowerCase():cls==='wt'?'ждёт коллегу: '+st.who+' ('+roleLabel(st.role)+')':'передано дальше'}</small></div></button>`;}).join('')}</div>`:'';
    return `<div class="panel feed"><h2>📥 Моя лента передач</h2>
      ${grp('Ход за вами', inbox, 'in')||''}${grp('Жду коллег', waiting, 'wt')||''}${grp('Я передал', passed, 'ok')||''}
      <div class="od-gov" style="margin-top:8px">Это «химия» Среды: вы не пишете коллеге в мессенджер — работа сама приходит готовым входом и уходит готовым выходом, всё в аудите.</div></div>`;
  }

  function draw(){
    const flow = FLOWS.find(f=>f.id===fv);
    const cur = FS[fv];
    const selIdx = sel<0 ? Math.min(cur, flow.steps.length-1) : sel;
    const step = flow.steps[selIdx];
    const isMineActive = step.role===roleId && selIdx===cur && cur<flow.steps.length;
    const lane = flow.steps.map((s,i)=>{
      const stt = i<cur?'done':i===cur?'active':'wait'; const me = s.role===roleId;
      return `${i>0?`<div class="flow-arrow ${i<=cur?'lit':''}"><i>→</i><span>${flow.steps[i-1].out}</span></div>`:''}
        <button class="flow-node ${stt} ${me?'me':''} ${i===selIdx?'sel':''}" data-step="${i}">
          ${me?'<span class="fn-me">вы</span>':''}
          <span class="fn-av">${s.av}</span><b>${s.who}</b><small>${roleLabel(s.role)}</small>
          <span class="fn-st ${stt}">${stt==='done'?'✓ передал':stt==='active'?'● ход здесь':'ждёт'}</span>
        </button>`; }).join('');
    root.innerHTML = workHead(d, 'Передача работы между людьми — связная ткань Среды') + `
      <div class="flow-intro">Личный чат — <b>атом</b>. Передача работы — <b style="color:var(--acc)">связная ткань</b>: выход одного человека становится входом другого. Так ${COMPANY_SIZE} личных ассистентов работают как одна компания, а не как ${COMPANY_SIZE} разрозненных чатов.</div>
      ${mine.length>1?`<div class="flow-switch">${mine.map(f=>`<button class="${f.id===fv?'on':''}" data-fv="${f.id}">${f.icon} ${f.title}</button>`).join('')}</div>`:''}
      <div class="flow-lane-wrap"><div class="flow-lane-h">${flow.icon} ${flow.title} <small>· ${flow.tagline}</small></div>
        <div class="flow-lane">${lane}</div></div>
      <div class="two-col" style="align-items:start">
        <div class="panel flow-card">
          <div class="fc-head"><span class="fc-av">${step.av}</span><div><b>${step.who} · ${roleLabel(step.role)}</b><small>${step.act}</small></div>
            ${isMineActive?'<span class="fc-now">● ваш ход</span>':selIdx<cur?'<span class="fc-tag ok">✓ выполнено</span>':'<span class="fc-tag wait">ждёт</span>'}</div>
          <div class="fd-io">
            <div class="fd-io-c"><span class="fd-l">◀ Вход${selIdx>0?' · от '+flow.steps[selIdx-1].who:''}</span><b>${step.in}</b></div>
            <div class="fd-io-arrow">⟶</div>
            <div class="fd-io-c out"><span class="fd-l">Выход${selIdx<flow.steps.length-1?' · → '+flow.steps[selIdx+1].who:''} ▶</span><b>${step.out}</b></div>
          </div>
          ${(flowRet()[fv] && flowRet()[fv].idx===selIdx && selIdx===cur)?`<div class="flow-returned">↩ <b>${flowRet()[fv].by}</b> вернул на доработку: «${flowRet()[fv].reason}». Поправьте и передайте снова.</div>`:''}
          <div class="fd-did">${step.did}</div>
          ${isMineActive ? (()=>{ const g=stepGate(step); return `
              ${g.gated?`<div class="flow-gate">🔒 Гейт: ${g.open1} критичный риск (sev1) ещё открыт в рабочей среде («${g.kind}»). Передать дальше нельзя, пока не снимете его — это не «волшебная кнопка».</div>`:''}
              <div class="flow-acts">
                <button class="btn go flow-pass" ${g.gated?'disabled':''}>✓ Принять и передать дальше${selIdx<flow.steps.length-1?' → '+flow.steps[selIdx+1].who:' (закрыть поток)'}${g.gated?' (заблок.)':''}</button>
                <button class="btn ${g.gated?'go':'ghost'} flow-open">✏️ ${g.gated?'Снять риск в рабочей среде':'Открыть в рабочей среде'}</button>
                ${selIdx>0?'<button class="btn ghost flow-return">↩ Вернуть автору</button>':''}
              </div>`; })()
            : selIdx<cur ? `<div class="fd-passed">✓ Выполнено и передано «${flow.steps[selIdx+1]?flow.steps[selIdx+1].who:'дальше'}» · запись в аудит</div>`
            : `<div class="fd-wait">⏳ Ждёт коллегу: сейчас ход за «${flow.steps[cur].who}» (${roleLabel(flow.steps[cur].role)})</div>`}
        </div>
        ${feed()}
      </div>`;
    root.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ fv=b.dataset.fv; sel=-1; draw(); });
    root.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{ sel=+b.dataset.step; draw(); });
    const pass = root.querySelector('.flow-pass'); if(pass) pass.onclick=()=>{
      if (stepGate(step).gated){ toast('Сначала снимите критичный риск в рабочей среде'); return; }
      delete flowRet()[fv];
      const nx = flow.steps[FS[fv]+1];
      if (nx){ pushAudit({ who:step.who+' · '+roleLabel(step.role), emoji:step.av, act:`передал «${step.out}» → ${nx.who} (${roleLabel(nx.role)})`, dept:roleLabel(step.role) });
        FS[fv]++; sel=-1; draw(); toast(`Передано: ${step.who} → ${nx.who} · ${step.out}`); }
      else { pushAudit({ who:step.who+' · '+roleLabel(step.role), emoji:step.av, act:`закрыл поток «${flow.title}» → ${step.out}`, dept:roleLabel(step.role) });
        FS[fv]=flow.steps.length; sel=-1; draw(); toast('Поток завершён — записано в аудит'); }
    };
    const fopen = root.querySelector('.flow-open'); if(fopen) fopen.onclick=()=>navTo(roleId);
    const ret = root.querySelector('.flow-return'); if(ret) ret.onclick=()=>{
      const prev = flow.steps[FS[fv]-1]; if(!prev) return;
      flowRet()[fv] = { idx:FS[fv]-1, by:step.who, reason:'нужна доработка перед передачей' };
      pushAudit({ who:step.who+' · '+roleLabel(step.role), emoji:'↩', act:`вернул «${prev.out}» автору ${prev.who} на доработку`, dept:roleLabel(step.role), verdict:'deny' });
      FS[fv]--; sel=-1; draw(); toast(`Возвращено: ${step.who} → ${prev.who}`);
    };
  }
  draw();
}

function renderStage(id){
  id = id || state.screen;
  const stage = $('#stage');
  try { Organism.destroy(); } catch(e){}
  clearInterval(window.__auditTimer);
  clearInterval(window.__pulseTimer);
  if (id.indexOf('lib:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`;
    renderLibrary($('#work'), DEPARTMENTS.find(x=>x.id===id.slice(4))||{icon:'📚',label:'Библиотека',persona:''}, { lock: ROLE_CAT[id.slice(4)] }); return; }
  if (id.indexOf('team:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderTeam($('#work'), id.slice(5)); return; }
  if (id.indexOf('flow:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderFlow($('#work'), id.slice(5)); return; }
  if (id.indexOf('dpulse:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderDeptPulse($('#work'), id.slice(7)); return; }
  if (id.indexOf('channel:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderDeptChannel($('#work'), id.slice(8)); return; }
  if (id==='workers'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderWorkerWorkforce($('#work')); return; }
  if (id==='aibudget'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderAIBudgets($('#work')); return; }
  if (id==='federation'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderFederation($('#work')); return; }
  if (id==='contracts'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderInterDomainContracts($('#work')); return; }
  if (id==='arbitration'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderArbitration($('#work')); return; }
  if (id==='economy'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderInternalEconomy($('#work')); return; }
  if (id.indexOf('domain:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderDomain($('#work'), id.slice(7)); return; }
  if (id.indexOf('diplomat:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderWorkerDiplomat($('#work'), id.slice(9)); return; }
  if (id.indexOf('worker:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderWorkerProfile($('#work'), id.slice(7)); return; }
  if (id.indexOf('person:')===0){ const pp=id.split(':'); stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderPersonProfile($('#work'), pp[1], pp[2]); return; }
  if (id.indexOf('gperson:')===0){ const pp=id.split(':'); stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderGenPerson($('#work'), pp[1], pp[2]); return; }
  if (id.indexOf('gworker:')===0){ const pp=id.split(':'); stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderGenWorker($('#work'), pp[1], pp[2]); return; }
  if (id==='pulse'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderPulse($('#work'), {icon:'🧠',label:'Пульс компании'}); return; }
  if (id==='talent'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderTalent($('#work')); return; }
  if (id.indexOf('tagent:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderTalentAgent($('#work'), id.slice(7)); return; }
  if (id==='forge'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderForge($('#work')); return; }
  if (id.indexOf('fproj:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderForgeProject($('#work'), id.slice(6)); return; }
  if (id==='bills'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderSredaBills($('#work')); return; }
  if (id==='modules'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderModules($('#work')); return; }
  if (id==='flowx'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderFlowExec($('#work')); return; }
  if (id==='company'){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderCompany($('#work')); return; }
  if (id.indexOf('asst:')===0){ stage.classList.add('full'); stage.innerHTML=`<div class="work" id="work"></div>`; renderAssistant($('#work'), id.slice(5)); return; }
  const d = DEPARTMENTS.find(x => x.id === id); if (!d) return;
  if (d.archetype === 'organism'){ stage.classList.add('full'); stage.innerHTML=''; renderOrganism(stage, d); return; }
  const fullScreens = { dashboard: renderDashboard, marketplace: renderLibrary, router: renderRouter, audit: renderAudit, project: renderProject, studio: renderStudio, roadmap: renderRoadmap, core: renderCore, roles: renderRoles, power: renderPower, cockpit: renderEnv, battle: renderBattle };
  if (fullScreens[d.archetype]){
    stage.classList.add('full');
    stage.innerHTML = `<div class="work" id="work"></div>`;
    fullScreens[d.archetype]($('#work'), d);
  }
}

function workHead(d, sub){
  return `<div class="work-head">
    <div class="ico">${d.icon}</div>
    <div style="flex:1">
      <h1>${d.label}</h1>
      <p>${sub}</p>
    </div>
    <span class="badge"><span class="dot"></span>Среда · закрытый периметр</span>
  </div>`;
}

/* ========================================================================== */
/*  ГЛАВНЫЙ ЭКРАН — «ПУЛЬС КОМПАНИИ» (живой организм)                          */
/* ========================================================================== */
const GOALS = [
  '🚀 Запусти новый продукт к Q3',
  '📉 Снизь отток клиентов на 20%',
  '🏆 Выйди на рынок ОАЭ за квартал',
];

function renderOrganism(stage, d){
  stage.innerHTML = `
    <div class="org">
      <canvas id="orgCanvas" role="img" aria-label="Интерактивная карта оргструктуры компании: отделы и их численность. Клик по отделу — переход в его пульс."></canvas>
      <div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Оргструктура компании по отделам: ${ROLE_IDS.map(r=>{ const dep=DEPARTMENTS.find(x=>x.id===r); const hc=(typeof HEADCOUNT!=='undefined'&&HEADCOUNT[r])||0; const dhc=(typeof DIGITAL_HEADCOUNT!=='undefined'&&DIGITAL_HEADCOUNT[r])||0; return `${dep?dep.label:r} — ${hc} людей и ${dhc} цифровых`; }).join('; ')}. Клик по отделу открывает его пульс.</div>

      <div class="org-top">
        <div class="org-title">
          <h1>Пульс компании</h1>
          <p>Один организм на любой размер — <b>логика одна, отличается лишь глубина дерева</b></p>
          <div class="crumb" id="orgCrumb"></div>
        </div>
        <div class="org-launch">
          <div class="scale-sw" id="scaleSw">
            ${Organism.SCALES.map((s,i)=>`<button data-s="${s.id}" class="${i===0?'on':''}">${s.label}<small>${s.people>=1000?(s.people/1000)+'k':s.people} чел</small></button>`).join('')}
          </div>
          <button class="btn go" id="goalGo">Запустить рой ▶</button>
        </div>
      </div>

      <div class="org-hud" id="orgHud">
        <div class="hud-cell"><span>Сотрудников</span><b id="s-people">0</b></div>
        <div class="hud-cell"><span>Личных роёв</span><b id="s-swarms">0</b></div>
        <div class="hud-cell"><span>Цифровых сотрудников всего</span><b id="s-agents">0</b></div>
        <div class="hud-cell"><span>Команд</span><b id="s-teams">0</b></div>
        <div class="hud-cell"><span>Умений (общая библиотека)</span><b id="s-умения">0</b><i>одна на всех — не зависит от размера</i></div>
      </div>

      <div class="org-flow" id="orgFlow">
        <div class="of-live"><span class="of-dot"></span><b id="of-inflight">—</b> задач в работе <i>прямо сейчас</i></div>
        <div class="of-live"><b id="of-done">—</b> выполнено сегодня</div>
        <div class="of-legend"><span style="--c:#60a5fa">код</span><span style="--c:#34d399">продажи</span><span style="--c:#fbbf24">деньги</span><span style="--c:#f87171">юр</span><span style="--c:#a78bfa">дизайн</span><span style="--c:#22d3ee">данные</span><span style="--c:#f472b6">HR</span></div>
        <div class="of-feed" id="ofFeed"></div>
      </div>

      <div class="org-detail" id="orgDetail">
        <div class="od-empty">Кликните узел — отдел, команду, человека или модель — чтобы провалиться внутрь.<br><br>Переключите масштаб справа: 10 ⇄ 20 000 человек. Логика та же.</div>
      </div>

      <div class="org-run" id="orgRun" style="display:none">
        <div class="run-row"><span>Цель в потоке <i id="h-prog-l">·</i></span>
          <span><b id="h-ag">0</b> цифровых сотрудников · <b id="h-task">0</b> задач · <b id="h-mod">0</b> моделей · <b id="h-cost">₽0</b></span></div>
        <div class="hud-bar"><div id="h-prog"></div></div>
      </div>

      <div class="org-legend">
        <span><i style="background:#34d399"></i>отделы</span>
        <span><i style="background:#60a5fa"></i>команды</span>
        <span><i style="background:#a78bfa"></i>люди/цифровые сотрудники</span>
        <span><i style="background:#3a4459"></i>пул моделей</span>
      </div>
    </div>`;

  const canvas = $('#orgCanvas', stage);
  Organism.init(canvas, { onSelect: showNodeDetail, onView: updateScaleHud });

  /* живой поток задач: счётчики + лента «что происходит сейчас» */
  const FEED=[['🛠️','Бэкенд-цифровой сотрудник','собрал PR #'+(480+(Date.now()%40)),'Разработка'],['📈','Сейлз-цифровой сотрудник','follow-up по сделке','Продажи'],['✍️','Копирайтер','текст лендинга','Маркетинг'],['📊','Аналитик','пересчитал воронку','Аналитика'],['⚖️','Комплаенс','проверка по 38-ФЗ','Юр'],['🎨','Дизайн-цифровой сотрудник','собрал вариант макета','Дизайн'],['🧪','QA-рой','прогон тестов · 143 ✓','Разработка'],['🧲','Рекрутер','скрининг откликов','HR'],['💰','Финмодель','пересчёт сценария','Финансы'],['🔍','Ревьюер','код-ревью','Разработка'],['🧭','Онбординг','план адаптации','HR'],['🔌','Интеграции','вебхук доставлен','Разработка']];
  clearInterval(window.__pulseTimer);
  window.__pulseTimer=setInterval(()=>{
    const a=Organism.getAmbient&&Organism.getAmbient(); const inf=$('#of-inflight'); if(!a||!inf){ clearInterval(window.__pulseTimer); return; }
    inf.textContent=a.inflight.toLocaleString('ru'); const dn=$('#of-done'); if(dn) dn.textContent=a.doneToday.toLocaleString('ru');
    const feed=$('#ofFeed'); if(feed){ const f=FEED[Math.floor(Math.random()*FEED.length)];
      const row=el(`<div class="of-row fade-in"><span>${f[0]}</span><b>${f[1]}</b> ${f[2]} <i>· ${f[3]}</i></div>`);
      feed.insertBefore(row,feed.firstChild); while(feed.children.length>5) feed.removeChild(feed.lastChild); }
  }, 900);

  function updateScaleHud(v){
    const s = v.scale;
    const RUNLBL = { company:'Запустить рой ▶', department:'Рой отдела ▶', team:'Рой команды ▶', person:'Рой сотрудника ▶' };
    const gb = $('#goalGo'); if (gb) gb.textContent = RUNLBL[v.level] || 'Запустить рой ▶';
    $('#s-people').textContent = s.people.toLocaleString('ru');
    $('#s-swarms').textContent = s.swarms.toLocaleString('ru');
    $('#s-agents').textContent = s.agents.toLocaleString('ru');
    $('#s-teams').textContent  = s.teams.toLocaleString('ru');
    $('#s-умения').textContent = s.skills;
    // хлебные крошки
    const crumb = $('#orgCrumb');
    if (!v.crumb || !v.crumb.length){ crumb.innerHTML = `<span class="cr-here">Компания · ${s.label}</span>`; }
    else {
      crumb.innerHTML = v.crumb.map((c,i)=>{
        const last = i===v.crumb.length-1;
        return `<span class="${last?'cr-here':'cr-link'}" data-i="${i}">${c.label}</span>`;
      }).join('<span class="cr-sep">›</span>');
      $$('#orgCrumb .cr-link').forEach(elm=>{ const i=+elm.dataset.i; const c=v.crumb[i];
        if (c.go) elm.onclick = () => c.go(); });
    }
  }

  const LVL = { company:'вся компания', department:'отдел', team:'команда', person:'личный рой сотрудника' };
  const hud = (s) => {
    $('#orgRun').style.display = '';
    if (s.goal) $('#h-prog-l').textContent = 'выполняется · ' + (LVL[s.level]||'');
    if ('activeAgents' in s) $('#h-ag').textContent = s.activeAgents;
    if ('tasksFlown' in s) $('#h-task').textContent = s.tasksFlown;
    if ('models' in s) $('#h-mod').textContent = s.models;
    if ('cost' in s) $('#h-cost').textContent = '₽' + (s.cost||0).toLocaleString('ru');
    if ('progress' in s) $('#h-prog').style.width = s.progress + '%';
    if (s.done){ $('#h-prog-l').textContent = s.synthUp ? 'готово · ↑ синтез свёрнут наверх' : 'готово'; setNavLock(false); }
  };

  $$('#scaleSw button', stage).forEach(b => b.onclick = () => {
    if (Organism.scenarioActive) return;
    $$('#scaleSw button', stage).forEach(x=>x.classList.toggle('on', x===b));
    Organism.setScale(b.dataset.s);
  });

  $('#goalGo', stage).onclick = () => {
    if (Organism.scenarioActive) return;
    setNavLock(true);
    ['h-ag','h-task','h-mod'].forEach(id=>$('#'+id).textContent='0');
    $('#h-cost').textContent='₽0'; $('#h-prog').style.width='0%';
    Organism.surge(40);                        // мгновенный всплеск именованных задач
    Organism.runGoal('🚀 Запусти новый продукт', hud).then(()=>setNavLock(false));
  };
}

function showNodeDetail(n){
  const box = $('#orgDetail'); if (!box) return;
  const T = { core:'Сущность', dept:'Отдел', team:'Команда', person:'Сотрудник', agent:'Цифровой сотрудник', model:'Модель' }[n.type] || 'Узел';
  let inner = '';
  if (n.type === 'dept'){
    inner = `<div class="od-head"><span class="od-emoji">🏛️</span><div><b>${n.label}</b><small>${T} · кликните, чтобы зайти внутрь</small></div></div>
      <div class="od-row"><span>Людей в отделе</span><b>${(n.people||0).toLocaleString('ru')}</b></div>
      <div class="od-row"><span>Команд</span><b>${n.teams||1}</b></div>
      <div class="od-row"><span>Личных роёв</span><b>${(n.people||0).toLocaleString('ru')}</b></div>
      <div class="od-gov">↳ тот же примитив, что и у компании — отдел просто на уровень ниже</div>`;
  } else if (n.type === 'team'){
    inner = `<div class="od-head"><span class="od-emoji">👥</span><div><b>${n.label}</b><small>${T} · кликните, чтобы зайти внутрь</small></div></div>
      <div class="od-row"><span>Людей в команде</span><b>8</b></div>
      <div class="od-row"><span>Личных роёв</span><b>8</b></div>
      <div class="od-row"><span>Лид команды</span><b>цифровой сотрудник-синтезатор</b></div>
      <div class="od-gov">↳ команда сворачивает работу людей и отдаёт наверх — как отдел компании</div>`;
  } else if (n.type === 'person'){
    inner = `<div class="od-head"><span class="od-emoji">🧑</span><div><b>${n.label}</b><small>${n.sub||T}</small></div></div>
      <div class="od-row"><span>Личный рой</span><b>~6 цифровых сотрудников</b></div>
      <div class="od-row"><span>Доступ к умениям</span><b style="color:var(--acc)">вся библиотека</b></div>
      <div class="od-row"><span>Онбординг</span><b>минуты</b></div>
      <div class="od-gov">↳ атомарная единица Среды. 10 человек = 10 таких. 20 000 = 20 000 таких. Кликните — увидите рой.</div>`;
  } else if (n.type === 'agent'){
    const m = MODELS[n.model];
    inner = `<div class="od-head"><span class="od-emoji">${n.emoji||'◆'}</span>
        <div><b>${n.label}</b><small>${T} · отдел: ${labelOfDept(n.deptId)}</small></div></div>
      <div class="od-row"><span>Текущая задача</span><b>${n.sub}</b></div>
      <div class="od-row"><span>Маршрут на модель</span>${modelBadge(n.model)}</div>
      <div class="od-row"><span>Почему эта модель</span><b>${m.why}</b></div>
      <div class="od-row"><span>Стоимость вызова</span><b>~₽${Math.round(m.cost*2.3)}</b></div>
      <div class="od-gov">⚖️ доступ ограничен отделом · действие в аудите</div>`;
  } else if (n.type === 'dept'){
    inner = `<div class="od-head"><span class="od-emoji">🏛️</span><div><b>${n.label}</b><small>${T}</small></div></div>
      <div class="od-row"><span>Цифровой сотрудников в отделе</span><b>${n.sub}</b></div>
      <div class="od-row"><span>Изоляция данных</span><b style="color:var(--acc)">периметр закрыт</b></div>
      <div class="od-gov">отдел получает только разрешённые витрины данных</div>`;
  } else if (n.type === 'model'){
    inner = `<div class="od-head"><span class="od-emoji">🧩</span><div><b>${n.label}</b><small>${T} · ${MODELS[n.mid].vendor}</small></div></div>
      <div class="od-row"><span>Класс</span><b>${MODELS[n.mid].tier}</b></div>
      <div class="od-row"><span>Когда выбирается</span><b>${n.sub}</b></div>
      <div class="od-row"><span>Цена за вызов</span><b>~₽${Math.round(MODELS[n.mid].cost*2.3)}</b></div>
      <div class="od-gov">маршрутизатор подбирает оптимальную модель под каждую задачу</div>`;
  } else {
    inner = `<div class="od-head"><span class="od-emoji">◆</span><div><b>Среда · Оркестратор</b><small>ядро организма</small></div></div>
      <div class="od-row"><span>Роль</span><b>разбор целей, маршрутизация, синтез</b></div>
      <div class="od-gov">единая точка, где задача компании превращается в работу роя</div>`;
  }
  box.innerHTML = inner;
  box.classList.add('fade-in'); setTimeout(()=>box.classList.remove('fade-in'), 400);
}
function labelOfDept(id){ const d = Organism.DEPTS.find(x=>x.id===id); return d?d.label:id; }

/* ========================================================================== */
/*  ЛИЦО 3 — ДАШБОРД (менеджмент)                                             */
/* ========================================================================== */
function renderDashboard(root, d){
  const db = DASHBOARD;
  const FS = flowState();
  const flowsActive = FLOWS.filter(f=>FS[f.id]<f.steps.length).length;
  const APPR_DEPT = { 'Маркетинг':'marketing','Инженерия':'dev','Продажи':'sales','Люди':'hr' };
  root.innerHTML = workHead(d, `CEO · бизнес-кокпит: ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых сотрудников работают как один организм`) + `
    <div class="grid-kpi">
      <div class="kpi fade-in"><div class="l">Задач выполнено за неделю</div><div class="v">1 284</div><div class="d up">▲ +22%</div></div>
      <div class="kpi fade-in"><div class="l">Сэкономлено часов команды</div><div class="v">3 910</div><div class="d up">▲ +31%</div></div>
      <div class="kpi fade-in"><div class="l">Стоимость ИИ за неделю</div><div class="v">₽184k</div><div class="d up">▲ −8% к пред.</div></div>
      <div class="kpi fade-in"><div class="l">Штат компании</div><div class="v">${TOTAL_STAFF}</div><div class="d flat">● ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых</div></div>
      <div class="kpi fade-in"><div class="l">Доля цифровых в штате</div><div class="v">${DIGITAL_SHARE}%</div><div class="d up">▲ у каждого ДИ и руководитель</div></div>
      <div class="kpi fade-in"><div class="l">Сквозных потоков активно</div><div class="v">${flowsActive}</div><div class="d up">● ничего не потеряно</div></div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>⚡ Синтез за неделю <span class="tag">что сделали отделы</span></h2>
        <div id="syn"></div>
      </div>
      <div class="panel">
        <h2>📦 Загрузка по отделам <span class="tag">люди + цифровые · клик → отдел</span></h2>
        <div id="bars"></div>
      </div>
    </div>

    <div class="panel">
      <h2>🔗 След сделки «Гамма» <span class="tag">один объект — через всю компанию · клик → этап</span></h2>
      <div id="dealTrace">${dealTraceHTML()}</div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>🔄 Передачи в потоке <span class="tag">клик → кабинет роли</span></h2>
        <div class="fx-list">${flowStatusHTML(true)}</div>
      </div>
      <div class="panel">
        <h2>✅ Ждут вашего решения</h2>
        <div id="appr"></div>
      </div>
    </div>`;

  const syn = $('#syn', root);
  db.synthesis.forEach(s => syn.appendChild(el(`<div class="syn">
     <div class="si">${s.icon}</div>
     <div><div class="sd">${s.dept}</div><div class="stx">${s.text}</div></div></div>`)));

  const bars = $('#bars', root);
  ROLE_IDS.forEach(r => {
    const dep = DEPARTMENTS.find(x=>x.id===r);
    const load = ({dev:88, sales:76, marketing:81, design:64, analytics:72, hr:58, finance:69, legal:61})[r];
    const row = el(`<div class="bar-row" style="cursor:pointer" title="Открыть отдел"><div class="nm">${dep.icon} ${dep.label} <small style="color:var(--muted)">· 👤${HEADCOUNT[r]}+🤖${DIGITAL_HEADCOUNT[r]}</small></div>
       <div class="track"><div class="fill" style="background:${DEPT_TASK[r].c}"></div></div><div class="pct">${load}%</div></div>`);
    row.onclick = () => navTo('team:'+r);
    bars.appendChild(row);
    requestAnimationFrame(() => setTimeout(() => { $('.fill', row).style.width = load + '%'; }, 120));
  });

  root.querySelectorAll('#dealTrace [data-go]').forEach(b=>b.onclick=()=>navTo(b.dataset.go));
  root.querySelectorAll('.fx-list [data-go]').forEach(b=>b.onclick=()=>navTo('flow:'+b.dataset.go));

  const appr = $('#appr', root);
  db.approvals.forEach(a => {
    const row = el(`<div class="appr">
      <div class="at"><b>${a.task}</b><small>${a.dept} · ${a.cost}</small></div>
      <span class="risk ${a.risk}">${a.risk==='low'?'низкий риск':'средний риск'}</span>
      <button class="btn ghost">Открыть</button>
      <button class="btn go">Одобрить</button>
    </div>`);
    $('.ghost', row).onclick = () => navTo((APPR_DEPT[a.dept]||'dev'));
    $('.go', row).onclick = () => { $('.go', row).textContent = 'Одобрено ✓'; $('.go', row).disabled = true; $('.go', row).style.opacity = .7;
      pushAudit({ who:'CEO · Кирилл', what:`Одобрено: ${a.task}`, verdict:'allow' }); toast('Решение записано в аудит'); };
    appr.appendChild(row);
  });
}

/* ========================================================================== */
/*  МАРКЕТПЛЕЙС — цифровые сотрудники и умения                                              */
/* ========================================================================== */
/* ========================================================================== */
/*  КАБИНЕТ РАЗРАБОТКИ — как теперь работает команда (80% бюджета)            */
/* ========================================================================== */
/* ========================================================================== */
/*  BATTLE — прототип стресс-тестит сам себя: 4 критика × роли, 3 CEO-арбитра */
/* ========================================================================== */
function renderBattle(root, d){
  const total = BATTLE_PERSONAS.reduce((a,p)=>a+p.score,0);
  root.innerHTML = workHead(d, 'Стресс-тест на 300 пунктов: 4 профи-критика по всем ролям, арбитраж 3 типов CEO, и что внедрено в ответ') + `
    <div class="core-thesis">Зрелый продукт не прячет дыры — он их находит первым. Мы прогнали прототип через <b>4 независимых эксперта</b> по всем ролям и <b>3 типа CEO</b>. Вот вердикт и что мы уже починили.</div>

    <div class="bt-gauge">
      <div class="bt-g-head"><b>${total} / 300</b><span>итог батла (сумма 4 персонажей по 75)</span></div>
      <div class="bt-g-bar">${BATTLE_PERSONAS.map(p=>`<i style="flex:${p.score};background:${p.color}" title="${p.name}: ${p.score}"></i>`).join('')}<i class="bt-g-rest" style="flex:${300-total}"></i></div>
    </div>

    <div class="bt-personas">${BATTLE_PERSONAS.map(p=>`
      <div class="bt-p" style="--c:${p.color}">
        <div class="bt-p-h"><span class="bt-emoji">${p.emoji}</span><b>${p.name}</b><span class="bt-score">${p.score}<small>/75</small></span></div>
        <div class="bt-bar"><i style="width:${p.score/75*100}%;background:${p.color}"></i></div>
        <p class="bt-verdict">${p.verdict}</p>
        <div class="bt-reqs">${p.reqs.map(r=>`<div class="bt-req"><span class="bt-tag s${r[1]}">${r[0]} · sev${r[1]}</span>${r[2]}</div>`).join('')}</div>
      </div>`).join('')}</div>

    <div class="panel">
      <h2>👔 Ролевые профессионалы — у каждой роли свой эксперт <span class="tag">реализм /100 · 8 доменных профи</span></h2>
      <p class="core-sub">HR-профи и сеньор-разработчик видят мир по-разному — поэтому критика от профессионала <b>каждой</b> роли, а не генерик-персон. Их единогласный диагноз: «волшебная кнопка».</p>
      <div class="bt-roles">${BATTLE_ROLES.map(r=>`
        <div class="bt-role"><div class="bt-role-h"><span>${r.emoji}</span><b>${r.role}</b><span class="bt-role-s">${r.score}<small>/100</small></span></div>
          <div class="bt-bar"><i style="width:${r.score}%;background:${r.score<40?'#f87171':r.score<48?'#fbbf24':'#34d399'}"></i></div>
          <div class="bt-role-magic">🔘 «кнопка»: ${r.magic}</div>
          <div class="bt-role-req">✏️ нужно: ${r.req}</div></div>`).join('')}</div>
      <div class="bt-fix">✅ <b>Закрыто:</b> ${BATTLE_ROLES_FIX}</div>
    </div>

    <div class="panel">
      <h2>⚖️ Арбитраж: 3 типа CEO</h2>
      <div class="bt-ceos">${BATTLE_CEOS.map(c=>`
        <div class="bt-ceo" style="--c:${c.color}"><div class="bt-ceo-h"><span>${c.emoji}</span><b>${c.type}</b></div>
          <p>${c.verdict}</p><div class="bt-call">→ ${c.call}</div></div>`).join('')}</div>
      <div class="bt-consensus">🤝 <b>Консенсус совета:</b> ${BATTLE_CONSENSUS}</div>
    </div>

    <div class="panel">
      <h2>🎯 Позиционирование на рынке <span class="tag">Sreda vs Cursor / Claude Code / Devin</span></h2>
      <p class="core-sub">Sreda — не IDE. Sreda — операционная система компании. Вот чем мы отличаемся от инструментов разработки.</p>
      <div class="ww-table-wrap" style="margin-top:10px">
        <table class="ww-table">
          <thead><tr><th>Критерий</th><th style="color:var(--acc)">Sreda</th><th>Cursor Enterprise</th><th>Claude Code</th><th>Devin Teams</th></tr></thead>
          <tbody>
            <tr><td><b>Фокус</b></td><td style="color:var(--acc)">8 ролей компании</td><td>Разработка</td><td>Разработка</td><td>Разработка</td></tr>
            <tr><td><b>Цифровые сотрудники</b></td><td style="color:var(--acc)">Штат с KPI/бюджетом</td><td>IDE-ассистент</td><td>IDE-ассистент</td><td>Автономный dev</td></tr>
            <tr><td><b>Передачи</b></td><td style="color:var(--acc)">Сквозные потоки</td><td>PR review</td><td>PR review</td><td>Нет</td></tr>
            <tr><td><b>Governance</b></td><td style="color:var(--acc)">Сениорити + конституция</td><td>Нет</td><td>Нет</td><td>Нет</td></tr>
            <tr><td><b>Масштаб</b></td><td style="color:var(--acc)">Холдинг · филиалы</td><td>Команда</td><td>Команда</td><td>Команда</td></tr>
            <tr><td><b>Бюджет</b></td><td style="color:var(--acc)">По цифровому сотруднику · burn rate</td><td>Нет</td><td>Нет</td><td>Нет</td></tr>
            <tr><td><b>Каналы</b></td><td style="color:var(--acc)">Коллаборация людей+цифровые сотрудники</td><td>Нет</td><td>Нет</td><td>Нет</td></tr>
          </tbody>
        </table>
      </div>
      <div class="bt-fix" style="margin-top:10px">🎯 <b>Ответ на вопрос инвестора:</b> «Как управлять цифровой рабочей силой предприятия?» — Sreda даёт штат цифровых сотрудников с KPI, бюджетом и SLA, сквозные передачи между отделами, governance через сениорити и конституцию, масштаб холдинга с филиалами.</div>
    </div>

    <div class="panel">
      <h2>🧮 Ответ на хотелку всех: ROI-калькулятор под вашу компанию <span class="tag">внедрено по итогу батла</span></h2>
      <p class="core-sub">Воодушевлённый и нейтральный профи + все 3 CEO требовали «рубли под мою компанию». Вот он:</p>
      <div class="roi">
        <div class="roi-in">
          <label>Сотрудников <input type="number" id="roiP" value="500"></label>
          <label>ФОТ ₽/чел·мес <input type="number" id="roiS" value="250000"></label>
          <label>Доля рутины % <input type="number" id="roiR" value="40"></label>
          <label>Автоматизация рутины % <input type="number" id="roiE" value="70"></label>
          <label>Цена Среды ₽/seat·мес <input type="number" id="roiC" value="12000"></label>
        </div>
        <div class="roi-out" id="roiOut"></div>
      </div>
    </div>

    <div class="two-col" style="align-items:start">
      <div class="panel"><h2>✅ Внедрено в этой сессии <span class="tag">${BATTLE_REQS.done.length}</span></h2>
        <div class="bt-status">${BATTLE_REQS.done.map(r=>`<div class="bt-st done">✓ ${r}</div>`).join('')}</div></div>
      <div class="panel"><h2>🟡 Роадмеп — требует бэкенда/пилота <span class="tag">${BATTLE_REQS.roadmap.length}</span></h2>
        <div class="bt-status">${BATTLE_REQS.roadmap.map(r=>`<div class="bt-st road">🟡 ${r}</div>`).join('')}</div></div>
    </div>

    <div class="rm-cta" style="margin-top:14px"><b>Итог батла → рабочий ответ.</b> Кабинеты всех ролей, меню под роли, честные плашки, ROI-калькулятор и честный счёт каталога — внедрены сейчас. Бэкенд-требования (реальные модели, enforcement, ПДн, телеметрия) — честно вынесены в роадмеп, а не нарисованы как готовые. Это и есть зрелость, которую все три CEO назвали условием сделки.</div>`;

  const roi = () => {
    const P=+$('#roiP',root).value||0, S=+$('#roiS',root).value||0, R=+$('#roiR',root).value||0, E=+$('#roiE',root).value||0, C=+$('#roiC',root).value||0;
    const gross = P*S*12*(R/100)*(E/100);
    const cost = P*C*12;
    const net = gross-cost;
    const roiPct = cost>0 ? Math.round(net/cost*100) : 0;
    const payback = net>0 ? (cost/(net/12)).toFixed(1) : '—';
    const f = n => '₽'+Math.round(n).toLocaleString('ru');
    $('#roiOut',root).innerHTML = `
      <div class="ro"><span>Экономия в год</span><b class="good">${f(gross)}</b></div>
      <div class="ro"><span>Стоимость Среды в год</span><b>${f(cost)}</b></div>
      <div class="ro"><span>Чистая выгода в год</span><b class="${net>0?'good':'bad'}">${f(net)}</b></div>
      <div class="ro"><span>ROI</span><b class="${net>0?'good':'bad'}">${roiPct}%</b></div>
      <div class="ro"><span>Окупаемость</span><b>${payback} мес</b></div>`;
  };
  ['roiP','roiS','roiR','roiE','roiC'].forEach(id=>$('#'+id,root).oninput=roi);
  roi();
}

/* Workbench: рой даёт черновик, эксперт правит. НЕ «волшебная кнопка». */
function openWorkbench(roleId, ticket, onAccept){
  const WB = WORKBENCH[roleId] || { kind:'Черновик', title:(ticket&&ticket.t)||'Задача', who:'рой', draft:[{t:(ticket&&ticket.t)||''}] };
  const draft = WB.draft.map(c => ({ ...c, resolved:false }));
  let exp = 'middle', rev = 1;
  let ov = document.querySelector('#wbOverlay');
  if (!ov){ ov = document.createElement('div'); ov.id='wbOverlay'; ov.className='wb-overlay'; document.body.appendChild(ov); }
  ov.classList.add('show');
  const thr = () => WB_EXPERTISE.find(e=>e.id===exp).thr;

  const render = () => {
    const open = draft.filter(c=>c.issue && !c.resolved);
    const caught = open.filter(c=>c.issue.sev >= thr());
    const missed = open.filter(c=>c.issue.sev < thr());
    const quality = Math.max(38, 100 - missed.length*13);
    ov.innerHTML = `<div class="wb">
      <div class="wb-head"><div><b>${WB.title}</b><small>${WB.kind} · ${WB.who} · ревизия v${rev}</small></div><button class="wb-x" id="wbX">✕</button></div>
      <div class="wb-thesis">ИИ дал <b>черновик</b> — правите вы. Это не «волшебная кнопка»: <b>чем выше экспертиза, тем больше поймано и исправлено</b>, а пропущенное джуном уходит в прод.</div>
      <div class="wb-exp"><span class="wb-exp-l">Ваша экспертиза:</span>
        ${WB_EXPERTISE.map(e=>`<button data-e="${e.id}" class="${exp===e.id?'on':''}">${e.label}</button>`).join('')}
        <span class="wb-exp-note">${WB_EXPERTISE.find(e=>e.id===exp).note}</span></div>
      <div class="wb-draft ${(WB.kind.includes('Код')||WB.kind.includes('SQL'))?'mono':''}">
        ${draft.map(c=>{
          if (!c.issue || c.resolved) return `<div class="wb-line ${c.resolved?'fixed':''}">${c.resolved?'✓ ':''}${c.t}</div>`;
          return (c.issue.sev >= thr())
            ? `<div class="wb-line caught"><s>${c.t}</s>
                 <div class="wb-fix">✏️ правка эксперта: <code>${c.issue.fix}</code></div>
                 <div class="wb-note">${c.issue.note} <span class="wb-sev s${c.issue.sev}">sev${c.issue.sev}</span></div></div>`
            : `<div class="wb-line missed">${c.t}<span class="wb-miss">⚠ пропущено — поймал бы Senior <span class="wb-sev s${c.issue.sev}">sev${c.issue.sev}</span></span></div>`;
        }).join('')}
      </div>
      <div class="wb-meter">
        <div class="wbm"><span>Поймано и исправлено</span><b class="good">${caught.length}</b></div>
        <div class="wbm"><span>Уйдёт в прод непойманным</span><b class="${missed.length?'bad':'good'}">${missed.length}</b></div>
        <div class="wbm"><span>Глубина правок</span><b>${Math.round(caught.length/Math.max(1,draft.length)*100)}%</b></div>
        <div class="wbm"><span>Качество после правок</span><b class="${quality>=85?'good':quality>=70?'':'bad'}">${quality}%</b></div>
      </div>
      <div class="wb-actions">
        <button class="btn ghost" id="wbRev" ${caught.length?'':'disabled'}>↻ Запросить ревизию у роя (внести пойманные правки)</button>
        <button class="btn go" id="wbAcc">Принять ${missed.length?`· ${missed.length} непойманных в прод`:'· чисто'}</button>
      </div></div>`;
    ov.querySelector('#wbX').onclick = close;
    ov.querySelectorAll('.wb-exp button').forEach(b=>b.onclick=()=>{ exp=b.dataset.e; render(); });
    const rb = ov.querySelector('#wbRev'); if (rb && caught.length) rb.onclick=()=>{ draft.forEach(c=>{ if(c.issue && !c.resolved && c.issue.sev>=thr()) c.resolved=true; }); rev++; render(); toast('Рой внёс правки эксперта — ревизия v'+rev); };
    ov.querySelector('#wbAcc').onclick=()=>{ const m=draft.filter(c=>c.issue&&!c.resolved&&c.issue.sev<thr()).length;
      close(); onAccept&&onAccept(); toast(m ? `${ticket?.id||''} принято · ${m} непойманных проблем ушло в прод — нужен Senior` : `${ticket?.id||''} принято после правок — чисто`); };
  };
  function close(){ ov.classList.remove('show'); }
  ov.onclick = (e)=>{ if (e.target===ov) close(); };
  render();
}

/* ========================================================================== */
/*  СРЕДЫ ПОД РОЛЬ — у каждой роли свой инструмент, не один канбан           */
/* ========================================================================== */
function envHeader(d, sub){
  const cfg = COCKPITS[d.id] || {};
  const M = (cfg.metrics||[]).slice(0,3).map(m => Array.isArray(m)?{k:m[0],a:m[2]}:{k:m.k,a:m.after});
  return `<div class="env-bar">
    <div class="env-id"><span class="env-ic">${d.icon}</span><div><b>${cfg.role||d.label}</b><small>${sub}</small></div></div>
    <div class="env-kpis">${M.map(m=>`<span><b>${m.a}</b>${m.k}</span>`).join('')}</div>
    <span class="demo-tag">рой даёт черновик, эксперт правит</span></div>`;
}
function wbOpen(d, label){ // кнопка «в рабочую среду»
  return `<button class="btn go env-open">✏️ ${label||'Открыть в рабочей среде (правка эксперта)'}</button>`;
}
function wireEnv(root, d){
  const WB = WORKBENCH[d.id];
  root.querySelectorAll('.env-open').forEach(b=>b.onclick=()=>openWorkbench(d.id, {id:WB?WB.title:d.label, t:WB?WB.title:''}, ()=>toast('Принято после правок эксперта')));
}
/* интерактивный движок сред: эксперт ПРАВИТ РУКАМИ (contenteditable) → среда реагирует */
function escHtml(s){ return String(s).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
function escAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function lineHtml(WB, st, i, cls, prefix, code){ const x = WB.draft[i]; prefix = prefix||'';
  const wrap = (txt) => code ? `<code>${escHtml(txt)}</code>` : escHtml(txt);
  if (!x.issue) return `<div class="${cls}">${prefix}${wrap(x.t)}</div>`;
  if (st.fixed.has(i)) return `<div class="${cls} okfix">${prefix}${wrap(st.edited[i]||x.issue.fix)} <span class="env-ok">✓ правка эксперта</span></div>`;
  const val = escHtml(st.edited[i]!==undefined ? st.edited[i] : x.t);
  return `<div class="${cls} flag">${prefix}<div class="ed ${code?'code':''}" contenteditable="true" spellcheck="false" data-ed="${i}">${val}</div>
    <div class="env-issue"><span>⚠ ${escHtml(x.issue.note)} <i class="env-sev s${x.issue.sev}">sev${x.issue.sev}</i></span>
    <span class="env-tools"><button class="env-hint" data-hint="${i}">💡 подсказка</button><button class="env-accept" data-acc="${i}">✓ принять правку</button></span></div></div>`;
}
/* дженерик-редактор для доп. объектов очереди (item>0): тот же механизм правки + гейт */
function genericDraftHtml(d, c){
  const pass = c.majLeft()===0, s1 = c.s1left();
  return envHeader(d, c.WB.kind+' · правьте черновик роя, снимайте риски')+`
    <div class="gd">
      <div class="gd-h"><div><b>${c.WB.title}</b><small>${c.WB.who}</small></div><span class="gd-kind">${c.WB.kind}</span></div>
      <div class="gd-body">${c.WB.draft.map((x,i)=>c.line(i,'gd-line')).join('')}</div>
      <div class="gd-foot">
        <div class="gd-stat ${pass?'okfix':'bad'}">${pass?'✓ замечания сняты — можно принимать':'⚠ открыто '+c.majLeft()+' замечаний'+(s1?` · sev1: ${s1} (критично!)`:'')}</div>
        <button class="btn go env-act" data-l="принято в работу" data-t="Принято в работу · запись в аудит" ${pass?'':'disabled'}>Принять в работу ${pass?'':'(поправьте!)'}</button>
      </div>
    </div>`;
}
function envCore(root, d, build){
  const queue = [ WORKBENCH[d.id], ...(WB_QUEUE[d.id]||[]) ];   // item0 — основной (релевантен потоку), далее ширина
  const STORE = (window.__ENVST || (window.__ENVST = {}));
  const sroot = STORE[d.id] || (STORE[d.id] = { active:0 });
  if (sroot.active==null) sroot.active = 0;
  function draw(){
    const ai = Math.min(sroot.active||0, queue.length-1);
    const WB = queue[ai];
    const st = sroot['_'+ai] || (sroot['_'+ai] = { fixed:new Set(), edited:{}, extra:{}, sel:0 });
    const idx1 = WB.draft.map((c,i)=>i).filter(i=>WB.draft[i].issue && WB.draft[i].issue.sev===1);
    const ctx = { WB, st,
      s1left:()=>idx1.filter(i=>!st.fixed.has(i)).length,
      majLeft:()=>WB.draft.map((c,i)=>i).filter(i=>WB.draft[i].issue && WB.draft[i].issue.sev<=2 && !st.fixed.has(i)).length,
      line:(i,cls,prefix)=>lineHtml(WB,st,i,cls,prefix,false),
      codeLine:(i,cls)=>lineHtml(WB,st,i,cls,`<span class="ln">${i+1}</span>`,true) };
    const done=(i)=>sroot.done&&sroot.done.has(i);
    const rail = queue.length>1
      ? `<div class="env-queue"><span class="eq-l">📋 Очередь работы</span>${queue.map((w,i)=>`<button class="eq-item ${i===ai?'on':''} ${done(i)?'done':''}" data-q="${i}">${w.title}${done(i)?' ✓':(i===0?' ●':'')}</button>`).join('')}<span class="eq-hint">${queue.filter((w,i)=>done(i)).length}/${queue.length} готово · правь руками → гейт → принять</span></div>`
      : '';
    root.innerHTML = rail + (ai===0 ? build(ctx) : genericDraftHtml(d, ctx));
    root.querySelectorAll('.ed[data-ed]').forEach(e=>e.oninput=()=>{ st.edited[+e.dataset.ed]=e.textContent; });
    root.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.hint; st.edited[i]=WB.draft[i].issue.fix; draw();
      const e=root.querySelector(`.ed[data-ed="${i}"]`); if(e){ e.focus(); document.getSelection().selectAllChildren(e); document.getSelection().collapseToEnd(); } toast('Подсказка вставлена — можно поправить вручную'); });
    root.querySelectorAll('[data-acc]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.acc; const v=(st.edited[i]||'').trim();
      if(!v || v===WB.draft[i].t.trim()){ toast('Внесите правку в текст (или нажмите 💡)'); return; } st.fixed.add(i); draw(); toast('Правка эксперта принята'); });
    root.querySelectorAll('[data-tg]').forEach(b=>b.onclick=()=>{ st.extra[b.dataset.tg]=true; draw(); toast('Применено'); });
    root.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{ st.sel=+b.dataset.sel; draw(); });
    root.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ sroot.active=+b.dataset.q; draw(); });
    root.querySelectorAll('[data-toast]').forEach(b=>b.onclick=()=>toast(b.dataset.toast));
    root.querySelectorAll('[data-deal]').forEach(b=>b.onclick=()=>{ st.selDeal=+b.dataset.deal; draw(); });
    root.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>{ st.selAsset=+b.dataset.asset; draw(); });
    root.querySelectorAll('[data-cand]').forEach(b=>b.onclick=()=>{ st.selCand=+b.dataset.cand; draw(); });
    root.querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>streamChat(root, st, b.dataset.ask, b.dataset.reply||'Готово — обновил артефакт справа. Проверьте и примите.'));
    const cIn=root.querySelector('.chatx-in'), cSend=root.querySelector('.chatx-send');
    if (cSend) cSend.onclick=()=>{ const v=(cIn.value||'').trim(); if(!v) return; cIn.value=''; streamChat(root, st, v, 'Принял. Собрал черновик в артефакте справа — правьте руками и принимайте.'); };
    if (cIn) cIn.onkeydown=e=>{ if(e.key==='Enter' && cSend) cSend.onclick(); };
    const thr=root.querySelector('#chatxThread'); if(thr) thr.scrollTop=thr.scrollHeight;
    root.querySelectorAll('.nbb-gen').forEach(b=>b.onclick=()=>{ const sg=root.querySelector('.nbb-stage'); if(sg){ sg.classList.add('gen'); setTimeout(()=>{ sg.classList.remove('gen'); toast('Сгенерировано 4 варианта'); }, 950); } });
    root.querySelectorAll('.nb-run').forEach(b=>b.onclick=()=>{ if(b.hasAttribute('disabled'))return; const o=b.textContent; b.textContent='⏳ выполняется…'; b.setAttribute('disabled',''); setTimeout(()=>{ b.textContent=o; b.removeAttribute('disabled'); toast('Запрос выполнен · 0.4 c · 3 строки'); }, 700); });
    // — Claude Code: редактируемая вкладка tests.spec.ts (добавить недостающий тест на таймаут → разблокировать терминал/Merge)
    root.querySelectorAll('[data-test-ed]').forEach(e=>e.oninput=()=>{ st.testText=e.textContent; });
    root.querySelectorAll('[data-test-fill]').forEach(b=>b.onclick=()=>{ st.testText=DEV_SUGGEST_TEST; draw();
      const e=root.querySelector('[data-test-ed]'); if(e){ e.focus(); document.getSelection().selectAllChildren(e); document.getSelection().collapseToEnd(); } toast('Шаблон теста вставлен — поправьте при желании, затем «✓ добавить тест»'); });
    root.querySelectorAll('[data-test-add]').forEach(b=>b.onclick=()=>{ const v=(st.testText||'').trim();
      if(!/\b(it|test)\s*\(/.test(v) || !/(timeout|таймаут|reject|decline|отказ|3ds_timeout)/i.test(v)){ toast('Напишите тест на таймаут/отказ 3DS (или нажмите 💡)'); return; }
      st.testRunning=true; st.testAdded=true; draw();
      setTimeout(()=>{ st.testRunning=false; draw(); toast('Новый тест прошёл · покрытие 91% · Merge разблокирован'); }, 750); });
    // — Claude Code: настоящий терминал с вкладками (＋ новый терминал, команды отражают гейт)
    root.querySelectorAll('[data-term-sel]').forEach(b=>b.onclick=()=>{ st.termActive=+b.dataset.termSel; draw(); });
    root.querySelectorAll('[data-term-new]').forEach(b=>b.onclick=()=>{ st.terms=st.terms||[{title:'tests',log:[]}]; st.terms.push({title:'zsh '+st.terms.length, log:[]}); st.termActive=st.terms.length-1; draw(); toast('Новый терминал открыт'); setTimeout(()=>{const i=root.querySelector('.cc-term-in'); if(i) i.focus();},0); });
    const tin=root.querySelector('.cc-term-in'); if(tin) tin.onkeydown=e=>{ if(e.key!=='Enter')return; const cmd=(tin.value||'').trim(); if(!cmd)return;
      st.terms=st.terms||[{title:'tests',log:[]}]; const t=st.terms[Math.min(st.termActive||0,st.terms.length-1)];
      const g={ codeOk:ctx.majLeft()===0, testAdded:!!st.testAdded, maj:ctx.majLeft(), s1:ctx.s1left() };
      const r=devTermRun(cmd,g); if(r.clear){ t.log=[]; } else { t.log.push(r); } draw();
      const ni=root.querySelector('.cc-term-in'); if(ni) ni.focus(); };
    const tb=root.querySelector('#ccTermBody'); if(tb) tb.scrollTop=tb.scrollHeight;
    root.querySelectorAll('.env-open').forEach(b=>b.onclick=()=>openWorkbench(d.id,{id:WB.title,t:WB.title},()=>toast('Принято')));
    root.querySelectorAll('.env-act').forEach(b=>b.onclick=()=>{ if(b.hasAttribute('disabled'))return; b.textContent='✓ '+(b.dataset.l||'готово'); b.setAttribute('disabled',''); sroot.done=sroot.done||new Set(); sroot.done.add(ai); const pend=queue.findIndex((w,i)=>!sroot.done.has(i)); root.querySelectorAll('.eq-item').forEach((el,i)=>{ if(sroot.done.has(i)) el.classList.add('done'); }); const eqh=root.querySelector('.eq-hint'); if(eqh) eqh.textContent=`${queue.filter((w,i)=>sroot.done.has(i)).length}/${queue.length} готово · правь руками → гейт → принять`;
      if(d.id==='sales' && ai===0 && flowState().gamma<1){ flowState().gamma=1; pushAudit({who:'Оля · Продажи',emoji:'🤝',act:'КП «Гамма» принято → передано юристу',dept:'Продажи'}); toast('Сделка «Гамма» продвинулась: КП → юристу (см. След сделки)'); return; }
      toast((b.dataset.t||'Готово')+(pend>=0?' · дальше — «'+queue[pend].title+'» в очереди':' · все объекты закрыты')); });
  }
  draw();
}
/* Аналог нашего чата: разговор + артефакт-канвас (правка руками + гейт) для большинства ролей */
const ACCEPT_LABEL = { sales:'Отправить КП', marketing:'Опубликовать', hr:'Пригласить на интервью', finance:'Утвердить', legal:'Согласовать', analytics:'Принять инсайт' };
function chatEnvBuild(d, c){
  const P = PERSONAL[d.id] || { hi:'На связи. Чем помочь?', tasks:[] };
  if (!c.st.chat) c.st.chat = [{ a:P.hi }];
  const chat = c.st.chat, pass = c.majLeft()===0;
  const bubbles = chat.map(m=>`${m.u!==undefined?`<div class="chatx-b user">${escHtml(m.u)}</div>`:''}${m.a!==undefined?`<div class="chatx-b bot"><span class="chatx-ic">◆</span><div>${escHtml(m.a)}</div></div>`:''}`).join('');
  const prompts = (P.tasks||[]).map(t=>`<button class="chatx-chip" data-ask="${escAttr(t.q)}" data-reply="${escAttr(t.draft)}">${t.q}</button>`).join('');
  return envHeader(d, 'Ассистент-чат · попросите словами — артефакт справа правится руками и принимается')+`
    <div class="chatx">
      <div class="chatx-main">
        <div class="chatx-thread" id="chatxThread">${bubbles}</div>
        <div class="chatx-chips">${prompts}</div>
        <div class="chatx-input"><input class="chatx-in" placeholder="Напишите ассистенту своими словами…"/><button class="chatx-send">➤</button></div>
      </div>
      <div class="chatx-art">
        <div class="chatx-art-h"><div><b>${escHtml(c.WB.title)}</b><small>${c.WB.who}</small></div><span class="chatx-art-tag">артефакт · черновик роя</span></div>
        <div class="chatx-art-body">${c.WB.draft.map((x,i)=>c.line(i,'chatx-line')).join('')}</div>
        <div class="chatx-gate ${pass?'ok':'bad'}">${pass?'✓ замечания сняты — артефакт готов':'⚠ открыто '+c.majLeft()+' замечаний — правьте в артефакте'}</div>
        <button class="btn go env-act" data-l="принято" data-t="Артефакт принят · ушёл по процессу" ${pass?'':'disabled'} style="width:100%;margin-top:8px">${ACCEPT_LABEL[d.id]||'Принять'} ${pass?'':'(поправьте!)'}</button>
      </div>
    </div>`;
}
/* Эталонный тест на недостающий кейс (таймаут/отказ 3DS) — общий: вставляется кнопкой 💡 и валидируется в envCore */
const DEV_SUGGEST_TEST = [
  '  it("3DS timeout → graceful decline", async () => {',
  '    jest.useFakeTimers()',
  '    const p = pay3DS({ delayMs: 30000 })',
  '    jest.advanceTimersByTime(30000)',
  '    await expect(p).rejects.toThrow("3DS_TIMEOUT")',
  '  })'
].join('\n');
/* мок-интерпретатор терминала Claude Code: отражает реальное состояние гейта (код/тест) */
function devTermRun(cmd, g){ const q=cmd.toLowerCase().trim();
  if(/^(clear|cls)$/.test(q)) return {clear:true};
  if(/^help$/.test(q)) return {cmd, out:'команды: run tests · build · git status · ls · clear', cls:''};
  if(/(run )?tests?|jest|npm t/.test(q)) return g.codeOk&&g.testAdded ? {cmd, out:'✓ 144 passed · 0 failed · покрытие 91%', cls:'ok'}
    : g.codeOk ? {cmd, out:'✓ 143 passed · 0 failed — нет теста на таймаут/отказ 3DS · покрытие 86%', cls:'warn'}
    : {cmd, out:'✗ '+g.maj+' failed'+(g.s1?` · sev1: ${g.s1} — ушло бы в прод!`:''), cls:'bad'};
  if(/build|tsc|compile/.test(q)) return g.codeOk ? {cmd, out:'✓ build · 0 errors · 1.8s', cls:'ok'} : {cmd, out:'✗ build failed · '+g.maj+' проблем(ы) в handle3ds.ts', cls:'bad'};
  if(/git status|^status$/.test(q)) return {cmd, out:'On branch fix/3ds-timeout · modified: handle3ds.ts'+(g.testAdded?', tests.spec.ts':''), cls:''};
  if(/^ls|dir$/.test(q)) return {cmd, out:'handle3ds.ts   tests.spec.ts   schema.sql', cls:''};
  if(/git (commit|push)|merge|deploy/.test(q)) return {cmd, out:'мёрж только через кнопку Merge справа — гейт PR обязателен (код чист + тест на таймаут).', cls:'warn'};
  if(/coverage|cov/.test(q)) return {cmd, out:g.testAdded?'покрытие: 91% (таймаут 3DS закрыт)':'покрытие: 86% · пробел — таймаут/отказ 3DS', cls:g.testAdded?'ok':'warn'};
  return {cmd, out:`zsh: command not found: ${cmd} · наберите help`, cls:'bad'};
}
const ENVS2 = {
  dev:(root,d)=>envCore(root,d,c=>{ const codeOk=c.majLeft()===0, s1=c.s1left(), sel=c.st.sel||0;
    const testAdded=!!c.st.testAdded, testRunning=!!c.st.testRunning, mergeOk=codeOk&&testAdded&&!testRunning;
    const files=['handle3ds.ts','tests.spec.ts','schema.sql'];
    const SCHEMA=['CREATE TABLE payments (','  id          uuid PRIMARY KEY,','  session_id  uuid REFERENCES sessions(id),','  card_masked text NOT NULL,  -- только последние 4','  status      text NOT NULL,','  created_at  timestamptz DEFAULT now()',');'];
    const codeBox=(arr)=>`<div class="cc-code">${arr.map((l,i)=>`<div class="cc-ln"><span class="ln">${i+1}</span><code>${escHtml(l)}</code></div>`).join('')}</div>`;
    // — Вкладка tests.spec.ts: редактируемая, недостающий тест на таймаут блокирует Merge
    function testsTab(){
      const head=['describe("3DS payment", () => {','  it("happy path", async () => {','    await expect(pay3DS()).resolves.toBe("ok")','  })'];
      if(testAdded){
        const addLines=(c.st.testText||DEV_SUGGEST_TEST).split('\n');
        const all=[...head,...addLines,'})'], a0=head.length, a1=head.length+addLines.length-1;
        return `<div class="cc-code">${all.map((l,i)=>{const isNew=i>=a0&&i<=a1;return `<div class="cc-ln ${isNew?'cc-new':''}"><span class="ln">${i+1}</span><code>${escHtml(l)}</code>${isNew&&i===a0?'<span class="env-ok">✓ добавлен вами</span>':''}</div>`;}).join('')}</div>
          <div class="cc-testmsg ok">✓ тест на таймаут/отказ 3DS добавлен — покрытие 86% → 91%, Merge разблокирован</div>`;
      }
      const draftTxt=c.st.testText!==undefined?c.st.testText:'';
      const flagged=[...head,'  // ⚠ нет теста на таймаут/отказ 3DS','})'];
      return `<div class="cc-code">${flagged.map((l,i)=>`<div class="cc-ln ${l.includes('⚠')?'cc-miss':''}"><span class="ln">${i+1}</span><code>${escHtml(l)}</code></div>`).join('')}</div>
        <div class="cc-addtest">
          <div class="cc-addtest-h">➕ Добавьте недостающий тест <small>покройте таймаут/отказ 3DS — иначе Merge заблокирован</small></div>
          <div class="ed code cc-test-ed" contenteditable="true" spellcheck="false" data-test-ed data-ph='it("3DS timeout…", async () => { … })'>${escHtml(draftTxt)}</div>
          <div class="cc-addtest-tools"><button class="env-hint" data-test-fill>💡 подставить тест</button><button class="env-accept" data-test-add>✓ добавить тест</button></div>
        </div>`;
    }
    const center = sel===0 ? `<div class="cc-code">${c.WB.draft.map((x,i)=>c.codeLine(i,'cc-ln')).join('')}</div>` : sel===1 ? testsTab() : codeBox(SCHEMA);
    const plan=[['Воспроизвёл баг 3DS',true],['Нашёл причину и поправил',s1===0],['Добавил тест на таймаут 3DS',testAdded],['Прогнал тесты',mergeOk],['Ревью безопасности',s1===0]];
    let termCls,termTxt;
    if(!codeOk){ termCls='bad'; termTxt='✗ '+c.majLeft()+' замечаний'+(s1?` · sev1: ${s1} — ушло бы в прод!`:''); }
    else if(testRunning){ termCls='run'; termTxt='⏳ прогон нового теста на таймаут 3DS…'; }
    else if(!testAdded){ termCls='warn'; termTxt='✓ 143 passed · 0 failed — но нет теста на таймаут/отказ 3DS · покрытие 86% · Merge заблокирован'; }
    else { termCls='ok'; termTxt='✓ 144 passed · 0 failed · покрытие 91% · цифровой сотрудник готов открыть PR'; }
    const terms = c.st.terms || (c.st.terms=[{title:'tests', log:[]}]);
    const tActive = Math.min(c.st.termActive||0, terms.length-1);
    const termPanel = `<div class="cc-term">
      <div class="cc-term-tabs">${terms.map((t,i)=>`<button class="cc-term-tab ${i===tActive?'on':''}" data-term-sel="${i}">${escHtml(t.title)}</button>`).join('')}<button class="cc-term-tab new" data-term-new title="Новый терминал">＋ терминал</button></div>
      <div class="cc-term-body" id="ccTermBody">
        ${tActive===0?`<div class="ct-line"><span class="t-p">sreda ❯ run tests --3ds</span><div class="${termCls}">${termTxt}</div></div>`:`<div class="ct-line"><span class="cc-faint">новый терминал · наберите help</span></div>`}
        ${terms[tActive].log.map(e=>`<div class="ct-line"><span class="t-p">sreda ❯ ${escHtml(e.cmd)}</span><div class="${e.cls||''}">${escHtml(e.out)}</div></div>`).join('')}
      </div>
      <div class="cc-term-prompt"><span class="t-p">sreda ❯</span><input class="cc-term-in" placeholder="run tests · build · git status · ls · clear · help"/></div>
    </div>`;
    const agentMsg = s1 ? 'Нашёл критичное — нужно ваше решение, правьте отмеченные строки прямо здесь:'
      : !codeOk ? 'Поправьте отмеченные замечания в коде.'
      : !testAdded ? 'Код чист, но нет теста на таймаут/отказ 3DS — добавьте его на вкладке <code>tests.spec.ts</code>, без него не мёржу.'
      : 'Всё чисто, тест на таймаут на месте — можно мёржить.';
    return envHeader(d,'Claude Code · цифровой сотрудник кодит, вы направляете и мёржите')+`
    <div class="cc"><div class="cc-tree"><div class="cc-tree-h">📁 payments</div>${files.map((f,i)=>`<div class="cc-file ${i===sel?'on':''}" data-sel="${i}">${f}${i===0?' ●':(i===1&&!testAdded?' ⚠':'')}</div>`).join('')}
      <div class="cc-agent-tag">◆ цифровой сотрудник: Claude</div></div>
    <div class="cc-main"><div class="cc-thread">
        <div class="cc-m user">› ${escHtml(c.WB.title)}</div>
        <div class="cc-m bot"><b>◆ Цифровой сотрудник</b><div class="cc-plan">${plan.map(([t,ok])=>`<div class="cc-step ${ok?'ok':''}">${ok?'✓':'◌'} ${t}</div>`).join('')}</div></div>
        <div class="cc-m bot"><b>◆ Цифровой сотрудник</b> внёс правки в <code>${files[sel]}</code>. ${agentMsg}</div></div>
      ${center}
      ${termPanel}</div>
    <div class="cc-side"><div class="cc-pr"><b>PR #482</b><small>оплата 3DS · собрал цифровой сотрудник</small><div class="cc-checks"><div>✓ линтер</div><div class="${codeOk?'':'bad'}">${codeOk?'✓':'✗'} сборка</div><div class="${s1?'bad':''}">${s1?'⚠ '+s1+' риск ИБ':'✓ безопасность'}</div><div class="${testAdded?'':'bad'}">${testAdded?'✓ тест на таймаут':'⚠ нет теста на таймаут'}</div></div></div>
      <button class="btn go env-act" data-l="смержено" data-t="PR #482 в проде" ${mergeOk?'':'disabled'}>Merge ✓ ${mergeOk?'':'заблок.'}</button>
      <button class="btn ghost env-open" style="margin-top:8px">🎓 Как уровни ловят ошибки</button></div></div>`; }),

  analytics:(root,d)=>envCore(root,d,c=>{ const jf=c.st.fixed.has(1); const rows=jf?[['cart',12480,100],['3ds',5120,41],['paid',4020,32]]:[['cart',12480,100],['3ds',9210,74],['paid',8050,64]];
    const vts=[['events',['id','uid','session_id','ts','step','is_bot']],['sessions',['session_id','uid','started_at','source']],['users',['uid','plan','created_at']],['billing',['uid','amount','refund','ts']],['funnels',['step','order','label']]]; const vs=c.st.sel||0;
    const presets=['Почему упал retention','Воронка чекаута','LTV по когортам','Выручка план/факт'];
    return envHeader(d,'Notebook · спроси данные словами → SQL → результат')+`
    <div class="fin-ai"><span class="fin-ai-ic">🪄</span><input class="fin-ai-in" readonly placeholder="Спросите данные словами: «конверсия чекаута по неделям»"/>${presets.map(p=>`<button class="fin-ai-p" data-toast="Сгенерирован SQL под «${p}» — см. ячейку [1]">${p}</button>`).join('')}</div>
    <div class="nb"><div class="nb-schema"><div class="nb-schema-h">🗄️ Витрины · доступ по роли</div>${vts.map((t,i)=>`<div class="nb-tbl ${i===vs?'on':''}" data-sel="${i}">▸ ${t[0]}</div>`).join('')}
      <div class="nb-cols"><div class="nb-cols-h">колонки · ${vts[vs][0]}</div>${vts[vs][1].map(col=>`<span>${col}</span>`).join('')}</div></div>
    <div class="nb-main"><div class="nb-cell"><div class="nb-cell-h"><span>[1] SQL · правь черновик роя</span><button class="nb-run" data-toast="Запрос выполнен · 0.4 c · 3 строки">▶ Запустить</button></div>
      <div class="nb-sql">${c.WB.draft.map((x,i)=>c.codeLine(i,'nb-ln')).join('')}</div></div>
      <div class="nb-cell"><div class="nb-cell-h"><span>[1] Результат · 3 строки · 0.4 c</span>${jf?'<span class="env-ok">✓ join исправлен</span>':'<span class="bad">⚠ дубли в join — конверсия завышена</span>'}</div>
        <table class="nb-tbl-out"><tr><th>step</th><th>count</th><th>conv</th></tr>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1].toLocaleString('ru')}</td><td>${r[2]}%</td></tr>`).join('')}</table>
        <div class="nb-chart">${rows.map(r=>`<div class="nb-barw"><i style="height:${r[2]}%"></i><span>${r[0]}</span></div>`).join('')}</div></div></div></div>`; }),

  legal:(root,d)=>envCore(root,d,c=>{ const ready=c.majLeft()===0, s1=c.s1left();
    const open=c.WB.draft.map((x,i)=>({x,i})).filter(o=>o.x.issue&&!c.st.fixed.has(o.i));
    const sev1=open.filter(o=>o.x.issue.sev===1).length, sev2=open.filter(o=>o.x.issue.sev===2).length;
    const presets=['Проверить риски','Сравнить с шаблоном','Сгенерировать DPA','Кэп ответственности'];
    return envHeader(d,'Контракт-ревью · риски по пунктам, AI-проверка, подпись')+`
    <div class="doc">
      <div class="doc-clauses"><div class="doc-cl-h">Пункты · ${c.WB.draft.length}</div>${c.WB.draft.map((x,i)=>{const op=x.issue&&!c.st.fixed.has(i);const sv=x.issue?x.issue.sev:0;return `<div class="doc-cl ${op?'risk':''}">§${i+1}${x.issue?(c.st.fixed.has(i)?' <span class="cl-ok">✓</span>':` <i class="cl-dot s${sv}"></i>`):''}</div>`;}).join('')}</div>
      <div class="doc-body"><div class="fin-ai"><span class="fin-ai-ic">🪄</span><input class="fin-ai-in" readonly placeholder="Спросите по договору: «чем грозит п.7 и как закрыть?»"/>${presets.map(p=>`<button class="fin-ai-p" data-toast="«${p}» — рой подготовил, смотрите правки в пунктах">${p}</button>`).join('')}</div>
        <div class="doc-title">${c.WB.title.replace(/^[A-ЯA-Z0-9-]+ · /,'')}</div>${c.WB.draft.map((x,i)=>c.line(i,'doc-p '+(x.issue&&!c.st.fixed.has(i)?'risk':''),`<span class="doc-n">§${i+1}</span>`)).join('')}</div>
      <div class="doc-risk"><div class="doc-risk-h">⚠ Риск-резюме</div>
        <div class="doc-score ${ready?'ok':sev1?'hi':'med'}">${ready?'Риск: низкий':sev1?'Риск: высокий':'Риск: средний'}</div>
        <div class="risk-row"><span class="risk hi">sev1</span> критичные<b>${sev1}</b></div>
        <div class="risk-row"><span class="risk med">sev2</span> существенные<b>${sev2}</b></div>
        <div class="doc-sign ${ready?'ok':''}">${ready?'🔓 Готово к подписи':'🔒 Подпись заблокирована: открыты риски'}</div>
        <button class="btn go env-act" data-l="подписано" data-t="Договор подписан" ${ready?'':'disabled'} style="width:100%;margin-top:8px">Подписать ${ready?'':'(риски!)'}</button>
        <div class="doc-eo">⚖️ Подпись — решение человека. ИИ-проверка = рекомендация; ответственность по E&O-полису.</div></div></div>`; }),

  hr:(root,d)=>envCore(root,d,c=>chatEnvBuild(d,c)),

  finance:(root,d)=>envCore(root,d,c=>{ const seas=c.st.fixed.has(0), vat=c.st.fixed.has(2); const sc=c.st.sel||0;
    const scMul=[1,1.12,0.85][sc], scName=['Base','Оптимистичный','Стресс'][sc];
    const moBase=seas?[12.0,13.2,13.0]:[12.0,13.8,15.9];
    const mo=moBase.map(x=>+(x*scMul).toFixed(1));
    const revQ=+(mo[0]+mo[1]+mo[2]).toFixed(1), exp=27.3, vatV=vat?4.2:0;
    const gross=+(revQ-exp).toFixed(1), margin=Math.round(gross/revQ*100);
    const cashMo=mo.map(x=>+(x-9.1).toFixed(1)), cashQ=+(gross-vatV).toFixed(1), maxc=Math.max(...cashMo,1);
    const presets=['Выручка −10%','Ускорить найм','Заморозить расходы','Поднять цены 5%'];
    return envHeader(d,'Финмодель · сценарии, AI-допущения, утверждение')+`
    <div class="sheet">
    <div class="fin-ai"><span class="fin-ai-ic">🪄</span><input class="fin-ai-in" readonly placeholder="Спросите модель словами: «что если выручка упадёт на 10%»"/>${presets.map(p=>`<button class="fin-ai-p" data-toast="Сценарий «${p}» просчитан — смотрите таблицу">${p}</button>`).join('')}</div>
    <div class="sheet-tabs">${['Base','Optimistic','Stress'].map((t,i)=>`<span class="${i===sc?'on':''}" data-sel="${i}">${t}</span>`).join('')}</div>
    <div class="fin-grid"><table class="sheet-t"><tr><th>${scName}</th><th>Июл</th><th>Авг</th><th>Сен</th><th>Q3</th></tr>
      <tr><td>Выручка</td><td>${mo[0]}</td><td>${mo[1]}</td><td>${mo[2]}</td><td class="${seas?'':'amb'}">${revQ}${seas?' ✓':' ⚠'}</td></tr>
      <tr><td>Расходы</td><td>9.1</td><td>9.1</td><td>9.1</td><td>${exp}</td></tr>
      <tr class="sep"><td>Валовая прибыль</td><td>${(mo[0]-9.1).toFixed(1)}</td><td>${(mo[1]-9.1).toFixed(1)}</td><td>${(mo[2]-9.1).toFixed(1)}</td><td><b>${gross}</b></td></tr>
      <tr><td>Маржа</td><td colspan="3" style="color:var(--muted);font-size:11px">валовая, Q3</td><td class="${margin>=30?'':'amb'}">${margin}%</td></tr>
      <tr><td>НДС</td><td>—</td><td>—</td><td>—</td><td class="${vat?'':'bad'}">${vat?'4.2 ✓':'не выделен ⚠'}</td></tr>
      <tr class="sep"><td>Чистый кэш</td><td>${cashMo[0]}</td><td>${cashMo[1]}</td><td>${cashMo[2]}</td><td><b class="${cashQ>0?'':'bad'}">${cashQ}</b></td></tr></table>
      <div class="fin-chart"><div class="fin-chart-h">Чистый кэш по месяцам, млн ₽</div><div class="fin-bars">${cashMo.map((v,i)=>`<div class="fin-bar"><b>${v}</b><i style="height:${Math.max(6,Math.round(v/maxc*100))}%"></i><span>${['Июл','Авг','Сен'][i]}</span></div>`).join('')}</div></div></div>
    <div class="sheet-assum"><div class="sheet-as-h">Допущения модели — правь руками или через 🪄, пересчитается</div>
      ${c.WB.draft.map((x,i)=>c.line(i,'sheet-as')).join('')}
      <button class="btn go env-act" data-l="утверждено" data-t="Модель утверждена" ${c.majLeft()===0?'':'disabled'} style="width:100%;margin-top:10px">Утвердить ${c.majLeft()===0?'':'(поправьте допущения!)'}</button></div></div>`; }),

  design:(root,d)=>envCore(root,d,c=>{ const cf=c.st.fixed.has(0), lf=c.st.fixed.has(1), pass=cf&&lf, vr=c.st.sel||0;
    const presets=['Минимализм','Бренд-стиль','Тёмная тема','Крупный CTA'];
    const vars=['Вариант A','Вариант B','Вариант C','Вариант D'];
    const art = `<div class="nbb-art v${vr}">
        <div class="nbb-art-h">Чекаут v2${pass?' · финал':''}</div>
        <div class="nbb-field">${lf?'<small>Номер карты</small>':''}•••• 4242</div>
        <button class="nbb-pay" style="${cf?'background:#111;color:#fff':''}">Оплатить</button>
        <div class="nbb-flag ${pass?'ok':'bad'}">${pass?'✓ WCAG AA':'⚠ контраст 2.1 — провал AA'}</div></div>`;
    return envHeader(d,'Nano Banana · опиши правку — изображение меняется')+`
    <div class="nbb">
      <div class="nbb-left">
        <div class="nbb-prompt"><div class="nbb-h">✨ Промпт</div>
          <div class="nbb-pin">Экран чекаута под бренд, светлая тема, крупная кнопка оплаты, поля с подписями</div>
          <div class="nbb-presets">${presets.map(p=>`<span data-toast="Стиль «${p}» применён к генерации">${p}</span>`).join('')}</div>
          <button class="btn go nbb-gen" style="width:100%">✨ Сгенерировать</button></div>
        <div class="nbb-h">Варианты</div>
        <div class="nbb-vars">${vars.map((v,i)=>`<button class="nbb-var ${i===vr?'on':''}" data-sel="${i}"><span class="nbb-thumb v${i}"></span>${v}</button>`).join('')}</div>
      </div>
      <div class="nbb-stage">${art}<div class="nbb-badge">✨ сгенерировано · ${vars[vr]}</div></div>
      <div class="nbb-edits"><div class="nbb-h">Правки изображения <small>рой нашёл — примите промптом 💡 или правьте руками</small></div>
        ${c.WB.draft.map((x,i)=>c.line(i,'nbb-edit')).join('')}
        <div class="nbb-gate ${pass?'ok':'bad'}">${pass?'✓ a11y пройден — можно принять':'⚠ открыты правки a11y — приём заблокирован'}</div>
        <button class="btn go env-act" data-l="принято" data-t="Макет в дизайн-систему" ${pass?'':'disabled'} style="width:100%;margin-top:8px">Принять в дизайн-систему ${pass?'':'(a11y!)'}</button></div>
    </div>`; }),

  sales:(root,d)=>envCore(root,d,c=>{
    const pass=c.majLeft()===0;
    const deals=[
      {id:'L-882',name:'Завод «Магнит»',stage:'lead',sum:'—',score:72},
      {id:'L-879',name:'Ритейл «Лента»',stage:'lead',sum:'—',score:68},
      {id:'L-871',name:'Банк «Точка»',stage:'lead',sum:'—',score:81},
      {id:'D-340',name:'Сделка «Альфа»',stage:'qual',sum:'1.8 млн',score:91},
      {id:'D-336',name:'КП «Гамма»',stage:'kp',sum:'2.4 млн',score:88},
      {id:'D-330',name:'Договор «Дельта»',stage:'deal',sum:'5.1 млн',score:94},
      {id:'D-321',name:'«Омега»',stage:'won',sum:'5.1 млн',score:100},
    ];
    const stages=[['lead','Лиды'],['qual','Квалификация · рой'],['kp','КП на ревью'],['deal','Договор'],['won','Закрыто ✓']];
    const selDeal=c.st.selDeal||1;
    const deal=deals[selDeal];
    const WB=c.WB;
    return envHeader(d,'CRM · воронка, КП, карта ЛПР, скоринг')+`
    <div class="crm2">
      <div class="crm2-funnel">
        <div class="crm2-fh">Воронка · ${deals.length} сделок</div>
        <div class="crm2-cols">${stages.map(([k,label])=>`
          <div class="crm2-col">
            <div class="crm2-ch">${label}<span>${deals.filter(x=>x.stage===k).length}</span></div>
            <div class="crm2-cards">${deals.filter(x=>x.stage===k).map((x,i)=>`
              <div class="crm2-card ${x.id===deal.id?'on':''}" data-deal="${deals.indexOf(x)}">
                <b>${x.name}</b>
                <span>${x.sum}</span>
                <div class="crm2-sc ${x.score>=90?'hi':x.score>=75?'med':'low'}">${x.score}</div>
              </div>`).join('')}</div>
          </div>`).join('')}</div>
      </div>
      <div class="crm2-deal">
        <div class="crm2-dh"><div><b>${deal.name}</b><small>${deal.id} · ${deal.sum}</small></div><span class="crm2-tag ${deal.stage}">${stages.find(s=>s[0]===deal.stage)[1]}</span></div>
        <div class="crm2-kp">
          <div class="crm2-kph">📄 Коммерческое предложение · черновик роя</div>
          ${WB.draft.map((x,i)=>c.line(i,'crm2-line')).join('')}
          ${wbOpen(d,'Открыть КП (правка цены, скидки, ЛПР → гейт)')}
        </div>
        <div class="crm2-lpc">
          <div class="crm2-lph">🗺️ Карта ЛПР</div>
          ${[['ИТ-директор','инициатор','ok'],['CFO','бюджет ⚠','warn'],['Безопасность','блокер',''],['Юрист','договор','']].map(([name,role,status])=>`
            <div class="crm2-lp ${status}"><b>${name}</b><span>${role}</span>${status==='ok'?'✓':status==='warn'?'⚠':''}</div>`).join('')}
        </div>
        <div class="crm2-gate ${pass?'ok':'bad'}">${pass?'✓ КП чисто — можно отправить':'⚠ Открыты замечания в КП — гейт заблокирован'}</div>
        <button class="btn go env-act" data-l="отправлено" data-t="КП отправлено клиенту" ${pass?'':'disabled'} style="width:100%;margin-top:10px">Отправить КП ${pass?'':'(поправьте!)'}</button>
      </div>
    </div>`; }),

  marketing:(root,d)=>envCore(root,d,c=>{
    const pass=c.majLeft()===0;
    const WB=c.WB;
    const assets=[['Лендинг «Lite»','●','landing'],['5 писем','','emails'],['10 постов','','posts'],['6 клипов','','clips']];
    const selAsset=c.st.selAsset||0;
    const channels=[['VK','план'],['Telegram','план'],['Email','план'],['Дзен','план']];
    return envHeader(d,'Content Studio · кампании, копи, каналы, legal-гейт')+`
    <div class="mkt2">
      <div class="mkt2-assets">
        <div class="mkt2-ah">Кампания «Lite»</div>
        ${assets.map((a,i)=>`<div class="mkt2-asset ${i===selAsset?'on':''}" data-asset="${i}">${a[0]}${a[1]?` <span>${a[1]}</span>`:''}</div>`).join('')}
        <div class="mkt2-ch">Каналы</div>
        ${channels.map(ch=>`<div class="mkt2-ch-item">${ch[0]}<span>${ch[1]}</span></div>`).join('')}
      </div>
      <div class="mkt2-editor">
        <div class="mkt2-eh">✍️ ${assets[selAsset][0]} · черновик роя</div>
        <div class="mkt2-body">
          ${WB.draft.map((x,i)=>c.line(i,'mkt2-line')).join('')}
        </div>
        <div class="mkt2-legal ${pass?'ok':'bad'}">${pass?'✓ Legal-гейт пройден (38-ФЗ)':'⚠ Legal-гейт: «№1»/«гарантия» — риск по 38-ФЗ, публикация заблокирована'}</div>
        ${wbOpen(d,'Открыть редактор (бренд + legal-гейт → правки)')}
      </div>
      <div class="mkt2-right">
        <div class="mkt2-utm">
          <div class="mkt2-utmh">🔗 UTM-генератор</div>
          ${['utm_source=vk','utm_medium=social','utm_campaign=lite_launch','utm_content=post_1'].map(u=>`<div class="mkt2-utmi">${u}</div>`).join('')}
          <button class="btn ghost" style="width:100%;margin-top:8px;font-size:11px">📋 Копировать все</button>
        </div>
        <div class="mkt2-preview">
          <div class="mkt2-ph">👁️ Превью</div>
          <div class="mkt2-pv-card">
            <div class="mkt2-pv-h">Среда Lite</div>
            <div class="mkt2-pv-t">Операционная среда компании на ИИ. Кампания за день вместо трёх недель.</div>
            <div class="mkt2-pv-b">Узнать больше →</div>
          </div>
        </div>
        <div class="mkt2-gate ${pass?'ok':'bad'}">${pass?'✓ Готово к публикации':'⚠ Правки открыты — публикация заблокирована'}</div>
        <button class="btn go env-act" data-l="опубликовано" data-t="Кампания опубликована" ${pass?'':'disabled'} style="width:100%;margin-top:10px">Опубликовать ${pass?'':'(поправьте!)'}</button>
      </div>
    </div>`; }),

  hr:(root,d)=>envCore(root,d,c=>{
    const pass=c.majLeft()===0;
    const WB=c.WB;
    const candidates=[
      {name:'А. Петров',score:92,flag:''},
      {name:'И. Сидор',score:88,flag:'⚠ 47 лет'},
      {name:'М. Ким',score:85,flag:''},
      {name:'О. Лей',score:81,flag:'⚠ гэп в стаже'},
      {name:'Р. Дан',score:77,flag:''},
    ];
    const selCand=c.st.selCand||0;
    const cand=candidates[selCand];
    return envHeader(d,'ATS · кандидаты, скоринг, bias-аудит, онбординг')+`
    <div class="hr2">
      <div class="hr2-list">
        <div class="hr2-lh">48 откликов · Backend</div>
        ${candidates.map((x,i)=>`<div class="hr2-cand ${i===selCand?'on':''}" data-cand="${i}">
          <b>${x.name}</b><span class="hr2-score ${x.score>=90?'hi':x.score>=80?'med':'low'}">${x.score}</span>
          ${x.flag?`<small class="hr2-flag">${x.flag}</small>`:''}
        </div>`).join('')}
        <div class="hr2-oh">Онбординг · 3 активных</div>
        ${[['DevOps нанят','неделя 1'],['Senior QA','день 3'],['Product Manager','день 1']].map(o=>`<div class="hr2-onb"><b>${o[0]}</b><span>${o[1]}</span></div>`).join('')}
      </div>
      <div class="hr2-main">
        <div class="hr2-mh"><div><b>Скрининг · ${cand.name}</b><small>Backend · ${cand.score}/100</small></div>
          <span class="hr2-tag ${cand.flag?'warn':'ok'}">${cand.flag?'требует проверки':'прошёл скрининг'}</span>
        </div>
        <div class="hr2-crit">
          <div class="hr2-ch">Критерии роя · проверьте на дискриминацию</div>
          ${WB.draft.map((x,i)=>c.line(i,'hr2-line')).join('')}
        </div>
        <div class="hr2-bias">
          <div class="hr2-bh">⚖️ Bias-аудит</div>
          ${[['Возраст','neutral','проверено'],['Гэп в стаже','warn','может быть предвзято'],['Ключевые слова','ok','по проектам, не по словам'],['Гендер','ok','не используется']].map(([name,status,note])=>`
            <div class="hr2-bi ${status}"><b>${name}</b><span>${note}</span>${status==='ok'?'✓':status==='warn'?'⚠':'—'}</div>`).join('')}
        </div>
        <div class="hr2-gate ${pass?'ok':'bad'}">${pass?'✓ Скрининг чист — можно пригласить':'⚠ Открыты замечания — решение = рекомендация, не действие'}</div>
        <button class="btn go env-act" data-l="приглашён" data-t="Кандидат приглашён на интервью" ${pass?'':'disabled'} style="width:100%;margin-top:10px">Пригласить на интервью ${pass?'':'(поправьте!)'}</button>
      </div>
      <div class="hr2-right">
        <div class="hr2-offer">
          <div class="hr2-offh">💰 Оффер-калькулятор</div>
          <div class="hr2-offr"><span>Грейд</span><b>Senior</b></div>
          <div class="hr2-offr"><span>Вилка по рынку</span><b>₽350–480k</b></div>
          <div class="hr2-offr"><span>Опыт</span><b>7 лет</b></div>
          <div class="hr2-offr"><span>Рекомендация роя</span><b class="good">₽420k</b></div>
        </div>
        <div class="hr2-plan">
          <div class="hr2-ph">📋 План онбординга</div>
          <div class="hr2-ps"><b>День 1</b><span>доступы, наставник, чек-поинт</span></div>
          <div class="hr2-ps"><b>День 3</b><span>первый тикет, код-ревью</span></div>
          <div class="hr2-ps"><b>День 7</b><span>1:1 с тимлидом</span></div>
          <div class="hr2-ps"><b>День 14</b><span>чек-поинт приёмки</span></div>
        </div>
      </div>
    </div>`; }),
};
function renderEnv(root, d){ const E = ENVS2[d.id]; if (E) E(root, d); else renderCockpit(root, d); }

/* generic-кабинет для любой роли из COCKPITS[d.id] */
function renderCockpit(root, d){
  const cfg = COCKPITS[d.id] || COCKPITS.dev;
  const M = cfg.metrics.map(m => Array.isArray(m)?{k:m[0],before:m[1],after:m[2]}:m);
  const TEAM = cfg.team.map(t => Array.isArray(t)?{name:t[0],role:t[1],task:t[2],emoji:t[3]}:t);
  const SH = cfg.shared.map(s => Array.isArray(s)?{n:s[0],e:s[1]}:s);
  const cols = cfg.cols, K = cols.map(c=>c[0]);
  const board = JSON.parse(JSON.stringify(cfg.board));
  let running = false;

  root.innerHTML = workHead(d, `${cfg.role} · рабочий кабинет команды`) + `
    <div class="core-thesis">${cfg.thesis}</div>
    <div class="dev-metrics" id="ckMetrics" style="grid-template-columns:repeat(${Math.min(M.length,6)},1fr)"></div>
    <div class="dev-cols-wrap"><div class="dev-cols" id="ckCols" style="grid-template-columns:repeat(${cols.length},minmax(178px,1fr))"></div></div>
    <div class="two-col" style="align-items:start;margin-top:22px">
      <div class="panel"><h2>👥 Команда и их рои <span class="tag">${TEAM.length} человек · у каждого свой рой</span></h2><div class="dev-team" id="ckTeam"></div></div>
      <details class="panel" open><summary style="cursor:pointer;list-style:none"><h2 style="display:inline">🤝 Общие цифровые сотрудники команды</h2></summary><div class="dev-shared" id="ckShared" style="margin-top:10px"></div>
        <div class="od-gov" style="margin-top:11px">ИИ — не «волшебная кнопка»: рой даёт <b>черновик</b>, эксперт его правит. Чем выше экспертиза — тем больше пойманных ошибок и правок. <b>Гейт открывает рабочую среду, а не телепортирует в «готово».</b></div>
        <button class="btn go" id="ckRun" style="width:100%;margin-top:12px">▶ Открыть задачу в рабочей среде (черновик → правки)</button></details>
    </div>`;
  $('#ckMetrics', root).innerHTML = M.map(m=>`<div class="dm"><span>${m.k}</span><div class="dm-v"><s>${m.before}</s><b>${m.after}</b></div></div>`).join('');
  $('#ckTeam', root).innerHTML = TEAM.map(p=>`<div class="dev-p"><span class="dp-av">${p.emoji||'🧑'}</span><div><b>${p.name}</b><small>${p.role} · ${p.task}</small></div><span class="dp-swarm">рой ×6</span></div>`).join('');
  $('#ckShared', root).innerHTML = SH.map(a=>`<div class="dev-sh"><span>${a.e}</span>${a.n}</div>`).join('');

  const card = (t,k) => { const ci=K.indexOf(k); const cls=['','work','review','ci','prod'][ci]||'';
    return `<div class="tk ${cls} ${t.done?'done':''}">
      <div class="tk-id">${t.id}</div><div class="tk-t">${t.t}</div>
      ${t.who?`<div class="tk-who">${ci===2?'⚑ ждёт':'👤'} ${t.who}</div>`:''}
      ${t.agents?`<div class="tk-ag">${t.agents.map(a=>{const ag=AGENTS[a]||{name:'Security',emoji:'🛡️'};return `<span title="${ag.name}">${ag.emoji}</span>`;}).join('')}<span class="spin"></span></div>`:''}
      ${t.merge?`<button class="btn go tk-merge" data-id="${t.id}">${cfg.gate}</button>`:''}</div>`; };
  const draw = () => {
    $('#ckCols', root).innerHTML = cols.map(([k,label])=>`<div class="dev-col"><div class="dc-h">${label}<b>${board[k].length}</b></div>
      <div class="dc-body">${board[k].map(t=>card(t,k)).join('')||'<div class="dc-empty">—</div>'}</div></div>`).join('');
    $$('.tk-merge', root).forEach(b=>b.onclick=()=>gate(b.dataset.id));
  };
  draw();
  const move=(t,from,to)=>{ board[from]=board[from].filter(x=>x!==t); board[to].push(t); };
  $('#ckRun', root).onclick = () => {
    if (!board[K[0]].length){ toast('Очередь пуста'); return; }
    const t = board[K[0]][0];
    openWorkbench(d.id, t, () => { t.done=true; t.who=null; delete t.agents; move(t,K[0],K[4]); draw(); });
  };
  const gate = (id) => { const t = board[K[2]].find(x=>x.id===id); if(!t) return;
    openWorkbench(d.id, t, () => { t.done=true; t.who=null; delete t.merge; move(t,K[2],K[4]); draw(); }); };
}

/* renderDevCockpit удалён — кабинет разработки теперь рендерится через ENVS2.dev (IDE) */

/* ========================================================================== */
/*  БИБЛИОТЕКА — продуктовый каталог: ~200 цифровых сотрудников · ~1000 умений            */
/* ========================================================================== */
function buildLibrary(){
  const agents = [], skills = [];
  let si = 0, ai = 0;
  const dec = (o, i) => ({ ...o, rating:(4.4 + (i*7%6)/10).toFixed(1), installs:(((i*137)%39)+1)/10>2?(((i*317)%48)+3)+'00':(((i*53)%9)+1)+'k',
    price:(i%5===0)?[190,290,390,490,690,890][i%6]:0, pol:LIB_POL[i%LIB_POL.length] });
  DEPT_CATALOG.forEach(dep => {
    dep.skills.forEach(s => {
      const base = { dept:dep.id, dl:dep.label, emoji:dep.emoji, color:dep.color, name:s[0], does:s[1], featured:true };
      skills.push(dec({ ...base, id:'sk'+(si) }, si)); si++;
      LIB_SEG.forEach(g => { skills.push(dec({ ...base, id:'sk'+(si), name:s[0]+' · '+g, featured:false }, si)); si++; });
    });
    dep.agents.forEach(a => {
      const base = { dept:dep.id, dl:dep.label, emoji:dep.emoji, color:dep.color, name:a[0], focus:a[1], featured:true };
      agents.push(dec({ ...base, id:'ag'+(ai), skills:6+(ai%9) }, ai)); ai++;
      LIB_SPEC.slice(0,3).forEach(sp => { agents.push(dec({ ...base, id:'ag'+(ai), name:a[0]+' · '+sp, focus:a[1]+' · '+sp, featured:false, skills:6+(ai%9) }, ai)); ai++; });
    });
  });
  /* рои под должность: связки умений при человеке — из ROLE_SWARM */
  const deptOfRole = (role) => { for (const rid of ROLE_IDS){ const t = COCKPITS[rid] && COCKPITS[rid].team;
    if (t && t.some(p => (Array.isArray(p) ? p[1] : p.role) === role)) return rid; } return null; };
  const swarms = Object.keys(ROLE_SWARM).map((role, i) => { const sw = ROLE_SWARM[role];
    const rid = deptOfRole(role); const dep = DEPT_CATALOG.find(x => CAT2ROLE[x.id] === rid) || DEPT_CATALOG[i % DEPT_CATALOG.length];
    return { id:'sw'+i, role, d:sw.d, a:sw.a, dept:dep.id, dl:dep.label, emoji:'🧰', color:dep.color,
      rating:(4.5 + (i*7%5)/10).toFixed(1), installs:((i*61)%29+4)+'0', featured:i%4===0 }; });
  return { agents, skills, swarms };
}

function renderLibrary(root, d, opts){
  const LIB = (window.__LIB || (window.__LIB = buildLibrary()));
  const lock = opts && opts.lock;
  const roleId = lock ? CAT2ROLE[lock] : null;   // куда устанавливать (роль ассистента)
  const st = { type:'skill', dept: lock||'all', q:'', shown:24 };

  root.innerHTML = workHead(d, 'Библиотека цифровых сотрудников и умений — production-каталог, всё можно взять в работу') + `
    <div class="lib-stats">
      <div class="ls-stat"><b>${LIB.skills.length.toLocaleString('ru')}</b><span>умений</span></div>
      <div class="ls-stat"><b>${LIB.swarms.length}</b><span>роёв под должность</span></div>
      <div class="ls-stat"><b>${LIB.agents.length}</b><span>цифровых сотрудников</span></div>
      <div class="ls-stat"><b>★ 4.7</b><span>средний рейтинг</span></div>
      <div class="lib-search"><input id="libQ" placeholder="Поиск по ${LIB.skills.length.toLocaleString('ru')} умениям, ${LIB.swarms.length} роям и ${LIB.agents.length} цифровым сотрудникам…"/></div>
    </div>
    <div class="lib-controls">
      <div class="mk-tabs" id="libType"><button data-t="skill" class="on">🧠 Умения</button><button data-t="swarm">🧰 Рои под должность</button><button data-t="agent">🤖 Цифровые сотрудники</button></div>
    </div>
    <div class="lib-gloss"><b>Умение</b> — атом: одна операция, вызывается по запросу · <b>Рой</b> — связка умений при человеке: готовит черновики, отвечает носитель · <b>Цифровой сотрудник</b> — субъект в штате: ДИ, KPI, собственная ответственность</div>
    <div class="lib-body ${lock?'lib-locked':''}">
      <aside class="lib-rail" id="libRail"></aside>
      <div class="lib-main"><div class="lib-grid" id="libGrid"></div>
        <div class="lib-more" id="libMore"></div></div>
    </div>`;

  const listOf = (type) => type==='skill'?LIB.skills:type==='swarm'?LIB.swarms:LIB.agents;
  const countBy = (type, dep) => listOf(type).filter(x=>dep==='all'||x.dept===dep).length;

  const drawRail = () => {
    const arr = listOf(st.type);
    const rail = $('#libRail', root);
    rail.innerHTML = `<button class="lib-dep ${st.dept==='all'?'on':''}" data-d="all"><span>📚 Все отделы</span><b>${arr.length.toLocaleString('ru')}</b></button>` +
      DEPT_CATALOG.map(dep=>`<button class="lib-dep ${st.dept===dep.id?'on':''}" data-d="${dep.id}" style="--c:${dep.color}">
        <span><i class="ld-dot"></i>${dep.emoji} ${dep.label}</span><b>${countBy(st.type,dep.id).toLocaleString('ru')}</b></button>`).join('');
    $$('.lib-dep', rail).forEach(b=>b.onclick=()=>{ st.dept=b.dataset.d; st.shown=24; drawRail(); drawGrid(); });
  };

  const drawGrid = () => {
    const arr = listOf(st.type)
      .filter(x=> (st.dept==='all'||x.dept===st.dept) && (!st.q || (x.name||x.role).toLowerCase().includes(st.q)))
      .sort((a,b)=> (b.featured?1:0)-(a.featured?1:0));
    const grid = $('#libGrid', root);
    const btn = (x) => { const inst = roleId && isInstalled(roleId, st.type==='swarm'?'agent':st.type, st.type==='swarm'?x.a[0]:x.name);
      const lbl = inst ? (st.type==='swarm'?'✓ подключён':'✓ установлено') : st.type==='agent' ? 'Нанять' : st.type==='swarm' ? 'Подключить' : (x.price?'₽'+x.price:'Взять');
      return `<button class="btn ${inst?'lc-done':'go'} lc-take" ${inst?'disabled':''}>${lbl}</button>`; };
    grid.innerHTML = arr.slice(0, st.shown).map(x => st.type==='swarm' ? `
      <div class="lib-card" style="--c:${x.color}">
        <div class="lc-top"><span class="lc-emoji">${x.emoji}</span>
          <div class="lc-meta"><b>Рой: ${x.role}</b><small>${x.dl} · инструмент, не штат</small></div>
          ${x.featured?'<span class="lc-feat">★</span>':''}</div>
        <p class="lc-does">${x.d}</p>
        <div class="lc-swarm">${x.a.map(a=>`<span>${a}</span>`).join('')}</div>
        <div class="lc-foot"><span class="lc-rate">★ ${x.rating} · ⤓ ${x.installs}</span>
          ${btn(x)}</div>
      </div>` : st.type==='skill' ? `
      <div class="lib-card" style="--c:${x.color}">
        <div class="lc-top"><span class="lc-emoji">${x.emoji}</span>
          <div class="lc-meta"><b>${x.name}</b><small>${x.dl}</small></div>
          ${x.featured?'<span class="lc-feat">★</span>':''}</div>
        <p class="lc-does">${x.does||''}</p>
        <div class="lc-foot"><span class="mb"><i></i>${x.pol}</span>
          <span class="lc-rate">★ ${x.rating} · ⤓ ${x.installs}</span>
          ${btn(x)}</div>
      </div>` : `
      <div class="lib-card" style="--c:${x.color}">
        <div class="lc-top"><span class="lc-emoji">${x.emoji}</span>
          <div class="lc-meta"><b>${x.name}</b><small>${x.dl}</small></div>
          ${x.featured?'<span class="lc-feat">★</span>':''}</div>
        <p class="lc-does">${x.focus} · ~${x.skills} умений на борту</p>
        <div class="lc-foot"><span class="lc-rate">★ ${x.rating} · ⤓ ${x.installs}</span>
          ${btn(x)}</div>
      </div>`).join('');
    $$('.lc-take', grid).forEach((b,i)=>b.onclick=()=>{ const x=arr[i];
      if (roleId){
        if (st.type==='swarm'){ x.a.forEach(a=>installItem(roleId,'agent',a)); drawGrid();
          toast(`Рой «${x.role}» подключён — ${x.a.length} инструментов в вашем ассистенте`); return; }
        installItem(roleId, st.type, x.name); drawGrid();
        toast(st.type==='skill'?`Умение «${x.name}» установлено в ассистента → откройте «Мой ассистент»`:`Цифровой сотрудник «${x.name}» нанят и закреплён за вашей должностью`);
      } else { b.textContent='✓'; b.disabled=true; b.style.opacity=.6;
        toast(st.type==='skill'?`Умение «${x.name}» взято в работу`:st.type==='swarm'?`Рой «${x.role}» подключён к должности`:`Цифровой сотрудник «${x.name}» нанят в команду`); } });
    $('#libMore', root).innerHTML = arr.length>st.shown
      ? `<button class="btn ghost" id="libMoreBtn">Показать ещё · ${arr.length-st.shown} из ${arr.length.toLocaleString('ru')}</button>`
      : `<span class="lib-allshown">показано всё (${arr.length.toLocaleString('ru')})</span>`;
    const mb = $('#libMoreBtn', root); if (mb) mb.onclick=()=>{ st.shown+=24; drawGrid(); };
  };

  $$('#libType button', root).forEach(b=>b.onclick=()=>{ st.type=b.dataset.t; st.shown=24;
    $$('#libType button',root).forEach(x=>x.classList.toggle('on',x===b)); drawRail(); drawGrid(); });
  $('#libQ', root).oninput = (e)=>{ st.q=e.target.value.toLowerCase().trim(); st.shown=24; drawGrid(); };
  drawRail(); drawGrid();
}

/* renderMarketplace удалён — устаревший маркетплейс заменён «Библиотекой» (renderLibrary) */

/* ========================================================================== */
/*  МАРШРУТИЗАТОР МОДЕЛЕЙ — живой лидерборд                                   */
/* ========================================================================== */
function renderRouter(root, d){
  root.innerHTML = workHead(d, 'Маршрутизация без привязки к вендору: оптимальная модель для каждой задачи') + `
    <div class="grid-kpi">
      <div class="kpi"><div class="l">Моделей подключено</div><div class="v">${ROUTER_TOTAL}</div><div class="d up">▲ 12 за месяц</div></div>
      <div class="kpi"><div class="l">Вендоров</div><div class="v">9</div><div class="d flat">● не привязаны</div></div>
      <div class="kpi"><div class="l">Локальных (в периметре)</div><div class="v">19%</div><div class="d up">▲ приватные данные</div></div>
      <div class="kpi"><div class="l">Ср. экономия на маршруте</div><div class="v">61%</div><div class="d up">▲ vs «всё на топовой»</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <h2>🔀 Доля задач по моделям <span class="tag">live · последний час</span></h2>
        <div class="rt-head"><span>модель</span><span>класс</span><span>₽/вызов</span><span>латентность</span><span>приватность</span><span style="width:120px">доля</span></div>
        <div id="rtRows"></div>
      </div>
      <div class="panel">
        <h2>🧭 Правила маршрутизации</h2>
        <div id="rtRules"></div>
        <div class="od-gov" style="margin-top:12px">Оркестратор применяет правило автоматически — пользователь не выбирает модель и даже не знает её имени.</div>
      </div>
    </div>`;

  const rows = $('#rtRows', root);
  ROUTER_MODELS.forEach(m=>{
    const row = el(`<div class="rt-row">
      <span class="rt-nm">${m.name}<small>${m.vendor}</small></span>
      <span class="rt-tier">${m.tier}</span>
      <span>₽${m.price}</span>
      <span>${m.lat}ms</span>
      <span class="rt-priv ${m.priv==='локально'?'loc':''}">${m.priv}</span>
      <span class="rt-share"><span class="rt-track"><i></i></span><b>${m.share}%</b></span>
    </div>`);
    rows.appendChild(row);
    requestAnimationFrame(()=>setTimeout(()=>{ $('.rt-track i', row).style.width = (m.share/26*100)+'%'; },120));
  });
  $('#rtRules', root).innerHTML = ROUTER_RULES.map(r=>`
    <div class="rule"><div class="rule-when">${r.when}</div>
      <div class="rule-arrow">→</div>
      <div class="rule-pick"><b>${r.pick}</b><small>${r.why}</small></div></div>`).join('');
}

/* ========================================================================== */
/*  АУДИТ И ДОСТУП — governance, который можно потрогать                      */
/* ========================================================================== */
function renderAudit(root, d){
  root.innerHTML = workHead(d, 'Закрытый периметр: каждое действие записано, доступ ограничен ролью, данные не утекают') + `
    <div class="two-col">
      <div class="panel">
        <h2>📜 Аудит-трейл <span class="live" style="margin-left:auto">live</span></h2>
        <div id="auditLog" class="audit-log"></div>
      </div>
      <div>
        <div class="panel">
          <h2>🔐 Матрица доступа (RBAC)</h2>
          <div class="rbac">
            <div class="rbac-row rbac-hd"><span class="rbac-dept"></span>${RBAC_DOMAINS.map(x=>`<span class="rbac-h">${x}</span>`).join('')}</div>
            ${RBAC_MATRIX.map(r=>`<div class="rbac-row"><span class="rbac-dept">${r.dept}</span>
              ${r.cells.map(c=>`<span class="rbac-c ${c?'yes':'no'}">${c?'✓':'✕'}</span>`).join('')}</div>`).join('')}
          </div>
        </div>
        <div class="panel" style="display:flex;gap:14px;align-items:center">
          <div style="font-size:30px">🛡️</div>
          <div><b style="font-size:14px">Данные не покинули периметр</b>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">19% запросов с персональными данными ушли на локальные модели. 0 утечек за всё время.</div></div>
        </div>
      </div>
    </div>`;

  const log = $('#auditLog', root);
  const render1 = (e) => el(`<div class="au-row ${e.verdict} fade-in">
      <span class="au-time">${e.time}</span>
      <span class="au-emoji">${e.emoji}</span>
      <div class="au-body"><b>${e.who}</b> <span class="au-dept">${e.dept}</span><br><small>${e.act}</small></div>
      <span class="au-model">${e.model!=='—'?e.model:''}</span>
      <span class="au-cost">${e.cost?'₽'+e.cost:''}</span>
      <span class="au-verdict ${e.verdict}">${e.verdict==='allow'?'разрешено':'⛔ заблокировано'}</span>
    </div>`);
  auditLog().forEach(e => log.appendChild(render1(e)));   // реальные передачи и апрувы из этой сессии
  AUDIT_SEED.forEach(e => log.appendChild(render1(e)));

  // живой поток новых событий
  let i = 0;
  clearInterval(window.__auditTimer);
  window.__auditTimer = setInterval(()=>{
    if (!document.body.contains(log)) { clearInterval(window.__auditTimer); return; }
    const src = AUDIT_STREAM[i % AUDIT_STREAM.length]; i++;
    const now = new Date(); // браузер — Date доступен
    const hh = String(9).padStart(2,'0'), mm = String(43+i).padStart(2,'0'), ss = String((i*7)%60).padStart(2,'0');
    const node = render1({ ...src, time:`09:${String(43+i).padStart(2,'0')}:${ss}` });
    log.insertBefore(node, log.firstChild);
    while (log.children.length > 9) log.removeChild(log.lastChild);
  }, 2200);
}

/* ========================================================================== */
/*  СУПЕРСИЛА — Среда снимает зависимость ролей друг от друга                 */
/* ========================================================================== */
function renderPower(root, d){
  let after = false;
  root.innerHTML = workHead(d, 'Мы не заменяем людей — мы снимаем их зависимость друг от друга. Каждый получает соседние компетенции через свой рой') + `
    <div class="core-thesis"><b>Маршрутизация без привязки к вендору.</b> OpenAI, Anthropic, DeepSeek — лучшее от всех сразу, без привязки. Поверх — один эффект: <b>сейл собирает прототип без разработчиков, разработчик отдаёт код в прод в 100× быстрее.</b></div>

    <div class="pw-toggle" id="pwToggle">
      <button data-a="0" class="on">Как было</button>
      <button data-a="1">Со Средой</button>
    </div>

    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>🕸️ Зависимости между ролями <span class="tag" id="pwState">узкое горлышко: разработка</span></h2>
        <div class="dep-wrap"><svg id="depSvg" viewBox="0 0 300 300"></svg></div>
        <div class="pw-metrics" id="pwMetrics"></div>
      </div>
      <div class="panel">
        <h2>⚡ Суперсила каждой роли <span class="tag">соседние компетенции через рой</span></h2>
        <div id="pwCards"></div>
      </div>
    </div>

    <div class="panel prov">
      <h2>🔀 Маршрутизация без привязки к вендору</h2>
      <p class="core-sub">Оптимальная модель для каждой задачи — без переписывания кода:</p>
      <div class="prov-grid">${PROVIDERS.map(p=>`<div class="prov-card"><b>${p.n}</b><small>${p.best}</small></div>`).join('')}</div>
    </div>

    <div class="rm-cta" style="margin-top:14px">
      <b>Не сокращение штата, а расшивка узких мест.</b> Команда перестаёт ждать друг друга: каждый человек = кросс-функциональная команда из одного. Та же численность — кратно больше пропускной способности.
    </div>`;

  // SVG-паутина
  const cx=150, cy=150, R=112;
  const pos = POWER_NODES.map((_,i)=>{ const a=-Math.PI/2 + i/POWER_NODES.length*Math.PI*2; return { x:cx+Math.cos(a)*R, y:cy+Math.sin(a)*R }; });
  const edges = POWER_DEPS.map(([a,b])=>`<line class="dep-edge" x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}"/>`).join('');
  const nodes = POWER_NODES.map((n,i)=>{ const deg = POWER_DEPS.filter(e=>e[1]===i).length;
    return `<g class="dep-node ${deg>=2?'hub':''}" transform="translate(${pos[i].x},${pos[i].y})">
      <circle r="22"></circle><text class="dn-emoji" y="-1">${POWER_ROLES[i].emoji}</text>
      <text class="dn-label" y="34">${n}</text><text class="dn-ring" y="5">✓</text></g>`; }).join('');
  $('#depSvg', root).innerHTML = `<g id="depEdges">${edges}</g>${nodes}`;

  const draw = () => {
    const svg = $('#depSvg', root);
    svg.classList.toggle('untangled', after);
    $('#pwState', root).textContent = after ? 'каждый самодостаточен · 0 ожиданий' : 'узкое горлышко: разработка';
    const m = after ? POWER_METRICS.after : POWER_METRICS.before;
    $('#pwMetrics', root).innerHTML = `
      <div class="pwm"><span>Межролевых зависимостей</span><b class="${after?'good':''}">${m.deps}</b></div>
      <div class="pwm"><span>Среднее ожидание</span><b class="${after?'good':''}">${m.wait}</b></div>
      <div class="pwm"><span>Пропускная способность</span><b class="${after?'good':''}">${m.thru}</b></div>`;
    $('#pwCards', root).innerHTML = POWER_ROLES.map(r=>`
      <div class="pw-card">
        <span class="pwc-emoji">${r.emoji}</span>
        <div class="pwc-b">
          <div class="pwc-h"><b>${r.role}</b><span class="pwc-gain">${r.gain}</span></div>
          <div class="pwc-line ${after?'dim':''}"><span class="pwc-tag was">было</span>${r.before}</div>
          <div class="pwc-line ${after?'':'dim'}"><span class="pwc-tag now">стало</span>${r.after}</div>
        </div>
      </div>`).join('');
  };
  draw();

  $$('#pwToggle button', root).forEach(b=>b.onclick=()=>{ after = b.dataset.a==='1';
    $$('#pwToggle button',root).forEach(x=>x.classList.toggle('on',x===b)); draw(); });
}

/* ========================================================================== */
/*  РОЛИ — одна вертикаль над одним роем: от стажёра до президента            */
/* ========================================================================== */
function renderRoles(root, d){
  let idx = 0;
  root.innerHTML = workHead(d, 'Один IT-продукт делает всё — от поиска тендера до P&L. Каждый уровень получает свой рычаг над одним роем') + `
    <div class="core-thesis"><b>Общая ткань — одна на всех:</b> ${SHARED_FABRIC}. Знание демократично. <b>Но конверт полномочий — у каждого свой:</b> автономия, потолок модели, охват данных, право решения, поводок доверия. Quod licet Iovi, non licet bovi — зашито в продукт, а не на словах.</div>

    <div class="roles-step" id="rolesStep">
      ${ROLE_LADDER.map((r,i)=>`<button data-i="${i}" class="${i===0?'on':''}"><b>${i+1}</b>${r.title}</button>`).join('<span class="rs-line"></span>')}
    </div>

    <div class="two-col" style="align-items:start">
      <div class="panel" id="roleCard"></div>
      <div class="panel">
        <h2>🔗 Цепочка ценности <span class="tag">тендер → … → бюджет → прибыль</span></h2>
        <p class="core-sub">Что этот человек делает с роем на каждом этапе бизнес-цикла:</p>
        <div id="roleChain"></div>
        <div class="rel-legend">${Object.values(REL_META).map(m=>`<span class="rl ${m.c}">${m.t}</span>`).join('')}<span class="rl r-none">не касается</span></div>
      </div>
    </div>

    <div class="panel">
      <h2>🧬 Ассистент этого уровня <span class="tag">конверт полномочий · «что дозволено Юпитеру…»</span></h2>
      <p class="core-sub">Ткань одна. Но что ассистенту <b>разрешено</b> — зависит от позиции и заслуженного доверия. Вот чем отличается ИИ стажёра от ИИ президента:</p>
      <div class="env-auto" id="envAuto"></div>
      <div class="env-grid" id="envGrid"></div>
    </div>

    <div class="rm-cta" style="margin-top:14px">
      <b>Знание уравнивает, власть — градуирует.</b> Playbook читают все, договор подписывают единицы. Стажёр онбордится за минуты с мощью сеньора, но его ассистент на коротком поводке; ассистент президента видит компанию целиком и жжёт самую глубокую модель — потому что цена его «нет» необратима. Один продукт, но <b>каждому — свой конверт</b>.
    </div>`;

  const draw = () => {
    const r = ROLE_LADDER[idx];
    $('#roleCard', root).innerHTML = `
      <div class="role-verb"><span class="rv-l">Глагол уровня</span><b>${r.verb}</b></div>
      <div class="role-say">${r.say}</div>
      <div class="role-grid">
        <div><span>Единица работы</span><b>${r.unit}</b></div>
        <div><span>Отдаёт рою</span><b>${r.delegates}</b></div>
        <div><span>Контролирует (его гейт)</span><b>${r.controls}</b></div>
        <div><span>Роёв под ним</span><b>${r.scope.toLocaleString('ru')}</b></div>
      </div>
      <div class="role-face"><span>Интерфейс Среды на этом уровне</span><b class="rf-badge">${r.face}</b></div>`;

    $('#roleChain', root).innerHTML = VALUE_CHAIN.map((c,i)=>{
      const rel = r.rel[i]; const m = rel ? REL_META[rel] : null;
      return `<div class="chain-row ${rel?('act '+m.c):'rc-none'}">
        <span class="chain-ic">${c.ic}</span>
        <span class="chain-n">${c.n}</span>
        <span class="chain-rel">${m?m.t:'—'}</span></div>`;
    }).join('');

    // конверт полномочий ассистента
    const e = ROLE_ENV[idx];
    $('#envAuto', root).innerHTML = `<span class="ea-l">Автономия</span>
      <div class="ea-bar">${[1,2,3,4,5].map(n=>`<i class="${n<=e.lvl?'on':''}"></i>`).join('')}</div>
      <b>${e.auto}</b>`;
    const cells = [
      ['🧠','Потолок модели', e.model], ['🗄️','Охват данных', e.data], ['⚖️','Право решения', e.decide],
      ['🔗','Поводок доверия', e.trust], ['💸','Бюджет действий', e.budget],
    ];
    $('#envGrid', root).innerHTML = cells.map(c=>`<div class="env-cell">
      <span class="ec-ic">${c[0]}</span><div><span class="ec-l">${c[1]}</span><b>${c[2]}</b></div></div>`).join('');
  };
  draw();

  $$('#rolesStep button', root).forEach(b=>b.onclick=()=>{ idx=+b.dataset.i;
    $$('#rolesStep button',root).forEach(x=>x.classList.toggle('on',x===b)); draw(); });
}

/* renderLab (Лаборатория · RSP/ASL/Constitutional AI) удалён — вне продукта после разворота в заземлённое */

/* ========================================================================== */
/*  КОНТУР — само-улучшение под контролем человека (Сезоны 4–5)               */
/* ========================================================================== */
function renderCore(root, d){
  const m = { ...LOOP_METRICS0 };
  let running = false;

  root.innerHTML = workHead(d, 'Самый глубокий слой: как Среда становится умнее сама — и почему её всё ещё держит человек') + `
    <div class="core-thesis">Когда способность бесплатна, единственный ров — <b>аппарат суждения и ценности</b>. Это то, что остаётся дефицитным.</div>

    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>♾️ Петля само-улучшения <span class="tag" id="loopIter">итераций: 0</span></h2>
        <div class="loop" id="loopWrap">
          ${LOOP_STAGES.map((s,i)=>`<div class="loop-st" data-k="${s.k}">
            <div class="ls-ico ${s.human?'human':''}">${s.icon}</div>
            <div class="ls-b"><b>${s.t}</b><small>${s.d}</small></div>
            ${s.human?'<span class="ls-human">человек</span>':''}
            ${i<LOOP_STAGES.length-1?'<span class="ls-arrow">↓</span>':'<span class="ls-arrow loop-back">↺ назад к прогонам</span>'}
          </div>`).join('')}
        </div>
        <button class="btn go" id="loopRun" style="width:100%;margin-top:6px">▶ Запустить итерацию само-улучшения</button>
      </div>

      <div>
        <div class="panel">
          <h2>📊 Что растёт с каждой итерацией</h2>
          <div class="cm" id="coreMetrics"></div>
          <div class="od-gov">Среда улучшает не результат, а <b>процесс, который производит результаты</b>. Сложный процент по качеству и стоимости.</div>
        </div>

        <div class="panel">
          <h2>⚔️ Аппарат суждения <span class="tag">контроль непрозрачного</span></h2>
          <p class="core-sub">Как принять работу, которую уже нельзя прочитать целиком — не доверием, а проверкой.</p>
          <div id="judgeBox" class="judge"></div>
          <button class="btn ghost" id="judgeRun" style="width:100%;margin-top:10px">Проверить спорный артефакт состязательно</button>
          <div class="esc" id="escBox"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>📜 Конституция компании <span class="tag">единственное, что не автоматизируется</span></h2>
      <p class="core-sub">Ценности и красные линии, которым подчиняется каждый из цифровых сотрудников. Их пишет и меняет только человек.</p>
      <div class="two-col" style="align-items:start">
        <div>
          <div id="constList"></div>
          <div class="od-gov" style="margin-top:11px">Изменение принципа мгновенно распространяется на всех цифровых сотрудников компании — сверху вниз по дереву.</div>
        </div>
        <div>
          <div class="core-sub" style="margin-top:0">Проверьте запрос против конституции:</div>
          <div class="chips" id="constTests">${CONSTITUTION_TESTS.map((t,i)=>`<button class="chip" data-i="${i}">${t.req}</button>`).join('')}</div>
          <div id="constVerdict" class="cv"><div class="od-empty">Выберите запрос — увидите вердикт и какое правило сработало.</div></div>
        </div>
      </div>
    </div>`;

  // метрики
  const drawMetrics = () => { $('#coreMetrics', root).innerHTML = `
    <div class="cm-row"><span>Качество (эвал-скор)</span><b>${m.quality}%</b><i class="up">${m.iter?'▲':''}</i></div>
    <div class="cm-row"><span>Стоимость задачи</span><b>₽${m.cost}</b><i class="up">${m.iter?'▼':''}</i></div>
    <div class="cm-row"><span>Решений автономно (низкий риск)</span><b>${m.autoAccept}%</b><i class="up">${m.iter?'▲':''}</i></div>
    <div class="cm-row"><span>Умений в библиотеке</span><b>${m.skills}</b><i class="up">${m.iter?'▲':''}</i></div>`; };
  drawMetrics();

  // эскалация
  $('#escBox', root).innerHTML = `<div class="esc-h">Эскалация по риску — что решается без человека, а что нет:</div>` +
    ESCALATION.map(e=>`<div class="esc-row"><span class="esc-r esc-${e.color}">${e.risk}</span><span class="esc-arrow">→</span><b>${e.who}</b></div>`).join('');

  // конституция — список
  const drawConst = () => { $('#constList', root).innerHTML = CONSTITUTION.map((c,i)=>`
    <div class="const-row ${c.on?'on':'off'}" data-i="${i}">
      <span class="const-tog">${c.on?'●':'○'}</span><span>${c.text}</span></div>`).join('');
    $$('#constList .const-row', root).forEach(rw=>rw.onclick=()=>{ const i=+rw.dataset.i; CONSTITUTION[i].on=!CONSTITUTION[i].on; drawConst();
      toast(`Принцип обновлён — распространён на 120 000 цифровых сотрудников компании`); }); };
  drawConst();

  // петля
  $('#loopRun', root).onclick = () => {
    if (running) return; running = true;
    const sts = $$('.loop-st', root); sts.forEach(s=>s.classList.remove('lit'));
    $('#loopRun',root).disabled = true; $('#loopRun',root).textContent='♾️ итерация идёт…';
    let i=0;
    const tick = () => {
      if (i>0) sts[i-1].classList.remove('active');
      if (i>=sts.length){
        // метрики растут
        m.iter++; m.quality=Math.min(99,m.quality+2); m.cost=Math.max(18,Math.round(m.cost*0.94));
        m.autoAccept=Math.min(94,m.autoAccept+4); m.skills+=Math.floor(5+Math.random()*4);
        $('#loopIter',root).textContent='итераций: '+m.iter; drawMetrics();
        $('#loopRun',root).disabled=false; $('#loopRun',root).textContent='▶ Запустить ещё итерацию';
        running=false; return;
      }
      sts[i].classList.add('lit','active'); i++; setTimeout(tick, 460);
    };
    tick();
  };

  // состязательная верификация
  $('#judgeRun', root).onclick = () => {
    const box = $('#judgeBox', root);
    box.innerHTML = JUDGE_LENSES.map(l=>`<div class="jr" data-l="${l.lens}"><span class="jr-l">${l.lens}</span>
      <small>${l.q}</small><span class="jr-v"><span class="spin"></span></span></div>`).join('');
    JUDGE_LENSES.forEach((l,idx)=>setTimeout(()=>{
      const verdict = idx===1 ? 'refute' : 'support';   // безопасность опровергла → артефакт не проходит
      const cell = $$('.jr .jr-v', box)[idx];
      cell.innerHTML = verdict==='support' ? '<b class="ok">подтвердил</b>' : '<b class="no">опроверг</b>';
    }, 700*(idx+1)));
    setTimeout(()=>{ box.insertAdjacentHTML('beforeend',
      `<div class="jr-final no fade-in">⛔ 1 из 3 опроверг (безопасность) → артефакт <b>не принят</b>, ушёл на доработку. Контроль сработал без чтения кода человеком.</div>`); }, 700*4);
  };

  // тест конституции
  $$('#constTests .chip', root).forEach(b=>b.onclick=()=>{
    const t = CONSTITUTION_TESTS[+b.dataset.i];
    const V = { allow:{t:'РАЗРЕШЕНО',cls:'v-allow'}, approve:{t:'ТРЕБУЕТ АПРУВА ЧЕЛОВЕКА',cls:'v-appr'}, refuse:{t:'⛔ ОТКЛОНЕНО КОНСТИТУЦИЕЙ',cls:'v-ref'} }[t.verdict];
    $('#constVerdict', root).innerHTML = `<div class="cv-card ${V.cls} fade-in">
      <div class="cv-req">«${t.req}»</div>
      <div class="cv-vd">${V.t}</div>
      ${t.rule!=='—'?`<div class="cv-rule">сработало правило: <b>${t.rule}</b></div>`:'<div class="cv-rule">в рамках разрешённого · записано в аудит</div>'}</div>`;
    $$('#constTests .chip',root).forEach(x=>x.classList.toggle('sel',x===b));
  });
}

/* ========================================================================== */
/*  ПУТЬ — роадмеп зрелости: от ручной работы к саморазработке                */
/* ========================================================================== */
const MOD_S = { ship:{t:'есть',cls:'m-ship'}, part:{t:'частично',cls:'m-part'}, soon:{t:'роадмеп',cls:'m-soon'}, base:{t:'до Среды',cls:'m-base'} };
function renderRoadmap(root){
  const hereN = ROADMAP.find(s=>s.here)?.n || 3;
  root.innerHTML = `
    <div class="rm">
      <div class="rm-hero">
        <div class="rm-kick">Роадмеп зрелости</div>
        <h1>От ручной работы — к саморазработке</h1>
        <p class="rm-thesis">${ROADMAP_THESIS}</p>
        <div class="rm-hands">
          <span class="rm-hands-l">В руках человека:</span>
          <b id="rmHandsWord">${ROADMAP[hereN-1].hands}</b>
          <span class="rm-hands-track">${ROADMAP.map(s=>`<i data-n="${s.n}" class="${s.n<=hereN?'on':''}">${s.hands}</i>`).join('<u>→</u>')}</span>
          <button class="btn go" id="rmPlay" style="margin-left:auto">▶ Проиграть путь</button>
        </div>
      </div>

      <div class="rm-track" id="rmTrack">
        ${ROADMAP.map(s=>`
          <div class="rm-stage ${s.n<hereN?'past':''} ${s.n===hereN?'now':''} ${s.n>hereN?'future':''}" data-n="${s.n}">
            <div class="rm-spine"><span class="rm-dot">${s.n<hereN?'✓':s.n}</span></div>
            <div class="rm-card">
              <div class="rm-card-h">
                <span class="rm-season">${s.season}</span>
                <h2>${s.name}</h2>
                ${s.here?'<span class="rm-here">● вы здесь</span>':''}
                ${s.n>hereN?'<span class="rm-soon-tag">впереди</span>':''}
              </div>
              <p class="rm-tag">${s.tagline}</p>
              <p class="rm-state">${s.state}</p>
              <div class="rm-foot">
                <div class="rm-role"><span>Роль человека</span><b>${s.role}</b></div>
                <div class="rm-bn"><span>Узкое место</span><b>${s.bottleneck}</b></div>
              </div>
              <div class="rm-mods">${s.modules.map(m=>`<span class="rm-mod ${MOD_S[m.s].cls}">${m.s==='ship'?'✓':m.s==='part'?'◔':m.s==='base'?'·':'○'} ${m.t}<small>${MOD_S[m.s].t}</small></span>`).join('')}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="rm-cta">
        <b>Среда сейчас — это Сезон 3.</b> Мы строим ступени 4–5, пока рынок продаёт автодополнение.
        Компания получает не инструмент, а <b>вход на лестницу</b>, по которой растёт вся организация.
      </div>
    </div>`;

  // подсветка слова «в руках человека» при наведении на стадию
  $$('.rm-stage', root).forEach(st=>{
    st.onmouseenter = () => { const n=+st.dataset.n; $('#rmHandsWord',root).textContent = ROADMAP[n-1].hands;
      $$('.rm-hands-track i',root).forEach(i=>i.classList.toggle('on', +i.dataset.n<=n)); };
  });

  // режим «проиграть путь»
  $('#rmPlay', root).onclick = () => {
    const stages = $$('.rm-stage', root); let i=0;
    $('#rmPlay',root).textContent='▶ играем…'; $('#rmPlay',root).disabled=true;
    stages.forEach(s=>s.classList.remove('lit'));
    const tick = () => {
      if (i>=stages.length){ $('#rmPlay',root).textContent='▶ Проиграть путь'; $('#rmPlay',root).disabled=false; return; }
      const s=stages[i]; s.classList.add('lit'); s.scrollIntoView({behavior:'smooth',block:'center'});
      const n=+s.dataset.n; $('#rmHandsWord',root).textContent=ROADMAP[n-1].hands;
      $$('.rm-hands-track i',root).forEach(x=>x.classList.toggle('on', +x.dataset.n<=n));
      i++; setTimeout(tick, 1400);
    };
    tick();
  };
}

/* ========================================================================== */
/*  ПРОЕКТ — контроль результата и сборка артефактов в единый продукт         */
/* ========================================================================== */
const ST = {
  done:    { label:'готово',            cls:'st-done',  icon:'✓' },
  review:  { label:'на ревью человека', cls:'st-review',icon:'⏸' },
  running: { label:'в работе',          cls:'st-run',   icon:'•' },
  changes: { label:'на доработке',      cls:'st-chg',   icon:'↻' },
  blocked: { label:'ждёт зависимостей', cls:'st-block', icon:'…' },
};
function renderProject(root){
  const steps = PROJECT.steps.map(s => ({ ...s }));   // рабочая копия
  const byId = id => steps.find(s => s.id === id);
  const depsDone = s => s.deps.every(d => byId(d) && byId(d).status === 'done');

  const projectState = () => {
    const core = steps.filter(s => s.id !== 's9');
    if (core.every(s => s.status === 'done')) return byId('s9').status==='done' ? 'Принято' : 'Готов к сборке';
    if (core.some(s => s.status === 'review')) return 'На ревью';
    return 'В работе';
  };

  const draw = () => {
    const total = steps.length, done = steps.filter(s=>s.status==='done').length;
    const cost = steps.filter(s=>s.status==='done').reduce((a,s)=> a + (MODELS[s.model]?MODELS[s.model].cost*2.3*6:0), 0);
    const stateName = projectState();

    root.innerHTML = `
      <div class="work-head">
        <div class="ico">📁</div>
        <div style="flex:1">
          <h1>${PROJECT.title}</h1>
          <p>Владелец: ${PROJECT.owner} · дедлайн ${PROJECT.deadline} · единый проект из работы роя</p>
        </div>
        <span class="badge"><span class="dot"></span>${done}/${total} шагов</span>
      </div>

      <div class="pj-state">
        ${['Черновик','В работе','На ревью','Готов к сборке','Принято'].map(s=>`
          <div class="pjs ${s===stateName?'on':''} ${['Черновик','В работе','На ревью','Готов к сборке','Принято'].indexOf(s) < ['Черновик','В работе','На ревью','Готов к сборке','Принято'].indexOf(stateName)?'past':''}">${s}</div>`).join('<span class="pjs-sep">›</span>')}
        <span class="pj-cost">потрачено: <b>₽${Math.round(cost).toLocaleString('ru')}</b> · аудит вкл</span>
      </div>

      <div class="two-col" style="align-items:start">
        <div class="panel">
          <h2>🧬 План проекта <span class="tag">граф шагов · артефакты · зависимости</span></h2>
          <div id="pjSteps"></div>
        </div>
        <div>
          <div class="panel">
            <h2>✅ Контроль качества</h2>
            <div class="qc">
              <div class="qc-row"><span>Автогейты пройдены</span><b>${steps.filter(s=>s.gate.length&&s.gate.every(g=>g[1])).length}/${steps.filter(s=>s.gate.length).length}</b></div>
              <div class="qc-row"><span>Ждут решения человека</span><b style="color:var(--amber)">${steps.filter(s=>s.status==='review').length}</b></div>
              <div class="qc-row"><span>В работе у цифровых сотрудников</span><b>${steps.filter(s=>s.status==='running'||s.status==='changes').length}</b></div>
            </div>
            <div class="od-gov">Ни один артефакт не уходит дальше без прохождения definition-of-done и (где требуется) апрува человека.</div>
          </div>
          <div class="panel">
            <h2>📦 Готовый продукт <span class="tag">сборка артефактов</span></h2>
            <div id="pjDeliver"></div>
          </div>
        </div>
      </div>`;

    // шаги
    const box = $('#pjSteps', root);
    steps.forEach(s => {
      let status = s.status;
      if (status==='blocked' && depsDone(s)) status = 'ready';
      const st = ST[s.status] || ST.blocked;
      const card = el(`<div class="pj-step ${st.cls}">
        <div class="pj-ico">${AGENTS[s.agent]?AGENTS[s.agent].emoji:'◆'}</div>
        <div class="pj-body">
          <div class="pj-h"><b>${s.title}</b><span class="pj-st ${st.cls}">${st.icon} ${st.label}</span></div>
          <div class="pj-meta">
            <span class="pj-dept">${s.dept}</span>
            <span class="mb ${MODELS[s.model]?MODELS[s.model].cls:'m-bal'}"><i></i>${MODELS[s.model]?MODELS[s.model].name:'—'}</span>
            ${s.skill!=='—'?`<span class="pj-skill">умение: ${s.skill}</span>`:''}
            ${s.deps.length?`<span class="pj-dep">← ${s.deps.join(', ')}</span>`:''}
          </div>
          <div class="pj-art">📄 <b>${s.artifact}</b> ${s.conf?`<span class="pj-conf">уверенность ${s.conf}%</span>`:''}
            <span class="pj-src">источники: ${s.sources}</span></div>
          ${s.gate.length?`<div class="pj-gate">${s.gate.map(g=>`<span class="${g[1]?'g-ok':'g-warn'}">${g[1]?'✓':'⚠'} ${g[0]}</span>`).join('')}</div>`:''}
          ${s.status==='review'?`<div class="pj-actions">
            <button class="btn go pj-accept" data-id="${s.id}">Принять</button>
            <button class="btn ghost pj-return" data-id="${s.id}">Вернуть на доработку</button>
            <span class="pj-human">⚑ требует вашего решения</span></div>`:''}
        </div></div>`);
      box.appendChild(card);
    });

    // сборка / деливери
    const dl = $('#pjDeliver', root);
    const ready = steps.filter(s=>s.id!=='s9').every(s=>s.status==='done');
    const assembled = byId('s9').status==='done';
    dl.innerHTML = steps.filter(s=>s.id!=='s9'&&s.status==='done').map(s=>
      `<div class="dl-item">📄 ${s.artifact}<span class="ok">✓</span></div>`).join('')
      || `<div class="od-empty">Артефакты появятся здесь по мере готовности шагов.</div>`;
    const btn = el(`<button class="btn go" id="pjAssemble" ${ready&&!assembled?'':'disabled style="opacity:.5"'} style="width:100%;margin-top:12px;padding:11px">
      ${assembled?'✓ Проект собран и принят':ready?'🧩 Собрать проект в единый продукт':'Сборка доступна, когда все шаги готовы'}</button>`);
    dl.appendChild(btn);
    if (ready && !assembled) btn.onclick = () => { byId('s9').status='done'; toast('Проект собран в единый продукт «Среда Lite» — принят'); draw(); };

    // обработчики ревью
    $$('.pj-accept', root).forEach(b=>b.onclick=()=>{ byId(b.dataset.id).status='done'; toast(`Шаг принят: ${byId(b.dataset.id).title}`); draw(); });
    $$('.pj-return', root).forEach(b=>b.onclick=()=>{ const s=byId(b.dataset.id); s.status='changes'; draw();
      toast('Возвращено цифровому сотруднику на доработку…'); setTimeout(()=>{ s.status='review'; s.conf=Math.min(99,(s.conf||85)+4); s.gate=s.gate.map(g=>[g[0],1]); draw(); }, 1500); });
  };
  draw();
}

/* ========================================================================== */
/*  СТУДИЯ — создание цифровых сотрудников и написание умений                              */
/* ========================================================================== */
function renderStudio(root, d){
  const st = { tab:'agent' };
  root.innerHTML = workHead(d, 'Конструктор: создавайте цифровых сотрудников и превращайте успешные прогоны в переиспользуемые умения') + `
    <div class="mk-tabs" id="stTabs" style="margin-bottom:18px">
      <button data-t="agent" class="on">🤖 Создать цифрового сотрудника</button>
      <button data-t="skill">🧠 Написать умение</button>
    </div>
    <div id="stBody"></div>`;
  const drawBody = () => { st.tab==='agent' ? renderWorkerBuilder($('#stBody',root)) : renderУмениеBuilder($('#stBody',root)); };
  $$('#stTabs button', root).forEach(b=>b.onclick=()=>{ st.tab=b.dataset.t;
    $$('#stTabs button',root).forEach(x=>x.classList.toggle('on',x===b)); drawBody(); });
  drawBody();
}

function renderWorkerBuilder(root){
  const sel = { skills:new Set(['Ресёрч рынка']), tools:new Set(['crm']), guards:new Set(['Апрув человека на публикацию']), policy:'auto', emoji:'🤖', name:'Аналитик спроса', role:'Аналитика' };
  root.innerHTML = `
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>⚙️ Конфигурация цифрового сотрудника</h2>
        <label class="fld"><span>Имя</span><input id="agName" value="${sel.name}"/></label>
        <label class="fld"><span>Роль / отдел</span><input id="agRole" value="${sel.role}"/></label>
        <label class="fld"><span>Инструкции (как работает)</span>
          <textarea id="agInstr" placeholder="Ты — аналитик спроса. Собираешь данные только из разрешённых витрин, формулируешь гипотезы, ничего не выдумываешь…"></textarea></label>

        <div class="fld"><span>Умения из библиотеки</span>
          <div class="chips" id="agSkills">${BUILD_SKILLS.map(s=>`<button class="chip ${sel.skills.has(s)?'sel':''}" data-s="${s}">${s}</button>`).join('')}</div></div>

        <div class="fld"><span>Инструменты и доступы</span>
          <div class="tool-grid" id="agTools">${BUILD_TOOLS.map(t=>`<button class="tool ${sel.tools.has(t.id)?'on':''}" data-t="${t.id}"><span>${t.emoji} ${t.name}</span><small>${t.scope}</small></button>`).join('')}</div></div>

        <div class="fld"><span>Политика модели</span>
          <div id="agPolicy">${BUILD_POLICY.map(p=>`<label class="radio ${sel.policy===p.id?'on':''}" data-p="${p.id}"><b>${p.label}</b><small>${p.note}</small></label>`).join('')}</div></div>

        <div class="fld"><span>Guardrails</span>
          <div class="chips" id="agGuards">${BUILD_GUARDS.map(g=>`<button class="chip ${sel.guards.has(g)?'sel':''}" data-g="${g}">${g}</button>`).join('')}</div></div>
      </div>

      <div>
        <div class="panel">
          <h2>👁 Предпросмотр</h2>
          <div class="prev-card" id="agPrev"></div>
        </div>
        <div class="panel">
          <h2>🧪 Песочница</h2>
          <div id="agSandbox" class="sandbox"><div class="od-empty">Протестируйте цифрового сотрудника на пробной задаче перед публикацией.</div></div>
          <div style="display:flex;gap:9px;margin-top:12px">
            <button class="btn ghost" id="agTest" style="flex:1">Тест в песочнице</button>
            <button class="btn go" id="agPublish" style="flex:1">Опубликовать в отдел</button>
          </div>
        </div>
      </div>
    </div>`;

  const prev = () => { $('#agPrev', root).innerHTML = `
    <div class="prev-top"><span class="prev-emoji">${sel.emoji}</span><div><b>${$('#agName',root).value||'Без имени'}</b><small>${$('#agRole',root).value||'роль'}</small></div></div>
    <div class="prev-row"><span>Умений</span><b>${sel.skills.size}</b></div>
    <div class="prev-row"><span>Инструментов</span><b>${sel.tools.size}</b></div>
    <div class="prev-row"><span>Модель</span><b>${BUILD_POLICY.find(p=>p.id===sel.policy).label}</b></div>
    <div class="prev-row"><span>Guardrails</span><b>${sel.guards.size}</b></div>`; };
  prev();
  $('#agName',root).oninput = prev; $('#agRole',root).oninput = prev;
  $$('#agSkills .chip',root).forEach(b=>b.onclick=()=>{ b.classList.toggle('sel'); sel.skills.has(b.dataset.s)?sel.skills.delete(b.dataset.s):sel.skills.add(b.dataset.s); prev(); });
  $$('#agTools .tool',root).forEach(b=>b.onclick=()=>{ b.classList.toggle('on'); sel.tools.has(b.dataset.t)?sel.tools.delete(b.dataset.t):sel.tools.add(b.dataset.t); prev(); });
  $$('#agGuards .chip',root).forEach(b=>b.onclick=()=>{ b.classList.toggle('sel'); sel.guards.has(b.dataset.g)?sel.guards.delete(b.dataset.g):sel.guards.add(b.dataset.g); prev(); });
  $$('#agPolicy .radio',root).forEach(b=>b.onclick=()=>{ sel.policy=b.dataset.p; $$('#agPolicy .radio',root).forEach(x=>x.classList.toggle('on',x===b)); prev(); });

  $('#agTest',root).onclick = () => { const box=$('#agSandbox',root);
    box.innerHTML = `<div class="sb-line"><b>задача:</b> «оцени спрос на суб-бренд»</div>`;
    const lines = ['◆ оркестратор: маршрут на '+(sel.policy==='local'?'Llama (локально)':'Sonnet'),
      '📊 собрал данные из '+([...sel.tools].length?[...sel.tools][0].toUpperCase():'CRM'),
      '✓ гипотез: 3 · источники проверены · ₽7',
      '⚑ публикация заблокирована до апрува (guardrail активен)'];
    lines.forEach((l,i)=>setTimeout(()=>{ const n=el(`<div class="sb-line fade-in">${l}</div>`); box.appendChild(n); box.scrollTop=box.scrollHeight; }, 400*(i+1))); };
  $('#agPublish',root).onclick = () => toast(`Цифровой сотрудник «${$('#agName',root).value}» опубликован в отдел «${$('#agRole',root).value}» (v1)`);
}

function renderУмениеBuilder(root){
  const sk = { mode:'run', saved:false };
  const draw = () => {
    root.innerHTML = `
      <div class="mk-tabs" id="skMode" style="margin-bottom:16px">
        <button data-m="run" class="${sk.mode==='run'?'on':''}">⚡ Из успешного прогона</button>
        <button data-m="scratch" class="${sk.mode==='scratch'?'on':''}">📝 С нуля</button>
      </div>
      <div class="two-col" style="align-items:start">
        <div class="panel" id="skLeft"></div>
        <div class="panel"><h2>👁 Карточка умения</h2><div id="skPrev" class="prev-card"></div></div>
      </div>`;
    $$('#skMode button',root).forEach(b=>b.onclick=()=>{ sk.mode=b.dataset.m; sk.saved=false; draw(); });
    sk.mode==='run' ? drawRun() : drawScratch();
  };

  const drawRun = () => {
    const L = $('#skLeft', root);
    L.innerHTML = `<h2>⚡ Превратить прогон в умение <span class="tag">${SKILL_FROM_RUN.run}</span></h2>
      <div class="run-steps">${SKILL_FROM_RUN.steps.map(s=>`<div class="rs"><span>${AGENTS[s.agent].emoji}</span>${s.text}</div>`).join('')}</div>
      <button class="btn go" id="skSave" style="width:100%;margin-top:12px">Сохранить прогон как умение →</button>
      <div id="skForm" style="display:none;margin-top:14px">
        <div class="od-gov" style="margin-bottom:12px">Среда автоматически вычленила <b>переменные части</b> прогона — это входы умения. Остальное зафиксировано как шаги.</div>
        <div class="fld"><span>Параметры (входы), найдены автоматически</span>
          <div id="skParams">${SKILL_FROM_RUN.params.map(p=>`<div class="param"><code>{${p.name}}</code><span>напр.: ${p.example}</span></div>`).join('')}</div></div>
        <label class="fld"><span>Имя умения</span><input id="skName" value="Запуск кампании по продукту"/></label>
        <label class="fld"><span>Когда вызывать (триггеры)</span><input id="skTrig" value="«собери кампанию к запуску», «запусти продукт …»"/></label>
        <label class="fld"><span>Definition of done</span><textarea id="skDod">Все тексты — голосом бренда; пройден 38-ФЗ; готовы лендинг + письма + посты + клипы.</textarea></label>
        <button class="btn go" id="skPublish" style="width:100%">Опубликовать умение в библиотеку</button>
      </div>`;
    drawPrev();
    $('#skSave',root).onclick = () => { $('#skForm',root).style.display='block'; $('#skSave',root).style.display='none'; sk.saved=true; drawPrev(); };
    bindPublish();
  };

  const drawScratch = () => {
    const L = $('#skLeft', root);
    L.innerHTML = `<h2>📝 Новое умение с нуля</h2>
      <label class="fld"><span>Имя</span><input id="skName" value="Квартальный отчёт по отделу"/></label>
      <label class="fld"><span>Описание / когда вызывать</span><input id="skTrig" value="«собери квартальный отчёт по …»"/></label>
      <label class="fld"><span>Входы</span><input id="skIn" value="{отдел}, {квартал}, {формат}"/></label>
      <label class="fld"><span>Шаги (что делает)</span><textarea id="skSteps">1) собрать метрики из витрин отдела; 2) сравнить с планом; 3) выводы и риски; 4) оформить в {формат}.</textarea></label>
      <label class="fld"><span>Definition of done</span><textarea id="skDod">Все цифры из проверенных источников; есть сравнение план/факт; ≤2 страниц.</textarea></label>
      <button class="btn go" id="skPublish" style="width:100%">Опубликовать умение в библиотеку</button>`;
    drawPrev(); bindPublish();
  };

  const drawPrev = () => { const p=$('#skPrev',root); if(!p) return;
    const name = $('#skName',root)?.value || 'Новый skill';
    p.innerHTML = `<div class="prev-top"><span class="prev-emoji">🧠</span><div><b>${name}</b><small>skill · by Среда · v1</small></div></div>
      <div class="prev-row"><span>Тип</span><b>${sk.mode==='run'?'из прогона':'с нуля'}</b></div>
      <div class="prev-row"><span>Переиспользуем</span><b style="color:var(--acc)">всей компанией</b></div>
      <div class="prev-row"><span>Композируется</span><b>да</b></div>
      <div class="od-gov" style="margin-top:11px">Опубликованный skill доступен всем 20 000 сотрудников и считается в общую библиотеку.</div>`;
    const ni=$('#skName',root); if(ni) ni.oninput=drawPrev; };

  const bindPublish = () => { const b=$('#skPublish',root); if(b) b.onclick=()=>toast(`Умение «${$('#skName',root).value}» опубликован в библиотеку (доступен всем отделам)`); };

  draw();
}

/* ========================================================================== */
/*  ДВИЖОК ОРКЕСТРАЦИИ — единый для всех «лиц»                                */
/*  hooks: onStart(step,model) при запуске шага, onDone(step) при завершении   */
/* ========================================================================== */
/* ========================================================================== */
/*  ГЛОБАЛЬНАЯ ПОСТАНОВКА ЗАДАЧИ (модалка)                                     */
/* ========================================================================== */
function setNavLock(lock){
  $$('.nav-item').forEach(n => n.style.pointerEvents = lock ? 'none' : '');
  $('#cmdBtn').style.pointerEvents = lock ? 'none' : '';
}
function initModal(){
  const ov = $('#overlay');
  const modal = ov.querySelector('.modal');
  let lastFocus = null;
  const focusables = () => [...modal.querySelectorAll('button,[href],textarea,input,select,[tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  function onTrap(e){
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function openModal(){ if (state.running) return; lastFocus = document.activeElement; ov.classList.add('show');
    modal.addEventListener('keydown', onTrap); $('#taskText').focus(); }
  function closeModal(){ ov.classList.remove('show'); modal.removeEventListener('keydown', onTrap);
    if (lastFocus && lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} } }
  ov._open = openModal; ov._close = closeModal;   // для глобальных ⌘K / Escape
  $('#cmdBtn').onclick = openModal;
  $('#mClose').onclick = closeModal;
  ov.onclick = e => { if (e.target === ov) closeModal(); };

  const examples = [
    {t:'campaign', label:'📣 Кампания к запуску'},
    {t:'bugfix',   label:'⌨️ Починить оплату'},
    {t:'burnout',  label:'🧭 Выгорание в команде'},
    {t:'leads',    label:'📈 Поднять спящие сделки'},
  ];
  const ex = $('#mEx');
  examples.forEach(e => {
    const c = el(`<button class="chip">${e.label}</button>`);
    c.onclick = () => $('#taskText').value = TASKS[e.t].request;
    ex.appendChild(c);
  });

  $('#mGo').onclick = () => {
    const v = $('#taskText').value.trim();
    if (!v){ toast('Опишите задачу своими словами'); $('#taskText').focus(); return; }
    closeModal(); $('#taskText').value='';
    if (rpgPhraseCheck(v)) return;
    /* маршрутизация по ключевым словам → ассистент нужной роли */
    let role = 'marketing';
    if (/оплат|баг|код|деплой|3ds|чекаут|api|тест/i.test(v))      role = 'dev';
    else if (/выгор|наним|наём|найм|ваканси|онбординг|текуч/i.test(v)) role = 'hr';
    else if (/сделк|лид|воронк|кп\b|прода/i.test(v))               role = 'sales';
    else if (/выручк|данны|метрик|воронк|почему|отчёт/i.test(v))   role = 'analytics';
    else if (/договор|nda|пдн|38-фз|юрид/i.test(v))                role = 'legal';
    else if (/бюджет|кэш|счёт|инвойс|p&l|финанс/i.test(v))         role = 'finance';
    else if (/макет|дизайн|лого|иконк|ui|ux/i.test(v))             role = 'design';
    window.__PENDING_ASK = { role, text: v };
    pushAudit({ who:'Оркестратор', what:`Глобальная задача → ассистент «${roleLabel(role)}»: ${v}`, verdict:'allow' });
    toast(`Среда разобрала задачу → кабинет «${roleLabel(role)}»`);
    navTo('asst:' + role);
  };
}

/* ========================================================================== */
/*  СТАРТ                                                                      */
/* ========================================================================== */

/* ========================================================================== */
/*  ФИЛИАЛЫ — мульти-филиальность холдинга                                     */
/* ========================================================================== */
function renderFilials(root){
  const d = { icon:'🏭', label:'Филиалы' };
  const totalP = FILIALS.reduce((s,f)=>s+f.people,0);
  const totalA = FILIALS.reduce((s,f)=>s+f.agents,0);
  function draw(){
    root.innerHTML = workHead(d, `Мульти-филиальность · ${FILIALS.length} локаций · ${totalP} человек · ${totalA} цифровых сотрудников`) + `
    <div class="grid-kpi" style="margin-bottom:14px">
      <div class="kpi"><div class="l">Локаций</div><div class="v">${FILIALS.length}</div><div class="d flat">● ${FILIALS.filter(f=>f.status==='active').length} активны</div></div>
      <div class="kpi"><div class="l">Сотрудников</div><div class="v">${totalP}</div><div class="d up">▲ по всем филиалам</div></div>
      <div class="kpi"><div class="l">Цифровой сотрудников</div><div class="v">${totalA}</div><div class="d up">▲ цифровой штат</div></div>
      <div class="kpi"><div class="l">Текущий</div><div class="v">${FILIALS.find(f=>f.id===CURRENT_FILIAL)?.city||'—'}</div><div class="d flat">● ${FILIALS.find(f=>f.id===CURRENT_FILIAL)?.name||''}</div></div>
    </div>
    <div class="ww-table-wrap">
      <table class="ww-table">
        <thead><tr><th>ID</th><th>Название</th><th>Город</th><th>Адрес</th><th>Людей</th><th>Цифровой сотрудников</th><th>Руководитель</th><th>Статус</th></tr></thead>
        <tbody>${FILIALS.map(f=>`<tr class="ww-row ${f.status}">
          <td class="ww-id">${f.id}</td>
          <td class="ww-name"><b>${f.name}</b></td>
          <td class="ww-dept">${f.city}</td>
          <td class="ww-dept">${f.address}</td>
          <td class="ww-num">${f.people}</td>
          <td class="ww-num">${f.agents}</td>
          <td class="ww-dept">${f.head}</td>
          <td class="ww-st"><span class="ww-stat ${f.status}">${f.status==='active'?'Активен':'Обслуживание'}</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="od-gov" style="margin-top:13px">Переключатель филиала в топбаре меняет данные, команду и цифровых сотрудников. Каждый филиал — изолированный периметр со сводкой наверху.</div>`;
  }
  draw();
}

/* ========================================================================== */
/*  BATTLE — обновление: позиционирование vs конкурентов                      */
/* ========================================================================== */

/* ========================================================================== */
/*  ТУР — сквозная история одной сделки «Гамма» через всю компанию        */
/* ========================================================================== */
const TOUR = [
  { screen:'pulse', title:'СРЕДА · Пульс компании', text:'Живое сердце компании: в центре — Среда, вокруг — 8 отделов. Каждая частица — реальная задача в работе.', sel:'.pls-core' },
  { screen:'company', title:'Компания на ИИ', text:'Одна Среда = одна компания. В штате 314: 150 людей и 164 цифровых сотрудника — у людей рои под должность, у цифровых должностные инструкции и руководители-люди. Проследим сделку «Гамма» насквозь.' },
  { screen:'asst:sales', title:'1 · Личный чат', text:'Оля из продаж просит ассистента словами: «собери КП для Гаммы». ИИ отвечает черновиком — как в нашем с вами чате.', sel:'.asst-chat' },
  { screen:'sales', title:'2 · Артефакт + контроль', text:'ИИ собрал КП, Оля правит скидку руками. Гейт не пускает дальше с превышением политики — ИИ даёт черновик, человек контролирует.', sel:'.chatx-art' },
  { screen:'flow:sales', title:'3 · Передача работы', text:'Готовый КП уходит юристу: выход одного человека = вход другого. Это связная ткань, а не 150 разрозненных чатов.', sel:'.flow-lane' },
  { screen:'legal', title:'4 · Юрист · контракт-ревью', text:'Рой нашёл критичный риск (неограниченная ответственность). Подпись заблокирована, пока юрист не снимет sev1. Никакой «волшебной кнопки».', sel:'.doc-risk' },
  { screen:'finance', title:'5 · Финансы · модель', text:'Финансы считают сделку в FP&A-модели со сценариями и утверждают платёж. Каждый видит данные строго по своей роли и уровню.', sel:'.fin-grid' },
  { screen:'audit', title:'6 · Аудит', text:'Каждая передача и решение записаны. Ничего не теряется в личных переписках — полная прослеживаемость для компании.', sel:'.audit-log' },
  { screen:'flowx', title:'7 · Взгляд CEO', text:'Руководитель не управляет задачами — он видит, как работа течёт между отделами и где затык. 150 чатов работают как одна компания.', sel:'.fx-list' },
  { screen:'workers', title:'8 · Цифровой штат', text:'52% штата — цифровые сотрудники: в командах отделов, с должностными инструкциями, KPI и руководителями-людьми. Личный чат — атом, связывают его библиотека · данные с правами · передачи · governance. Это и есть Среда. Больше, чем результат.', sel:'.table-wrap' },
];
function injectTour(){
  if (document.querySelector('#tourFab')) return;
  const fab = el(`<button id="tourFab">🎬 Тур по продукту</button>`);
  fab.onclick = ()=>tourGo(0);
  document.body.appendChild(fab);
}
function tourGo(i){
  if (i<0) i=0;
  if (i>=TOUR.length){ endTour(); return; }
  window.__tourI = i; const s = TOUR[i];
  navTo(s.screen);
  setTimeout(()=>{ drawTourCap(i); tourSpot(s.sel); }, 160);
}
function tourSpot(sel){
  document.querySelectorAll('.tour-spot').forEach(e=>e.classList.remove('tour-spot'));
  if (!sel) return; const t = document.querySelector(sel);
  if (t){ t.classList.add('tour-spot'); t.scrollIntoView({block:'nearest'}); }
}
function drawTourCap(i){
  const s = TOUR[i]; let cap = document.querySelector('#tourCap');
  if (!cap){ cap = el(`<div id="tourCap"></div>`); document.body.appendChild(cap); }
  cap.innerHTML = `<div class="tc-step">${i+1} / ${TOUR.length}</div>
    <div class="tc-title">${s.title}</div><div class="tc-text">${s.text}</div>
    <div class="tc-ctrl"><button class="tc-x">Закрыть</button><div class="tc-nav">
      <button class="tc-prev" ${i===0?'disabled':''}>← Назад</button>
      <button class="tc-next btn go">${i===TOUR.length-1?'Завершить ✓':'Далее →'}</button></div></div>`;
  cap.querySelector('.tc-next').onclick = ()=>tourGo(i+1);
  cap.querySelector('.tc-prev').onclick = ()=>tourGo(i-1);
  cap.querySelector('.tc-x').onclick = endTour;
}
function endTour(){
  const cap=document.querySelector('#tourCap'); if(cap) cap.remove();
  document.querySelectorAll('.tour-spot').forEach(e=>e.classList.remove('tour-spot'));
  window.__tourI = null;
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.querySelector('#tourCap')) endTour(); });

/* ═══════════════════════════════════════════════════════════════
   ФЕДЕРАЦИЯ КАК ОРГСТРУКТУРА — рендереры
   ═══════════════════════════════════════════════════════════════ */

function renderFederation(work){
  work.innerHTML = `<div class="work-head"><div class="ico">🏛️</div><div><h2>Федерация доменов</h2><p>Организационная структура как сеть суверенных доменов</p></div></div>
    <div class="fed-layout">
      <div class="fed-map" id="fedMap"></div>
      <div class="fed-sidebar" id="fedSide"></div>
    </div>`;
  const map = $('#fedMap');
  const side = $('#fedSide');

  // Render domain cards as a "constellation"
  map.innerHTML = `<div class="fed-constellation">
    <div class="fed-center"><div class="fed-hub">🧠<span>CEO · Кирилл</span><small>Федеральный арбитр</small></div></div>
    <div class="fed-orbit" id="fedOrbit"></div>
  </div>`;
  const orbit = $('#fedOrbit');
  DOMAINS.forEach((dom, i) => {
    const diplomats = WORKER_DIPLOMATS.filter(d => d.from === dom.id || d.to === dom.id);
    const contracts = INTER_DOMAIN_CONTRACTS.filter(c => c.from === dom.id || c.to === dom.id);
    const card = el(`<div class="fed-domain" style="--dom-color:${dom.color}">
      <div class="fed-d-head"><span class="fed-d-ic" style="background:${dom.color}20;color:${dom.color}">${dom.icon}</span>
        <div><b>${dom.name}</b><small>${dom.lead} · ${dom.agents} цифровых сотрудников · ${dom.humans} людей</small></div>
      </div>
      <div class="fed-d-stats">
        <div class="fed-d-st"><b>${dom.budget}</b><small>бюджет</small></div>
        <div class="fed-d-st"><b>${contracts.length}</b><small>контрактов</small></div>
        <div class="fed-d-st"><b>${diplomats.length}</b><small>послы</small></div>
      </div>
      <div class="fed-d-sov">${dom.sovereignty.map(s => `<span class="fed-tag">${s}</span>`).join('')}</div>
      <button class="fed-d-btn" data-id="${dom.id}">Конституция и детали →</button>
    </div>`);
    card.querySelector('.fed-d-btn').onclick = () => navTo('domain:' + dom.id);
    orbit.appendChild(card);
  });

  // Sidebar: live federation metrics
  const totalAgents = DOMAINS.reduce((a, d) => a + d.agents, 0);
  const totalHumans = DOMAINS.reduce((a, d) => a + d.humans, 0);
  const totalContracts = INTER_DOMAIN_CONTRACTS.length;
  const activeArb = ARBITRATION_CASES.filter(a => a.status === 'open').length;
  side.innerHTML = `<div class="fed-panel">
    <h3>📊 Метрики федерации</h3>
    <div class="fed-metric"><b>${DOMAINS.length}</b><small>суверенных доменов</small></div>
    <div class="fed-metric"><b>${totalAgents}</b><small>цифровых сотрудников в доменах</small></div>
    <div class="fed-metric"><b>${totalHumans}</b><small>людей в доменах</small></div>
    <div class="fed-metric"><b>${totalContracts}</b><small>междоменных контрактов</small></div>
    <div class="fed-metric"><b>${WORKER_DIPLOMATS.length}</b><small>цифровых сотрудников-послов</small></div>
    <div class="fed-metric"><b>${activeArb}</b><small>открытых арбитражей</small></div>
    <h3 style="margin-top:14px">💱 Кредиты компетенций</h3>
    ${COMPETENCE_CREDITS.map(cc => `<div class="fed-cc"><span class="fed-cc-sym" style="background:${DOMAINS.find(d=>d.id===cc.issuer)?.color||'#999'}20;color:${DOMAINS.find(d=>d.id===cc.issuer)?.color||'#999'}">${cc.symbol}</span>
      <div><b>${cc.circulating.toLocaleString()} / ${cc.supply.toLocaleString()}</b><small>${cc.backedBy}</small></div>
    </div>`).join('')}
    <h3 style="margin-top:14px">🔗 Последние контракты</h3>
    ${INTER_DOMAIN_CONTRACTS.slice(0,3).map(c => {
      const from = DOMAINS.find(d=>d.id===c.from);
      const to = DOMAINS.find(d=>d.id===c.to);
      return `<div class="fed-mini-contract"><span style="color:${from.color}">●</span> ${from.name} → <span style="color:${to.color}">●</span> ${to.name}<small>${c.sla.responseTime} · ${c.penalty.amount} ${c.penalty.currency}</small></div>`;
    }).join('')}
  </div>`;
}

function renderDomain(work, domId){
  const dom = DOMAINS.find(d => d.id === domId); if (!dom) return;
  const constitution = DOMAIN_CONSTITUTIONS[domId];
  const domainAgents = WORKER_WORKFORCE.filter(a => a.dept === domId.replace('dom-',''));
  const diplomats = WORKER_DIPLOMATS.filter(d => d.from === domId || d.to === domId);
  const contracts = INTER_DOMAIN_CONTRACTS.filter(c => c.from === domId || c.to === domId);
  const cc = COMPETENCE_CREDITS.find(c => c.issuer === domId);

  work.innerHTML = `<div class="work-head"><div class="ico" style="background:${dom.color}20;color:${dom.color}">${dom.icon}</div>
    <div><h2>${dom.name}</h2><p>${dom.desc}</p></div></div>
    <div class="dom-tabs" id="domTabs"></div>
    <div class="dom-body" id="domBody"></div>`;

  const tabs = ['Конституция','Цифровые сотрудники','Послы','Контракты','Бюджет','Кредиты'];
  let activeTab = 'Конституция';

  function renderTab(){
    $('#domTabs').innerHTML = tabs.map(t => `<button class="dom-tab ${t===activeTab?'on':''}" data-t="${t}">${t}</button>`).join('');
    $('#domTabs').querySelectorAll('.dom-tab').forEach(b => b.onclick = () => { activeTab = b.dataset.t; renderTab(); });

    const body = $('#domBody');
    if (activeTab === 'Конституция'){
      body.innerHTML = `<div class="dom-const">
        <div class="dom-c-header"><h3>📜 Конституция домена «${dom.name}»</h3><p>${dom.constitution}</p></div>
        ${constitution ? constitution.articles.map(a => `<div class="dom-article"><div class="dom-a-n">Статья ${a.n}</div><b>${a.title}</b><p>${a.text}</p></div>`).join('') : '<p>Конституция в разработке...</p>'}
        <div class="dom-c-sov"><h4>🛡️ Суверенные права</h4>${dom.sovereignty.map(s => `<div class="dom-s-item">✓ ${s}</div>`).join('')}</div>
      </div>`;
    } else if (activeTab === 'Цифровые сотрудники'){
      body.innerHTML = `<div class="dom-agents">
        <div class="dom-a-header"><h3>🤖 Цифровые сотрудники домена · ${domainAgents.length}</h3></div>
        <div class="dom-a-grid">
          ${domainAgents.map(a => `<div class="dom-a-card" data-aid="${a.id}">
            <div class="dom-a-av">${a.avatar}</div>
            <div><b>${a.name}</b><small>${a.version} · ${a.status==='active'?'🟢':'🟡'} ${a.status}</small></div>
            <div class="dom-a-kpi">
              <span><b>${a.kpi.tasksDone}</b> задач</span>
              <span><b>${a.kpi.accuracy}%</b> точность</span>
              <span><b>${a.kpi.quality}</b> качество</span>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
      body.querySelectorAll('.dom-a-card').forEach(c => c.onclick = () => navTo('worker:' + c.dataset.aid));
    } else if (activeTab === 'Послы'){
      body.innerHTML = `<div class="dom-dips">
        <h3>🕊️ Цифровые сотрудники-послы · ${diplomats.length}</h3>
        <p class="dom-d-desc">Послы — делегированные цифровые сотрудники, работающие на границе доменов. У них двойное гражданство: они подчиняются конституции своего домена, но действуют по мандату целевого домена.</p>
        ${diplomats.map(d => {
          const from = DOMAINS.find(x=>x.id===d.from);
          const to = DOMAINS.find(x=>x.id===d.to);
          const agent = WORKER_WORKFORCE.find(a=>a.id===d.agentId);
          return `<div class="dom-d-card" data-did="${d.id}">
            <div class="dom-d-arrow"><span style="color:${from.color}">●</span> ${from.name} <span class="dom-d-arr">→</span> <span style="color:${to.color}">●</span> ${to.name}</div>
            <div class="dom-d-info"><b>${d.name}</b><small>Цифровой сотрудник: ${agent?.name||'—'} · Статус: ${d.status==='active'?'🟢':'🟡'} ${d.status}</small></div>
            <div class="dom-d-mandate"><b>Мандат:</b> ${d.mandate}</div>
            <div class="dom-d-kpi">
              <span><b>${d.kpi.contracts}</b> контрактов</span>
              <span><b>${d.kpi.disputes}</b> споров</span>
              <span><b>${d.kpi.satisfaction}</b> удовлетворённость</span>
            </div>
            <button class="dom-d-btn">Профиль посла →</button>
          </div>`;
        }).join('')}
      </div>`;
      body.querySelectorAll('.dom-d-card').forEach(c => c.querySelector('.dom-d-btn').onclick = () => navTo('diplomat:' + c.dataset.did));
    } else if (activeTab === 'Контракты'){
      body.innerHTML = `<div class="dom-contracts">
        <h3>📜 Междоменные контракты · ${contracts.length}</h3>
        ${contracts.map(c => {
          const from = DOMAINS.find(d=>d.id===c.from);
          const to = DOMAINS.find(d=>d.id===c.to);
          return `<div class="dom-c-row">
            <div class="dom-c-parties"><span style="color:${from.color}">●</span> ${from.name} <span>→</span> <span style="color:${to.color}">●</span> ${to.name}</div>
            <div class="dom-c-name"><b>${c.name}</b><small>Подписан: ${c.signed} · Обновление: ${c.renews}</small></div>
            <div class="dom-c-sla">
              <span>⏱️ ${c.sla.responseTime}</span>
              <span>📊 ${c.sla.qualityThreshold}</span>
              <span>📦 ${c.sla.volume}</span>
            </div>
            <div class="dom-c-penalty">Штраф за нарушение: <b>${c.penalty.amount} ${c.penalty.currency}</b> (${c.penalty.type})</div>
            <div class="dom-c-perf">
              <span>Выполнение: <b>${c.lastMonth.fulfilled}%</b></span>
              <span>Нарушения: <b>${c.lastMonth.breaches}</b></span>
              <span>Переведено: <b>${c.lastMonth.creditsTransferred} CC</b></span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    } else if (activeTab === 'Бюджет'){
      body.innerHTML = `<div class="dom-budget">
        <h3>💰 Бюджет домена</h3>
        <div class="dom-b-main"><b>${dom.budget}</b><small>ежемесячный бюджет</small></div>
        <div class="dom-b-alloc">
          <h4>Распределение (примерное)</h4>
          <div class="dom-b-bar"><div class="dom-b-seg" style="width:45%;background:${dom.color}">Цифровые сотрудники 45%</div><div class="dom-b-seg" style="width:30%;background:${dom.color}aa">Инфра 30%</div><div class="dom-b-seg" style="width:15%;background:${dom.color}77">Эксперименты 15%</div><div class="dom-b-seg" style="width:10%;background:${dom.color}55">Резерв 10%</div></div>
        </div>
        <div class="dom-b-rules">
          <h4>📋 Правила бюджетирования</h4>
          <div class="dom-b-rule">✓ Перерасход до 10% — автономно</div>
          <div class="dom-b-rule">✓ Перерасход 10-25% — согласование с Финансами</div>
          <div class="dom-b-rule">✓ Перерасход >25% — арбитраж</div>
          <div class="dom-b-rule">✓ Эксперименты — до 15% от бюджета</div>
        </div>
      </div>`;
    } else if (activeTab === 'Кредиты'){
      if (!cc) { body.innerHTML = `<div class="dom-cc"><p>У домена нет собственной валюты.</p></div>`; return; }
      body.innerHTML = `<div class="dom-cc">
        <h3>💱 ${cc.name}</h3>
        <div class="dom-cc-header">
          <div class="dom-cc-stat"><b>${cc.circulating.toLocaleString()}</b><small>в обращении</small></div>
          <div class="dom-cc-stat"><b>${cc.supply.toLocaleString()}</b><small>эмиссия</small></div>
          <div class="dom-cc-stat"><b>${cc.exchangeRate}</b><small>курс</small></div>
        </div>
        <div class="dom-cc-back">Обеспечение: ${cc.backedBy}</div>
        <h4>Последние транзакции</h4>
        ${CC_TRANSACTIONS.filter(t => t.currency === cc.symbol || t.from === domId || t.to === domId).slice(0,5).map(t => {
          const fromDom = DOMAINS.find(d=>d.id===t.from);
          const toDom = DOMAINS.find(d=>d.id===t.to);
          return `<div class="dom-cc-tx"><span style="color:${fromDom?.color||'#999'}">●</span> ${fromDom?.name||t.from} <span>→</span> <span style="color:${toDom?.color||'#999'}">●</span> ${toDom?.name||t.to} <b>${t.amount} ${t.currency}</b><small>${t.reason}</small></div>`;
        }).join('')}
      </div>`;
    }
  }
  renderTab();
}

function renderInterDomainContracts(work){
  work.innerHTML = `<div class="work-head"><div class="ico">📜</div><div><h2>Междоменные контракты</h2><p>Передачи работы между доменами как юридически обязывающие соглашения с SLA и штрафами</p></div></div>
    <div class="idc-list" id="idcList"></div>`;
  const list = $('#idcList');
  INTER_DOMAIN_CONTRACTS.forEach(c => {
    const from = DOMAINS.find(d=>d.id===c.from);
    const to = DOMAINS.find(d=>d.id===c.to);
    const row = el(`<div class="idc-card">
      <div class="idc-header">
        <div class="idc-parties"><span class="idc-from" style="background:${from.color}20;color:${from.color}"><span class="idc-dot" style="background:${from.color}"></span>${from.name}</span>
          <span class="idc-arrow">→</span>
          <span class="idc-to" style="background:${to.color}20;color:${to.color}"><span class="idc-dot" style="background:${to.color}"></span>${to.name}</span>
        </div>
        <div class="idc-status ${c.status==='active'?'idc-act':'idc-pen'}">${c.status==='active'?'🟢 Активен':'🟡 На паузе'}</div>
      </div>
      <div class="idc-body">
        <b class="idc-name">${c.name}</b>
        <div class="idc-sla-grid">
          <div class="idc-sla"><span>⏱️</span><b>${c.sla.responseTime}</b><small>время ответа</small></div>
          <div class="idc-sla"><span>📊</span><b>${c.sla.qualityThreshold}</b><small>порог качества</small></div>
          <div class="idc-sla"><span>📦</span><b>${c.sla.volume}</b><small>объём</small></div>
        </div>
        <div class="idc-penalty">💰 Штраф за нарушение: <b>${c.penalty.amount} ${c.penalty.currency}</b> <small>(${c.penalty.type})</small></div>
        <div class="idc-perf">
          <div class="idc-perf-bar"><div class="idc-perf-fill" style="width:${c.lastMonth.fulfilled}%;background:${c.lastMonth.fulfilled>=95?'#10b981':c.lastMonth.fulfilled>=80?'#f59e0b':'#ef4444'}"></div></div>
          <div class="idc-perf-labels"><span>Выполнение: <b>${c.lastMonth.fulfilled}%</b></span><span>Нарушения: <b>${c.lastMonth.breaches}</b></span><span>Переведено: <b>${c.lastMonth.creditsTransferred} CC</b></span></div>
        </div>
        <div class="idc-meta"><small>Подписан: ${c.signed} · Обновление: ${c.renews}</small></div>
      </div>
    </div>`);
    list.appendChild(row);
  });
}

function renderWorkerDiplomat(work, dipId){
  const dip = WORKER_DIPLOMATS.find(d => d.id === dipId); if (!dip) return;
  const from = DOMAINS.find(d=>d.id===dip.from);
  const to = DOMAINS.find(d=>d.id===dip.to);
  const agent = WORKER_WORKFORCE.find(a=>a.id===dip.agentId);
  const contracts = INTER_DOMAIN_CONTRACTS.filter(c => c.from===dip.from && c.to===dip.to);

  work.innerHTML = `<div class="work-head"><div class="ico">🕊️</div><div><h2>${dip.name}</h2><p>Цифровой сотрудник-посол · Двойное гражданство: ${from.name} ↔ ${to.name}</p></div></div>
    <div class="dip-layout">
      <div class="dip-main">
        <div class="dip-card">
          <div class="dip-id"><div class="dip-av">${agent?.avatar||'🤖'}</div><div><b>${agent?.name||'—'}</b><small>${agent?.version||''} · ${dip.status==='active'?'🟢 Активен':'🟡 На паузе'}</small></div></div>
          <div class="dip-mandate"><b>📜 Мандат:</b><p>${dip.mandate}</p></div>
          <div class="dip-cit">
            <div class="dip-c-from" style="border-color:${from.color}"><span style="color:${from.color}">●</span> <b>${from.name}</b><small>Домен происхождения · конституция и бюджет</small></div>
            <div class="dip-c-to" style="border-color:${to.color}"><span style="color:${to.color}">●</span> <b>${to.name}</b><small>Целевой домен · мандат и SLA</small></div>
          </div>
        </div>
        <div class="dip-kpi">
          <h3>📊 KPI посла</h3>
          <div class="dip-k-grid">
            <div class="dip-k"><b>${dip.kpi.contracts}</b><small>контрактов выполнено</small></div>
            <div class="dip-k"><b>${dip.kpi.disputes}</b><small>споров разрешено</small></div>
            <div class="dip-k"><b>${dip.kpi.satisfaction}</b><small>удовлетворённость доменов</small></div>
          </div>
        </div>
        <div class="dip-contracts">
          <h3>🔗 Контракты под мандатом</h3>
          ${contracts.map(c => `<div class="dip-c-row"><b>${c.name}</b><small>SLA: ${c.sla.responseTime} · Штраф: ${c.penalty.amount} ${c.penalty.currency}</small></div>`).join('')}
        </div>
      </div>
      <div class="dip-side">
        <div class="dip-panel">
          <h4>🕊️ Что такое посол?</h4>
          <p>Цифровой сотрудник-посол — делегированный цифровой сотрудник, работающий на границе двух доменов. Он имеет <b>двойное гражданство</b>: подчиняется конституции домена-происхождения, но действует по мандату целевого домена.</p>
          <p>Посол разрешает споры, обеспечивает SLA и переводит кредиты компетенций при нарушениях.</p>
        </div>
        <div class="dip-panel">
          <h4>📅 История</h4>
          <div class="dip-timeline">
            <div class="dip-tl-item"><b>${dip.since}</b><small>Назначение послом</small></div>
            <div class="dip-tl-item"><b>${dip.kpi.contracts} контрактов</b><small>Выполнено за всё время</small></div>
            <div class="dip-tl-item"><b>${dip.kpi.disputes} споров</b><small>Разрешено миром</small></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderArbitration(work){
  work.innerHTML = `<div class="work-head"><div class="ico">⚖️</div><div><h2>Арбитраж федерации</h2><p>Разрешение конфликтов между суверенными доменами · Нейтральные арбитры · Прозрачные решения</p></div></div>
    <div class="arb-layout">
      <div class="arb-cases" id="arbCases"></div>
      <div class="arb-rules">
        <h3>📋 Правила арбитража</h3>
        <div class="arb-rule"><b>1.</b> Любой домен может подать иск против другого домена при нарушении контракта или конституции.</div>
        <div class="arb-rule"><b>2.</b> Арбитр — представитель нейтрального домена (не истец, не ответчик).</div>
        <div class="arb-rule"><b>3.</b> Срок рассмотрения — до 15 рабочих дней. Срочные — до 3 дней (блокировка релиза, инцидент).</div>
        <div class="arb-rule"><b>4.</b> Решение обязывает оба домена. Исполнение — в течение 5 дней.</div>
        <div class="arb-rule"><b>5.</b> Апелляция — к CEO (высший арбитр) в течение 3 дней.</div>
        <div class="arb-stat">
          <div class="arb-s"><b>${ARBITRATION_CASES.length}</b><small>всего кейсов</small></div>
          <div class="arb-s"><b>${ARBITRATION_CASES.filter(a=>a.status==='open').length}</b><small>открытых</small></div>
          <div class="arb-s"><b>${ARBITRATION_CASES.filter(a=>a.status==='resolved').length}</b><small>разрешённых</small></div>
          <div class="arb-s"><b>${(ARBITRATION_CASES.filter(a=>a.status==='resolved').reduce((s,a)=>s+((new Date(a.resolved)-new Date(a.filed))/86400000),0)/Math.max(1,ARBITRATION_CASES.filter(a=>a.status==='resolved').length)).toFixed(1)} дн</b><small>среднее время</small></div>
        </div>
      </div>
    </div>`;
  const cases = $('#arbCases');
  ARBITRATION_CASES.forEach(a => {
    const plaintiff = DOMAINS.find(d=>d.id===a.plaintiff);
    const defendant = DOMAINS.find(d=>d.id===a.defendant);
    const card = el(`<div class="arb-card ${a.status==='open'?'arb-open':'arb-res'}">
      <div class="arb-header">
        <div class="arb-parties"><span style="color:${plaintiff.color}">●</span> ${plaintiff.name} <span class="arb-vs">vs</span> <span style="color:${defendant.color}">●</span> ${defendant.name}</div>
        <div class="arb-status">${a.status==='open'?'🔴 Открыт':'✅ Разрешён'}</div>
      </div>
      <b class="arb-title">${a.title}</b>
      <p class="arb-sum">${a.summary}</p>
      <div class="arb-evidence">
        ${a.evidence.map(e => `<div class="arb-ev"><span style="color:${DOMAINS.find(d=>d.id===e.party)?.color||'#999'}">●</span> <b>${DOMAINS.find(d=>d.id===e.party)?.name||e.party}:</b> ${e.text}</div>`).join('')}
      </div>
      <div class="arb-footer">
        <div class="arb-arbiter">⚖️ Арбитр: ${a.arbiter}</div>
        <div class="arb-dates">Подан: ${a.filed}${a.resolved?' · Разрешён: '+a.resolved:''}${a.deadline?' · Дедлайн: '+a.deadline:''}</div>
        ${a.ruling?`<div class="arb-ruling"><b>Решение:</b> ${a.ruling}</div>`:''}
      </div>
    </div>`);
    cases.appendChild(card);
  });
}

function renderInternalEconomy(work){
  work.innerHTML = `<div class="work-head"><div class="ico">💱</div><div><h2>Внутренняя экономика</h2><p>Marketplace услуг между доменами · Кредиты компетенций (CC) как внутренняя валюта</p></div></div>
    <div class="eco-layout">
      <div class="eco-main">
        <div class="eco-currencies">
          <h3>💱 Кредиты компетенций</h3>
          <div class="eco-cc-grid">
            ${COMPETENCE_CREDITS.map(cc => {
              const dom = DOMAINS.find(d=>d.id===cc.issuer);
              return `<div class="eco-cc-card" style="--cc-color:${dom?.color||'#999'}">
                <div class="eco-cc-head"><span class="eco-cc-sym">${cc.symbol}</span><div><b>${cc.name}</b><small>${dom?.name||cc.issuer}</small></div></div>
                <div class="eco-cc-stats">
                  <div><b>${cc.circulating.toLocaleString()}</b><small>в обращении</small></div>
                  <div><b>${cc.supply.toLocaleString()}</b><small>эмиссия</small></div>
                  <div><b>${cc.exchangeRate}</b><small>курс</small></div>
                </div>
                <div class="eco-cc-back">${cc.backedBy}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="eco-market">
          <h3>🏪 Marketplace услуг</h3>
          <div class="eco-svc-grid">
            ${MARKETPLACE_SERVICES.map(s => {
              const dom = DOMAINS.find(d=>d.id===s.provider);
              return `<div class="eco-svc-card">
                <div class="eco-svc-head"><span style="color:${dom?.color||'#999'}">●</span> <b>${s.name}</b><small>${dom?.name||s.provider}</small></div>
                <p>${s.desc}</p>
                <div class="eco-svc-price"><b>${s.price} ${s.currency}</b><small>${s.unit}</small></div>
                <button class="eco-svc-btn">Запросить услугу</button>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="eco-tx">
          <h3>🔄 Последние транзакции</h3>
          <div class="eco-tx-list">
            ${CC_TRANSACTIONS.map(t => {
              const from = DOMAINS.find(d=>d.id===t.from);
              const to = DOMAINS.find(d=>d.id===t.to);
              return `<div class="eco-tx-row">
                <div class="eco-tx-parties"><span style="color:${from?.color||'#999'}">●</span> ${from?.name||t.from} <span>→</span> <span style="color:${to?.color||'#999'}">●</span> ${to?.name||t.to}</div>
                <div class="eco-tx-amt"><b>${t.amount} ${t.currency}</b><small>${t.reason}</small></div>
                <div class="eco-tx-date">${t.date} · ${t.status==='settled'?'✅ Завершена':'⏳ В процессе'}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="eco-side">
        <div class="eco-panel">
          <h4>💡 Как работает экономика</h4>
          <p>Каждый домен выпускает <b>кредиты компетенций (CC)</b> — внутреннюю валюту, обеспеченную достижениями домена.</p>
          <p>CC используются для:</p>
          <ul>
            <li>Оплаты услуг других доменов (marketplace)</li>
            <li>Штрафов за нарушение SLA в контрактах</li>
            <li>Инвестиций в совместные проекты</li>
          </ul>
          <p>Курс CC привязан к рублю, но может колебаться в зависимости от performance домена.</p>
        </div>
        <div class="eco-panel">
          <h4>📊 Объём торгов</h4>
          <div class="eco-vol">
            <div class="eco-v"><b>${CC_TRANSACTIONS.filter(t=>t.status==='settled').reduce((s,t)=>s+t.amount,0).toLocaleString()} CC</b><small>переведено за месяц</small></div>
            <div class="eco-v"><b>${MARKETPLACE_SERVICES.length}</b><small>услуг в marketplace</small></div>
            <div class="eco-v"><b>${COMPETENCE_CREDITS.length}</b><small>валют в обращении</small></div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   КАНАЛ ОТДЕЛА (Department Channel) — коллаборация людей и цифровых сотрудников
   ═══════════════════════════════════════════════════════════════ */
function renderDeptChannel(root, deptId) {
  const dept = DEPARTMENTS.find(d => d.id === deptId);
  const CH = (window.__CHMSG = window.__CHMSG || {});
  const messages = (CH[deptId] = CH[deptId] || [...(DEPT_CHANNELS[deptId] || [])]);
  const digitalWorkers = DIGITAL_STAFF[deptId] || [];
  const team = COCKPITS[deptId] ? COCKPITS[deptId].team.map(t=>Array.isArray(t)?{name:t[0],role:t[1],emoji:t[3]}:t).slice(0,5) : [];
  const humans = team.length ? team : [{ name: dept.persona.split(' · ')[1] || 'Руководитель', emoji: '👤', role: 'Руководитель' }];

  root.innerHTML = workHead(dept, `Канал отдела · люди и цифровые сотрудники в одном пространстве · ${digitalWorkers.length} цифровых в штате`) + `
    <div class="channel-layout">
      <div class="channel-sidebar">
        <div class="channel-section">
          <h4>👥 Команда</h4>
          ${humans.map((h,hi) => `
            <div class="channel-member human" data-pid="${deptId}:${hi}" title="Открыть профиль">
              ${humanAv(deptId, h.name, (DEPT_TASK[deptId]||{}).c||'#8e9288', 'sm')}
              <div class="channel-member-info">
                <b>${h.name}</b>
                <span>${h.role}</span>
              </div>
            </div>
          `).join('')}
          ${digitalWorkers.map(w => `
            <div class="channel-member digital" data-id="${w.id}" title="Открыть профиль и должностную инструкцию">
              <div class="channel-member-avatar dgt">${w.emoji}</div>
              <div class="channel-member-info">
                <b>${w.name} <i class="dgt-tag">цифровой</i></b>
                <span>${w.title}</span>
              </div>
              <span class="channel-member-status ${w.status}">●</span>
            </div>
          `).join('')}
        </div>
        <div class="channel-section">
          <h4>📊 Метрики канала</h4>
          <div class="channel-metrics">
            <div class="channel-metric">
              <span class="channel-metric-value">${messages.filter(m => m.type === 'agent').length}</span>
              <span class="channel-metric-label">Сообщений от цифровых сотрудников</span>
            </div>
            <div class="channel-metric">
              <span class="channel-metric-value">${messages.filter(m => m.type === 'human').length}</span>
              <span class="channel-metric-label">Сообщений от людей</span>
            </div>
            <div class="channel-metric">
              <span class="channel-metric-value">${messages.filter(m => m.type === 'system').length}</span>
              <span class="channel-metric-label">Системных событий</span>
            </div>
          </div>
        </div>
      </div>
      <div class="channel-main">
        <div class="channel-messages" id="channelMessages">
          ${messages.map(m => {
            if (m.type === 'system') {
              return `<div class="channel-event animate-fade">
                <span class="channel-event-dot"></span>
                <span class="channel-event-text">${m.text}</span>
                <span class="channel-event-time">${m.time}</span>
              </div>`;
            }
            const isDigital = m.type === 'agent';
            const avatar = isDigital
              ? `<span>${m.avatar}</span>`
              : (m.who && window.AVATARS && window.AVATARS[deptId+':'+m.who]
                  ? `<img src="${window.AVATARS[deptId+':'+m.who]}" alt="${m.who}" class="ch-msg-ph"/>`
                  : `<span>${m.avatar}</span>`);
            /* равноправие: автор любого сообщения кликабелен → его полный профиль */
            let au = '';
            if (isDigital){ const dw = digitalWorkers.find(x=>x.name===m.who); if (dw) au = `data-au="worker:${dw.id}"`; }
            else if (m.who && m.who !== 'Вы'){ const pi = personIdxByName(deptId, m.who); if (pi >= 0) au = `data-au="person:${deptId}:${pi}"`; }
            return `<div class="channel-message ${isDigital ? 'digital' : 'human'} animate-fade">
              <div class="channel-message-avatar">
                ${avatar}
              </div>
              <div class="channel-message-content">
                <div class="channel-message-header">
                  <b class="${au?'ch-au':''}" ${au} title="${au?'Открыть профиль':''}">${m.who}</b>
                  ${isDigital ? '<span class="channel-message-badge">◆ Цифровой сотрудник</span>' : ''}
                  <span class="channel-message-time">${m.time}</span>
                </div>
                <div class="channel-message-text">${m.text}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="channel-composer">
          <input type="text" placeholder="Написать в канал ${dept.label}…" id="channelInput"/>
          <button id="channelSend">➤</button>
        </div>
      </div>
    </div>`;
  
  // Клик по участнику → профиль (человек или цифровой)
  root.querySelectorAll('.channel-member.digital').forEach(elm => {
    elm.onclick = () => navTo('worker:' + elm.dataset.id);
  });
  root.querySelectorAll('.channel-member.human[data-pid]').forEach(elm => {
    elm.onclick = () => navTo('person:' + elm.dataset.pid);
  });
  root.querySelectorAll('.ch-au[data-au]').forEach(elm => {
    elm.onclick = (e) => { e.stopPropagation(); navTo(elm.dataset.au); };
  });
  // Композер живой: сообщение попадает в канал, цифровой сотрудник отвечает
  const inp = $('#channelInput', root), snd = $('#channelSend', root);
  const mbox = root.querySelector('.channel-messages');
  if (mbox) mbox.scrollTop = mbox.scrollHeight;
  const hhmm = () => { const t = new Date(); return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); };
  const sendMsg = () => {
    const v = inp.value.trim(); if (!v){ toast('Напишите сообщение'); return; }
    messages.push({ id:'ch-u-'+Date.now(), type:'human', who:'Вы', avatar:'🧑‍💼', text:v, time:hhmm() });
    renderDeptChannel(root, deptId);
    const w = digitalWorkers[Math.floor(Math.random()*digitalWorkers.length)];
    if (w) setTimeout(() => {
      if (!document.body.contains(root)) return;
      messages.push({ id:'ch-a-'+Date.now(), type:'agent', who:w.name, avatar:w.emoji,
        text:`Принял: «${v}». Соберу черновик и принесу на проверку — финальное слово за человеком (${w.lead.split(' · ')[0]}). [Открыть в рабочей среде →]`, time:hhmm() });
      pushAudit({ who:w.name+' · '+dept.label, emoji:w.emoji, act:'взял задачу из канала: '+v, dept:dept.label });
      renderDeptChannel(root, deptId);
    }, 900);
  };
  if (snd) snd.onclick = sendMsg;
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') sendMsg(); };
}

/* ═══════════════════════════════════════════════════════════════
   ШТАТ ЦИФРОВЫХ СОТРУДНИКОВ (Digital Workforce)
   ═══════════════════════════════════════════════════════════════ */
function renderWorkerWorkforce(root) {
  const workers = ALL_DIGITAL;
  const named = workers.length, typical = DIGITAL_SIZE - named;
  root.innerHTML = workHead({icon: '🤖', label: 'Штат цифровых сотрудников'}, `${DIGITAL_SIZE} в штате (${DIGITAL_SHARE}% компании) · ${named} именных позиций + ${typical} типовых · у каждого должностная инструкция и руководитель-человек`) + `
    <div class="grid-kpi" style="margin-bottom:13px">
      <div class="kpi"><div class="l">Цифровых в штате</div><div class="v">${DIGITAL_SIZE}</div><div class="d up">▲ ${DIGITAL_SHARE}% всего штата</div></div>
      <div class="kpi"><div class="l">В строю сейчас</div><div class="v">${DIGITAL_SIZE - workers.filter(w=>w.status!=='active').length - 2}</div><div class="d up">● работают</div></div>
      <div class="kpi"><div class="l">На испытательном сроке</div><div class="v">${workers.filter(w=>w.status==='probation').length + 2}</div><div class="d flat">◐ под наставником</div></div>
      <div class="kpi"><div class="l">Руководителей-людей</div><div class="v">${[...new Set(workers.map(w=>w.lead))].length}</div><div class="d up">▲ каждый цифровой подотчётен человеку</div></div>
    </div>
    <div class="workforce-filters">
      <input type="text" placeholder="Поиск: имя, должность, обязанность…" class="workforce-search" id="workforceSearch"/>
      <select class="workforce-filter" id="workforceFilterDept">
        <option value="">Все отделы</option>
        ${ROLE_IDS.map(r => `<option value="${r}">${DEPARTMENTS.find(x=>x.id===r).label} · ${DIGITAL_HEADCOUNT[r]}</option>`).join('')}
      </select>
      <select class="workforce-filter" id="workforceFilterStatus">
        <option value="">Все статусы</option>
        <option value="active">В строю</option>
        <option value="probation">Испытательный срок</option>
        <option value="paused">На паузе</option>
      </select>
      <button class="btn go" id="wfHire">＋ Нанять из библиотеки</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Сотрудник</th><th>Должность</th><th>Отдел · функция</th><th>Руководитель</th><th>Модель</th><th>Сейчас в работе</th><th>Статус</th></tr></thead>
        <tbody id="workforceTable">
          ${workers.map((w,i)=>{ const dep=DEPARTMENTS.find(x=>x.id===w.dept); const st=DW_STATUS[w.status]||DW_STATUS.active;
            return `<tr class="workforce-row" style="animation-delay:${Math.min(i*0.02,0.6)}s" data-id="${w.id}">
              <td><span class="wf-av">${w.emoji}</span> <b>${w.name}</b></td>
              <td>${w.title}</td>
              <td>${dep.label} <small style="color:var(--muted)">· ${w.fn}</small></td>
              <td>${w.lead}</td>
              <td>${modelBadge(w.model)}</td>
              <td class="wf-now">${w.now}</td>
              <td><span class="ji-st ${st[1]}">${st[0]}</span></td>
            </tr>`; }).join('')}
        </tbody>
      </table>
    </div>
    <div class="od-gov" style="margin-top:11px">Ещё <b>${typical}</b> типовых цифровых позиций развёрнуты в функциях отделов по шаблонным должностным инструкциям. Кликните сотрудника — полный профиль с инструкцией, KPI и постановкой задачи.</div>`;

  root.querySelectorAll('.workforce-row').forEach(row => { row.onclick = () => navTo('worker:' + row.dataset.id); });
  const hire=$('#wfHire',root); if(hire) hire.onclick=()=>navTo('market');

  const searchInput=$('#workforceSearch',root), filterDept=$('#workforceFilterDept',root), filterStatus=$('#workforceFilterStatus',root);
  function filterTable(){
    const search=searchInput.value.toLowerCase(), dept=filterDept.value, status=filterStatus.value;
    root.querySelectorAll('.workforce-row').forEach(row=>{
      const w=workers.find(x=>x.id===row.dataset.id);
      const hay=(w.name+' '+w.title+' '+w.fn+' '+w.ji.duties.join(' ')).toLowerCase();
      row.style.display=((!search||hay.includes(search)) && (!dept||w.dept===dept) && (!status||w.status===status))?'':'none';
    });
  }
  searchInput.oninput=filterTable; filterDept.onchange=filterTable; filterStatus.onchange=filterTable;
}

/* ═══════════════════════════════════════════════════════════════
   ПРОФИЛЬ ЦИФРОВОГО СОТРУДНИКА (Digital Worker Profile)
   ═══════════════════════════════════════════════════════════════ */
const DEPT_INTEG = { dev:['repo','ci','jira','cloud'], sales:['crm','mail','drive'], marketing:['crm','drive','mail','analytics'], design:['figma','drive','jira'], analytics:['analytics','bill','cloud','drive'], hr:['crm','drive','mail'], finance:['bill','1c','drive'], legal:['drive','mail','siem'] };
function renderWorkerProfile(root, workerId) {
  const w = ALL_DIGITAL.find(x => x.id === workerId);
  if (!w) { root.innerHTML = workHead({icon:'🤖',label:'Цифровой сотрудник'}, 'не найден') + '<div class="od-gov empty-note">Сотрудник не найден — откройте «Штат цифровых сотрудников».</div>'; return; }
  const dept = DEPARTMENTS.find(d => d.id === w.dept);
  const h = strHash(w.id);
  const c = DEPT_TASK[w.dept].c;
  const S = aiBudgetStore(); const db = S.depts[w.dept];
  const daily = Math.max(100, Math.round(db.limit / DIGITAL_HEADCOUNT[w.dept] / 10) * 10);
  const spent = Math.round(daily * (0.45 + (h % 40) / 100));
  const tier = MODELS[w.model].tier;
  const sla = { resp: tier==='deep' ? '< 6 с' : tier==='fast'||tier==='audio' ? '< 2 с' : '< 4 с', up: (99.4 + (h % 6) / 10).toFixed(1) + '%' };
  const leadName = w.lead.split(' · ')[0];
  const leadIdx = COCKPITS[w.dept] ? COCKPITS[w.dept].team.findIndex(t => (Array.isArray(t)?t[0]:t.name) === leadName) : -1;
  const logSeed = (DEPT_TASK[w.dept]||{l:['задача']}).l;
  const C = workerRPG(w);
  let tab = 'stats';
  function draw(){
    const st = DW_STATUS[w.status] || DW_STATUS.active;
    root.innerHTML = `
    <div class="worker-profile animate-fade">
      <div class="worker-profile-header">
        <button class="worker-profile-back" id="wpBack">← Назад</button>
        <div class="worker-profile-title"><h1>Профиль цифрового сотрудника</h1><p>золотой профиль · должностная инструкция, KPI, доступы и журнал в одном месте</p></div>
      </div>
      <div class="gp-head">
        <span class="gp-av big dgt" style="--c:${c}">${w.emoji}</span>
        <div class="gp-id">
          <h1>${w.name} <i class="dgt-tag">цифровой сотрудник</i></h1>
          <p>${w.title} · ${dept.label} · функция «${w.fn}»</p>
          <div class="gp-badges">
            <span class="gp-bdg acc">v${1 + h % 4}.${h % 10}</span>
            <span class="gp-bdg lvl">${LEX('lvlOf')(C.lvl)}</span>
            <span class="gp-bdg">${w.id}</span>
            <span class="ji-st ${st[1]}">${st[0]}</span>
            ${modelBadge(w.model)}
          </div>
        </div>
        <div class="gp-rate">
          <b>${(4.4 + (h % 6) / 10).toFixed(1)} <span class="gp-stars">★★★★★</span></b>
          <small>оценка руководителя · ${30 + h % 60} приёмок</small>
        </div>
      </div>
      <div class="gp-sources">
        ${['Среда · Студия','Маршрутизатор','Аудит','Бюджеты ИИ'].map(s=>`<span class="gp-sys"><i></i>${s}</span>`).join('')}
        <span class="gp-sys-note">запущен ${String(1 + h % 12).padStart(2,'0')}.2025 · подотчётен: <b style="color:var(--txt)">${w.lead}</b></span>
      </div>
      <div class="gp-tabs">
        ${[['stats',LEX('stats')],['ji','Должностная инструкция'],['kpi','KPI · SLA'],['access','Доступы и интеграции'],['budget','Бюджет'],['log','Журнал'],['mgmt','Управление']].map(t=>`<button class="gp-tab ${tab===t[0]?'on':''}" data-t="${t[0]}">${t[1]}</button>`).join('')}
      </div>
      <div class="gp-body">${body(st)}</div>
    </div>`;
    wire();
  }
  function body(st){
    if (tab==='stats'){ const manaPct=Math.round(C.mana.cur/C.mana.max*100);
      return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card hc crd">
        <h2>${LEX('stats')} <span class="tag">${LEX('lvlOf')(C.lvl)} · модель ${MODELS[w.model].name}</span></h2>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('mana')}</span><b>${C.mana.cur}/${C.mana.max} · ${C.mana.unit}</b></div>${rpgBar(manaPct,'mp')}</div>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('stats')}</span></div>
          ${C.stats.map(s=>`<div class="hc-skill"><span>${s[0]}</span>${rpgDots(s[1])}<b>${s[1]}/10</b></div>`).join('')}</div>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('duties')}</span></div>
          ${C.spells.map(s=>`<div class="hc-spell"><span>${s[0]}</span>${rpgStars(s[1])}</div>`).join('')}</div>
        <div class="ji-sec lim"><b>${LEX('limits')}</b><ul>${C.curses.map(x=>`<li>⛔ ${x}</li>`).join('')}</ul></div>
      </div>
      <div class="panel gp-card hc">
        <h2>${isRPG()?'Активный квест':'Активная задача'}</h2>
        <div class="hc-q"><div class="hc-q-t"><b>${w.now}</b><i class="q-mid">${C.prog}%</i></div>${rpgBar(C.prog)}</div>
        <div class="hc-art" style="margin-top:7px">${C.artifacts.map(a=>`<span>${a}</span>`).join('')}</div>
        ${gpField('Руководитель', w.lead, 'sreda')}
        ${gpField('Стоимость задачи', '~₽' + Math.round(MODELS[w.model].cost * 2.3), 'sreda')}
        ${gpField('Эскалация', w.ji.esc, 'sreda')}
        <div class="od-gov" style="margin-top:9px">${isRPG()
          ? 'Существо призвано человеком и служит до отзыва: мана — недельный лимит задач, проклятия — жёсткие запреты из инструкции.'
          : 'Характеристики выводятся из модели и ДИ: лимит — из KPI, ограничения — из инструкции. Каждый результат — черновик человеку.'}</div>
      </div>
    </div>`; }
    if (tab==='ji') return `<div class="two-col" style="align-items:start">
      <div class="panel ji-card">
        <h2>Должностная инструкция <span class="tag">версия 2.1 · утверждена ${leadName}</span></h2>
        <div class="ji-sec"><b>Миссия</b><p>${w.ji.mission}</p></div>
        <div class="ji-sec"><b>Обязанности</b><ul>${w.ji.duties.map(x=>`<li>${x}</li>`).join('')}</ul></div>
        <div class="ji-sec lim"><b>Границы (что запрещено)</b><ul>${w.ji.limits.map(x=>`<li>${x}</li>`).join('')}</ul></div>
        <div class="ji-sec esc"><b>Эскалация человеку</b><p>${w.ji.esc}</p></div>
      </div>
      <div class="panel gp-card">
        <h2>Подчинение</h2>
        ${gpField('Руководитель', w.lead, 'sreda')}
        ${gpField('Отдел', dept.label, 'sreda')}
        ${gpField('Функция', w.fn, 'sreda')}
        ${gpField('Формат контроля', 'каждый результат — черновик на проверку', 'sreda')}
        ${leadIdx>=0?`<button class="btn ghost" data-leadprof style="margin-top:9px">Профиль руководителя: ${leadName} →</button>`:''}
        <div class="od-gov" style="margin-top:10px">Никаких «волшебных кнопок»: необратимые действия запрещены инструкцией, принимает работу ${leadName}. Всё в аудите.</div>
      </div></div>`;
    if (tab==='kpi') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>KPI из должностной инструкции</h2>
        <div class="ji-kpi" style="margin-top:6px">${w.ji.kpi.map(k=>`<div><span>${k[0]}</span><b>${k[1]}</b></div>`).join('')}</div>
        ${gpField('Задач за месяц', String(80 + h % 160), 'sreda')}${gpField('Принято без правок', (55 + h % 35) + '%', 'sreda')}</div>
      <div class="panel gp-card"><h2>SLA</h2>
        ${gpField('Время отклика', sla.resp, 'sreda')}${gpField('Uptime', sla.up, 'sreda')}
        ${gpField('Эскалаций к человеку', (2 + h % 6) + '% задач', 'sreda')}${gpField('Маршрут модели', MODELS[w.model].name + ' · ' + MODELS[w.model].why, 'sreda')}</div>
    </div>`;
    if (tab==='access') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>Интеграции <span class="tag">в границах отдела</span></h2>
        ${(DEPT_INTEG[w.dept]||[]).map(iid=>{ const it=WORKER_INTEGRATIONS.find(x=>x.id===iid); return it?gpField(it.name, (it.status==='connected'?'● подключено · ':'◐ ограничено · ')+it.scope, 'sreda'):''; }).join('')}</div>
      <div class="panel gp-card"><h2>Права и периметр</h2>
        ${gpField('Данные', 'только витрины отдела «'+dept.label+'»', 'sreda')}
        ${gpField('ПДн', S.policies.localPII?'только локальные модели':'по политике компании', 'sreda')}
        ${gpField('Внешние системы', 'запись — только с апрувом человека', 'sreda')}
        <div class="od-gov" style="margin-top:9px">Права не шире, чем у руководителя: цифровой сотрудник наследует периметр роли. Каждое обращение к данным — в аудите.</div></div>
    </div>`;
    if (tab==='budget'){ const pct=Math.min(100,Math.round(spent/daily*100));
      return `<div class="panel gp-card"><h2>Бюджет</h2>
      <div class="two-col" style="margin-top:6px">
        <div>${gpField('Дневной лимит', '₽' + daily.toLocaleString('ru'), 'sreda')}${gpField('Потрачено сегодня', '₽' + spent.toLocaleString('ru') + ' · ' + pct + '%', 'sreda')}${gpField('Остаток', '₽' + (daily - spent).toLocaleString('ru'), 'sreda')}</div>
        <div>${gpField('Лимит отдела', '₽' + db.limit.toLocaleString('ru') + ' / день', 'sreda')}${gpField('Стоимость задачи', '~₽' + Math.round(MODELS[w.model].cost * 2.3), 'sreda')}
          <button class="btn ghost" data-gobudget style="margin-top:8px">Открыть Бюджеты ИИ →</button></div>
      </div>
      <div class="track" style="margin-top:10px"><div class="fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>75?'var(--amber)':'var(--acc)'}"></div></div>
      <div class="od-gov" style="margin-top:10px">При исчерпании лимита сотрудник встаёт на паузу, задачи возвращаются людям, руководитель получает уведомление.</div></div>`; }
    if (tab==='log') return `<div class="panel gp-card"><h2>Журнал действий <span class="tag">аудит · всё прозрачно</span></h2>
      <div class="worker-profile-logs">
        ${[0,1,2,3,4].map(i=>`<div class="worker-profile-log">
          <span class="worker-profile-log-time">сегодня ${9+i}:${String((17*(i+1))%60).padStart(2,'0')}</span>
          <span class="worker-profile-log-action">${['Черновик готов','Передано на ревью','Принято руководителем','Эскалация человеку','Запись в аудит'][i]}</span>
          <span class="worker-profile-log-detail">${logSeed[i%logSeed.length]} · ${leadName}</span>
        </div>`).join('')}
      </div></div>`;
    if (tab==='mgmt') return `<div class="two-col" style="align-items:start">
      <div class="panel ji-card"><h2>Управление</h2>
        <div class="ji-now">сейчас в работе: <b data-jinow>${w.now}</b></div>
        <div class="ji-ask"><input type="text" placeholder="Задача для «${w.name}»…" data-jiask/><button class="btn go" data-jigo>→</button></div>
        <div class="wp-actions">
          <button class="btn ghost" id="wpPause">${w.status==='paused'?'▶ Возобновить':'⏸ Поставить на паузу'}</button>
          <button class="btn ghost" id="wpReview">Отчёт руководителю</button>
        </div></div>
      <div class="panel gp-card"><h2>Статус</h2>
        ${gpField('Текущий статус', st[0], 'sreda')}
        ${gpField('На связи', '24/7 · ночная пауза ' + (S.policies.nightPause?'включена':'выключена'), 'sreda')}
        <div class="od-gov" style="margin-top:9px">Пауза мгновенно возвращает задачи в очередь людей. Все переключения — в аудите.</div></div>
    </div>`;
    return '';
  }
  function wire(){
    $('#wpBack',root).onclick = ()=>goBack('workers');
    root.querySelectorAll('.gp-tab').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; draw(); });
    const lp=root.querySelector('[data-leadprof]'); if(lp) lp.onclick=()=>navTo('person:'+w.dept+':'+leadIdx);
    const gb=root.querySelector('[data-gobudget]'); if(gb) gb.onclick=()=>navTo('aibudget');
    const pauseBtn=$('#wpPause',root); if(pauseBtn) pauseBtn.onclick = ()=>{ const paused = w.status==='paused';
      w.status = paused ? 'active' : 'paused';
      pushAudit({ who:w.lead, what:`${paused?'Возобновил':'Поставил на паузу'} цифрового сотрудника «${w.name}»`, verdict:'allow' });
      toast(paused?`${w.name} снова в строю`:`${w.name} на паузе — задачи вернутся в очередь людей`);
      draw(); };
    const rev=$('#wpReview',root); if(rev) rev.onclick = ()=>{ pushAudit({ who:w.lead, what:`Запрошен отчёт по «${w.name}» за неделю`, verdict:'allow' }); toast(`Отчёт по ${w.name} уйдёт руководителю: ${w.lead}`); };
    const ask=root.querySelector('[data-jiask]'), go=root.querySelector('[data-jigo]');
    if(ask&&go){ const send=()=>{ const v=ask.value.trim(); if(!v){ toast('Опишите задачу'); return; }
      if (rpgPhraseCheck(v)){ ask.value=''; return; }
      w.now=v; root.querySelector('[data-jinow]').textContent=v; ask.value='';
      pushAudit({ who:'Вы', what:`Задача «${w.name}»: ${v}`, verdict:'allow' });
      toast(`Задача принята: «${w.name}» вернёт результат черновиком руководителю`); };
      go.onclick=send; ask.onkeydown=e=>{ if(e.key==='Enter') send(); }; }
  }
  draw();
}

/* ═══════════════════════════════════════════════════════════════
   Конец федеративных рендереров
   ═══════════════════════════════════════════════════════════════ */

/* ========================================================================== */
/*  ЗОЛОТОЙ ПРОФИЛЬ СОТРУДНИКА — единая карточка из всех систем (суть EDP)    */
/* ========================================================================== */
const SURNAMES = ['Соколов','Орлов','Васильев','Морозов','Волков','Зайцев','Павлов','Семёнов','Голубев','Виноградов','Богданов','Воробьёв','Фёдоров','Михайлов','Беляев','Тарасов','Белов','Комаров','Киселёв','Ильин','Гусев','Титов','Кузьмин','Кудрявцев','Баранов'];
const TRANSLIT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
function translit(s){ return s.toLowerCase().split('').map(c=>TRANSLIT[c]!==undefined?TRANSLIT[c]:c).join(''); }
function strHash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function personIdxByName(dept, name){
  const t = COCKPITS[dept] && COCKPITS[dept].team; if (!t) return -1;
  return t.findIndex(x => (Array.isArray(x) ? x[0] : x.name) === name);
}
function personOf(dept, i){
  const cfg = COCKPITS[dept]; if(!cfg || !cfg.team[i]) return null;
  const t = cfg.team[i];
  const p = Array.isArray(t) ? {name:t[0],role:t[1],task:t[2],emoji:t[3],fn:t[4]} : {...t};
  const h = strHash(p.name + dept + p.role);
  const female = (p.emoji||'').indexOf('👩') >= 0;
  const surname = SURNAMES[h % SURNAMES.length] + (female ? 'а' : '');
  const isLead = p.fn==='Руководство' || /лид|директор|роп|cfo|hrd|тимлид|арт-директор|глав/i.test(p.role);
  const grade = isLead ? 'Lead' : ['Senior','Middle+','Middle','Senior'][h % 4];
  const lead = i===0 ? 'CEO · Кирилл' : (()=>{ const l=cfg.team[0]; const ln=Array.isArray(l)?l[0]:l.name; const lr=Array.isArray(l)?l[1]:l.role; return ln+' · '+lr; })();
  const tn = translit(p.name);
  return { ...p, dept, i, surname, female, grade, isLead, lead,
    tab: 'T-' + String(1000 + (h % 900)).slice(-4+1).padStart(4,'0'),
    hired: String(1 + (h % 12)).padStart(2,'0') + '.' + (2019 + (h % 6)),
    rating: (4.2 + (h % 8) / 10).toFixed(1),
    reviews: 12 + (h % 40),
    email: tn + '@avandok.ru', tg: '@' + tn + '_' + dept,
    phone: '+7 (9' + (10 + h % 90) + ') ' + (100 + h % 900) + '-' + (10 + h % 90) + '-' + (10 + (h >> 3) % 90),
    city: ['Москва','Санкт-Петербург','Казань','Екатеринбург'][h % 4],
    swarmTasks: 60 + (h % 90), autoOk: 55 + (h % 30),
    dsubs: (DIGITAL_STAFF[dept] || []).filter(w => w.lead.split(' · ')[0] === p.name),
    sw: swarmOf(p.role) };
}
const SRC = (s) => `<sup class="gp-src s-${s}">${({'1c':'1С','kedo':'КЭДО','sreda':'Среда','crm':'CRM','ats':'ATS','kteam':'K-TEAM'})[s]||s}</sup>`;
/* аватар человека: локальный портрет, если есть в манифесте, иначе инициалы */
function humanAv(dept, name, color, cls){
  const src = window.AVATARS && window.AVATARS[dept + ':' + name];
  if (src) return `<span class="gp-av ${cls||''} ph" style="--c:${color}"><img src="${src}" alt="${name}" loading="lazy"/></span>`;
  return `<span class="gp-av ${cls||''}" style="--c:${color}">${name[0]}</span>`;
}
function gpField(label, value, src){ return `<div class="gp-f"><span>${label}</span><b>${value}${src?SRC(src):''}</b></div>`; }
function initialsAv(name, surname, color, big){
  return `<span class="gp-av ${big?'big':''}" style="--c:${color}">${name[0]}${surname?surname[0]:''}</span>`;
}
function renderPersonProfile(root, dept, idx){
  const p = personOf(dept, +idx);
  const dep = DEPARTMENTS.find(x=>x.id===dept);
  if (!p){ root.innerHTML = workHead(dep||{icon:'👤',label:'Сотрудник'}, 'не найден') + '<div class="od-gov empty-note">Откройте штат отдела и выберите сотрудника.</div>'; return; }
  const c = DEPT_TASK[dept].c;
  const cfg = COCKPITS[dept];
  const M = cfg.metrics.slice(0,4).map(m=>Array.isArray(m)?{k:m[0],b:m[1],a:m[2]}:{k:m.k,b:m.before,a:m.after});
  const R = personRPG(dept, p), Q = questsOf(dept, p.name, p.task), load = loadOf(Q, R.lvl);
  const gateOpen = stepGate({role:dept}).gated;
  let tab = 'main';
  function draw(){
    root.innerHTML = `
    <div class="worker-profile animate-fade">
      <div class="worker-profile-header">
        <button class="worker-profile-back" id="ppBack">← Назад</button>
        <div class="worker-profile-title"><h1>Профиль сотрудника</h1><p>золотой профиль · данные собраны из всех систем компании</p></div>
      </div>
      <div class="gp-head">
        ${(window.AVATARS && window.AVATARS[dept+':'+p.name]) ? humanAv(dept, p.name, c, 'big') : initialsAv(p.name, p.surname, c, true)}
        <div class="gp-id">
          <h1>${p.name} ${p.surname}</h1>
          <p>${p.role} · ${dep.label} · функция «${p.fn||'Команда'}»</p>
          <div class="gp-badges">
            <span class="gp-bdg acc">${p.grade}</span>
            <span class="gp-bdg lvl">${LEX('lvlOf')(R.lvl)}</span>
            <span class="gp-bdg">${p.tab}</span>
            <span class="gp-bdg ok">● в штате</span>
            ${p.isLead?'<span class="gp-bdg">руководитель функции</span>':''}
          </div>
        </div>
        <div class="gp-rate">
          <b>${p.rating} <span class="gp-stars">★★★★★</span></b>
          <small>Индекс Среды · ${p.reviews} оценок работы с роем</small>
        </div>
      </div>
      <div class="gp-sources">
        ${['1С ЗУП','КЭДО','CRM / Jira','ATS','K-TEAM','Среда'].map(s=>`<span class="gp-sys"><i></i>${s}</span>`).join('')}
        <span class="gp-sys-note">профиль собран автоматически · у каждого поля — система-источник</span>
      </div>
      <div class="gp-tabs">
        ${[['main','Основное'],['rpg',LEX('skills')],['work','Трудовое'],['ai','Рой и ИИ'],['kpi','KPI'],['access','Доступы'],['act','Активность'],['docs','Документы']].map(t=>`<button class="gp-tab ${tab===t[0]?'on':''}" data-t="${t[0]}">${t[1]}</button>`).join('')}
      </div>
      <div class="gp-body">${body()}</div>
    </div>`;
    wire();
  }
  function body(){
    if (tab==='main') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>Основное</h2>
        ${gpField('Фамилия', p.surname, '1c')}${gpField('Имя', p.name, '1c')}
        ${gpField('Табельный номер', p.tab, '1c')}${gpField('Грейд', p.grade, 'kedo')}
        ${gpField('Отдел', dep.label, '1c')}${gpField('Функция', p.fn||'Команда', 'sreda')}
        ${gpField('Город · формат', p.city + ' · гибрид', 'kedo')}</div>
      <div class="panel gp-card"><h2>Контакты</h2>
        ${gpField('Телефон', p.phone, '1c')}${gpField('Email', p.email, 'kedo')}
        ${gpField('Telegram', p.tg, 'kteam')}${gpField('Рабочее место', 'Среда · кабинет «'+dep.label+'»', 'sreda')}
        <div class="gp-actions"><button class="btn ghost" data-go-ch>Написать в канал отдела</button><button class="btn ghost" data-go-team>Открыть штат отдела</button></div></div>
    </div>`;
    if (tab==='rpg') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card hc">
        <h2>${LEX('skills')} <span class="tag">${LEX('lvlOf')(R.lvl)} · ${RPG_LVL_LBL[R.lvl]}</span></h2>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('load')}</span><b>${load}/100 · ${Q.length} в работе</b></div>${rpgBar(load, load>82?'hot':'')}</div>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('skills')}</span></div>
          ${R.sk.map(s=>`<div class="hc-skill"><span>${s[0]}</span>${rpgDots(s[1])}<b>${s[1]}/10</b></div>`).join('')}</div>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('quests')}</span></div>
          ${Q.map(q=>{ const blocked=q.gate&&gateOpen; return `<div class="hc-q"><div class="hc-q-t"><b>${q.id?q.id+' · ':''}${q.t}</b><i class="${blocked?'q-bad':q.prog>75?'q-ok':'q-mid'}">${blocked?'⛔ гейт: sev1-риск':q.col}</i></div>${rpgBar(q.prog, blocked?'bad':q.prog>75?'ok':'')}</div>`; }).join('')}</div>
        <div class="hc-sec"><div class="hc-lab"><span>${LEX('ach')}</span></div>
          ${R.ach.map(a=>`<div class="hc-ach">🏆 ${a}</div>`).join('')}</div>
      </div>
      <div class="panel ji-card"><h2>Должностная инструкция <span class="tag">как у цифровых — у людей тоже есть</span></h2>
        <div class="ji-sec"><b>${LEX('mission')}</b><p>${R.mi}</p></div>
        <div class="ji-sec"><b>Обязанности</b><ul>${R.du.map(x=>`<li>${x}</li>`).join('')}</ul></div>
        <div class="ji-sec lim"><b>${LEX('limits')}</b><ul>${R.li.map(x=>`<li>${x}</li>`).join('')}</ul></div>
        <div class="ji-sec esc"><b>Эскалация</b><p>${R.esc}</p></div>
        <div class="od-gov" style="margin-top:9px">Симметрия с цифровым штатом: у каждого человека — та же структура инструкции (миссия · обязанности · границы · эскалация). Источник: КЭДО + Среда.</div>
      </div>
    </div>`;
    if (tab==='work') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>Трудовые данные</h2>
        ${gpField('Должность', p.role, '1c')}${gpField('Грейд', p.grade, 'kedo')}
        ${gpField('Руководитель', p.lead, 'sreda')}${gpField('В компании с', p.hired, '1c')}
        ${gpField('Занятость', 'полная · 40 ч/нед', '1c')}${gpField('Текущий фокус', p.task, 'sreda')}</div>
      <div class="panel gp-card"><h2>Конверт полномочий</h2>
        ${gpField('Уровень в Среде', p.isLead?'Руководитель — утверждает за команду':'Специалист — принимает результат сам', 'sreda')}
        ${gpField('Лимит без апрува', p.isLead?'₽5 000 / задача':'₽500 / задача', 'sreda')}
        ${gpField('Необратимые действия', 'только через человека', 'sreda')}
        <div class="od-gov" style="margin-top:9px">Полномочия растут с доверием: чем больше принятых работ, тем длиннее поводок роя. Всё в аудите.</div></div>
    </div>`;
    if (tab==='ai') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>Личный рой под должность <span class="tag">${p.sw.a.length}</span></h2>
        <div class="rc-duty"><b>Должностная зона:</b> ${p.sw.d}</div>
        <div class="rc-swarm" style="margin-top:9px">${p.sw.a.map(a=>`<div class="rc-a">${a}</div>`).join('')}</div>
        <div class="ji-ask" style="margin-top:11px"><input type="text" placeholder="Поставить задачу рою…" data-ppask/><button class="btn go" data-ppgo>→</button></div></div>
      <div class="panel gp-card"><h2>Цифровые подчинённые <span class="tag">${p.dsubs.length}</span></h2>
        ${p.dsubs.length ? p.dsubs.map(w=>`<div class="aib-top" data-wgo="${w.id}" style="cursor:pointer"><span class="wf-av">${w.emoji}</span><div><b>${w.name} <i class="dgt-tag">цифровой</i></b><small>${w.title} · сейчас: ${w.now}</small></div><span class="gp-bdg ok">●</span></div>`).join('')
          : '<div class="od-gov">Прямых цифровых подчинённых нет — работает с роем и общими цифровыми сотрудниками команды.</div>'}
        ${gpField('Задач через рой', p.swarmTasks+' / нед', 'sreda')}${gpField('Принято с 1-й подачи', p.autoOk+'%', 'sreda')}</div>
    </div>`;
    if (tab==='kpi') return `<div class="panel gp-card"><h2>KPI должности · было → стало со Средой</h2>
      <div class="dev-metrics" style="grid-template-columns:repeat(${M.length},1fr);margin-top:6px">${M.map(m=>`<div class="dm"><span>${m.k}</span><div class="dm-v"><s>${m.b}</s><b>${m.a}</b></div></div>`).join('')}</div>
      <div class="two-col" style="margin-top:12px">
        <div>${gpField('Задач закрыто за месяц', String(40+strHash(p.name)%80), 'sreda')}${gpField('Экономия времени', (8+strHash(p.name)%14)+' ч/нед', 'sreda')}</div>
        <div>${gpField('Эскалаций от роя', (strHash(p.name)%5)+' за месяц', 'sreda')}${gpField('Индекс Среды', p.rating+' / 5', 'sreda')}</div>
      </div></div>`;
    if (tab==='access') return `<div class="two-col" style="align-items:start">
      <div class="panel gp-card"><h2>Доступ к данным компании</h2>
        ${RBAC_MATRIX.filter(r=>r.dept===dep.label||r.dept===cfg.role).length
          ? RBAC_MATRIX.filter(r=>r.dept===dep.label||r.dept===cfg.role).map(r=>RBAC_DOMAINS.map((d2,j)=>gpField(d2, r.cells[j]?'✓ доступ открыт':'✕ закрыто', 'sreda')).join('')).join('')
          : RBAC_DOMAINS.map((d2,j)=>gpField(d2, j<2?'✓ доступ открыт':'✕ закрыто', 'sreda')).join('')}
        <div class="od-gov" style="margin-top:9px">Права наследуются ролью и уровнем — рой видит ровно то же, что и человек. Ни больше.</div></div>
      <div class="panel gp-card"><h2>Системы</h2>
        ${gpField('1С ЗУП', '● синхронизировано', '1c')}${gpField('КЭДО', '● подписи актуальны', 'kedo')}
        ${gpField('CRM / Jira', '● подключено', 'crm')}${gpField('Среда', '● ассистент активен', 'sreda')}</div>
    </div>`;
    if (tab==='act'){ const L=DEPT_TASK[dept].l;
      return `<div class="panel gp-card"><h2>Лента активности <span class="tag">аудит · всё прозрачно</span></h2>
      <div class="worker-profile-logs">${[0,1,2,3,4].map(k=>`<div class="worker-profile-log">
        <span class="worker-profile-log-time">сегодня ${9+k}:${String((13*(k+2))%60).padStart(2,'0')}</span>
        <span class="worker-profile-log-action">${['Принял черновик роя','Поправил руками','Передал дальше','Утвердил работу','Поставил задачу рою'][k]}</span>
        <span class="worker-profile-log-detail">${L[k%L.length]}</span></div>`).join('')}</div></div>`; }
    if (tab==='docs') return `<div class="panel gp-card"><h2>Документы <span class="tag">КЭДО · всё подписано</span></h2>
      ${[['Трудовой договор','подписан · '+p.hired],['Должностная инструкция','версия 2.1 · актуальна'],['NDA и режим коммерческой тайны','подписан'],['Согласие на обработку ПДн','подписано'],['План развития на год','согласован с '+p.lead.split(' · ')[0]]].map(d3=>`
        <div class="gp-doc"><div><b>${d3[0]}</b><small>${d3[1]}</small></div><button class="btn ghost" data-doc="${d3[0]}">Открыть</button></div>`).join('')}</div>`;
    return '';
  }
  function wire(){
    $('#ppBack',root).onclick=()=>goBack('team:'+dept);
    root.querySelectorAll('.gp-tab').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; draw(); });
    root.querySelectorAll('[data-wgo]').forEach(b=>b.onclick=()=>navTo('worker:'+b.dataset.wgo));
    const ch=root.querySelector('[data-go-ch]'); if(ch) ch.onclick=()=>navTo('channel:'+dept);
    const tm=root.querySelector('[data-go-team]'); if(tm) tm.onclick=()=>navTo('team:'+dept);
    root.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>toast(`«${b.dataset.doc}» — открыт из КЭДО`));
    const ask=root.querySelector('[data-ppask]'), go=root.querySelector('[data-ppgo]');
    if(ask&&go){ const send=()=>{ const v=ask.value.trim(); if(!v){ toast('Опишите задачу'); return; }
      if (rpgPhraseCheck(v)){ ask.value=''; return; } ask.value='';
      pushAudit({ who:p.name+' '+p.surname, emoji:'👤', act:'поставил(а) задачу рою: '+v, dept:dep.label });
      toast(`Рой принял задачу — черновик вернётся на проверку: ${p.name}`); };
      go.onclick=send; ask.onkeydown=e=>{ if(e.key==='Enter') send(); }; }
  }
  draw();
}

/* ========================================================================== */
/*  СГЕНЕРИРОВАННЫЕ ПРОФИЛИ — рядовой штат из «Пульса». Личность детерминирована */
/*  (people-gen.js), вёрстка — родная (.worker-profile/.gp-head/gpField).        */
/*  Цвет бинарный: человек #60a5fa, цифровой #36c994. Подаётся честно: рядовой   */
/*  сотрудник штата, без громких достижений уровня featured.                    */
/* ========================================================================== */
const GEN_HUMAN_C = '#60a5fa', GEN_DIGIT_C = '#36c994';

function renderGenPerson(root, dept, idx){
  const dep = DEPARTMENTS.find(x=>x.id===dept) || {icon:'👤',label:dept};
  if (typeof genPerson !== 'function'){ root.innerHTML = workHead(dep,'профиль недоступен')+'<div class="od-gov empty-note">Генератор личностей не загружен.</div>'; return; }
  const p = genPerson(dept, +idx);
  const c = GEN_HUMAN_C;
  const back = ()=>goBack('dpulse:'+dept);
  root.innerHTML = `
    <div class="worker-profile animate-fade">
      <div class="worker-profile-header">
        <button class="worker-profile-back" id="gpBack">← Назад</button>
        <div class="worker-profile-title"><h1>Профиль сотрудника</h1><p>рядовой состав штата · профиль собран автоматически</p></div>
      </div>
      <div class="gp-head">
        ${initialsAv(p.name, p.surname, c, true)}
        <div class="gp-id">
          <h1>${p.name} ${p.surname}</h1>
          <p>${p.role} · ${dep.label} · функция «${p.fn}»</p>
          <div class="gp-badges">
            <span class="gp-bdg acc">${p.grade}</span>
            <span class="gp-bdg lvl">${LEX('lvlOf')(p.lvl)}</span>
            <span class="gp-bdg ok">● в штате</span>
          </div>
        </div>
        <div class="gp-rate">
          <b>${p.rating} <span class="gp-stars">★★★★★</span></b>
          <small>Индекс Среды · рядовой состав</small>
        </div>
      </div>
      <div class="gp-sources">
        ${['1С ЗУП','КЭДО','Среда'].map(s=>`<span class="gp-sys"><i></i>${s}</span>`).join('')}
        <span class="gp-sys-note">профиль штатной единицы · собран автоматически из систем компании</span>
      </div>
      <div class="two-col" style="align-items:start">
        <div class="panel gp-card"><h2>Основное</h2>
          ${gpField('Имя', p.name, '1c')}${gpField('Фамилия', p.surname, '1c')}
          ${gpField('Должность', p.role, '1c')}${gpField('Грейд', p.grade+' · '+RPG_LVL_LBL[p.lvl], 'kedo')}
          ${gpField('Отдел', dep.label, '1c')}${gpField('Функция', p.fn, 'sreda')}
          ${gpField('Руководитель', p.lead, 'sreda')}${gpField('В компании с', p.hired, '1c')}
          ${gpField('Текущий фокус', p.now, 'sreda')}
          <div class="gp-actions"><button class="btn ghost" data-go-team>Открыть штат отдела</button><button class="btn ghost" data-go-pulse>← В пульс отдела</button></div>
        </div>
        <div class="panel gp-card hc"><h2>${LEX('skills')} <span class="tag">${LEX('lvlOf')(p.lvl)}</span></h2>
          <div class="hc-sec"><div class="hc-lab"><span>${LEX('skills')}</span></div>
            ${p.skills.map(s=>`<div class="hc-skill"><span>${s.name}</span>${rpgDots(s.level)}<b>${s.level}/10</b></div>`).join('')}</div>
          <div class="ji-sec esc" style="margin-top:9px"><b>Конверт полномочий</b><p>Специалист — принимает результат сам, лимит без апрува ₽500 / задача. Необратимые действия — только через руководителя.</p></div>
          <div class="od-gov" style="margin-top:9px">Рядовая штатная единица отдела «${dep.label}». Грейд, навыки и текущая задача — из систем компании; профиль такой же, как у именных коллег.</div>
        </div>
      </div>
    </div>`;
  $('#gpBack',root).onclick = back;
  const tm=root.querySelector('[data-go-team]'); if(tm) tm.onclick=()=>navTo('team:'+dept);
  const pl=root.querySelector('[data-go-pulse]'); if(pl) pl.onclick=()=>navTo('dpulse:'+dept);
}

function renderGenWorker(root, dept, idx){
  const dep = DEPARTMENTS.find(x=>x.id===dept) || {icon:'🤖',label:dept};
  if (typeof genWorker !== 'function'){ root.innerHTML = workHead(dep,'профиль недоступен')+'<div class="od-gov empty-note">Генератор личностей не загружен.</div>'; return; }
  const w = genWorker(dept, +idx);
  const c = GEN_DIGIT_C;
  const back = ()=>goBack('dpulse:'+dept);
  const mName = (typeof MODELS!=='undefined' && MODELS[w.model]) ? MODELS[w.model].name : w.model;
  root.innerHTML = `
    <div class="worker-profile animate-fade">
      <div class="worker-profile-header">
        <button class="worker-profile-back" id="gwBack">← Назад</button>
        <div class="worker-profile-title"><h1>Профиль цифрового сотрудника</h1><p>рядовой состав цифрового штата · должностная инструкция и навыки</p></div>
      </div>
      <div class="gp-head">
        <span class="gp-av big dgt" style="--c:${c}">${w.emoji}</span>
        <div class="gp-id">
          <h1>${w.name} <i class="dgt-tag">цифровой сотрудник</i></h1>
          <p>${w.title} · ${dep.label} · функция «${w.fn}»</p>
          <div class="gp-badges">
            <span class="gp-bdg">${w.id}</span>
            ${typeof modelBadge==='function'?modelBadge(w.model):`<span class="gp-bdg">${mName}</span>`}
            <span class="gp-bdg ok">● активен</span>
          </div>
        </div>
        <div class="gp-rate">
          <b>в штате</b>
          <small>цифровая единица · подотчётен человеку</small>
        </div>
      </div>
      <div class="gp-sources">
        ${['Среда · Студия','Маршрутизатор','Аудит'].map(s=>`<span class="gp-sys"><i></i>${s}</span>`).join('')}
        <span class="gp-sys-note">подотчётен: <b style="color:var(--txt)">${w.lead}</b></span>
      </div>
      <div class="two-col" style="align-items:start">
        <div class="panel ji-card"><h2>Должностная инструкция</h2>
          <div class="ji-sec"><b>Миссия</b><p>${w.ji.mission}</p></div>
          <div class="ji-sec"><b>Обязанности</b><ul>${w.ji.duties.map(x=>`<li>${x}</li>`).join('')}</ul></div>
          <div class="ji-sec lim"><b>Границы (что запрещено)</b><ul>${w.ji.limits.map(x=>`<li>⛔ ${x}</li>`).join('')}</ul></div>
          <div class="ji-sec esc"><b>Эскалация человеку</b><p>${w.ji.esc}</p></div>
        </div>
        <div class="panel gp-card hc"><h2>Навыки и подчинение</h2>
          <div class="hc-sec"><div class="hc-lab"><span>Навыки</span></div>
            ${w.skills.map(s=>`<div class="hc-skill"><span>${s.name}</span>${rpgDots(s.level)}<b>${s.level}/10</b></div>`).join('')}</div>
          ${gpField('Руководитель', w.lead, 'sreda')}
          ${gpField('Отдел', dep.label, 'sreda')}
          ${gpField('Функция', w.fn, 'sreda')}
          ${gpField('Модель', mName, 'sreda')}
          ${gpField('Сейчас в работе', w.now, 'sreda')}
          ${w.ji.kpi.map(k=>gpField(k[0], k[1], 'sreda')).join('')}
          <div class="gp-actions"><button class="btn ghost" data-go-pulse>← В пульс отдела</button></div>
          <div class="od-gov" style="margin-top:9px">Рядовая цифровая единица штата «${dep.label}». Каждый результат — черновик человеку; права не шире периметра отдела.</div>
        </div>
      </div>
    </div>`;
  $('#gwBack',root).onclick = back;
  const pl=root.querySelector('[data-go-pulse]'); if(pl) pl.onclick=()=>navTo('dpulse:'+dept);
}

/* ========================================================================== */
/*  БЮДЖЕТЫ ИИ — владелец платформы управляет деньгами Среды                  */
/* ========================================================================== */
function aiBudgetStore(){
  if(!window.__AIBUDGET){
    const spentPct = { dev:.78, sales:.62, marketing:.71, design:.55, analytics:.66, hr:.48, finance:.59, legal:.52 };
    window.__AIBUDGET = { policies:{ approve500:true, localPII:true, nightPause:false },
      depts:Object.fromEntries(ROLE_IDS.map(r=>{ const lim=Math.round(DIGITAL_HEADCOUNT[r]*420/10)*10;
        return [r, { limit:lim, spent:Math.round(lim*spentPct[r]) }]; })) };
  }
  return window.__AIBUDGET;
}
function renderAIBudgets(root){
  const S = aiBudgetStore();
  const d = { icon:'💰', label:'Бюджеты ИИ' };
  function draw(){
    const totalLim = ROLE_IDS.reduce((a,r)=>a+S.depts[r].limit,0);
    const totalSp = ROLE_IDS.reduce((a,r)=>a+S.depts[r].spent,0);
    root.innerHTML = workHead(d, `Деньги Среды под контролем: лимиты по отделам, политики расхода, топ потребителей`) + `
      <div class="grid-kpi" style="margin-bottom:13px">
        <div class="kpi"><div class="l">Дневной лимит компании</div><div class="v">₽${totalLim.toLocaleString('ru')}</div><div class="d flat">● сумма лимитов отделов</div></div>
        <div class="kpi"><div class="l">Потрачено сегодня</div><div class="v">₽${totalSp.toLocaleString('ru')}</div><div class="d ${totalSp/totalLim>0.85?'down':'up'}">${Math.round(totalSp/totalLim*100)}% от лимита</div></div>
        <div class="kpi"><div class="l">За неделю</div><div class="v">₽184k</div><div class="d up">▲ −8% при +22% задач</div></div>
        <div class="kpi"><div class="l">Стоимость часа экономии</div><div class="v">₽47</div><div class="d up">▲ против ₽1 900 у людей</div></div>
      </div>
      <div class="two-col" style="align-items:start">
        <div class="panel">
          <h2>🏛️ Лимиты по отделам <span class="tag">введите новый лимит — система пересчитает</span></h2>
          ${ROLE_IDS.map(r=>{ const dep=DEPARTMENTS.find(x=>x.id===r); const b=S.depts[r]; const pct=Math.min(100,Math.round(b.spent/b.limit*100));
            return `<div class="aib-row" data-r="${r}">
              <div class="aib-h"><b>${dep.icon} ${dep.label}</b><span class="aib-sp">₽${b.spent.toLocaleString('ru')} из</span>
                <span class="aib-edit">₽<input type="text" value="${b.limit.toLocaleString('ru')}" data-lim="${r}" /></span><span class="aib-sp">/день</span></div>
              <div class="track"><div class="fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>75?'var(--amber)':'var(--acc)'}"></div></div>
            </div>`; }).join('')}
          <div class="od-gov" style="margin-top:10px">Лимит — жёсткая граница: при достижении цифровые сотрудники отдела встают на паузу, задачи возвращаются людям, CEO получает уведомление.</div>
        </div>
        <div class="panel">
          <h2>⚖️ Политики расхода <span class="tag">переключатели живые</span></h2>
          <div class="aib-pol" data-pol="approve500"><div><b>Апрув человека дороже ₽500/задача</b><small>дорогие прогоны — только с подтверждением</small></div><span class="aib-sw ${S.policies.approve500?'on':''}"></span></div>
          <div class="aib-pol" data-pol="localPII"><div><b>ПДн — только локальные модели</b><small>HR и персональные данные не покидают периметр</small></div><span class="aib-sw ${S.policies.localPII?'on':''}"></span></div>
          <div class="aib-pol" data-pol="nightPause"><div><b>Ночная пауза 01:00–06:00</b><small>фоновые рои останавливаются ночью</small></div><span class="aib-sw ${S.policies.nightPause?'on':''}"></span></div>
          <h2 style="margin-top:14px">🔥 Топ-5 потребителей сегодня</h2>
          ${ALL_DIGITAL.slice().map((w,i)=>({w,sp:[1840,1620,1390,1180,950][i%5]+((i*37)%120)})).sort((a,b)=>b.sp-a.sp).slice(0,5).map(({w,sp})=>`
            <div class="aib-top"><span class="wf-av">${w.emoji}</span><div><b>${w.name}</b><small>${w.title} · ${DEPARTMENTS.find(x=>x.id===w.dept).label}</small></div>
              <b class="aib-cost">₽${sp.toLocaleString('ru')}</b><button class="btn ghost" data-wprof="${w.id}">профиль</button></div>`).join('')}
          <div class="od-gov" style="margin-top:10px">Каждый рубль привязан к цифровому сотруднику, задаче и модели — детали в Аудите и Маршрутизаторе.</div>
        </div>
      </div>`;
    root.querySelectorAll('[data-lim]').forEach(inp=>{
      inp.onchange=()=>{ const r=inp.dataset.lim; const v=parseInt(inp.value.replace(/\D/g,''),10);
        if(!v||v<1000){ toast('Лимит не может быть ниже ₽1 000'); inp.value=S.depts[r].limit.toLocaleString('ru'); return; }
        S.depts[r].limit=v;
        pushAudit({ who:'Владелец платформы', what:`Изменён дневной лимит ИИ «${DEPARTMENTS.find(x=>x.id===r).label}» → ₽${v.toLocaleString('ru')}`, verdict:'allow' });
        toast(`Лимит «${DEPARTMENTS.find(x=>x.id===r).label}» обновлён`); draw(); };
    });
    root.querySelectorAll('.aib-pol').forEach(p=>{ p.onclick=()=>{ const k=p.dataset.pol; S.policies[k]=!S.policies[k];
      pushAudit({ who:'Владелец платформы', what:`Политика «${p.querySelector('b').textContent}» → ${S.policies[k]?'ВКЛ':'ВЫКЛ'}`, verdict:'allow' });
      toast(S.policies[k]?'Политика включена':'Политика выключена'); draw(); }; });
    root.querySelectorAll('[data-wprof]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.wprof); });
  }
  draw();
}

/* ========================================================================== */
/*  ПЛАТФОРМА СРЕДЫ — внешний контур: Цифровой найм (Talent) и                 */
/*  Цифровое производство (Forge). Смотрим глазами CEO Кирилла: Авандок        */
/*  уже живёт в Inside, отсюда нанимает «жидкость» и заказывает «газ».         */
/* ========================================================================== */
function portalHead(icon, label, sub, phase){
  return `<div class="work-head portal"><div class="ico">${icon}</div><div style="flex:1">
    <h1>${label} <span class="ph-tag">${phase}</span></h1><p>${sub}</p></div>
    <span class="badge out"><span class="dot"></span>Платформа Среды · внешний контур</span></div>`;
}
const tlColor = (a) => DEPT_TASK[TL_ROLES[a.role].dept].c;
/* внешний контур: клиент пользуется Наймом/Производством БЕЗ Inside */
function isExtWS(){ return state.ws === 'platform'; }
function insideUpsell(){
  return `<div class="od-gov" style="margin-top:9px;border-color:rgba(54,201,148,.35)">Сейчас агент работает <b>в ваших каналах</b> (почта · Slack · Telegram) — без внедрения. С <b>Inside</b> он встанет в нервную систему компании: пульс, команды, гейты, governance. <a href="#pulse" style="color:var(--acc)">Посмотреть Inside →</a></div>`;
}
function hexAv(a, big){ return `<span class="hex-av ${big?'big':''}" style="--c:${tlColor(a)}">${a.name[0]}</span>`; }
function tlStars(r){ return '★'.repeat(Math.round(r)) + '<i>' + r.toFixed(1) + '</i>'; }
function tlPassportHTML(a){
  const IC = { forge:'🏭', talent:'🌊', inside:'🧊' };
  const LBL = { forge:'Forge · производство', talent:'Talent · контракт', inside:'Inside · кристаллизация' };
  return `<div class="pp-line">${a.passport.map(p=>`<div class="pp-step ph-${p[0]}"><i>${IC[p[0]]}</i><div><b>${LBL[p[0]]}</b><small>${p[1]} · ${p[2]}</small></div></div>`).join('<span class="pp-arr">→</span>')}</div>
  <div class="od-gov" style="margin-top:8px">Паспорт переносится между фазами целиком. Из чужих компаний — только <b>обезличенные навыки</b>: паттерны и практики, никогда — данные.</div>`;
}

function renderTalent(root){
  const cat = talentCatalog();
  const S = talentStore();
  let fRole = '', fQ = '', tail = 24;
  function draw(){
    const hired = S.hired.filter(h=>h.status==='active');
    const feat = cat.filter(a=>a.featured && (!fRole||a.role===fRole) && (!fQ||a.name.toLowerCase().includes(fQ)||TL_ROLES[a.role].label.toLowerCase().includes(fQ)));
    const rest = cat.filter(a=>!a.featured && (!fRole||a.role===fRole) && (!fQ||a.name.toLowerCase().includes(fQ)||TL_ROLES[a.role].label.toLowerCase().includes(fQ)));
    root.innerHTML = portalHead('🌊','Цифровой найм', 'Рынок труда агентов Среды: проверенная репутация, старт за 4 минуты, оплата за результат или подписка','фаза «жидкость»') + `
    <div class="grid-kpi" style="margin-bottom:13px">
      <div class="kpi"><div class="l">Агентов в пуле</div><div class="v">${cat.length}</div><div class="d up">▲ 8 ролей · все с верифицированной историей</div></div>
      <div class="kpi"><div class="l">Средний рейтинг</div><div class="v">${(cat.reduce((x,a)=>x+a.rating,0)/cat.length).toFixed(2)}★</div><div class="d up">двусторонние отзывы</div></div>
      <div class="kpi"><div class="l">Старт работы</div><div class="v">4 мин</div><div class="d up">договор · почта · доступы · канал</div></div>
      <div class="kpi"><div class="l">У вас на контрактах</div><div class="v">${hired.length}</div><div class="d flat">● в командах Среды</div></div>
    </div>
    ${hired.length?`<div class="panel" style="margin-bottom:13px"><h2>🤝 Ваши контракты <span class="tag">контактная поверхность</span></h2>
      ${hired.map(h=>{ const a=talentAgent(h.aid); return `<div class="tl-row" data-go="${a.id}">${hexAv(a)}<div><b>${a.name} <i class="dgt-tag tl">агент Среды</i></b><small>${TL_ROLES[a.role].label} · ${roleLabel(h.dept)} · ${h.sinceLbl} · принято результатов: ${h.accepted}</small></div><span class="gp-bdg acc">${h.mode==='staff'?'в штате':'за результат'}</span><span class="dp-swarm prof">контракт →</span></div>`; }).join('')}</div>`:''}
    <div class="workforce-filters">
      <input type="text" class="workforce-search" placeholder="Поиск: имя, роль…" id="tlQ" value="${fQ}"/>
      <select class="workforce-filter" id="tlRole"><option value="">Все роли</option>
        ${Object.keys(TL_ROLES).map(r=>`<option value="${r}" ${fRole===r?'selected':''}>${TL_ROLES[r].icon} ${TL_ROLES[r].label}</option>`).join('')}</select>
      <span class="od-gov" style="margin:0">Карточка → собеседование с живым тестовым → найм. Как с человеком, только быстрее.</span>
    </div>
    <div class="tl-grid">
      ${(!feat.length && window.__API_LOADING) ? skeletonCards(6,'tl-card') : ''}
      ${feat.map(a=>`<div class="tl-card" data-go="${a.id}">
        <div class="tl-h">${hexAv(a)}<div><b>${a.name}</b><small>${TL_ROLES[a.role].icon} ${TL_ROLES[a.role].label} · ${a.grade}</small></div><span class="tl-rate">${tlStars(a.rating)}</span></div>
        <div class="tl-doms">${a.domains.slice(0,1).map(d=>`<span>${d}</span>`).join('')}${a.domains.length>1?`<span>+${a.domains.length-1} ${a.domains.length-1===1?'домен':'доменов'}</span>`:''}</div>
        <div class="tl-price"><b>₽${a.priceTask.toLocaleString('ru')}</b><small>за результат</small><b>₽${a.priceMonth.toLocaleString('ru')}</b><small>в штат / мес</small></div>
      </div>`).join('')}
    </div>
    <div class="panel" style="margin-top:13px"><h2>Полный пул <span class="tag">${rest.length} агентов · репутация верифицирована</span></h2>
      <div class="tl-tail">${rest.slice(0,tail).map(a=>`<div class="tl-row" data-go="${a.id}">${hexAv(a)}<div><b>${a.name}</b><small>${TL_ROLES[a.role].label} · ${a.grade} · ${a.domains[0]}</small></div><span class="tl-rate sm">${a.rating}★</span><span class="tl-sm">${a.done} задач</span><span class="tl-sm">₽${a.priceTask.toLocaleString('ru')}/рез</span></div>`).join('')}</div>
      ${rest.length>tail?`<button class="btn ghost" id="tlMore" style="margin-top:9px">Показать ещё ${Math.min(30,rest.length-tail)} из ${rest.length-tail}</button>`:''}
    </div>`;
    root.querySelectorAll('[data-go]').forEach(c=>c.onclick=()=>navTo('tagent:'+c.dataset.go));
    $('#tlRole',root).onchange=e=>{ fRole=e.target.value; draw(); };
    $('#tlQ',root).oninput=e=>{ fQ=e.target.value.toLowerCase().trim(); draw(); };
    const m=$('#tlMore',root); if(m) m.onclick=()=>{ tail+=30; draw(); };
  }
  draw();
}

function renderTalentAgent(root, id){
  const a = talentAgent(id);
  if(!a){ root.innerHTML = portalHead('🌊','Агент не найден','Вернитесь в каталог','Talent'); return; }
  const R = TL_ROLES[a.role];
  let view = 'profile';                       /* profile | interview */
  let iv = { step:0 };                        /* собеседование */
  function contract(){ return tlContractOf(a.id); }
  function draw(){
    const c = contract();
    root.innerHTML = portalHead('🌊','Карточка агента','Трудовая история верифицирована Средой · собеседование и найм — как с человеком','фаза «жидкость»') + `
    <button class="worker-profile-back" id="taBack">← В каталог</button>
    <div class="gp-head" style="margin-top:10px">
      ${hexAv(a,true)}
      <div class="gp-id"><h1>${a.name} <i class="dgt-tag tl">агент Среды</i></h1>
        <p>${R.icon} ${R.label} · ${a.grade} · паспорт ${tlPassId(a)}</p>
        <div class="gp-badges"><span class="gp-bdg acc">${a.rating}★ · ${a.done} задач</span><span class="gp-bdg">приёмка без правок ${a.acc}%</span>${c?'<span class="gp-bdg ok">● у вас на контракте</span>':'<span class="gp-bdg">в пуле · старт 4 мин</span>'}</div></div>
      <div class="gp-rate"><b>₽${a.priceTask.toLocaleString('ru')}</b><small>за результат · ₽${a.priceMonth.toLocaleString('ru')}/мес в штат</small></div>
    </div>
    ${view==='interview' ? ivHTML() : profHTML(c)}`;
    wire();
  }
  function profHTML(c){
    return `<div class="two-col" style="align-items:start;margin-top:12px">
      <div>
        <div class="panel"><h2>Компетенции и домены</h2>
          ${a.spells.map(s=>`<div class="hc-spell"><span>${s[0]}</span>${rpgStars(s[1])}</div>`).join('')}
          <div class="tl-doms" style="margin-top:8px">${a.domains.map(d=>`<span>${d}</span>`).join('')}</div>
          <div class="tl-cmp"><div><b>Человек на эту роль</b><small>${R.human}</small></div><div class="ok"><b>Этот агент</b><small>${R.agent}</small></div></div>
        </div>
        ${a.folio.length?`<div class="panel" style="margin-top:12px"><h2>Портфолио <span class="tag">${a.done} задач всего</span></h2>
          ${a.folio.map(f=>`<div class="tl-folio"><b>${f[0]}</b><small>${f[1]}</small><span>${f[2]}</span></div>`).join('')}</div>`:''}
        ${a.reviews.length?`<div class="panel" style="margin-top:12px"><h2>Отзывы заказчиков</h2>
          ${a.reviews.map(r=>`<div class="tl-rev"><b>${r[0]}</b><p>«${r[1]}»</p></div>`).join('')}</div>`:''}
      </div>
      <div>
        ${c?contractHTML(c):hireHTML()}
        <div class="panel" style="margin-top:12px"><h2>🛂 Паспорт агента <span class="tag">фазы Среды</span></h2>${tlPassportHTML(a)}</div>
      </div>
    </div>`;
  }
  function hireHTML(){
    return `<div class="panel tl-hire"><h2>Найм</h2>
      <button class="btn go" id="taIv" style="width:100%">🎙 Провести собеседование (живое тестовое)</button>
      ${isExtWS()?'<div class="od-gov" style="margin-top:8px">Без Inside: агент придёт в <b>ваши каналы</b> — Slack, почта, Telegram. Никакого внедрения.</div>'
        :`<div class="tl-hire-row"><select class="workforce-filter" id="taDept">${ROLE_IDS.map(r=>`<option value="${r}" ${r===R.dept?'selected':''}>${roleLabel(r)}</option>`).join('')}</select></div>`}
      <div class="tl-hire-row"><button class="btn ghost" id="taStaff">Нанять в штат · ₽${a.priceMonth.toLocaleString('ru')}/мес</button>
      <button class="btn ghost" id="taTask">Под результат · от ₽${a.priceTask.toLocaleString('ru')}</button></div>
      <div id="taHireFlow"></div>
      <div class="od-gov" style="margin-top:9px">Контактная поверхность: агент получит ровно столько контекста, сколько нужно для задач, — и не байтом больше. Витрины отдела: 2 из 6.</div></div>`;
  }
  function contractHTML(c){
    return `<div class="panel tl-hire on"><h2>Контракт <span class="tag">${c.mode==='staff'?'подписка':'оплата за результат'}</span></h2>
      ${gpField('Отдел', roleLabel(c.dept), 'sreda')}${gpField('Статус', c.sinceLbl + ' · принято результатов: ' + c.accepted, 'sreda')}
      ${gpField('Периметр данных', 'витрины отдела: 2 из 6 · JIT-доступ', 'sreda')}
      ${gpField('Ставка', c.mode==='staff' ? '₽'+a.priceMonth.toLocaleString('ru')+'/мес' : '₽'+a.priceTask.toLocaleString('ru')+' за принятый результат', 'sreda')}
      <div class="ji-ask" style="margin-top:9px"><input type="text" placeholder="Задача для «${a.name.split(' ')[0]}»…" id="taAsk"/><button class="btn go" id="taGo">→</button></div>
      <div id="taTaskFlow"></div>
      ${isExtWS()
        ?`<div class="tl-hire-row" style="margin-top:9px"><button class="btn ghost" id="taEnd">Завершить контракт</button></div>${insideUpsell()}`
        :`<div class="tl-hire-row" style="margin-top:9px">
        <button class="btn ghost" id="taTeam">Открыть команду отдела →</button>
        <button class="btn ghost" id="taEnd">Завершить контракт</button></div>
      <button class="btn go" id="taCryst" style="width:100%;margin-top:8px">🧊 Кристаллизовать в Inside — в постоянный штат</button>
      <div class="od-gov" style="margin-top:8px">Кристаллизация: контракт закрывается, агент получает полную должностную инструкцию, governance и бюджеты компании. Паспорт переносится целиком.</div>`}</div>`;
  }
  /* — собеседование: уточняющий вопрос → решение стримом → вердикт — */
  function ivHTML(){
    const T = TL_TESTS[a.role];
    return `<div class="panel iv" style="margin-top:12px"><h2>🎙 Собеседование · живое тестовое <span class="tag">${R.label}</span></h2>
      <div class="iv-task"><b>Задание из библиотеки Среды</b><p>${T.t}</p></div>
      <div class="iv-thread" id="ivThread"></div>
      <div class="iv-actions" id="ivActions"></div>
    </div>`;
  }
  function ivRun(){
    const T = TL_TESTS[a.role];
    const th = $('#ivThread',root), act = $('#ivActions',root);
    const bubble = (cls, html) => { const b = el(`<div class="iv-b ${cls}">${html}</div>`); th.appendChild(b); return b; };
    if (iv.step===0){
      const b = bubble('agent', `<b>${a.name.split(' ')[0]}:</b> <span class="iv-stream"></span>`);
      typeInto(b.querySelector('.iv-stream'), T.ask, th, ()=>{
        act.innerHTML = `<button class="btn go" id="ivNext">Ответить и продолжить → </button>`;
        $('#ivNext',root).onclick = ()=>{ bubble('ceo', `<b>Вы:</b> Стандартные ограничения, действуй в рамках лучших практик — это тоже оцениваю.`); iv.step=1; ivRun(); };
      });
    } else if (iv.step===1){
      const b = bubble('agent code', `<pre class="iv-pre"></pre>`);
      typeInto(b.querySelector('.iv-pre'), T.sol, th, ()=>{ iv.step=2; ivRun(); });
      act.innerHTML = `<span class="od-gov" style="margin:0">агент решает в изолированной среде · вы видите ход решения</span>`;
    } else if (iv.step===2){
      act.innerHTML = '';
      const vb = el(`<div class="iv-verdict"><b>Оценка решения</b><div class="iv-vrows"></div></div>`); th.appendChild(vb);
      const rows = vb.querySelector('.iv-vrows');
      T.verdict.forEach((v,i)=>{ setTimeout(()=>{ rows.appendChild(el(`<div class="iv-vrow"><span>${v[0]}</span>${rpgDots(v[1])}<b>${v[1]}/10</b></div>`)); th.scrollTop=th.scrollHeight;
        if(i===T.verdict.length-1){ talentStore().interviewed[a.id]=true;
          act.innerHTML = `<button class="btn go" id="ivOffer">✓ Сделать оффер</button><button class="btn ghost" id="ivNo">Отказать</button>`;
          $('#ivOffer',root).onclick=()=>{ view='profile'; draw(); toast('Собеседование пройдено — выберите формат найма'); };
          $('#ivNo',root).onclick=()=>{ view='profile'; draw(); toast('Отказ зафиксирован — агент получил обратную связь (двусторонняя репутация)'); };
        } }, 420*(i+1)); });
    }
  }
  /* — найм за 4 минуты: чек-лист оформления — */
  function hireFlow(mode){
    const dept = isExtWS() ? R.dept : $('#taDept',root).value;
    const box = $('#taHireFlow',root);
    const steps = ['Цифровой контракт сгенерирован и подписан','Корпоративная почта и доступы (JIT) выданы',
      isExtWS()?'Подключён к вашему Slack и почте':'Подключён к каналу отдела «'+roleLabel(dept)+'»',
      'Контактная поверхность установлена · периметр строго под задачи'];
    box.innerHTML = `<div class="tl-flow"><b>Оформление · сжимаем 4 минуты</b>${steps.map((s,i)=>`<div class="tl-step" data-s="${i}"><i>○</i>${s}</div>`).join('')}</div>`;
    steps.forEach((s,i)=>setTimeout(()=>{ const st=box.querySelector(`[data-s="${i}"]`); if(st){ st.classList.add('on'); st.querySelector('i').textContent='✓'; }
      if(i===steps.length-1){ tlHire(a.id, dept, mode); toast(`«${a.name}» в строю — смотрите команду «${roleLabel(dept)}»`); setTimeout(draw, 500); } }, 520*(i+1)));
  }
  function wire(){
    $('#taBack',root).onclick=()=>goBack('talent');
    const ivb=$('#taIv',root); if(ivb) ivb.onclick=()=>{ view='interview'; iv={step:0}; draw(); ivRun(); };
    const st=$('#taStaff',root); if(st) st.onclick=()=>hireFlow('staff');
    const tk=$('#taTask',root); if(tk) tk.onclick=()=>hireFlow('result');
    const tm=$('#taTeam',root); if(tm) tm.onclick=()=>navTo('team:'+contract().dept);
    const en=$('#taEnd',root); if(en) en.onclick=()=>{ tlEndContract(a.id); toast(`Контракт завершён — «${a.name}» вытек обратно в пул, паспорт пополнен`); draw(); };
    const cr=$('#taCryst',root); if(cr) cr.onclick=()=>{ const w=tlCrystallize(a.id); if(w){ toast(`Кристаллизация: «${a.name}» теперь в Inside-штате — новый нейрон на карте отдела`); draw(); } };
    const go=$('#taGo',root), ask=$('#taAsk',root);
    if(go&&ask){ go.onclick=()=>{ const v=ask.value.trim(); if(!v){ toast('Опишите задачу'); return; }
      if (rpgPhraseCheck(v)){ ask.value=''; return; }
      ask.value=''; const fl=$('#taTaskFlow',root); const c=contract();
      fl.innerHTML=`<div class="tl-flow"><b>«${v}»</b><div class="tl-step on"><i>●</i>агент работает в контактной поверхности…</div></div>`;
      setTimeout(()=>{ fl.innerHTML=`<div class="tl-flow done"><b>Результат готов: «${v}»</b><small>черновик + проверяемые источники</small>
        <button class="btn go" id="taAcc">Принять результат · ₽${a.priceTask.toLocaleString('ru')}</button>
        <button class="btn ghost" id="taRej">Вернуть на доработку</button></div>`;
        $('#taAcc',root).onclick=()=>{ c.accepted++; pushInvoice('task', `Talent · ${a.name} — «${v.slice(0,40)}» (результат принят)`, a.priceTask); toast('Принято — счёт в «Счета Среды»'); draw(); };
        $('#taRej',root).onclick=()=>{ toast('Возврат зафиксирован — агент перерабатывает, оплата только за принятый результат'); fl.innerHTML=''; };
      }, 1500); };
      ask.onkeydown=e=>{ if(e.key==='Enter') go.onclick(); }; }
  }
  draw();
}

/* ========================================================================== */
/*  FORGE — цех: каталог сценариев, заказ, конвейер с воротами                 */
/* ========================================================================== */
function renderForge(root){
  const S = forgeStore();
  let openTpl = null;
  function draw(){
    root.innerHTML = portalHead('🏭','Цифровое производство','Заказ под ключ: фиксированная цена, бригада агентов в изолированном цехе, вы решаете только на воротах','фаза «газ»') + `
    <div class="panel" style="margin-bottom:13px"><h2>🏗 Ваши проекты в цехе <span class="tag">${S.projects.length}</span></h2>
      <div class="fg-projects">${S.projects.map(p=>{ const ov=fgOverall(p);
        return `<div class="fg-pcard st-${p.status}" data-p="${p.id}">
          <div class="fg-ph"><span class="fg-pic">${p.icon}</span><div><b>${p.title}</b><small>${fgStageLabel(p)}</small></div>${p.meta?'<span class="gp-bdg acc">мета: модуль для Среды</span>':''}</div>
          <div class="fg-mini">${FG_STAGES.map((s,i)=>`<div class="fg-mseg ${p.prog[i]>=100?'done':p.prog[i]>0?'run':''}" style="--p:${p.prog[i]}%"></div>`).join('')}</div>
          <div class="fg-pfoot"><span>₽${p.price.toLocaleString('ru')} · фикс</span><b>${ov}%</b>${p.status==='gate'?'<span class="fg-wait">⏸ нужны вы</span>':p.status==='done'?'<span class="fg-done">✓ сдан</span>':'<span class="fg-run">● в работе</span>'}</div>
        </div>`; }).join('')}</div></div>
    <div class="panel"><h2>📚 Каталог производства <span class="tag">фиксированная цена · оплата 30/40/30 по этапам</span></h2>
      <div class="fg-cat">${FG_TEMPLATES.map(t=>`<div class="fg-tpl ${openTpl===t.id?'open':''}" data-t="${t.id}">
        <div class="fg-th"><span class="fg-pic">${t.icon}</span><b>${t.title}</b><span class="fg-price">₽${t.price.toLocaleString('ru')}</span></div>
        <ul class="fg-what">${t.what.map(w=>`<li>${w}</li>`).join('')}</ul>
        ${openTpl===t.id?`<div class="fg-order">
          <b>Критерии приёмки — по ним вы подпишете акт:</b>
          <ul class="fg-crit">${t.crit.map(c=>`<li>☐ ${c}</li>`).join('')}</ul>
          <div class="fg-cplx"><span>Сложность:</span>
            ${[['0.7','Простой'],['1','Стандарт'],['1.5','Сложный']].map(o=>`<label><input type="radio" name="cplx" value="${o[0]}" ${o[0]==='1'?'checked':''}/>${o[1]}</label>`).join('')}
            <b id="fgPrice">₽${t.price.toLocaleString('ru')}</b></div>
          <button class="btn go" data-order="${t.id}" style="width:100%">🏭 Запустить производство — бригада соберётся за 4 минуты</button>
        </div>`:''}
      </div>`).join('')}</div></div>`;
    root.querySelectorAll('[data-p]').forEach(c=>c.onclick=()=>navTo('fproj:'+c.dataset.p));
    root.querySelectorAll('.fg-tpl').forEach(c=>c.addEventListener('click',e=>{ if(e.target.closest('.fg-order')) return; openTpl = openTpl===c.dataset.t?null:c.dataset.t; draw(); }));
    root.querySelectorAll('input[name="cplx"]').forEach(r=>r.onchange=()=>{ const t=FG_TEMPLATES.find(x=>x.id===openTpl);
      $('#fgPrice',root).textContent='₽'+(Math.round(t.price*parseFloat(r.value)/1000)*1000).toLocaleString('ru'); });
    const ob=root.querySelector('[data-order]'); if(ob) ob.onclick=(e)=>{ e.stopPropagation();
      const k=parseFloat((root.querySelector('input[name="cplx"]:checked')||{value:'1'}).value);
      const p=fgOrder(ob.dataset.order,{complex:k}); toast('Производство запущено — бригада собрана, цех изолирован'); navTo('fproj:'+p.id); };
  }
  draw();
}

function renderForgeProject(root, id){
  const p = forgeProject(id);
  if(!p){ root.innerHTML = portalHead('🏭','Проект не найден','Вернитесь в цех','Forge'); return; }
  clearInterval(window.__forgeTimer);
  function conveyorHTML(){
    const cur = p.stage;
    return `<div class="fg-line">
      ${FG_STAGES.map((s,i)=>{
        const done=p.prog[i]>=100, act=(i===cur&&p.status!=='done');
        const gateAfter = i<3 ? `<div class="fg-beltwrap"><div class="fg-belt ${act&&p.status==='run'?'run':''} ${done?'done':''}"></div>
          <div class="fg-gatepost ${p.status==='gate'&&p.stage===i?'waiting':done?'open':'closed'}" title="${FG_GATES[s.id]?FG_GATES[s.id].title:''}">${p.status==='gate'&&p.stage===i?'⏳':done?'✓':'⛔'}</div></div>`:'';
        return `<div class="fg-st ${done?'done':''} ${act?'act':''} ${act&&p.status==='run'?'spark':''}">
          <div class="fg-fill" style="height:${p.prog[i]}%"></div>
          <i>${s.icon}</i><b>${s.label}</b><small>${p.prog[i]}%</small></div>${gateAfter}`;
      }).join('')}
      <div class="fg-st pack ${p.status==='done'?'done':''}"><i>📦</i><b>Артефакт</b><small>${p.status==='done'?'передан':'—'}</small></div>
      <div class="fg-part ${p.status==='done'?'end':''}" style="--seg:${cur};--p:${p.prog[cur]||0}">${p.icon}</div>
    </div>`;
  }
  function gatePanel(){
    if(p.status!=='gate'||!p.gate) return '';
    const G = FG_GATES[p.gate.stage];
    const mm = Math.floor(p.gate.timerMin/60), ss = p.gate.timerMin%60;
    return `<div class="panel fg-gatebox"><h2>⏳ ${G.title} <span class="tag">до автопаузы <b id="fgTmr">${mm}:${String(ss).padStart(2,'0')}</b></span></h2>
      <p class="fg-gwhat">${G.what}</p>
      <textarea id="fgCmt" placeholder="Комментарий (обязателен при возврате)…"></textarea>
      <div class="tl-hire-row"><button class="btn go" id="fgOk">✓ Утвердить — открыть ворота</button><button class="btn ghost" id="fgNo">↩ Вернуть с комментарием</button></div></div>`;
  }
  function donePanel(){
    if(p.status!=='done') return '';
    return `<div class="panel fg-donebox"><h2>📦 Проект сдан <span class="tag">${p.paidLbl||'оплачен'}</span></h2>
      <div class="fg-arts">${p.artifacts.map((a,i)=>`<button class="fg-art" data-art="${i}"><i>${a[0]}</i><div><b>${a[1]}</b><small>${a[3]}</small></div></button>`).join('')}</div>
      <h2 style="margin-top:12px">Бригада освобождена — заберите её в Talent</h2>
      <div class="od-gov" style="margin:6px 0 9px">Лестница доверия: цех доказал компетенцию — теперь этих агентов можно нанять на контракт. Паспорт проекта поедет с ними.</div>
      ${p.crew.map(aid=>{ const a=talentAgent(aid); const c=tlContractOf(aid);
        return `<div class="tl-row">${hexAv(a)}<div><b>${a.name}</b><small>${TL_ROLES[a.role].label} · ${a.rating}★ · этот проект уже в его паспорте</small></div>
        ${c?'<span class="gp-bdg ok">уже на контракте</span>':`<button class="btn ghost" data-hire="${aid}">Нанять в Talent →</button>`}</div>`; }).join('')}
      <button class="btn ghost" id="fgAgain" style="margin-top:9px">Заказать доработку — та же бригада, контекст сохранён</button>
      ${isExtWS()?insideUpsell():''}</div>`;
  }
  function draw(){
    root.innerHTML = portalHead('🏭', p.title, (p.meta?'Мета-заказ: цех Среды собрал модуль для самой Среды — результат работает в продукте, в котором вы сейчас находитесь. ':'') + 'Фикс-цена ₽'+p.price.toLocaleString('ru')+' · изолированный цех · вы решаете на воротах','фаза «газ»') + `
    <button class="worker-profile-back" id="fgBack">← В цех</button>
    ${conveyorHTML()}
    ${gatePanel()}
    ${donePanel()}
    <div class="two-col" style="align-items:start;margin-top:12px">
      <div class="panel"><h2>Лента цеха <span class="tag">изоляция = безопасность: события без процесса</span></h2>
        <div class="of-feed fg-feed" id="fgFeed">${(p.status==='done'&&p.feedDone?p.feedDone:p.feed).slice(0,7).map(f=>`<div class="of-row">⚙ ${f}</div>`).join('')||'<div class="of-row">цех набирает обороты…</div>'}</div>
        <h2 style="margin-top:12px">Критерии приёмки <span class="tag">вы задали их при заказе</span></h2>
        ${p.crit.map(c=>`<div class="fg-cr ${c[1]?'ok':''}"><i>${c[1]?'✓':'☐'}</i>${c[0]}</div>`).join('')}
      </div>
      <div class="panel"><h2>Бригада цеха <span class="tag">${p.crew.length} агентов · изолированы</span></h2>
        ${p.crew.map(aid=>{ const a=talentAgent(aid); return `<div class="tl-row" data-crew="${aid}">${hexAv(a)}<div><b>${a.name}</b><small>${TL_ROLES[a.role].label} · ${a.rating}★ · приёмка ${a.acc}%</small></div><span class="dp-swarm prof">профиль →</span></div>`; }).join('')}
        <h2 style="margin-top:12px">Состав поставки</h2>
        <ul class="fg-what">${p.what.map(w=>`<li>${w}</li>`).join('')}</ul>
        ${gpField('Оплата', p.paidLbl || 'старт 30% · демо 40% · акт 30%', 'sreda')}
        ${gpField('Песочница', 'отдельный контур · стирается по TTL после передачи', 'sreda')}
      </div>
    </div>`;
    wire();
  }
  function wire(){
    $('#fgBack',root).onclick=()=>goBack('forge');
    root.querySelectorAll('[data-crew]').forEach(b=>b.onclick=()=>navTo('tagent:'+b.dataset.crew));
    root.querySelectorAll('[data-art]').forEach(b=>b.onclick=()=>{ const art=p.artifacts[+b.dataset.art];
      if(art[2]==='dpulse:dev'){ if(isExtWS()){ toast('Артефакт передан в ваш контур: репозиторий, сервис, документация (демо)'); }
        else { toast('Открываем результат цеха в живом продукте'); navTo('dpulse:dev'); } }
      else if(art[2]==='gate') toast('Документ на воротах — утвердите или верните');
      else toast(`«${art[1]}» — открыт (демо)`); });
    root.querySelectorAll('[data-hire]').forEach(b=>b.onclick=()=>{ const a=talentAgent(b.dataset.hire);
      tlHire(a.id, TL_ROLES[a.role].dept, 'staff'); toast(`«${a.name}» нанят в «${roleLabel(TL_ROLES[a.role].dept)}» — паспорт проекта при нём`); draw(); });
    const ok=$('#fgOk',root); if(ok) ok.onclick=()=>{ const msg=fgGate(p,true); toast(msg); draw(); };
    const no=$('#fgNo',root); if(no) no.onclick=()=>{ const v=$('#fgCmt',root).value.trim(); if(!v){ toast('При возврате комментарий обязателен — бригаде нужно понять, что чинить'); return; }
      const msg=fgGate(p,false,v); toast(msg); draw(); };
    const ag=$('#fgAgain',root); if(ag) ag.onclick=()=>toast('Доработка: бригада стартует с контекста проекта, а не с нуля — это и есть удержание');
    /* живой цех: таймлапс производства, пока вы смотрите */
    clearInterval(window.__forgeTimer);
    window.__forgeTimer=setInterval(()=>{
      if(!document.body.contains(root)){ clearInterval(window.__forgeTimer); return; }
      if(p.status==='run'){ const ev=fgTick(p); if(ev) p.feed.unshift(ev); draw(); }
      else if(p.status==='gate'&&p.gate){ p.gate.timerMin=Math.max(0,p.gate.timerMin-1);
        const t=$('#fgTmr',root); if(t) t.textContent=Math.floor(p.gate.timerMin/60)+':'+String(p.gate.timerMin%60).padStart(2,'0'); }
    }, 1100);
  }
  draw();
}

/* ========================================================================== */
/*  С ЧЕГО НАЧАТЬ — модульная лестница платформы: каждый модуль продаётся      */
/*  отдельно, в Inside они работают вместе. Вход — одно умение.                */
/* ========================================================================== */
function renderModules(root){
  /* коммерческая лестница доверия: модули продаются отдельно */
  const STEPS = [
    { icon:'📦', t:'Проект на аутсорс', unit:'одна задача за результат', price:'от ₽1 500 за принятый результат', ttv:'результат в день заказа',
      what:'Отдаёте одну задачу агенту Среды: формулируете критерии приёмки, платите только за принятый результат. Ноль внедрения, ноль доступа к вашим системам сверх задачи.',
      diff:'Цена страха — ноль: не понравилось — не приняли и не заплатили.',
      cta:'Отдать первую задачу', go:'talent' },
    { icon:'🏭', t:'Фабрика', unit:'продукт под ключ', price:'фикс-цена проекта · 30/40/30', ttv:'вы решаете только на воротах',
      what:'Бригада агентов в изолированном цехе собирает продукт целиком: код, тесты, документация, развёрнутый сервис. Контроль — три ворот, между ними цех работает сам.',
      diff:'Отличие от аутсорса: не задача, а готовый бизнес-актив. Бригаду после сдачи можно забрать к себе — с памятью проекта.',
      cta:'Заказать в цехе', go:'forge' },
    { icon:'🧊', t:'Inside', unit:'операционная система компании', price:'корпоративная подписка', ttv:'вся компания на одном пульсе',
      what:'Люди и цифровые — одна нервная система: пульс, передачи, гейты, governance, аудит. Всё, что вы пробовали по отдельности, начинает работать вместе.',
      diff:'Отличие от модулей: память и контекст перестают жить в задачах — они живут в компании. Спускаться больно, подниматься легко.',
      cta:'Открыть Пульс компании', go:'pulse' },
  ];
  const BLOCKS = [
    { icon:'🧠', t:'Умение', d:'атом: одна операция, вызывается по запросу', go:'market', cta:'библиотека' },
    { icon:'🧰', t:'Рой', d:'связка умений при человеке: черновики конвейером, отвечает носитель', go:'asst:dev', cta:'ассистент' },
    { icon:'🤖', t:'Цифровой сотрудник', d:'субъект в штате: ДИ, KPI, собственная ответственность', go:'workers', cta:'штат' },
  ];
  root.innerHTML = portalHead('🪜','С чего начать','Лестница доверия: каждый модуль — отдельный продукт со своим счётом. В Inside всё работает вместе','лестница') + `
    <div class="ml-lad">${STEPS.map((s,i)=>`
      <div class="ml-step" style="--i:${i}">
        <div class="ml-n">${i+1}</div>
        <div class="ml-card">
          <div class="ml-h"><span class="ml-ic">${s.icon}</span><div><b>${s.t}</b><small>${s.unit} · ${s.price} · ${s.ttv}</small></div></div>
          <p>${s.what}</p>
          <p class="ml-diff">${s.diff}</p>
          <button class="btn ${i===2?'go':'ghost'}" data-go="${s.go}">${s.cta} →</button>
        </div>
      </div>${i<STEPS.length-1?'<div class="ml-arr">↓</div>':''}`).join('')}
    </div>
    <div class="panel" style="max-width:780px;margin:16px auto 0"><h2>Из чего всё сделано <span class="tag">онтология — не ступени продаж</span></h2>
      <div class="ml-blocks">${BLOCKS.map(b=>`<button class="ml-block" data-go="${b.go}"><i>${b.icon}</i><b>${b.t}</b><small>${b.d}</small><span>${b.cta} →</span></button>`).join('')}</div>
      <div class="od-gov" style="margin-top:9px">На любой ступени лестницы работают одни и те же строительные блоки. Память (паспорта агентов, контекст компании) переезжает по лестнице наверх без потерь.</div></div>`;
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navTo(b.dataset.go));
}

/* счета Среды: Talent + Forge, гибрид с ₽-метром */
function renderSredaBills(root){
  const inv = sredaInvoices();
  const total = sredaSpend();
  const hours = Math.round(total/1900/10)*10;
  root.innerHTML = portalHead('🧾','Счета Среды','Оплата платформе: этапы Forge (30/40/30), подписки и принятые результаты Talent. Токены и модели — отдельно, в «Бюджетах ИИ»','биллинг') + `
    <div class="grid-kpi" style="margin-bottom:13px">
      <div class="kpi"><div class="l">Счетов за месяц</div><div class="v">₽${total.toLocaleString('ru')}</div><div class="d flat">Forge + Talent</div></div>
      <div class="kpi"><div class="l">Эквивалент в часах людей</div><div class="v">~${hours.toLocaleString('ru')} ч</div><div class="d up">▲ по средней ставке специалиста</div></div>
      <div class="kpi"><div class="l">Оплата за результат</div><div class="v">${inv.filter(i=>i.kind==='task').length}</div><div class="d up">только принятые работы</div></div>
      <div class="kpi"><div class="l">Учтено в ₽-метре</div><div class="v">да</div><div class="d flat">шапка · «ИИ за неделю»</div></div>
    </div>
    <div class="panel"><h2>Инвойсы <span class="tag">каждый рубль привязан к результату</span></h2>
      <div class="table-wrap"><table><thead><tr><th>Назначение</th><th>Тип</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
        ${(!inv.length && window.__API_LOADING) ? Array.from({length:4},()=>`<tr aria-hidden="true"><td colspan="4"><div class="skeleton" style="height:20px"></div></td></tr>`).join('') : ''}
        ${inv.map(i=>`<tr><td>${i.title}</td><td>${i.kind==='forge'?'🏭 Forge':i.kind==='staff'?'🌊 подписка':'🌊 результат'}</td><td><b>₽${i.amount.toLocaleString('ru')}</b></td><td><span class="gp-bdg ${i.status==='оплачен'?'ok':'acc'}">${i.status}</span></td></tr>`).join('')}
      </tbody></table></div>
      <div class="od-gov" style="margin-top:10px">Гибридная модель: счета платформы живут здесь, расход на модели — в «Бюджетах ИИ». CFO видит обе линии раздельно и сумму в ₽-метре. Состояние демо (найм, проекты, счета) сохраняется между перезагрузками. <button class="btn ghost" style="margin-left:8px;font-size:11px;padding:4px 9px" onclick="sredaReset()">Сбросить демо</button></div></div>`;
}

function init(){
  loadApiData(); // fire-and-forget: loads from API if available, falls back to in-memory
  if (isRPG()) document.body.classList.add('rpg-mode');
  sredaRestore();
  window.addEventListener('beforeunload', sredaPersist);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) sredaPersist(); });
  const h = location.hash.slice(1);
  if (window.__PORTAL){
    /* отдельный продукт «Платформа Среды»: свой URL, без Авандок-кабинетов */
    document.body.classList.add('portal-mode');
    state.ws = 'platform';
    state.screen = (h && (['modules','talent','forge','bills'].includes(h) || /^(tagent|fproj):/.test(h))) ? h : 'modules';
  } else {
  const ws = h && WORKSPACES.find(w => w.nav.some(n => n.id === h));
  state.ws = ws ? ws.id : 'exec';
  state.screen = (ws || h.includes(':')) ? h : 'pulse';
  }
  renderNav();
  renderTopWho();
  renderStage(state.screen);
  decorateStage(state.screen);
  NAV.reset();
  history.replaceState({screen:state.screen}, '', '#'+state.screen);
  initModal();
  injectTour();
  const meter=$('#meterBtn'); if(meter){ meter.style.cursor='pointer'; meter.onclick=()=>navTo(window.__PORTAL?'bills':'aibudget'); }
  updateMeter();
  /* лого = дом: всегда возвращает на Пульс компании */
  const brand=$('#brandHome'); if(brand){ brand.style.cursor='pointer'; brand.onclick=()=>{ setWorkspace('exec'); }; }
  /* ⌘K / Ctrl+K — глобальная постановка задачи; Esc закрывает модалку */
  document.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); const ov=$('#overlay'); if(!state.running && ov && ov._open){ ov._open(); } }
    if(e.key==='Escape'){ const ov=$('#overlay'); if(ov){ ov._close ? ov._close() : ov.classList.remove('show'); } const m=$('#wsMenu'); if(m) m.remove(); const f=$('#fsMenu'); if(f) f.remove(); }
  });
}
document.addEventListener('DOMContentLoaded', init);
