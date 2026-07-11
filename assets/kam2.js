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

  /* ---------------------------------------------------------------- утилиты */
  const $  = (s, r) => (r||document).querySelector(s);
  const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
  /* Это seed ~48; структура держит 100+ — добавление роли не трогает код.    */
  const ROLES = [
    // finance
    {t:'Бухгалтер', d:'finance', l:2}, {t:'Старший бухгалтер', d:'finance', l:2},
    {t:'Финансовый аналитик', d:'finance', l:2}, {t:'Казначей', d:'finance', l:3},
    {t:'Финансовый контролёр', d:'finance', l:3}, {t:'Финансовый директор', d:'finance', l:4},
    // estimate
    {t:'Сметчик', d:'estimate', l:2}, {t:'Инженер-сметчик', d:'estimate', l:2},
    {t:'Тендерный специалист', d:'estimate', l:2}, {t:'Руководитель сметного отдела', d:'estimate', l:3},
    // eng
    {t:'Разработчик', d:'eng', l:2}, {t:'QA-инженер', d:'eng', l:2}, {t:'DevOps-инженер', d:'eng', l:2},
    {t:'Архитектор', d:'eng', l:3}, {t:'Техлид', d:'eng', l:3}, {t:'Технический директор', d:'eng', l:4},
    // sales
    {t:'Менеджер по продажам', d:'sales', l:2}, {t:'Ключевой менеджер (KAM)', d:'sales', l:2},
    {t:'Руководитель отдела продаж', d:'sales', l:3}, {t:'Коммерческий директор', d:'sales', l:4},
    // marketing
    {t:'Контент-менеджер', d:'marketing', l:1}, {t:'Маркетолог', d:'marketing', l:2},
    {t:'Продукт-маркетолог', d:'marketing', l:2}, {t:'Глава маркетинга', d:'marketing', l:4},
    // ops
    {t:'Мастер участка', d:'ops', l:2}, {t:'Прораб', d:'ops', l:2}, {t:'Снабженец', d:'ops', l:2},
    {t:'Начальник производства', d:'ops', l:3}, {t:'Директор по производству', d:'ops', l:4},
    // hr
    {t:'Рекрутер', d:'hr', l:2}, {t:'HR-специалист', d:'hr', l:2},
    {t:'HR бизнес-партнёр', d:'hr', l:3}, {t:'HR-директор', d:'hr', l:4},
    // legal
    {t:'Делопроизводитель', d:'legal', l:1}, {t:'Юрист', d:'legal', l:2}, {t:'Юридический директор', d:'legal', l:4},
    // project
    {t:'Координатор проектов', d:'project', l:1}, {t:'Проектный менеджер', d:'project', l:2},
    {t:'Руководитель проектов', d:'project', l:3}, {t:'Директор PMO', d:'project', l:4},
    // analytics
    {t:'Аналитик', d:'analytics', l:2}, {t:'BI-аналитик', d:'analytics', l:2}, {t:'Руководитель аналитики', d:'analytics', l:3},
    // exec
    {t:'Руководитель отдела', d:'exec', l:3}, {t:'Директор', d:'exec', l:4},
    {t:'Генеральный директор', d:'exec', l:5}, {t:'Владелец', d:'exec', l:5}, {t:'Стратег', d:'exec', l:4},
    // assist
    {t:'Личный ассистент', d:'assist', l:2}, {t:'Офис-менеджер', d:'assist', l:2}, {t:'Операционный менеджер', d:'assist', l:3},
  ];

  /* ============================================================ ОПРОС      */
  /* Q1–Q3 нащупывают ДОМЕН (по материалу/боли/результату), Q4–Q5 — УРОВЕНЬ. */
  const SURVEY = [
    { kind:'dom', q:'Что чаще всего открыто у вас на экране в разгар работы?',
      opts:[
        { t:'Таблицы с деньгами и суммами',          g:'Деньги и цифры',   dom:{finance:2} },
        { t:'Сметы, расценки, спецификации',          g:'Сметы и расчёты',  dom:{estimate:2} },
        { t:'Код, консоль, системы',                  g:'Инженерия',        dom:{eng:2} },
        { t:'Переписка и звонки с клиентами',          g:'Продажи',          dom:{sales:2} },
        { t:'Договоры и документы',                    g:'Право и документы',dom:{legal:2} },
        { t:'Графики, сроки, заявки',                  g:'Производство',     dom:{ops:1, project:1} },
        { t:'Дашборды и отчёты',                       g:'Данные / обзор',   dom:{analytics:1, exec:1} },
        { t:'Календарь, задачи, переписка команды',    g:'Операционка',      dom:{assist:1, hr:1} },
      ]},
    { kind:'dom', q:'За что вам прилетит сильнее всего, если ошибётесь?',
      opts:[
        { t:'Неверная цифра или расчёт',               g:'цена ошибки — деньги', dom:{finance:2, estimate:1} },
        { t:'Упавшая система, сломанный релиз',         g:'цена ошибки — прод',   dom:{eng:2} },
        { t:'Сорванная сделка, потерянный клиент',      g:'цена ошибки — выручка',dom:{sales:2} },
        { t:'Юридический риск, штраф',                  g:'цена ошибки — право',  dom:{legal:2} },
        { t:'Сорванный срок, простой',                  g:'цена ошибки — сроки',  dom:{ops:2, project:1} },
        { t:'Не тот вывод в отчёте',                    g:'цена ошибки — решение',dom:{analytics:2} },
        { t:'Не тот человек нанят / ушёл',              g:'цена ошибки — люди',   dom:{hr:2} },
        { t:'Стратегический промах компании',           g:'цена ошибки — курс',   dom:{exec:2} },
      ]},
    { kind:'dom', q:'Ваш готовый результат — это чаще…',
      opts:[
        { t:'Рассчитанное число / смета',              g:'', dom:{estimate:1, finance:1} },
        { t:'Работающая функция или система',          g:'', dom:{eng:2} },
        { t:'Закрытая сделка или договорённость',       g:'', dom:{sales:2} },
        { t:'Готовый документ',                         g:'', dom:{legal:2} },
        { t:'Сданный этап / запущенная кампания',       g:'', dom:{project:1, marketing:1, ops:1} },
        { t:'Инсайт из данных',                         g:'', dom:{analytics:2} },
        { t:'Принятое решение / заданный курс',         g:'', dom:{exec:2} },
        { t:'Разгруженный день другого человека',       g:'', dom:{assist:2} },
      ]},
    { kind:'lvl', q:'Сколько людей отвечают по работе перед вами?',
      opts:[
        { t:'Никто — я сам исполнитель',               g:'', lvl:1 },
        { t:'Один-два человека',                        g:'', lvl:2 },
        { t:'Команда или отдел',                        g:'', lvl:3 },
        { t:'Несколько отделов',                        g:'', lvl:4 },
        { t:'Вся компания',                             g:'', lvl:5 },
      ]},
    { kind:'lvl', q:'Ваше слово в рабочих вопросах обычно…',
      opts:[
        { t:'Предлагаю — решают другие',               g:'', lvl:1 },
        { t:'Решаю в своей зоне',                       g:'', lvl:2 },
        { t:'Утверждаю за команду',                     g:'', lvl:3 },
        { t:'Задаю направление отделу',                 g:'', lvl:4 },
        { t:'Последнее слово за мной',                  g:'', lvl:5 },
      ]},
    { kind:'depth', q:'Насколько вам важно видеть, КАК именно всё сделано?',
      opts:[
        { t:'Дайте результат — под капот не полезу',    g:'спрячем кухню',            depth:0 },
        { t:'Хочу видеть, кто сделал и на чём основано',g:'покажем авторов и источники', depth:1 },
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
      domains:['sales'], levels:[1,3], render:specRender({ title:'Воронка и КП', sub:'Что двойник менеджера собрал по клиентам', who:'двойник менеджера продаж', items:[
        ['📄','КП для банка «Гамма» — собрано за 10 минут','на отправку'],
        ['🔥','6 «горячих» сделок в воронке',''],
        ['🎯','Тендер 44-ФЗ подан в срок',''],
      ]}) },
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

  /* ---------------------------------------------------------------- стили   */
  function injectStyles(){
    if ($('#kam2Style')) return;
    const s = el('style'); s.id='kam2Style';
    s.textContent = `
    :root{ --k-bg:#121310; --k-panel:#1a1c17; --k-panel2:#20231c; --k-line:#2c3026;
      --k-txt:#e9e7de; --k-dim:#9a9b8f; --k-gold:#e8c468; --k-gold2:#f0d78a; }
    .k2-wrap{ display:flex; flex-direction:column; gap:18px; padding:22px 26px 60px; color:var(--k-txt); }
    /* ---- база опроса ---- */
    .k2-survey{ position:fixed; inset:0; z-index:120; background:radial-gradient(1200px 600px at 70% -10%, #1c1f18 0%, #121310 60%);
      display:flex; align-items:center; justify-content:center; padding:24px; overflow:auto; }
    .k2-card{ width:min(700px,94vw); background:var(--k-panel); border:1px solid var(--k-line); border-radius:20px;
      padding:34px 34px 28px; box-shadow:0 30px 80px rgba(0,0,0,.5); animation:k2rise .5s cubic-bezier(.22,1,.36,1); }
    .k2-eyebrow{ color:var(--k-gold); font-size:12px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; }
    .k2-q{ font-size:22px; line-height:1.28; font-weight:700; margin:12px 0 20px; letter-spacing:-.01em; }
    .k2-opts{ display:flex; flex-direction:column; gap:9px; }
    .k2-opt{ text-align:left; background:var(--k-panel2); border:1px solid var(--k-line); color:var(--k-txt);
      border-radius:12px; padding:13px 16px; font-size:15px; line-height:1.3; cursor:pointer; transition:.14s; position:relative;
      display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .k2-opt:hover{ border-color:var(--k-gold); background:#262a20; transform:translateY(-1px); }
    .k2-opt .gain{ color:var(--k-dim); font-size:11.5px; white-space:nowrap; }
    .k2-opt:hover .gain{ color:var(--k-gold); }
    .k2-opt.chosen{ border-color:var(--k-gold); background:#2a2e22; }
    .k2-progress{ display:flex; gap:6px; margin-top:22px; }
    .k2-dot{ flex:1; height:4px; border-radius:2px; background:var(--k-line); transition:background .3s; }
    .k2-dot.on{ background:var(--k-gold); }
    .k2-sub{ color:var(--k-dim); font-size:13.5px; margin-top:16px; line-height:1.5; }
    .k2-back{ background:none; border:none; color:var(--k-dim); font-size:13px; cursor:pointer; padding:6px 0; margin-top:12px; }
    .k2-back:hover{ color:var(--k-txt); }
    .k2-cta{ background:var(--k-gold); color:#1a1a12; border:none; font-weight:800; font-size:15px; border-radius:12px; padding:14px 26px; cursor:pointer; }
    .k2-cta:hover{ background:var(--k-gold2); }
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
    .k2-dom .track i{ display:block; height:100%; width:0; border-radius:5px; background:linear-gradient(90deg,#5a5e4c,#7d8264); transition:width .6s cubic-bezier(.22,1,.36,1); }
    .k2-dom.lead .track i{ background:linear-gradient(90deg,#c9a545,#f0d78a); box-shadow:0 0 12px rgba(232,196,104,.5); }
    .k2-lvlbox{ margin-top:16px; }
    .k2-lvlbox .t{ display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px; }
    .k2-lvlbox .t b{ color:var(--k-gold); }
    .k2-lvlbox .track{ height:7px; border-radius:5px; background:var(--k-line); overflow:hidden; }
    .k2-lvlbox .track i{ display:block; height:100%; width:0; background:linear-gradient(90deg,#c9a545,#f0d78a); border-radius:5px; transition:width .6s cubic-bezier(.22,1,.36,1); }
    .k2-role{ margin-top:16px; padding:13px 15px; border:1px solid var(--k-line); border-radius:12px; background:var(--k-panel);
      font-size:14px; }
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
      border-radius:12px; padding:10px 13px; overflow:hidden; animation:k2card .5s cubic-bezier(.22,1,.36,1); }
    .k2-tcard.leaving{ animation:k2out .32s ease forwards; }
    .k2-tcard .ci{ font-size:19px; width:22px; text-align:center; }
    .k2-tcard .cn{ font-weight:600; font-size:14px; }
    .k2-tcard .ch{ color:var(--k-dim); font-size:11.5px; margin-top:1px; }
    @keyframes k2card{ 0%{transform:scale(.82) translateY(8px);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1) translateY(0);opacity:1} }
    @keyframes k2out{ to{opacity:0;transform:scale(.9);height:0;padding-top:0;padding-bottom:0;margin-top:-9px} }
    .k2-toast{ margin-top:auto; padding-top:16px; color:var(--k-gold); font-size:13px; line-height:1.4; min-height:20px; opacity:0; transform:translateY(6px); transition:opacity .32s, transform .32s; }
    .k2-toast.show{ opacity:1; transform:translateY(0); }
    /* ---- результат ---- */
    .k2-result h2{ font-size:24px; font-weight:800; letter-spacing:-.01em; margin:6px 0 2px; }
    .k2-result h2 .role{ color:var(--k-gold); }
    .k2-meta{ display:flex; gap:9px; flex-wrap:wrap; margin:12px 0 4px; }
    .k2-pill{ display:flex; align-items:center; gap:7px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:999px; padding:7px 13px; font-size:13px; }
    .k2-pill b{ color:var(--k-gold); }
    .k2-picked{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; margin:18px 0; }
    .k2-mod{ background:var(--k-panel); border:1px solid var(--k-line); border-radius:14px; padding:16px; }
    .k2-mod .i{ font-size:22px; } .k2-mod .n{ font-weight:700; margin:8px 0 3px; } .k2-mod .h{ color:var(--k-dim); font-size:13px; line-height:1.4; }
    /* ---- кабинет ---- */
    .k2-nav{ display:flex; flex-direction:column; gap:4px; padding:10px; }
    .k2-nav-lbl{ color:var(--k-dim); font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:12px 12px 4px; }
    .k2-nav-role{ color:var(--k-gold); font-size:12px; padding:0 12px 8px; font-weight:700; }
    .k2-nav-item{ display:flex; align-items:center; gap:11px; padding:11px 12px; border-radius:11px; cursor:pointer; color:var(--k-txt); font-size:14.5px; border:1px solid transparent; }
    .k2-nav-item:hover{ background:var(--k-panel2); }
    .k2-nav-item.on{ background:var(--k-panel2); border-color:var(--k-line); }
    .k2-nav-item .ni{ font-size:17px; width:22px; text-align:center; }
    .k2-nav-item small{ display:block; color:var(--k-dim); font-size:11.5px; }
    .k2-add{ margin-top:8px; color:var(--k-gold); font-size:13px; cursor:pointer; padding:11px 12px; border:1px dashed var(--k-line); border-radius:11px; }
    .k2-add:hover{ background:var(--k-panel2); }
    .k2-head{ display:flex; align-items:baseline; gap:12px; margin-bottom:4px; flex-wrap:wrap; }
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
    .k2-ta{ width:100%; min-height:120px; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:12px; color:var(--k-txt); padding:14px; font-size:15px; resize:vertical; font-family:inherit; }
    .k2-chip{ display:inline-flex; gap:6px; align-items:center; background:var(--k-panel2); border:1px solid var(--k-line); border-radius:999px; padding:6px 12px; font-size:12.5px; margin:4px 6px 0 0; cursor:pointer; }
    .k2-chip:hover{ border-color:var(--k-gold); }
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
    `;
    document.head.appendChild(s);
  }

  /* ================================================================ ОПРОС  */
  function runSurvey(){
    injectStyles();
    let step = 0;
    const domScore = {}; const lvlSamples = [];
    let depth = 1;
    let liveChosen = [];
    const history = [];   // [{kind, dom?, lvl?, depth?}]
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
        <div class="k2-sub">6 коротких вопросов. Справа вы увидите, как Среда распознаёт вашу профессию и достраивает рабочее место прямо на глазах.</div>
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
            <div class="k2-tray-h">Ваши модули · <b id="k2Cnt">0</b></div>
            <div class="k2-tray" id="k2Tray"><div class="k2-tray-empty" id="k2Empty">пока пусто — Среда наполнит его под вашу работу</div></div>
            <div class="k2-toast" id="k2Toast"></div>
          </aside>
        </div>`;
    }

    /* ---- левая колонка ---- */
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
        const b = el('button','k2-opt', `<span>${esc(o.t)}</span>${o.g?`<span class="gain">${esc(o.g)}</span>`:''}`);
        b.onclick = ()=> answer(o, s, b);
        box.appendChild(b);
      });
      if (step>0) $('#k2Back',left).onclick = goBack;
    }

    /* ---- ответ ---- */
    function answer(o, s, btn){
      if (locked) return; locked = true;
      btn.classList.add('chosen');
      const rec = { kind:s.kind };
      if (s.kind==='dom'){ for(const d in o.dom){ domScore[d]=(domScore[d]||0)+o.dom[d]; } rec.dom=o.dom; }
      else if (s.kind==='lvl'){ lvlSamples.push(o.lvl); rec.lvl=o.lvl; }
      else if (s.kind==='depth'){ depth=o.depth; rec.depth=o.depth; }
      history[step] = rec;
      updateRight(o, s);
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
      if (h){
        if (h.kind==='dom' && h.dom){ for(const d in h.dom){ domScore[d]=(domScore[d]||0)-h.dom[d]; if(domScore[d]<=0) delete domScore[d]; } }
        else if (h.kind==='lvl'){ const i=lvlSamples.lastIndexOf(h.lvl); if(i>=0) lvlSamples.splice(i,1); }
      }
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
      }
      // уровень
      const level = detectLevel(lvlSamples);
      const lb = $('#k2LvlBox', layer);
      if (level){ lb.style.display=''; $('#k2LvlName',layer).textContent=LEVELS[level];
        $('#k2LvlBar',layer).style.width = (level/5*100)+'%'; }
      // роль
      const domain = detectDomain(domScore);
      const role = resolveRole(domain, level);
      const roleBox = $('#k2Role', layer);
      if (role){
        roleBox.style.display='';
        roleBox.innerHTML = `<div class="rt">${esc(role.t)}</div>
          <div class="rs">${DOMAINS[role.d].icon} ${esc(DOMAINS[role.d].label)} · ${esc(LEVELS[role.l])}</div>`;
        roleBox.classList.remove('pop'); void roleBox.offsetWidth; roleBox.classList.add('pop');
      }
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
      else if (added.length){ const m=MODULES.find(x=>x.id===added[0]); msg=`▲ добавлен модуль «${m.name}»`; }
      if (msg) showToast(msg);
    }
    let toastTimer=null;
    function showToast(msg){ const t=$('#k2Toast',layer); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2600); }

    function finish(){
      const domain = detectDomain(domScore);
      const level = detectLevel(lvlSamples) || 2;
      const role = resolveRole(domain, level);
      profile = { domain, level, roleTitle: role?role.t:null, depth, chosen: assembleModules(domain, level) };
      save(profile);
      drawResult();
    }

    function drawResult(){
      layer.classList.remove('two'); layer.innerHTML='';
      const c = el('div','k2-card k2-result');
      const dom = profile.domain;
      const mods = profile.chosen.map(id=>{ const m=MODULES.find(x=>x.id===id);
        return `<div class="k2-mod"><div class="i">${m.icon}</div><div class="n">${esc(m.name)}</div><div class="h">${esc(m.hint)}</div></div>`; }).join('');
      c.innerHTML = `
        <div class="k2-eyebrow">Среда вас узнала</div>
        <h2>Вы — <span class="role">${esc(profile.roleTitle||'специалист')}</span></h2>
        <div class="k2-meta">
          ${dom?`<div class="k2-pill">${DOMAINS[dom].icon} <b>${esc(DOMAINS[dom].label)}</b></div>`:''}
          <div class="k2-pill">🎚️ уровень: <b>${esc(LEVELS[profile.level])}</b></div>
        </div>
        <div class="k2-sub">Под вашу работу Среда собрала ${profile.chosen.length} модуля. Не тот человек? Всё меняется — «↺ пересобрать» внизу. Не хватает — «Добавить в Среду».</div>
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
    renderNav2();
    renderActive();
    const brand = $('#brandHome'); if (brand){ brand.onclick = (e)=>{ e.preventDefault(); active=profile.chosen[0]; renderNav2(); renderActive(); }; }
    const cmd = $('#cmdBtn'); if (cmd){ cmd.onclick = (e)=>{ e.preventDefault(); if(!profile.chosen.includes('task')) addModule('task'); active='task'; renderNav2(); renderActive(); }; }
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
    wrap.innerHTML = `<div class="k2-nav-lbl">Моя Среда</div>
      ${profile.roleTitle?`<div class="k2-nav-role">${DOMAINS[profile.domain]?DOMAINS[profile.domain].icon:''} ${esc(profile.roleTitle)}</div>`:''}`;
    profile.chosen.forEach(id=>{
      const m = MODULES.find(x=>x.id===id); if(!m) return;
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
  function addModule(id){ if(!profile.chosen.includes(id)){ profile.chosen.push(id); save(profile); } }

  function renderAddPanel(rest){
    active='__add'; renderNav2();
    const stage = $('#stage'); if(!stage) return; stage.innerHTML='';
    const w = el('div','k2-wrap');
    w.innerHTML = `<div class="k2-head"><h1>Добавить в Среду</h1><span class="sub">берите только нужное — Среда не навязывает</span></div>`;
    const grid = el('div','k2-picked');
    rest.forEach(m=>{
      const card = el('div','k2-mod'); card.style.cursor='pointer';
      card.innerHTML = `<div class="i">${m.icon}</div><div class="n">${esc(m.name)}</div><div class="h">${esc(m.hint)}</div>
        <div style="margin-top:12px"><span class="k2-tag">+ добавить</span></div>`;
      card.onclick = ()=>{ addModule(m.id); active=m.id; renderNav2(); renderActive(); };
      grid.appendChild(card);
    });
    w.appendChild(grid); stage.appendChild(w);
  }

  function renderActive(){
    const stage = $('#stage'); if(!stage) return;
    const m = MODULES.find(x=>x.id===active); if(!m) return;
    stage.innerHTML=''; const w = el('div','k2-wrap'); stage.appendChild(w);
    m.render(w);
    const ann = $('#routeAnnounce'); if(ann) ann.textContent = m.name;
  }
  function head(title, sub){ return `<div class="k2-head"><h1>${esc(title)}</h1><span class="sub">${esc(sub||'')}</span></div>`; }

  /* ================================================================ РЕНДЕР  */
  const feed = () => (ORG.pulseFeed || []);
  const deptLabel = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.label:id; };
  const deptIcon  = id => { const d=(ORG.depts||[]).find(x=>x.id===id); return d?d.icon:'•'; };

  /* --- доменные модули: общий рендер спеки --- */
  function renderSpec(w, spec){
    w.innerHTML = head(spec.title, spec.sub||'');
    const p = el('div','k2-panel');
    (spec.items||[]).forEach(it=>{
      const [emoji, title, meta] = it;
      const row = el('div','k2-item');
      row.innerHTML = `<div class="e">${emoji}</div><div><div class="b">${esc(title)}</div>
        ${meta?`<div class="m">${esc(meta)}</div>`:''}${(spec.who && profile.depth)?`<div class="k2-who">подготовил: ${esc(spec.who)}</div>`:''}</div>`;
      p.appendChild(row);
    });
    w.appendChild(p);
  }

  /* --- Мой день --- */
  function renderToday(w){
    w.innerHTML = head('Мой день', 'что ждёт именно вас — не вся компания, а ваш стол');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='1fr 1fr';
    const p1 = el('div','k2-panel'); p1.innerHTML='<h3>Ждёт вашего слова</h3>';
    (DASH.approvals||[]).slice(0,4).forEach(a=> p1.appendChild(rowEl('🔐', a.task, `${a.dept} · ${a.cost}`, null)));
    const p2 = el('div','k2-panel'); p2.innerHTML='<h3>Черновики от ваших цифровых сотрудников</h3>';
    feed().filter(f=>f[0]==='d').slice(0,4).forEach(f=> p2.appendChild(rowEl(deptIcon(f[3]), f[2], deptLabel(f[3]), profile.depth?f[1]:null)));
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

  /* --- Приёмка --- */
  function renderIntake(w){
    w.innerHTML = head('Приёмка результатов', 'что готово и держит вашу проверку');
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

  /* --- Решения и санкции --- */
  function renderSanctions(w){
    w.innerHTML = head('Решения и санкции', 'где нужно ваше слово — и кто подготовил материал');
    const p = el('div','k2-panel');
    (DASH.approvals||[]).forEach(a=>{ const rc=a.risk==='med'?'#e8c468':a.risk==='high'?'#f0794a':'#6bbf6b';
      const it=el('div','k2-item');
      it.innerHTML=`<div class="e">🔐</div><div style="flex:1"><div class="b">${esc(a.task)}</div><div class="m">${esc(a.dept)} · ${esc(a.cost)} · <span style="color:${rc}">риск ${esc(a.risk)}</span></div></div>
        <div style="display:flex;gap:6px"><span class="k2-tag" style="border-color:var(--k-gold);color:var(--k-gold)">одобрить</span><span class="k2-tag">отклонить</span></div>`;
      p.appendChild(it); });
    w.appendChild(p);
  }

  /* --- Команда --- */
  function renderTeam(w){
    w.innerHTML = head('Команда и отделы', 'люди и их цифровые двойники — весь штат');
    const grid = el('div','k2-grid'); grid.style.gridTemplateColumns='repeat(auto-fill,minmax(300px,1fr))';
    (ORG.depts||[]).forEach(d=>{ const p=el('div','k2-panel'); const people=(ORG.team&&ORG.team[d.id])||[];
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
    Object.keys(digital).forEach(dep=>{ digital[dep].slice(0,2).forEach(a=>{ const c=el('div','k2-agent'); const ji=a.ji||{};
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
    if (profile && profile.chosen && profile.chosen.length){ injectStyles(); enterCabinet(); }
    else { runSurvey(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(boot,0));
  else setTimeout(boot, 0);
})();
