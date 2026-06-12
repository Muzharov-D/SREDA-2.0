/* ========================================================================== */
/*  PORTAL-APP — внешний контур: найм агентов и производство под ключ       */
/*  Не-Inside клиенты: каталог, заказы, счета, поддержка                      */
/* ========================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function escHtml(s){ return String(s).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
/* a11y: несемантичные кликабельные карточки → доступны с клавиатуры (role=button + Enter/Space) */
function a11yActivate(els, fn){
  els.forEach(c=>{
    if(c.tagName!=='BUTTON' && c.tagName!=='A'){ c.setAttribute('role','button'); c.setAttribute('tabindex','0'); }
    c.onclick=e=>fn(c,e);
    c.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fn(c,e); } };
  });
}

let _toastT;
function toast(msg){
  let t = document.querySelector('.toast');
  if (!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = '✓ ' + msg; requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(_toastT); _toastT = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ── логирование действий в API (audit) ── */
async function portalLog(who, what, verdict='allow'){
  try {
    await apiPost('/audit', { time: new Date().toLocaleString('ru'), who, what, verdict, emoji:'🌐', dept:'portal' });
  } catch(e) { console.log('Audit log failed:', e.message); }
}

/* ── зеркалирование счёта в API (UI-счёт создаёт pushInvoice внутри tlHire/fgOrder) ── */
async function portalBill(kind, title, amount){
  try {
    return await apiPost('/bills', { kind, title, amount, status:'выставлен' });
  } catch(e) { console.log('Bill mirror failed:', e.message); return null; }
}

/* ── загрузка данных из API с тихим фолбэком на моки ── */
async function loadApiData(){
  const grab = async (path, key) => {
    try {
      const rows = await apiGet(path);
      if (Array.isArray(rows) && rows.length) window[key] = rows;
    } catch(e) { /* статика или API недоступен — работают моки */ }
  };
  await Promise.all([
    grab('/agents',   '__API_AGENTS'),
    grab('/projects', '__API_PROJECTS'),
    grab('/bills',    '__API_BILLS'),
  ]);
}

const portalState = { screen: 'team', filters: { role:'', grade:'', min:0, max:200000 }, selectedAgent:null, selectedProject:null };

/* ── инициализация ── */
async function initPortal(){
  document.body.classList.add('portal-mode');
  await loadApiData();
  /* персист демо-состояния: найм, счета, проекты переживают F5 */
  if (typeof sredaRestore === 'function') sredaRestore();
  if (typeof updateMeter === 'function') updateMeter();
  const persistAll = () => {
    if (typeof sredaPersist === 'function') sredaPersist();
    if (typeof pcPersist === 'function') pcPersist();
  };
  window.addEventListener('beforeunload', persistAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistAll(); });

  renderPortalNav();
  renderPortalStage();
  wirePortalModal();
  /* brand → сотрудники (дефолтный экран) */
  const brand = $('#brandHome'); if(brand){ brand.style.cursor='pointer'; brand.onclick=()=>{ portalState.screen='team'; portalState.selectedAgent=null; renderPortalNav(); renderPortalStage(); }; }
  /* meter → bills */
  const meter = $('#meterBtn'); if(meter){ meter.style.cursor='pointer'; meter.onclick=()=>{ portalState.screen='bills'; renderPortalNav(); renderPortalStage(); }; }
  /* keyboard shortcuts */
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      if(portalState.screen==='agent'){ portalState.screen='catalog'; portalState.selectedAgent=null; renderPortalNav(); renderPortalStage(); }
      else if(portalState.screen==='project'){ portalState.screen='orders'; portalState.selectedProject=null; renderPortalNav(); renderPortalStage(); }
      else if(portalState.screen==='team' && typeof pcView!=='undefined' && pcView.mobileThread){
        pcView.mobileThread=false; const w=$('#pcWrap'); if(w) w.classList.remove('thread-open');
      }
    }
    if((e.metaKey||e.ctrlKey) && e.key>='1' && e.key<='5'){
      e.preventDefault();
      const ids = ['team','catalog','orders','bills','support'];
      const idx = parseInt(e.key,10)-1;
      if(ids[idx]){ portalState.screen=ids[idx]; portalState.selectedAgent=null; portalState.selectedProject=null; renderPortalNav(); renderPortalStage(); }
    }
  });
}

