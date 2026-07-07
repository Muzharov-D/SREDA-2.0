/* ========================================================================== */
/*  KAM-PROJECT — проектная деятельность как в реальном бизнесе               */
/*  Проект создаётся мастером-опросником: Вячеслав ведёт сам или назначает    */
/*  руководителя проекта; РП собирает кросс-отдельную команду из людей и      */
/*  цифровых. Проект живёт: этапы, задачи с парой «человек + цифровой»,       */
/*  приёмка через петлю, всё в аудите. Только при ?org=kam.                    */
/* ========================================================================== */
(function(){
  'use strict';
  if (!window.__ORG_KAM) return;

  /* ── шаблоны проектов: реальные процессы департамента ── */
  const TPL = [
    { id:'tender', icon:'🏛️', title:'Тендер / госзакупка', goal:'Выиграть лот: от решения об участии до подачи заявки',
      stages:[
        { name:'Решение об участии', tasks:[ {t:'Чек-лист соответствия требованиям', dept:'sales'}, {t:'Оценка трудозатрат по аналогам', dept:'rzd'}, {t:'Экономика лота: цена и маржа', dept:'mgmt'} ] },
        { name:'Подготовка заявки', tasks:[ {t:'Техническое предложение', dept:'dev'}, {t:'Юридическая проверка пакета', dept:'rzd'}, {t:'Банковская гарантия', dept:'sales'} ] },
        { name:'Подача', tasks:[ {t:'Финальная сверка по описи', dept:'sales'}, {t:'Подача с ЭЦП (только человек)', dept:'sales'} ] } ],
      rec:{ people:['sales:Сергей','rzd:Екатерина','dev:Владимир','mgmt:Вячеслав'], digital:['enterprise-sales-gov','agent-projects','rail-tech-lead','agent-reporting'] } },
    { id:'impl', icon:'🚀', title:'Внедрение у клиента', goal:'Развернуть платформу: от контракта до передачи в поддержку',
      stages:[
        { name:'Старт', tasks:[ {t:'Приём требований из продаж', dept:'prod'}, {t:'План работ и вехи', dept:'prod'}, {t:'Доступы и стенды заказчика', dept:'prod'} ] },
        { name:'Развёртывание', tasks:[ {t:'Установка и настройка', dept:'dev'}, {t:'Интеграции с системами клиента', dept:'dev'}, {t:'Обучение пользователей', dept:'dev'} ] },
        { name:'Сдача', tasks:[ {t:'Приёмочные сценарии', dept:'prod'}, {t:'Передача в поддержку с SLA', dept:'prod'} ] } ],
      rec:{ people:['prod:Василий','prod:Мария','dev:Владимир','sales:Виктор'], digital:['agent-implementation','production-deputy','dev-team-lead','agent-support'] } },
    { id:'launch', icon:'📣', title:'Запуск продукта / фичи', goal:'Вывести релиз на рынок: позиционирование, контент, лиды',
      stages:[
        { name:'Подготовка', tasks:[ {t:'Позиционирование и GTM-план', dept:'marketing'}, {t:'Battle cards для продаж', dept:'marketing'}, {t:'Демо-материалы', dept:'dev'} ] },
        { name:'Запуск', tasks:[ {t:'Контент-пакет по каналам', dept:'marketing'}, {t:'Вебинар и рассылка', dept:'marketing'}, {t:'Обработка лидов', dept:'sales'} ] },
        { name:'Разбор', tasks:[ {t:'ROI кампании и конверсия', dept:'marketing'}, {t:'Фидбек клиентов в продукт', dept:'strategy'} ] } ],
      rec:{ people:['marketing:Елена','marketing:Полина','strategy:Елена','sales:Виктор','dev:Алексей'], digital:['marketing-director-ai','product-marketing','agent-content','agent-leadgen','ai-platform-expert'] } },
    { id:'pilot', icon:'🤖', title:'Пилот Авандок.ИИ', goal:'Провести пилот у клиента: демо, критерии успеха, конверсия в контракт',
      stages:[
        { name:'Пресейл', tasks:[ {t:'Требования и критерии успеха', dept:'sales'}, {t:'Демо-стенд под домен клиента', dept:'dev'}, {t:'КП пилота', dept:'sales'} ] },
        { name:'Пилот', tasks:[ {t:'Развёртывание в контуре клиента', dept:'dev'}, {t:'Замер метрик по критериям', dept:'strategy'}, {t:'Еженедельные статусы клиенту', dept:'prod'} ] },
        { name:'Конверсия', tasks:[ {t:'Итоговый отчёт по критериям', dept:'strategy'}, {t:'Коммерческое предложение контракта', dept:'sales'} ] } ],
      rec:{ people:['sales:Виктор','dev:Алексей','dev:Виктор','strategy:Елена'], digital:['agent-presale','ai-platform-expert','platform-sales-ai','agent-prodanalytics'] } },
    { id:'free', icon:'✏️', title:'Свободный проект', goal:'',
      stages:[ { name:'Подготовка', tasks:[] }, { name:'Исполнение', tasks:[] }, { name:'Сдача', tasks:[] } ],
      rec:{ people:[], digital:[] } },
  ];

  /* ── стор проектов ── */
  const KEY = 'sreda_kam_projects';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
  function save(list){ try{ localStorage.setItem(KEY, JSON.stringify(list.slice(-20))); }catch(e){} }
  window.__KAM_PROJ = load();
  if (/[?&#]reset\b/.test(location.search + location.hash)){ window.__KAM_PROJ = []; save([]); }

  const peopleOf = (dept)=> (COCKPITS[dept]&&COCKPITS[dept].team||[]).map((t,i)=>({ dept, i, name:(Array.isArray(t)?t[0]:t.name), role:(Array.isArray(t)?t[1]:t.role) }));
  const dLabel = (id)=> (DEPARTMENTS.find(x=>x.id===id)||{label:id}).label;
  const dIcon = (id)=> (DEPARTMENTS.find(x=>x.id===id)||{icon:''}).icon;
  const hh = ()=>{ const t=new Date(); return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); };

  /* ── МАСТЕР: опросник создания проекта ── */
  function renderWizard(root){
    const W = (window.__KPW = window.__KPW || { step:0, tpl:null, name:'', goal:'', due:'', pm:null, people:new Set(), digital:new Set() });
    function draw(){
      const tpl = TPL.find(t=>t.id===W.tpl);
      root.innerHTML = workHead({icon:'📁', label:'Новый проект департамента'}, 'опросник: 4 шага — проект, руководитель, состав, подтверждение') + `
      <div class="kp-steps">${['О проекте','Руководитель','Состав','Подтверждение'].map((s,i)=>`<span class="kp-step ${i===W.step?'on':i<W.step?'done':''}">${i+1}. ${s}</span>`).join('<i>→</i>')}</div>
      <div class="panel kp-body">${body()}</div>
      <div class="kp-nav">
        ${W.step>0?'<button class="btn ghost" id="kpPrev">← Назад</button>':'<span></span>'}
        <button class="btn go" id="kpNext" ${canNext()?'':'disabled'}>${W.step===3?'Создать проект ✓':'Далее →'}</button>
      </div>`;
      wire();
    }
    function canNext(){
      if (W.step===0) return W.tpl && (W.name||'').trim().length>2;
      if (W.step===1) return !!W.pm;
      if (W.step===2) return (W.people.size + W.digital.size) >= 2;
      return true;
    }
    function body(){
      const tpl = TPL.find(t=>t.id===W.tpl);   // body не вложен в draw — своя ссылка на шаблон
      if (W.step===0) return `
        <h2>Что за проект?</h2>
        <div class="kp-tpls">${TPL.map(t=>`<button class="kp-tpl ${W.tpl===t.id?'on':''}" data-tpl="${t.id}"><i>${t.icon}</i><b>${t.title}</b><small>${t.goal||'этапы и состав соберёте сами'}</small></button>`).join('')}</div>
        <div class="kp-f"><label>Название проекта</label><input id="kpName" type="text" value="${escAttr(W.name)}" placeholder="Например: Тендер РЖД · событийная платформа"/></div>
        <div class="kp-f"><label>Цель (критерий успеха)</label><input id="kpGoal" type="text" value="${escAttr(W.goal)}" placeholder="${escAttr((TPL.find(t=>t.id===W.tpl)||{}).goal||'Что считаем успехом')}"/></div>
        <div class="kp-f"><label>Дедлайн</label><input id="kpDue" type="text" value="${escAttr(W.due)}" placeholder="например: 18 июля"/></div>`;
      if (W.step===1) return `
        <h2>Кто ведёт проект?</h2>
        <div class="od-gov" style="margin-bottom:10px">Так работает реальный процесс: Вячеслав ведёт сам — или назначает руководителя проекта, и тогда состав формирует РП.</div>
        <div class="kp-pm ${W.pm==='mgmt:Вячеслав'?'on':''}" data-pm="mgmt:Вячеслав"><b>🏛️ Вячеслав ведёт сам</b><small>глава департамента · полный обзор</small></div>
        <h3 class="kp-h3">…или назначить руководителя проекта:</h3>
        <div class="kp-pmlist">${ROLE_IDS.filter(d=>d!=='mgmt').map(d=>peopleOf(d).map(p=>`<div class="kp-pm sm ${W.pm===d+':'+p.name?'on':''}" data-pm="${d}:${p.name}"><b>${escHtml(p.name)}</b><small>${escHtml(p.role)} · ${escHtml(dLabel(d))}</small></div>`).join('')).join('')}</div>`;
      if (W.step===2){
        const rec = tpl && tpl.rec;
        return `
        <h2>Состав проекта <span class="tag">люди и цифровые из любых направлений — как в жизни</span></h2>
        ${rec && (rec.people.length||rec.digital.length) ? `<button class="btn go" id="kpRec" style="margin-bottom:10px">✨ Рекомендованный состав под «${escHtml(tpl.title)}»</button>`:''}
        <div class="kp-crew">${ROLE_IDS.map(d=>`
          <div class="kp-dept"><b>${dIcon(d)} ${escHtml(dLabel(d))}</b>
            ${peopleOf(d).map(p=>{ const k=d+':'+p.name; return `<label class="kp-pick ${W.people.has(k)?'on':''}"><input type="checkbox" data-pp="${escAttr(k)}" ${W.people.has(k)?'checked':''}/>👤 ${escHtml(p.name)} <small>${escHtml(p.role)}</small></label>`; }).join('')}
            ${(DIGITAL_STAFF[d]||[]).map(w=>{ return `<label class="kp-pick dgt ${W.digital.has(w.id)?'on':''}"><input type="checkbox" data-pd="${escAttr(w.id)}" ${W.digital.has(w.id)?'checked':''}/>${w.emoji} ${escHtml(w.name)} <small>цифровой</small></label>`; }).join('')}
          </div>`).join('')}</div>
        <div class="kp-count">Выбрано: 👤 ${W.people.size} людей · 🤖 ${W.digital.size} цифровых · направлений: ${new Set([...W.people].map(k=>k.split(':')[0]).concat([...W.digital].map(id=>{const w=ALL_DIGITAL.find(x=>x.id===id); return w?w.dept:'';}))).size}</div>`;
      }
      const depts = new Set([...W.people].map(k=>k.split(':')[0]).concat([...W.digital].map(id=>{const w=ALL_DIGITAL.find(x=>x.id===id); return w?w.dept:'';})));
      return `
        <h2>Подтверждение</h2>
        <div class="kp-sum">
          <div class="kp-f ro"><label>Проект</label><b>${(tpl||{}).icon||'📁'} ${escHtml(W.name)}</b></div>
          <div class="kp-f ro"><label>Цель</label><b>${escHtml(W.goal||'—')}</b></div>
          <div class="kp-f ro"><label>Дедлайн</label><b>${escHtml(W.due||'—')}</b></div>
          <div class="kp-f ro"><label>Руководитель проекта</label><b>${escHtml((W.pm||'').split(':')[1]||'')}${W.pm==='mgmt:Вячеслав'?' (ведёт сам)':' — назначен Вячеславом'}</b></div>
          <div class="kp-f ro"><label>Состав</label><b>👤 ${W.people.size} + 🤖 ${W.digital.size} из ${depts.size} направлений</b></div>
          <div class="kp-f ro"><label>Этапы</label><b>${(tpl||TPL[4]).stages.map(s=>s.name).join(' → ')}</b></div>
        </div>
        <div class="od-gov">После создания: РП получает назначение (аудит), у каждой задачи — исполнитель и цифровой напарник, работа идёт через петлю «черновик → правка → приёмка».</div>`;
    }
    function wire(){
      root.querySelectorAll('[data-tpl]').forEach(b=>b.onclick=()=>{ W.tpl=b.dataset.tpl; const t=TPL.find(x=>x.id===W.tpl);
        if (!W.name && t.id!=='free') W.name = t.title+' · ';
        draw(); });
      const nm=root.querySelector('#kpName'); if(nm) nm.oninput=()=>{ W.name=nm.value; root.querySelector('#kpNext').disabled=!canNext(); };
      const gl=root.querySelector('#kpGoal'); if(gl) gl.oninput=()=>{ W.goal=gl.value; };
      const du=root.querySelector('#kpDue'); if(du) du.oninput=()=>{ W.due=du.value; };
      root.querySelectorAll('[data-pm]').forEach(b=>b.onclick=()=>{ W.pm=b.dataset.pm; draw(); });
      root.querySelectorAll('[data-pp]').forEach(c=>c.onchange=()=>{ c.checked?W.people.add(c.dataset.pp):W.people.delete(c.dataset.pp); draw(); });
      root.querySelectorAll('[data-pd]').forEach(c=>c.onchange=()=>{ c.checked?W.digital.add(c.dataset.pd):W.digital.delete(c.dataset.pd); draw(); });
      const rc=root.querySelector('#kpRec'); if(rc) rc.onclick=()=>{ const t=TPL.find(x=>x.id===W.tpl);
        t.rec.people.forEach(k=>W.people.add(k)); t.rec.digital.forEach(k=>W.digital.add(k)); draw();
        toast('Состав собран по шаблону — правьте чекбоксами'); };
      const pv=root.querySelector('#kpPrev'); if(pv) pv.onclick=()=>{ W.step--; draw(); };
      const nx=root.querySelector('#kpNext'); if(nx) nx.onclick=()=>{
        if (!canNext()) return;
        if (W.step<3){ W.step++; if (W.step===2 && W.pm && W.pm!=='mgmt:Вячеслав') W.people.add(W.pm); draw(); return; }
        createProject();
      };
    }
    function createProject(){
      const tpl = TPL.find(t=>t.id===W.tpl)||TPL[4];
      const proj = { id:'kp'+Date.now().toString(36), tpl:W.tpl, icon:tpl.icon, name:W.name.trim(), goal:W.goal.trim(), due:W.due.trim(),
        pm:W.pm, created:hh(),
        people:[...W.people], digital:[...W.digital],
        stages: tpl.stages.map(s=>({ name:s.name, tasks:s.tasks.map(t=>({ ...t, who:null, dw:null, done:false })) })),
        feed:[{t:hh(), e:'Проект создан. РП: '+(W.pm||'').split(':')[1]+(W.pm==='mgmt:Вячеслав'?' (ведёт сам)':' — назначен Вячеславом')}] };
      /* автоназначение: исполнитель = первый человек состава из отдела задачи, напарник = первый цифровой */
      proj.stages.forEach(s=>s.tasks.forEach(tk=>{
        tk.who = (proj.people.find(k=>k.split(':')[0]===tk.dept)||'').split(':')[1]||null;
        const dw = proj.digital.map(id=>ALL_DIGITAL.find(x=>x.id===id)).find(x=>x&&x.dept===tk.dept);
        tk.dw = dw?dw.id:null;
      }));
      window.__KAM_PROJ.unshift(proj); save(window.__KAM_PROJ);
      pushAudit({who:'Вячеслав', emoji:'📁', act:'создан проект «'+proj.name+'» · РП: '+(W.pm||'').split(':')[1]+' · состав 👤'+proj.people.length+'+🤖'+proj.digital.length, dept:'проекты'});
      /* НЕ вакуум: назначения уходят уведомлениями в каналы задействованных направлений */
      const pDepts = [...new Set(proj.people.map(k=>k.split(':')[0]).concat(proj.digital.map(wid=>{const w0=ALL_DIGITAL.find(x=>x.id===wid); return w0?w0.dept:'';})))].filter(Boolean);
      const CH = (window.__CHMSG = window.__CHMSG || {});
      pDepts.forEach(d=>{
        const box = (CH[d] = CH[d] || [...(DEPT_CHANNELS[d]||[])]);
        const names = proj.people.filter(k=>k.split(':')[0]===d).map(k=>k.split(':')[1])
          .concat(proj.digital.map(wid=>ALL_DIGITAL.find(x=>x.id===wid)).filter(w0=>w0&&w0.dept===d).map(w0=>w0.name));
        box.push({ id:'kp-'+proj.id+'-'+d, type:'system', text:'📁 Проект «'+proj.name+'»: в состав включены '+names.join(', ')+' · РП: '+((W.pm||'').split(':')[1]||'')+(proj.due?' · дедлайн '+proj.due:''), time:proj.created });
      });
      proj.feed.unshift({t:proj.created, e:'Назначения отправлены в каналы '+pDepts.length+' направлений'});
      toast('Проект создан — назначения ушли в каналы направлений');
      window.__KPW = null;
      navTo('kproj:'+proj.id);
    }
    draw();
  }

  /* ── СПИСОК проектов ── */
  function renderList(root){
    const P = window.__KAM_PROJ;
    root.innerHTML = workHead({icon:'📁', label:'Проекты департамента'}, 'кросс-отдельная работа: под проект собираются люди и цифровые из разных направлений') + `
      <div class="kp-toolbar"><button class="btn go" id="kpNew">＋ Новый проект (опросник)</button>
        <span class="tag">${P.length?P.length+' активных':'проектов пока нет — создайте первый'}</span></div>
      <div class="kp-grid">${P.map(p=>{
        const all = p.stages.flatMap(s=>s.tasks), done = all.filter(t=>t.done).length;
        const depts = new Set(p.people.map(k=>k.split(':')[0]).concat(p.digital.map(id=>{const w=ALL_DIGITAL.find(x=>x.id===id); return w?w.dept:'';})));
        return `<button class="kp-card" data-kp="${p.id}">
          <div class="kp-card-h"><i>${p.icon}</i><b>${escHtml(p.name)}</b></div>
          <small>РП: ${escHtml((p.pm||'').split(':')[1]||'—')} · 👤${p.people.length}+🤖${p.digital.length} · ${depts.size} направлений${p.due?' · до '+escHtml(p.due):''}</small>
          <div class="track"><div class="fill" style="width:${all.length?Math.round(done/all.length*100):0}%"></div></div>
          <small>${done}/${all.length} задач</small>
        </button>`; }).join('')||'<div class="dwl-empty">Реальный процесс начинается с опросника: тип проекта → руководитель → состав из любых направлений.</div>'}</div>`;
    root.querySelector('#kpNew').onclick = ()=>{ window.__KPW=null; navTo('kproj-new'); };
    root.querySelectorAll('[data-kp]').forEach(b=>b.onclick=()=>navTo('kproj:'+b.dataset.kp));
  }

  /* ── КАРТОЧКА проекта ── */
  function renderProj(root, id){
    const p = window.__KAM_PROJ.find(x=>x.id===id);
    if (!p){ root.innerHTML = workHead({icon:'📁',label:'Проект'},'не найден')+'<div class="dwl-empty">Проект не найден — откройте «Проекты департамента».</div>'; return; }
    const all = p.stages.flatMap(s=>s.tasks), done = all.filter(t=>t.done).length;
    const depts = [...new Set(p.people.map(k=>k.split(':')[0]).concat(p.digital.map(wid=>{const w=ALL_DIGITAL.find(x=>x.id===wid); return w?w.dept:'';})))].filter(Boolean);
    function draw(){
      const dn = p.stages.flatMap(s=>s.tasks).filter(t=>t.done).length;
      root.innerHTML = workHead({icon:p.icon, label:p.name}, (p.goal||'')+' · РП: '+((p.pm||'').split(':')[1]||'—')+(p.due?' · дедлайн '+p.due:'')) + `
      <div class="grid-kpi" style="margin-bottom:12px">
        <div class="kpi"><div class="l">Прогресс</div><div class="v">${all.length?Math.round(dn/all.length*100):0}%</div><div class="d flat">● ${dn}/${all.length} задач</div></div>
        <div class="kpi"><div class="l">Состав</div><div class="v">${p.people.length}+${p.digital.length}</div><div class="d flat">● люди + цифровые</div></div>
        <div class="kpi"><div class="l">Направлений</div><div class="v">${depts.length}</div><div class="d up">▲ кросс-отдельная работа</div></div>
        <div class="kpi"><div class="l">Создан</div><div class="v" style="font-size:16px">${p.created}</div><div class="d flat">● сегодня</div></div>
      </div>
      <div class="two-col" style="align-items:start">
        <div>
          ${p.stages.map((s,si)=>`<div class="panel kp-stage"><h2>${si+1}. ${escHtml(s.name)} <span class="tag">${s.tasks.filter(t=>t.done).length}/${s.tasks.length}</span></h2>
            ${s.tasks.map((tk,ti)=>`<div class="kp-task ${tk.done?'done':''}">
              <label class="kp-chk"><input type="checkbox" data-done="${si}:${ti}" ${tk.done?'checked':''}/></label>
              <div class="kp-task-b"><b>${escHtml(tk.t)}</b>
                <small>${dIcon(tk.dept)} ${escHtml(dLabel(tk.dept))} · 👤 ${escHtml(tk.who||'не назначен')}${tk.dw?(' + '+escHtml((ALL_DIGITAL.find(x=>x.id===tk.dw)||{}).name||'')):''}</small></div>
              ${tk.dw&&!tk.done?`<button class="dwl-btn ghost" data-loop="${escAttr(tk.dw)}" data-task="${si}:${ti}" title="Черновик задачи готовит цифровой — открыть петлю">черновик →</button>`:''}
            </div>`).join('')||'<div class="dwl-empty">задачи добавит РП</div>'}
            <div class="kp-add"><input type="text" data-addin="${si}" placeholder="＋ новая задача этапа…"/><select data-adddept="${si}">${depts.map(d=>`<option value="${d}">${escHtml(dLabel(d))}</option>`).join('')}</select><button class="dwl-btn acc" data-add="${si}">＋</button></div>
          </div>`).join('')}
        </div>
        <div>
          <div class="panel"><h2>Команда проекта</h2>
            ${depts.map(d=>`<div class="kp-team-d"><b>${dIcon(d)} ${escHtml(dLabel(d))}</b>
              ${p.people.filter(k=>k.split(':')[0]===d).map(k=>`<span class="kp-mem">👤 ${escHtml(k.split(':')[1])}</span>`).join('')}
              ${p.digital.map(wid=>ALL_DIGITAL.find(x=>x.id===wid)).filter(w=>w&&w.dept===d).map(w=>`<button class="kp-mem dgt" data-wgo="${w.id}">${w.emoji} ${escHtml(w.name)}</button>`).join('')}
            </div>`).join('')}
            <div class="od-gov" style="margin-top:9px">Выход одного — вход другого: задачи разных направлений в одном проекте, каждый черновик цифрового принимает человек, всё в аудите.</div></div>
          <div class="panel" style="margin-top:12px"><h2>Лента проекта</h2>
            <div class="kp-feed">${p.feed.slice(0,12).map(f=>`<div class="kp-fe"><span>${f.t}</span>${escHtml(f.e)}</div>`).join('')}</div></div>
        </div>
      </div>`;
      wire();
    }
    function wire(){
      root.querySelectorAll('[data-done]').forEach(c=>c.onchange=()=>{
        const [si,ti] = c.dataset.done.split(':').map(Number);
        const tk = p.stages[si].tasks[ti]; tk.done = c.checked;
        if (c.checked){ p.feed.unshift({t:hh(), e:'✓ «'+tk.t+'» — принято ('+(tk.who||'исполнитель')+(tk.dw?' + цифровой напарник':'')+')'});
          pushAudit({who:(tk.who||'исполнитель')+' · проект «'+p.name+'»', emoji:'✓', act:'задача принята: '+tk.t, dept:'проекты'}); }
        save(window.__KAM_PROJ); draw();
      });
      root.querySelectorAll('[data-loop]').forEach(b=>b.onclick=()=>{
        const [si,ti] = b.dataset.task.split(':').map(Number);
        const tk = p.stages[si].tasks[ti];
        /* задача проекта уходит в петлю двойника и закроется обратно в проект */
        window.__DW_TASK = { wid: b.dataset.loop, projId: p.id, si, ti, q: tk.t, who: tk.who };
        navTo('worker:'+b.dataset.loop);
      });
      root.querySelectorAll('[data-wgo]').forEach(b=>b.onclick=()=>navTo('worker:'+b.dataset.wgo));
      root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
        const si = +b.dataset.add;
        const inp = root.querySelector('[data-addin="'+si+'"]'), sel = root.querySelector('[data-adddept="'+si+'"]');
        const v = (inp.value||'').trim(); if (!v){ toast('Опишите задачу'); return; }
        const dept = sel.value;
        const who = (p.people.find(k=>k.split(':')[0]===dept)||'').split(':')[1]||null;
        const dwv = p.digital.map(wid=>ALL_DIGITAL.find(x=>x.id===wid)).find(w=>w&&w.dept===dept);
        p.stages[si].tasks.push({ t:v, dept, who, dw:dwv?dwv.id:null, done:false });
        p.feed.unshift({t:hh(), e:'＋ задача «'+v+'» → '+(who||dLabel(dept))});
        save(window.__KAM_PROJ); draw();
      });
    }
    draw();
  }

  /* ── закрытие задачи проекта из петли (вызывает dw-loop при приёмке) ── */
  window.__KAM_PROJ_DONE = function(projId, si, ti, who){
    const p = window.__KAM_PROJ.find(x=>x.id===projId); if (!p) return null;
    const tk = (p.stages[si]||{tasks:[]}).tasks[ti]; if (!tk || tk.done) return p?{name:p.name, id:p.id}:null;
    tk.done = true;
    p.feed.unshift({ t:hh(), e:'✓ «'+tk.t+'» — принято через петлю ('+(who||tk.who||'исполнитель')+')' });
    pushAudit({ who:(who||tk.who||'исполнитель')+' · проект «'+p.name+'»', emoji:'✓', act:'задача проекта принята через петлю: '+tk.t, dept:'проекты' });
    save(window.__KAM_PROJ);
    return { name:p.name, id:p.id };
  };

  /* ── маршруты и меню ── */
  const exWS = WORKSPACES.find(w=>w.id==='exec');
  if (exWS){ const i = exWS.nav.findIndex(n=>n.id==='flowx');
    exWS.nav.splice(i>=0?i+1:exWS.nav.length, 0, { id:'kproj', label:'Проекты департамента', icon:'📁' }); }
  const origStageKP = renderStage;
  renderStage = function(id){
    if (id==='kproj' || id==='kproj-new' || String(id).indexOf('kproj:')===0){
      const stage = document.getElementById('stage');
      stage.classList.add('full'); stage.innerHTML = '<div class="work" id="work"></div>';
      const root = document.getElementById('work');
      if (id==='kproj') renderList(root);
      else if (id==='kproj-new') renderWizard(root);
      else renderProj(root, id.slice(6));
      return;
    }
    const r = origStageKP.apply(this, arguments);
    /* проекты видны на дашборде Вячеслава, а не только на своём экране */
    if (id==='exec' && window.__KAM_PROJ.length){
      const g = document.querySelector('#work .grid-kpi');
      if (g){
        const box = document.createElement('div');
        box.className = 'panel kp-execpanel';
        box.innerHTML = `<h2>📁 Проекты департамента <span class="tag">${window.__KAM_PROJ.length} активных · клик → карточка</span></h2>
          ${window.__KAM_PROJ.slice(0,4).map(p=>{ const all=p.stages.flatMap(s=>s.tasks), dn=all.filter(t=>t.done).length;
            return `<button class="kp-exec-row" data-kpx="${p.id}"><i>${p.icon}</i><div><b>${escHtml(p.name)}</b><small>РП: ${escHtml((p.pm||'').split(':')[1]||'—')} · ${dn}/${all.length} задач${p.due?' · до '+escHtml(p.due):''}</small></div>
              <span class="kp-exec-pct">${all.length?Math.round(dn/all.length*100):0}%</span></button>`; }).join('')}
          <button class="dwl-btn ghost" data-kpx="new" style="margin-top:7px">＋ Новый проект (опросник)</button>`;
        g.insertAdjacentElement('afterend', box);
        box.querySelectorAll('[data-kpx]').forEach(b=>b.onclick=()=>navTo(b.dataset.kpx==='new'?'kproj-new':'kproj:'+b.dataset.kpx));
      }
    }
    return r;
  };
})();
