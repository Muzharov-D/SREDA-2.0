/* ========================================================================== */
/*  KAM-ASSIST — личный ИИ-ассистент как постоянная панель справа              */
/*  Едет с пользователем по ВСЕМ экранам: понимает контекст текущего окна      */
/*  (что открыто, какие данные, что можно сделать), отвечает и ДЕЙСТВУЕТ       */
/*  (навигация, запуск сценариев). Кнопка «Онбординг» ведёт Вячеслава по      */
/*  его маршруту, ассистент комментирует каждый шаг. Только при ?org=kam.     */
/* ========================================================================== */
(function(){
  'use strict';
  if (!window.__ORG_KAM) return;

  /* ── персона ассистента: двойник руководителя текущего кабинета ── */
  function persona(){
    const ws = state.ws;
    if (ws === 'owner') return { name:'Ассистент платформы', emoji:'🧩', sub:'владелец · Среда' };
    if (ws === 'exec' || !DIGITAL_STAFF[ws]) {
      const w = ALL_DIGITAL.find(x=>x.id==='kam-director');
      return { name:w?w.name:'KAM-DIRECTOR', emoji:'🏛️', sub:'личный ассистент Вячеслава', w };
    }
    const w = (DIGITAL_STAFF[ws]||[])[0];
    return w ? { name:w.name, emoji:w.emoji, sub:'ассистент кабинета · '+(w.lead||''), w }
             : { name:'Ассистент Среды', emoji:'💬', sub:'' };
  }

  /* ── контекст-карта: ассистент понимает каждый экран ── */
  function deptOf(id){ return DEPARTMENTS.find(d=>d.id===id) || {label:id, icon:''}; }
  function ctxOf(id){
    id = String(id||state.screen||'pulse');
    const p = id.split(':')[0], arg = id.slice(p.length+1);
    const C = (what, tips, chips)=>({ what, tips, chips });
    if (id==='pulse') return C(
      `Пульс департамента: ${COMPANY_SIZE} людей и ${DIGITAL_SIZE} цифровых как один организм. Частицы — задачи, синапсы — связи из матрицы 9×9.`,
      ['Наведите на нейрон — имя и текущая задача','Клик по направлению — его пульс','Кнопка «▶ Показать поток задач» оживит кадр'],
      [['Оргструктура','company'],['Дашборд','exec'],['Что мне сделать здесь?','?do']]);
    if (id==='exec') return C(
      'Дашборд руководителя: сводка недели, загрузка направлений, след тендера, очередь решений.',
      ['Клик по направлению в «Загрузке» — его команда','Пункты «Очереди решений» одобряются прямо здесь'],
      [['Оргструктура','company'],['Аудит','audit'],['Что мне сделать здесь?','?do']]);
    if (id==='company') return C(
      `Оргструктура: ${TOTAL_STAFF} в штате — ${COMPANY_SIZE} людей + ${DIGITAL_SIZE} цифровых в ${ROLE_IDS.length} направлениях. KPI-карточки кликабельны.`,
      ['Клик «Людей/Функций» раскроет все направления','Любой человек и цифровой в дереве — кликается в профиль'],
      [['Раскрыть все направления','!expand'],['Штат цифровых','workers'],['Пульс','pulse']]);
    if (id==='workers') return C(
      `Штат цифровых сотрудников: ${ALL_DIGITAL.length} именных, у каждого ДИ, руководитель-человек и петля работы.`,
      ['Поиск по имени, должности и обязанностям','Клик по строке — полный профиль'],
      [['Открыть двойника Вячеслава','worker:kam-director'],['Реестр агентов','agents']]);
    if (id==='agents') return C(
      `Реестр агентов: ${ALL_DIGITAL.reduce((s,w)=>s+((w.loop&&w.loop.spec)?w.loop.spec.agents.length:0),0)} агентов в составах — id, MCP, версии, выученные правила.`,
      ['Клик по строке — спецификация носителя','Фильтр по направлению и поиск по правилам'],
      [['Открыть спецификацию KAM-DIRECTOR','worker:kam-director|spec'],['Аудит','audit']]);
    if (id==='audit') return C(
      'Аудит: каждый черновик, правка, приёмка, возврат, отказ по границе и попытка доступа — в одной ленте.',
      ['Записи «обучение» — выученные правила и пополнение пакетов'],
      [['Пульс','pulse'],['Дашборд','exec']]);
    if (id==='aibudget') return C(
      'Бюджеты ИИ: лимиты по направлениям — жёсткая граница; при исчерпании цифровой встаёт на паузу.',
      ['Измените лимит (число + Enter) — пересчёт живой'],
      [['Штат цифровых','workers']]);
    if (p==='team') { const d=deptOf(arg);
      return C(`Команда «${d.label}»: ${HEADCOUNT[arg]||'—'} людей + ${DIGITAL_HEADCOUNT[arg]||'—'} цифровых в одних функциях.`,
        ['Клик по цифровому — его ДИ и петля работы','У людей — «профиль →» с золотым профилем'],
        [['Пульс направления','dpulse:'+arg],['Канал','channel:'+arg],['Что мне сделать здесь?','?do']]); }
    if (p==='dpulse') { const d=deptOf(arg);
      return C(`Пульс «${d.label}»: каждый нейрон — живой сотрудник, импульсы — задачи, ⛔ — гейт.`,
        ['Клик по нейрону — профиль','«▶ Показать поток задач» — пусковая направления'],
        [['Команда','team:'+arg],['Канал','channel:'+arg]]); }
    if (p==='channel') { const d=deptOf(arg);
      return C(`Канал «${d.label}»: люди и цифровые в одном пространстве. Любой ввод живой.`,
        arg==='marketing'?['Карточка «18 MQL» — передача в Продажи одним нажатием']:['Напишите в композер — цифровой сотрудник возьмёт задачу'],
        [['Команда','team:'+arg],['Пульс направления','dpulse:'+arg]]); }
    if (p==='worker') { const w = ALL_DIGITAL.find(x=>x.id===arg);
      if (w) return C(`Профиль «${w.name}» — ${w.title}. Руководитель: ${w.lead}. Вкладка «Работа» — петля, «Спецификация» — агенты и пусковой пакет.`,
        ['Запустите сценарий — черновик, точки проверки, приёмка','Правка своими словами станет правилом (двойник выучит)','«🚀 Пусковой пакет» — запуск вне демо'],
        [['▶ Запустить первый сценарий','!scenario'],['Открыть спецификацию','!spec'],['Штат цифровых','workers']]); }
    if (p==='person') return C('Золотой профиль человека: данные из всех систем, у каждого поля — источник.',
      ['Вкладка «Рой и ИИ» — его цифровые подчинённые'],[['Назад к команде','team:'+arg.split(':')[0]]]);
    if (p==='asst') return C('Личный чат кабинета. Я — тот же ассистент, но теперь я всегда справа и вижу каждый экран.',
      ['Можете писать мне здесь или в панели — контекст один'],[['Пульс','pulse']]);
    if (p==='flow') return C('Передачи: выход одного — вход другого. Гейт не пустит дальше при открытом sev1.',
      ['«Принять и передать дальше» двигает поток'],[['Передачи компании','flowx']]);
    if (ROLE_IDS.includes(id)) { const d=deptOf(id);
      return C(`Рабочий стол «${d.label}»: артефакт с точками проверки — правьте руками, гейт не даст принять непроверенное.`,
        ['💡 подставляет исправление, можно править своё','Очередь работы — вкладки сверху'],
        [['Команда','team:'+id],['Что мне сделать здесь?','?do']]); }
    return C('Экран Среды. Я вижу, где вы, и помогу сориентироваться.',['Спросите «что это?» или «что мне сделать?»'],[['Пульс','pulse'],['Дашборд','exec']]);
  }

  /* ── онбординг Вячеслава: маршрут с комментарием на каждом шаге ── */
  const ONB = [
    { s:'pulse', say:'Добро пожаловать, Вячеслав. Это ваш департамент вживую: 21 человек и 34 цифровых сотрудника. Частицы — реальные задачи; наведите на любой нейрон. Когда осмотритесь — «Далее».' },
    { s:'exec', say:'Ваш дашборд. Утренний брифинг я собираю к 09:00; отклонения план/факт выше 15% приходят алертом сами. Ниже — след тендера РЖД и очередь решений.' },
    { s:'company', say:`Оргструктура: ${TOTAL_STAFF} в штате, 62% — цифровые. Нажмите карточку «Людей» — раскроются все направления до людей и их цифровых.` },
    { s:'team:sales', say:'Команда Продаж: 4 человека и 6 цифровых в одних функциях. У каждого цифрового — должностная инструкция с границами. Кликните «PLATFORM-SALES-AI» — или жмите «Далее», я открою сама.' },
    { s:'worker:platform-sales-ai', say:'Профиль цифрового сотрудника. Сейчас главное: вкладка «Работа» уже открыта — это петля. Жмите «Далее», я запущу сценарий «Собери КП для банка».' },
    { s:'worker:platform-sales-ai', do:()=>{ const b=document.querySelector('[data-sc]'); if(b) b.click(); },
      say:'Смотрите: агенты работают по базам, черновик собирается, и в нём — точки проверки. Красная — скидка выше политики. Попробуйте «Отправить клиенту сейчас» — он откажется: границы исполняются кодом. Снимите точки (💡 или своя правка — она станет правилом) и примите.' },
    { s:'worker:platform-sales-ai', do:()=>{ const t=document.querySelector('.gp-tab[data-t="spec"]'); if(t) t.click(); },
      say:'Спецификация: из каких агентов он собран, их промпты, MCP-контракты, выученные правила. Кнопка «🚀 Пусковой пакет» — и этот сотрудник работает в любом LLM-чате уже сегодня.' },
    { s:'agents', say:'Реестр всех агентов департамента: у каждого версия и журнал выученного. Они умнеют от ваших приёмок и возвратов — не от промпт-инженеров.' },
    { s:'channel:marketing', say:'Канал Маркетинга. Карточка «18 MQL» — нажмите «Передать в Продажи»: скоринг, распределение, и лиды у менеджеров за 15 минут вместо 2 дней.' },
    { s:'mgmt', say:'Ваш рабочий стол. В брифинге гейт поймал дубль CRM, завысивший прогноз на 8,4 млн — «Утвердить» заблокировано, пока вы не поправите. Так выглядит «никаких волшебных кнопок».' },
    { s:'audit', say:'И финал: всё, что вы сейчас делали, — здесь. Каждый черновик, правка, отказ, выученное правило. Онбординг завершён — я всегда справа, на любом экране. Спросите меня что угодно.' },
  ];
  const ONB_KEY = 'sreda_kam_onb';

  /* ── состояние и DOM панели ── */
  const KA = { open:false, onb:-1, msgs:[] };
  const fab = document.createElement('button');
  fab.id = 'kaFab'; fab.title = 'Личный ассистент — всегда рядом';
  fab.innerHTML = '💬';
  const panel = document.createElement('aside');
  panel.id = 'kaPanel'; panel.hidden = true;
  panel.innerHTML = `
    <div class="ka-head">
      <span class="ka-av" id="kaAv">💬</span>
      <div class="ka-who"><b id="kaName">Ассистент</b><small id="kaSub"></small></div>
      <button class="ka-onb" id="kaOnb" title="Провести по платформе">🎓 Онбординг</button>
      <button class="ka-x" id="kaClose" title="Свернуть">✕</button>
    </div>
    <div class="ka-ctx" id="kaCtx"></div>
    <div class="ka-body" id="kaBody"></div>
    <div class="ka-chips" id="kaChips"></div>
    <div class="ka-onbbar" id="kaOnbBar" hidden>
      <span id="kaOnbStep"></span>
      <button id="kaOnbPrev">← Назад</button>
      <button id="kaOnbNext" class="go">Далее →</button>
      <button id="kaOnbStop" title="Выйти из онбординга">✕</button>
    </div>
    <div class="ka-input"><input id="kaIn" type="text" placeholder="Спросите про этот экран…"/><button id="kaSend">➤</button></div>`;
  document.addEventListener('DOMContentLoaded', ()=>{ document.body.appendChild(fab); document.body.appendChild(panel);
    /* первый вход: предложить онбординг бейджем */
    try{ if (localStorage.getItem(ONB_KEY)===null) fab.classList.add('pulse-badge'); }catch(e){}
  });

  const $id = (x)=>document.getElementById(x);
  function say(text, opts){
    KA.msgs.push({ a:text });
    const body = $id('kaBody'); if (!body) return;
    const m = document.createElement('div'); m.className='ka-m bot';
    body.appendChild(m);
    if (typeof typeInto==='function' && !(opts&&opts.instant)) typeInto(m, text, body);
    else { m.textContent = text; body.scrollTop = body.scrollHeight; }
  }
  function sayUser(text){ KA.msgs.push({u:text}); const body=$id('kaBody');
    const m=document.createElement('div'); m.className='ka-m user'; m.textContent=text; body.appendChild(m); body.scrollTop=body.scrollHeight; }

  function refreshHead(){
    const pp = persona();
    $id('kaAv').textContent = pp.emoji; $id('kaName').textContent = pp.name; $id('kaSub').textContent = pp.sub;
  }
  function refreshCtx(withMsg){
    const ctx = ctxOf(state.screen);
    const d = DEPARTMENTS.find(x=>state.screen.indexOf(x.id)>=0);
    $id('kaCtx').innerHTML = `<span class="ka-eye">👁</span> вижу экран: <b>${escHtml(screenTitle())}</b>`;
    const chips = $id('kaChips');
    chips.innerHTML = ctx.chips.map((c,i)=>`<button class="ka-chip" data-kc="${i}">${escHtml(c[0])}</button>`).join('')
      + `<button class="ka-chip ghost" data-kc="what">Что это за экран?</button>`;
    chips.querySelectorAll('[data-kc]').forEach(b=>b.onclick=()=>{
      const k = b.dataset.kc;
      if (k==='what'){ sayUser('Что это за экран?'); say(ctx.what); return; }
      const c = ctx.chips[+k]; act(c[1], c[0]);
    });
    if (withMsg) say(ctx.what, {instant:false});
  }
  function screenTitle(){
    const id = state.screen, p = id.split(':')[0], arg = id.slice(p.length+1);
    if (p==='worker'){ const w=ALL_DIGITAL.find(x=>x.id===arg); return w?('Профиль · '+w.name):'Профиль цифрового'; }
    if (p==='team') return 'Команда · '+deptOf(arg).label;
    if (p==='dpulse') return 'Пульс · '+deptOf(arg).label;
    if (p==='channel') return 'Канал · '+deptOf(arg).label;
    if (ROLE_IDS.includes(id)) return 'Рабочий стол · '+deptOf(id).label;
    return ({pulse:'Пульс департамента', exec:'Дашборд', company:'Оргструктура', workers:'Штат цифровых', agents:'Реестр агентов', audit:'Аудит', aibudget:'Бюджеты ИИ'})[id] || id;
  }
  function act(action, label){
    if (label) sayUser(label);
    if (action==='?do'){ const ctx=ctxOf(state.screen); say('Здесь стоит: '+ctx.tips.join('. ')+'.'); return; }
    if (action==='!expand'){ const k=document.querySelector('[data-kexp]'); if(k){ k.click(); say('Раскрыла все направления — люди и цифровые по функциям.'); } return; }
    if (action==='!scenario'){ const b=document.querySelector('[data-sc]'); if(b){ b.click(); say('Запустила первый сценарий — смотрите шаги агентов и черновик с точками проверки.'); } else say('Откройте вкладку «Работа» — там сценарии.'); return; }
    if (action==='!spec'){ const t=document.querySelector('.gp-tab[data-t="spec"]'); if(t){ t.click(); say('Открыла спецификацию: состав, промпты, MCP и пусковой пакет.'); } return; }
    if (action.indexOf('|spec')>0){ const scr=action.split('|')[0]; navTo(scr); setTimeout(()=>{ const t=document.querySelector('.gp-tab[data-t="spec"]'); if(t) t.click(); }, 80); return; }
    navTo(action);
  }

  /* ── свободный ввод: интенты с контекстом экрана ── */
  function respond(q){
    const t = q.toLowerCase(), ctx = ctxOf(state.screen);
    if (/онбординг|провед|экскурс|покажи платформу|обучение/.test(t)) return onbStart();
    if (/что это|где я|что за экран/.test(t)) return say(ctx.what);
    if (/что (мне )?(с)?делать|что дальше|подскажи/.test(t)) return say('Здесь стоит: '+ctx.tips.join('. ')+'.'+(KA.onb>=0?'':' Или скажите «онбординг» — проведу по всей платформе.'));
    if (/пульс/.test(t)) return act('pulse');
    if (/оргструктур|компан/.test(t)) return act('company');
    if (/дашборд|сводк/.test(t)) return act('exec');
    if (/реестр|агент/.test(t) && /реестр|все агент/.test(t)) return act('agents');
    if (/аудит/.test(t)) return act('audit');
    const w = ALL_DIGITAL.find(x=>t.indexOf(x.name.toLowerCase())>=0);
    if (w) { navTo('worker:'+w.id); return say('Открыла профиль «'+w.name+'» — вкладка «Работа» с петлёй и «Спецификация» с агентами.'); }
    if (/штат цифров|двойник/.test(t) && !/запус/.test(t)) return act('workers');
    if (/запусти сценарий|запусти задачу/.test(t)) return act('!scenario');
    if (/специфика/.test(t)) return act('!spec');
    const d = DEPARTMENTS.find(x=>x.archetype==='cockpit' && t.indexOf(x.label.toLowerCase().slice(0, Math.max(4, x.label.length-2)))>=0);
    if (d) { navTo('team:'+d.id); return say('Открыла команду «'+d.label+'»: '+(HEADCOUNT[d.id]||'')+' людей + '+(DIGITAL_HEADCOUNT[d.id]||'')+' цифровых.'); }
    say('Поняла. На этом экране я могу: '+ctx.tips.join('. ')+'. Могу открыть: пульс, оргструктуру, дашборд, реестр агентов, аудит, любой профиль по имени — или скажите «онбординг».');
  }

  /* ── онбординг ── */
  function onbGo(i){
    if (i<0 || i>=ONB.length){ return onbStop(i>=ONB.length); }
    KA.onb = i;
    try{ localStorage.setItem(ONB_KEY, String(i)); }catch(e){}
    const st = ONB[i];
    if (state.screen !== st.s) navTo(st.s);
    if (st.do) setTimeout(st.do, 350);
    $id('kaOnbBar').hidden = false;
    $id('kaOnbStep').textContent = 'Шаг '+(i+1)+' из '+ONB.length;
    $id('kaOnbNext').textContent = i===ONB.length-1 ? 'Завершить ✓' : 'Далее →';
    setTimeout(()=>{ refreshCtx(false); say(st.say); }, st.do?700:250);
  }
  function onbStart(){ openPanel(); say('Начинаем онбординг: '+ONB.length+' шагов, ~5 минут. Я поведу и всё объясню.', {instant:true}); onbGo(0);
    pushAudit({who:'ассистент', emoji:'🎓', act:'онбординг начат', dept:'платформа'}); }
  function onbStop(finished){
    KA.onb = -1; $id('kaOnbBar').hidden = true;
    try{ localStorage.setItem(ONB_KEY, finished?'done':'stopped'); }catch(e){}
    if (finished){ say('Онбординг завершён 🎉 Я остаюсь справа на каждом экране: спрашивайте, прошу задачи, открываю профили. Кнопка 🎓 повторит маршрут.');
      pushAudit({who:'ассистент', emoji:'🎓', act:'онбординг завершён', dept:'платформа'}); }
  }

  function openPanel(){
    KA.open = true; panel.hidden = false; fab.classList.add('on'); fab.classList.remove('pulse-badge');
    document.body.classList.add('ka-open');
    refreshHead();
    if (!KA.msgs.length){
      const pp = persona();
      say('Я '+pp.name+' — ваш личный ассистент. Я вижу каждый экран, на котором вы находитесь, и действую: открываю, запускаю, объясняю. Нажмите «🎓 Онбординг» — проведу по платформе за 5 минут.', {instant:true});
      refreshCtx(false);
    } else refreshCtx(false);
  }
  function closePanel(){ KA.open=false; panel.hidden=true; fab.classList.remove('on'); document.body.classList.remove('ka-open'); }

  fab.onclick = ()=>{ KA.open ? closePanel() : openPanel(); };
  document.addEventListener('click', (e)=>{
    if (e.target && e.target.id==='kaClose') closePanel();
    if (e.target && e.target.id==='kaOnb') onbStart();
    if (e.target && e.target.id==='kaOnbNext'){ onbGo(KA.onb+1); }
    if (e.target && e.target.id==='kaOnbPrev'){ onbGo(Math.max(0, KA.onb-1)); }
    if (e.target && e.target.id==='kaOnbStop'){ onbStop(false); say('Вышли из онбординга — продолжить можно кнопкой 🎓.'); }
    if (e.target && e.target.id==='kaSend'){ const inp=$id('kaIn'); const v=(inp.value||'').trim(); if(!v) return; inp.value=''; sayUser(v); respond(v); }
  });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && document.activeElement && document.activeElement.id==='kaIn'){ const inp=$id('kaIn'); const v=(inp.value||'').trim(); if(!v) return; inp.value=''; sayUser(v); respond(v); } });

  /* ── ассистент следит за сменой экрана (в т.ч. вне онбординга) ── */
  const origNavKA = navTo;
  navTo = function(id, opts){
    const before = state.screen;
    origNavKA(id, opts);
    if (!KA.open || state.screen===before) return;
    refreshHead(); refreshCtx(false);
    if (KA.onb < 0){ /* короткая контекстная реплика, без спама */
      const ctx = ctxOf(state.screen);
      say(ctx.what, {instant:true});
    }
  };
})();