/* ── навигация ── */
function renderPortalNav(){
  const nav = $('#nav'); if(!nav) return;
  nav.innerHTML = '';
  nav.appendChild(el(`<div class="nav-ws"><span class="nav-ws-ic">🌊</span><div><b>Платформа Среды</b><small>внешний контур</small></div></div>`));
  const unread = (typeof pcUnreadTotal === 'function') ? pcUnreadTotal() : 0;
  PORTAL_NAV.forEach(n=>{
    const badge = (n.id==='team' && unread>0) ? `<span class="pc-nav-badge">${unread}</span>` : '';
    const it = el(`<button class="nav-item ${n.id===portalState.screen?'active':''}"><span class="ni-ic">${n.icon}</span><span class="ni-l">${n.label}</span>${badge}</button>`);
    it.onclick = () => { portalState.screen = n.id; portalState.selectedAgent = null; portalState.selectedProject = null; renderPortalNav(); renderPortalStage(); };
    nav.appendChild(it);
  });
}

/* ── рендер экрана ── */
function renderPortalStage(){
  const stage = $('#stage'); if(!stage) return;
  stage.className = 'stage full enter';
  stage.innerHTML = '<div class="work" id="work"></div>';
  const root = $('#work');
  if (typeof pcTeardown === 'function') pcTeardown(); /* чистим поллинг чата при смене экрана */
  switch(portalState.screen){
    case 'team':     renderTeam(root); break;
    case 'catalog':  renderCatalog(root); break;
    case 'agent':    renderAgentDetail(root); break;
    case 'orders':   renderOrders(root); break;
    case 'project':  renderProjectDetail(root); break;
    case 'bills':    renderBills(root); break;
    case 'support':  renderSupport(root); break;
    default:         renderTeam(root);
  }
  requestAnimationFrame(()=>{
    stage.classList.add('enter-active');
    setTimeout(()=>stage.classList.remove('enter','enter-active'), 240);
  });
}

/* ── шапка экрана портала ── */
function portalHead(icon, label, sub){
  return `<div class="work-head portal"><div class="ico">${icon}</div><div style="flex:1"><h1>${label}</h1><p>${sub}</p></div><span class="badge"><span class="dot"></span>Платформа Среды · внешний контур</span></div>`;
}

/* ========================================================================== */
/*  КАТАЛОГ АГЕНТОВ                                                          */
/* ========================================================================== */
function renderCatalog(root){
  const cat = talentCatalog ? talentCatalog() : [];
  const roles = [...new Set(cat.map(a=>a.role))];
  const f = portalState.filters;
  const filtered = cat.filter(a=>{
    if(f.role && a.role!==f.role) return false;
    if(f.grade && a.grade!==f.grade) return false;
    const price = a.priceTask || (TL_ROLES && TL_ROLES[a.role] ? TL_ROLES[a.role].task : 0);
    if(price < f.min || price > f.max) return false;
    return true;
  });

  root.innerHTML = portalHead('🌊','Цифровой найм','Рынок труда агентов Среды: проверенная репутация, старт за 4 минуты') + `
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>Фильтры <span class="tag">${filtered.length} агентов</span></h2>
        <div class="fld"><span>Роль</span>
          <select id="pfRole" class="portal-select"><option value="">Все роли</option>${roles.map(r=>`<option value="${r}" ${f.role===r?'selected':''}>${(TL_ROLES&&TL_ROLES[r]?TL_ROLES[r].label:r)}</option>`).join('')}</select></div>
        <div class="fld"><span>Грейд</span>
          <select id="pfGrade" class="portal-select"><option value="">Все грейды</option><option value="Senior" ${f.grade==='Senior'?'selected':''}>Senior</option><option value="Middle+" ${f.grade==='Middle+'?'selected':''}>Middle+</option><option value="Middle" ${f.grade==='Middle'?'selected':''}>Middle</option></select></div>
        <div class="fld"><span>Цена за задачу, ₽</span>
          <div style="display:flex;gap:8px"><input id="pfMin" type="number" value="${f.min}" placeholder="от" style="width:50%"/><input id="pfMax" type="number" value="${f.max}" placeholder="до" style="width:50%"/></div></div>
        <button class="btn go" id="pfApply" style="width:100%;margin-top:8px">Применить</button>
        <button class="btn ghost" id="pfReset" style="width:100%;margin-top:6px">Сбросить</button>
      </div>
      <div>
        <div class="panel"><h2>Агенты <span class="tag">${filtered.length} из ${cat.length}</span></h2>
          <div class="portal-grid">${filtered.map(a=>renderAgentCard(a)).join('')}</div>
        </div>
      </div>
    </div>`;

  $('#pfApply',root).onclick = () => {
    f.role = $('#pfRole',root).value;
    f.grade = $('#pfGrade',root).value;
    f.min = +$('#pfMin',root).value || 0;
    f.max = +$('#pfMax',root).value || 999999;
    renderCatalog(root);
  };
  $('#pfReset',root).onclick = () => {
    portalState.filters = { role:'', grade:'', min:0, max:200000 };
    renderCatalog(root);
  };
  const _cards = root.querySelectorAll('.portal-card');
  const _open = c => { portalState.selectedAgent = c.dataset.aid; portalState.screen = 'agent'; renderPortalNav(); renderPortalStage(); };
  if (typeof a11yActivate === 'function') a11yActivate(_cards, _open);   // role=button + клавиатура
  else _cards.forEach(c => c.onclick = () => _open(c));
}

