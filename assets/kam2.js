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
        { t:'Copilot в Office',           tool:'Copilot',           habit:'office' },
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
        { t:'Услуги / другое',              industry:'услугах' },
      ]},
    { kind:'systems', multi:true, q:'В каких системах вы живёте?',
      opts:[
        { t:'1С',                           systems:'1С' },
        { t:'Excel / Google Таблицы',       systems:'Excel' },
        { t:'CRM (Bitrix, amoCRM…)',        systems:'CRM' },
        { t:'Таск-трекеры (Jira, Trello)',  systems:'трекерах' },
        { t:'Почта и мессенджеры',          systems:'почте' },
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
      ]},
    // depth перестал быть бинарным: это НАБОР того, что человек хочет видеть.
    // Каждый пункт реально включает свою секцию в карточке ЦС. solo:true — «достаточно результата» отменяет остальные.
    { kind:'depth', multi:true, q:'Что вы хотите видеть, когда ЦС приносит результат?',
      opts:[
        { t:'Достаточно результата',        want:null,   solo:true },
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
    .k2-wrap{ display:flex; flex-direction:column; gap:18px; padding:22px 26px 60px; color:var(--k-txt); }
    /* ---- база опроса ---- */
    /* перф: hero-bg.png весил 5.6МБ и стоял background-attachment:fixed (дорогая композиция,
       из-за неё вис рендер) — под 90% затемнением он был не виден. Оставлены градиенты. */
    .k2-survey{ position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; padding:24px; overflow:auto;
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
    .k2-card{ width:min(720px,94vw); background:var(--k-panel); border:1px solid var(--k-line); border-radius:18px;
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
            <div class="k2-tray-h">Ваши инструменты · <b id="k2Cnt">0</b></div>
            <div class="k2-tray" id="k2Tray"><div class="k2-tray-empty" id="k2Empty">пока пусто — Среда наполнит его под вашу работу</div></div>
            <div class="k2-toast" id="k2Toast"></div>
          </aside>
        </div>`;
    }

    /* ---- ВЕТВЛЕНИЕ: спрашиваем только то, что изменит сборку ----
       Модель сама говорит, влияет ли ответ. Не влияет — не тратим вопрос. */
    function shouldAsk(i){
      const s = SURVEY[i]; if(!s) return false;
      if (s.kind==='dom'){
        // домен уже решён с запасом — оставшиеся доменные вопросы его не перевернут
        const d = topDomains(domScore, 2);
        if (d.length>=2 && (domScore[d[0]] - domScore[d[1]]) >= 4) return false;
        return true;
      }
      if (s.kind==='industry'){
        // отрасль спрашиваем, только если для этого домена в библиотеке ЕСТЬ отраслевые ЦС —
        // иначе ответ не изменит ни штат, ни сборку, и вопрос лишний
        const dom = detectDomain(domScore); if(!dom) return true;
        return CAP_LIB.some(c => !c.industries.includes('*') && (c.domains.includes('*') || c.domains.includes(dom)));
      }
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
      else if (s.kind==='tools'){ set(toolSel, o.tool); set(habitSel, o.habit); }
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
      // модули
      const tray = $('#k2Tray', layer);
      const nc = assembleModules(domain, level);
      const added   = nc.filter(id=>!liveChosen.includes(id));
      const removed = liveChosen.filter(id=>!nc.includes(id));
      removed.forEach(id=>{ const c=tray.querySelector('[data-m="'+id+'"]'); if(c){ c.classList.add('leaving'); setTimeout(()=>c.remove(),320); } });
      added.forEach(id=>{
        const m = MODULES.find(x=>x.id===id); if(!m) return;
        const card = el('div','k2-tcard'); card.dataset.m=id;
        card.innerHTML = `<span class="ci">${m.icon}</span><div><div class="cn">${esc(m.name)}</div><div class="ch">${esc(m.hint)}</div></div>`;
        tray.appendChild(card);
      });
      liveChosen = nc.slice();
      $('#k2Cnt', layer).textContent = nc.length;
      const emp = $('#k2Empty', layer); if(emp) emp.style.display = nc.length ? 'none' : '';
      // подсказка
      let msg='';
      if (s && s.kind==='dom' && domain){ msg = `▲ Среда распознаёт: ${DOMAINS[domain].label}`; }
      else if (s && s.kind==='lvl' && level){ msg = `▲ Уровень: ${LEVELS[level]}`; }
      else if (added.length){ const m=MODULES.find(x=>x.id===added[0]); msg=`▲ готов инструмент «${m.name}»`; }
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
      if (toolSel.length)     echo.push(`вы уже работаете в ${toolSel.join(', ')} — Среда встанет привычно`);
      else if (habit==='none') echo.push(`с ИИ вы ещё на «вы» — Среда проведёт за руку`);
      if (industrySel.length) echo.push(`ваша компания — в ${industrySel.join(' и ')}`);
      if (systemsSel.length)  echo.push(`вы живёте в ${systemsSel.join(', ')} — Среда к ним подключится`);
      if (gripeSel.length)    echo.push(`больше всего вас бесит: ${gripeSel.join(', ')}`);
      if (wantsSel.length)    echo.push(`от результата вам важно видеть: ${wantsSel.map(w=>WANT_LABEL[w]||w).join(', ')}`);
      profile = { domain, level, roleTitle: role?role.t:null,
        wants: wantsSel.slice(), depth: wantsSel.includes('who') ? 1 : 0,   // depth оставлен производным для совместимости
        focus: focusSel.slice(), posture: postureSel.slice(), postureKey: postureKeySel.slice(),
        aiTool: toolSel.slice(), habit, industry: industrySel.slice(), systems: systemsSel.slice(),
        tone, brief, gripe: gripeSel.slice(),
        chosen: assembleModules(domain, level), echo, baseCount: ROLES.length };
      save(profile);
      drawResult();
    }

    function drawResult(){
      layer.classList.remove('two'); layer.innerHTML='';
      const c = el('div','k2-card k2-result');
      const dom = profile.domain;
      const echoHtml = (profile.echo||[]).map((line,i)=>
        `<div class="k2-echo-line" style="animation-delay:${(0.2+i*0.55).toFixed(2)}s">${esc(line)}</div>`).join('');
      const vDelay = (0.2 + (profile.echo||[]).length*0.55 + 0.25).toFixed(2);
      // превью цифрового штата, который соберёт кокпит (а не мёртвые модули)
      const dep0 = DOMAIN_DEPT[dom];
      const staffPrev = (dep0 && ORG.digital && Array.isArray(ORG.digital[dep0]))
        ? ORG.digital[dep0].slice(0,4).map(a=>({e:a.emoji||'🤖', t:a.title||a.name, now:a.now||'на связи'}))
        : (SYNTH_STAFF[dom]||[{e:'🤖',t:'Цифровой двойник',now:'на связи'}]);
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
            <div class="k2-pill">🧬 одна из <b>${profile.baseCount}</b> ролей, что различает Среда</div>
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
      // «Это не я» — соседние роли по весам, поправить в один клик (а не проходить 13 вопросов заново)
      $('#k2NotMe').onclick = ()=>{
        const box = $('#k2Near'); if(!box) return;
        if (box.dataset.open){ box.innerHTML=''; delete box.dataset.open; return; }
        box.dataset.open='1';
        const near = nearbyRoles(profile.domain, profile.level, profile.roleTitle);
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

  // Мультивыбор ВЕЗДЕ → почти все измерения профиля стали наборами.
  // arr() нормализует и старые профили (скаляры), и новые (массивы) — обратная совместимость.
  const arr = v => v==null ? [] : (Array.isArray(v) ? v.filter(x=>x!=null) : [v]);
  const userFocus    = () => arr(profile && profile.focus);
  const userGripe    = () => arr(profile && profile.gripe);
  const userIndustry = () => arr(profile && profile.industry);
  const userPosture  = () => arr(profile && profile.postureKey);
  const userTools    = () => arr(profile && profile.aiTool);
  const userWants    = () => arr(profile && profile.wants);
  const WANT_LABEL = { who:'кто сделал', prov:'из чего собран ответ', mem:'что он знает', audit:'след в аудите' };
  // «что хочу видеть» реально включает секции карточки ЦС; если человек не отвечал — показываем всё (как раньше)
  const wants = k => { const w = userWants(); return w.length ? w.includes(k) : true; };

  // Боль (focus + gripe) → канонические ТЕМЫ. Один словарь, обе оси кладутся в него.
  const PAIN_THEME = {
    // focus
    'рутину, которую пора передать':  'routine',
    'сбор данных и отчёты':           'reports',
    'согласования и решения':         'approvals',
    'разбор входящих':                'inbox',
    'контроль, что всё идёт по плану':'control',
    // gripe
    'бесконечные согласования':       'approvals',
    'рутина и копипаст':              'routine',
    'информация теряется':            'infoloss',
    'отчёты и таблицы':               'reports',
    'вечная спешка':                  'rush',
  };
  // Тема → на какую поверхность Пульса она давит (порядок секций — следствие, не хардкод focus→секция)
  const THEME = {
    reports:  { surface:'staff' }, approvals:{ surface:'wait' }, routine:{ surface:'staff' },
    inbox:    { surface:'cand'  }, control:  { surface:'wait' }, infoloss:{ surface:'staff' }, rush:{ surface:'wait' },
  };
  const userThemes = () => !profile ? [] : [...new Set(userFocus().concat(userGripe()).map(v=>PAIN_THEME[v]).filter(Boolean))];

  // Отрасль → регнорма. Маленькая ФАКТ-таблица (объективный факт, не выдуманный UI) — легитимна, как доменный контент.
  const INDUSTRY_REG = {
    'строительстве':'44-ФЗ · сметы · ГОСТ', 'финансах':'152-ФЗ · МСФО · ЦБ', 'ИТ':'ИБ · SLA · релизы',
    'производстве':'ОТиТБ · снабжение', 'торговле':'ЕГАИС · остатки', 'госсекторе':'223-ФЗ · 44-ФЗ · ПДн', 'услугах':'договоры · SLA клиента',
  };
  // отраслей может быть несколько (холдинг) → регнормы объединяем без дублей
  const industryReg = () => { const r=[...new Set(userIndustry().map(i=>INDUSTRY_REG[i]).filter(Boolean).flatMap(s=>s.split(' · ')))];
    return r.length ? r.join(' · ') : null; };

  // ЕДИНАЯ тегированная библиотека возможностей. Новую возможность добавляешь ОДИН раз с тегами —
  // она всплывает у любого совпавшего профиля. Ни одно измерение не выдумывает контент под ответ.
  const CAP_LIB = [
    { e:'📑', t:'Агент отчётности',       now:'готовит отчёт к утру',            domains:['*'], industries:['*'], themes:['reports'],           systems:['1С','Excel'] },
    { e:'✅', t:'Агент согласований',      now:'собирает визы в одну очередь',    domains:['*'], industries:['*'], themes:['approvals'],         systems:['CRM','почте'] },
    { e:'🔁', t:'Агент рутины',            now:'снимает копипаст по расписанию',  domains:['*'], industries:['*'], themes:['routine'],           systems:['Excel','1С'] },
    { e:'🧠', t:'Агент памяти',            now:'держит контекст и источники',     domains:['*'], industries:['*'], themes:['infoloss'],          systems:['почте','трекерах'] },
    { e:'✉️', t:'Агент входящих',          now:'разбирает почту и звонки за ночь',domains:['*'], industries:['*'], themes:['inbox'],             systems:['почте'] },
    { e:'⏱️', t:'Агент приоритетов',       now:'сортирует срочное от фонового',   domains:['*'], industries:['*'], themes:['rush','control'],    systems:['*'] },
    { e:'🎛️', t:'Агент контроля плана',    now:'следит за планом и отклонениями', domains:['exec','project','ops','analytics'], industries:['*'], themes:['control'], systems:['*'] },
    { e:'📐', t:'Агент смет и тендеров',    now:'сверяет сметы и НМЦК',            domains:['estimate','sales','project'], industries:['строительстве'], themes:['reports','approvals'], systems:['1С'] },
    { e:'🏛️', t:'Агент госзакупок',        now:'мониторит закупки 44/223-ФЗ',     domains:['sales','legal','project','exec'], industries:['госсекторе'], themes:['approvals','reports'], systems:['*'] },
    { e:'📦', t:'Агент снабжения',         now:'держит заявки и остатки',         domains:['ops','project'], industries:['производстве'], themes:['control','routine'], systems:['1С'] },
    { e:'🏷️', t:'Агент остатков',          now:'сводит остатки и поставки',       domains:['sales','ops','analytics'], industries:['торговле'], themes:['reports','control'], systems:['1С'] },
    { e:'🛡️', t:'Агент комплаенса',        now:'проверяет 152-ФЗ и риски',        domains:['legal','finance','exec'], industries:['финансах','госсекторе'], themes:['infoloss'], systems:['*'] },
  ];
  // scoreProfile: соответствие вычисляется, а не перечисляется. Домен — гейт; отрасль/боль/системы — веса.
  function scoreCap(cap){
    const inds = userIndustry();
    if(!cap.domains.includes('*') && !cap.domains.includes(profile.domain)) return 0;                 // не для этого домена
    if(!cap.industries.includes('*') && !inds.some(i=>cap.industries.includes(i))) return 0;          // отраслевой ЦС для другой отрасли
    let s=0;
    userThemes().forEach(t=>{ if(cap.themes.includes(t)) s+=3; });                                    // совпала боль (focus+gripe, мультивыбор)
    if(inds.some(i=>cap.industries.includes(i))) s+=4;                                                // точное попадание в отрасль
    if(userSystems().some(sys=>cap.systems.includes(sys))) s+=1;                                      // есть хоть один источник
    return s;
  }
  // топ-2 подходящих возможности сверх базового штата роли (дедуп по названию)
  function matchedCaps(baseTitles){
    if(!profile) return [];
    const seen = new Set(baseTitles||[]);
    return CAP_LIB.map(c=>({c,s:scoreCap(c)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s)
      .filter(x=>{ if(seen.has(x.c.t)) return false; seen.add(x.c.t); return true; }).slice(0,2).map(x=>x.c);
  }
  /* ============ КАБИНЕТ СОБИРАЕТ САМ ПОЛЬЗОВАТЕЛЬ ============
     Среда ПРЕДЛАГАЕТ раскладку скорингом; как только человек сам подвинул/изменил —
     его раскладка побеждает (custom=true) и живёт между сессиями. Всегда можно вернуть подобранное. */
  const WKEYS = ['wait','flow','meet','staff','cand'];
  const WTITLE = { wait:'Ждёт меня', flow:'Передачи', meet:'Встречи дня', staff:'Мои ЦС', cand:'Предложено помощником' };
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
    if(a){ r.style.setProperty('--acc', a); r.style.setProperty('--acc-hover', a); }
    else { r.style.removeProperty('--acc'); r.style.removeProperty('--acc-hover'); }
  }

  // порядок секций Пульса = скоринг поверхностей от тем боли + posture (не хардкод)
  function surfaceOrder(){
    const score={wait:0,flow:0,meet:0,staff:0,cand:0};
    userThemes().forEach(t=>{ const s=THEME[t]&&THEME[t].surface; if(s) score[s]+=2; });
    // posture теперь реально двигает акцент кабинета, а не только порядок чипа:
    // «сам» → делать (мои ЦС), «поручать/направлять» → принимать (ждёт меня + передачи)
    userPosture().forEach(pk=>{   // predпочтений может быть несколько — веса складываются
      if(pk==='self') score.staff+=1;
      else if(pk==='delegate'){ score.wait+=1; score.flow+=1; }
      else if(pk==='direct'){ score.wait+=2; score.flow+=1; }
    });
    const base=['wait','flow','meet','staff','cand'];
    return base.slice().sort((a,b)=> (score[b]-score[a]) || (base.indexOf(a)-base.indexOf(b)));
  }

  // systems → провенанс-источник на карточках ЦС. Мультивыбор: нормализуем (старые профили хранили строку).
  const SYSTEM_SOURCE = { '1С':'1С', 'Excel':'Excel/Таблицы', 'CRM':'CRM', 'трекерах':'трекер', 'почте':'почта' };
  const userSystems = () => { const s = profile && profile.systems; return !s ? [] : (Array.isArray(s) ? s : [s]); };
  const systemsLabel = () => userSystems().map(s=>SYSTEM_SOURCE[s]||s).join(', ');
  const systemSource = () => userSystems().length ? ('источник: '+systemsLabel()) : null;
  let myStaffCache = null;
  function myStaff(){
    if (myStaffCache) return myStaffCache;
    const dep = DOMAIN_DEPT[profile.domain];
    if (dep && ORG.digital && Array.isArray(ORG.digital[dep])){
      myStaffCache = ORG.digital[dep].slice(0,4).map((a,i)=>({ id:'cs'+i, e:a.emoji||'🤖', t:a.title||a.name, now:a.now||'на связи', ji:a.ji, busy:false, dep }));
    } else {
      const syn = SYNTH_STAFF[profile.domain] || [{e:'🤖',t:'Цифровой двойник',now:'на связи'}];
      myStaffCache = syn.map((s,i)=>({ id:'cs'+i, e:s.e, t:s.t, now:s.now, busy:false, dep:profile.domain }));  // dep=домен → deptLabel даёт название направления, не undefined
    }
    // профиль реально меняет СОСТАВ штата: топ-возможности из библиотеки под профиль (скоринг, не хардкод)
    const extra = matchedCaps(myStaffCache.map(c=>c.t)).map((cap,i)=>({
      id:'csm'+i, e:cap.e, t:cap.t, now:cap.now, busy:false, dep:profile.domain, matched:true,
      tag: userIndustry().some(i=>cap.industries.includes(i)) ? 'под вашу отрасль' : 'под вашу боль',
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
    injectStyles(); firstEnter=true; myStaffCache=null; myAdditions=[]; k2Live=null;
    auditLog=[]; metrics=M0();
    cockpit.height='me'; cockpit.view='pulse'; cockpit.csId=null;
    layout=null; editMode=false; ensureLayout(); applyAccent();   // раскладка/цвет, собранные пользователем
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
      r.onclick = ()=>{ localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_ONBOARD); localStorage.removeItem(LS_LAYOUT);
        layout=null; editMode=false; applyAccent(); profile=null; active=null;
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
    const steps = [
      { sel:'#nav', side:'right', step:'Шаг 1 из 3', ttl:'Слева — твой цифровой штат',
        bd: synth
          ? `Пока это типовой набор под ${esc(domLabel)}. Клик по любому — карточка и постановка задачи. Свой штат наберёшь внизу: «+ штат».`
          : `${staff.length} ${plural(staff.length,'цифровой сотрудник','цифровых сотрудника','цифровых сотрудников')}: ${esc(names)}${staff.length>2?' и другие':''}. Клик по любому — карточка, память и постановка задачи.` },
      { sel:'.k2-main', side:'below', step:'Шаг 2 из 3', ttl:'В центре — твой день',
        bd: waits
          ? `Помощник собрал его к 08:00. ${waits} ${plural(waits,'точка','точки','точек')} уже ждут твоего слова — принять, уточнить, согласовать.`
          : `Помощник собрал его к 08:00: встречи, задачи ЦС и то, что он предложил из звонков и почты.` },
      { sel:'.k2-asst', side:'left', step:'Шаг 3 из 3', ttl:'Справа — твой помощник',
        bd: `Спроси словами или жми чип — проведу и подскажу, кому из ЦС поручить. ${synth?'С пустого места начнём вместе — предложу первый шаг.':'Дальше сам.'}` },
    ];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ring = el('div','k2-coach-ring'); const tip = el('div','k2-coach-tip');
    document.body.appendChild(ring); document.body.appendChild(tip);
    let i = 0;
    const finish = ()=>{ try{ localStorage.setItem(LS_ONBOARD,'1'); }catch(e){}
      ring.remove(); tip.remove(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
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
    draw();
  }
  function goView(view, csId){ cockpit.view=view; cockpit.csId=csId||null; renderStaffRail(); renderCockpit(); }
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
    const stage = $('#stage'); if(!stage) return; stage.innerHTML='';
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
    persist();   // готовый продукт помнит состояние
  }
  function heightBar(){
    const bar = el('div','k2-heights');
    const heights = [['me','Я'],['dept','Отдел'],['company','Компания']];
    heights.forEach(([h,lab])=>{
      const locked = (h==='company' && !canCompany());
      const b = el('button','k2-height'+(cockpit.height===h?' on':'')+(locked?' locked':''), lab+(locked?' 🔒':''));
      b.onclick = ()=>{ if(locked){ cabToast('Высота «Компания» — только Оркестратору (директор/владелец)'); return; } cockpit.height=h; renderCockpit(); };
      bar.appendChild(b);
    });
    return bar;
  }

  /* ---- Пульс «Я»: собранный день (§3) с точками участия (§4) ---- */
  function renderPulseMe(w){
    const staff = myStaff();
    const mins = minsSince(8);
    const ago = mins<60 ? `${mins} мин назад` : `${Math.floor(mins/60)} ч назад`;
    const when = mins>0 ? `собрал ${T('твой','ваш')} день в 08:00 по ${T('твоему','вашему')} времени · ${ago}` : `готовит ${T('твой','ваш')} день к 08:00 · сейчас ${nowHM()}`;
    w.innerHTML = head('Пульс · сегодня', `${esc(profile.roleTitle||'')} · помощник ${when}`);
    w.appendChild(sysStrip());
    // «Среда подобрала под вас» — содержание берётся из САМОЙ подобранной возможности (модель), не из канвы под ответ
    const mc = staff.find(c=>c.matched);
    if (mc){
      // честно: называем ту боль, которую подобранный ЦС РЕАЛЬНО закрывает (а не первую попавшуюся)
      const capThemes = (CAP_LIB.find(c=>c.t===mc.t) || {}).themes || [];
      const pains = userGripe().concat(userFocus());
      const pain = pains.find(p => capThemes.includes(PAIN_THEME[p])) || pains[0];
      const gb = el('div','k2-panel'); gb.style.borderColor='var(--k-gold)';
      gb.innerHTML = `<div class="k2-item"><div class="e">${mc.e}</div><div style="flex:1"><div class="b">Среда подобрала под ${T('тебя','вас')} — «${esc(mc.t)}»</div>
        <div class="m">${esc(mc.now)}${pain?` · закрывает ${T('твою','вашу')} боль: «${esc(pain)}»`:''}</div></div></div>`;
      w.appendChild(gb);
    }
    const src = systemSource();
    // 1. Ждёт меня — точки участия
    const waits = participationPoints();
    const s1 = section('Ждёт меня', waits.length?`${waits.length}`:'чисто');
    if(!waits.length) s1.appendChild(emptyEl(`✓ Всё, что можно, ЦС сделали сами — от ${T('тебя','вас')} сейчас ничего не нужно.`));
    waits.forEach(p=> s1.appendChild(pointEl(p)));
    // 2. Встречи дня (под домен роли)
    const s2 = section('Встречи дня','');
    dcontent().meet.forEach(m=> s2.appendChild(rowEl('📅', `${m[0]} · ${m[1]}`, m[2], null)));
    // 3. Мои ЦС в работе
    const s3 = section('Мои ЦС в работе', `${staff.length}`);
    staff.forEach((cs,i)=>{ const pct=cs.busy?45:[72,60,88,54][i%4];
      const sc=csState(cs).schedule[0];
      const r=el('div','k2-item'); r.style.cursor='pointer';
      const tagHtml = cs.tag?` · <span style="color:var(--k-gold)">${esc(cs.tag)}</span>`:'';
      const srcHtml = src?` · ${esc(src)}`:'';   // systems → провенанс-источник на карточке
      r.innerHTML=`<div class="e">${cs.e}</div><div style="flex:1"><div class="b">${esc(cs.t)}${tagHtml}${cs.busy?` · <span style="color:var(--k-gold)">этап: ${esc(TASK_STAGES[cs.stageIdx!=null?cs.stageIdx:2])}</span>`:''}</div><div class="m">${esc(cs.now)}${srcHtml}${sc?` · 🔁 ${esc(sc.text)} ${esc(sc.when)}`:''}</div>
        <div class="k2-loadbar" style="max-width:220px"><i style="width:${pct}%;background:var(--k-gold)"></i></div></div>`;
      r.onclick=()=>goView('cs', cs.id); s3.appendChild(r); });
    // 4. Предложено помощником — кандидаты из Zoom/почты (§6), под домен, одноразово
    const dc = dcontent();
    const s4 = section('Предложено помощником','');
    const cand = el('div','k2-panel');
    if (k2Live.candDone){
      cand.innerHTML = `<div class="k2-item"><div class="e">✓</div><div><div class="b">Роздано ЦС</div><div class="m">задачи из звонка ушли в работу</div></div></div>`;
    } else {
      cand.innerHTML = `<div class="k2-item"><div class="e">🎧</div><div style="flex:1"><div class="b">${esc(dc.cand.text)}</div>
        <div class="m">помощник разобрал транскрипт — ${T('подтверди или поправь','подтвердите или поправьте')}, прежде чем я раздам ЦС</div></div></div>
        <div id="candBreak"></div>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="k2-btn" id="candOk">Подтвердить и раздать</button><button class="k2-tag act" id="candFix">Поправить</button></div>`;
    }
    s4.appendChild(cand);
    // 5. Передачи (слой №3: выход одного = вход другого) — этого в кокпите не было
    const s5 = section('Передачи', k2Live.flow && k2Live.flow.mine ? 'ваш ход' : '');
    const fp = el('div','k2-panel');
    if (!k2Live.flow) k2Live.flow = { mine:true, done:false };
    const dc2 = dcontent();
    if (k2Live.flow.done){
      fp.innerHTML = `<div class="k2-item"><div class="e">✓</div><div><div class="b">Передано дальше</div>
        <div class="m">${esc(dc2.dept)} → смежное направление · след в аудите</div></div></div>`;
    } else {
      fp.innerHTML = `<div class="k2-item"><div class="e">🔀</div><div style="flex:1">
        <div class="b">Ваш ход: ${esc(dc2.cand.draft.replace(/^Черновик\s*/,''))}</div>
        <div class="m">пришло из смежного направления · ${T('примешь','примете')} — уйдёт дальше по цепочке, выход станет входом коллеге</div></div></div>
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
    const secMap = { wait:s1, flow:s5, meet:s2, staff:s3, cand:s4 };
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
      const hint = el('span','k2-cust-hint', layout.custom ? 'кабинет собран вами' : 'раскладку подобрала Среда — можно пересобрать');
      bar.appendChild(hint);
      return bar;
    }
    bar.appendChild(el('span','k2-cust-hint','тяните карточки · ⬌ ширина · ↕ низ карточки · ✕ скрыть'));
    // цвет
    const sw = el('span','k2-sw');
    ACCENTS.forEach(c=>{ const i=el('i'); i.style.background=c;
      if(layout.accent===c) i.classList.add('on');
      i.title='Цвет акцента'; i.onclick=()=>{ layout.accent=c; touchLayout(); applyAccent(); renderCockpit(); }; sw.appendChild(i); });
    const pick = el('input'); pick.type='color'; pick.value = layout.accent || '#36c994'; pick.title='Свой цвет';
    pick.oninput = (e)=>{ layout.accent=e.target.value; touchLayout(); applyAccent(); };
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
    rst.onclick = ()=>{ layout = defaultLayout(); try{ localStorage.removeItem(LS_LAYOUT); }catch(e){} applyAccent(); renderCockpit(); cabToast('↺ Вернул раскладку, которую подобрала Среда'); };
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
          const o = layout.order.filter(x=>x!==k);
          o.splice(o.indexOf(target), 0, k);
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
    s.innerHTML = `<span title="Агент учёта ресурсов">💰 ${esc(meter)} ИИ/нед</span>
      <span title="Агент ИБ · карантин">🛡️ ИБ: 0 в карантине</span>
      <span class="k2-sys-link" id="sysAudit" role="button" tabindex="0" title="Открыть аудит-след">📋 аудит-след: ${auditLog.length?auditLog.length+' записей':'онлайн'} →</span>
      ${reg?`<span title="Отраслевой профиль">🏛️ профиль отрасли: ${esc(reg)}</span>`:''}
      ${userSystems().length?`<span title="Интеграции">🔌 подключено: ${esc(systemsLabel())}</span>`:(reg?'':'<span title="Агент знаний">📚 знания: актуальны</span>')}`;
    const au=$('#sysAudit',s);
    if(au){ const open=()=>goView('audit'); au.onclick=open; au.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } }; }
    return s;
  }

  /* ---- точки участия (§4): приёмка / санкция / уточнение ---- */
  function participationPoints(){
    const pts=[];
    // §4: точки — по ТВОИМ ЦС/домену. Оркестратор (level>=4) видит всю компанию;
    // специалист — свой домен + всё, что создал сам (id 'apn'/'drt'/'drc').
    const orch = canCompany();
    const myDep = DOMAIN_DEPT[profile.domain];
    const myLabel = deptLabel(myDep||profile.domain);
    const mine = id => { const s=String(id); return s.indexOf('apn')===0 || s.indexOf('drt')===0 || s.indexOf('drc')===0; };
    const apprOk  = a => orch || mine(a.id) || a.dept===myLabel;
    const draftOk = d => orch || mine(d.id) || d.dept===myDep || deptLabel(d.dept)===myLabel;
    liveApprovals().filter(apprOk).forEach(a=> pts.push({ kind:'sanction', id:a.id, icon:'🔴', label:'Разрешить', title:a.task, meta:`${a.dept} · ${a.cost} · риск ${a.risk}` }));
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
      else if(p.kind==='coord'){ k2Live.coord=(k2Live.coord||[]).filter(c=>c.id!==p.id); cabToast('✓ Согласовано — ваш ЦС подключён к задаче'); refreshLive(); }
      else { k2Live.clarify=(k2Live.clarify||[]).filter(c=>c.id!==p.id); cabToast('✓ Ответ отправлен ЦС'); refreshLive(); }
    });
    if(p.kind==='sanction'){ it.querySelectorAll('.act')[1].onclick=()=> animateOut(it, ()=> resolveApproval(p.id,false)); }
    else if(p.kind==='coord'){ it.querySelectorAll('.act')[1].onclick=()=> animateOut(it, ()=>{ k2Live.coord=(k2Live.coord||[]).filter(c=>c.id!==p.id); cabToast('✗ Отклонено — ваш ЦС не подключён'); refreshLive(); }); }
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
  function nearbyRoles(domain, level, exclude){
    const out=[], seen=new Set([exclude]);
    const push=r=>{ if(r && !seen.has(r.t)){ seen.add(r.t); out.push(r); } };
    ROLES.filter(r=>r.d===domain && r.l!==level).sort((a,b)=>Math.abs(a.l-level)-Math.abs(b.l-level)).slice(0,3).forEach(push);
    ROLES.filter(r=>r.d!==domain && r.l===level).slice(0,4).forEach(push);
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
  function denyAction(cs, b, host){
    bump('denied');
    k2Audit('Отказ по границе полномочий', `${b.label} → ${cs.t}`, 'deny');
    let box = host.querySelector('.k2-deny');
    if(!box){ box = el('div','k2-deny'); host.appendChild(box); }
    box.innerHTML = `<div class="dh">⛔ Отклонено до выполнения</div>
      <div class="db"><b>«${esc(b.label)}»</b> — ${esc(b.why)}.</div>
      <div class="db">${esc(b.rule)}</div>
      <div class="df">📋 Попытка записана в аудит-след · ${esc(nowHM())} · verdict: deny</div>`;
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    const a = el('button','k2-tag act','Открыть аудит →'); a.style.marginTop='10px';
    a.onclick = ()=> goView('audit'); box.appendChild(a);
  }

  /* ---- ЦС: память + журнал + расписание + постановка задачи (§4.2,§7.1,§7.2) ---- */
  function renderCS(w){
    const cs = myStaff().find(x=>x.id===cockpit.csId); if(!cs){ goView('pulse'); return; }
    const st = csState(cs);
    w.innerHTML = `<button class="k2-back" id="csBack">← к Пульсу</button>`;
    const ji=cs.ji||{}; const duties=(ji.duties||[]).slice(0,3).map(d=>`<li>${esc(d)}</li>`).join('');
    const card = el('div','k2-agent');
    card.innerHTML = `<div class="ah"><div class="e">${cs.e}</div><div><b>${esc(cs.t)}</b><small>${cs.busy?'⏳ ':''}${esc(cs.now)} · вы — его РЦС</small></div></div>
      ${ji.mission?`<div class="mission">${esc(ji.mission)}</div>`:'<div class="mission">Цифровой сотрудник вашего штата. Ставьте задачу словами — сделает сам, вернёт на приёмку.</div>'}
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
    gp.innerHTML = `<div class="k2-empty">Допуск роли — <b>${accessLetter()}</b> (${accessLabel()}). Проверьте сами: нажмите — и он откажет <b>до выполнения</b>, а попытка ляжет в аудит.</div>`;
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
      if(kind==='now'){ go.disabled=true; go.textContent='ставлю…'; if(!cs._idle) cs._idle=cs.now; cs.busy=true; cs.now='выполняет: '+t; cs.stageIdx=2;
        bump('tasks'); k2Audit('Задача поставлена ЦС', `${cs.t}: ${t}`, 'ok');
        st.journal.unshift({text:'Взял задачу: '+t, prov:['поставлено РЦС · '+nowHM(),'проверка допустимости (ИБ/комплаенс): пройдена','контекст роли']});
        setTimeout(()=>{ if(!k2Live) return;   // гард: пользователь мог «пересобрать» за эти 650мс
          k2Live.drafts.unshift({id:'drt'+(apSeq++), text:'Черновик: '+t, dept:cs.dep, who:cs.t, csId:cs.id});
          cabToast(`✓ ${cs.t} взял задачу — черновик придёт на приёмку`); goView('pulse'); }, 650);
      } else {
        const when = kind==='regular'?'ежедневно 09:00':'завтра 09:00';
        st.schedule.unshift({kind, text:t, when});
        st.journal.unshift({text:(kind==='regular'?'Поставлено регулярно: ':'Отложено: ')+t, prov:['расписание · '+when,'помощник запустит сам к утру']});
        cabToast(kind==='regular'?'✓ Регулярная задача — помощник запустит ежедневно к утру':'✓ Отложено на завтра 09:00 — помощник запустит сам');
        renderCockpit();
      }
    };
  }

  /* ---- АУДИТ-ЭКРАН: обещание «аудит-след: онлайн» с веществом + метрики пилота ---- */
  function renderAudit(w){
    w.innerHTML = `<button class="k2-back" id="auBack">← к Пульсу</button>` +
      head('Аудит-след', 'каждая приёмка, возврат, санкция и отказ по границе — здесь. След неизменяем.');
    // Метрики пилота: то, что мы обещаем мерить с первого дня
    const m = initMetrics();
    const cleanPct = m.accepted ? Math.round(m.clean/m.accepted*100) : 0;
    const ms = section('Метрики пилота · с первого дня','');
    const mp = el('div','k2-kpi');
    mp.innerHTML = `
      <span>приёмок <b>${m.accepted}</b></span>
      <span>без правок <b>${cleanPct}%</b></span>
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
        myAdditions.push({ t:s.t, stage:0, demand: 6+((s.t.length)%40) });
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
          <div class="m">уровень: <b style="color:var(--k-gold)">${esc(STAGES[a.stage])}</b> · телеметрия спроса: ещё ${a.demand} компаний просили похожее</div></div>
          <div>${atCompany?'<span class="k2-tag">в дефолте роли ✓</span>':'<button class="k2-tag act ok">поднять выше</button>'}</div>`;
        if(!atCompany){ it.querySelector('.ok').onclick=()=>{
          // §7.2/§4.3: подъём в дефолт роли/компании — только с санкцией владельца контекста
          if(a.stage===0 && profile.level<3){ cabToast('Подъём в дефолт отдела — санкция руководителя/владельца отдела'); return; }
          if(a.stage===1 && !canCompany()){ cabToast('Подъём в дефолт компании = новый дефолт роли для всех — санкция Оркестратора'); return; }
          a.stage++; cabToast(`✓ «${a.t}» поднят до «${STAGES[a.stage]}» с провенансом — ${a.stage>=2?'стал дефолтом роли для всех компаний СРЕДЫ':'виден всему отделу'}`); renderCockpit();
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
    b.onclick=()=>{ if(!ta.value.trim()){ ta.focus(); cabToast('Опишите, чего не хватает — тогда эскалирую'); return; } cabToast('✓ Эскалация ушла админ-ЦС — соберёт и вернёт со статусом'); ta.value=''; };
    esc2.appendChild(p); w.appendChild(esc2);
    $('#ctorBack',w).onclick=()=>goView('pulse');
  }
  function head(title, sub){ return `<div class="k2-head"><h1>${esc(title)}</h1><span class="sub">${esc(sub||'')}</span></div>`; }

  /* ---- личный помощник = движок Пульса, сквозной (§5) ---- */
  function plural(n, one, few, many){ const a=n%10, b=n%100; if(a===1&&b!==11)return one; if(a>=2&&a<=4&&(b<10||b>=20))return few; return many; }
  function assistantObsC(){
    if (cockpit.view==='cs'){ const cs=myStaff().find(x=>x.id===cockpit.csId); return cs?`Вы смотрите на «${cs.t}». Поставить ему задачу или посмотреть очередь?`:''; }
    if (cockpit.view==='constructor') return 'Скажите, чего не хватает — добавлю из библиотеки или эскалирую админ-ЦС.';
    if (cockpit.height==='dept') return 'Высота отдела: вижу штат и передачи. Показать, у кого затык?';
    if (cockpit.height==='company') return 'Высота компании: обзор всей организации.';
    return userFocus().length
      ? `${T('Собрал твой','Собрал ваш')} день к утру. Знаю, что больше всего у ${T('тебя','вас')} уходит на ${userFocus().join(' и ')} — держу это в приоритете.`
      : `${T('Собрал твой','Собрал ваш')} день к утру. ${T('Начни','Начните')} с того, что подсвечено — остальное ЦС держат сами.`;
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
      out.innerHTML = `<div><b>${T('Не понял','Не понял')} — и не буду делать вид.</b> Свободные формулировки я начну разбирать, когда подключат модель (на пилоте). Пока веду по командам:</div>`;
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
    const inHint = profile.habit==='chat' ? `${T('Спроси','Спросите')} словами — как в ${tools[0]||'чате'}` : (guided ? T('Напиши, что нужно — я подскажу','Напишите, что нужно — я подскажу') : T('Поручи помощнику…','Поручите помощнику…'));
    // пустой/типовой штат ИЛИ новичок в ИИ → развилка «с чего начать»
    const synth = isSynthStaff();
    const startBlock = (synth || guided) ? `
      <div class="k2-start">
        <div class="st-h">С чего начать</div>
        <div class="k2-start-btns">
          <button class="k2-start-btn" id="stTask"><span class="si">⚡</span><span><span class="sl">${T('Поставь задачу словами','Поставить задачу словами')}</span><span class="ss">${T('опиши','опишите')} — рой разберёт и раздаст ЦС</span></span></button>
          <button class="k2-start-btn" id="stStaff"><span class="si">🧩</span><span><span class="sl">${T('Собери штат под себя','Собрать штат под себя')}</span><span class="ss">нанять цифровых сотрудников из библиотеки</span></span></button>
        </div>
      </div>` : '';
    box.innerHTML = `
      <div class="k2-asst-h"><div class="av">🗓️</div>
        <div><b>Личный помощник</b><small>ядро ${T('твоего','вашего')} дня · ${esc(habitNote)}</small></div></div>
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
  }
  function liveApprovals(){ initLive(); return k2Live.approvals; }
  function liveDrafts(){ initLive(); return k2Live.drafts; }
  function resolveApproval(id, ok){ initLive(); const a=(k2Live.approvals||[]).find(x=>x.id===id);
    k2Live.approvals = k2Live.approvals.filter(x=>x.id!==id);
    k2Audit(ok?'Санкция выдана':'Санкция отклонена', (a&&a.task)||'', ok?'ok':'deny');
    cabToast(ok?'✓ Одобрено — отправлено в работу':'✗ Отклонено — вернул на доработку'); refreshLive(); }
  function freeCs(csId){ const cs=(myStaffCache||[]).find(c=>c.id===csId); if(cs){ cs.busy=false; cs.stageIdx=3; cs.now=cs._idle||'на связи'; } }   // §7.2: приёмка завершает цикл — ЦС освобождается
  function acceptDraft(id, edited){ initLive(); const d=(k2Live.drafts||[]).find(x=>x.id===id);
    k2Live.drafts = k2Live.drafts.filter(x=>x.id!==id); if(d&&d.csId) freeCs(d.csId);
    bump('accepted'); if(!edited) bump('clean');   // доля приёмок без правок = прямой показатель качества
    k2Audit('Приёмка: принято', (d&&d.text)||'', 'ok');
    cabToast('✓ Принято'); refreshLive(); }
  function rejectDraft(id){ initLive(); const d=(k2Live.drafts||[]).find(x=>x.id===id);
    k2Live.drafts = k2Live.drafts.filter(x=>x.id!==id);   // §4: приёмка = принять/отклонить; отклонён → ЦС дорабатывает
    if(d&&d.csId){ const cs=(myStaffCache||[]).find(c=>c.id===d.csId); if(cs){ cs.busy=true; cs.stageIdx=2; cs.now='дорабатывает: '+String(d.text||'').replace(/^Черновик:\s*/,''); } }
    bump('rejected'); k2Audit('Приёмка: возвращено на доработку', (d&&d.text)||'', 'warn');
    cabToast('↩ Возвращено на доработку'); refreshLive(); }
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
  function boot(){
    if (!$('#stage')) return;
    profile = load();
    // защита от устаревшего профиля: оставляем только существующие модули
    if (profile && Array.isArray(profile.chosen)){
      profile.chosen = profile.chosen.filter(id => MODULES.some(m=>m.id===id));
    }
    if (profile && profile.chosen && profile.chosen.length){ injectStyles(); enterCabinet(); }
    else { profile=null; runSurvey(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(boot,0));
  else setTimeout(boot, 0);
})();
