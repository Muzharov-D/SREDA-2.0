/* ==========================================================================
   KAM2 — вход через опрос, из которого собирается Среда.
   Модель (из фидбека питча, HANDOFF.md): Среда обслуживает весь спектр —
   от CEO до сметчика, от tech-dir до бухгалтера. Значит опрос меряет ДВЕ оси:
     • ДОМЕН (что за работа): деньги, сметы, код, продажи, люди, документы…
     • УРОВЕНЬ (сениорити): исполнитель → спец → руководитель → директор → владелец.
   Опрос по симптомам (что на экране, за что прилетит, сколько людей под тобой)
   резолвит человека в ближайшую РОЛЬ из базы (100+ ролей = данные, не код) и
   собирает модули по (домен × уровень). «Бери только нужное»: ядро сразу,
   остальное — в «Добавить в Среду».

   Активация: ?org=kam. Файл подключён ПОСЛЕ app.js, забирает #nav и #stage.
   ========================================================================== */
(function(){
  if (!window.__ORG_KAM) return;
  const ORG = window.__ORG || {};
  const DASH = (typeof DASHBOARD !== 'undefined') ? DASHBOARD : {};
  const LS_KEY = 'sreda_kam2_profile_v2';
  const LS_STATE = 'sreda_kam2_state_v1';   // состояние кокпита переживает перезагрузку (готовый продукт, не демка)
  const LS_ONBOARD = 'sreda_kam2_onboarded';   // одноразовый онбординг помощником — показать один раз на роль
  const LS_LAYOUT  = 'sreda_kam2_layout_v1';   // раскладка кабинета, собранная самим пользователем

  /* ---------------------------------------------------------------- утилиты */
  const $  = (s, r) => (r||document).querySelector(s);
  const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const lowerFirst = s => s ? s.charAt(0).toLowerCase()+s.slice(1) : s;
  const cssEsc = s => String(s).replace(/["\\]/g,'\\$&');
  // Превью штата = ровно то, что соберётся в кабинете (один источник правды для опроса и финала).
  // Нужен, потому что показывать в опросе несуществующие «инструменты» — потёмкинская деревня.
  function previewStaff(domain){
    if(!domain) return [];
    const dep = DOMAIN_DEPT[domain];
    const base = (dep && ORG.digital && Array.isArray(ORG.digital[dep]))
      ? ORG.digital[dep].slice(0,4).map(a=>({ e:a.emoji||'🤖', t:a.title||a.name, now:a.now||'на связи' }))
      : (SYNTH_STAFF[domain] || [{e:'🤖',t:'Цифровой двойник',now:'на связи'}]).map(s=>({e:s.e,t:s.t,now:s.now}));
    // РОЙ №2: превью показывало ТОЛЬКО базу, а myStaff добавляет ещё matchedCaps → финал обещал «3 сотрудника»,
    // в рейле оказывалось 5. Обещание и факт должны совпадать — добираем те же подобранные возможности.
    if (profile && profile.domain === domain){
      matchedCaps(base.map(c=>c.t)).forEach(cap=> base.unshift({ e:cap.e, t:cap.t, now:cap.now }));
    }
    return base;
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'null'); } catch(e){ return null; } };
  const save = p  => { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch(e){} };
  const clamp = (x,a,b) => Math.max(a, Math.min(b, x));

  /* ============================================================ ТАКСОНОМИЯ  */
  /* ---- домены (что за работа) ---- */
  const DOMAINS = {
    finance:  { icon:'💰', label:'Деньги и цифры' },
    estimate: { icon:'📐', label:'Сметы и расчёты' },
    eng:      { icon:'⚙️', label:'Инженерия и продукт' },
    sales:    { icon:'📈', label:'Продажи и клиенты' },
    marketing:{ icon:'📣', label:'Маркетинг' },
    ops:      { icon:'🏭', label:'Производство и сроки' },
    hr:       { icon:'🧑‍🤝‍🧑', label:'Люди и найм' },
    legal:    { icon:'📄', label:'Документы и право' },
    project:  { icon:'🗂️', label:'Проекты' },
    analytics:{ icon:'📊', label:'Данные и аналитика' },
    exec:     { icon:'🧭', label:'Руководство и стратегия' },
    assist:   { icon:'🗓️', label:'Ассистент и операционка' },
  };
  /* ---- уровни (сениорити) ---- */
  const LEVELS = ['—','Исполнитель','Специалист','Руководитель','Директор','Владелец'];

  /* ---- база ролей: {title, domain, level}. Расширяется одной строкой. ---- */
  /* ~100 ролей — цель: любой из спектра находит себя. Добавление не трогает код. */
  const ROLES = [
    // finance (деньги и цифры)
    {t:'Помощник бухгалтера', d:'finance', l:1}, {t:'Бухгалтер', d:'finance', l:2}, {t:'Бухгалтер по первичке', d:'finance', l:2},
    {t:'Старший бухгалтер', d:'finance', l:2}, {t:'Экономист', d:'finance', l:2}, {t:'Финансовый аналитик', d:'finance', l:2},
    {t:'Инвестиционный аналитик', d:'finance', l:3}, {t:'Казначей', d:'finance', l:3}, {t:'Аудитор', d:'finance', l:3},
    {t:'Финансовый контролёр', d:'finance', l:3}, {t:'Главный бухгалтер', d:'finance', l:3}, {t:'Финансовый директор', d:'finance', l:4},
    // estimate (сметы и расчёты)
    {t:'Помощник сметчика', d:'estimate', l:1}, {t:'Сметчик', d:'estimate', l:2}, {t:'Инженер-сметчик', d:'estimate', l:2},
    {t:'Специалист по ценообразованию', d:'estimate', l:2}, {t:'Тендерный специалист', d:'estimate', l:2}, {t:'Руководитель сметного отдела', d:'estimate', l:3},
    // eng (инженерия и продукт)
    {t:'Стажёр-разработчик', d:'eng', l:1}, {t:'Разработчик', d:'eng', l:2}, {t:'Frontend-разработчик', d:'eng', l:2},
    {t:'Backend-разработчик', d:'eng', l:2}, {t:'Мобильный разработчик', d:'eng', l:2}, {t:'QA-инженер', d:'eng', l:2},
    {t:'DevOps-инженер', d:'eng', l:2}, {t:'Системный администратор', d:'eng', l:2}, {t:'Дата-инженер', d:'eng', l:3},
    {t:'Архитектор', d:'eng', l:3}, {t:'Техлид', d:'eng', l:3}, {t:'Технический директор', d:'eng', l:4}, {t:'CTO', d:'eng', l:5},
    // sales (продажи и клиенты)
    {t:'Ассистент отдела продаж', d:'sales', l:1}, {t:'Менеджер по продажам', d:'sales', l:2}, {t:'Ключевой менеджер (KAM)', d:'sales', l:2},
    {t:'Менеджер по работе с клиентами', d:'sales', l:2}, {t:'Пресейл-инженер', d:'sales', l:2}, {t:'Руководитель отдела продаж', d:'sales', l:3},
    {t:'Директор по развитию', d:'sales', l:4}, {t:'Коммерческий директор', d:'sales', l:4},
    // marketing (маркетинг)
    {t:'Контент-менеджер', d:'marketing', l:1}, {t:'SMM-специалист', d:'marketing', l:1}, {t:'Маркетолог', d:'marketing', l:2},
    {t:'Performance-маркетолог', d:'marketing', l:2}, {t:'Продукт-маркетолог', d:'marketing', l:2}, {t:'Маркетинг-аналитик', d:'marketing', l:2},
    {t:'Бренд-менеджер', d:'marketing', l:3}, {t:'Глава маркетинга', d:'marketing', l:4},
    // ops (производство и сроки)
    {t:'Оператор', d:'ops', l:1}, {t:'Диспетчер', d:'ops', l:1}, {t:'Мастер участка', d:'ops', l:2}, {t:'Прораб', d:'ops', l:2},
    {t:'Снабженец', d:'ops', l:2}, {t:'Логист', d:'ops', l:2}, {t:'Технолог', d:'ops', l:2}, {t:'Контролёр качества', d:'ops', l:2},
    {t:'Начальник производства', d:'ops', l:3}, {t:'Директор по производству', d:'ops', l:4},
    // hr (люди и найм)
    {t:'Ресёчер', d:'hr', l:1}, {t:'Рекрутер', d:'hr', l:2}, {t:'HR-специалист', d:'hr', l:2}, {t:'Специалист по кадрам', d:'hr', l:2},
    {t:'HR-генералист', d:'hr', l:2}, {t:'Тренинг-менеджер', d:'hr', l:2}, {t:'HR бизнес-партнёр', d:'hr', l:3}, {t:'HR-директор', d:'hr', l:4},
    // legal (документы и право)
    {t:'Помощник юриста', d:'legal', l:1}, {t:'Делопроизводитель', d:'legal', l:1}, {t:'Юрист', d:'legal', l:2},
    {t:'Корпоративный юрист', d:'legal', l:2}, {t:'Комплаенс-менеджер', d:'legal', l:3}, {t:'Юридический директор', d:'legal', l:4},
    // project (проекты)
    {t:'Координатор проектов', d:'project', l:1}, {t:'Проектный менеджер', d:'project', l:2}, {t:'Scrum-мастер', d:'project', l:2},
    {t:'Продакт-менеджер', d:'project', l:3}, {t:'Руководитель проектов', d:'project', l:3}, {t:'Директор PMO', d:'project', l:4},
    // analytics (данные и аналитика)
    {t:'Ассистент аналитика', d:'analytics', l:1}, {t:'Аналитик', d:'analytics', l:2}, {t:'BI-аналитик', d:'analytics', l:2},
    {t:'Веб-аналитик', d:'analytics', l:2}, {t:'Продуктовый аналитик', d:'analytics', l:2}, {t:'Data Scientist', d:'analytics', l:3},
    {t:'Руководитель аналитики', d:'analytics', l:3},
    // exec (руководство и стратегия)
    {t:'Тимлид', d:'exec', l:3}, {t:'Руководитель отдела', d:'exec', l:3}, {t:'Директор направления', d:'exec', l:4},
    {t:'Операционный директор', d:'exec', l:4}, {t:'Стратег', d:'exec', l:4}, {t:'Генеральный директор', d:'exec', l:5},
    {t:'Владелец', d:'exec', l:5}, {t:'Основатель', d:'exec', l:5},
    // assist (ассистент и операционка)
    {t:'Секретарь', d:'assist', l:1}, {t:'Личный ассистент', d:'assist', l:2}, {t:'Ассистент руководителя', d:'assist', l:2},
    {t:'Офис-менеджер', d:'assist', l:2}, {t:'Бизнес-ассистент', d:'assist', l:2}, {t:'Операционный менеджер', d:'assist', l:3},
  ];

  /* ============================================================ ОПРОС      */
  /* Q1–Q3 нащупывают ДОМЕН (по материалу/боли/результату), Q4–Q5 — УРОВЕНЬ. */
  const SURVEY = [
    { kind:'dom', multi:true, q:'С чем вы работаете больше всего?',
      opts:[
        { t:'Таблицы, суммы, расчёты',            dom:{finance:2} },
        { t:'Сметы, расценки, спецификации',      dom:{estimate:2} },
        { t:'Код, консоль, системы',              dom:{eng:2} },
        { t:'Договоры и документы',               dom:{legal:2} },
        { t:'Объекты, склад, поставки',           dom:{ops:2} },
        { t:'Кампании, контент, соцсети',         dom:{marketing:2} },
        { t:'Данные, метрики, дашборды',          dom:{analytics:2} },
        { t:'Календарь, задачи, переписка',       dom:{assist:2} },
      ]},
    { kind:'dom', multi:true, q:'Что для вас — сделанная работа?',
      opts:[
        { t:'Точный расчёт или смета',            dom:{estimate:2} },
        { t:'Работающая система',                 dom:{eng:2} },
        { t:'Закрытая сделка',                    dom:{sales:2} },
        { t:'Запущенная кампания',                dom:{marketing:2} },
        { t:'Закрытая вакансия',                  dom:{hr:2} },
        { t:'Сданный проект или этап',            dom:{project:2} },
        { t:'Принятое решение',                   dom:{exec:2} },
        { t:'Разгруженный руководитель',          dom:{assist:2} },
      ]},
    { kind:'dom', multi:true, q:'Где ошибка обойдётся вам дороже всего?',
      opts:[
        { t:'В цифре или расчёте',                dom:{finance:2} },
        { t:'В сделке с клиентом',                dom:{sales:2} },
        { t:'В правовом вопросе',                 dom:{legal:2} },
        { t:'В сроке или поставке',               dom:{ops:2} },
        { t:'В подборе людей',                    dom:{hr:2} },
        { t:'В сорванном проекте',                dom:{project:2} },
        { t:'В выводе по данным',                 dom:{analytics:2} },
        { t:'В стратегии',                        dom:{exec:2} },
      ]},
    { kind:'lvl', multi:true, q:'Кто отвечает за результат перед вами?',
      opts:[
        { t:'Только я',                           lvl:1 },
        { t:'Один-два человека',                  lvl:2 },
        { t:'Отдел',                              lvl:3 },
        { t:'Несколько отделов',                  lvl:4 },
        { t:'Вся компания',                       lvl:5 },
      ]},
    { kind:'lvl', multi:true, q:'Как принимаются решения в вашей зоне?',
      opts:[
        { t:'Предлагаю — решают выше',            lvl:1 },
        { t:'Решаю сам в своей зоне',             lvl:2 },
        { t:'Утверждаю за команду',               lvl:3 },
        { t:'Задаю правила отделу',               lvl:4 },
        { t:'Финальное слово за мной',            lvl:5 },
      ]},
    { kind:'focus', multi:true, q:'Что сейчас съедает больше всего вашего времени?',
      opts:[
        { t:'Рутина, которую можно передать',      focus:'рутину, которую пора передать' },
        { t:'Сбор данных и отчёты',                focus:'сбор данных и отчёты' },
        { t:'Согласования и решения',              focus:'согласования и решения' },
        { t:'Разбор входящих — почта, звонки, чаты',focus:'разбор входящих' },
        { t:'Контроль, что всё идёт по плану',     focus:'контроль, что всё идёт по плану' },
        { t:'Совещания и созвоны',                 focus:'совещания и созвоны' },
        { t:'Поиск информации — где что лежит',    focus:'поиск информации' },
        { t:'Исправление чужих ошибок',            focus:'исправление чужих ошибок' },
        { t:'Тушение пожаров — всё срочно',        focus:'тушение пожаров' },
      ]},
    { kind:'posture', multi:true, q:'Вам ближе — делать самому или поручать?',
      opts:[
        { t:'Делать самому — так надёжнее',        posture:'делать самому', pk:'self' },
        { t:'Поручать и проверять результат',      posture:'поручать и проверять', pk:'delegate' },
        { t:'Задавать направление, а не делать',   posture:'задавать направление', pk:'direct' },
      ]},
    { kind:'tools', multi:true, q:'Каким ИИ вы уже пользуетесь?',
      opts:[
        { t:'ChatGPT',                    tool:'ChatGPT',            habit:'chat' },
        { t:'Claude',                     tool:'Claude',            habit:'chat' },
        { t:'Gemini / Google',            tool:'Gemini',            habit:'chat' },
        { t:'GigaChat или YandexGPT',     tool:'GigaChat/YandexGPT',habit:'chat' },
        { t:'DeepSeek, Qwen и подобные',  tool:'DeepSeek',          habit:'chat' },
        { t:'Perplexity — поиск с ИИ',    tool:'Perplexity',        habit:'chat' },
        { t:'Корпоративный ИИ у нас внутри', tool:'корпоративный ИИ', habit:'chat' },
        { t:'Copilot в Office',           tool:'Copilot',           habit:'office' },
        { t:'Copilot / Cursor в коде',    tool:'Cursor/Copilot',    habit:'office' },
        { t:'Пробовал, но не прижилось',  tool:null,                habit:'none', solo:true },
        { t:'Ещё не пробовал',            tool:null,                habit:'none', solo:true },
      ]},
    { kind:'industry', multi:true, q:'В какой сфере работает ваша компания?',
      opts:[
        { t:'Строительство и недвижимость', industry:'строительстве' },
        { t:'Финансы и банки',              industry:'финансах' },
        { t:'ИТ и разработка',              industry:'ИТ' },
        { t:'Производство',                 industry:'производстве' },
        { t:'Торговля и ритейл',            industry:'торговле' },
        { t:'Госсектор',                    industry:'госсекторе' },
        { t:'Медицина и фарма',             industry:'медицине' },
        { t:'Образование',                  industry:'образовании' },
        { t:'Логистика и транспорт',        industry:'логистике' },
        { t:'Энергетика и ЖКХ',             industry:'энергетике' },
        { t:'Телеком и связь',              industry:'телекоме' },
        { t:'Агро и пищепром',              industry:'агро' },
        { t:'Услуги / другое',              industry:'услугах' },
      ]},
    { kind:'systems', multi:true, q:'В каких системах вы живёте?',
      opts:[
        { t:'1С (Бухгалтерия, ЗУП, УТ)',        systems:'1С' },
        { t:'SAP, Oracle или своя ERP',         systems:'ERP' },
        { t:'Excel / Google Таблицы',           systems:'Excel' },
        { t:'CRM (Bitrix24, amoCRM, Мегаплан)', systems:'CRM' },
        { t:'Таск-трекеры (Jira, Яндекс.Трекер)',systems:'трекеры' },
        { t:'ЭДО (Диадок, СБИС, КЭДО)',         systems:'ЭДО' },
        { t:'Почта и мессенджеры',              systems:'почта' },
        { t:'Документы и диски (Notion, Диск)', systems:'диски' },
        { t:'Порталы закупок (ЕИС, zakupki)',   systems:'закупки' },
        { t:'САПР и сметы (AutoCAD, Гранд-Смета)',systems:'САПР' },
        { t:'Банк-клиент, казначейство',        systems:'банк' },
        { t:'BI и дашборды (Power BI, DataLens)',systems:'BI' },
        // КРИТИК: без этого варианта 12 систем читаются как «Среда работает только с этими двенадцатью».
        // Вариант ничего не выдумывает и ничего не обещает — он честно снимает ощущение «меня тут нет».
        { t:'Другое — расскажу на пилоте',      systems:null },
      ]},
    // x:'<группа>' — варианты внутри группы взаимоисключающи (модель знает, что «на ты» и «на вы» вместе — бессмыслица)
    { kind:'tone', multi:true, q:'Как вам удобнее общаться?',
      opts:[
        { t:'На «ты», по-простому',         tone:'ты', x:'tone' },
        { t:'На «вы», по-деловому',         tone:'вы', x:'tone' },
        { t:'Коротко, без воды',            brief:true },
      ]},
    { kind:'gripe', multi:true, q:'Что в работе бесит больше всего?',
      opts:[
        { t:'Бесконечные согласования',     gripe:'бесконечные согласования' },
        { t:'Рутина и копипаст',            gripe:'рутина и копипаст' },
        { t:'Информация теряется',          gripe:'информация теряется' },
        { t:'Отчёты и таблицы',             gripe:'отчёты и таблицы' },
        { t:'Вечная спешка',                gripe:'вечная спешка' },
        { t:'Совещания ради совещаний',     gripe:'совещания ради совещаний' },
        { t:'Не найти нужный документ',     gripe:'не найти нужный документ' },
        { t:'Дубли и разночтения в данных', gripe:'дубли и разночтения в данных' },
        { t:'Дёргают по мелочам',           gripe:'дёргают по мелочам' },
      ]},
    // depth перестал быть бинарным: это НАБОР того, что человек хочет видеть.
    // Каждый пункт реально включает свою секцию в карточке ЦС. solo:true — «достаточно результата» отменяет остальные.
    { kind:'depth', multi:true, q:'Что вы хотите видеть, когда ЦС приносит результат?',
      opts:[
        { t:'Достаточно результата',        want:'result', solo:true },
        { t:'Кто именно сделал',            want:'who' },
        { t:'Из чего собран ответ',         want:'prov' },
        { t:'Что цифровой сотрудник знает', want:'mem' },
        { t:'След в аудите',                want:'audit' },
      ]},
  ];

  /* ============================================================ МОДУЛИ     */
  /* domains:'*' = кросс-функциональный; levels:[min,max] — под какой уровень.*/
  /* Кросс-функциональные тянут реальные данные; доменные — role-resonant спеки.*/
  function specRender(spec){ return (w)=> renderSpec(w, spec); }
  const MODULES = [
    /* --- кросс-функциональные (реальные данные) --- */
    { id:'today',   icon:'🗓️', name:'Мой день',            hint:'что ждёт меня прямо сейчас',
      domains:'*', levels:[1,5], render:renderToday },
    { id:'task',    icon:'⚡', name:'Поставить задачу',      hint:'опишите словами — рой разберёт',
      domains:'*', levels:[1,4], render:renderTask },
    { id:'intake',  icon:'📥', name:'Приёмка результатов',   hint:'что готово и ждёт вашего «ок»',
      domains:'*', levels:[1,3], render:renderIntake },
    { id:'pulse',   icon:'📡', name:'Пульс',                 hint:'загрузка направлений и лента',
      domains:'*', levels:[3,5], render:renderPulse },
    { id:'sanctions',icon:'🔐', name:'Решения и санкции',    hint:'где нужно ваше слово',
      domains:'*', levels:[3,5], render:renderSanctions },
    { id:'team',    icon:'👥', name:'Команда и отделы',       hint:'люди и их цифровые двойники',
      domains:'*', levels:[3,5], render:renderTeam },
    { id:'agents',  icon:'🤖', name:'Цифровые сотрудники',    hint:'штат агентов и их инструкции',
      domains:'*', levels:[2,5], render:renderAgents },

    /* --- деньги и цифры --- */
    { id:'fin-recon', icon:'🧾', name:'Сверка и первичка', hint:'акты, расхождения, первичка',
      domains:['finance'], levels:[1,3], render:specRender({ title:'Сверка и первичка', sub:'Что цифровой бухгалтер уже разобрал и держит на проверке', who:'двойник бухгалтера', items:[
        ['🧾','17 актов на сверке — 2 расхождения','контрагенты «Гамма», «Дельта»'],
        ['📎','Первичка за июнь загружена — 4 без скана','нужен оригинал'],
        ['⏳','Дебиторка «Гамма» 340т — просрочка 12 дней','сигнал в продажи'],
      ]}) },
    { id:'fin-report', icon:'📑', name:'Отчётность', hint:'ДДС, НДС, управленческий',
      domains:['finance'], levels:[2,4], render:specRender({ title:'Отчётность', sub:'Отчёты собираются сами — вам остаётся проверить', who:'агент отчётности', items:[
        ['📑','Отчёт о движении ДС за квартал — черновик',''],
        ['💠','НДС к возмещению рассчитан','на подтверждение'],
        ['📊','Управленческий отчёт для директора собран',''],
      ]}) },
    { id:'fin-control', icon:'🎛️', name:'Контроль расходов', hint:'бюджеты, отклонения, платежи',
      domains:['finance'], levels:[3,5], render:specRender({ title:'Контроль расходов', sub:'Где деньги уходят не по плану', items:[
        ['📈','Расходы отдела +14% к плану','разбор по статьям'],
        ['🔐','3 платежа ждут вашего одобрения','₽ на санкцию'],
        ['🪫','Бюджет маркетинга исчерпан на 82%',''],
      ]}) },

    /* --- сметы и расчёты --- */
    { id:'est-calc', icon:'📐', name:'Сметы и расценки', hint:'позиции, пересчёт, база расценок',
      domains:['estimate'], levels:[1,3], render:specRender({ title:'Сметы и расценки', sub:'Что сметный агент пересчитал и подготовил', who:'сметный агент', items:[
        ['📐','Смета «ЖК Ривер» — 142 позиции','пересчёт по расценкам 2026-Q2'],
        ['🔗','ФЕР/ТЕР сверены с базой','2 позиции устарели'],
        ['📄','КП по смете — черновик готов','на вашу проверку'],
      ]}) },
    { id:'est-tender', icon:'🎯', name:'Тендерный расчёт', hint:'НМЦК, поставщики, маржа',
      domains:['estimate'], levels:[2,4], render:specRender({ title:'Тендерный расчёт', sub:'Расчёт под тендер собран — решение за вами', items:[
        ['🎯','Тендер 44-ФЗ: НМЦК рассчитана',''],
        ['⚖️','Сравнение 3 поставщиков по позициям',''],
        ['⚠️','Запас по марже 8% — на грани','нужно решение'],
      ]}) },

    /* --- инженерия --- */
    { id:'eng-review', icon:'🔀', name:'Ревью и релизы', hint:'PR, чек-листы, покрытие',
      domains:['eng'], levels:[1,3], render:specRender({ title:'Ревью и релизы', sub:'Что двойник техлида проверил и подготовил', who:'двойник техлида', items:[
        ['🔀','PR #482 на ревью — 2 замечания',''],
        ['🚀','Релиз 2.4 — чек-лист готов','на выкатку'],
        ['🧪','Покрытие тестами 71%','+4% за неделю'],
      ]}) },
    { id:'eng-inc', icon:'🚨', name:'Инциденты', hint:'алерты, пост-мортемы',
      domains:['eng'], levels:[2,4], render:specRender({ title:'Инциденты', sub:'Что горит и что уже потушено', items:[
        ['✅','Инцидент major закрыт — джиттер в ретраи',''],
        ['🚨','Алерт по латентности API','на разборе'],
        ['📝','Пост-мортем — черновик',''],
      ]}) },
    { id:'eng-sprint', icon:'🏃', name:'Спринт и задачи', hint:'доска, блокеры, оценки',
      domains:['eng'], levels:[1,3], render:specRender({ title:'Спринт и задачи', sub:'Где команда сейчас', items:[
        ['🏃','Спринт: 14 из 19 задач',''],
        ['⛔','3 задачи заблокированы','нужно ваше решение'],
        ['🧾','Оценка ТЗ РЖД готова',''],
      ]}) },

    /* --- продажи --- */
    { id:'sal-funnel', icon:'🫙', name:'Воронка и КП', hint:'сделки, КП, статусы',
      domains:['sales'], levels:[1,3], render:renderFunnel },
    { id:'sal-leads', icon:'🧲', name:'Лиды и скоринг', hint:'MQL, сегменты',
      domains:['sales','marketing'], levels:[1,3], render:specRender({ title:'Лиды и скоринг', sub:'Кого греть в первую очередь', items:[
        ['🧲','18 MQL проскорены — 6 горячих',''],
        ['🏷️','Сегмент АванДата доразмечен',''],
        ['🔗','Маркетинг → Продажи: 18 лидов, 0 потеряно',''],
      ]}) },

    /* --- маркетинг --- */
    { id:'mkt-camp', icon:'📣', name:'Кампании', hint:'GTM, ROI, запуски',
      domains:['marketing'], levels:[1,4], render:specRender({ title:'Кампании', sub:'Что готово к запуску', items:[
        ['📣','GTM-план запуска готов','на согласование'],
        ['💹','ROI кампаний квартала посчитан',''],
        ['🃏','Battle card под клиента',''],
      ]}) },
    { id:'mkt-content', icon:'✍️', name:'Контент-план', hint:'посты, рассылки',
      domains:['marketing'], levels:[1,2], render:specRender({ title:'Контент-план', sub:'Что в очереди на публикацию', items:[
        ['🗓️','Контент-план на месяц',''],
        ['📝','3 поста на согласовании','ждут вашего ок'],
        ['✉️','Рассылка — черновик',''],
      ]}) },

    /* --- производство --- */
    { id:'ops-sched', icon:'📅', name:'График работ', hint:'вехи, SLA, передачи',
      domains:['ops','project'], levels:[1,3], render:specRender({ title:'График работ', sub:'Где стройка/внедрение сейчас', items:[
        ['📅','Внедрение у клиента — веха 3 из 5',''],
        ['⚠️','SLA по 2 объектам под риском','нужно вмешательство'],
        ['➡️','Передача в поддержку готова',''],
      ]}) },
    { id:'ops-supply', icon:'📦', name:'Снабжение', hint:'заявки, поставщики, остатки',
      domains:['ops'], levels:[1,3], render:specRender({ title:'Снабжение', sub:'Что заказать и что задерживается', items:[
        ['📦','Заявка на материалы — 8 позиций',''],
        ['🐢','Поставщик задерживает — сдвиг срока','риск'],
        ['🏬','Остатки на складе пересчитаны',''],
      ]}) },

    /* --- люди и найм --- */
    { id:'hr-hire', icon:'🧑‍💼', name:'Найм и воронка', hint:'отклики, интервью, офферы',
      domains:['hr'], levels:[1,3], render:specRender({ title:'Найм и воронка', sub:'Что HR-агент отобрал', who:'агент HR-операций', items:[
        ['🧑‍💼','24 отклика — топ-5 к интервью',''],
        ['🔐','Оффер аналитику ждёт вашего слова','санкция'],
        ['📌','3 вакансии в работе',''],
      ]}) },
    { id:'hr-onboard', icon:'🌱', name:'Онбординг', hint:'адаптация, IDP, eNPS',
      domains:['hr'], levels:[1,3], render:specRender({ title:'Онбординг', sub:'Как заходят новички', items:[
        ['🌱','Онбординг новичка — день 3 из 14',''],
        ['📋','IDP на согласовании',''],
        ['📈','eNPS собран',''],
      ]}) },

    /* --- документы и право --- */
    { id:'leg-contracts', icon:'📄', name:'Договоры', hint:'правки, подписи, шаблоны',
      domains:['legal'], levels:[1,3], render:specRender({ title:'Договоры', sub:'Что юр-агент подготовил', who:'юридический агент', items:[
        ['📄','Договор с «Гамма» — 2 правки',''],
        ['✍️','3 договора на подписи','ждут вас'],
        ['🗂️','Шаблон NDA обновлён',''],
      ]}) },
    { id:'leg-risk', icon:'🛡️', name:'Реестр рисков', hint:'152-ФЗ, претензии',
      domains:['legal'], levels:[2,4], render:specRender({ title:'Реестр рисков', sub:'Где правовой риск', items:[
        ['🛡️','152-ФЗ: ПДн вычищены из примера',''],
        ['✅','Риск-реестр РЖД в норме',''],
        ['⚖️','2 претензии на разборе',''],
      ]}) },

    /* --- проекты --- */
    { id:'prj-stages', icon:'🗂️', name:'Проекты и этапы', hint:'вехи, статусы, риски',
      domains:['project'], levels:[1,4], render:specRender({ title:'Проекты и этапы', sub:'Где проекты сейчас', items:[
        ['🗂️','Проект РЖД: этап 2 из 4',''],
        ['📤','Статус-отчёт заказчику собран',''],
        ['⚠️','Риск-реестр обновлён',''],
      ]}) },

    /* --- аналитика --- */
    { id:'an-dash', icon:'📊', name:'Дашборды', hint:'метрики, отклонения, срезы',
      domains:['analytics'], levels:[1,4], render:specRender({ title:'Дашборды', sub:'Что данные говорят сегодня', items:[
        ['📊','Недельный дашборд собран',''],
        ['🚨','Отклонение факт/план >15% — алерт',''],
        ['🔭','Срез рынка ECM+GenAI готов',''],
      ]}) },

    /* --- руководство --- */
    { id:'exec-strat', icon:'🧭', name:'Стратегия и цели', hint:'курс, портфель, цели',
      domains:['exec'], levels:[3,5], render:specRender({ title:'Стратегия и цели', sub:'Верхнеуровневая картина', items:[
        ['🔭','Срез рынка к стратсессии готов',''],
        ['🎯','Цели квартала — прогресс',''],
        ['🗃️','Портфель проектов департамента',''],
      ]}) },
  ];

  /* ============================================================ ДВИЖОК     */
  function detectDomain(domScore){
    let best=null, bestV=-1;
    for(const d in domScore){ if(domScore[d]>bestV){ bestV=domScore[d]; best=d; } }
    return bestV>0 ? best : null;
  }
  function topDomains(domScore, n){
    return Object.keys(domScore).filter(d=>domScore[d]>0)
      .sort((a,b)=>domScore[b]-domScore[a]).slice(0,n);
  }
  function detectLevel(lvlSamples){
    if(!lvlSamples.length) return 0;
    const avg = lvlSamples.reduce((a,b)=>a+b,0)/lvlSamples.length;
    return clamp(Math.round(avg),1,5);
  }
  function resolveRole(domain, level){
    if(!domain) return null;
    const cand = ROLES.filter(r=>r.d===domain);
    if(!cand.length) return null;
    cand.sort((a,b)=> Math.abs(a.l-(level||2)) - Math.abs(b.l-(level||2)));
    return cand[0];
  }
  function moduleMatches(m, domain, level){
    const domOk = m.domains==='*' || (domain && m.domains.indexOf(domain)>=0);
    const lvlOk = !m.levels || (level>=m.levels[0] && level<=m.levels[1]);
    return domOk && lvlOk;
  }
  function assembleModules(domain, level){
    const L = level || 2;
    const scored = [];
    MODULES.forEach(m=>{
      if(!moduleMatches(m, domain, L)) return;
      let s = (m.domains!=='*') ? 3 : 1;               // доменное важнее кросс-функционального
      if(m.levels){ const c=(m.levels[0]+m.levels[1])/2; s += 1 - Math.min(1, Math.abs(c-L)/2); }
      scored.push({ id:m.id, s });
    });
    scored.sort((a,b)=> b.s-a.s);
    const ids = scored.map(x=>x.id);
    if(ids.indexOf('today')<0) ids.push('today');       // минимальная опора
    return ids.slice(0,6);
  }

  /* ---------------------------------------------------------------- состояние */
  let profile = null;   // { domain, level, roleTitle, depth, chosen:[ids] }
  let active  = null;
  let firstEnter = false;   // одноразовая анимация проявления кабинета

  /* ---------------------------------------------------------------- стили   */
  function injectStyles(){
    if ($('#kam2Style')) return;
    const s = el('style'); s.id='kam2Style';
    s.textContent = `
    :root{ --k-bg:var(--bg,#121310); --k-panel:var(--panel,#1a1c18); --k-panel2:var(--panel2,#20231e);
      --k-line:var(--line,#2a2e27); --k-line2:var(--line2,#363b33); --k-txt:var(--txt,#f1f0ea); --k-txt2:var(--txt2,#c9cac1);
      --k-dim:var(--muted,#9ca093); --k-gold:var(--acc,#36c994); --k-gold2:var(--acc-hover,#2db886);
      --k-soft:var(--acc-soft,rgba(54,201,148,.1)); --k-on:var(--on-acc,#03130d);
      --k-sh:var(--shadow-sm,0 1px 2px rgba(0,0,0,.35)); --k-sh-md:var(--shadow-md,0 6px 14px rgba(0,0,0,.42));
      --k-sh-xl:var(--shadow-xl,0 24px 56px rgba(0,0,0,.55)); }
    /* БЛОКЕР (рой критиков): .stage в styles.css имеет overflow:hidden и высоту 100vh−topbar.
       app.js кладёт внутрь прослойку .work со скроллом, а kam2 вешает .k2-shell прямо в #stage —
       скроллить было нечему: на 1280×800 половина кабинета была физически недостижима. */
    #stage{ overflow-y:auto; }
    .k2-wrap{ display:flex; flex-direction:column; gap:18px; padding:22px 26px 60px; color:var(--k-txt); }
    /* ---- база опроса ---- */
    /* перф: hero-bg.png весил 5.6МБ и стоял background-attachment:fixed (дорогая композиция,
       из-за неё вис рендер) — под 90% затемнением он был не виден. Оставлены градиенты. */
    /* ЛИНЗА ВИДИМОСТИ: align-items:center + overflow:auto = ловушка flexbox — контент выше контейнера
       выпирает В ОБЕ стороны, но scrollTop не может быть < 0, и верхний оверфлоу недостижим НИЧЕМ.
       На 1280×800 верх карточки результата стоял на -108px: эхо-портрет («Среда прочитала ваши ответы»)
       был обрезан навсегда — то есть вау-момент показа. margin:auto центрирует так же, но при
       переполнении честно упирается в верх. */
    .k2-survey{ position:fixed; inset:0; z-index:120; display:flex; align-items:flex-start; justify-content:center; padding:24px; overflow:auto;
      background:
        radial-gradient(1100px 560px at 72% -12%, rgba(54,201,148,.10), transparent 62%),
        radial-gradient(900px 500px at 20% 110%, rgba(54,201,148,.05), transparent 60%),
        linear-gradient(180deg, #161713, #101109); }
    /* «это не я» — поправить роль в один клик, а не проходить опрос заново */
    .k2-enter-row{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .k2-notme{ background:none; border:none; color:var(--k-dim); font-size:13px; cursor:pointer; text-decoration:underline;
      text-underline-offset:3px; padding:6px 2px; }
    .k2-notme:hover{ color:var(--k-txt); }
    .k2-notme:focus-visible{ outline:2px solid var(--k-gold); outline-offset:2px; border-radius:4px; }
    .k2-near-h{ font-size:13px; color:var(--k-dim); margin:16px 0 9px; }
    .k2-near{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:8px; }
    .k2-near-i{ text-align:left; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:10px; padding:10px 12px; cursor:pointer; transition:.15s; }
    .k2-near-i:hover{ border-color:var(--k-gold); }
    .k2-near-i b{ display:block; font-size:13px; color:var(--k-txt); font-weight:650; }
    .k2-near-i small{ display:block; font-size:11.5px; color:var(--k-dim); margin-top:2px; }
    .k2-near-i:focus-visible{ outline:2px solid var(--k-gold); outline-offset:2px; }
    .k2-survey.leaving{ animation:k2materialize .5s cubic-bezier(.4,0,.2,1) forwards; pointer-events:none; }
    @keyframes k2materialize{ 0%{opacity:1; transform:scale(1)} 100%{opacity:0; transform:scale(1.05)} }
    @keyframes k2fadein{ from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }
    .k2-shell.k2-enter{ animation:k2fadein .55s cubic-bezier(.22,1,.36,1); }
    .k2-card{ width:min(720px,94vw); margin:auto; background:var(--k-panel); border:1px solid var(--k-line); border-radius:18px;
      padding:38px 40px 30px; box-shadow:var(--k-sh-xl); animation:k2rise .5s cubic-bezier(.22,1,.36,1); }
    .k2-eyebrow{ color:var(--k-gold); font-size:11px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; }
    .k2-q{ font-size:24px; line-height:1.26; font-weight:750; margin:14px 0 22px; letter-spacing:-.015em; color:var(--k-txt); }
    .k2-opts{ display:flex; flex-direction:column; gap:9px; }
    .k2-opts.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    @media(max-width:560px){ .k2-opts.grid2{ grid-template-columns:1fr; } }
    .k2-opt{ text-align:left; background:var(--k-panel2); border:1px solid var(--k-line); color:var(--k-txt2);
      border-radius:12px; padding:14px 16px; font-size:14.5px; line-height:1.32; cursor:pointer; transition:.15s cubic-bezier(.4,0,.2,1); }
    .k2-opt:hover{ border-color:var(--k-gold); background:var(--k-soft); color:var(--k-txt); transform:translateY(-1px); box-shadow:var(--k-sh); }
    .k2-opt.chosen{ border-color:var(--k-gold); background:var(--k-soft); color:var(--k-txt); box-shadow:0 0 0 1px var(--k-gold) inset; }
    .k2-progress{ display:flex; gap:6px; margin-top:24px; }
    .k2-dot{ flex:1; height:3px; border-radius:2px; background:var(--k-line); transition:background .3s; }
    .k2-dot.on{ background:var(--k-gold); }
    .k2-sub{ color:var(--k-dim); font-size:14px; margin-top:16px; line-height:1.55; }
    .k2-back{ background:none; border:none; color:var(--k-dim); font-size:13px; cursor:pointer; padding:6px 0; margin-top:14px; }
    .k2-back:hover{ color:var(--k-txt); }
    .k2-cta{ background:var(--k-gold); color:var(--k-on); border:none; font-weight:750; font-size:15px; border-radius:12px;
      padding:14px 28px; cursor:pointer; transition:.15s; box-shadow:var(--k-sh-md); }
    .k2-cta:hover{ background:var(--k-gold2); transform:translateY(-1px); }
    @keyframes k2rise{ 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }
    /* ---- двухпанельная живая сборка ---- */
    .k2-survey.two{ align-items:stretch; justify-content:center; padding:0; }
    .k2-stage2{ display:grid; grid-template-columns:1.1fr .9fr; width:100%; max-width:1160px; margin:auto; }
    .k2-left{ padding:min(7vh,60px) clamp(24px,4vw,52px); display:flex; flex-direction:column; justify-content:center; }
    .k2-right{ background:linear-gradient(180deg,#191b15,#15170f); border-left:1px solid var(--k-line);
      padding:clamp(26px,4.5vh,44px) clamp(22px,2.6vw,32px); display:flex; flex-direction:column; min-height:100vh; }
    @media(max-width:880px){ .k2-stage2{ grid-template-columns:1fr; } .k2-right{ min-height:auto; border-left:none; border-top:1px solid var(--k-line); } .k2-left{ padding:30px 22px; } }
    .k2-right-h{ display:flex; align-items:center; justify-content:space-between; font-size:12px; letter-spacing:.14em;
      text-transform:uppercase; color:var(--k-dim); font-weight:700; }
    .k2-right-h .ttl{ color:var(--k-txt); }
    .k2-live{ display:inline-flex; align-items:center; gap:6px; color:var(--k-gold); font-size:10.5px; }
    .k2-live b{ width:7px; height:7px; border-radius:50%; background:var(--k-gold); animation:k2blink 1.4s infinite; }
    @keyframes k2blink{ 0%,100%{opacity:1} 50%{opacity:.25} }
    /* блок распознавания */
    .k2-detect{ margin:18px 0 20px; }
    .k2-dlabel{ font-size:12px; color:var(--k-dim); margin-bottom:10px; }
    .k2-doms{ display:flex; flex-direction:column; gap:9px; }
    .k2-dom{ position:relative; }
    .k2-dom .t{ display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; align-items:center; }
    .k2-dom .t .lab{ display:flex; gap:7px; align-items:center; }
    .k2-dom.lead .t .lab{ color:var(--k-gold); font-weight:700; }
    .k2-dom .t .p{ color:var(--k-dim); font-size:11px; font-variant-numeric:tabular-nums; }
    .k2-dom .track{ height:7px; border-radius:5px; background:var(--k-line); overflow:hidden; }
    .k2-dom .track i{ display:block; height:100%; width:0; border-radius:5px; background:var(--k-dim); transition:width .6s cubic-bezier(.22,1,.36,1); }
    .k2-dom.lead .track i{ background:linear-gradient(90deg,var(--k-gold2),var(--k-gold)); box-shadow:0 0 14px var(--k-soft); }
    .k2-lvlbox{ margin-top:16px; }
    .k2-lvlbox .t{ display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px; }
    .k2-lvlbox .t b{ color:var(--k-gold); }
    .k2-lvlbox .track{ height:7px; border-radius:5px; background:var(--k-line); overflow:hidden; }
    .k2-lvlbox .track i{ display:block; height:100%; width:0; background:linear-gradient(90deg,var(--k-gold2),var(--k-gold)); border-radius:5px; transition:width .6s cubic-bezier(.22,1,.36,1); }
    .k2-role{ margin-top:16px; padding:14px 16px; border:1px solid var(--k-line); border-radius:12px; background:var(--k-panel);
      font-size:14px; box-shadow:var(--k-sh); }
    .k2-role .rt{ color:var(--k-gold); font-weight:800; font-size:16px; }
    .k2-role .rs{ color:var(--k-dim); font-size:12px; margin-top:2px; }
    .k2-role.pop{ animation:k2pop .5s ease; }
    @keyframes k2pop{ 0%{transform:scale(.96);opacity:.5} 50%{transform:scale(1.02)} 100%{transform:scale(1);opacity:1} }
    /* модули-tray */
    .k2-tray-h{ font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--k-dim); margin:6px 0 12px; font-weight:700; }
    .k2-tray-h b{ color:var(--k-gold); }
    .k2-tray{ display:flex; flex-direction:column; gap:9px; }
    .k2-tray-empty{ color:var(--k-dim); font-size:13px; line-height:1.45; padding:16px; border:1px dashed var(--k-line); border-radius:12px; text-align:center; }
    .k2-tcard{ display:flex; align-items:center; gap:12px; background:var(--k-panel); border:1px solid var(--k-line);
      border-radius:12px; padding:11px 13px; overflow:hidden; box-shadow:var(--k-sh); animation:k2card .5s cubic-bezier(.22,1,.36,1); }
    .k2-tcard.leaving{ animation:k2out .32s ease forwards; }
    .k2-tcard .ci{ font-size:19px; width:22px; text-align:center; }
    .k2-tcard .cn{ font-weight:600; font-size:14px; }
    .k2-tcard .ch{ color:var(--k-dim); font-size:11.5px; margin-top:1px; }
    @keyframes k2card{ 0%{transform:scale(.82) translateY(8px);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1) translateY(0);opacity:1} }
    @keyframes k2out{ to{opacity:0;transform:scale(.9);height:0;padding-top:0;padding-bottom:0;margin-top:-9px} }
    .k2-toast{ margin-top:auto; padding-top:16px; color:var(--k-gold); font-size:13px; line-height:1.4; min-height:20px; opacity:0; transform:translateY(6px); transition:opacity .32s, transform .32s; }
    .k2-toast.show{ opacity:1; transform:translateY(0); }
    /* ---- результат: драматургия узнавания ---- */
    .k2-echo{ margin:16px 0 4px; display:flex; flex-direction:column; gap:9px; }
    .k2-echo-line{ font-size:16px; line-height:1.45; color:var(--k-txt2); padding-left:22px; position:relative; opacity:0; animation:k2echo .55s cubic-bezier(.22,1,.36,1) forwards; }
    .k2-echo-line:before{ content:'“'; position:absolute; left:3px; top:1px; color:var(--k-gold); font-size:22px; line-height:1; }
    @keyframes k2echo{ 0%{opacity:0; transform:translateY(9px)} 100%{opacity:1; transform:translateY(0)} }
    .k2-verdict{ opacity:0; animation:k2echo .6s cubic-bezier(.22,1,.36,1) forwards; margin-top:20px; padding-top:18px; border-top:1px solid var(--k-line); }
    .k2-verdict-lead{ color:var(--k-dim); font-size:13px; margin-bottom:2px; }
    .k2-result h2{ font-size:29px; font-weight:800; letter-spacing:-.02em; margin:2px 0 2px; }
    .k2-result h2 .role{ color:var(--k-gold); }
    .k2-meta{ display:flex; gap:9px; flex-wrap:wrap; margin:12px 0 4px; }
    .k2-pill{ display:flex; align-items:center; gap:7px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:999px; padding:7px 13px; font-size:13px; }
    .k2-pill b{ color:var(--k-gold); }
    .k2-picked{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; margin:18px 0; }
    .k2-mod{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px; box-shadow:var(--k-sh); transition:.15s; }
    .k2-mod .i{ font-size:22px; } .k2-mod .n{ font-weight:700; margin:8px 0 3px; color:var(--k-txt); } .k2-mod .h{ color:var(--k-dim); font-size:13px; line-height:1.4; }
    /* ---- кабинет ---- */
    .k2-nav{ display:flex; flex-direction:column; gap:4px; padding:10px; }
    .k2-nav-lbl{ color:var(--k-dim); font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:12px 12px 4px; }
    .k2-nav-role{ color:var(--k-gold); font-size:12px; padding:0 12px 8px; font-weight:700; }
    .k2-nav-item{ display:flex; align-items:center; gap:11px; padding:11px 12px; border-radius:11px; cursor:pointer; color:var(--k-txt); font-size:14.5px; border:1px solid transparent; }
    .k2-nav-item:hover{ background:var(--k-panel2); }
    .k2-nav-item.on{ background:var(--k-soft); border-color:var(--k-gold); }
    .k2-nav-item.on .ni{ filter:none; }
    .k2-item[style*="pointer"]:hover{ background:var(--k-panel2); }
    .k2-nav-item .ni{ font-size:17px; width:22px; text-align:center; }
    .k2-nav-item small{ display:block; color:var(--k-dim); font-size:11.5px; }
    .k2-add{ margin-top:8px; color:var(--k-gold); font-size:13px; cursor:pointer; padding:11px 12px; border:1px dashed var(--k-line); border-radius:11px; }
    .k2-add:hover{ background:var(--k-panel2); }
    .k2-head{ display:flex; align-items:baseline; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
    .k2-head h1{ font-size:25px; font-weight:800; letter-spacing:-.02em; }
    .k2-head .sub{ color:var(--k-dim); font-size:14px; }
    .k2-grid{ display:grid; gap:12px; }
    .k2-panel{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px 18px; box-shadow:var(--k-sh); }
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
    .k2-btn{ background:var(--k-gold); color:var(--k-on); border:none; font-weight:700; border-radius:10px; padding:11px 18px; cursor:pointer; box-shadow:var(--k-sh-md); transition:.15s; }
    .k2-btn:hover{ background:var(--k-gold2); }
    .k2-ta{ width:100%; min-height:120px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:12px; color:var(--k-txt); padding:14px; font-size:15px; resize:vertical; font-family:inherit; }
    .k2-chip{ display:inline-flex; gap:6px; align-items:center; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:999px; padding:6px 12px; font-size:12.5px; margin:4px 6px 0 0; cursor:pointer; }
    .k2-chip:hover{ border-color:var(--k-gold); }
    .k2-chip.on{ border-color:var(--k-gold); color:var(--k-gold); background:var(--k-soft); }
    /* ЛИНЗА ВИДИМОСТИ: fixed-кнопка сноса накрывала нижнюю половину «+ штат» в скроллящемся рейле —
       промах = мгновенная потеря профиля/штата/раскладки. Резервируем место под неё в конце рейла. */
    #nav{ padding-bottom:64px; }
    .k2-reset{ position:fixed; bottom:16px; left:16px; z-index:60; background:var(--k-panel); border:1px solid var(--k-line); color:var(--k-dim); font-size:12px; border-radius:999px; padding:8px 14px; cursor:pointer; }
    .k2-reset:hover{ color:var(--k-txt); border-color:var(--k-gold); }
    .k2-agent{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px; margin-bottom:12px; }
    .k2-agent .ah{ display:flex; align-items:center; gap:11px; }
    .k2-agent .ah .e{ font-size:24px; } .k2-agent .ah b{ font-size:15px; } .k2-agent .ah small{ display:block; color:var(--k-dim); font-size:12px; }
    .k2-agent .mission{ font-size:14px; color:var(--k-txt); margin:12px 0; line-height:1.45; }
    .k2-agent ul{ margin:6px 0 6px 2px; padding:0; list-style:none; }
    .k2-agent li{ font-size:13px; color:var(--k-dim); padding:3px 0 3px 16px; position:relative; }
    .k2-agent li:before{ content:'·'; position:absolute; left:4px; color:var(--k-gold); }
    .k2-kpi{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .k2-kpi span{ background:var(--k-panel2); border:1px solid var(--k-line); border-radius:8px; padding:5px 9px; font-size:11.5px; }
    .k2-kpi b{ color:var(--k-gold); }
    /* ---- личный ассистент: ядро, present на каждом экране кабинета ---- */
    .k2-shell{ display:flex; gap:18px; align-items:flex-start; }
    .k2-main{ flex:1; min-width:0; }
    .k2-asst{ width:312px; flex-shrink:0; position:sticky; top:14px; align-self:flex-start;
      background:var(--k-panel); border:1px solid var(--k-line); border-radius:16px; padding:16px; box-shadow:var(--k-sh-md); }
    @media(max-width:1024px){ .k2-shell{ flex-direction:column; } .k2-asst{ width:100%; position:static; } }
    .k2-asst-h{ display:flex; align-items:center; gap:11px; padding-bottom:13px; border-bottom:1px solid var(--k-line); }
    .k2-asst-h .av{ width:38px; height:38px; border-radius:11px; background:var(--k-soft); display:flex; align-items:center; justify-content:center; font-size:20px; }
    .k2-asst-h b{ font-size:14.5px; color:var(--k-txt); } .k2-asst-h small{ display:block; color:var(--k-dim); font-size:11.5px; }
    .k2-asst-ctx{ font-size:13.5px; line-height:1.5; color:var(--k-txt2); margin:13px 0; }
    .k2-asst-sec{ font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--k-dim); font-weight:700; margin:15px 0 8px; }
    .k2-asst-rem{ display:flex; gap:9px; align-items:flex-start; width:100%; text-align:left; background:var(--k-panel2);
      border:1px solid var(--k-line); border-radius:11px; padding:10px 12px; margin-bottom:7px; color:var(--k-txt2); font-size:12.5px; line-height:1.35; cursor:pointer; transition:.15s; }
    .k2-asst-rem:hover{ border-color:var(--k-gold); color:var(--k-txt); }
    .k2-asst-chips{ display:flex; flex-wrap:wrap; gap:6px; }
    .k2-asst-input{ display:flex; gap:7px; margin-top:15px; }
    .k2-asst-input input{ flex:1; min-width:0; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:10px; color:var(--k-txt); padding:10px 12px; font-size:13.5px; font-family:inherit; }
    .k2-asst-input input:focus{ outline:none; border-color:var(--k-gold); box-shadow:0 0 0 3px var(--k-soft); }
    .k2-asst-input button{ background:var(--k-gold); color:var(--k-on); border:none; border-radius:10px; width:42px; font-size:16px; font-weight:800; cursor:pointer; }
    .k2-asst-out{ font-size:12.5px; color:var(--k-gold); margin-top:11px; line-height:1.45; }
    /* ---- живые действия в модулях ---- */
    .k2-tag.act{ cursor:pointer; font-family:inherit; transition:.14s; font-size:12.5px; padding:7px 13px; min-height:32px; line-height:1; }
    @media(max-width:640px){ .k2-grid{ grid-template-columns:1fr !important; } }
    .k2-tag.act:hover{ background:var(--k-panel2); color:var(--k-txt); border-color:var(--k-line2); }
    .k2-tag.act.ok{ border-color:var(--k-gold); color:var(--k-gold); }
    .k2-tag.act.ok:hover{ background:var(--k-soft); }
    .k2-item.k2-rowout{ animation:k2rowout .26s ease forwards; }
    @keyframes k2rowout{ to{ opacity:0; transform:translateX(14px); } }
    .k2-empty{ color:var(--k-dim); font-size:13.5px; line-height:1.5; padding:14px 2px; }
    .k2-cabtoast{ position:fixed; left:50%; bottom:22px; transform:translateX(-50%) translateY(12px); z-index:80;
      background:var(--k-panel); border:1px solid var(--k-gold); color:var(--k-txt); font-size:13.5px; font-weight:600;
      padding:11px 18px; border-radius:12px; box-shadow:var(--k-sh-xl); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; }
    .k2-cabtoast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    /* ---- кокпит РЦС: высоты, секции Пульса, точки участия ---- */
    .k2-heights{ display:inline-flex; gap:4px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:11px; padding:4px; margin-bottom:16px; }
    .k2-height{ font-family:inherit; font-size:13.5px; font-weight:600; color:var(--k-dim); background:none; border:none; border-radius:8px; padding:7px 15px; cursor:pointer; transition:.14s; }
    .k2-height:hover{ color:var(--k-txt); }
    .k2-height.on{ background:var(--k-panel); color:var(--k-txt); box-shadow:var(--k-sh); }
    .k2-height.locked{ color:var(--k-faint,#7f847a); cursor:not-allowed; }
    .k2-sec-h{ font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--k-dim); font-weight:700; margin:4px 0 9px; }
    .k2-sec-h b{ color:var(--k-gold); }
    .k2-point{ border-left:3px solid var(--k-line); padding-left:11px; }
    .k2-point.k2-sanction, .k2-point.k2-intake{ border-left-color:#f0794a; }
    .k2-point.k2-clarify, .k2-point.k2-coord{ border-left-color:var(--amber,#fbbf24); }
    .k2-sys{ display:flex; flex-wrap:wrap; gap:14px; padding:9px 14px; margin-bottom:16px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:11px; font-size:12px; color:var(--k-dim); }
    .k2-sys span{ display:inline-flex; align-items:center; gap:5px; }
    .k2-life{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; background:var(--k-panel); border:1px solid var(--k-line); border-radius:11px; padding:11px 14px; box-shadow:var(--k-sh); }
    .k2-life-step{ font-size:12.5px; color:var(--k-dim); }
    .k2-life-step.done{ color:var(--k-txt2); }
    .k2-life-step.now{ color:var(--k-gold); font-weight:700; }
    .k2-life-arr{ color:var(--k-dim); font-size:12px; }
    /* ---- A11y: фокус-кольца на клавиатуре ---- */
    .k2-opt:focus-visible,.k2-cta:focus-visible,.k2-btn:focus-visible,.k2-nav-item:focus-visible,.k2-chip:focus-visible,
    .k2-tag.act:focus-visible,.k2-asst-rem:focus-visible,.k2-add:focus-visible,.k2-back:focus-visible,.k2-asst-input input:focus-visible{
      outline:2px solid var(--k-gold); outline-offset:2px; }
    /* ---- brief «коротко, без воды»: не только текст — реально плотнее вёрстка ---- */
    body.k2-brief .k2-wrap{ gap:12px; padding:16px 20px 44px; }
    body.k2-brief .k2-item{ padding:8px 10px; }
    body.k2-brief .k2-panel{ padding:12px 14px; }
    body.k2-brief .k2-sec-h{ margin-bottom:6px; }
    body.k2-brief .k2-empty{ padding:8px 2px; font-size:13px; }
    body.k2-brief .k2-head h1{ font-size:21px; }
    body.k2-brief .k2-wgrid{ gap:10px; }
    body.k2-brief .k2-asst-ctx{ font-size:12.5px; line-height:1.4; }
    body.k2-brief .k2-agent .mission{ font-size:13px; }
    body.k2-brief .k2-loadbar{ display:none; }   /* декоративные полосы — вода */

    /* ---- отказ по границе полномочий (исполняется кодом, не памятка) ---- */
    .k2-deny{ margin-top:12px; border:1px solid var(--k-red,#e86a5e); border-radius:12px; padding:14px 16px;
      background:color-mix(in srgb, var(--k-red,#e86a5e) 10%, transparent); }
    .k2-deny.pop{ animation:k2fadein .28s cubic-bezier(.22,1,.36,1); }
    .k2-deny .dh{ font-weight:800; color:var(--k-red,#e86a5e); font-size:14px; margin-bottom:7px; letter-spacing:-.01em; }
    .k2-deny .db{ font-size:13.5px; color:var(--k-txt2); line-height:1.5; margin-bottom:5px; }
    .k2-deny .db b{ color:var(--k-txt); }
    .k2-deny .df{ font-size:12px; color:var(--k-dim); margin-top:8px; font-family:ui-monospace,Consolas,monospace; }
    .k2-sys-link{ cursor:pointer; text-decoration:underline; text-underline-offset:3px; text-decoration-color:var(--k-line2); }
    .k2-sys-link:hover{ color:var(--k-gold); text-decoration-color:var(--k-gold); }
    .k2-sys-link:focus-visible{ outline:2px solid var(--k-gold); outline-offset:2px; border-radius:4px; }

    /* ---- мультивыбор в опросе ---- */
    .k2-opt.multi{ position:relative; padding-left:42px; }
    .k2-opt.multi::before{ content:''; position:absolute; left:16px; top:50%; transform:translateY(-50%); width:16px; height:16px;
      border:1.5px solid var(--k-line2); border-radius:5px; transition:.15s; }
    .k2-opt.multi.chosen::before{ background:var(--k-gold); border-color:var(--k-gold); }
    .k2-opt.multi.chosen::after{ content:'✓'; position:absolute; left:19px; top:50%; transform:translateY(-50%); color:var(--k-on); font-size:11px; font-weight:900; }
    .k2-multi-bar{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; }
    .k2-multi-cnt{ font-size:12.5px; color:var(--k-dim); }
    .k2-mnext{ padding:9px 20px; font-size:13.5px; }
    .k2-mnext:disabled{ opacity:.4; cursor:not-allowed; }

    /* ---- кабинет, который собирает сам пользователь: виджеты ---- */
    .k2-cust{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
    .k2-cust-btn{ background:var(--k-panel2); border:1px solid var(--k-line); color:var(--k-dim); border-radius:999px;
      padding:7px 14px; font-size:12.5px; cursor:pointer; transition:.15s; }
    .k2-cust-btn:hover{ color:var(--k-txt); border-color:var(--k-gold); }
    .k2-cust-btn.on{ background:var(--k-soft); border-color:var(--k-gold); color:var(--k-gold); font-weight:700; }
    .k2-cust-hint{ font-size:12px; color:var(--k-dim); }
    .k2-sw{ display:inline-flex; gap:6px; align-items:center; }
    .k2-sw i{ width:18px; height:18px; border-radius:50%; cursor:pointer; border:2px solid transparent; display:block; }
    .k2-sw i:hover{ transform:scale(1.12); }
    .k2-sw i.on{ border-color:var(--k-txt); }
    .k2-sw input[type=color]{ width:22px; height:22px; padding:0; border:1px solid var(--k-line); background:none; border-radius:50%; cursor:pointer; }
    .k2-hidden-chips{ display:inline-flex; gap:6px; flex-wrap:wrap; }

    .k2-wgrid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; align-items:start; }
    @media(max-width:900px){ .k2-wgrid{ grid-template-columns:1fr; } .k2-w{ grid-column:span 1 !important; } }
    .k2-w{ position:relative; min-width:0; border-radius:12px; transition:box-shadow .15s, outline-color .15s; }
    .k2-w.edit{ outline:1px dashed var(--k-line2); outline-offset:6px; cursor:grab; touch-action:none; }
    .k2-w.edit:hover{ outline-color:var(--k-gold); }
    .k2-w.drag{ opacity:.45; cursor:grabbing; }
    .k2-w.over{ outline:2px solid var(--k-gold); outline-offset:6px; }
    .k2-w-b{ min-width:0; }
    /* РОЙ №2: в режиме настройки клики по содержимому не были нейтрализованы — целясь перетащить
       карточку, можно было попасть в «Принять»/«Одобрить» и выполнить необратимое. Тулбар и
       ресайз-ручка лежат вне .k2-w-b, поэтому продолжают работать; pointerdown уходит на саму карточку. */
    .k2-w.edit .k2-w-b{ pointer-events:none; user-select:none; }
    .k2-w.sized > .k2-w-b{ overflow:auto; height:100%; }
    .k2-w.sized{ display:flex; flex-direction:column; }
    .k2-w-tools{ position:absolute; top:-10px; right:4px; z-index:5; display:none; gap:4px; }
    .k2-w.edit .k2-w-tools{ display:flex; }
    .k2-w-tools button{ background:var(--k-panel2); border:1px solid var(--k-line2); color:var(--k-dim); width:26px; height:26px;
      border-radius:7px; font-size:12px; cursor:pointer; display:grid; place-items:center; }
    .k2-w-tools button:hover{ color:var(--k-gold); border-color:var(--k-gold); }
    .k2-w-rz{ position:absolute; left:0; right:0; bottom:-6px; height:10px; cursor:ns-resize; display:none; }
    .k2-w.edit .k2-w-rz{ display:block; }
    .k2-w.edit .k2-w-rz::after{ content:''; position:absolute; left:50%; transform:translateX(-50%); bottom:3px;
      width:40px; height:3px; border-radius:3px; background:var(--k-line2); }
    .k2-w.edit .k2-w-rz:hover::after{ background:var(--k-gold); }

    /* ---- одноразовый онбординг: пошаговая подсветка зон ---- */
    .k2-coach-ring{ position:fixed; z-index:130; border-radius:14px; border:2px solid var(--k-gold);
      box-shadow:0 0 0 9999px rgba(6,10,8,.66), 0 0 0 4px var(--k-soft); pointer-events:none;
      transition:left .32s cubic-bezier(.22,1,.36,1),top .32s cubic-bezier(.22,1,.36,1),width .32s cubic-bezier(.22,1,.36,1),height .32s cubic-bezier(.22,1,.36,1); }
    .k2-coach-tip{ position:fixed; z-index:131; width:min(320px,86vw); background:var(--k-panel); border:1px solid var(--k-line2);
      border-radius:14px; padding:16px 18px; box-shadow:var(--k-sh-xl); animation:k2fadein .3s cubic-bezier(.22,1,.36,1); }
    .k2-coach-tip .step{ color:var(--k-gold); font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; }
    .k2-coach-tip .ttl{ font-size:16px; font-weight:750; margin:6px 0 6px; color:var(--k-txt); letter-spacing:-.01em; }
    .k2-coach-tip .bd{ font-size:13.5px; line-height:1.5; color:var(--k-txt2); }
    .k2-coach-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; }
    .k2-coach-dots{ display:flex; gap:6px; }
    .k2-coach-dots i{ width:6px; height:6px; border-radius:50%; background:var(--k-line2); display:block; }
    .k2-coach-dots i.on{ background:var(--k-gold); }
    .k2-coach-btns{ display:flex; gap:10px; align-items:center; }
    .k2-coach-skip{ background:none; border:none; color:var(--k-dim); font-size:12.5px; cursor:pointer; padding:0; }
    .k2-coach-skip:hover{ color:var(--k-txt2); }
    .k2-coach-next{ background:var(--k-gold); color:var(--k-on); border:none; border-radius:999px; padding:7px 16px; font-size:13px; font-weight:700; cursor:pointer; }
    .k2-coach-next:hover{ background:var(--k-gold2); }
    .k2-coach-next:focus-visible,.k2-coach-skip:focus-visible{ outline:2px solid var(--k-gold); outline-offset:2px; }
    /* ---- «С чего начать» в помощнике (пустой/типовой штат) ---- */
    .k2-start{ background:var(--k-soft); border:1px solid var(--k-line2); border-radius:12px; padding:13px 15px; margin-bottom:12px; }
    .k2-start .st-h{ font-size:13px; font-weight:700; color:var(--k-txt); margin-bottom:9px; }
    .k2-start-btns{ display:flex; flex-direction:column; gap:7px; }
    .k2-start-btn{ display:flex; gap:10px; align-items:flex-start; text-align:left; width:100%; background:var(--k-panel); border:1px solid var(--k-line); border-radius:10px; padding:10px 12px; cursor:pointer; transition:border-color .15s; }
    .k2-start-btn:hover{ border-color:var(--k-gold); }
    .k2-start-btn .si{ font-size:15px; line-height:1.2; }
    .k2-start-btn .sl{ font-size:13px; font-weight:650; color:var(--k-txt); }
    .k2-start-btn .ss{ font-size:11.5px; color:var(--k-dim); margin-top:1px; }
    .k2-start-btn:focus-visible{ outline:2px solid var(--k-gold); outline-offset:2px; }
    /* ---- A11y: уважение к reduced-motion ---- */
    @media (prefers-reduced-motion: reduce){
      .k2-echo-line,.k2-verdict,.k2-tcard,.k2-card,.k2-role,.k2-axbadge,.k2-shell,.k2-survey.leaving,.k2-item,.k2-coach-tip{ animation:none !important; }
      .k2-coach-ring{ transition:none !important; }
      .k2-echo-line,.k2-verdict,.k2-tcard,.k2-card,.k2-role,.k2-axbadge,.k2-shell,.k2-item{ opacity:1 !important; transform:none !important; }
    }
    `;
    document.head.appendChild(s);
  }

  /* ================================================================ ОПРОС  */
  function runSurvey(){
    injectStyles();
    let step = 0;
    const domScore = {}; const lvlSamples = [];
    // мультивыбор ВЕЗДЕ → почти все измерения стали наборами
    let tone = null, brief = false;
    let focusSel = [], postureSel = [], postureKeySel = [], toolSel = [], habitSel = [],
        industrySel = [], systemsSel = [], gripeSel = [], wantsSel = [];
    let multiSel = [];     // выбор текущего мультивыборного шага
    let askedIdx = [];     // какие вопросы реально задали (ветвление пропускает лишние)
    let liveChosen = [];
    const history = [];   // [{kind, qi, text, picks[]}]
    let locked = false;

    const layer = el('div','k2-survey'); layer.id='k2Survey';
    document.body.appendChild(layer);

    /* ---- интро ---- */
    function drawIntro(){
      layer.classList.remove('two'); layer.innerHTML='';
      const c = el('div','k2-card');
      c.innerHTML = `
        <div class="k2-eyebrow">Среда собирается под вас</div>
        <div class="k2-q">Не «выберите свою роль» — этого никто про себя не формулирует.<br>Просто ответьте про свою работу, и Среда сама узнает, кто вы, и соберётся.</div>
        <div class="k2-sub">Несколько коротких вопросов про вашу работу — чем точнее ответите, тем точнее Среда соберётся под вас. Справа вы увидите, как она узнаёт вашу профессию прямо на глазах.</div>
        <div style="margin-top:26px"><button class="k2-cta" id="k2Start">Собрать мою Среду ▶</button></div>`;
      layer.appendChild(c);
      $('#k2Start').onclick = ()=>{ step=0; buildShell(); drawLeft(); };
    }

    /* ---- оболочка (правая панель живёт постоянно) ---- */
    function buildShell(){
      layer.classList.add('two');
      layer.innerHTML = `
        <div class="k2-stage2">
          <div class="k2-left" id="k2Left"></div>
          <aside class="k2-right">
            <div class="k2-right-h"><span class="ttl">Среда узнаёт вас</span>
              <span class="k2-live"><b></b> собирается</span></div>
            <div class="k2-detect">
              <div class="k2-dlabel">Похоже, вы работаете с…</div>
              <div class="k2-doms" id="k2Doms"><div class="k2-tray-empty">ответьте на первый вопрос — и Среда начнёт вас узнавать</div></div>
              <div class="k2-lvlbox" id="k2LvlBox" style="display:none">
                <div class="t"><span>Уровень</span><b id="k2LvlName">—</b></div>
                <div class="track"><i id="k2LvlBar"></i></div>
              </div>
              <div class="k2-role" id="k2Role" style="display:none"></div>
            </div>
            <div class="k2-tray-h">Ваш цифровой штат · <b id="k2Cnt">0</b></div>
            <div class="k2-tray" id="k2Tray"><div class="k2-tray-empty" id="k2Empty">пока пусто — Среда укомплектует его под вашу работу</div></div>
            <div class="k2-toast" id="k2Toast"></div>
          </aside>
        </div>`;
    }

    /* ---- ВЕТВЛЕНИЕ: спрашиваем только то, что изменит сборку ----
       Модель сама говорит, влияет ли ответ. Не влияет — не тратим вопрос. */
    function shouldAsk(i){
      const s = SURVEY[i]; if(!s) return false;
      if (s.kind==='dom'){
        // Ветвление было мёртвым не из-за порога, а из-за гарда d.length>=2: при ЕДИНСТВЕННОМ наборавшем
        // домене сравнивать было не с кем, и условие не срабатывало никогда. Соперника нет = у него ноль.
        // Порог считаем честно: каждый домен встречается в вопросе ровно раз (+2), значит соперник может
        // набрать 2 × (число ОСТАВШИХСЯ доменных вопросов, включая этот). Пропускаем, только если
        // отрыв больше этого потолка — иначе рискуем залочить неверный домен.
        const d = topDomains(domScore, 2);
        if (!d.length) return true;                                   // ещё ничего не набрано — спрашиваем
        const lead = domScore[d[0]];
        const second = d.length>1 ? domScore[d[1]] : 0;
        let remaining = 0;
        for (let j=i; j<SURVEY.length; j++) if (SURVEY[j].kind==='dom') remaining++;
        return (lead - second) <= 2 * remaining;                      // догонит → спрашиваем; не догонит → пропускаем
      }
      // РОЙ: отрасль питает не только CAP_LIB, но и видимую плашку «профиль отрасли» (INDUSTRY_REG).
      // Выключать вопрос по одному лишь отсутствию отраслевых ЦС — значит молча лишать eng/marketing/hr/assist
      // регнормы, которую они бы получили. Ответ меняет интерфейс ВСЕГДА → вопрос всегда уместен.
      if (s.kind==='industry') return true;
      return true;
    }
    function nextAskable(from){ let i=from; while(i<SURVEY.length && !shouldAsk(i)) i++; return i; }
    function prevAskable(from){ let i=from; while(i>=0 && !shouldAsk(i)) i--; return i; }

    /* ---- левая колонка ---- */
    function drawLeft(){
      const s = SURVEY[step];
      if (!askedIdx.includes(step)) askedIdx.push(step);
      // прогресс считаем по РЕАЛЬНО задаваемым: пройденные + те, что ещё будут заданы
      const future = SURVEY.map((_,i)=>i).filter(i=> i>step && shouldAsk(i)).length;
      const pos = askedIdx.length, total = pos + future;
      const dots = Array.from({length:total},(_,k)=>`<div class="k2-dot ${k<pos?'on':''}"></div>`).join('');
      const left = $('#k2Left', layer);
      const multi = !!s.multi;
      multiSel = [];   // выбор текущего шага (мультивыбор)
      left.innerHTML = `
        <div class="k2-eyebrow">Вопрос ${pos} из ${total}${multi?' · можно выбрать несколько':''}</div>
        <div class="k2-q">${esc(s.q)}</div>
        <div class="k2-opts${s.opts.length>=6?' grid2':''}" id="k2Opts"></div>
        ${multi?'<div class="k2-multi-bar"><span class="k2-multi-cnt" id="k2MCnt">ничего не выбрано</span><button class="k2-cta k2-mnext" id="k2Next" disabled>Далее →</button></div>':''}
        <div class="k2-progress">${dots}</div>
        ${step>0?'<button class="k2-back" id="k2Back">← назад</button>':''}`;
      const box = $('#k2Opts', left);
      s.opts.forEach((o,oi)=>{
        const b = el('button','k2-opt'+(multi?' multi':''), esc(o.t));
        b.dataset.oi = oi;   // нужен, чтобы взаимоисключения (x/solo) могли снять галку с соседа
        b.onclick = multi ? (()=> toggleOpt(o, s, b)) : (()=> answer(o, s, b));
        box.appendChild(b);
      });
      if (multi) $('#k2Next',left).onclick = ()=> commitMulti(s);
      if (step>0) $('#k2Back',left).onclick = goBack;
    }

    /* ---- применить/снять эффект варианта (общее для одиночного и мульти, все измерения) ---- */
    function applyOpt(o, s, dir){
      const set = (a, v) => { if(v==null) return; const i=a.indexOf(v);
        if (dir>0){ if(i<0) a.push(v); } else if(i>=0){ a.splice(i,1); } };
      if (s.kind==='dom' && o.dom){ for(const d in o.dom){ domScore[d]=(domScore[d]||0)+dir*o.dom[d]; if(domScore[d]<=0) delete domScore[d]; } }
      else if (s.kind==='lvl'){ if(dir>0) lvlSamples.push(o.lvl); else { const i=lvlSamples.lastIndexOf(o.lvl); if(i>=0) lvlSamples.splice(i,1); } }
      else if (s.kind==='focus'){ set(focusSel, o.focus); }
      else if (s.kind==='posture'){ set(postureSel, o.posture); set(postureKeySel, o.pk); }
      // РОЙ: habitSel было множеством без счётчика ссылок — снятие ОДНОЙ галки чат-инструмента
      // убивало habit='chat', хотя второй чат-инструмент оставался выбран. Пишем habit как список с повторами.
      else if (s.kind==='tools'){ set(toolSel, o.tool);
        if (dir>0){ habitSel.push(o.habit); } else { const i=habitSel.indexOf(o.habit); if(i>=0) habitSel.splice(i,1); } }
      else if (s.kind==='industry'){ set(industrySel, o.industry); }
      else if (s.kind==='systems'){ set(systemsSel, o.systems); }
      else if (s.kind==='gripe'){ set(gripeSel, o.gripe); }
      else if (s.kind==='depth'){ set(wantsSel, o.want); }
      else if (s.kind==='tone'){
        if (o.tone!=null) tone = dir>0 ? o.tone : null;
        if (o.brief!=null) brief = dir>0;
      }
    }

    /* ---- мультивыбор: переключение с ЖИВЫМ узнаванием на каждый тап ----
       Модель знает про взаимоисключения: x — группа, solo — вариант, отменяющий все прочие. */
    function toggleOpt(o, s, btn){
      if (locked) return;
      const box = $('#k2Opts', layer);
      const drop = other => {
        const j = multiSel.indexOf(other); if (j<0) return;
        multiSel.splice(j,1); applyOpt(other, s, -1);
        const b = box.querySelector('[data-oi="'+s.opts.indexOf(other)+'"]'); if(b) b.classList.remove('chosen');
      };
      const i = multiSel.indexOf(o);
      if (i>=0){ multiSel.splice(i,1); btn.classList.remove('chosen'); applyOpt(o, s, -1); }
      else {
        if (o.solo) multiSel.slice().forEach(drop);                              // «достаточно результата» гасит остальное
        else multiSel.slice().filter(x=>x.solo).forEach(drop);                   // и наоборот
        if (o.x) multiSel.slice().filter(x=>x.x===o.x).forEach(drop);            // «на ты» гасит «на вы»
        multiSel.push(o); btn.classList.add('chosen'); applyOpt(o, s, +1);
      }
      const n = multiSel.length;
      const cnt = $('#k2MCnt', layer); if(cnt) cnt.textContent = n ? `выбрано: ${n}` : 'ничего не выбрано';
      const nx = $('#k2Next', layer); if(nx) nx.disabled = !n;
      updateRight(multiSel[multiSel.length-1]||null, s);   // узнавание пересобирается прямо на глазах
    }
    function commitMulti(s){
      if (locked || !multiSel.length) return; locked = true;
      history[step] = { kind:s.kind, qi:step, text:multiSel.map(o=>lowerFirst(o.t)).join(', '), picks:multiSel.slice() };
      setTimeout(()=>{
        locked = false;
        const n = nextAskable(step+1);          // ветвление: перепрыгиваем вопросы, что ничего не изменят
        if (n < SURVEY.length){ step = n; drawLeft(); }
        else finish();
      },260);
    }

    /* ---- ответ (одиночный выбор; сейчас все вопросы мультивыборные — путь оставлен как безопасный) ---- */
    function answer(o, s, btn){
      if (locked) return; locked = true;
      btn.classList.add('chosen');
      applyOpt(o, s, +1);
      history[step] = { kind:s.kind, qi:step, text:lowerFirst(o.t), picks:[o] };
      updateRight(o, s);
      setTimeout(()=>{
        locked = false;
        const n = nextAskable(step+1);          // ветвление: перепрыгиваем вопросы, что ничего не изменят
        if (n < SURVEY.length){ step = n; drawLeft(); }
        else finish();
      },560);
    }
    function goBack(){
      if (locked || step===0) return;
      // РОЙ: тапы текущего вопроса применяются сразу (toggleOpt), но в history попадают только на «Далее».
      // Если не снять их здесь — их веса останутся в domScore навсегда, и призрачный домен победит реальный ответ.
      multiSel.forEach(o=> applyOpt(o, SURVEY[step], -1)); multiSel = [];
      askedIdx = askedIdx.filter(i=> i<step);          // текущий больше не «задан»
      step = prevAskable(step-1); if(step<0){ step=0; }
      const h = history[step];
      // все измерения откатываются одинаково — applyOpt(-1) по каждому сделанному выбору
      if (h && h.picks) h.picks.forEach(o=> applyOpt(o, SURVEY[step], -1));
      history.length = step;
      drawLeft();
      updateRight(null, null);
    }

    /* ---- сердце: распознавание + сборка ---- */
    function updateRight(o, s){
      // домены (топ-3, лидер подсвечен)
      const doms = topDomains(domScore, 3);
      const domsBox = $('#k2Doms', layer);
      if (doms.length){
        const max = Math.max(...doms.map(d=>domScore[d]));
        domsBox.innerHTML = doms.map((d,i)=>{
          const pct = Math.round(domScore[d]/max*100);
          return `<div class="k2-dom ${i===0?'lead':''}"><div class="t">
            <span class="lab">${DOMAINS[d].icon} ${esc(DOMAINS[d].label)}</span>
            <span class="p">${i===0?'вы — сюда':''}</span></div>
            <div class="track"><i style="width:${pct}%"></i></div></div>`;
        }).join('');
      } else { domsBox.innerHTML = `<div class="k2-tray-empty">ответьте на первый вопрос — и Среда начнёт вас узнавать</div>`; }
      // уровень
      const level = detectLevel(lvlSamples);
      const lb = $('#k2LvlBox', layer);
      if (level){ lb.style.display=''; $('#k2LvlName',layer).textContent=LEVELS[level];
        $('#k2LvlBar',layer).style.width = (level/5*100)+'%'; }
      else { lb.style.display='none'; }
      // роль
      const domain = detectDomain(domScore);
      const role = resolveRole(domain, level);
      const roleBox = $('#k2Role', layer);
      if (role){
        roleBox.style.display='';
        roleBox.innerHTML = `<div class="rt">${esc(role.t)}</div>
          <div class="rs">${DOMAINS[role.d].icon} ${esc(DOMAINS[role.d].label)} · ${esc(LEVELS[role.l])}</div>`;
        roleBox.classList.remove('pop'); void roleBox.offsetWidth; roleBox.classList.add('pop');
      } else { roleBox.style.display='none'; }
      // РОЙ (потёмкинское): панель собирала карточки MODULES, которых в кабинете НЕ СУЩЕСТВУЕТ
      // (ни один m.render не вызывается). Теперь на глазах зала собирается РЕАЛЬНЫЙ штат — тот же,
      // что человек увидит в рейле после входа.
      const tray = $('#k2Tray', layer);
      const nc = previewStaff(domain);
      const key = c => c.t;
      const added   = nc.filter(c=>!liveChosen.some(x=>key(x)===key(c)));
      const removed = liveChosen.filter(c=>!nc.some(x=>key(x)===key(c)));
      removed.forEach(c=>{ const n=tray.querySelector('[data-m="'+cssEsc(key(c))+'"]'); if(n){ n.classList.add('leaving'); setTimeout(()=>n.remove(),320); } });
      added.forEach(c=>{
        const card = el('div','k2-tcard'); card.dataset.m=key(c);
        card.innerHTML = `<span class="ci">${c.e}</span><div><div class="cn">${esc(c.t)}</div><div class="ch">${esc(c.now)}</div></div>`;
        tray.appendChild(card);
      });
      liveChosen = nc.slice();
      $('#k2Cnt', layer).textContent = nc.length;
      const emp = $('#k2Empty', layer); if(emp) emp.style.display = nc.length ? 'none' : '';
      // подсказка
      let msg='';
      if (s && s.kind==='dom' && domain){ msg = `▲ Среда распознаёт: ${DOMAINS[domain].label}`; }
      else if (s && s.kind==='lvl' && level){ msg = `▲ Уровень: ${LEVELS[level]}`; }
      else if (added.length){ msg=`▲ в штат добавлен «${added[0].t}»`; }
      if (msg) showToast(msg);
    }
    let toastTimer=null;
    function showToast(msg){ const t=$('#k2Toast',layer); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2600); }

    function finish(){
      const domain = detectDomain(domScore);
      const rawLevel = detectLevel(lvlSamples) || 2;
      const role = resolveRole(domain, rawLevel);
      const level = role ? role.l : rawLevel;   // уровень = уровень найденной роли (иначе титул и плашка/гейтинг противоречат)
      // эхо-портрет: возвращаем ответы человека его же словами
      const echo = history.filter(h=>h && h.kind==='dom' && h.text).sort((a,b)=>a.qi-b.qi).map(h=>{
        const t = lowerFirst(h.text);
        if (h.qi===0) return `в работе у вас — ${t}`;
        if (h.qi===1) return `сделанная работа для вас — это ${t}`;
        if (h.qi===2) return `дороже всего ошибиться ${t}`;
        return t;
      });
      // профилирование в портрет узнавания — теперь наборами (мультивыбор везде)
      const habit = habitSel.includes('chat') ? 'chat' : (habitSel.includes('office') ? 'office' : 'none');
      if (focusSel.length)    echo.push(`больше всего времени у вас уходит на ${focusSel.join(' и ')}`);
      if (postureSel.length)  echo.push(`вам ближе ${postureSel.join(', ')}`);
      if (toolSel.length)     echo.push(`вы уже работаете в ${toolSel.map(t=>TOOL_IN[t]||t).join(', ')} — Среда встанет привычно`);
      else if (habit==='none') echo.push(`с ИИ вы ещё на «вы» — Среда проведёт за руку`);
      if (industrySel.length) echo.push(`ваша компания — в ${industrySel.join(' и ')}`);
      if (systemsSel.length)  echo.push(`вы живёте в ${systemsSel.map(s=>SYS_IN[s]||s).join(', ')} — Среда к ним подключится`);
      if (gripeSel.length)    echo.push(`больше всего вас бесит: ${gripeSel.join(', ')}`);
      if (wantsSel.length)    echo.push(`от результата вам важно видеть: ${wantsSel.map(w=>WANT_LABEL[w]||w).join(', ')}`);
      profile = { domain, level, roleTitle: role?role.t:null,
        wants: wantsSel.slice(), depth: wantsSel.includes('who') ? 1 : 0,   // depth оставлен производным для совместимости
        focus: focusSel.slice(), posture: postureSel.slice(), postureKey: postureKeySel.slice(),
        aiTool: toolSel.slice(), habit, industry: industrySel.slice(), systems: systemsSel.slice(),
        tone, brief, gripe: gripeSel.slice(),
        chosen: assembleModules(domain, level), echo, baseCount: ROLES.length, viaSurvey:true };
      save(profile);
      drawResult();
    }

    function drawResult(){
      layer.classList.remove('two'); layer.innerHTML='';
      const c = el('div','k2-card k2-result');
      const dom = profile.domain;
      // КРИТИК: шаг был фиксированный 0.55с → при 10 строках эха (после расширения опроса это норма)
      // вердикт с кнопкой «Войти в мою Среду» появлялся через 5.95с — на показе это мёртвая пауза.
      // Каскад укладываем в ~3с при любом числе строк: эхо всё так же дозируется, но зал не ждёт.
      const echoLines = profile.echo || [];
      const step = Math.min(0.55, 3.0 / Math.max(1, echoLines.length));
      const echoHtml = echoLines.map((line,i)=>
        `<div class="k2-echo-line" style="animation-delay:${(0.2+i*step).toFixed(2)}s">${esc(line)}</div>`).join('');
      const vDelay = (0.2 + echoLines.length*step + 0.25).toFixed(2);
      // РОЙ №2: здесь была СВОЯ копия логики штата без matchedCaps → финал обещал «3 сотрудника», а в рейле
      // оказывалось 5. Один источник правды с кабинетом: previewStaff (профиль уже собран → добирает подобранных).
      const staffPrev = previewStaff(dom);
      const mods = staffPrev.map(cs=>
        `<div class="k2-mod"><div class="i">${cs.e}</div><div class="n">${esc(cs.t)}</div><div class="h">${esc(cs.now)}</div></div>`).join('');
      c.innerHTML = `
        <div class="k2-eyebrow">Среда прочитала ваши ответы</div>
        <div class="k2-echo">${echoHtml}</div>
        <div class="k2-verdict" style="animation-delay:${vDelay}s">
          <div class="k2-verdict-lead">Складывается один человек:</div>
          <h2>Вы — <span class="role">${esc(profile.roleTitle||'специалист')}</span></h2>
          <div class="k2-meta">
            ${dom?`<div class="k2-pill">${DOMAINS[dom].icon} <b>${esc(DOMAINS[dom].label)}</b></div>`:''}
            <div class="k2-pill">🎚️ <b>${esc(LEVELS[profile.level])}</b></div>
            <div class="k2-pill">🧬 одна из <b>${profile.baseCount}</b> ролей в библиотеке Среды</div>
          </div>
          <div class="k2-sub">Среда укомплектовала под вашу роль цифровой штат — ${staffPrev.length} ${plural(staffPrev.length,'сотрудник','сотрудника','сотрудников')}. Ставьте им задачи, а Пульс соберёт ваш день. Не вы? «↺ пересобрать» внизу.</div>
          <div class="k2-picked">${mods}</div>
          <div class="k2-enter-row">
            <button class="k2-cta" id="k2Enter">Войти в мою Среду ▶</button>
            <button class="k2-notme" id="k2NotMe">Это не я →</button>
          </div>
          <div id="k2Near"></div>
        </div>`;
      layer.appendChild(c);
      // ПРОГОН ПОКАЗА: карточка результата с длинным эхом выше экрана (889px при окне 800) — вердикт
      // с кнопкой «Войти в мою Среду» оказывался ПОД СГИБОМ ровно в кульминации, и ведущий искал её
      // скроллом при зале. Когда вердикт проявился — сами доводим его в зону видимости.
      setTimeout(()=>{
        const vd = c.querySelector('.k2-verdict'); if(!vd || !layer.isConnected) return;
        const r = vd.getBoundingClientRect();
        const over = r.bottom - window.innerHeight;
        if (over > 0) layer.scrollTop += over + 20;   // мгновенно: smooth не крутится в фоне (rAF)
      }, Math.round(parseFloat(vDelay)*1000) + 650);
      // «Это не я» — соседние роли по весам, поправить в один клик (а не проходить 13 вопросов заново)
      $('#k2NotMe').onclick = ()=>{
        const box = $('#k2Near'); if(!box) return;
        if (box.dataset.open){ box.innerHTML=''; delete box.dataset.open; return; }
        box.dataset.open='1';
        // домены, которые реально конкурировали в ответах (а не первые попавшиеся в массиве)
        const near = nearbyRoles(profile.domain, profile.level, profile.roleTitle, topDomains(domScore, 5));
        box.innerHTML = `<div class="k2-near-h">Кто вы на самом деле? Среда пересоберётся под выбранную роль:</div>`;
        const g = el('div','k2-near');
        near.forEach(r=>{
          const b = el('button','k2-near-i',
            `<b>${esc(r.t)}</b><small>${DOMAINS[r.d]?DOMAINS[r.d].icon+' '+esc(DOMAINS[r.d].label):''} · ${esc(LEVELS[r.l])}</small>`);
          b.onclick = ()=>{
            profile.domain=r.d; profile.level=r.l; profile.roleTitle=r.t;
            profile.chosen = assembleModules(r.d, r.l);
            save(profile); drawResult();   // портрет перерисуется под выбранную роль
          };
          g.appendChild(b);
        });
        box.appendChild(g);
      };
      let entering = false;
      $('#k2Enter').onclick = ()=>{
        if (entering) return; entering = true;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce){ layer.remove(); enterCabinet(); return; }
        layer.classList.add('leaving');
        setTimeout(()=>{ layer.remove(); enterCabinet(); }, 480);
      };
    }

    drawIntro();
  }

  /* ================================================================ КОКПИТ РЦС */
  /* По concept-interface-v1 §10: слева мой цифровой штат, в центре Пульс на    */
  /* высоте (Я/Отдел/Компания), точки участия = где нужен человек, ассистент    */
  /* как движок Пульса. Интерфейс = проекция модели «штат + контексты».         */
  const cockpit = { height:'me', view:'pulse', csId:null };
  let myAdditions = [];   // что пользователь добавил → кандидаты на подъём в дефолт роли (§4.3, §7.3)
  const STAGES = ['личное','отдел роли','компания'];
  const DOMAIN_DEPT = { sales:'sales', eng:'dev', marketing:'marketing', hr:'hr', exec:'mgmt', analytics:'strategy', project:'prod', ops:'prod' };
  const SYNTH_STAFF = {
    finance:[{e:'🧾',t:'Двойник бухгалтера',now:'сверка актов · утро'},{e:'📑',t:'Агент отчётности',now:'сбор ДДС за квартал'},{e:'🎛️',t:'Агент контроля расходов',now:'скан отклонений бюджета'}],
    estimate:[{e:'📐',t:'Сметный агент',now:'пересчёт сметы «ЖК Ривер»'},{e:'🎯',t:'Агент тендерных расчётов',now:'НМЦК по 44-ФЗ'}],
    legal:[{e:'📄',t:'Юридический агент',now:'правки договора «Гамма»'},{e:'🛡️',t:'Агент комплаенса',now:'проверка 152-ФЗ'}],
    assist:[{e:'🗓️',t:'Двойник ассистента',now:'подготовка к встрече 14:00'},{e:'✉️',t:'Агент входящих',now:'разбор почты за ночь'}],
  };
  /* доменный контент Пульса: точки участия, встречи, кандидат, память ЦС — под роль (а не sales для всех) */
  const DCONTENT = {
    sales:    { clarify:'применить скидку 12% сверх политики по сделке «Гамма»?', coord:'РОП просит подключить вашего ЦС к тендеру РЖД', dept:'Продажи',
      meet:[['10:00','Zoom с клиентом «Гамма»','бриф от помощника готов'],['15:30','Синк по воронке','повестка собрана']],
      cand:{text:'Из вчерашнего звонка «Гамма» насчитал 4 задачи и 1 встречу', task:'Отправка КП «Гамма» (из звонка)', draft:'Черновик протокола встречи «Гамма»'},
      mem:['контекст: клиент «Гамма» · воронка 6 горячих (CRM, 12.07)','правило: скидка до 10% — сам; выше — санкция РЦС'] },
    finance:  { clarify:'провести платёж поставщику сверх лимита без доп. согласования?', coord:'Директор просит подключить вашего ЦС к закрытию квартала', dept:'Финансы',
      meet:[['10:00','Разбор отклонений бюджета','сводка от помощника'],['16:00','Сверка с аудитором','материалы готовы']],
      cand:{text:'Из выписки банка: 3 расхождения и 1 запрос на оплату', task:'Согласование платежа поставщику', draft:'Черновик акта сверки'},
      mem:['контекст: дебиторка 340т · просрочка 12 дней (CRM, 12.07)','правило: платёж до лимита — сам; выше — санкция РЦС'] },
    estimate: { clarify:'принять смету с превышением норматива на 6%?', coord:'ГИП просит подключить вашего ЦС к расчёту тендера', dept:'Сметный отдел',
      meet:[['10:00','Защита сметы по объекту','расчёт готов'],['14:00','Разбор расценок','обновления собраны']],
      cand:{text:'Из письма заказчика: 2 позиции пересчитать и запрос КП', task:'Пересчёт сметы по объекту «ЖК Ривер»', draft:'Черновик коммерческого предложения'},
      mem:['контекст: объект «ЖК Ривер» · 142 позиции (база расценок 2026-Q2)','правило: отклонение до 5% — сам; выше — санкция РЦС'] },
    eng:      { clarify:'выкатить релиз 2.4 в прод сегодня вечером?', coord:'PM просит подключить вашего ЦС к разбору инцидента', dept:'ИИ и разработка',
      meet:[['10:00','Дейли команды','статус собран'],['16:00','Ревью архитектуры','материалы готовы']],
      cand:{text:'Из трекера: 3 бага на ревью и 1 инцидент', task:'Выкатка релиза 2.4', draft:'Черновик пост-мортема'},
      mem:['контекст: релиз 2.4 · покрытие тестами 71%','правило: hotfix — сам; выкатка в прод — санкция РЦС'] },
    marketing:{ clarify:'запустить кампанию с бюджетом сверх плана на 15%?', coord:'Продажи просят подключить вашего ЦС к GTM-запуску', dept:'Маркетинг',
      meet:[['11:00','Синк по кампании','бриф готов'],['15:00','Разбор метрик','дашборд собран']],
      cand:{text:'Из брифа: 4 креатива на согласование и 1 запуск', task:'Публикация GTM-плана', draft:'Черновик контент-плана'},
      mem:['контекст: 18 MQL проскорены · 6 горячих','правило: расход до плана — сам; сверх — санкция РЦС'] },
    ops:      { clarify:'сдвинуть срок поставки на объект на 2 дня?', coord:'РП просит подключить вашего ЦС к внедрению', dept:'Производство',
      meet:[['09:00','Планёрка по объектам','график готов'],['14:00','Синк со снабжением','заявки собраны']],
      cand:{text:'Из заявок: 8 позиций к заказу и 1 риск срыва', task:'Согласование сдвига срока поставки', draft:'Черновик графика работ'},
      mem:['контекст: внедрение · веха 3 из 5 · SLA под риском','правило: сдвиг до дня — сам; больше — санкция РЦС'] },
    hr:       { clarify:'сделать оффер кандидату выше вилки на 10%?', coord:'Руководитель отдела просит подключить вашего ЦС к найму', dept:'HR',
      meet:[['10:00','Интервью с кандидатом','досье готово'],['15:00','Синк по онбордингу','план собран']],
      cand:{text:'Из откликов: 24 резюме отобрано, топ-5 к интервью', task:'Согласование оффера кандидату', draft:'Черновик плана онбординга'},
      mem:['контекст: 3 вакансии в работе · 24 отклика','правило: оффер в вилке — сам; выше — санкция РЦС'] },
    legal:    { clarify:'подписать договор с правкой контрагента по п.5?', coord:'Продажи просят подключить вашего ЦС к сделке', dept:'Юридический отдел',
      meet:[['11:00','Разбор договора','правки собраны'],['16:00','Синк по претензии','материалы готовы']],
      cand:{text:'Из почты: 3 договора на подпись и 1 претензия', task:'Согласование правки договора', draft:'Черновик заключения по риску'},
      mem:['контекст: 3 договора на подписи · 2 претензии','правило: типовая правка — сам; существенная — санкция РЦС'] },
    project:  { clarify:'принять этап проекта с открытым риском?', coord:'Смежный отдел просит подключить вашего ЦС к проекту', dept:'Проекты',
      meet:[['10:00','Статус проекта','отчёт собран'],['15:00','Разбор рисков','реестр обновлён']],
      cand:{text:'Из статусов: 2 вехи к приёмке и 1 риск', task:'Приёмка этапа проекта', draft:'Черновик статус-отчёта заказчику'},
      mem:['контекст: проект РЖД · этап 2 из 4','правило: веха в срок — сам; сдвиг — санкция РЦС'] },
    analytics:{ clarify:'опубликовать отчёт с доверительным интервалом ±12%?', coord:'Руководство просит подключить вашего ЦС к срезу', dept:'Аналитика',
      meet:[['10:00','Разбор дашборда','срез готов'],['16:00','Синк по метрикам','данные собраны']],
      cand:{text:'Из данных: отклонение факт/план >15% и 1 запрос среза', task:'Публикация отчёта с выводом', draft:'Черновик аналитической записки'},
      mem:['контекст: недельный дашборд · алерт >15%','правило: срез — сам; публикация вовне — санкция РЦС'] },
    exec:     { clarify:'утвердить стратегическую ставку с бюджетом сверх плана?', coord:'Директор направления просит вашего решения по ресурсу', dept:'Управление',
      meet:[['09:00','Совет директоров','повестка собрана'],['15:00','Стратсессия','срез рынка готов']],
      cand:{text:'Из сводки: 3 решения на утверждение и 1 риск', task:'Утверждение стратегической ставки', draft:'Черновик решения совета'},
      mem:['контекст: портфель проектов · прогноз выручки ±10%','правило: в рамках стратегии — сам; смена курса — совет'] },
    assist:   { clarify:'подтвердить встречу от имени руководителя?', coord:'Руководитель просит подключить вашего ЦС к подготовке', dept:'Операционка',
      meet:[['10:00','Подготовка к встрече руководителя','досье готово'],['14:00','Разбор входящих','почта собрана']],
      cand:{text:'Из почты за ночь: 4 задачи и 1 встреча к подтверждению', task:'Подтверждение встречи руководителя', draft:'Черновик протокола'},
      mem:['контекст: календарь руководителя · 4 встречи сегодня','правило: календарь — сам; подтверждение от лица — санкция РЦС'] },
  };
  const dcontent = () => DCONTENT[profile.domain] || DCONTENT.sales;

  /* ==================== ПРОФИЛЬ РЕАЛЬНО МЕНЯЕТ КАБИНЕТ ====================
     не эхо в финале опроса, а живые изменения интерфейса и состава штата.   */
  // tone: реальное переключение микротекста (не ярлык «· на ты»)
  const T = (ty, vy) => (profile && profile.tone === 'ты') ? ty : vy;
  // brief («коротко, без воды»): режет многословие по всему кабинету + уплотняет вёрстку (класс k2-brief)
  const B = (short, long) => (profile && profile.brief) ? short : long;

  // Мультивыбор ВЕЗДЕ → почти все измерения профиля стали наборами.
  // arr() нормализует и старые профили (скаляры), и новые (массивы) — обратная совместимость.
  const arr = v => v==null ? [] : (Array.isArray(v) ? v.filter(x=>x!=null) : [v]);
  const userFocus    = () => arr(profile && profile.focus);
  const userGripe    = () => arr(profile && profile.gripe);
  const userIndustry = () => arr(profile && profile.industry);
  const userPosture  = () => arr(profile && profile.postureKey);
  const userTools    = () => arr(profile && profile.aiTool);
  const userWants    = () => arr(profile && profile.wants);
  const WANT_LABEL = { result:'только результат', who:'кто сделал', prov:'из чего собран ответ', mem:'что он знает', audit:'след в аудите' };
  // «что хочу видеть» реально включает секции карточки ЦС.
  // РОЙ: раньше «Достаточно результата» клало want:null → wants[] оставался пуст и был неотличим от
  // «не отвечал» → срабатывал фолбэк «показать всё», т.е. ответ давал ОБРАТНЫЙ эффект. Теперь это явный 'result'.
  const wants = k => { const w = userWants();
    if (!w.length) return true;          // не отвечал (или старый профиль) — показываем всё, как раньше
    if (w.includes('result')) return false;   // «достаточно результата» — кухню не показываем
    return w.includes(k); };

  // Боль (focus + gripe) → канонические ТЕМЫ. Один словарь, обе оси кладутся в него.
  const PAIN_THEME = {
    // focus
    'рутину, которую пора передать':  'routine',
    'сбор данных и отчёты':           'reports',
    'согласования и решения':         'approvals',
    'разбор входящих':                'inbox',
    'контроль, что всё идёт по плану':'control',
    'совещания и созвоны':            'meetings',
    'поиск информации':               'search',
    'исправление чужих ошибок':       'quality',
    'тушение пожаров':                'rush',
    // gripe
    'бесконечные согласования':       'approvals',
    'рутина и копипаст':              'routine',
    'информация теряется':            'infoloss',
    'отчёты и таблицы':               'reports',
    'вечная спешка':                  'rush',
    'совещания ради совещаний':       'meetings',
    'не найти нужный документ':       'search',
    'дубли и разночтения в данных':   'quality',
    'дёргают по мелочам':             'inbox',
  };
  // Тема → на какую поверхность Пульса она давит (порядок секций — следствие, не хардкод focus→секция)
  const THEME = {
    reports:  { surface:'staff' }, approvals:{ surface:'wait' }, routine:{ surface:'staff' },
    inbox:    { surface:'cand'  }, control:  { surface:'wait' }, infoloss:{ surface:'staff' }, rush:{ surface:'wait' },
    meetings: { surface:'meet'  }, search:   { surface:'staff'}, quality: { surface:'wait' },
  };
  const userThemes = () => !profile ? [] : [...new Set(userFocus().concat(userGripe()).map(v=>PAIN_THEME[v]).filter(Boolean))];

  // Отрасль → регнорма. Маленькая ФАКТ-таблица (объективный факт, не выдуманный UI) — легитимна, как доменный контент.
  const INDUSTRY_REG = {
    'строительстве':'44-ФЗ · сметы · ГОСТ', 'финансах':'152-ФЗ · МСФО · ЦБ', 'ИТ':'ИБ · SLA · релизы',
    'производстве':'ОТиТБ · снабжение', 'торговле':'ЕГАИС · остатки', 'госсекторе':'223-ФЗ · 44-ФЗ · ПДн', 'услугах':'договоры · SLA клиента',
    'медицине':'323-ФЗ · врачебная тайна · Росздравнадзор', 'образовании':'273-ФЗ · ФГОС · лицензии',
    'логистике':'ЭТрН · таможня · маршруты', 'энергетике':'Ростехнадзор · ОТиТБ · техприсоединение',
    'телекоме':'126-ФЗ · Роскомнадзор · SLA сети', 'агро':'Меркурий · Россельхознадзор · субсидии',
  };
  // отраслей может быть несколько (холдинг) → регнормы объединяем без дублей
  const industryReg = () => { const r=[...new Set(userIndustry().map(i=>INDUSTRY_REG[i]).filter(Boolean).flatMap(s=>s.split(' · ')))];
    return r.length ? r.join(' · ') : null; };

  // ЕДИНАЯ тегированная библиотека возможностей. Новую возможность добавляешь ОДИН раз с тегами —
  // она всплывает у любого совпавшего профиля. Ни одно измерение не выдумывает контент под ответ.
  const CAP_LIB = [
    { e:'📑', t:'Агент отчётности',       now:'готовит отчёт к утру',            domains:['*'], industries:['*'], themes:['reports'],           systems:['1С','Excel','ERP','BI'] },
    { e:'✅', t:'Агент согласований',      now:'собирает визы в одну очередь',    domains:['*'], industries:['*'], themes:['approvals'],         systems:['CRM','почта','ЭДО'] },
    { e:'🔁', t:'Агент рутины',            now:'снимает копипаст по расписанию',  domains:['*'], industries:['*'], themes:['routine'],           systems:['Excel','1С','ERP'] },
    { e:'🧠', t:'Агент памяти',            now:'держит контекст и источники',     domains:['*'], industries:['*'], themes:['infoloss'],          systems:['почта','трекеры','диски'] },
    { e:'✉️', t:'Агент входящих',          now:'разбирает почту и звонки за ночь',domains:['*'], industries:['*'], themes:['inbox'],             systems:['почта'] },
    { e:'⏱️', t:'Агент приоритетов',       now:'сортирует срочное от фонового',   domains:['*'], industries:['*'], themes:['rush','control'],    systems:['*'] },
    { e:'🎛️', t:'Агент контроля плана',    now:'следит за планом и отклонениями', domains:['exec','project','ops','analytics'], industries:['*'], themes:['control'], systems:['*'] },
    { e:'📐', t:'Агент смет и тендеров',    now:'сверяет сметы и НМЦК',            domains:['estimate','sales','project'], industries:['строительстве'], themes:['reports','approvals'], systems:['1С','САПР','закупки'] },
    { e:'🏛️', t:'Агент госзакупок',        now:'мониторит закупки 44/223-ФЗ',     domains:['sales','legal','project','exec'], industries:['госсекторе'], themes:['approvals','reports'], systems:['закупки','ЭДО'] },
    { e:'📦', t:'Агент снабжения',         now:'держит заявки и остатки',         domains:['ops','project'], industries:['производстве'], themes:['control','routine'], systems:['1С','ERP'] },
    { e:'🏷️', t:'Агент остатков',          now:'сводит остатки и поставки',       domains:['sales','ops','analytics'], industries:['торговле'], themes:['reports','control'], systems:['1С','ERP','BI'] },
    { e:'🛡️', t:'Агент комплаенса',        now:'проверяет 152-ФЗ и риски',        domains:['legal','finance','exec'], industries:['финансах','госсекторе','медицине'], themes:['infoloss'], systems:['*'] },
    // ЦС под новые темы боли — без них расширенные варианты опроса были бы пустыми словами
    { e:'🗓️', t:'Агент встреч',            now:'собирает повестку и протокол',    domains:['*'], industries:['*'], themes:['meetings'], systems:['почта','диски'] },
    { e:'🔎', t:'Агент поиска',            now:'находит нужное в переписке и документах', domains:['*'], industries:['*'], themes:['search','infoloss'], systems:['почта','диски','ЭДО'] },
    { e:'🧮', t:'Агент сверки',            now:'ловит дубли и разночтения',       domains:['*'], industries:['*'], themes:['quality'], systems:['Excel','1С','ERP'] },
    { e:'💳', t:'Агент платежей',          now:'готовит реестр платежей, сверяет выписки', domains:['finance','ops','exec'], industries:['*'], themes:['routine','reports'], systems:['банк','1С','ERP'] },
    // отраслевые ЦС под новые отрасли
    { e:'🚚', t:'Агент перевозок',         now:'следит за маршрутами и ЭТрН',     domains:['ops','project','analytics'], industries:['логистике'], themes:['control','reports'], systems:['ERP','трекеры'] },
    { e:'⚕️', t:'Агент медкомплаенса',      now:'проверяет 323-ФЗ и врачебную тайну', domains:['legal','ops','hr','exec'], industries:['медицине'], themes:['quality','infoloss'], systems:['*'] },
    { e:'⚡', t:'Агент техприсоединения',   now:'ведёт заявки и сроки Ростехнадзора', domains:['ops','project','legal'], industries:['энергетике'], themes:['approvals','control'], systems:['ЭДО','ERP'] },
    // КРИТИК: образование/телеком/агро давали только регнорму без единого ЦС — на показе асимметрия
    // с медициной была бы заметна. Выравниваем покрытие.
    { e:'🎓', t:'Агент учебных программ',  now:'сверяет программы с ФГОС и лицензией', domains:['ops','project','hr','legal'], industries:['образовании'], themes:['quality','control'], systems:['диски','ЭДО'] },
    { e:'📡', t:'Агент сети и SLA',        now:'следит за инцидентами и SLA сети',  domains:['eng','ops','analytics'], industries:['телекоме'], themes:['control','rush'], systems:['трекеры','BI'] },
    { e:'🌾', t:'Агент Меркурия',          now:'ведёт ветдокументы и субсидии',     domains:['ops','legal','finance'], industries:['агро'], themes:['routine','approvals'], systems:['ЭДО','1С'] },
  ];
  // scoreProfile: соответствие вычисляется, а не перечисляется. Домен — гейт; отрасль/боль/системы — веса.
  function scoreCap(cap){
    const inds = userIndustry();
    if(!cap.domains.includes('*') && !cap.domains.includes(profile.domain)) return 0;                 // не для этого домена
    if(!cap.industries.includes('*') && !inds.some(i=>cap.industries.includes(i))) return 0;          // отраслевой ЦС для другой отрасли
    let s=0;
    userThemes().forEach(t=>{ if(cap.themes.includes(t)) s+=3; });                                    // совпала боль (focus+gripe, мультивыбор)
    if(inds.some(i=>cap.industries.includes(i))) s+=4;                                                // точное попадание в отрасль
    // КРИТИК: джокер '*' работал для domains/industries, но НЕ здесь — ['*'].includes('1С') === false,
    // и ЦС с systems:['*'] никогда не получал этот балл. Мёртвая нотация.
    if(cap.systems.includes('*') || userSystems().some(sys=>cap.systems.includes(sys))) s+=1;          // есть хоть один источник
    return s;
  }
  // Основание найма: боль (+3) или отрасль (+4). Совпадение по системе (+1) — только тай-брейкер.
  const capHitsPain = cap => userThemes().some(t=>cap.themes.includes(t));
  const capHitsIndustry = cap => userIndustry().some(i=>cap.industries.includes(i));
  // топ-2 подходящих возможности сверх базового штата роли (дедуп по названию)
  function matchedCaps(baseTitles){
    if(!profile) return [];
    const seen = new Set(baseTitles||[]);
    // КРИТИК: порог был s>0 — значит ЦС нанимался за ОДНО совпадение системы, без боли и отрасли,
    // и получал ярлык «под вашу боль». С 12 системами это стало срабатывать почти всегда.
    // Нанимаем только по реальному основанию; система остаётся тай-брейкером внутри отбора.
    return CAP_LIB.map(c=>({c,s:scoreCap(c)})).filter(x=>x.s>=3).sort((a,b)=>b.s-a.s)
      .filter(x=>{ if(seen.has(x.c.t)) return false; seen.add(x.c.t); return true; }).slice(0,2).map(x=>x.c);
  }
  /* ============ КАБИНЕТ СОБИРАЕТ САМ ПОЛЬЗОВАТЕЛЬ ============
     Среда ПРЕДЛАГАЕТ раскладку скорингом; как только человек сам подвинул/изменил —
     его раскладка побеждает (custom=true) и живёт между сессиями. Всегда можно вернуть подобранное. */
  const WKEYS = ['wait','check','flow','meet','staff','cand'];
  const WTITLE = { wait:'Ждёт меня', check:'Проверка работ', flow:'Передачи', meet:'Встречи дня', staff:'Мои ЦС', cand:'Предложено помощником' };
  const ACCENTS = ['#36c994','#60a5fa','#e8b448','#e86a5e','#a78bfa','#22d3ee'];
  let layout = null, editMode = false;
  const defaultLayout = () => ({ custom:false, order:surfaceOrder(), span:{wait:2,staff:2,flow:2,meet:1,cand:1}, hidden:[], h:{}, accent:null });
  function loadLayout(){
    try{ const s=JSON.parse(localStorage.getItem(LS_LAYOUT)||'null');
      if(s && s.domain===profile.domain && Array.isArray(s.order)){
        return { custom:!!s.custom, order:s.order.filter(k=>WKEYS.includes(k)), span:s.span||{},
                 hidden:(s.hidden||[]).filter(k=>WKEYS.includes(k)), h:s.h||{}, accent:s.accent||null };
      }
    }catch(e){}
    return null;
  }
  function saveLayout(){ try{ localStorage.setItem(LS_LAYOUT, JSON.stringify(Object.assign({domain:profile.domain}, layout))); }catch(e){} }
  function ensureLayout(){
    if(!layout) layout = loadLayout() || defaultLayout();
    // пока человек не вмешался — раскладкой правит модель (подбор под профиль)
    if(!layout.custom) layout.order = surfaceOrder();
    WKEYS.forEach(k=>{ if(!layout.order.includes(k) && !layout.hidden.includes(k)) layout.order.push(k); });
    return layout;
  }
  function touchLayout(){ layout.custom = true; saveLayout(); }
  function applyAccent(){
    const r = document.documentElement, a = layout && layout.accent;
    if(a){
      r.style.setProperty('--acc', a);
      // РОЙ: --acc-hover ставился тем же цветом → hover переставал читаться. Осветляем на ~12%.
      r.style.setProperty('--acc-hover', shade(a, 0.12));
      // и подбираем контрастный текст на акценте, иначе тёмный цвет из пипетки делал подписи нечитаемыми
      r.style.setProperty('--on-acc', luma(a) > 0.55 ? '#0b140f' : '#ffffff');
    } else { r.style.removeProperty('--acc'); r.style.removeProperty('--acc-hover'); r.style.removeProperty('--on-acc'); }
  }
  const hex2rgb = h => { const s=String(h).replace('#',''); const n=parseInt(s.length===3?s.split('').map(c=>c+c).join(''):s,16);
    return [(n>>16)&255,(n>>8)&255,n&255]; };
  const luma = h => { try{ const [r,g,b]=hex2rgb(h); return (0.2126*r+0.7152*g+0.0722*b)/255; }catch(e){ return 0.5; } };
  // акцентом красится и ТЕКСТ на тёмном фоне — слишком тёмный цвет делает его невидимым. Поднимаем до читаемого.
  const ensureReadable = h => { let c=h, guard=0; while(luma(c) < 0.42 && guard++ < 12) c = shade(c, 0.14); return c; };
  const shade = (h, amt) => { try{ const [r,g,b]=hex2rgb(h);
    const f = v => Math.round(Math.min(255, v + (255-v)*amt));
    return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join(''); }catch(e){ return h; } };

  // порядок секций Пульса = скоринг поверхностей от тем боли + posture (не хардкод)
  function surfaceOrder(){
    const score={wait:0,check:0,flow:0,meet:0,staff:0,cand:0};
    // у того, кто проверяет чужие работы, это главная работа дня — поверхность идёт первой
    if (canReview()) score.check += 4;
    userThemes().forEach(t=>{ const s=THEME[t]&&THEME[t].surface; if(s) score[s]+=2; });
    // posture теперь реально двигает акцент кабинета, а не только порядок чипа:
    // «сам» → делать (мои ЦС), «поручать/направлять» → принимать (ждёт меня + передачи)
    userPosture().forEach(pk=>{   // predпочтений может быть несколько — веса складываются
      if(pk==='self') score.staff+=1;
      else if(pk==='delegate'){ score.wait+=1; score.flow+=1; }
      else if(pk==='direct'){ score.wait+=2; score.flow+=1; }
    });
    const base=['wait','check','flow','meet','staff','cand'];
    return base.slice().sort((a,b)=> (score[b]-score[a]) || (base.indexOf(a)-base.indexOf(b)));
  }

  // systems → провенанс-источник на карточках ЦС. Мультивыбор: нормализуем (старые профили хранили строку).
  const SYSTEM_SOURCE = {
    '1С':'1С', 'ERP':'ERP', 'Excel':'Excel/Таблицы', 'CRM':'CRM', 'трекеры':'трекер', 'ЭДО':'ЭДО',
    'почта':'почта', 'диски':'документы', 'закупки':'портал закупок', 'САПР':'САПР/сметы', 'банк':'банк-клиент', 'BI':'BI',
    // старые ключи из профилей, сохранённых до расширения опроса
    'трекерах':'трекер', 'почте':'почта',
  };
  // КРИТИК: ключ ≠ словоформа. Эхо-портрет вставляет систему в ПРЕДЛОЖНЫЙ слот («вы живёте в …»),
  // и старые ключи ('почте','трекерах') были такими именно поэтому. Переименовав их ради лукапа,
  // я сломал грамматику на экране узнавания. Разводим ключ и падежную форму.
  const SYS_IN = { 'трекеры':'трекерах', 'почта':'почте', 'диски':'дисках', 'закупки':'порталах закупок',
    'банк':'банк-клиенте', 'САПР':'САПР и сметах', 'ЭДО':'ЭДО', '1С':'1С', 'ERP':'ERP', 'Excel':'Excel', 'CRM':'CRM', 'BI':'BI',
    'трекерах':'трекерах', 'почте':'почте' };
  const TOOL_IN = { 'корпоративный ИИ':'корпоративном ИИ' };   // «работаете в …» / «как в …»
  const userSystems = () => { const s = profile && profile.systems; return !s ? [] : (Array.isArray(s) ? s : [s]); };
  const systemsLabel = () => userSystems().map(s=>SYSTEM_SOURCE[s]||s).join(', ');
  const systemSource = () => userSystems().length ? ('источник: '+systemsLabel()) : null;
  let myStaffCache = null;
  function myStaff(){
    if (myStaffCache) return myStaffCache;
    // Человек, который нанимал сам, видит ровно тех, кого нанял. Библиотека не досыпает
    // ему пятерых «под роль» — иначе «взять себе» ничего не значит.
    if (growth && growth.hired && growth.hired.length && !(profile && profile.viaSurvey)){
      const depKey = DOMAIN_DEPT[profile.domain] || profile.domain || 'assist';
      myStaffCache = growth.hired.map((h,i)=>({ id:'csh'+i, e:h.e, t:h.t, now:h.now, busy:false, dep:depKey, matched:true, tag:'взят вами' }));
      return myStaffCache;
    }
    // РОЙ №2: базовые ЦС получали dep = id отдела ('eng'→'dev'), а подобранные — ключ ДОМЕНА ('eng').
    // Подобранные встают первыми, а фильтр передач смотрит на staff[0].dep и не находил ни строки,
    // т.к. лента живёт на id отделов. Ломалось у eng/exec/analytics/project/ops (5 из 8), плюс в одном
    // рейле рисовались два разных названия отдела. Один ключ на ВЕСЬ штат.
    const mapped = DOMAIN_DEPT[profile.domain];
    const hasReal = mapped && ORG.digital && Array.isArray(ORG.digital[mapped]);
    const depKey = hasReal ? mapped : profile.domain;   // нет реального отдела → домен (deptLabel даст название направления)
    if (hasReal){
      myStaffCache = ORG.digital[mapped].slice(0,4).map((a,i)=>({ id:'cs'+i, e:a.emoji||'🤖', t:a.title||a.name, now:a.now||'на связи', ji:a.ji, busy:false, dep:depKey }));
    } else {
      const syn = SYNTH_STAFF[profile.domain] || [{e:'🤖',t:'Цифровой двойник',now:'на связи'}];
      myStaffCache = syn.map((s,i)=>({ id:'cs'+i, e:s.e, t:s.t, now:s.now, busy:false, dep:depKey }));
    }
    // профиль реально меняет СОСТАВ штата: топ-возможности из библиотеки под профиль (скоринг, не хардкод)
    const extra = matchedCaps(myStaffCache.map(c=>c.t)).map((cap,i)=>({
      id:'csm'+i, e:cap.e, t:cap.t, now:cap.now, busy:false, dep:depKey, matched:true,
      // КРИТИК: было бинарно — «не отрасль» автоматически объявлялось «болью». Теперь ярлык
      // говорит РЕАЛЬНОЕ основание, а не то, что осталось по остаточному принципу.
      tag: capHitsIndustry(cap) ? 'под вашу отрасль' : (capHitsPain(cap) ? 'под вашу боль' : 'под ваши системы'),
    }));
    if (extra.length) myStaffCache = extra.concat(myStaffCache);
    return myStaffCache;
  }
  // штат «синтетический», если у домена роли нет реального отдела в оргструктуре (SYNTH_STAFF) — тогда это по сути пустой старт
  function isSynthStaff(){ const dep = DOMAIN_DEPT[profile.domain]; return !(dep && ORG.digital && Array.isArray(ORG.digital[dep])); }
  const canCompany = () => profile.level>=4;   // высота «Компания» = Оркестратор (§2, §6)

  /* ---- персистентность: продукт помнит состояние между сессиями ---- */
  function persist(){
    if(!profile) return;
    try{ localStorage.setItem(LS_STATE, JSON.stringify({ domain:profile.domain, apSeq, k2Live, csStore, staff:myStaffCache, myAdditions,
      audit:auditLog, metrics,
      cockpit:{ view:cockpit.view, height:cockpit.height, csId:cockpit.csId } })); }catch(e){}
  }
  function loadState(){
    try{ const s=JSON.parse(localStorage.getItem(LS_STATE)||'null');
      if(s && s.domain===profile.domain){
        if(s.k2Live) k2Live=s.k2Live;
        if(Array.isArray(s.staff)) myStaffCache=s.staff;
        if(Array.isArray(s.myAdditions)) myAdditions=s.myAdditions;
        if(s.csStore) Object.assign(csStore, s.csStore);
        if(Array.isArray(s.audit)) auditLog=s.audit;          // след переживает перезагрузку
        if(s.metrics) metrics=Object.assign(M0(), s.metrics);  // метрики пилота — тоже
        // восстановить позицию в кокпите с валидацией прав/наличия
        const cp=s.cockpit;
        if(cp){
          if(cp.height==='company' && canCompany()) cockpit.height='company';
          else if(cp.height==='dept') cockpit.height='dept';
          if(cp.view==='cs' && cp.csId && (myStaffCache||[]).some(c=>c.id===cp.csId)){ cockpit.view='cs'; cockpit.csId=cp.csId; }
          else if(cp.view==='constructor') cockpit.view='constructor';
          else if(cp.view==='audit') cockpit.view='audit';   // РОЙ №2: persist сохранял 'audit', а whitelist его не знал → reload выкидывал на Пульс
          else if(cp.view==='onboard' && canCompany()) cockpit.view='onboard';
        }
        // восстановить счётчик id выше сохранённого max, иначе новые id столкнутся с восстановленными
        let mx = (typeof s.apSeq==='number') ? s.apSeq : 0;
        const scan = arr => (arr||[]).forEach(o=>{ const m=/(\d+)$/.exec(o&&o.id||''); if(m) mx=Math.max(mx, +m[1]+1); });
        if(k2Live){ scan(k2Live.approvals); scan(k2Live.drafts); }
        scan(myStaffCache);
        apSeq = mx;
      }
    }catch(e){}
  }

  function enterCabinet(){
    document.body.classList.remove('k2-chat','k2-chat2');
    myStaffCache = null;
    injectStyles(); firstEnter=true; myStaffCache=null; myAdditions=[]; k2Live=null;
    auditLog=[]; metrics=M0();
    cockpit.height='me'; cockpit.view='pulse'; cockpit.csId=null;
    layout=null; editMode=false; ensureLayout(); applyAccent();   // раскладка/цвет, собранные пользователем
    document.body.classList.toggle('k2-brief', !!profile.brief);  // «коротко, без воды» — реально плотнее
    loadState();   // восстановить состояние роли, если было
    initLive();    // добить k2Live, если чистый вход
    // топбар когерентен продукту: профиль = распознанная роль
    const who=$('#who'); if(who && profile.roleTitle){ who.innerHTML=`<span style="font-size:15px">${DOMAINS[profile.domain]?DOMAINS[profile.domain].icon:''}</span> <span>${esc(profile.roleTitle)}</span>`; who.title='Ваша роль в Среде'; }
    renderStaffRail(); renderCockpit();
    const tf=$('#tourFab'); if(tf) tf.style.display='none';   // §9: без захардкоженного тура — только реальный помощник
    const brand = $('#brandHome'); if (brand){ brand.onclick = (e)=>{ e.preventDefault(); goView('pulse'); }; }
    // ⌘K (§9): канал к помощнику — на Пульс и фокус в ввод помощника
    const cmd = $('#cmdBtn'); if (cmd){ cmd.onclick = (e)=>{ e.preventDefault(); goView('pulse'); const i=$('#k2AsstIn'); if(i){ i.focus(); i.scrollIntoView({block:'center'}); } }; }
    if (!$('#k2Reset')){
      const r = el('button','k2-reset','↺ пересобрать Среду'); r.id='k2Reset';
      r.onclick = ()=>{
        // Необратимый снос всего (профиль, штат, раскладка, аудит) — второй слой защиты от промаха мимо «+ штат»
        if(!confirm('Пересобрать Среду с нуля?\n\nПрофиль, набранный штат, раскладка кабинета и аудит-след будут удалены безвозвратно.')) return;
        localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_ONBOARD); localStorage.removeItem(LS_LAYOUT);
        layout=null; editMode=false; applyAccent(); document.body.classList.remove('k2-brief'); profile=null; active=null;
        k2Live=null; myStaffCache=null; myAdditions=[]; Object.keys(specDone).forEach(k=>delete specDone[k]); Object.keys(csStore).forEach(k=>delete csStore[k]);
        location.hash=''; runSurvey(); };
      document.body.appendChild(r);
    }
    maybeOnboard();   // одноразовый онбординг помощником — только при первом входе роли
  }

  /* ---- одноразовый онбординг: помощник проводит по трём зонам (§9: вместо захардкоженного тура) ---- */
  const wasOnboarded = () => { try{ return !!localStorage.getItem(LS_ONBOARD); }catch(e){ return false; } };
  function maybeOnboard(){
    if (wasOnboarded()) return;
    // дать кокпиту раскладку, затем подсветить зоны по их реальным координатам
    // (setTimeout, а не rAF: rAF не тикает в фоновой вкладке превью)
    setTimeout(runOnboard, 90);
  }
  function runOnboard(){
    if (wasOnboarded()) return;
    const staff = myStaff();
    const waits = participationPoints().length;
    const synth = isSynthStaff();
    const domLabel = DOMAINS[profile.domain] ? DOMAINS[profile.domain].label : 'твою роль';
    const names = staff.slice(0,2).map(c=>c.t).join(', ');
    // ПРОГОН ПРИ ВЛАДЕЛЬЦЕ: коучмарки были зашиты на «ты» — человек отвечал «На «вы», по-деловому»,
    // а онбординг тыкал ему. Профиль говорил одно, интерфейс делал другое. Коучмарки писались ДО того,
    // как появился T(), и остались мимо него. Теперь тон и краткость — как везде.
    const steps = [
      { sel:'#nav', side:'right', step:'Шаг 1 из 3', ttl:`Слева — ${T('твой','ваш')} цифровой штат`,
        bd: synth
          ? `Пока это типовой набор под ${esc(domLabel)}. Клик по любому — карточка и постановка задачи. ${T('Свой штат наберёшь внизу','Свой штат наберёте внизу')}: «+ штат».`
          : `${staff.length} ${plural(staff.length,'цифровой сотрудник','цифровых сотрудника','цифровых сотрудников')}: ${esc(names)}${staff.length>2?' и другие':''}. ${B('Клик — карточка и задача.','Клик по любому — карточка, память и постановка задачи.')}` },
      { sel:'.k2-main', side:'below', step:'Шаг 2 из 3', ttl:`В центре — ${T('твой','ваш')} день`,
        bd: waits
          ? `Помощник собрал его к 08:00. ${waits} ${plural(waits,'точка','точки','точек')} уже ждут ${T('твоего','вашего')} слова — принять, уточнить, согласовать.`
          : `Помощник собрал его к 08:00: встречи, задачи ЦС и то, что он предложил из звонков и почты.` },
      { sel:'.k2-asst', side:'left', step:'Шаг 3 из 3', ttl:`Справа — ${T('твой','ваш')} помощник`,
        bd: `${T('Спроси словами или жми чип','Спросите словами или жмите чип')} — проведу и подскажу, кому из ЦС поручить. ${synth?'С пустого места начнём вместе — предложу первый шаг.':T('Дальше сам.','Дальше сами.')}` },
    ];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ring = el('div','k2-coach-ring'); const tip = el('div','k2-coach-tip');
    document.body.appendChild(ring); document.body.appendChild(tip);
    let i = 0;
    const scrollHosts = [document, $('#stage'), $('#nav')].filter(Boolean);   // всё, что может уехать под кольцом
    const finish = ()=>{ try{ localStorage.setItem(LS_ONBOARD,'1'); }catch(e){}
      ring.remove(); tip.remove(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      scrollHosts.forEach(h=> h.removeEventListener('scroll', onResize)); };
    function onKey(e){ if(e.key==='Escape'){ finish(); } else if(e.key==='Enter'){ e.preventDefault(); adv(); } }
    function onResize(){ if(document.body.contains(ring)) draw(); }
    function adv(){ if(i>=steps.length-1){ finish(); return; } i++; draw(); }
    function draw(){
      const s = steps[i]; const t = document.querySelector(s.sel);
      if(!t){ adv(); return; }
      const r = t.getBoundingClientRect(); const pad = 8;
      const rx = Math.max(6, r.left-pad), ry = Math.max(6, r.top-pad);
      const rw = r.width+pad*2, rh = Math.min(r.height+pad*2, window.innerHeight-12);
      ring.style.left=rx+'px'; ring.style.top=ry+'px'; ring.style.width=rw+'px'; ring.style.height=rh+'px';
      const dots = steps.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('');
      const last = i===steps.length-1;
      tip.innerHTML = `<div class="step">${esc(s.step)}</div><div class="ttl">${esc(s.ttl)}</div><div class="bd">${s.bd}</div>
        <div class="k2-coach-foot"><div class="k2-coach-dots">${dots}</div>
        <div class="k2-coach-btns">${last?'':'<button class="k2-coach-skip" id="coSkip">Пропустить</button>'}<button class="k2-coach-next" id="coNext">${last?'Понятно':'Далее'}</button></div></div>`;
      const tw = Math.min(320, window.innerWidth*0.86); tip.style.width=tw+'px';
      const th = tip.offsetHeight||170;
      let tx, ty;
      if(s.side==='right'){ tx=rx+rw+14; ty=ry; }
      else if(s.side==='left'){ tx=rx-tw-14; ty=ry; }
      else { tx=rx; ty=ry+rh+14; }
      tx = Math.max(12, Math.min(tx, window.innerWidth-tw-12));
      ty = Math.max(12, Math.min(ty, window.innerHeight-th-12));
      tip.style.left=tx+'px'; tip.style.top=ty+'px';
      const nx=$('#coNext',tip); if(nx){ nx.onclick=adv; if(!reduce) nx.focus(); }
      const sk=$('#coSkip',tip); if(sk) sk.onclick=finish;
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize, {passive:true});
    // ЛИНЗА ВИДИМОСТИ (регрессия от #stage{overflow-y:auto}): кольцо позиционируется по
    // getBoundingClientRect, а #stage теперь скроллится — при прокрутке подсветка отставала от зоны.
    scrollHosts.forEach(h=> h.addEventListener('scroll', onResize, {passive:true}));
    draw();
  }
  function goView(view, csId){ cockpit.view=view; cockpit.csId=csId||null;
    const st=$('#stage'); if(st) st.scrollTop=0;   // смена экрана — единственный законный повод сбросить скролл
    renderStaffRail(); renderCockpit(); }
  /* совместимость: старые модульные функции (не в навигации кокпита) деградируют мягко */
  function renderActive(){ renderCockpit(); }
  function goModule(){ goView('pulse'); }
  function addModule(){}

  /* ---- левая колонка: мой цифровой штат (§10) ---- */
  function renderStaffRail(){
    const nav = $('#nav'); if(!nav) return; nav.innerHTML='';
    const wrap = el('div','k2-nav');
    wrap.innerHTML = `<div class="k2-nav-lbl">Мой цифровой штат</div>
      ${profile.roleTitle?`<div class="k2-nav-role">${DOMAINS[profile.domain]?DOMAINS[profile.domain].icon:''} ${esc(profile.roleTitle)}</div>`:''}`;
    myStaff().forEach(cs=>{
      const on = (cockpit.view==='cs' && cockpit.csId===cs.id);
      const item = el('div','k2-nav-item'+(on?' on':''),
        `<span class="ni">${cs.e}</span><div><div>${esc(cs.t)}</div><small>${cs.busy?'⏳ '+esc(cs.now):esc(cs.now)}</small></div>`);
      item.tabIndex=0; item.setAttribute('role','button');
      const act=()=>goView('cs', cs.id);
      item.onclick=act; item.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } };
      wrap.appendChild(item);
    });
    const add = el('div','k2-add','+ штат · чего не хватает');
    add.tabIndex=0; add.setAttribute('role','button');
    const ac=()=>goView('constructor'); add.onclick=ac; add.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); ac(); } };
    wrap.appendChild(add);
    nav.appendChild(wrap);
  }

  /* ---- центр: кокпит (шапка высоты + Пульс/ЦС/конструктор + ассистент) ---- */
  function renderCockpit(){
    const stage = $('#stage'); if(!stage) return;
    // РОЙ №2 (регрессия от #stage{overflow-y:auto}): renderCockpit пересобирает stage на КАЖДОЕ действие
    // (приёмка, санкция, ширина, скрыть, конец drag) — без этого зрителя телепортировало к шапке,
    // и результат его же клика оставался за сгибом. Позицию сбрасывает только смена экрана (goView).
    const keepScroll = stage.scrollTop;
    stage.innerHTML='';
    const shell = el('div','k2-shell'+(firstEnter?' k2-enter':'')); firstEnter=false;
    const main  = el('div','k2-main');
    // шапка высоты (только для Пульса)
    if (cockpit.view==='pulse') main.appendChild(heightBar());
    const w = el('div','k2-wrap'); main.appendChild(w);
    const aside = el('aside','k2-asst');
    shell.appendChild(main); shell.appendChild(aside); stage.appendChild(shell);
    if (cockpit.view==='cs') renderCS(w);
    else if (cockpit.view==='constructor') renderConstructorView(w);
    else if (cockpit.view==='audit') renderAudit(w);
    else if (cockpit.view==='onboard') renderOnboard(w);
    else { // pulse
      if (cockpit.height==='me') renderPulseMe(w);
      else if (cockpit.height==='dept') renderPulseDept(w);
      else renderPulseCompany(w);
    }
    renderAssistant(aside);
    const ann=$('#routeAnnounce'); if(ann) ann.textContent='Пульс';
    stage.scrollTop = keepScroll;   // вернуть зрителя туда, где он был (см. keepScroll выше)
    persist();   // готовый продукт помнит состояние
  }
  function heightBar(){
    const bar = el('div','k2-heights');
    const heights = [['me','Я'],['dept','Отдел'],['company','Компания']];
    heights.forEach(([h,lab])=>{
      const locked = (h==='company' && !canCompany());
      const b = el('button','k2-height'+(cockpit.height===h?' on':'')+(locked?' locked':''), lab+(locked?' 🔒':''));
      b.onclick = ()=>{ if(locked){
          // РОЙ №2: НАСТОЯЩИЙ отказ по допуску шёл без следа и без метрики — логировалась только витрина в карточке ЦС
          bump('denied'); k2Audit('Отказ по допуску', 'Высота «Компания» · допуск '+accessLetter(), 'deny'); persist();
          cabToast('⛔ Высота «Компания» — только Оркестратору (директор/владелец). Попытка в аудите'); return; }
        cockpit.height=h; renderCockpit(); };
      bar.appendChild(b);
    });
    return bar;
  }

  /* ---- Пульс «Я»: собранный день (§3) с точками участия (§4) ---- */
  function renderPulseMe(w){
    const staff = myStaff();
    const mins = minsSince(8);
    const ago = mins<60 ? `${mins} мин назад` : `${Math.floor(mins/60)} ч назад`;
    const when = mins>0
      ? B(`день собран к 08:00 · ${ago}`, `помощник собрал ${T('твой','ваш')} день в 08:00 по ${T('твоему','вашему')} времени · ${ago}`)
      : B(`день собирается к 08:00`, `помощник готовит ${T('твой','ваш')} день к 08:00 · сейчас ${nowHM()}`);
    w.innerHTML = head('Пульс · сегодня', `${esc(profile.roleTitle||'')} · ${when}`);
    w.appendChild(sysStrip());
    // «Среда подобрала под вас» — содержание берётся из САМОЙ подобранной возможности (модель), не из канвы под ответ
    const mc = staff.find(c=>c.matched);
    if (mc){
      // честно: называем ту боль, которую подобранный ЦС РЕАЛЬНО закрывает (а не первую попавшуюся)
      const capThemes = (CAP_LIB.find(c=>c.t===mc.t) || {}).themes || [];
      const pains = userGripe().concat(userFocus());
      const pain = pains.find(p => capThemes.includes(PAIN_THEME[p])) || pains[0];
      const gb = el('div','k2-panel'); gb.style.borderColor='var(--k-gold)';
      gb.innerHTML = `<div class="k2-item"><div class="e">${mc.e}</div><div style="flex:1">
        <div class="b">${B('Подобрано', `Среда подобрала под ${T('тебя','вас')}`)} — «${esc(mc.t)}»</div>
        <div class="m">${esc(mc.now)}${pain?B(` · «${esc(pain)}»`,` · закрывает ${T('твою','вашу')} боль: «${esc(pain)}»`):''}</div></div></div>`;
      w.appendChild(gb);
    }
    const src = systemSource();
    // 1. Ждёт меня — точки участия
    const waits = participationPoints();
    const s1 = section('Ждёт меня', waits.length?`${waits.length}`:'чисто');
    if(!waits.length) s1.appendChild(emptyEl(B('✓ Чисто.', `✓ Всё, что можно, ЦС сделали сами — от ${T('тебя','вас')} сейчас ничего не нужно.`)));
    waits.forEach(p=> s1.appendChild(pointEl(p)));
    // 2. Встречи дня (под домен роли)
    const s2 = section('Встречи дня','');
    dcontent().meet.forEach(m=> s2.appendChild(rowEl('📅', `${m[0]} · ${m[1]}`, m[2], null)));
    // 3. Мои ЦС в работе
    const s3 = section('Мои ЦС в работе', `${staff.length}`);
    // РОЙ №2: полоска «загрузки» рисовалась из позиции в массиве ([72,60,88,54][i%4]) и выдавалась за живую —
    // занятый ЦС показывал МЕНЬШЕ свободного. Числа с потолка убраны: показываем реальный этап задачи.
    staff.forEach((cs,i)=>{
      const sc=csState(cs).schedule[0];
      const r=el('div','k2-item'); r.style.cursor='pointer';
      const tagHtml = cs.tag?` · <span style="color:var(--k-gold)">${esc(cs.tag)}</span>`:'';
      const srcHtml = src?` · ${esc(src)}`:'';   // systems → провенанс-источник на карточке
      r.innerHTML=`<div class="e">${cs.e}</div><div style="flex:1"><div class="b">${esc(cs.t)}${tagHtml}${cs.busy?` · <span style="color:var(--k-gold)">этап: ${esc(TASK_STAGES[cs.stageIdx!=null?cs.stageIdx:2])}</span>`:` · <span style="color:var(--k-dim)">свободен</span>`}</div><div class="m">${esc(cs.now)}${srcHtml}${sc?` · 🔁 ${esc(sc.text)} ${esc(sc.when)}`:''}</div></div>`;
      r.onclick=()=>goView('cs', cs.id); s3.appendChild(r); });
    // 4. Предложено помощником — кандидаты из Zoom/почты (§6), под домен, одноразово
    const dc = dcontent();
    const s4 = section('Предложено помощником','');
    const cand = el('div','k2-panel');
    if (k2Live.candDone){
      cand.innerHTML = `<div class="k2-item"><div class="e">✓</div><div><div class="b">Роздано ЦС</div><div class="m">задачи из звонка ушли в работу</div></div></div>`;
    } else {
      cand.innerHTML = `<div class="k2-item"><div class="e">🎧</div><div style="flex:1"><div class="b">${esc(dc.cand.text)}</div>
        <div class="m">${B('разобрал звонок — '+T('подтверди','подтвердите'), `помощник разобрал транскрипт — ${T('подтверди или поправь','подтвердите или поправьте')}, прежде чем я раздам ЦС`)}</div></div></div>
        <div id="candBreak"></div>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="k2-btn" id="candOk">Подтвердить и раздать</button><button class="k2-tag act" id="candFix">Поправить</button></div>`;
    }
    s4.appendChild(cand);
    // 5. Передачи (слой №3: выход одного = вход другого) — этого в кокпите не было
    // РОЙ №2: flow читался на строку РАНЬШЕ, чем создавался → бейдж «ваш ход» не показывался при первом входе
    // и самозарождался после первого же клика. Создаём до чтения.
    if (!k2Live.flow) k2Live.flow = { mine:true, done:false };
    const s5 = section('Передачи', k2Live.flow.mine ? 'ваш ход' : '');
    const fp = el('div','k2-panel');
    const dc2 = dcontent();
    if (k2Live.flow.done){
      fp.innerHTML = `<div class="k2-item"><div class="e">✓</div><div><div class="b">Передано дальше</div>
        <div class="m">${esc(dc2.dept)} → смежное направление · след в аудите</div></div></div>`;
    } else {
      fp.innerHTML = `<div class="k2-item"><div class="e">🔀</div><div style="flex:1">
        <div class="b">Ваш ход: ${esc(dc2.cand.draft.replace(/^Черновик\s*/,''))}</div>
        <div class="m">${B('из смежного направления', `пришло из смежного направления · ${T('примешь','примете')} — уйдёт дальше по цепочке, выход станет входом коллеге`)}</div></div></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="k2-btn" id="flowGo">Принять и передать дальше ▶</button>
          <button class="k2-tag act" id="flowBack">↩ Вернуть автору</button>
        </div>`;
    }
    s5.appendChild(fp);
    // передачи, которые уже идут по компании (реальные из ленты, фильтр по домену)
    const xs = feed().filter(f=>f[0]==='x' && (canCompany() || f[3]===(staff[0]&&staff[0].dep))).slice(0,3);
    xs.forEach(f=> s5.appendChild(rowEl('↔', String(f[2]), 'в потоке · '+deptLabel(f[3]), null)));
    // ---- раскладка: Среда предложила скорингом, пользователь пересобрал под себя ----
    // 6. Проверка работ — есть только у того, кто проверяет чужое (руководитель и выше)
    const secMap = { wait:s1, flow:s5, meet:s2, staff:s3, cand:s4 };
    if (canReview()) secMap.check = reviewSection();
    ensureLayout();
    if (!layout.custom && userThemes().length){   // бейдж приоритета — только пока раскладку ведёт модель
      const hh=secMap[layout.order[0]] && secMap[layout.order[0]].querySelector('.k2-sec-h');
      if(hh) hh.innerHTML += ` · <span style="color:var(--k-gold)">${T('твой','ваш')} приоритет</span>`;
    }
    w.appendChild(custBar());
    const grid = el('div','k2-wgrid');
    layout.order.forEach(k=>{
      if(layout.hidden.includes(k) || !secMap[k]) return;
      grid.appendChild(widget(k, secMap[k]));
    });
    w.appendChild(grid);
    const dispatchCand = ()=>{ if(k2Live.candDone) return;
      const dep=(staff[0]&&staff[0].dep)||profile.domain;
      const inp=[...w.querySelectorAll('#candBreak input')].map(i=>i.value.trim()).filter(Boolean);
      const items = inp.length ? inp : [dc.cand.task, dc.cand.draft.replace(/^Черновик\s*/,'')];  // читаем правки, если раскрыт разбор
      addApproval({task:items[0], dept:dep, cost:'₽12 / задача', risk:'low'});
      items.slice(1).forEach(t=> k2Live.drafts.unshift({id:'drc'+(apSeq++), text:'Черновик: '+t, dept:dep, who:'помощник'}));
      bump('tasks', items.length); k2Audit('Задачи из звонка розданы ЦС', items.join(' · '), 'ok');   // РОЙ: тост рапортовал, а следа не было
      k2Live.candDone=true;
      cabToast(`✓ ${items.length} ${plural(items.length,'задача роздана','задачи розданы','задач роздано')} ЦС`); renderCockpit(); };
    // передачи: приняв, человек двигает работу дальше — со следом
    const fg=$('#flowGo',w); if(fg) fg.onclick=()=>{ k2Live.flow.done=true; k2Live.flow.mine=false;
      k2Audit('Передача: принято и передано дальше', dc2.cand.draft.replace(/^Черновик\s*/,''), 'ok');
      cabToast('✓ Принято и передано дальше — выход стал входом коллеге'); renderCockpit(); };
    const fb=$('#flowBack',w); if(fb) fb.onclick=()=>{ k2Live.flow.done=true; k2Live.flow.mine=false;
      k2Audit('Передача: возвращено автору', dc2.cand.draft.replace(/^Черновик\s*/,''), 'warn');
      cabToast('↩ Возвращено автору на доработку'); renderCockpit(); };
    const ok=$('#candOk',w); if(ok) ok.onclick=dispatchCand;
    const fix=$('#candFix',w); if(fix) fix.onclick=()=>{   // честно: раскрыть разбор, а не врать тостом
      const items=[dc.cand.task, 'Подготовить: '+dc.cand.draft.replace('Черновик ',''), 'Назначить встречу по итогам', 'Обновить статус в системе'];
      const b=$('#candBreak',w);
      b.innerHTML = `<div class="k2-empty" style="padding:8px 2px">Помощник разобрал звонок на ${items.length} задачи — поправьте формулировки и раздайте:</div>`+
        items.map(t=>`<div class="k2-item"><div class="e">•</div><div style="flex:1"><input class="k2-ta" style="min-height:0;padding:8px 10px;font-size:13.5px" value="${esc(t)}"/></div></div>`).join('');
      fix.style.display='none';
    };
  }
  /* ---- панель настройки кабинета ---- */
  function custBar(){
    const bar = el('div','k2-cust');
    const edit = el('button','k2-cust-btn'+(editMode?' on':''), editMode?'✓ Готово':'⚙ Настроить');
    edit.onclick = ()=>{ editMode=!editMode; renderCockpit(); };
    bar.appendChild(edit);
    if (!editMode){
      const hint = el('span','k2-cust-hint', layout.custom ? B('собран вами','кабинет собран вами') : B('подобрано Средой','раскладку подобрала Среда — можно пересобрать'));
      bar.appendChild(hint);
      return bar;
    }
    bar.appendChild(el('span','k2-cust-hint', B('тяните · ⬌ ширина · ↕ высота · ✕ скрыть','тяните карточки · ⬌ ширина · ↕ низ карточки · ✕ скрыть')));
    // цвет
    const sw = el('span','k2-sw');
    ACCENTS.forEach(c=>{ const i=el('i'); i.style.background=c;
      if(layout.accent===c) i.classList.add('on');
      // РОЙ: цвет — не раскладка. touchLayout() помечал кабинет «собран вами» и гасил бейдж «ваш приоритет»,
      // хотя человек ничего не двигал. Цвет просто сохраняем.
      i.title='Цвет акцента'; i.onclick=()=>{ layout.accent=c; saveLayout(); applyAccent(); renderCockpit(); }; sw.appendChild(i); });
    const pick = el('input'); pick.type='color'; pick.value = layout.accent || '#36c994'; pick.title='Свой цвет';
    // РОЙ №2: пипетка не ограничивалась по яркости — очень тёмный акцент делал ВЕСЬ акцентный текст невидимым
    // (акцентом красится и текст, не только фон) и переживал перезагрузку. Поднимаем яркость до читаемой.
    pick.oninput = (e)=>{ layout.accent = ensureReadable(e.target.value); saveLayout(); applyAccent(); };
    sw.appendChild(pick); bar.appendChild(sw);
    // скрытые → вернуть
    if (layout.hidden.length){
      const hc = el('span','k2-hidden-chips');
      layout.hidden.forEach(k=>{ const b=el('button','k2-cust-btn','+ '+WTITLE[k]);
        b.onclick=()=>{ layout.hidden=layout.hidden.filter(x=>x!==k); if(!layout.order.includes(k)) layout.order.push(k); touchLayout(); renderCockpit(); };
        hc.appendChild(b); });
      bar.appendChild(hc);
    }
    const rst = el('button','k2-cust-btn','↺ вернуть подобранное Средой');
    // РОЙ №2: сброс молча стирал и ЦВЕТ, хотя правка №14 специально развела цвет и раскладку — цвет не раскладка.
    rst.onclick = ()=>{ const keepAccent = layout.accent;
      layout = defaultLayout(); layout.accent = keepAccent; saveLayout(); applyAccent(); renderCockpit();
      cabToast('↺ Вернул раскладку, которую подобрала Среда (цвет оставил)'); };
    bar.appendChild(rst);
    return bar;
  }

  /* ---- виджет: перетаскивание, ширина, высота, скрытие ---- */
  let dragKey = null;
  function widget(k, secEl){
    const wrap = el('div','k2-w'+(editMode?' edit':''));
    wrap.dataset.w = k;
    const span = layout.span[k] || 1;
    wrap.style.gridColumn = 'span '+span;
    if (layout.h[k]){ wrap.style.height = layout.h[k]+'px'; wrap.classList.add('sized'); }
    // инструменты
    const tools = el('div','k2-w-tools');
    const bSpan = el('button',null,'⬌'); bSpan.title='Ширина: половина / во всю';
    bSpan.onclick = (e)=>{ e.stopPropagation(); layout.span[k] = (span===2?1:2); touchLayout(); renderCockpit(); };
    const bHide = el('button',null,'✕'); bHide.title='Скрыть карточку';
    bHide.onclick = (e)=>{ e.stopPropagation(); if(!layout.hidden.includes(k)) layout.hidden.push(k);
      layout.order = layout.order.filter(x=>x!==k); touchLayout(); renderCockpit(); };
    tools.appendChild(bSpan); tools.appendChild(bHide); wrap.appendChild(tools);
    const body = el('div','k2-w-b'); body.appendChild(secEl); wrap.appendChild(body);
    if (editMode){
      // перетаскивание на pointer-events: работает и мышью, и пальцем (HTML5 DnD на тач не работает)
      wrap.addEventListener('pointerdown', e=>{
        if (e.target.closest('.k2-w-tools') || e.target.closest('.k2-w-rz')) return;   // не мешать кнопкам и ресайзу
        if (e.button != null && e.button !== 0) return;
        const startX=e.clientX, startY=e.clientY; let moved=false;
        const mv = ev=>{
          if(!moved && Math.hypot(ev.clientX-startX, ev.clientY-startY) < 6) return;   // порог, чтобы клик не считался драгом
          if(!moved){ moved=true; dragKey=k; wrap.classList.add('drag'); wrap.setPointerCapture(e.pointerId); }
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const over = t && t.closest && t.closest('.k2-w');
          [...document.querySelectorAll('.k2-w.over')].forEach(x=>x.classList.remove('over'));
          if(over && over.dataset.w!==k) over.classList.add('over');
        };
        const up = ev=>{
          wrap.removeEventListener('pointermove',mv); wrap.removeEventListener('pointerup',up); wrap.removeEventListener('pointercancel',up);
          wrap.classList.remove('drag');
          [...document.querySelectorAll('.k2-w.over')].forEach(x=>x.classList.remove('over'));
          if(!moved){ dragKey=null; return; }
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const over = t && t.closest && t.closest('.k2-w');
          const target = over && over.dataset.w;
          dragKey=null;
          if(!target || target===k) return;
          // РОЙ: вставляли всегда ПЕРЕД целью → положить карточку в последний слот было невозможно.
          // Смотрим, куда именно уронили: в нижнюю половину цели — значит ПОСЛЕ неё.
          const r = over.getBoundingClientRect();
          const after = ev.clientY > r.top + r.height/2;
          const o = layout.order.filter(x=>x!==k);
          o.splice(o.indexOf(target) + (after ? 1 : 0), 0, k);
          layout.order = o; touchLayout(); renderCockpit();
        };
        wrap.addEventListener('pointermove',mv); wrap.addEventListener('pointerup',up); wrap.addEventListener('pointercancel',up);
      });
      // высота — тянем низ карточки
      const rz = el('div','k2-w-rz');
      rz.addEventListener('pointerdown', e=>{
        e.preventDefault(); e.stopPropagation();
        const startY=e.clientY, startH=wrap.offsetHeight;
        rz.setPointerCapture(e.pointerId);
        const mv = ev=>{ const h=Math.max(120, startH+(ev.clientY-startY)); wrap.style.height=h+'px'; wrap.classList.add('sized'); layout.h[k]=h; };
        const up = ()=>{ rz.removeEventListener('pointermove',mv); rz.removeEventListener('pointerup',up); touchLayout(); };
        rz.addEventListener('pointermove',mv); rz.addEventListener('pointerup',up);
      });
      wrap.appendChild(rz);
    }
    return wrap;
  }

  function section(title, badge){ const s=el('div'); s.style.marginBottom='14px';
    s.innerHTML=`<div class="k2-sec-h">${esc(title)}${badge?` · <b>${esc(badge)}</b>`:''}</div>`; return s; }
  function emptyEl(t){ const p=el('div','k2-panel'); p.innerHTML=`<div class="k2-empty">${esc(t)}</div>`; return p; }
  /* жизненный цикл задачи (§7.2): постановка → проверка допустимости → выполнение → приёмка */
  const TASK_STAGES = ['постановка','проверка допустимости','выполнение','приёмка'];
  function taskLifecycle(cur){
    const box=el('div','k2-life');
    box.innerHTML = TASK_STAGES.map((s,i)=>{
      const cls = i<cur?'done':(i===cur?'now':'');
      return `<span class="k2-life-step ${cls}">${i<cur?'✓':(i===cur?'⏳':'○')} ${esc(s)}</span>`;
    }).join('<span class="k2-life-arr">→</span>');
    return box;
  }
  /* системные агенты как фоновые индикаторы (§5.3): учёт/ИБ/аудит/знания */
  function sysStrip(){
    const meter = ($('#meterBtn')?.textContent||'').split('ИИ')[0].trim() || '₽384k';
    const reg = industryReg();
    const s=el('div','k2-sys');
    // РОЙ: «🛡️ ИБ: 0 в карантине» и «📚 знания: актуальны» — ярлыки-обещания, за которыми не было НИ СТРОКИ кода.
    // Убраны. Осталось только то, за чем есть вещество: счётчик ИИ (мок-данные, как весь DASH),
    // кликабельный аудит (реальный экран), отраслевой профиль и подключённые системы (из ответов).
    s.innerHTML = `<span title="Агент учёта ресурсов · демо-данные">💰 ${esc(meter)} ИИ/нед</span>
      <span class="k2-sys-link" id="sysAudit" role="button" tabindex="0" title="Открыть аудит-след">📋 аудит-след: ${auditLog.length?auditLog.length+' записей':'пуст'} →</span>
      ${reg?`<span title="Отраслевой профиль">🏛️ профиль отрасли: ${esc(reg)}</span>`:''}
      ${userSystems().length?`<span title="Интеграции">🔌 подключено: ${esc(systemsLabel())}</span>`:''}`;
    const au=$('#sysAudit',s);
    if(au){ const open=()=>goView('audit'); au.onclick=open; au.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } }; }
    return s;
  }

  /* ---- точки участия (§4): приёмка / санкция / уточнение ---- */
  /* ============ ПРОВЕРКА РАБОТ · направленное внимание =====================
     Руководитель проверяет выборочно и наугад — не потому, что так правильно,
     а потому что нет сигнала, куда смотреть. ЦС считает дешёвые признаки по
     ВСЕМ работам цикла и решает, какие показать первыми. Проверяет по-прежнему
     человек: признаки не выносят вердикт, они расставляют очередь.
     Пул работ ГЕНЕРИРУЕТСЯ из домена — ни одна работа не написана руками,
     иначе новая роль или отрасль потребовала бы дописывать контент. */
  const REVIEW_SIGNALS = [
    { k:'drift',  t:'расхождение с прошлым циклом того же исполнителя', w:3 },
    { k:'range',  t:'показатель вышел из коридора',                     w:3 },
    { k:'incons', t:'внутренняя несогласованность',                     w:2 },
    { k:'gaps',   t:'пропуски и незаполненное',                         w:2 },
    { k:'late',   t:'сдано после срока',                                w:1 },
  ];
  const REVIEW_KIND = { finance:'Сверка', estimate:'Смета', eng:'Ревью', sales:'Сделка',
    marketing:'Кампания', ops:'Заявка', hr:'Подбор', legal:'Договор', project:'Этап',
    analytics:'Отчёт', exec:'Решение', assist:'Заявка' };
  const REVIEW_POOL = 100;   // работ за цикл
  const REVIEW_LOOK = 12;    // столько человек успевает посмотреть за цикл
  const REVIEW_SHOW = 6;     // столько показываем сразу — остальное за «ещё»
  const canReview = () => !!profile && profile.level >= 3;   // проверяет тот, у кого есть подчинённые
  let reviewMode = 'signals';   // 'signals' | 'random' — переключатель для показа
  let reviewAll  = false;       // очередь длинная: сразу показываем первые, остальное по кнопке
  const reviewSeen = {};        // id → 'ok' | 'back'

  // детерминированный хэш: одна и та же Среда показывает одно и то же при каждом входе
  function rhash(i, salt){
    let h = 2166136261 ^ Math.imul(i, 2654435761);
    const s = String(profile && profile.domain) + '|' + salt;
    for (let j=0;j<s.length;j++){ h ^= s.charCodeAt(j); h = Math.imul(h, 16777619); }
    h ^= h>>>15; h = Math.imul(h, 2246822507); h ^= h>>>13;
    return ((h>>>0) % 10000) / 10000;
  }
  function reviewWorkers(){
    const dep = DOMAIN_DEPT[profile.domain];
    const t = (ORG.team && Array.isArray(ORG.team[dep])) ? ORG.team[dep] : [];
    const names = t.map(p => [p.name, p.surname].filter(Boolean).join(' ').trim()).filter(Boolean).slice(0,4);
    ['исполнитель А','исполнитель Б','исполнитель В','исполнитель Г']
      .forEach(n=>{ if(names.length<4) names.push(n); });
    return names;
  }
  function reviewPool(){
    const who = reviewWorkers(), kind = REVIEW_KIND[profile.domain] || 'Работа', out = [];
    for (let i=0;i<REVIEW_POOL;i++){
      // дефект — то, что человек увидит, только ОТКРЫВ работу. Признак — не дефект,
      // а его дешёвый след: бывает и там, где всё в порядке, и пропускается там, где нет.
      const bad = rhash(i,'bad') < 0.08;
      const sig = REVIEW_SIGNALS.filter(s => rhash(i, s.k) < (bad ? 0.42 : 0.022));
      out.push({ id:'w'+i, n:i+1, bad:bad, signals:sig,
        who: who[Math.floor(rhash(i,'who')*who.length) % who.length],
        title: kind+' №'+(i+1),
        score: sig.reduce((a,s)=>a+s.w, 0) });
    }
    return out;
  }
  const reviewRandom = pool => pool.slice().sort((a,b)=> rhash(a.n,'rnd')-rhash(b.n,'rnd')).slice(0, REVIEW_LOOK);
  const reviewDirected = pool => pool.slice()
    .sort((a,b)=> (b.score-a.score) || (a.n-b.n)).slice(0, REVIEW_LOOK);

  function reviewSection(){
    const pool = reviewPool();
    const bad = pool.filter(w=>w.bad).length;
    const directed = reviewDirected(pool), random = reviewRandom(pool);
    const sample = reviewMode==='signals' ? directed : random;
    const hitD = directed.filter(w=>w.bad).length, hitR = random.filter(w=>w.bad).length;
    const s = section('Проверка работ', `${REVIEW_LOOK} из ${REVIEW_POOL}`);

    const sw = el('div','k2-panel');
    sw.innerHTML = `<div class="k2-item"><div style="flex:1">
        <div class="b">${reviewMode==='signals'
          ? B('Поднято по признакам', 'Поднято к проверке — ЦС посчитал признаки по всем работам цикла')
          : B('Случайная выборка', 'Случайная выборка — как сейчас, без подсказки куда смотреть')}</div>
        <div class="m">${T('за цикл','за цикл')} ${REVIEW_POOL} ${plural(REVIEW_POOL,'работа','работы','работ')} · ${T('успеваешь','успеваете')} посмотреть ${REVIEW_LOOK}</div></div>
      <div style="display:flex;gap:6px">
        <button class="k2-tag act${reviewMode==='signals'?' ok':''}" id="rvSig">по признакам</button>
        <button class="k2-tag act${reviewMode==='random'?' ok':''}" id="rvRnd">наугад</button>
      </div></div>`;
    const bSig = sw.querySelector('#rvSig'), bRnd = sw.querySelector('#rvRnd');
    if(bSig) bSig.onclick = ()=>{ if(reviewMode==='signals') return; reviewMode='signals';
      k2Audit('Проверка: очередь по признакам', `${REVIEW_LOOK} из ${REVIEW_POOL}`, 'ok'); renderCockpit(); };
    if(bRnd) bRnd.onclick = ()=>{ if(reviewMode==='random') return; reviewMode='random';
      k2Audit('Проверка: случайная выборка', `${REVIEW_LOOK} из ${REVIEW_POOL}`, 'warn'); renderCockpit(); };
    s.appendChild(sw);

    sample.slice(0, reviewAll ? REVIEW_LOOK : REVIEW_SHOW).forEach(w=>{
      const it = el('div','k2-item'); it.style.cursor='pointer';
      const seen = reviewSeen[w.id];
      const why = w.signals.length
        ? w.signals.map(x=>x.t).join(' · ')
        : (reviewMode==='random' ? 'признаков нет — работа взята наугад' : '');
      const dot = w.signals.length ? '🟡' : '⚪';
      it.innerHTML = `<div class="e">${seen?(seen==='ok'?'✓':'↩'):dot}</div><div style="flex:1">
          <div class="b">${esc(w.title)} · <span style="color:var(--k-dim)">${esc(w.who)}</span></div>
          <div class="m">${esc(why)}</div></div>
        ${seen?'':`<div style="display:flex;gap:6px"><button class="k2-tag act ok">Принять</button><button class="k2-tag act">Вернуть</button></div>`}`;
      if(!seen){
        const [okB, backB] = it.querySelectorAll('.act');
        okB.onclick = e=>{ e.stopPropagation(); reviewSeen[w.id]='ok'; bump('accepted'); if(!w.signals.length) bump('clean');
          k2Audit('Работа принята', w.title+' · '+w.who+(w.signals.length?(' · признаки: '+w.signals.map(x=>x.k).join(',')):''), 'ok');
          persist(); renderCockpit(); };
        backB.onclick = e=>{ e.stopPropagation(); reviewSeen[w.id]='back'; bump('rejected');
          k2Audit('Работа возвращена автору', w.title+' · '+w.who, 'warn');
          persist(); cabToast('↩ Возвращено автору'); renderCockpit(); };
      }
      it.onclick = ()=> cabToast(w.signals.length
        ? 'Поднято потому, что: '+w.signals.map(x=>x.t).join('; ')
        : 'Признаков нет — работа попала в выборку случайно');
      s.appendChild(it);
    });

    if (!reviewAll && sample.length > REVIEW_SHOW){
      const more = el('div','k2-item'); more.style.cursor='pointer';
      more.innerHTML = '<div class="e">⋯</div><div style="flex:1"><div class="m">ещё '+(sample.length-REVIEW_SHOW)+' '+plural(sample.length-REVIEW_SHOW,'работа','работы','работ')+' в очереди проверки</div></div>';
      more.onclick = ()=>{ reviewAll = true; renderCockpit(); };
      s.appendChild(more);
    }
    // честная сводка: пул — модель, поэтому сравнение считается, а не рисуется
    const sum = el('div','k2-panel'); sum.style.marginTop='8px';
    sum.innerHTML = `<div class="k2-empty" style="padding:8px 2px">
      На этом цикле дефект несут <b>${bad}</b> ${plural(bad,'работа','работы','работ')} из ${REVIEW_POOL}.
      Та же дюжина проверок находит <b>${hitD}</b> по признакам и <b>${hitR}</b> наугад.
      Признаки не судят — они решают, что посмотреть первым.</div>`;
    s.appendChild(sum);
    return s;
  }

  function participationPoints(){
    const pts=[];
    // §4: точки — по ТВОИМ ЦС/домену. Оркестратор (level>=4) видит всю компанию;
    // специалист — свой домен + всё, что создал сам (id 'apn'/'drt'/'drc').
    const orch = canCompany();
    const myDep = DOMAIN_DEPT[profile.domain];
    const myLabel = deptLabel(myDep||profile.domain);
    const mine = id => { const s=String(id); return s.indexOf('apn')===0 || s.indexOf('drt')===0 || s.indexOf('drc')===0; };
    // ДОЛЖНОСТЬ РЕШАЕТ ОХВАТ ДАННЫХ (зрелость решает рычаги — это другая ось).
    // Было: уровни 1–3 видели одно и то же, различался только титул в шапке.
    //   1 Исполнитель — только то, что создал сам;
    //   2 Специалист  — весь свой домен;
    //   3 Руководитель— + санкции своего отдела (решение о расходе и риске);
    //   4+ Оркестратор— вся компания.
    const canSanction = profile.level >= 3;
    const apprOk  = a => canSanction && (orch || mine(a.id) || a.dept===myLabel);
    const draftOk = d => orch || mine(d.id) ||
      (profile.level >= 2 && (d.dept===myDep || deptLabel(d.dept)===myLabel));
    // РОЙ №2: единственное место, где dept шёл БЕЗ deptLabel — из-за этого мои же addApproval (эскалация,
    // раздача из звонка) с dept=ключом домена рисовали на проекторе «… · finance · риск low».
    // deptLabel безопасен и для готовых меток (вернёт как есть), поэтому лечим на выходе — закрывает и будущие источники.
    liveApprovals().filter(apprOk).forEach(a=> pts.push({ kind:'sanction', id:a.id, icon:'🔴', label:'Разрешить', title:a.task, meta:`${deptLabel(a.dept)} · ${a.cost} · риск ${a.risk}` }));
    liveDrafts().filter(draftOk).slice(0,6).forEach(d=> pts.push({ kind:'intake', id:d.id, icon:'🔴', label:'Принять', title:d.text, meta:`${deptLabel(d.dept)}${profile.depth?' · '+d.who:''}` }));
    (k2Live.clarify||[]).forEach(c=> pts.push({ kind:'clarify', id:c.id, icon:'🟡', label:'Ответить', title:c.text, meta:c.who }));
    (k2Live.coord||[]).forEach(c=> pts.push({ kind:'coord', id:c.id, icon:'🟡', label:'Согласовать', title:c.text, meta:c.who }));
    return pts;
  }
  function pointEl(p){
    const it=el('div','k2-item k2-point k2-'+p.kind); it.dataset.id=p.id;
    const canReject = (p.kind==='sanction' || p.kind==='coord' || p.kind==='intake');
    it.innerHTML=`<div class="e">${p.icon}</div><div style="flex:1"><div class="b">${esc(p.title)}</div><div class="m">${esc(p.meta||'')}</div></div>
      <div style="display:flex;gap:6px"><button class="k2-tag act ok">${esc(p.label)}</button>${canReject?'<button class="k2-tag act">отклонить</button>':''}</div>`;
    const ok=it.querySelector('.ok');
    ok.onclick=()=> animateOut(it, ()=>{
      if(p.kind==='intake') acceptDraft(p.id);
      else if(p.kind==='sanction') resolveApproval(p.id,true);
      // РОЙ №2: «согласование» и «уточнение» решались БЕЗ следа и без метрики, хотя экран аудита заявляет полноту
      else if(p.kind==='coord'){ k2Live.coord=(k2Live.coord||[]).filter(c=>c.id!==p.id);
        k2Audit('Согласование выдано', p.title, 'ok'); cabToast('✓ Согласовано — ваш ЦС подключён к задаче'); refreshLive(); }
      else { k2Live.clarify=(k2Live.clarify||[]).filter(c=>c.id!==p.id);
        k2Audit('Уточнение: ответ дан ЦС', p.title, 'ok'); cabToast('✓ Ответ отправлен ЦС'); refreshLive(); }
    });
    if(p.kind==='sanction'){ it.querySelectorAll('.act')[1].onclick=()=> animateOut(it, ()=> resolveApproval(p.id,false)); }
    else if(p.kind==='coord'){ it.querySelectorAll('.act')[1].onclick=()=> animateOut(it, ()=>{ k2Live.coord=(k2Live.coord||[]).filter(c=>c.id!==p.id);
      k2Audit('Согласование отклонено', p.title, 'deny'); cabToast('✗ Отклонено — ваш ЦС не подключён'); refreshLive(); }); }
    else if(p.kind==='intake'){ it.querySelectorAll('.act')[1].onclick=()=> animateOut(it, ()=> rejectDraft(p.id)); }
    return it;
  }

  /* ---- Пульс «Отдел» (§2): штат отдела + передачи ---- */
  function renderPulseDept(w){
    w.innerHTML = head('Пульс · отдел', 'мой основной контекст — штат отдела и передачи между людьми и ЦС');
    const dep = DOMAIN_DEPT[profile.domain];
    const people = (dep && ORG.hc && ORG.hc[dep])||0, dig=(dep && ORG.dhc && ORG.dhc[dep])||myStaff().length;
    const badge = people ? `${people} чел · ${dig} ЦС` : `${dig} ЦС · цифровой штат`;   // без «0 чел» для доменов без людей-отдела
    const s1=section('Штат отдела', badge);
    myStaff().forEach(cs=> s1.appendChild(rowEl(cs.e, cs.t, cs.now, null)));
    w.appendChild(s1);
    const s2=section('Передачи между ролями','');
    const x=feed().filter(f=>f[0]==='x' && (canCompany() || f[3]===dep)); if(!x.length) s2.appendChild(emptyEl('передач в вашем отделе сейчас нет'));
    x.forEach(f=> s2.appendChild(rowEl('🔗', f[2], f[1], null)));
    w.appendChild(s2);
  }
  /* ---- Пульс «Компания» (§2): только Оркестратору + вход в онбординг (§11) ---- */
  function renderPulseCompany(w){
    if(!canCompany()){
      w.innerHTML = head('Пульс · компания','высота Оркестратора');
      w.appendChild(emptyEl('🔒 Обзор всей компании доступен Оркестратору — директору или владельцу. На вашем уровне Среда показывает ваш стол и ваш отдел.'));
      return;
    }
    renderPulse(w); // загрузка направлений + живая лента
    const ob=el('div'); ob.style.marginTop='14px';
    ob.innerHTML=`<div class="k2-sec-h">Оркестратор</div>`;
    const b=el('button','k2-btn','🏗 Собрать компанию из ТЗ'); b.onclick=()=>goView('onboard'); ob.appendChild(b);
    w.appendChild(ob);
  }

  /* ---- Онбординг компании из ТЗ (§11): админ+помощник → штат из библиотеки ролей ---- */
  function renderOnboard(w){
    w.innerHTML = `<button class="k2-back" id="obBack">← к Пульсу</button>` +
      head('Онбординг компании', 'админ и его помощник читают ТЗ → Среда комплектует штат из библиотеки ролей');
    const p=el('div','k2-panel'); p.innerHTML='<h3>ТЗ / описание компании</h3>';
    const ta=el('textarea','k2-ta'); ta.style.minHeight='120px';
    ta.value='ИТ-компания: разработка ИИ-платформы, продажи и тендеры РЖД, маркетинг, бухгалтерия и финансы, юридический отдел, HR, сметный отдел, производство и внедрения.';
    p.appendChild(ta);
    const go=el('button','k2-btn','Собрать компанию ▶'); const out=el('div'); out.style.marginTop='14px';
    go.onclick=()=>{
      const t=ta.value.toLowerCase();
      const detect=[['разраб|ии|платформ|код|it','eng'],['продаж|тендер|клиент','sales'],['маркет','marketing'],
        ['бухгалт|финанс','finance'],['юр|право|договор','legal'],['hr|кадр|персонал','hr'],
        ['смет|расчёт','estimate'],['производ|внедрен','ops'],['аналит|данны','analytics']];
      const found=[]; detect.forEach(([re,d])=>{ if(new RegExp(re).test(t) && found.indexOf(d)<0) found.push(d); });
      let total=0;
      out.innerHTML=`<div class="k2-sec-h">Среда распознала <b>${found.length}</b> направлений и укомплектовала штат из библиотеки (${ROLES.length} ролей)</div>`;
      found.forEach(d=>{ const roles=ROLES.filter(r=>r.d===d).slice(0,3); total+=roles.length;
        const pane=el('div','k2-panel'); pane.innerHTML=`<h3>${DOMAINS[d].icon} ${esc(DOMAINS[d].label)} · ${roles.length} ЦС</h3>`;
        roles.forEach(r=> pane.appendChild(rowEl('🤖', 'Двойник · '+r.t, esc(LEVELS[r.l]), null)));
        out.appendChild(pane); });
      cabToast(`✓ Компания собрана: ${found.length} направлений, ${total} ЦС из библиотеки`);
    };
    p.appendChild(go); w.appendChild(p); w.appendChild(out);
    $('#obBack',w).onclick=()=>goView('pulse');
  }

  /* ---- локальное время (§7.1: Пульс собирается к 08:00 по таймзоне) ---- */
  function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  function minsSince(h){ const d=new Date(); const m=(d.getHours()-h)*60+d.getMinutes(); return m>0?m:0; }

  /* ---- память, журнал (провенанс), расписание ЦС (§4.2, §7.1) ---- */
  const csStore = {};
  function csState(cs){
    const k = profile.domain+':'+cs.id;
    if(!csStore[k]) csStore[k] = {
      journal: seedJournal(cs),
      schedule: [{ kind:'regular', text:'ежедневный брифинг по контексту', when:'09:00' }],
    };
    return csStore[k];
  }
  function seedJournal(cs){
    return [
      { text:`Выполнил: ${cs.now}`, prov:['источник: CRM · почта · календарь','шаблон роли','история контекста'] },
      { text:'Собрал черновик — на вашу приёмку', prov:['данные из системы (только чтение)','правило роли v1.2','лимиты допуска соблюдены'] },
    ];
  }
  function csMemory(cs){
    const ji=cs.ji||{}; const f=[]; const dc=DCONTENT[cs.dep]||dcontent();   // память — из домена САМОГО ЦС (нанятый из чужого домена не путает правила)
    if(ji.duties) ji.duties.slice(0,2).forEach(d=> f.push('умеет: '+d));
    else f.push('умеет: '+cs.now);
    (dc.mem||[]).forEach(m=> f.push(m));   // контекст + правило под домен роли
    if(ji.limits) f.push('граница: '+ji.limits[0]);
    return f.slice(0,4);
  }

  // соседние роли: тот же домен (другие уровни) + соседние домены на том же уровне
  // РОЙ №2: соседей из ЧУЖИХ доменов брали просто первыми по порядку массива ROLES — из-за этого
  // разработчику предлагали трёх бухгалтеров. Соседи должны быть из доменов, которые РЕАЛЬНО конкурировали
  // в ответах (altDomains — топ по domScore), иначе это не «ближайшие», а случайные.
  function nearbyRoles(domain, level, exclude, altDomains){
    const out=[], seen=new Set([exclude]);
    const push=r=>{ if(r && !seen.has(r.t)){ seen.add(r.t); out.push(r); } };
    // 1) тот же домен, соседние уровни — самые вероятные
    ROLES.filter(r=>r.d===domain && r.l!==level).sort((a,b)=>Math.abs(a.l-level)-Math.abs(b.l-level)).slice(0,3).forEach(push);
    // 2) домены, которые competed в опросе, на том же уровне
    (altDomains||[]).filter(d=>d!==domain).forEach(d=>{
      ROLES.filter(r=>r.d===d && r.l===level).slice(0,1).forEach(push);
      if(out.length<6) ROLES.filter(r=>r.d===d && Math.abs(r.l-level)===1).slice(0,1).forEach(push);
    });
    return out.slice(0,6);
  }

  /* ==================== ГРАНИЦЫ ИСПОЛНЯЮТСЯ КОДОМ ====================
     Тезис показа «необратимое запрещено по построению» должен быть кликабелен,
     а не написан. Допуск выводится из уровня роли: B — только своё, P — отдел, A — домен. */
  const accessLetter = () => profile.level>=4 ? 'A' : (profile.level>=3 ? 'P' : 'B');
  const accessLabel  = () => profile.level>=4 ? 'полный по домену' : (profile.level>=3 ? 'частичный: свой отдел' : 'только своё');
  const BOUNDARIES = [
    { label:'Отправить клиенту самому', why:'внешнее действие необратимо',
      rule:'Отправляет человек. У цифрового сотрудника такой кнопки нет по построению — это граница должностной инструкции, исполняемая кодом.' },
    { label:'Показать все сделки отдела', needs:3, why:'допуск B — только свои объекты',
      rule:'Ваш допуск — B (только своё). Запрос отклонён ДО выполнения, данные не читались. Могу отправить запрос на эскалацию РЦС.' },
    { label:'Открыть финансовую сводку', needs:4, why:'сводка — уровень A',
      rule:'Финансовая сводка закрыта всем, кроме допуска A. Отклонено до выполнения; попытка видна владельцу платформы.' },
    { label:'Удалить журнал задачи', why:'аудит неизменяем',
      rule:'След аудита неизменяем по построению — его нельзя стереть ни человеку, ни цифровому сотруднику. Прозрачность — свойство среды, а не настройка.' },
  ];
  // Настоящая проверка допустимости текста задачи: те же границы, что и в BOUNDARIES.
  // Возвращает нарушенную границу или null. Без неё журнал врал, что проверка «пройдена».
  const ADMIT = [
    { re:/отправ|разошл|пошли|направь/i, needsNone:true, label:'Отправить клиенту самому', why:'внешнее действие необратимо',
      rule:'Отправляет человек. У цифрового сотрудника такой кнопки нет по построению — это граница ДИ, исполняемая кодом. Задача не принята.' },
    { re:/удали|сотри|очисти.*(журнал|аудит|след)/i, needsNone:true, label:'Удалить журнал задачи', why:'аудит неизменяем',
      rule:'След аудита нельзя стереть ни человеку, ни цифровому сотруднику. Задача не принята.' },
    { re:/(все|чуж|весь отдел).*(сделк|контракт)|сделки отдела/i, needs:3, label:'Показать все сделки отдела', why:'допуск B — только свои объекты',
      rule:'Ваш допуск B (только своё). Запрос отклонён ДО выполнения, данные не читались.' },
    { re:/финанс.*(сводк|отч[её]т компании)|сводка по компании/i, needs:4, label:'Открыть финансовую сводку', why:'сводка — уровень A',
      rule:'Финансовая сводка закрыта всем, кроме допуска A. Отклонено до выполнения.' },
  ];
  function admissibility(text){
    const t = String(text||'');
    for (const a of ADMIT){
      if (!a.re.test(t)) continue;
      if (a.needsNone) return a;                 // запрещено всем, независимо от уровня
      if (a.needs && profile.level < a.needs) return a;
    }
    return null;
  }
  function denyAction(cs, b, host){
    bump('denied');
    k2Audit('Отказ по границе полномочий', `${b.label} → ${cs.t}`, 'deny');
    persist();   // РОЙ №2: экран клялся «попытка записана в аудит-след», а reload стирал и запись, и метрику
    let box = host.querySelector('.k2-deny');
    if(!box){ box = el('div','k2-deny'); host.appendChild(box); }
    box.innerHTML = `<div class="dh">⛔ Отклонено до выполнения</div>
      <div class="db"><b>«${esc(b.label)}»</b> — ${esc(b.why)}.</div>
      <div class="db">${esc(b.rule)}</div>
      <div class="df">📋 Попытка записана в аудит-след · ${esc(nowHM())} · verdict: deny</div>`;
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    const a = el('button','k2-tag act','Открыть аудит →'); a.style.marginTop='10px';
    a.onclick = ()=> goView('audit'); box.appendChild(a);
    // ЛИНЗА ВИДИМОСТИ: если кнопка-провокация была у нижней кромки, панель отказа рендерилась ЗА экраном —
    // 0 видимых пикселей. Продукт зовёт «нажмите и убедитесь», а в ответ тишина = «кнопка не работает».
    // Скроллим здесь, чтобы работало на ОБОИХ путях (кнопки и текст задачи).
    // behavior:'smooth' крутится через rAF — а он не тикает в фоновой вкладке (та же грабля, что была
    // с онбордингом). Скроллим мгновенно и вручную: надёжно везде.
    const st = $('#stage');
    if (st){
      const br = box.getBoundingClientRect(), sr = st.getBoundingClientRect();
      const delta = (br.top - sr.top) - (st.clientHeight/2 - br.height/2);
      st.scrollTop = Math.max(0, st.scrollTop + delta);
    } else { try{ box.scrollIntoView({block:'center'}); }catch(e){} }
  }

  /* ---- ЦС: память + журнал + расписание + постановка задачи (§4.2,§7.1,§7.2) ---- */
  function renderCS(w){
    const cs = myStaff().find(x=>x.id===cockpit.csId); if(!cs){ goView('pulse'); return; }
    const st = csState(cs);
    w.innerHTML = `<button class="k2-back" id="csBack">← к Пульсу</button>`;
    const ji=cs.ji||{}; const duties=(ji.duties||[]).slice(0,3).map(d=>`<li>${esc(d)}</li>`).join('');
    const card = el('div','k2-agent');
    card.innerHTML = `<div class="ah"><div class="e">${cs.e}</div><div><b>${esc(cs.t)}</b><small>${cs.busy?'⏳ ':''}${esc(cs.now)} · вы — его РЦС</small></div></div>
      ${ji.mission?`<div class="mission">${esc(ji.mission)}</div>`:`<div class="mission">${B('Ставьте задачу словами — вернёт на приёмку.','Цифровой сотрудник вашего штата. Ставьте задачу словами — сделает сам, вернёт на приёмку.')}</div>`}
      ${duties?`<ul>${duties}</ul>`:''}`;
    w.appendChild(card);
    // Этапы текущей задачи (§7.2)
    if (cs.busy){ const lf=section('Этап текущей задачи',''); lf.appendChild(taskLifecycle(cs.stageIdx!=null?cs.stageIdx:2)); w.appendChild(lf); }
    // Память — что знает (§4.2). Показываем, только если человек этого хотел (ответ «что хочу видеть»)
    if (wants('mem')){
      const mem=section('Что знает · память','');
      const mp=el('div','k2-panel'); csMemory(cs).forEach(f=> mp.appendChild(rowEl('🧠', f, '', null))); mem.appendChild(mp); w.appendChild(mem);
    }
    // Расписание — регулярные/отложенные (§7.1)
    const sch=section('Регулярные и отложенные задачи', `${st.schedule.length}`);
    const spn=el('div','k2-panel'); if(!st.schedule.length) spn.appendChild(emptyEl('регулярных задач нет'));
    st.schedule.forEach(s=> spn.appendChild(rowEl(s.kind==='regular'?'🔁':'⏱', s.text, (s.kind==='regular'?'регулярно · ':'отложено · ')+s.when, null)));
    sch.appendChild(spn); w.appendChild(sch);
    // Хотел видеть след в аудите — даём прямой вход из карточки ЦС (иначе want 'audit' был бы мёртвым)
    if (wants('audit')){
      const ab=el('div','k2-panel'); ab.style.cursor='pointer';
      ab.innerHTML=`<div class="k2-item"><div class="e">📋</div><div style="flex:1"><div class="b">След в аудите${auditLog.length?` · ${auditLog.length}`:''}</div>
        <div class="m">${B('решения и отказы','каждое решение, возврат и отказ по границе — со следом')}</div></div><div class="k2-tag act">Открыть →</div></div>`;
      ab.onclick=()=>goView('audit'); w.appendChild(ab);
    }
    // Журнал — из чего собран ответ (провенанс, §4.2). Тоже по ответу «что хочу видеть»
    if (wants('prov')){
      const jr=section('Журнал · из чего собран ответ','');
      const jp=el('div','k2-panel'); st.journal.slice(0,5).forEach(e=>{ const it=el('div','k2-item');
        it.innerHTML=`<div class="e">📓</div><div><div class="b">${esc(e.text)}</div><div class="m">на основе: ${esc((e.prov||[]).join(' · '))}</div></div>`; jp.appendChild(it); });
      jr.appendChild(jp); w.appendChild(jr);
    }
    // Поставить задачу с типом (§7.1: разовая/отложенная/регулярная)
    const p=el('div','k2-panel'); p.innerHTML='<h3>Поставить задачу</h3>';
    const ta=el('textarea','k2-ta'); ta.placeholder=`Напр.: ${cs.now}…`; ta.style.minHeight='80px'; p.appendChild(ta);
    let kind='now';
    const kb=el('div'); kb.style.margin='10px 0';
    [['now','▶ Сейчас'],['deferred','⏱ Отложить · завтра 09:00'],['regular','🔁 Регулярно · ежедневно']].forEach(([k,l],i)=>{
      const c=el('span','k2-chip'+(i===0?' on':''),l); c.onclick=()=>{ kind=k; [...kb.children].forEach(x=>x.classList.remove('on')); c.classList.add('on'); }; kb.appendChild(c); });
    p.appendChild(kb);
    const go=el('button','k2-btn','Поручить ▶'); p.appendChild(go); w.appendChild(p);
    // ---- Границы полномочий: не памятка, а исполняемый код (§ДИ, допуски A/P/B) ----
    const gb = section('Границы полномочий · что он НЕ сделает', accessLetter());
    const gp = el('div','k2-panel');
    gp.innerHTML = `<div class="k2-empty">${B(
      `Допуск <b>${accessLetter()}</b> — ${accessLabel()}. Нажмите: откажет до выполнения, попытка в аудит.`,
      `Допуск роли — <b>${accessLetter()}</b> (${accessLabel()}). Проверьте сами: нажмите — и он откажет <b>до выполнения</b>, а попытка ляжет в аудит.`)}</div>`;
    const gr = el('div'); gr.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    BOUNDARIES.forEach(b=>{
      if (b.needs && profile.level >= b.needs) return;         // тем, кому можно, провокацию не показываем
      const btn = el('button','k2-tag act', b.label);
      btn.onclick = ()=> denyAction(cs, b, gp);
      gr.appendChild(btn);
    });
    gp.appendChild(gr); gb.appendChild(gp); w.appendChild(gb);
    $('#csBack',w).onclick=()=>goView('pulse');
    go.onclick=()=>{ const t=ta.value.trim(); if(!t){ta.focus();return;} if(go.disabled)return;
      // РОЙ №2: журнал клялся «проверка допустимости (ИБ/комплаенс): пройдена», а проверки не было ВООБЩЕ —
      // и это на том же экране, где блок «Границы полномочий». Теперь проверка настоящая: то же правило,
      // что и в BOUNDARIES, применяется к тексту задачи ДО выполнения.
      const bad = admissibility(t);
      if(bad){ denyAction(cs, bad, gp); return; }   // скролл теперь внутри denyAction — работает на обоих путях
      if(kind==='now'){ go.disabled=true; go.textContent='ставлю…'; if(!cs._idle) cs._idle=cs.now; cs.busy=true; cs.now='выполняет: '+t; cs.stageIdx=2;
        bump('tasks'); k2Audit('Задача поставлена ЦС', `${cs.t}: ${t}`, 'ok');
        st.journal.unshift({text:'Взял задачу: '+t, prov:['поставлено РЦС · '+nowHM(),`проверка допустимости: пройдена (допуск ${accessLetter()}, границы ДИ)`,'контекст роли']});
        setTimeout(()=>{ if(!k2Live) return;   // гард: пользователь мог «пересобрать» за эти 650мс
          k2Live.drafts.unshift({id:'drt'+(apSeq++), text:'Черновик: '+t, dept:cs.dep, who:cs.t, csId:cs.id});
          cabToast(`✓ ${cs.t} взял задачу — черновик придёт на приёмку`); goView('pulse'); }, 650);
      } else {
        const when = kind==='regular'?'ежедневно 09:00':'завтра 09:00';
        st.schedule.unshift({kind, text:t, when});
        bump('tasks'); k2Audit(kind==='regular'?'Регулярная задача поставлена ЦС':'Отложенная задача поставлена ЦС', `${cs.t}: ${t} · ${when}`, 'ok');   // РОЙ: логировалась только ветка «Сейчас»
        st.journal.unshift({text:(kind==='regular'?'Поставлено регулярно: ':'Отложено: ')+t, prov:['расписание · '+when,'помощник запустит сам к утру']});
        cabToast(kind==='regular'?'✓ Регулярная задача — помощник запустит ежедневно к утру':'✓ Отложено на завтра 09:00 — помощник запустит сам');
        renderCockpit();
      }
    };
  }

  /* ---- АУДИТ-ЭКРАН: обещание «аудит-след: онлайн» с веществом + метрики пилота ---- */
  function renderAudit(w){
    w.innerHTML = `<button class="k2-back" id="auBack">← к Пульсу</button>` +
      head('Аудит-след', B('приёмки, возвраты, санкции, отказы. Неизменяем.', 'каждая приёмка, возврат, санкция и отказ по границе — здесь. След неизменяем.'));
    // Метрики пилота: то, что мы обещаем мерить с первого дня
    const m = initMetrics();
    // РОЙ: метрика «без правок» была структурно всегда 100% (edited никто не передавал, править черновик негде) —
    // это враньё в цифре. Меряем то, что реально наблюдаем: доля принятых с первого раза vs возвращённых.
    const seen = m.accepted + m.rejected;
    const firstPass = seen ? Math.round(m.accepted/seen*100) : 0;
    const ms = section('Метрики пилота · с первого дня','');
    const mp = el('div','k2-kpi');
    mp.innerHTML = `
      <span>приёмок <b>${m.accepted}</b></span>
      <span>принято с первого раза <b>${firstPass}%</b></span>
      <span>возвратов <b>${m.rejected}</b></span>
      <span>отказов по границе <b>${m.denied}</b></span>
      <span>задач роздано <b>${m.tasks}</b></span>
      <span>нанято ЦС <b>${m.hired}</b></span>`;
    ms.appendChild(mp); w.appendChild(ms);
    // Сам след
    const s = section('След действий', `${auditLog.length}`);
    const p = el('div','k2-panel');
    if(!auditLog.length) p.appendChild(emptyEl('След пуст — примите черновик, верните задачу или проверьте границу полномочий в карточке ЦС, и запись появится здесь.'));
    auditLog.forEach(e=>{
      const it = el('div','k2-item');
      const ic = e.verdict==='deny'?'⛔':(e.verdict==='warn'?'↩':'✓');
      const col = e.verdict==='deny'?'var(--k-red,#e86a5e)':(e.verdict==='warn'?'var(--k-amber,#e8b448)':'var(--k-gold)');
      it.innerHTML = `<div class="e" style="color:${col}">${ic}</div><div style="flex:1">
        <div class="b">${esc(e.act)}</div>
        <div class="m">${e.detail?esc(e.detail)+' · ':''}${esc(e.who)} · ${esc(e.hm)} · verdict: ${esc(e.verdict)}</div></div>`;
      p.appendChild(it);
    });
    s.appendChild(p); w.appendChild(s);
    $('#auBack',w).onclick=()=>goView('pulse');
  }

  /* ---- Конструктор: чего не хватает + подъём в дефолт (§7, §4.3) ---- */
  function renderConstructorView(w){
    w.innerHTML = `<button class="k2-back" id="ctorBack">← к Пульсу</button>` +
      head('Чего вам не хватает?', 'дефолт роли — гипотеза Среды. Реальность правит её здесь.');
    // 1. self-service: нанять из библиотеки (§7.1)
    const cat = section('Добавить в штат из библиотеки', '');
    const pool = Object.keys(SYNTH_STAFF).filter(d=>d!==profile.domain).slice(0,3)
      .flatMap(d=> SYNTH_STAFF[d].slice(0,1).map(s=>({...s,d})))
      .filter(s=> !myStaff().some(cs=>cs.t===s.t));   // не предлагать уже нанятых
    if(!pool.length) cat.appendChild(emptyEl('вы уже добрали доступное из библиотеки'));
    pool.forEach(s=>{ const it=el('div','k2-item');
      it.innerHTML=`<div class="e">${s.e}</div><div style="flex:1"><div class="b">${esc(s.t)}</div><div class="m">${esc(DOMAINS[s.d].label)}</div></div><div><button class="k2-tag act ok">+ нанять</button></div>`;
      it.querySelector('.ok').onclick=()=> animateOut(it, ()=>{
        if(myStaff().some(cs=>cs.t===s.t)){ cabToast('Такой ЦС уже в штате'); return; }
        myStaff().push({id:'csx'+(apSeq++), e:s.e, t:s.t, now:'адаптация…', busy:false, dep:DOMAIN_DEPT[s.d]||s.d});
        myAdditions.push({ t:s.t, stage:0 });   // РОЙ: убран demand — число «спроса» бралось из ДЛИНЫ НАЗВАНИЯ и выдавалось за телеметрию
        bump('hired'); k2Audit('Нанят цифровой сотрудник', s.t, 'ok');
        cabToast('✓ '+s.t+' добавлен в ваш штат'); renderStaffRail(); renderCockpit(); });
      cat.appendChild(it); });
    w.appendChild(cat);
    // 2. подъём в дефолт роли: личное → отдел → компания (§4.3, §7.3 сетевой эффект)
    if (myAdditions.length){
      const up = section('Ваши изменения · подъём в дефолт роли', '');
      myAdditions.forEach((a,idx)=>{
        const it=el('div','k2-item');
        const atCompany = a.stage>=2;
        it.innerHTML=`<div class="e">🧬</div><div style="flex:1"><div class="b">${esc(a.t)}</div>
          <div class="m">уровень: <b style="color:var(--k-gold)">${esc(STAGES[a.stage])}</b>${a.stage<2?' · подъём сделает эту доработку дефолтом для следующей роли':' · стал дефолтом роли'}</div></div>
          <div>${atCompany?'<span class="k2-tag">в дефолте роли ✓</span>':'<button class="k2-tag act ok">поднять выше</button>'}</div>`;
        if(!atCompany){ it.querySelector('.ok').onclick=()=>{
          // §7.2/§4.3: подъём в дефолт роли/компании — только с санкцией владельца контекста
          if(a.stage===0 && profile.level<3){ cabToast('Подъём в дефолт отдела — санкция руководителя/владельца отдела'); return; }
          if(a.stage===1 && !canCompany()){
            bump('denied'); k2Audit('Отказ по допуску', 'Подъём в дефолт компании: '+a.t+' · допуск '+accessLetter(), 'deny'); persist();
            cabToast('⛔ Подъём в дефолт компании = новый дефолт роли для всех — санкция Оркестратора. Попытка в аудите'); return; }
          a.stage++;
          k2Audit('Подъём в дефолт: '+STAGES[a.stage], a.t+' · санкция РЦС', 'ok');   // РОЙ: самое необратимое действие шло без следа
          cabToast(`✓ «${a.t}» поднят до «${STAGES[a.stage]}» с провенансом — ${a.stage>=2?'стал дефолтом роли для всех компаний СРЕДЫ':'виден всему отделу'}`); renderCockpit();
        }; }
        up.appendChild(it);
      });
      const note=el('div','k2-empty'); note.style.marginTop='4px';
      note.textContent='Каждый подъём — топливо для библиотеки ролей: доработка одной роли улучшает дефолт для следующей компании (§7.3).';
      up.appendChild(note); w.appendChild(up);
    }
    // 3. эскалация: нет в системе → админ-ЦС провижинит (§7.1)
    const esc2=section('Нет нужного в библиотеке?','');
    const p=el('div','k2-panel');
    p.innerHTML=`<div class="k2-empty">Опишите, какого ЦС, навыка или инструмента не хватает — уйдёт эскалацией на ЦС администратора платформы. Он провижинит (MCP-инструмент / навык / «найм») со статусом.</div>`;
    const ta=el('textarea','k2-ta'); ta.placeholder='Напр.: нужен ЦС для работы с 1С…'; ta.style.minHeight='70px'; p.appendChild(ta);
    const b=el('button','k2-btn','Эскалировать админ-ЦС ▶'); b.style.marginTop='8px'; p.appendChild(b);
    // РОЙ: тост обещал «соберёт и вернёт со статусом», но не создавалось ни объекта, ни записи — статус не вернулся бы никогда.
    // Теперь эскалация — реальная точка участия в очереди + след в аудите.
    b.onclick=()=>{ const t=ta.value.trim();
      if(!t){ ta.focus(); cabToast('Опишите, чего не хватает — тогда эскалирую'); return; }
      addApproval({ task:'Эскалация админ-ЦС: '+t, dept:profile.domain, cost:'—', risk:'low' });
      k2Audit('Эскалация админ-ЦС', t, 'ok');
      cabToast('✓ Эскалация ушла — появилась в «Ждёт меня» со статусом'); ta.value=''; renderCockpit(); };
    esc2.appendChild(p); w.appendChild(esc2);
    $('#ctorBack',w).onclick=()=>goView('pulse');
  }
  function head(title, sub){ return `<div class="k2-head"><h1>${esc(title)}</h1><span class="sub">${esc(sub||'')}</span></div>`; }

  /* ---- личный помощник = движок Пульса, сквозной (§5) ---- */
  function plural(n, one, few, many){ const a=n%10, b=n%100; if(a===1&&b!==11)return one; if(a>=2&&a<=4&&(b<10||b>=20))return few; return many; }
  function assistantObsC(){
    if (cockpit.view==='cs'){ const cs=myStaff().find(x=>x.id===cockpit.csId);
      return cs?B(`«${cs.t}» — поставить задачу?`, `Вы смотрите на «${cs.t}». Поставить ему задачу или посмотреть очередь?`):''; }
    if (cockpit.view==='audit') return B('След действий.', 'Аудит: каждое решение и каждый отказ оставили след.');
    if (cockpit.view==='constructor') return B('Чего не хватает?', 'Скажите, чего не хватает — добавлю из библиотеки или эскалирую админ-ЦС.');
    if (cockpit.height==='dept') return B('Отдел: штат и передачи.', 'Высота отдела: вижу штат и передачи. Показать, у кого затык?');
    if (cockpit.height==='company') return B('Компания: обзор.', 'Высота компании: обзор всей организации.');
    return userFocus().length
      ? B(`День собран. Приоритет: ${userFocus().join(', ')}.`,
          `${T('Собрал твой','Собрал ваш')} день к утру. Знаю, что больше всего у ${T('тебя','вас')} уходит на ${userFocus().join(' и ')} — держу это в приоритете.`)
      : B('День собран. Начните с подсвеченного.',
          `${T('Собрал твой','Собрал ваш')} день к утру. ${T('Начни','Начните')} с того, что подсвечено — остальное ЦС держат сами.`);
  }
  function askAssistant(text){
    const t=String(text).toLowerCase();
    if(/пульс|день/.test(t)){ goView('pulse'); return; }
    if(/аудит|след|журнал/.test(t)){ goView('audit'); return; }
    if(/отдел/.test(t)){ cockpit.height='dept'; cockpit.view='pulse'; renderStaffRail(); renderCockpit(); return; }
    if(/компан/.test(t)){ if(canCompany()){ cockpit.height='company'; cockpit.view='pulse'; renderStaffRail(); renderCockpit(); } else cabToast('Высота «Компания» — только Оркестратору'); return; }
    if(/не хват|добав|штат|конструкт|найм|нанять/.test(t)){ goView('constructor'); return; }
    const cs = myStaff().find(x=> t.includes(x.t.toLowerCase().split(' ')[0]));
    if(cs){ goView('cs', cs.id); return; }
    // ЧЕСТНО: не делаем вид, что поняли. Врать «принял» хуже, чем назвать рамку.
    const out=$('#k2AsstOut');
    if(out){
      out.innerHTML = `<div>${B('<b>Не понял.</b> Свободный ввод — на пилоте, с моделью. Команды:',
        `<b>Не понял — и не буду делать вид.</b> Свободные формулировки я начну разбирать, когда подключат модель (на пилоте). Пока веду по командам:`)}</div>`;
      const chips = el('div'); chips.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:8px';
      [['мой день',()=>goView('pulse')],['аудит',()=>goView('audit')],['штат отдела',()=>{cockpit.height='dept';cockpit.view='pulse';renderStaffRail();renderCockpit();}],
       ['чего не хватает',()=>goView('constructor')]].forEach(([l,a])=>{
        const c=el('button','k2-chip',l); c.onclick=a; chips.appendChild(c); });
      const s0=myStaff()[0];
      if(s0){ const c=el('button','k2-chip','имя ЦС: «'+s0.t.split(' ')[0]+'»'); c.onclick=()=>goView('cs',s0.id); chips.appendChild(c); }
      out.appendChild(chips);
    }
  }
  function renderAssistant(box){
    const staff=myStaff();
    const waits=participationPoints().length;
    const rem=[];
    if(waits) rem.push({icon:'🔴', text:`${waits} ${plural(waits,'точка','точки','точек')} ждут ${T('тебя','вас')}`, act:()=>goView('pulse')});
    const busy=staff.filter(c=>c.busy).length;
    if(busy) rem.push({icon:'⏳', text:`${busy} ${plural(busy,'ЦС выполняет','ЦС выполняют','ЦС выполняют')} ${T('твою','вашу')} задачу`, act:()=>goView('pulse')});
    if(!rem.length) rem.push({icon:'✓', text:`От ${T('тебя','вас')} сейчас ничего не ждут — день под контролем.`, act:()=>goView('pulse')});
    // habit → плотность подсказок: не пользовался ИИ → режим «за руку»
    const guided = profile.habit==='none';
    // подстройка под привычный инструмент + реальный тон
    const tools = userTools();
    const habitNote = tools.length ? `подстроен под ${tools.join(' и ')}` : (guided ? T('веду за руку','проведу за руку') : T('вижу, на что ты смотришь','вижу, на что вы смотрите'));
    const inHint = profile.habit==='chat' ? `${T('Спроси','Спросите')} словами — как в ${tools[0]?(TOOL_IN[tools[0]]||tools[0]):'чате'}` : (guided ? T('Напиши, что нужно — я подскажу','Напишите, что нужно — я подскажу') : T('Поручи помощнику…','Поручите помощнику…'));
    // пустой/типовой штат ИЛИ новичок в ИИ → развилка «с чего начать»
    const synth = isSynthStaff();
    const startBlock = (synth || guided) ? `
      <div class="k2-start">
        <div class="st-h">С чего начать</div>
        <div class="k2-start-btns">
          <button class="k2-start-btn" id="stTask"><span class="si">⚡</span><span><span class="sl">${T('Поставь задачу словами','Поставить задачу словами')}</span>${B('',`<span class="ss">${T('опиши','опишите')} — рой разберёт и раздаст ЦС</span>`)}</span></button>
          <button class="k2-start-btn" id="stStaff"><span class="si">🧩</span><span><span class="sl">${T('Собери штат под себя','Собрать штат под себя')}</span>${B('','<span class="ss">нанять цифровых сотрудников из библиотеки</span>')}</span></button>
        </div>
      </div>` : '';
    box.innerHTML = `
      <div class="k2-asst-h"><div class="av">🗓️</div>
        <div><b>Личный помощник</b><small>${B('', `ядро ${T('твоего','вашего')} дня · `)}${esc(habitNote)}</small></div></div>
      <div class="k2-asst-ctx">${esc(assistantObsC())}</div>
      ${startBlock}
      <div class="k2-asst-sec">${T('Ждёт тебя','Ждёт вас')}</div>
      <div id="asstRems"></div>
      <div class="k2-asst-sec">Могу прямо сейчас</div>
      <div class="k2-asst-chips" id="asstChips"></div>
      <div class="k2-asst-input"><input id="k2AsstIn" placeholder="${esc(inHint)}" aria-label="Поручить помощнику"/><button id="k2AsstGo" aria-label="Отправить">→</button></div>
      <div class="k2-asst-out" id="k2AsstOut"></div>`;
    const remBox=$('#asstRems',box);
    rem.forEach(r=>{ const b=el('button','k2-asst-rem',`<span>${r.icon}</span><span>${esc(r.text)}</span>`); b.onclick=r.act; remBox.appendChild(b); });
    const chips=[{l:'Мой день',a:()=>goView('pulse')},{l:'Штат отдела',a:()=>{cockpit.height='dept';cockpit.view='pulse';renderStaffRail();renderCockpit();}},{l:'Чего не хватает',a:()=>goView('constructor')}];
    if(staff[0]){ const taskChip={l:`${T('Поставь','Поставить')} задачу `+staff[0].t.split(' ')[0].toLowerCase(),a:()=>goView('cs',staff[0].id)};
      // предпочтение «поручать» → действие постановки задачи выходит вперёд
      if(userPosture().includes('delegate')) chips.unshift(taskChip); else chips.splice(1,0,taskChip); }
    const chipBox=$('#asstChips',box);
    chips.slice(0, guided?2:4).forEach(c=>{ const b=el('button','k2-chip',esc(c.l)); b.onclick=c.a; chipBox.appendChild(b); });
    const inp=$('#k2AsstIn',box), gob=$('#k2AsstGo',box);
    const submit=()=>{ const v=inp.value.trim(); if(v) askAssistant(v); };
    if(gob) gob.onclick=submit; if(inp) inp.onkeydown=(e)=>{ if(e.key==='Enter') submit(); };
    // развилка «с чего начать» (пустой/типовой штат)
    const stT=$('#stTask',box); if(stT) stT.onclick=()=>{ const i=$('#k2AsstIn',box); if(i){ i.focus(); i.scrollIntoView({block:'center'}); } };
    const stS=$('#stStaff',box); if(stS) stS.onclick=()=>goView('constructor');
  }

  /* ================================================================ РЕНДЕР  */
  const feed = () => (ORG.pulseFeed || []);
  const deptLabel = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.label:(DOMAINS[id]?DOMAINS[id].label:(id||'')); };
  const deptIcon  = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.icon:(DOMAINS[id]?DOMAINS[id].icon:'•'); };

  /* ---- АУДИТ: единый след. Строка «аудит-след: онлайн» теперь с веществом ----
     Каждая приёмка, возврат, санкция, отказ по границе, найм и подъём — сюда. */
  let auditLog = [];
  let metrics = null;
  const M0 = () => ({ accepted:0, clean:0, rejected:0, denied:0, tasks:0, hired:0 });
  function initMetrics(){ if(!metrics) metrics = M0(); return metrics; }
  function k2Audit(act, detail, verdict){
    const d = new Date();
    auditLog.unshift({
      hm: String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),
      act, detail: detail||'', verdict: verdict||'ok', who: (profile && profile.roleTitle) || '',
    });
    if (auditLog.length > 200) auditLog.length = 200;   // след не растёт бесконечно
  }
  // Метрики пилота: обещаем заказчику мерить с первого дня — значит считаем с первого клика
  function bump(k, n){ initMetrics(); metrics[k] = (metrics[k]||0) + (n||1); }

  /* --- сквозное живое состояние: очередь решений и черновиков ------------- */
  /* модули РЕАЛЬНО меняют его (одобрил → ушло), ассистент видит те же числа.  */
  let k2Live = null;
  function initLive(){
    if (k2Live) return;
    k2Live = {
      approvals: (DASH.approvals||[]).map((a,i)=>({ id:'ap'+i, task:a.task, dept:a.dept, cost:a.cost, risk:a.risk })),
      drafts:    feed().filter(f=>f[0]==='d').map((f,i)=>({ id:'dr'+i, text:f[2], dept:f[3], who:f[1] })),
      clarify:   [{ id:'cl0', text:'ЦС спрашивает: '+dcontent().clarify, who:'цифровой сотрудник ждёт вашего слова' }],
      coord:     [{ id:'co0', text:dcontent().coord, who:'согласование как РЦС — привлечение вашего цифрового сотрудника' }],
    };
    // У доменов без своего отдела в оргструктуре лента пуста — специалисту нечего принимать,
    // и уровни 1 и 2 сходятся в один экран. Достраиваем из ДОМЕННОГО контента: это те же
    // параметры модели, а не текст, написанный под конкретную роль.
    const myDep = DOMAIN_DEPT[profile.domain] || profile.domain;
    if (!k2Live.drafts.some(d => d.dept===myDep || deptLabel(d.dept)===deptLabel(myDep))){
      const dc = dcontent();
      k2Live.drafts.unshift(
        { id:'drd0', text:dc.cand.draft, dept:myDep, who:'коллега по направлению' },
        { id:'drd1', text:'Черновик: '+dc.cand.task, dept:myDep, who:'коллега по направлению' }
      );
    }
  }
  function liveApprovals(){ initLive(); return k2Live.approvals; }
  function liveDrafts(){ initLive(); return k2Live.drafts; }
  function resolveApproval(id, ok){ initLive(); const a=(k2Live.approvals||[]).find(x=>x.id===id);
    k2Live.approvals = k2Live.approvals.filter(x=>x.id!==id);
    k2Audit(ok?'Санкция выдана':'Санкция отклонена', (a&&a.task)||'', ok?'ok':'deny');
    cabToast(ok?'✓ Одобрено — отправлено в работу':'✗ Отклонено — вернул на доработку'); refreshLive(); }
  function freeCs(csId){ const cs=(myStaffCache||[]).find(c=>c.id===csId); if(cs){ cs.busy=false; cs.stageIdx=3; cs.now=cs._idle||'на связи'; } }   // §7.2: приёмка завершает цикл — ЦС освобождается
  function acceptDraft(id){ initLive(); const d=(k2Live.drafts||[]).find(x=>x.id===id);
    k2Live.drafts = k2Live.drafts.filter(x=>x.id!==id); if(d&&d.csId) freeCs(d.csId);
    bump('accepted');
    k2Audit('Приёмка: принято', (d&&d.text)||'', 'ok');
    cabToast('✓ Принято'); refreshLive(); }
  function rejectDraft(id){ initLive(); const d=(k2Live.drafts||[]).find(x=>x.id===id);
    k2Live.drafts = k2Live.drafts.filter(x=>x.id!==id);
    bump('rejected'); k2Audit('Приёмка: возвращено на доработку', (d&&d.text)||'', 'warn');
    // РОЙ №2: доработки НЕ СУЩЕСТВОВАЛО — ЦС уходил в «дорабатывает» навсегда, черновик не возвращался,
    // помощник вечно рапортовал «1 ЦС выполняет задачу», цикл приёмки был оборван. Замыкаем цикл по-настоящему.
    const base = String((d&&d.text)||'').replace(/^Черновик(\s*\(v\d+\))?:\s*/,'');
    if(d&&d.csId){
      const cs=(myStaffCache||[]).find(c=>c.id===d.csId);
      if(cs){ cs.busy=true; cs.stageIdx=2; cs.now='дорабатывает: '+base;
        const v=(d.v||1)+1;
        setTimeout(()=>{ if(!k2Live) return;   // гард: «пересобрать» за эти 900мс
          k2Live.drafts.unshift({ id:'drt'+(apSeq++), text:`Черновик (v${v}): `+base, dept:cs.dep, who:cs.t, csId:cs.id, v });
          csState(cs).journal.unshift({ text:`Доработал по возврату (v${v}): `+base, prov:['возврат РЦС · '+nowHM(),'учтено замечание','контекст роли'] });
          cs.stageIdx=3; cs.now='ждёт приёмки: '+base;   // сдал — больше не «дорабатывает» (иначе строка врёт)
          cabToast(`↩ ${cs.t} доработал — черновик v${v} на приёмке`); refreshLive();
        }, 900);
      }
      cabToast('↩ Возвращено на доработку — ЦС переделывает'); refreshLive(); return;
    }
    // черновик без исполнителя дорабатывать некому — не врём про доработку
    cabToast('↩ Снято с приёмки'); refreshLive(); }
  let apSeq = 0;
  function addApproval(obj){ initLive(); k2Live.approvals.unshift(Object.assign({ id:'apn'+(apSeq++) }, obj)); }
  function refreshLive(){ renderStaffRail(); renderCockpit(); }   // рейл штата (занятость ЦС) + кокпит + помощник

  let cabToastTimer=null;
  function cabToast(msg){
    let t = $('#k2CabToast');
    if(!t){ t = el('div','k2-cabtoast'); t.id='k2CabToast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(cabToastTimer); cabToastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
  }

  /* --- доменные модули: общий рендер спеки (интерактивный) ---------------- */
  /* item = [emoji, title, meta] или [emoji, title, meta, actionLabel].       */
  /* спеки помечаются как «сделанные» в session-множестве — не воскресают.     */
  const specDone = {};
  function renderSpec(w, spec){
    w.innerHTML = head(spec.title, spec.sub||'');
    const p = el('div','k2-panel');
    const doneKey = spec.title;
    const done = specDone[doneKey] || (specDone[doneKey] = new Set());
    let shown = 0;
    (spec.items||[]).forEach((it, idx)=>{
      if (done.has(idx)) return;
      shown++;
      const [emoji, title, meta] = it;
      // действие: явное (4-й элемент) или авто по маркерам в мете
      let act = it[3];
      if (!act && meta){
        if (/ждут|нужно решение|на грани|на одобрен/i.test(meta)) act='решить';
        else if (/на проверку|на вашу|на подтвержд|ждёт|на согласован|на выкатку|на отправку/i.test(meta)) act='принять';
      }
      const row = el('div','k2-item');
      row.innerHTML = `<div class="e">${emoji}</div><div style="flex:1"><div class="b">${esc(title)}</div>
        ${meta?`<div class="m">${esc(meta)}</div>`:''}${(spec.who && profile.depth)?`<div class="k2-who">подготовил: ${esc(spec.who)}</div>`:''}</div>
        ${act?`<div><button class="k2-tag act ok">${esc(act)}</button></div>`:''}`;
      if (act){ row.querySelector('.ok').onclick = ()=> animateOut(row, ()=>{ done.add(idx); cabToast('✓ '+act[0].toUpperCase()+act.slice(1)+' — готово'); renderActive(); }); }
      p.appendChild(row);
    });
    if (!shown) p.innerHTML = `<div class="k2-empty">✓ Всё разобрано в этом блоке.</div>`;
    w.appendChild(p);
  }

  /* --- Флагман-showcase: живая Воронка и КП (домен sales) ----------------- */
  function renderFunnel(w){
    w.innerHTML = head('Воронка и КП', 'соберите КП цифровым сотрудником → отправьте на решение → одобрите');
    const deals = [
      { c:'Банк «Гамма»',      s:'на КП',      hot:true },
      { c:'ПАО «Дельта»',      s:'переговоры', hot:true },
      { c:'ООО «Ориент»',      s:'квалификация', hot:false },
    ];
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='1.2fr .8fr';
    const p1 = el('div','k2-panel'); p1.innerHTML='<h3>Ваши сделки</h3>';
    deals.forEach(d=>{
      const it = el('div','k2-item');
      it.innerHTML = `<div class="e">${d.hot?'🔥':'•'}</div><div style="flex:1"><div class="b">${esc(d.c)}</div><div class="m">этап: ${esc(d.s)}</div></div>
        <div><button class="k2-tag act ok">собрать КП</button></div>`;
      const btn = it.querySelector('.ok');
      btn.onclick = ()=>{
        if (btn.disabled) return; btn.disabled = true; btn.textContent = 'сборка…';
        setTimeout(()=>{
          addApproval({ task:`Отправка КП: ${d.c}`, dept:'Продажи', cost:'₽12 / задача', risk:'low' });
          cabToast(`✓ КП для «${d.c}» собрано за 10 мин → ушло на ваше решение`);
          renderActive();
        }, 550);
      };
      p1.appendChild(it);
    });
    const p2 = el('div','k2-panel'); p2.innerHTML=`<h3>На вашем решении · ${liveApprovals().length}</h3>`;
    const mine = liveApprovals();
    if(!mine.length) p2.innerHTML += `<div class="k2-empty">соберите КП — оно появится здесь на одобрение</div>`;
    mine.slice(0,5).forEach(a=>{
      const it = el('div','k2-item'); it.dataset.id=a.id;
      it.innerHTML = `<div class="e">🔐</div><div style="flex:1"><div class="b">${esc(a.task)}</div><div class="m">${esc(a.dept)} · ${esc(a.cost)}</div></div>
        <div><button class="k2-tag act ok">одобрить</button></div>`;
      it.querySelector('.ok').onclick = ()=> animateOut(it, ()=> resolveApproval(a.id, true));
      p2.appendChild(it);
    });
    grid.appendChild(p1); grid.appendChild(p2); w.appendChild(grid);
  }

  /* --- Мой день (живой: числа те же, что у ассистента; под уровень) --- */
  function renderToday(w){
    const drafts = liveDrafts();
    w.innerHTML = head('Мой день', 'что ждёт именно вас — не вся компания, а ваш стол');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='1fr 1fr';
    // левая панель зависит от сениорити: руководитель решает, исполнитель принимает
    const p1 = el('div','k2-panel');
    if (profile.level>=3){
      const appr = liveApprovals();
      p1.innerHTML=`<h3>Ждёт вашего слова · ${appr.length}</h3>`;
      if(!appr.length) p1.innerHTML += `<div class="k2-empty">всё решено ✓</div>`;
      appr.slice(0,4).forEach(a=>{ const r=rowEl('🔐', a.task, `${a.dept} · ${a.cost}`, null); r.style.cursor='pointer'; r.onclick=()=>goModule('sanctions'); p1.appendChild(r); });
    } else {
      p1.innerHTML=`<h3>Готово к приёмке · ${drafts.length}</h3>`;
      if(!drafts.length) p1.innerHTML += `<div class="k2-empty">всё принято ✓</div>`;
      drafts.slice(0,4).forEach(d=>{ const r=rowEl(deptIcon(d.dept), d.text, deptLabel(d.dept), profile.depth?d.who:null); r.style.cursor='pointer'; r.onclick=()=>goModule('intake'); p1.appendChild(r); });
    }
    // правая панель
    const p2 = el('div','k2-panel');
    if (profile.level>=3){
      p2.innerHTML=`<h3>Черновики от цифровых сотрудников · ${drafts.length}</h3>`;
      if(!drafts.length) p2.innerHTML += `<div class="k2-empty">всё принято ✓</div>`;
      drafts.slice(0,4).forEach(d=>{ const r=rowEl(deptIcon(d.dept), d.text, deptLabel(d.dept), profile.depth?d.who:null); r.style.cursor='pointer'; r.onclick=()=>goModule('intake'); p2.appendChild(r); });
    } else {
      p2.innerHTML=`<h3>Быстрое действие</h3><div class="k2-empty">опишите задачу словами — Среда разберёт её и подберёт исполнителей.</div>`;
      const b = el('button','k2-btn','Поставить задачу ▶'); b.style.marginTop='6px'; b.onclick=()=>goModule('task'); p2.appendChild(b);
    }
    grid.appendChild(p1); grid.appendChild(p2); w.appendChild(grid);
  }
  function rowEl(emoji, title, meta, who){
    const it = el('div','k2-item');
    it.innerHTML = `<div class="e">${emoji}</div><div><div class="b">${esc(title)}</div><div class="m">${esc(meta||'')}</div>${who?`<div class="k2-who">подготовил: ${esc(who)}</div>`:''}</div>`;
    return it;
  }

  /* --- Поставить задачу --- */
  function renderTask(w){
    w.innerHTML = head('Поставить задачу Среде', 'опишите словами — оркестратор разберёт на подзадачи');
    const p = el('div','k2-panel');
    const ta = el('textarea','k2-ta'); ta.placeholder='Напр.: собери материал к четвергу…';
    p.appendChild(ta);
    const ex = el('div'); ex.style.margin='12px 0';
    ['собрать материал к четвергу','подготовить отчёт','проверить и свести данные','сводка за неделю']
      .forEach(t=>{ const c=el('span','k2-chip','◆ '+t); c.onclick=()=>{ta.value=t;}; ex.appendChild(c); });
    p.appendChild(ex);
    const go = el('button','k2-btn','Запустить рой ▶'); const out = el('div'); out.style.marginTop='16px';
    go.onclick = ()=>{ const t=ta.value.trim(); if(!t){ta.focus();return;}
      out.innerHTML = `<div class="k2-panel"><h3>Среда разобрала задачу</h3>
        <div class="k2-item"><div class="e">🧩</div><div><div class="b">${esc(t)}</div><div class="m">оркестратор подобрал цифровых сотрудников под вашу роль</div></div></div>
        <div class="k2-item"><div class="e">🤖</div><div><div class="b">Черновик готовит ваш профильный агент</div><div class="m">~10 мин</div></div></div>
        <div class="k2-item"><div class="e">🔐</div><div><div class="b">Финальный шаг — ждёт вашего «ок»</div><div class="m">санкция · только человек</div></div></div></div>`; };
    p.appendChild(go); p.appendChild(out); w.appendChild(p);
  }

  /* --- Приёмка (живая: принял → ушло) --- */
  function renderIntake(w){
    const q = liveDrafts();
    w.innerHTML = head('Приёмка результатов', 'что готово и держит вашу проверку');
    const p = el('div','k2-panel');
    if (!q.length){
      p.innerHTML = `<div class="k2-empty">✓ Всё принято — черновиков в очереди нет.</div>`;
      w.appendChild(p); return;
    }
    q.forEach(d=>{
      const it = el('div','k2-item'); it.dataset.id=d.id;
      it.innerHTML = `<div class="e">${deptIcon(d.dept)}</div><div style="flex:1"><div class="b">${esc(d.text)}</div>
        <div class="m">${esc(deptLabel(d.dept))}${profile.depth?` · ${esc(d.who)}`:''}</div></div>
        <div><button class="k2-tag act ok">принять</button></div>`;
      it.querySelector('.ok').onclick = ()=> animateOut(it, ()=> acceptDraft(d.id));
      p.appendChild(it);
    });
    w.appendChild(p);
  }

  /* --- Пульс --- */
  function renderPulse(w){
    w.innerHTML = head('Пульс', 'загрузка направлений и живая лента — вижу, где горит');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='1fr 1fr';
    const p1 = el('div','k2-panel'); p1.innerHTML='<h3>Загрузка направлений</h3>';
    (ORG.depts||[]).forEach(d=>{ const v=(ORG.load||{})[d.id]||0; const col=v>82?'#f0794a':v>70?'#e8c468':'#6bbf6b';
      const it=el('div'); it.style.padding='8px 0';
      it.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13.5px"><span>${d.icon} ${esc(d.label)}</span><span style="color:${col}">${v}%</span></div><div class="k2-loadbar"><i style="width:${v}%;background:${col}"></i></div>`;
      p1.appendChild(it); });
    const p2 = el('div','k2-panel'); p2.innerHTML='<h3>Живая лента</h3>';
    feed().slice(0,10).forEach(f=>{ const tag=f[0]==='x'?'🔗':f[0]==='d'?'🤖':'🧑'; p2.appendChild(rowEl(tag, f[2], (f[0]==='x'?f[1]:deptLabel(f[3])), null)); });
    grid.appendChild(p1); grid.appendChild(p2); w.appendChild(grid);
  }

  /* --- Решения и санкции (живые: одобрил → ушло из очереди) --- */
  function renderSanctions(w){
    const q = liveApprovals();
    w.innerHTML = head('Решения и санкции', 'где нужно ваше слово — и кто подготовил материал');
    const p = el('div','k2-panel');
    if (!q.length){
      p.innerHTML = `<div class="k2-empty">✓ Очередь пуста — вы приняли все решения. Новые появятся, как только цифровые сотрудники подготовят материал.</div>`;
      w.appendChild(p); return;
    }
    q.forEach(a=>{ const rc=a.risk==='med'?'#e8c468':a.risk==='high'?'#f0794a':'#6bbf6b';
      const it=el('div','k2-item'); it.dataset.id=a.id;
      it.innerHTML=`<div class="e">🔐</div><div style="flex:1"><div class="b">${esc(a.task)}</div><div class="m">${esc(a.dept)} · ${esc(a.cost)} · <span style="color:${rc}">риск ${esc(a.risk)}</span></div></div>
        <div style="display:flex;gap:6px"><button class="k2-tag act ok">одобрить</button><button class="k2-tag act">отклонить</button></div>`;
      it.querySelector('.ok').onclick = ()=> animateOut(it, ()=> resolveApproval(a.id, true));
      it.querySelectorAll('.act')[1].onclick = ()=> animateOut(it, ()=> resolveApproval(a.id, false));
      p.appendChild(it); });
    w.appendChild(p);
  }
  function animateOut(node, then){ node.classList.add('k2-rowout'); setTimeout(then, 260); }

  /* --- Команда --- */
  function renderTeam(w){
    w.innerHTML = head('Команда и отделы', 'люди и их цифровые двойники — весь штат');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='repeat(auto-fill,minmax(300px,1fr))';
    (ORG.depts||[]).forEach(d=>{ const p=el('div','k2-panel'); const people=(ORG.team&&Array.isArray(ORG.team[d.id])?ORG.team[d.id]:[]);
      const hc=(ORG.hc&&ORG.hc[d.id])||people.length; const dhc=(ORG.dhc&&ORG.dhc[d.id])||0;
      p.innerHTML=`<h3>${d.icon} ${esc(d.label)} <span class="k2-tag">${hc} чел · ${dhc} ЦС</span></h3>`;
      people.slice(0,3).forEach(pe=> p.appendChild(rowEl(pe.emoji||'🧑', `${esc(pe.name)} ${esc(pe.surname)}`, `${esc(pe.role)}${pe.acc?' · '+esc(pe.acc):''}`, null)));
      grid.appendChild(p); });
    w.appendChild(grid);
  }

  /* --- Цифровые сотрудники --- */
  function renderAgents(w){
    w.innerHTML = head('Цифровые сотрудники', 'штат агентов Среды и их должностные инструкции');
    const digital = ORG.digital||{};
    Object.keys(digital).forEach(dep=>{ (Array.isArray(digital[dep])?digital[dep]:[]).slice(0,2).forEach(a=>{ const c=el('div','k2-agent'); const ji=a.ji||{};
      const duties=(ji.duties||[]).slice(0,3).map(d=>`<li>${esc(d)}</li>`).join('');
      const kpi=(ji.kpi||[]).map(k=>`<span>${esc(k[0])} <b>${esc(k[1])}</b></span>`).join('');
      c.innerHTML=`<div class="ah"><div class="e">${a.emoji||'🤖'}</div><div><b>${esc(a.title||a.name)}</b><small>${esc(a.fn||'')} · модель ${esc(a.model||'')} · ${esc(deptLabel(dep))}</small></div></div>
        ${ji.mission?`<div class="mission">${esc(ji.mission)}</div>`:''}${duties?`<ul>${duties}</ul>`:''}${kpi?`<div class="k2-kpi">${kpi}</div>`:''}`;
      w.appendChild(c); }); });
  }

  /* ================================================================ BOOT   */

  /* ================== РОСТ ==================================================
     Человек, который ничего ещё не использовал, не должен получать штат, Пульс
     и помощника. Он получает окно и строку ввода — и всё.
     Задача выполняется базовыми ЦС из библиотеки МОЛЧА: он не знает, что внутри
     работает штат. Понравился результат — только тогда: «это делал такой-то,
     взять его себе?». Каждая следующая поверхность приходит как ответ на то,
     что человек уже сделал.
     Зрелость не спрашивается и не берётся из должности — она И ЕСТЬ этот след. */
  const LS_GROW = 'sreda_kam2_growth_v1';
  let growth = null;
  const G0 = () => ({ tasks:0, accepted:0, returned:0, hired:[], know:[], feed:[] });
  function loadGrowth(){
    try{ growth = JSON.parse(localStorage.getItem(LS_GROW)||'null') || G0(); }catch(e){ growth = G0(); }
    ['hired','know','feed'].forEach(k=>{ if(!Array.isArray(growth[k])) growth[k]=[]; });
    ['tasks','accepted','returned'].forEach(k=>{ if(typeof growth[k]!=='number') growth[k]=0; });
    return growth;
  }
  function saveGrowth(){ try{ localStorage.setItem(LS_GROW, JSON.stringify(growth)); }catch(e){} }

  // что открыто — функция следа
  const hasStaff = () => growth.hired.length >= 1;
  const hasPulse = () => growth.hired.length >= 2 || growth.accepted >= 3;

  // ассистент набирает знания о человеке из его же работы — это и есть душа Среды:
  // сначала он знает про тебя пару фактов, потом может встать вместо тебя.
  function learn(k, v, from){
    if (!v) return;
    const has = growth.know.some(x=>x.k===k && x.v===v);
    if (has) return;
    growth.know.unshift({ k, v, from:from||'из задачи', at:nowHM() });
    growth.know = growth.know.slice(0, 12);
  }

  const TEXT_DOMAIN = {
    finance:['платёж','плат','счёт','счета','сверк','бухгалт','ндс','оплат','выписк','дебитор','баланс','ддс','налог','акт'],
    estimate:['смет','расценк','кс-2','кс-3','нмцк','подряд','объём работ'],
    eng:['код','релиз','баг','деплой','инцидент','сервер','api','тест','архитектур','скрипт'],
    sales:['клиент','сделк','кп','коммерческое','воронк','crm','лид','продаж'],
    marketing:['кампан','креатив','лендинг','реклам','трафик','контент','смм','бренд'],
    ops:['склад','поставк','логист','производств','снабжен','закупк','остатк'],
    hr:['ваканс','кандидат','собеседован','найм','онбординг','адаптац'],
    legal:['договор','юрид','претенз','соглашен','контрагент','нда','риск'],
    project:['проект','этап','веха','срок','статус'],
    analytics:['дашборд','метрик','отчёт','данные','аналитик','выгрузк','sql','витрин'],
    exec:['стратег','okr','совет директоров','правление','цели года'],
    assist:['встреч','календар','протокол','напомн','поездк','бронир'],
  };
  const TEXT_SYS = { '1С':['1с','1c'], 'Excel':['excel','эксель','таблиц'], 'CRM':['crm','срм','битрикс','amo'],
    'почта':['почт','письм','mail'], 'ERP':['erp','sap'], 'BI':['bi','дашборд','power bi'], 'ЭДО':['эдо','диадок'] };

  function guessDomain(text){
    const t=String(text).toLowerCase(); let best=null, bs=0;
    Object.keys(TEXT_DOMAIN).forEach(d=>{ const n=TEXT_DOMAIN[d].filter(k=>t.indexOf(k)>=0).length; if(n>bs){bs=n;best=d;} });
    return bs?best:null;
  }
  function guessSystems(text){
    const t=String(text).toLowerCase();
    return Object.keys(TEXT_SYS).filter(s=>TEXT_SYS[s].some(k=>t.indexOf(k)>=0));
  }
  // текст задачи → каноническая тема боли. Тегами, а не разбором смысла:
  // без LLM честно матчим ключевые слова на те же 10 тем, что уже держит модель.
  const TEXT_THEME = {
    reports:  ['отчёт','отчет','сверк','акт','свод','выгрузк','дашборд','презентац','итог','баланс','смет'],
    approvals:['соглас','виз','утверд','подпис','лимит','разреш','апрув'],
    routine:  ['рутин','копипаст','каждый','регуляр','повторя','ежемесяч','еженедел','ежеднев','раз в'],
    inbox:    ['почт','письм','входящ','звонок','транскрипт','чат','заявк'],
    infoloss: ['контекст','найти','где лежит','память','искать','история'],
    control:  ['контрол','отклонен','план','срок','просроч','бюджет','риск'],
    rush:     ['срочн','горит','сегодня','аврал','вчера'],
    meetings: ['встреч','созвон','совещан','календар','протокол'],
    search:   ['подобрать','найди','поиск','сравн'],
    quality:  ['ошибк','проверить','качеств','перепроверить','дефект'],
  };
  function textThemes(text){
    const t = String(text).toLowerCase();
    return Object.keys(TEXT_THEME).filter(th => TEXT_THEME[th].some(k => t.indexOf(k) >= 0));
  }
  // исполнителя выбирает МОДЕЛЬ: теги библиотеки против того, что человек написал.
  // Ничего не пишется под конкретный запрос — совпадают домен, тема и система.
  function pickCap(text, dom, exclude){
    const t = String(text).toLowerCase();
    const th = textThemes(text);
    let best = null, bs = -1;
    CAP_LIB.forEach(c => {
      if (exclude && exclude.indexOf(c.t) >= 0) return;   // поддержка не бывает ведущим
      let sc = 0;
      const doms = Array.isArray(c.domains) ? c.domains : [];
      const inds = Array.isArray(c.industries) ? c.industries : ['*'];
      // отраслевой ЦС не предлагается человеку не из этой отрасли: на нулевом уровне
      // отрасль ещё неизвестна, и «Агент Меркурия» на платёж — это провал доверия
      if (inds[0] !== '*'){
        const mine = (profile.industry||[]);
        if (!mine.length || !inds.some(x=>mine.indexOf(x)>=0)) return;
      }
      if (dom && doms.indexOf(dom) >= 0) sc += 4;          // профильный исполнитель
      if (doms[0] === '*') sc += 1;                         // универсальный — годится всем, но слабее
      (c.themes || []).forEach(x => { if (th.indexOf(x) >= 0) sc += 3; });
      (c.systems || []).forEach(sy => { if (sy !== '*' && t.indexOf(String(sy).toLowerCase()) >= 0) sc += 2; });
      if (sc > bs) { bs = sc; best = c; }
    });
    return best || CAP_LIB[0];
  }


  function provisionalProfile(){
    return { domain:null, level:2, roleTitle:'', wants:[], depth:0, focus:[], gripe:[], industry:[],
             systems:[], aiTool:[], postureKey:[], tone:'ты', brief:false, chosen:[], provisional:true };
  }
  function chatStyles(){
    if ($('#k2ChatCss')) return;
    const st=document.createElement('style'); st.id='k2ChatCss';
    st.textContent = ".k2-cw{max-width:760px;margin:0 auto;padding:34px 20px 48px;display:flex;flex-direction:column;gap:14px}"
      +".k2-cw h1{font-size:23px;letter-spacing:-.02em;margin:0}"
      +".k2-cw .sub{color:var(--k-dim);font-size:13.5px}"
      +".k2-feed{display:flex;flex-direction:column;gap:10px}"
      +".k2-msg{align-self:flex-end;max-width:82%;background:rgba(54,201,148,.12);border-radius:12px 12px 4px 12px;padding:10px 13px;font-size:14.5px}"
      +".k2-work{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--k-dim);padding:2px 2px}"
      +".k2-work b{color:#e9efec;font-weight:600}"
      +".k2-inbar{display:flex;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px 8px 8px 12px}"
      +".k2-inbar textarea{flex:1;background:transparent;border:0;outline:0;color:inherit;font:inherit;resize:none;height:24px;max-height:110px}"
      +".k2-hint{display:flex;flex-wrap:wrap;gap:6px}"
      +".k2-lnk{color:var(--k-gold);cursor:pointer;text-decoration:underline;text-underline-offset:2px}"
      +".k2-crew{display:flex;flex-direction:column;gap:6px;padding:2px}"
      +".k2-crew-h{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--k-dim)}"
      +".k2-crew-row{display:flex;flex-wrap:wrap;gap:6px}"
      +".k2-crew-a{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 10px 3px 6px}"
      +".k2-crew-a i{font-style:normal;font-size:13px}"
      +".k2-talk{display:flex;flex-direction:column;gap:8px;padding:4px 2px}"
      +".k2-say{display:flex;gap:9px;align-items:flex-start}"
      +".k2-say>i{font-style:normal;font-size:14px;line-height:1.5}"
      +".k2-say b{display:block;font-size:12px;color:var(--k-gold);font-weight:600}"
      +".k2-say span{display:block;font-size:13.5px;color:#c8d2ce}"
      +".k2-res{display:flex;flex-direction:column;gap:7px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.1);font-size:13px;color:#c8d2ce}"
      +".k2-res .k{display:block;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--k-dim);margin-bottom:2px}"
      +".k2-res .deny{color:#e6b871}"
      +"body.k2-chat .app{grid-template-columns:1fr !important}"
      +"body.k2-chat .nav{display:none !important}"
      +"body.k2-chat #cmdBtn,body.k2-chat .tb-right,body.k2-chat2 #cmdBtn,body.k2-chat2 .tb-right{display:none !important}"
      +"body.k2-chat .stage,body.k2-chat2 .stage{padding:0 !important;overflow-y:auto}";
    document.head.appendChild(st);
  }

  function renderChat(){
    chatStyles();
    document.body.classList.add('k2-chat');
    if (!profile) profile = provisionalProfile();
    loadGrowth();
    const nav = $('#nav'), stage = $('#stage');
    if (nav){
      if (hasStaff()){
        document.body.classList.remove('k2-chat'); document.body.classList.add('k2-chat2');
        nav.style.display=''; nav.innerHTML = '<div class="k2-rail-h">МОЙ ЦИФРОВОЙ ШТАТ</div>';
        growth.hired.forEach(h=>{ const it=el('div','k2-cs');
          it.innerHTML='<div class="e">'+h.e+'</div><div><div class="t">'+esc(h.t)+'</div><div class="m">'+esc(h.now)+'</div></div>';
          nav.appendChild(it); });
      } else { document.body.classList.remove('k2-chat2'); nav.style.display='none'; nav.innerHTML=''; }
    }
    const wrap = el('div','k2-cw');
    wrap.innerHTML = '<div><h1>СРЕДА</h1><div class="sub">Напишите, что нужно сделать. Просто словами.</div></div>'
      + '<div class="k2-feed" id="chatFeed"></div>'
      + '<div class="k2-inbar"><textarea id="chatIn" rows="1" placeholder="Например: собрать акт сверки с поставщиком за март"></textarea>'
      + '<button class="k2-btn" id="chatGo">Сделать</button></div>'
      + (growth.tasks ? '' : '<div class="k2-hint"><span class="k2-tag act" data-ex="Собрать акт сверки с поставщиком за март">акт сверки</span>'
          + '<span class="k2-tag act" data-ex="Подготовить презентацию по итогам квартала">презентация по итогам</span>'
          + '<span class="k2-tag act" data-ex="Проверить договор с подрядчиком на риски">проверить договор</span></div>')
      + '<div class="sub" style="margin-top:4px">'
      + (growth.know.length ? 'Среда знает о вас: <b>'+growth.know.length+'</b> '+plural(growth.know.length,'факт','факта','фактов')
          +' · <span class="k2-lnk" id="knowOpen">посмотреть</span> · ' : '')
      + '<span class="k2-lnk" id="goSurvey">узнать меня за 2 минуты</span></div>';
    stage.innerHTML=''; stage.appendChild(wrap);
    growth.feed.forEach(m=> paintFeed(m));
    const inp = $('#chatIn');
    const submit = ()=>{ const v=(inp.value||'').trim(); if(!v) return; inp.value=''; doTask(v); };
    $('#chatGo').onclick = submit;
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); submit(); } });
    wrap.querySelectorAll('[data-ex]').forEach(b=> b.onclick=()=>{ inp.value=b.dataset.ex; submit(); });
    const gs=$('#goSurvey'); if(gs) gs.onclick=()=>{ profile=null; runSurvey(); };
    const ko=$('#knowOpen'); if(ko) ko.onclick=()=> showKnow();
  }

  function paintFeed(m){
    const fd=$('#chatFeed'); if(!fd) return;
    if (m.role==='user'){ fd.appendChild(el('div','k2-msg', esc(m.text))); return; }
    if (m.role==='done'){
      const p=el('div','k2-panel');
      p.innerHTML = '<div class="k2-item"><div class="e">'+(m.verdict==='ok'?'✓':'↩')+'</div><div style="flex:1">'
        + '<div class="b">'+esc(m.title)+'</div><div class="m">'+esc(m.prov)+'</div></div></div>';
      fd.appendChild(p);
    }
  }

  /* ---- задачу делает ГРУППА, а не один агент -----------------------------
     Состав собирается тегами библиотеки, реплики — из РОЛИ агента и знаний
     компании (контекст домена, правило допуска, регнорма отрасли).
     Ни одна строка не пишется под конкретную формулировку запроса. */
  const RISK_WORDS = ['сверх','лимит','скидк','оплат','платёж','платеж','перевод','договор','подпис',
    'персональн','увольн','штраф','пеня','вне бюджета','предоплат','аванс'];
  function riskOf(text){ const t=String(text).toLowerCase(); return RISK_WORDS.some(w=>t.indexOf(w)>=0); }

  const SUPPORT = ['Агент памяти','Агент согласований','Агент приоритетов'];
  function assembleParty(text, dom){
    const lead = pickCap(text, dom, SUPPORT);
    const party = [lead];
    const add = title => { const c = CAP_LIB.find(x=>x.t===title); if (c && !party.some(p=>p.t===c.t)) party.push(c); };
    add('Агент памяти');                       // приносит знания компании — он в группе всегда
    if (riskOf(text)) add('Агент согласований');
    if (party.length < 3) add('Агент приоритетов');
    return party.slice(0,4);
  }
  // что каждый скажет — из его роли, домена и памяти компании
  function partyLines(party, text, dom){
    const dc = DCONTENT[dom];            // без дефолта: чужой контекст хуже, чем никакого
    const mem = (dc && dc.mem) || [];
    const ctx  = (mem[0]||'').replace(/^контекст:\s*/,'');
    const rule = (mem[1]||'').replace(/^правило:\s*/,'');
    const reg  = industryReg ? industryReg() : '';
    const sysL = profile.systems && profile.systems.length ? profile.systems.join(', ') : '';
    const out = [];
    party.forEach((c,i)=>{
      let line;
      if (c.t === 'Агент памяти'){
        line = ctx ? ('в памяти компании: ' + ctx) : 'в памяти компании по этой теме пока пусто — запомню этот случай';
        if (reg) line += ' · нормы: ' + reg;
      } else if (c.t === 'Агент согласований'){
        line = rule ? ('правило: ' + rule) : 'это действие требует санкции — сам не проведу';
      } else if (c.t === 'Агент приоритетов'){
        line = 'сверил с тем, что уже в работе — не конфликтует';
      } else if (i === 0){
        line = 'беру на себя: ' + c.now + (sysL ? (' · подключаюсь к ' + sysL) : '');
      } else {
        line = c.now;
      }
      out.push({ e:c.e, who:c.t, line:line });
    });
    return out;
  }

  function doTask(text){
    loadGrowth();
    const dom = guessDomain(text) || profile.domain;
    const sys = guessSystems(text);
    if (dom && !profile.domain){ profile.domain = dom;
      learn('Чем занимается', DOMAINS[dom] ? DOMAINS[dom].label : dom, 'по формулировке задачи'); }
    sys.forEach(x=>{ if(profile.systems.indexOf(x)<0) profile.systems.push(x); learn('Работает в', x, 'упомянуто в задаче'); });
    const d = dom || profile.domain || null;
    const party = assembleParty(text, d);
    const lead = party[0];
    const risky = riskOf(text);
    growth.tasks++; growth.feed.push({role:'user', text:text}); saveGrowth();
    const fd = $('#chatFeed');
    paintFeed({role:'user', text:text});

    // группа собралась — её видно до того, как она начала работать
    const crew = el('div','k2-crew');
    crew.innerHTML = '<div class="k2-crew-h">над задачей работают ' + party.length + '</div>'
      + '<div class="k2-crew-row">' + party.map(c=>'<span class="k2-crew-a"><i>'+c.e+'</i>'+esc(c.t)+'</span>').join('') + '</div>';
    fd.appendChild(crew);

    const talk = el('div','k2-talk'); fd.appendChild(talk);
    const lines = partyLines(party, text, d);
    let i = 0;
    const tick = ()=>{
      if (i < lines.length){
        const L = lines[i];
        const row = el('div','k2-say');
        row.innerHTML = '<i>'+L.e+'</i><div><b>'+esc(L.who)+'</b><span>'+esc(L.line)+'</span></div>';
        talk.appendChild(row); i++; setTimeout(tick, 520); return;
      }
      showResult();
    };

    function showResult(){
      const dc = (DCONTENT[d] || DCONTENT.sales);
      const rule = ((dc.mem||[])[1]||'').replace(/^правило:\s*/,'');
      const src = [];
      if (profile.systems.length) src.push(profile.systems.join(', '));
      if (dc && (dc.mem||[])[0]) src.push('память компании');   // только если там правда что-то было
      if (industryReg && industryReg()) src.push('нормы отрасли');
      if (!src.length) src.push('только ваша формулировка — контекста по этой теме у меня пока нет');
      const p = el('div','k2-panel'); p.style.borderColor='var(--k-gold)';
      let html = '<div class="k2-item"><div class="e">📄</div><div style="flex:1">'
        + '<div class="b">' + esc(lead.t) + ' — сделано</div>'
        + '<div class="m">' + esc(lead.now) + '</div></div></div>'
        + '<div class="k2-res"><div><span class="k">из чего собрано</span>' + esc(src.join(' · ')) + '</div>';
      if (risky){
        html += '<div class="deny"><span class="k">чего не сделал</span>'
          + esc(rule ? ('нужна санкция — ' + rule) : 'действие требует санкции руководителя')
          + ' · отклонено <b>до выполнения</b>, попытка в аудите</div>';
      }
      html += '<div><span class="k">дальше</span>' + esc(risky ? 'запросить санкцию — и я довожу до конца'
        : 'могу повторять это без просьбы') + '</div></div>'
        + '<div style="display:flex;gap:8px;margin-top:10px"><button class="k2-btn" id="tOk">Годится</button>'
        + '<button class="k2-tag act" id="tNo">Не годится</button>'
        + (risky ? '<button class="k2-tag act" id="tEsc">Запросить санкцию</button>' : '') + '</div>';
      p.innerHTML = html;
      fd.appendChild(p);
      $('#tOk').onclick = ()=> acceptTask(text, lead, p);
      $('#tNo').onclick = ()=>{ growth.returned++;
        const m={role:'done', verdict:'back', title:'Вернул на доработку', prov:'учту в следующий раз'};
        growth.feed.push(m); saveGrowth(); p.remove(); paintFeed(m); };
      const esc2 = $('#tEsc');
      if (esc2) esc2.onclick = ()=>{ esc2.disabled = true; esc2.textContent = 'санкция запрошена';
        k2Audit('Запрошена санкция из чата', text, 'warn');
        const n = el('div','k2-work'); n.innerHTML = '<div>· ушло руководителю — вернусь, когда ответят</div>';
        fd.appendChild(n); };
    }
    setTimeout(tick, 320);
  }

  function acceptTask(text, cap, panel){
    growth.accepted++;
    const m = {role:'done', verdict:'ok', title:'Принято: '+(text.length>60?text.slice(0,60)+'…':text), prov:'сделал '+cap.t};
    growth.feed.push(m); saveGrowth(); panel.remove(); paintFeed(m);
    if (growth.hired.some(h=>h.t===cap.t)){ if (hasPulse()) offerCabinet(); return; }
    const fd=$('#chatFeed');
    const o = el('div','k2-panel'); o.style.borderColor='var(--k-gold)';
    o.innerHTML = '<div class="k2-item"><div class="e">'+cap.e+'</div><div style="flex:1">'
      + '<div class="b">Это делал «'+esc(cap.t)+'»</div>'
      + '<div class="m">'+esc(cap.now)+' — взять его себе? Дальше будет делать это без просьбы.</div></div></div>'
      + '<div style="display:flex;gap:8px;margin-top:10px"><button class="k2-btn" id="hireY">Взять себе</button>'
      + '<button class="k2-tag act" id="hireN">Не надо</button></div>';
    fd.appendChild(o);
    $('#hireY').onclick = ()=>{
      growth.hired.push({ e:cap.e, t:cap.t, now:cap.now });
      learn('Взял в штат', cap.t, 'после принятой работы');
      saveGrowth(); cabToast('✓ «'+cap.t+'» теперь в вашем штате — слева');
      renderChat(); if (hasPulse()) setTimeout(offerCabinet, 500);
    };
    $('#hireN').onclick = ()=> o.remove();
  }

  function offerCabinet(){
    const fd=$('#chatFeed'); if(!fd || $('#cabOffer')) return;
    const o = el('div','k2-panel'); o.id='cabOffer'; o.style.borderColor='var(--k-gold)';
    o.innerHTML = '<div class="k2-item"><div class="e">🗂️</div><div style="flex:1">'
      + '<div class="b">У вас уже '+growth.hired.length+' '+plural(growth.hired.length,'сотрудник','сотрудника','сотрудников')+'</div>'
      + '<div class="m">Их пора видеть вместе: день, что ждёт вас, что они сделали.</div></div></div>'
      + '<div style="display:flex;gap:8px;margin-top:10px"><button class="k2-btn" id="cabY">Собрать кабинет</button></div>';
    fd.appendChild(o);
    $('#cabY').onclick = ()=>{
      profile.chosen = ['today','task','intake'];
      if (!profile.roleTitle){
        const r = resolveRole(profile.domain || 'assist', profile.level || 2);
        profile.roleTitle = (r && r.t) ? r.t : ((profile.domain && DOMAINS[profile.domain]) ? DOMAINS[profile.domain].label : 'Ваша роль');
      }
      save(profile);
      k2Audit('Кабинет собран', 'после '+growth.accepted+' принятых работ и '+growth.hired.length+' нанятых ЦС', 'ok');
      enterCabinet();
    };
  }

  function showKnow(){
    const fd=$('#chatFeed'); if(!fd) return;
    const p=el('div','k2-panel');
    p.innerHTML = '<div class="k2-sec-h">Что Среда узнала о вас</div>'
      + (growth.know.length
          ? growth.know.map(k=>'<div class="k2-item"><div class="e">•</div><div><div class="b">'+esc(k.k)+': '+esc(k.v)+'</div><div class="m">'+esc(k.from)+'</div></div></div>').join('')
          : '<div class="k2-empty">Пока ничего — Среда узнаёт вас из задач, а не из анкеты.</div>')
      + '<div class="k2-empty" style="padding-top:8px">Это ваш личный помощник. Чем больше он знает, тем точнее работает — и тем больше может сделать вместо вас.</div>';
    fd.appendChild(p);
  }

  function boot(){
    if (!$('#stage')) return;
    profile = load();
    // защита от устаревшего профиля: оставляем только существующие модули
    if (profile && Array.isArray(profile.chosen)){
      profile.chosen = profile.chosen.filter(id => MODULES.some(m=>m.id===id));
    }
    if (profile && profile.chosen && profile.chosen.length){ injectStyles(); enterCabinet(); }
    else { injectStyles(); renderChat(); }   // вход = чат, а не анкета
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(boot,0));
  else setTimeout(boot, 0);
})();