function renderAgentCard(a){
  const R = TL_ROLES && TL_ROLES[a.role];
  const price = a.priceTask || (R ? R.task : 0);
  const month = a.priceMonth || (R ? R.month : 0);
  const stars = '★'.repeat(Math.round(a.rating)) + '☆'.repeat(5-Math.round(a.rating));
  return `<div class="portal-card" data-aid="${a.id}" style="cursor:pointer">
    <div class="pc-top"><span class="pc-emoji">${a.name.split(' ')[0][0]}</span><div><b>${a.name}</b><small>${R?R.label:a.role} · ${a.grade}</small></div><span class="pc-rating">${a.rating} ${stars}</span></div>
    <div class="pc-meta"><span>✓ ${a.acc}% приёмка</span><span>🎯 ${a.done} задач</span></div>
    <div class="pc-spells">${a.spells.slice(0,3).map(s=>`<span class="chip">${s[0]}</span>`).join('')}</div>
    <div class="pc-price"><span>₽${price.toLocaleString('ru')} / задача</span><span>₽${month.toLocaleString('ru')} / мес</span></div>
  </div>`;
}

/* ========================================================================== */
/*  КАРТОЧКА АГЕНТА                                                          */
/* ========================================================================== */
function renderAgentDetail(root){
  const a = talentAgent ? talentAgent(portalState.selectedAgent) : null;
  if(!a){ root.innerHTML = portalHead('🌊','Агент не найден','Вернитесь в каталог') + '<div class="panel"><button class="btn go" id="paBack">← В каталог</button></div>'; $('#paBack',root).onclick=()=>{ portalState.screen='catalog'; renderPortalStage(); }; return; }
  const R = TL_ROLES && TL_ROLES[a.role];
  const stars = '★'.repeat(Math.round(a.rating)) + '☆'.repeat(5-Math.round(a.rating));
  const price = a.priceTask || (R ? R.task : 0);
  const month = a.priceMonth || (R ? R.month : 0);

  root.innerHTML = portalHead('🌊',a.name,'Карточка агента · паспорт верифицирован Средой') + `
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <div class="pa-head"><span class="pa-emoji">${a.name.split(' ')[0][0]}</span><div><h2>${a.name}</h2><p>${R?R.label:a.role} · ${a.grade} · ID: ${tlPassId?tlPassId(a):a.id}</p></div><span class="pa-rating">${a.rating} ${stars}</span></div>
        <div class="pa-stats">
          <div><span>Приёмка с 1-й подачи</span><b>${a.acc}%</b></div>
          <div><span>Выполнено задач</span><b>${a.done}</b></div>
          <div><span>Цена / задачу</span><b>₽${price.toLocaleString('ru')}</b></div>
          <div><span>Цена / месяц</span><b>₽${month.toLocaleString('ru')}</b></div>
        </div>
        <h3 style="margin-top:14px">Контактная поверхность</h3>
        <div class="pa-contact">
          <button class="btn ghost" id="paTg" style="flex:1">📨 Telegram</button>
          <button class="btn ghost" id="paEmail" style="flex:1">✉️ Email</button>
          <button class="btn go" id="paChat" style="flex:1">💬 Чат в Среде</button>
        </div>
        <div class="pa-hire">
          <button class="btn go" id="paHireTask" style="width:100%">Нанять за результат · ₽${price.toLocaleString('ru')}</button>
          <button class="btn ghost" id="paHireMonth" style="width:100%;margin-top:8px">В штат · ₽${month.toLocaleString('ru')}/мес</button>
        </div>
      </div>
      <div>
        <div class="panel"><h2>Навыки <span class="tag">${a.spells.length}</span></h2>
          <div class="pa-spells">${a.spells.map(s=>`<div class="pa-spell"><span>${s[0]}</span>${spellDots(s[1])}<b>${s[1]}/5</b></div>`).join('')}</div></div>
        <div class="panel"><h2>Опыт в доменах</h2>
          <div class="pa-domains">${a.domains.map(d=>`<span class="chip">${d}</span>`).join('')}</div></div>
        <div class="panel"><h2>Портфолио <span class="tag">${a.folio.length}</span></h2>
          ${a.folio.map(f=>`<div class="pa-folio"><b>${f[0]}</b><p>${f[1]}</p><span>${f[2]}</span></div>`).join('')}</div>
        <div class="panel"><h2>Отзывы <span class="tag">${a.reviews.length}</span></h2>
          ${a.reviews.map(r=>`<div class="pa-review"><b>${r[0]}</b><p>«${r[1]}»</p></div>`).join('')}</div>
        <div class="panel"><h2>Паспорт · история работы <span class="tag">${a.passport.length}</span></h2>
          ${a.passport.map(p=>`<div class="pa-pass"><span class="chip">${p[0]==='forge'?'🏭 Forge':p[0]==='talent'?'🌊 Talent':'🧊 Inside'}</span><b>${p[1]}</b><span>${p[2]}</span></div>`).join('')}</div>
      </div>
    </div>
    <button class="btn ghost" id="paBack2" style="margin-top:12px">← В каталог</button>`;

  $('#paBack2',root).onclick = () => { portalState.screen='catalog'; portalState.selectedAgent=null; renderPortalStage(); };
  /* контактная поверхность: нанятый агент → его тред; иначе подсказка */
  const goChannel = (tab) => {
    const hired = (typeof tlContractOf === 'function') && tlContractOf(a.id);
    if(hired && typeof pcGoToChat === 'function'){ pcGoToChat(a.id, tab); }
    else toast('Канал откроется сразу после найма агента');
  };
  $('#paTg',root).onclick = () => goChannel('chat');
  $('#paEmail',root).onclick = () => goChannel('mail');
  $('#paChat',root).onclick = () => goChannel('chat');
  /* найм: ОДИН счёт в UI (pushInvoice внутри tlHire) + зеркало в API; затем — в чат */
  const hire = (mode) => {
    if(typeof tlContractOf === 'function' && tlContractOf(a.id)){
      toast(`${a.name} уже в команде — открываю чат`);
      if(typeof pcGoToChat === 'function') pcGoToChat(a.id, 'chat');
      return;
    }
    if(tlHire) tlHire(a.id, R?R.dept:'dev', mode); /* локальный счёт + контракт */
    const isStaff = mode === 'staff';
    portalLog('Клиент · портал', `Найм агента ${a.name} · ${isStaff?'в штат':'за результат'} · ₽${(isStaff?month:price).toLocaleString('ru')}${isStaff?'/мес':''}`);
    portalBill(isStaff?'staff':'task',
      isStaff ? `Talent · ${a.name} — подписка, месяц 1` : `Talent · ${a.name} — резерв под результат`,
      isStaff ? month : price);
    toast(`${a.name} в команде · счёт выставлен`);
    if(typeof pcAfterHire === 'function') pcAfterHire(a.id);
  };
  $('#paHireTask',root).onclick = () => hire('result');
  $('#paHireMonth',root).onclick = () => hire('staff');
}

