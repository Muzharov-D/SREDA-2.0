/* ========================================================================== */
/*  KAM-ASSIST — живой личный ассистент как постоянная панель справа.          */
/*  Едет с пользователем по ВСЕМ экранам: видит контекст текущего окна,        */
/*  отвечает в диалоге и ДЕЙСТВУЕТ (навигация, открытие документов, разбор).   */
/*  Никакого захардкоженного тура — только реальный ассистент. Только ?org=kam.*/
/* ========================================================================== */
(function(){
  'use strict';
  if (!window.__ORG_KAM) return;

  /* ── персона: двойник руководителя текущего кабинета ── */
  function persona(){
    if (state.ws === 'owner') return { name:'Ассистент платформы', emoji:'🧩', sub:'владелец · Среда' };
    /* личный ассистент = двойник руководителя текущего пользователя (демо-стенд) */
    const u = (typeof window.__kamUser==='function') ? window.__kamUser() : { dept:'mgmt', first:'Вячеслав' };
    const staff = (typeof DIGITAL_STAFF!=='undefined' && DIGITAL_STAFF[u.dept]) || [];
    const w = staff[0];
    return { name: w ? w.name : 'Двойник руководителя', emoji: (w&&w.emoji)||'🏛️', sub:'личный ассистент · '+(u.first||''), w };
  }

  const deptOf = (id)=> DEPARTMENTS.find(d=>d.id===id) || {label:id, icon:''};

  /* ── контекст-карта: что ассистент знает про каждый экран ── */
  function ctxOf(id){
    id = String(id||state.screen||'mypulse');
    const p = id.split(':')[0], arg = id.slice(p.length+1);
    const C = (what, tips, chips)=>({ what, tips, chips });

    /* новые экраны рабочего стола */
    if (id==='mypulse') return C(
      'Ваш рабочий стол: приветствие-резюме дня, что ждёт решения, черновики и документы, цифровые сотрудники в работе, разбор звонков. Стол настраивается — любой блок можно убрать, вернуть, переставить.',
      ['«⚙ Настроить стол» — уберите или верните любой блок','Клик по черновику — откроется документ и я рядом','«Разобрать» в предложениях превращу звонок в задачи'],
      [['Что ждёт меня?','?waiting'],['Открыть черновик','firstdoc'],['Разобрать звонок','mypulse-zoom'],['Пульс отдела','mypulse-dept']]);
    if (id==='mypulse-dept') return C(
      'Пульс отдела «Управление»: что ждёт решения по отделу, поток передач с застрявшим гейтом и загрузка штата — люди и цифровые.',
      ['Красный замок в потоке — передача застряла на вашей приёмке','Загрузка ЦС под 100% — сигнал перераспределить'],
      [['Личный ассистент','mypulse'],['Пульс компании','mypulse-co']]);
    if (id==='mypulse-co') return C(
      'Пульс компании: что висит на стыках отделов, межотделовые передачи и загрузка всех направлений.',
      ['Клик по отделу — провалитесь в его пульс','«Карта оргструктуры» — визуальная схема'],
      [['Личный ассистент','mypulse'],['Карта оргструктуры','pulse']]);
    if (id==='mypulse-zoom') return C(
      'Разбор Zoom-звонка «Гамма»: я выделил кандидатов в задачи и встречу — с цитатами-источниками. Отметьте нужные, я поставлю их цифровым сотрудникам.',
      ['Снимите галочку с лишнего','«Поставить отмеченные» — задачи уйдут ЦС, встреча в календарь'],
      [['Личный ассистент','mypulse']]);
    if (id==='mypulse-doc') return C(
      'Мастерская документа: слева документ, справа — я. Скажите, что изменить: сократить, добавить условия, проверить риски — правлю прямо в тексте.',
      ['Чипсы — быстрые правки','Свободный ввод — любая просьба по документу'],
      [['Сократи вступление','say:Сократи вступление'],['Проверь юр. риски','say:Проверь юр. риски'],['Личный ассистент','mypulse']]);
    if (id==='mypulse-onboard') return C(
      'Онбординг компании: разбор ТЗ на роли и укомплектование штата из библиотеки цифровых сотрудников — «взять» готового или «создать» нового.',
      ['«Укомплектовать компанию» — соберёт штат и назначит РЦС'],
      [['Личный ассистент','mypulse']]);
    if (id==='mypulse-constructor') return C(
      'Конструктор роли: добавить блок или ЦС из каталога, а чего нет — запросить у ЦС-администратора.',
      ['Полезная доработка поднимается в дефолт роли с санкцией владельца'],
      [['Личный ассистент','mypulse']]);

    /* существующие экраны платформы */
    if (id==='pulse') return C(
      'Карта оргструктуры: направления и штат как один организм. Наведите на узел — сотрудник и его задача.',
      ['Клик по направлению — его пульс'],
      [['Пульс компании','mypulse-co'],['Дашборд','exec']]);
    if (id==='exec') return C(
      'Дашборд руководителя: сводка недели, загрузка направлений, след тендера, очередь решений.',
      ['Пункты очереди решений одобряются прямо здесь'],
      [['📁 Проекты департамента','kproj'],['Личный ассистент','mypulse']]);
    if (id==='kproj') return C(
      'Проекты департамента: кросс-функциональная работа — под каждый проект собирается команда из людей и цифровых.',
      ['«＋ Новый проект» — опросник: тип → руководитель → состав'],
      [['📁 Создать проект','kproj-new'],['Личный ассистент','mypulse']]);
    if (id==='kproj-new') return C(
      'Опросник нового проекта: тип, руководитель (сами или назначить), состав из любых направлений.',
      ['Шаг 3: «✨ Рекомендованный состав» соберёт команду по шаблону'],
      [['Отменить и к списку','kproj']]);
    if (p==='kproj') return C(
      'Карточка проекта: этапы и задачи, у каждой — исполнитель и цифровой напарник, приёмка уходит в аудит.',
      ['Чекбокс на задаче = приёмка результата'],
      [['Все проекты','kproj']]);
    if (id==='company') return C(
      'Оргструктура: весь штат по направлениям, KPI-карточки кликабельны.',
      ['Любой человек и цифровой в дереве — кликается в профиль'],
      [['Пульс компании','mypulse-co'],['Личный ассистент','mypulse']]);
    if (p==='team'){ const d=deptOf(arg);
      return C(`Команда «${d.label}»: ${typeof plCh==='function'?plCh(HEADCOUNT[arg]||0):(HEADCOUNT[arg]||'—')+' человек'} + ${DIGITAL_HEADCOUNT[arg]||'—'} цифровых.`,
        ['Клик по цифровому — его должностная инструкция и петля работы'],
        [['Пульс направления','dpulse:'+arg],['Личный ассистент','mypulse']]); }
    if (p==='worker'){ const w=(typeof ALL_DIGITAL!=='undefined')&&ALL_DIGITAL.find(x=>x.id===arg);
      if (w) return C(`Профиль «${w.name}» — ${w.title}. Руководитель: ${w.lead}.`,
        ['«Работа» — петля с точками проверки','«Спецификация» — агенты и пусковой пакет'],
        [['Штат цифровых','workers'],['Личный ассистент','mypulse']]); }
    if (id==='workers') return C(
      `Штат цифровых сотрудников: ${(typeof ALL_DIGITAL!=='undefined'?ALL_DIGITAL.length:0)} именных, у каждого руководитель-человек и петля.`,
      ['Клик по строке — полный профиль'],
      [['Личный ассистент','mypulse']]);
    if (id==='audit') return C(
      'Аудит: каждый черновик, правка, приёмка, отказ по границе — в одной ленте.',
      [],[['Личный ассистент','mypulse']]);

    return C('Экран Среды. Я вижу, где вы, и помогу — спросите «что тут?» или «что мне сделать?».',
      ['Скажите, что открыть или сделать'],
      [['Личный ассистент','mypulse'],['Дашборд','exec']]);
  }

  function screenTitle(){
    const id = state.screen, p = id.split(':')[0], arg = id.slice(p.length+1);
    const NAMED = { mypulse:'Личный ассистент', 'mypulse-dept':'Пульс отдела', 'mypulse-co':'Пульс компании',
      'mypulse-zoom':'Разбор звонка', 'mypulse-doc':'Документ', 'mypulse-onboard':'Онбординг компании',
      'mypulse-constructor':'Конструктор', pulse:'Карта оргструктуры', exec:'Дашборд', company:'Оргструктура',
      workers:'Штат цифровых', audit:'Аудит', kproj:'Проекты департамента', 'kproj-new':'Новый проект' };
    if (NAMED[id]) return NAMED[id];
    if (p==='worker'){ const w=(typeof ALL_DIGITAL!=='undefined')&&ALL_DIGITAL.find(x=>x.id===arg); return w?('Профиль · '+w.name):'Профиль'; }
    if (p==='kproj' && arg){ const pr=(window.__KAM_PROJ||[]).find(x=>x.id===arg); return pr?('Проект · '+pr.name):'Проект'; }
    if (p==='team') return 'Команда · '+deptOf(arg).label;
    if (p==='dpulse') return 'Пульс · '+deptOf(arg).label;
    if (p==='channel') return 'Канал · '+deptOf(arg).label;
    return id;
  }

  /* ── состояние и DOM ── */
  const KA_KEY = 'sreda_kam_panel_open', SEEN_KEY = 'sreda_kam_assist_seen';
  const KA = { open:false, msgs:[] };
  const fab = document.createElement('button');
  fab.id = 'kaFab'; fab.title = 'Личный ассистент — всегда рядом'; fab.innerHTML = '💬';
  const panel = document.createElement('aside');
  panel.id = 'kaPanel'; panel.hidden = true;
  panel.innerHTML = `
    <div class="ka-head">
      <span class="ka-av" id="kaAv">💬</span>
      <div class="ka-who"><b id="kaName">Ассистент</b><small id="kaSub"></small></div>
      <button class="ka-x" id="kaClose" title="Свернуть">✕</button>
    </div>
    <div class="ka-ctx" id="kaCtx"></div>
    <div class="ka-body" id="kaBody"></div>
    <div class="ka-chips" id="kaChips"></div>
    <div class="ka-input"><input id="kaIn" type="text" placeholder="Спросите про этот экран…"/><button id="kaSend">➤</button></div>`;
  document.addEventListener('DOMContentLoaded', ()=>{
    document.body.appendChild(fab); document.body.appendChild(panel);
    try{ if (localStorage.getItem(KA_KEY)==='1') openPanel();
         else if (localStorage.getItem(SEEN_KEY)===null) fab.classList.add('pulse-badge'); }catch(e){}
  });

  const $id = (x)=>document.getElementById(x);
  function say(text, opts){
    KA.msgs.push({ a:text }); const body = $id('kaBody'); if (!body) return;
    const m = document.createElement('div'); m.className='ka-m bot'; body.appendChild(m);
    if (typeof typeInto==='function' && !(opts&&opts.instant)) typeInto(m, text, body);
    else { m.textContent = text; body.scrollTop = body.scrollHeight; }
  }
  function sayUser(text){ KA.msgs.push({u:text}); const body=$id('kaBody'); if(!body) return;
    const m=document.createElement('div'); m.className='ka-m user'; m.textContent=text; body.appendChild(m); body.scrollTop=body.scrollHeight; }

  function refreshHead(){ const pp=persona(); $id('kaAv').textContent=pp.emoji; $id('kaName').textContent=pp.name; $id('kaSub').textContent=pp.sub; }
  function refreshCtx(){
    const ctx = ctxOf(state.screen);
    $id('kaCtx').innerHTML = `<span class="ka-eye">👁</span> вижу экран: <b>${escHtml(screenTitle())}</b>`;
    const chips = $id('kaChips');
    chips.innerHTML = ctx.chips.map((c,i)=>`<button class="ka-chip" data-kc="${i}">${escHtml(c[0])}</button>`).join('')
      + `<button class="ka-chip ghost" data-kc="what">Что это за экран?</button>`;
    chips.querySelectorAll('[data-kc]').forEach(b=>b.onclick=()=>{
      const k=b.dataset.kc;
      if (k==='what'){ sayUser('Что это за экран?'); say(ctx.what); return; }
      const c=ctx.chips[+k]; act(c[1], c[0]);
    });
  }

  /* ── реальный ответ «что ждёт меня»: тянет точки участия из рабочего стола ── */
  function waitingAnswer(){
    const items=(typeof window.__kamWaiting==='function')?window.__kamWaiting():[];
    if(!items.length) return 'Сейчас вас ничего не ждёт — цифровые сотрудники в работе, ближайшее решение к 14:00.';
    const n=items.length, d=n%10, dd=n%100;
    const word=(d===1&&dd!==11)?'решение ждёт':(d>=2&&d<=4&&(dd<10||dd>=20))?'решения ждут':'решений ждут';
    const ic=w=>w.sev==='red'?'🔴':'🟡';
    return `Вас ${word} — ${n}: `+items.map(w=>ic(w)+' '+w.text).join('; ')+'. Все они на рабочем столе в блоке «Ждёт меня».';
  }

  /* ── действия ── */
  function act(action, label){
    if (label) sayUser(label);
    if (action==='?waiting'){ say(waitingAnswer()); return; }
    if (action==='?do'){ const ctx=ctxOf(state.screen); say('Здесь стоит: '+ctx.tips.join('. ')+'.'); return; }
    if (action.indexOf('say:')===0){ respond(action.slice(4)); return; }        // прокинуть как реплику
    if (action==='firstdoc'){ const d=((typeof window.__kamDrafts==='function'&&window.__kamDrafts())||[])[0]; if(d){ window.__MP_DOC=d.id; navTo('mypulse-doc'); say('Открыл черновик — я рядом, правьте словами.'); } else say('Черновиков сейчас нет.'); return; }
    if (action.indexOf('doc:')===0){ window.__MP_DOC=action.slice(4); navTo('mypulse-doc'); say('Открыл документ — я рядом, справа. Скажите, что поправить.'); return; }
    navTo(action);
  }

  /* ── свободный диалог: интенты с учётом текущего экрана ── */
  function openDoc(t){
    const id = /протокол/.test(t)?'protocol-gamma' : /отч[её]т|q3/.test(t)?'report-q3' : /письм|ответ/.test(t)?'email-reply' : 'kp-gamma';
    window.__MP_DOC=id; navTo('mypulse-doc'); say('Открыл документ. Могу сократить, добавить условия, проверить риски — скажите словами.');
  }
  function respond(q){
    const t = q.toLowerCase();
    /* если мы в мастерской документа — просьбы уходят в правку документа */
    if (state.screen==='mypulse-doc'){
      const body=document.querySelector('#mpDocBody');
      if (body){
        if (/скидк/.test(t)){ body.value+='\n\nСпециальные условия: скидка 10% при годовой предоплате.'; return say('Добавил скидку 10% в раздел стоимости.'); }
        if (/сократ|коротк|вступлен/.test(t)){ body.value=body.value.split('\n\n').slice(0,2).join('\n\n'); return say('Сократил — оставил суть в двух абзацах.'); }
        if (/риск|юр/.test(t)){ body.value+='\n\n[Проверка: санкционных рисков нет · справка прилагается]'; return say('Проверил: рисков по контрагенту нет, добавил пометку.'); }
        if (/вежлив|мягч/.test(t)){ body.value='Добрый день!\n\n'+body.value; return say('Смягчил формулировки.'); }
        if (/отправ|соглас/.test(t)){ toast('Отправлено на согласование'); navTo('mypulse'); return say('Отправил на согласование, вернул вас на стол.'); }
        if (/на стол|верн|назад|закрой/.test(t)){ navTo('mypulse'); return say('Вернул вас на рабочий стол.'); }
        /* не правка документа — пропускаем в общую навигацию ниже */
      }
    }
    const ctx = ctxOf(state.screen);
    if (/жд[её]т меня|ждут меня|мои (решени|задач|дел)|(какие|что|сколько).{0,14}(решени|задач)|у меня.{0,14}(решени|задач|дел|на сегодня)|что висит|что важно|что срочн|что по мне|мои дела/.test(t)) return say(waitingAnswer());
    if (/что это|где я|что за экран/.test(t)) return say(ctx.what);
    if (/что (мне )?(с)?делать|что дальше|подскажи/.test(t)) return say('Здесь стоит: '+ctx.tips.join('. ')+'.');
    if (/разбор|звонок|зум|zoom|встреч.*задач/.test(t)) return act('mypulse-zoom','Разобрать звонок');
    if (/пульс отдела|отдел/.test(t)) return act('mypulse-dept','Пульс отдела');
    if (/пульс компании|по компании|вся компания/.test(t)) return act('mypulse-co','Пульс компании');
    if (/карт.*оргструктур|оргструктур|организм/.test(t)) return act('pulse');
    if (/рабочий стол|на стол|верн(и|ись|у|ут)|личн(ый|ого)|ассистент|мой день|пульс(?!\s*(отдел|компан))/.test(t)) return act('mypulse','Личный ассистент');
    if (/черновик|документ|коммерч|протокол|отч[её]т|письм|ответ контр|(^|[^а-яё])кп([^а-яё]|$)/.test(t)) return openDoc(t);
    if (/настро.*стол|кастомиз|убрать блок|добавить блок/.test(t)){ navTo('mypulse'); return say('Открыл стол. Нажмите «⚙ Настроить стол» — там можно убрать, вернуть и переставить любой блок.'); }
    if (/проект/.test(t)) return act('kproj');
    if (/дашборд|сводк/.test(t)) return act('exec');
    if (/аудит/.test(t)) return act('audit');
    if (/штат цифров|двойник|цифров.*сотрудник/.test(t)) return act('workers');
    const w = (typeof ALL_DIGITAL!=='undefined') && ALL_DIGITAL.find(x=>t.indexOf(x.name.toLowerCase())>=0);
    if (w) { navTo('worker:'+w.id); return say('Открыл профиль «'+w.name+'» — вкладки «Работа» и «Спецификация».'); }
    const d = DEPARTMENTS.find(x=>x.label && t.indexOf(x.label.toLowerCase().slice(0, Math.max(4, x.label.length-2)))>=0);
    if (d) { navTo('team:'+d.id); return say('Открыл команду «'+d.label+'».'); }
    if (state.screen==='mypulse-doc') return say('По документу могу: сократить, добавить условия, проверить риски, отправить на согласование. Или скажите «на стол» — вернёмся.');
    say('Понял. Могу открыть: пульс отдела/компании, разобрать звонок, помочь с документом, собрать проект, найти любого сотрудника по имени. Что делаем?');
  }

  function openPanel(){
    KA.open = true; panel.hidden = false; panel.classList.remove('ka-closed'); fab.classList.add('on'); fab.classList.remove('pulse-badge');
    document.body.classList.add('ka-open');
    try{ localStorage.setItem(KA_KEY,'1'); localStorage.setItem(SEEN_KEY,'1'); }catch(e){}
    refreshHead();
    if (!KA.msgs.length){
      const pp = persona();
      say(`Я ${pp.name} — ваш личный ассистент, всегда рядом на любом экране. Сейчас вижу «${screenTitle()}». Спросите что угодно: открыть пульс, разобрать звонок, помочь с документом, собрать проект. С чего начнём?`, {instant:true});
    }
    refreshCtx();
  }
  function closePanel(){ KA.open=false; panel.classList.add('ka-closed'); fab.classList.remove('on'); document.body.classList.remove('ka-open');
    try{ localStorage.setItem(KA_KEY,'0'); }catch(e){}
    setTimeout(()=>{ if(!KA.open) panel.hidden=true; }, 280); }

  fab.onclick = ()=>{ KA.open ? closePanel() : openPanel(); };
  document.addEventListener('click', (e)=>{
    const t = e.target;
    if (t.closest('#kaClose')){ e.stopPropagation(); closePanel(); return; }
    if (t.closest('#kaSend')){ const inp=$id('kaIn'); const v=(inp.value||'').trim(); if(!v) return; inp.value=''; sayUser(v); respond(v); }
  });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && document.activeElement && document.activeElement.id==='kaIn'){
    const inp=$id('kaIn'); const v=(inp.value||'').trim(); if(!v) return; inp.value=''; sayUser(v); respond(v); } });

  /* ── ассистент следит за сменой экрана ── */
  const origNavKA = navTo;
  navTo = function(id, opts){
    const before = state.screen;
    origNavKA(id, opts);
    if (!KA.open || state.screen===before) return;
    refreshHead(); refreshCtx();
    const ctx = ctxOf(state.screen);
    say(ctx.what, {instant:true});
  };
})();