function spellDots(n){
  return `<span class="rpg-dots">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
}

/* ========================================================================== */
/*  ЗАКАЗЫ / ПРОЕКТЫ FORGE                                                    */
/* ========================================================================== */
function renderOrders(root){
  const S = forgeStore ? forgeStore() : { projects:[] };
  const list = S.projects || [];
  root.innerHTML = portalHead('🏭','Мои заказы','Цифровое производство: фикс-цена, ворота, изоляция') + `
    <div class="panel"><h2>Активные и завершённые проекты <span class="tag">${list.length}</span></h2>
      <div class="portal-orders">${list.map(p=>renderOrderCard(p)).join('')}</div>
    </div>
    <div class="panel" style="margin-top:12px"><h2>Новый заказ <span class="tag">шаблоны</span></h2>
      <div class="portal-templates">${(FG_TEMPLATES||[]).map(t=>renderTemplateCard(t)).join('')}</div>
    </div>`;

  root.querySelectorAll('.portal-oc').forEach(c=>c.onclick=()=>{
    portalState.selectedProject = c.dataset.pid;
    portalState.screen = 'project';
    renderPortalNav();
    renderPortalStage();
  });
  root.querySelectorAll('.portal-tpl').forEach(c=>c.onclick=()=>{
    const t = FG_TEMPLATES.find(x=>x.id===c.dataset.tid);
    if(t && fgOrder){ fgOrder(t.id); /* локальный счёт создаёт fgOrder → pushInvoice */
      portalLog('Клиент · портал', `Заказ производства · ${t.title} · старт ₽${Math.round(t.price*0.3).toLocaleString('ru')}`);
      portalBill('forge', `Forge · «${t.title}» — старт производства (30%)`, Math.round(t.price*0.3)); /* зеркало в API */
      toast(`Проект «${t.title}» запущен · счёт выставлен`); renderOrders(root);
    }
    else toast('Заказ создан (демо)');
  });
}

function renderOrderCard(p){
  const ov = typeof fgOverall === 'function' ? fgOverall(p) : 0;
  const st = p.status==='done'?'✓ сдан':p.status==='gate'?'⏸ ждёт ворот':'● в работе';
  const stCls = p.status==='done'?'ok':p.status==='gate'?'acc':'run';
  return `<div class="portal-oc" data-pid="${p.id}" style="cursor:pointer">
    <div class="oc-h"><span class="oc-icon">${p.icon}</span><div><b>${p.title}</b><small>${st}</small></div><span class="oc-price">₽${p.price.toLocaleString('ru')}</span></div>
    <div class="oc-stages">${(FG_STAGES||[]).map((s,i)=>`<div class="oc-seg ${p.prog[i]>=100?'done':p.prog[i]>0?'run':''}" style="--p:${p.prog[i]}%"></div>`).join('')}</div>
    <div class="oc-meta"><span>Готовность: ${ov}%</span><span>${p.crew.length} агентов</span><span>${p.paidLbl||''}</span></div>
  </div>`;
}

function renderTemplateCard(t){
  return `<div class="portal-tpl" data-tid="${t.id}" style="cursor:pointer">
    <div class="tpl-h"><span>${t.icon}</span><b>${t.title}</b><span class="tpl-price">₽${t.price.toLocaleString('ru')}</span></div>
    <ul class="tpl-what">${t.what.map(w=>`<li>${w}</li>`).join('')}</ul>
    <button class="btn go" style="width:100%;margin-top:8px">Заказать производство</button>
  </div>`;
}

/* ========================================================================== */
/*  ДЕТАЛЬ ПРОЕКТА                                                           */
/* ========================================================================== */
function renderProjectDetail(root){
  const p = forgeProject ? forgeProject(portalState.selectedProject) : null;
  if(!p){ root.innerHTML = portalHead('🏭','Проект не найден','Вернитесь к заказам') + '<div class="panel"><button class="btn go" id="ppBack">← К заказам</button></div>'; $('#ppBack',root).onclick=()=>{ portalState.screen='orders'; portalState.selectedProject=null; renderPortalStage(); }; return; }

  const ov = typeof fgOverall === 'function' ? fgOverall(p) : 0;
  root.innerHTML = portalHead('🏭',p.title,'Фикс-цена · изолированный цех · вы решаете на воротах') + `
    <button class="btn ghost" id="ppBack2" style="margin-bottom:12px">← К заказам</button>
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>Конвейер <span class="tag">${ov}% готовности</span></h2>
        <div class="portal-conveyor">${(FG_STAGES||[]).map((s,i)=>{
          const done=p.prog[i]>=100, act=(i===p.stage&&p.status!=='done');
          return `<div class="pcv-seg ${done?'done':act?'act':''}"><div class="pcv-fill" style="height:${p.prog[i]}%"></div><i>${s.icon}</i><b>${s.label}</b><small>${p.prog[i]}%</small></div>${i<3?'<div class="pcv-gate">⛔</div>':''}`;
        }).join('')}</div>
        ${p.status==='gate' && p.gate ? `<div class="panel" style="margin-top:12px;border-color:var(--amber)">
          <h2>⏳ ${(FG_GATES&&FG_GATES[FG_STAGES[p.stage].id]?FG_GATES[FG_STAGES[p.stage].id].title:'Ворота')}</h2>
          <p>${(FG_GATES&&FG_GATES[FG_STAGES[p.stage].id]?FG_GATES[FG_STAGES[p.stage].id].what:'')}</p>
          <textarea id="ppCmt" placeholder="Комментарий (обязателен при возврате)…" style="width:100%;min-height:60px;margin:8px 0"></textarea>
          <div style="display:flex;gap:8px"><button class="btn go" id="ppOk" style="flex:1">✓ Утвердить</button><button class="btn ghost" id="ppNo" style="flex:1">↩ Вернуть</button></div>
        </div>` : ''}
        <div class="panel" style="margin-top:12px"><h2>Критерии приёмки</h2>
          ${p.crit.map(c=>`<div class="pcv-crit ${c[1]?'ok':''}"><i>${c[1]?'✓':'☐'}</i>${c[0]}</div>`).join('')}</div>
      </div>
      <div>
        <div class="panel"><h2>Бригада <span class="tag">${p.crew.length} агентов</span></h2>
          ${p.crew.map(cid=>{
            const a = talentAgent ? talentAgent(cid) : null;
            if(!a) return '';
            const R = TL_ROLES && TL_ROLES[a.role];
            return `<div class="pa-head" style="margin-bottom:8px"><span class="pa-emoji">${a.name.split(' ')[0][0]}</span><div><b>${a.name}</b><small>${R?R.label:a.role} · ${a.rating}★</small></div></div>`;
          }).join('')}
        </div>
        <div class="panel"><h2>Артефакты <span class="tag">${p.artifacts.length}</span></h2>
          ${p.artifacts.map(ar=>`<div class="pa-pass"><span class="chip">${ar[0]}</span><b>${ar[1]}</b><span>${ar[3]}</span></div>`).join('')}</div>
        <div class="panel"><h2>Лента цеха</h2>
          <div class="portal-feed">${(p.status==='done'&&p.feedDone?p.feedDone:p.feed).slice(0,6).map(f=>`<div class="of-row">⚙ ${f}</div>`).join('')||'<div class="od-gov empty-note">Цех набирает обороты…</div>'}</div></div>
      </div>
    </div>`;

  $('#ppBack2',root).onclick = () => { portalState.screen='orders'; portalState.selectedProject=null; renderPortalStage(); };
  const ok = $('#ppOk',root); if(ok) ok.onclick = () => {
    if(fgGate){ const msg = fgGate(p,true); toast(msg||'Утверждено'); }
    else { p.status='run'; p.gate=null; toast('Ворота открыты'); }
    renderProjectDetail(root);
  };
  const no = $('#ppNo',root); if(no) no.onclick = () => {
    const cmt = $('#ppCmt',root).value.trim();
    if(!cmt){ toast('При возврате комментарий обязателен'); return; }
    if(fgGate){ const msg = fgGate(p,false,cmt); toast(msg||'Возвращено на доработку'); }
    else { p.status='run'; p.gate=null; toast('Возвращено на доработку'); }
    renderProjectDetail(root);
  };
}

/* ========================================================================== */
/*  СЧЕТА                                                                     */
/* ========================================================================== */
function renderBills(root){
  const inv = sredaInvoices ? sredaInvoices() : [];
  const total = sredaSpend ? sredaSpend() : inv.reduce((a,i)=>a+i.amount,0);
  root.innerHTML = portalHead('🧾','Счета Среды','Оплата платформе: этапы Forge, подписки и принятые результаты Talent') + `
    <div class="grid-kpi" style="margin-bottom:13px">
      <div class="kpi"><div class="l">Всего счетов</div><div class="v">${inv.length}</div><div class="d flat">Forge + Talent</div></div>
      <div class="kpi"><div class="l">Сумма</div><div class="v">₽${total.toLocaleString('ru')}</div><div class="d flat">все счета</div></div>
      <div class="kpi"><div class="l">Оплачено</div><div class="v">${inv.filter(i=>i.status==='оплачен').length}</div><div class="d up">✓</div></div>
      <div class="kpi"><div class="l">Ожидает оплаты</div><div class="v">${inv.filter(i=>i.status!=='оплачен').length}</div><div class="d ${inv.some(i=>i.status!=='оплачен')?'acc':'flat'}">→</div></div>
    </div>
    <div class="panel"><h2>Инвойсы <span class="tag">каждый рубль привязан к результату</span></h2>
      <div class="table-wrap"><table><thead><tr><th>Назначение</th><th>Тип</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
        ${inv.map(i=>`<tr><td>${i.title}</td><td>${i.kind==='forge'?'🏭 Forge':i.kind==='staff'?'🌊 подписка':'🌊 результат'}</td><td><b>₽${i.amount.toLocaleString('ru')}</b></td><td><span class="gp-bdg ${i.status==='оплачен'?'ok':'acc'}">${i.status}</span></td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
}

/* ========================================================================== */
/*  ПОДДЕРЖКА                                                                 */
/* ========================================================================== */
function renderSupport(root){
  root.innerHTML = portalHead('💬','Поддержка','Помощь по платформе Среды') + `
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h2>Частые вопросы</h2>
        <div class="portal-faq">
          <details><summary>Как нанять агента?</summary><p>Выберите агента в каталоге, нажмите «Нанять за результат» или «В штат». Оплата только за принятый результат.</p></details>
          <details><summary>Что такое «ворота» в производстве?</summary><p>Контрольные точки между этапами. Вы утверждаете результат — бригада идёт дальше. Возвращаете — перерабатывает.</p></details>
          <details><summary>Можно ли связаться с агентом напрямую?</summary><p>Да: Telegram, Email или чат в Среде. Все каналы синхронизированы — агент ответит в любом.</p></details>
          <details><summary>Что если результат не устроит?</summary><p>Не принимайте — не платите. При найме за результат оплата только после вашего апрува.</p></details>
          <details><summary>Как перейти в Inside?</summary><p>Когда агенты и процессы проверены — подключите полную операционную систему компании. Пишите нам.</p></details>
        </div>
        <button class="btn go" id="psChat" style="width:100%;margin-top:12px">💬 Написать в поддержку</button>
      </div>
      <div class="panel">
        <h2>Контакты</h2>
        <div class="pa-stats">
          <div><span>Email</span><b>hello@sreda.app</b></div>
          <div><span>Telegram</span><b>@sreda_support</b></div>
          <div><span>Время ответа</span><b>≤ 2 часа</b></div>
        </div>
      </div>
    </div>`;
  $('#psChat',root).onclick = () => { $('#overlay').classList.add('show'); $('#taskText').focus(); };
}

/* ========================================================================== */
/*  МОДАЛКА «Поставить задачу»                                               */
/* ========================================================================== */
function wirePortalModal(){
  const overlay = $('#overlay');
  const close = () => overlay && overlay.classList.remove('show');
  const mClose = $('#mClose'); if(mClose) mClose.onclick = close;
  if(overlay) overlay.onclick = (e) => { if(e.target===overlay) close(); };
  /* примеры запросов — кликабельные чипы */
  const mEx = $('#mEx');
  if(mEx){
    const samples = [
      'Разбор воронки регистраций за май',
      'RFM-сегментация клиентской базы',
      'Регресс-набор для модуля оплаты',
      'Финмодель запуска нового тарифа',
    ];
    mEx.innerHTML = samples.map(s=>`<button type="button" class="pc-ex-chip">${s}</button>`).join('');
    mEx.querySelectorAll('.pc-ex-chip').forEach(b=>b.onclick=()=>{ const t=$('#taskText'); t.value=b.textContent; t.focus(); });
  }
  const mGo = $('#mGo'); if(mGo) mGo.onclick = () => {
    const v = $('#taskText').value.trim();
    if(!v){ toast('Опишите задачу'); return; }
    toast('Задача принята — подбираем агента в каталоге…'); close();
    $('#taskText').value = '';
    portalState.screen = 'catalog'; renderPortalNav(); renderPortalStage();
  };
  const cmdBtn = $('#cmdBtn'); if(cmdBtn) cmdBtn.onclick = () => { overlay.classList.add('show'); $('#taskText').focus(); };
  document.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); overlay.classList.add('show'); $('#taskText').focus(); }
    if(e.key==='Escape') close();
  });
}

/* ── старт ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPortal);
} else {
  initPortal();
}
