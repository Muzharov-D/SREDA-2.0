/* ========================================================================== */
/*  FORGE — цифровое производство Среды (фаза «газ», цех под ключ)            */
/*  Заказчик платит за готовый артефакт. Конвейер: Проектирование →           */
/*  Разработка → Тестирование → Приёмка; между станциями — ворота, на которых */
/*  решает человек. Внутри цеха — изолированная бригада агентов из пула       */
/*  Talent; наружу — лента событий без раскрытия процесса (изоляция =         */
/*  безопасность). Флагман-мета: цех собрал «Нейрокарту отдела» для Среды.    */
/* ========================================================================== */

const FG_STAGES = [
  { id:'design', label:'Проектирование', icon:'📐' },
  { id:'build',  label:'Разработка',     icon:'⚙️' },
  { id:'test',   label:'Тестирование',   icon:'🧪' },
  { id:'accept', label:'Приёмка',        icon:'📦' },
];
const FG_GATES = {
  design:{ title:'Ворота 1 · Архитектура', what:'2 страницы: стек, схема данных, точки интеграции. Утвердите — и бригада работает автономно до демо.' },
  build: { title:'Ворота 2 · Промежуточный результат', what:'Демо ключевых сценариев + сверка с критериями приёмки. Оплата этапа 40% — после утверждения.' },
  test:  { title:'Ворота 3 · Финальная приёмка', what:'Полный артефакт: код, тесты, документация, развёрнутый сервис. Приёмка по вашим же критериям.' },
};

/* каталог сценариев производства — без сроков, цена и состав */
const FG_TEMPLATES = [
  { id:'land',   icon:'🪧', title:'Лендинг + CRM + аналитика', price:45000,
    what:['Посадочная с формами и A/B-каркасом','Интеграция лидов в вашу CRM','Сквозная аналитика до сделки','Передача: код + доступы + гайд'],
    crit:['Лиды доезжают до CRM без потерь','Скорость загрузки < 1.5 с','События размечены до сделки','Редактирование контента без разработчика'],
    roles:['backend','qa'] },
  { id:'bot',    icon:'💬', title:'Чат-бот поддержки с базой знаний', price:95000,
    what:['Бот в Telegram / на сайте','База знаний из ваших документов','Эскалация на оператора при неуверенности','Панель качества ответов'],
    crit:['≥ 80% типовых вопросов без оператора','Эскалация при уверенности < 0.8','Ответ ≤ 5 секунд','Журнал диалогов с разметкой'],
    roles:['backend','data','qa'] },
  { id:'rep1c',  icon:'📑', title:'Отчётность 1С → Telegram', price:60000,
    what:['Выгрузки из 1С по расписанию','Сводки и алерты в Telegram-канал','Фильтры по подразделениям','Доступ по ролям'],
    crit:['Сводка к 9:00 без ручных действий','Цифры сходятся с 1С копейка в копейку','Алерт при отклонении > 10%','История сводок ищется'],
    roles:['bi','backend'] },
  { id:'integr', icon:'🔌', title:'Интеграция двух систем (middleware)', price:180000,
    what:['Шина между системами (очередь + ретраи)','Маппинг справочников','Мониторинг и алерты','Идемпотентность и аудит'],
    crit:['Потери сообщений: 0','Повторная доставка без дублей','Расхождение справочников видно в панели','Падение одной системы не роняет вторую'],
    roles:['backend','devops','qa'] },
  { id:'llm',    icon:'🧠', title:'LLM-сервис аналитики с дашбордом', price:320000,
    what:['Вопросы к данным на русском → SQL','Дашборд с проверяемыми источниками','Контроль галлюцинаций (цитаты строк)','Развёртывание в вашем контуре'],
    crit:['Ответ подтверждается строками источника','Точность на вашем эталоне ≥ 95%','Данные не покидают контур','Аудит каждого запроса'],
    roles:['data','backend','devops'] },
  { id:'mvp',    icon:'📱', title:'MVP мобильного приложения', price:280000,
    what:['Flutter-клиент + бэкенд','3 ключевых пользовательских сценария','Сборки в сторы + крэш-аналитика','Дизайн на вашей дизайн-системе'],
    crit:['3 сценария проходят без подсказок','Crash-free ≥ 99.5%','Холодный старт < 2 с','Передача: репозитории + CI'],
    roles:['backend','qa','devops'] },
  { id:'demand', icon:'📦', title:'Прогноз спроса по SKU (ритейл)', price:320000,
    what:['Модель прогноза по каждому SKU','Учёт промо, сезонности, каннибализации','API для системы закупок','Панель точности по категориям'],
    crit:['Точность ≥ базовой эвристики +15%','Прогноз на 50 000 SKU < 20 мин','Закупщик видит «почему такой прогноз»','Деградация модели → алерт'],
    roles:['data','backend','devops'] },
  { id:'score',  icon:'🛡️', title:'Скоринг-API с бюро кредитных историй', price:260000,
    what:['API скоринга с интеграцией 3 бюро','Антифрод-правила первой линии','Объяснимость решения (reason codes)','Песочница для риск-команды'],
    crit:['Ответ p99 < 900 мс','Каждое решение объяснимо','Отказ бюро не блокирует поток','Полный аудит обращений'],
    roles:['backend','data','qa'] },
];

/* анонимизированная лента цеха — по стадиям (изоляция = безопасность) */
const FG_FEED = {
  design:[ 'архитектор зафиксировал схему данных', 'выбран стек — обоснование в архдоке', 'точки интеграции описаны, риски: 2 (закрыты в плане)', 'план декомпозирован на 14 рабочих пакетов' ],
  build: [ 'собрано ядро сервиса · линт чистый', 'пакет {n}/14 завершён · покрытие держится > 90%', 'арбитраж Среды: 2 решения слиты без конфликта', 'интеграционный контур поднят в песочнице', 'ревью пакета {n}: замечания исправлены автоматически' ],
  test:  [ 'прогон: {t} проверок ✓ · падений 0', 'нагрузочный профиль ×4 — деградации нет', 'найден дефект P2 → возвращён в разработку → исправлен', 'критерий приёмки «{c}» подтверждён замером' ],
  accept:[ 'артефакты упакованы: код · тесты · документация', 'паспорт качества собран', 'песочница будет стёрта после передачи (TTL)' ],
};

/* преднаполненные проекты цеха: сдан · ждёт ворот · в работе */
function forgeStore(){
  if (window.__FORGE) return window.__FORGE;
  const mk = (o) => ({ feed:[], gateWait:null, paidLbl:'', ...o });
  return (window.__FORGE = { seq:1, projects:[
    mk({ id:'fp-neuro', tpl:'meta', icon:'🧬', title:'Модуль «Нейрокарта отдела» для продукта «Среда»',
      meta:true, price:180000, status:'done', stage:3, prog:[100,100,100,100],
      crew:['tl-bd-01','tl-do-01','tl-qa-01'],
      what:['Canvas-карта: нейроны-сотрудники, синапсы-передачи','Импульсы-задачи и тормозной синапс гейта','Ховер-связи, клик в профиль','Передача модуля в продукт'],
      crit:[['60 fps на 120 нейронах',true],['Гейт виден без чтения легенды',true],['Клик любого нейрона → профиль',true],['0 ошибок консоли',true]],
      gates:[['Ворота 1 · Архитектура','утверждены'],['Ворота 2 · Демо на живых данных','утверждены'],['Ворота 3 · Финальная приёмка','подписан акт']],
      paidLbl:'оплачен полностью · 30/40/30',
      artifacts:[ ['🧬','Открыть результат в продукте','dpulse:dev','модуль работает в «Среде» прямо сейчас'],
                  ['📄','Архитектурный документ','toast','2 страницы · стек, граф, импульсы'],
                  ['🧪','Отчёт тестирования','toast','248 проверок · 60 fps · 0 ошибок'],
                  ['📦','Репозиторий и документация','toast','передан в контур Авандока'] ],
      feedDone:[ 'акт подписан · песочница стёрта по TTL', 'паспорт качества: все критерии замером', 'бригада освобождена — доступна для найма в Talent' ] }),
    mk({ id:'fp-demand', tpl:'demand', icon:'📦', title:'Прогноз спроса по 50 000 SKU · ритейл-направление',
      price:320000, status:'gate', stage:0, prog:[100,0,0,0],
      crew:['tl-da-01','tl-bd-02','tl-do-02'],
      what:FG_TEMPLATES.find(t=>t.id==='demand').what,
      crit:FG_TEMPLATES.find(t=>t.id==='demand').crit.map(c=>[c,false]),
      gate:{ stage:'design', timerMin: 5*60+12 },
      paidLbl:'старт оплачен · 30%',
      artifacts:[ ['📄','Архитектурный документ (на утверждении)','gate','схема модели · фичи · API закупок'] ] }),
    mk({ id:'fp-clinic', tpl:'bot', icon:'🩺', title:'Чат-бот записи пациентов · сеть клиник',
      price:145000, status:'run', stage:1, prog:[100,58,0,0],
      crew:['tl-bd-02','tl-da-02','tl-qa-02'],
      what:['Диалоги записи: 12 типов запросов','Интеграция с МИС по SOAP','Эскалация на регистратуру','Уведомления в WhatsApp'],
      crit:[['Распознаёт 12 типов запросов',false],['Эскалация при неуверенности > 0.8',false],['Интеграция с МИС без дублей записи',false],['Регистратура видит каждый диалог',false]],
      paidLbl:'старт оплачен · 30%',
      artifacts:[ ['📄','Архитектурный документ','toast','утверждён на воротах 1'] ] }),
  ]});
}
function forgeProject(id){ return forgeStore().projects.find(p => p.id === id); }
function fgStageLabel(p){
  if (p.status === 'done') return 'сдан · акт подписан';
  if (p.status === 'gate') return '⏸ ждёт ваших ворот: ' + FG_GATES[FG_STAGES[p.stage].id].title;
  return FG_STAGES[p.stage].label + ' · ' + p.prog[p.stage] + '%';
}
function fgOverall(p){ return Math.round(p.prog.reduce((a, b) => a + b, 0) / 4); }

/* создать заказ из шаблона */
function fgOrder(tplId, withOpts){
  const t = FG_TEMPLATES.find(x => x.id === tplId); if (!t) return null;
  const S = forgeStore();
  const k = (withOpts && withOpts.complex) || 1;
  const price = Math.round(t.price * k / 1000) * 1000;
  /* бригада из пула Talent по ролям шаблона — с репутацией */
  const cat = talentCatalog();
  const busy = new Set(S.projects.filter(p => p.status !== 'done').flatMap(p => p.crew));
  const crew = t.roles.map(r => { const pool = cat.filter(a => a.role === r && !busy.has(a.id)).sort((a, b) => b.rating - a.rating);
    const pick = pool[0] || cat.find(a => a.role === r); busy.add(pick.id); return pick.id; });
  const p = { id:'fp-' + (++S.seq) + '-' + tplId, tpl:tplId, icon:t.icon, title:t.title,
    price, status:'run', stage:0, prog:[0,0,0,0], crew,
    what:t.what, crit:t.crit.map(c => [c, false]), artifacts:[], feed:[], gate:null, gateWait:null,
    paidLbl:'старт оплачен · 30%' };
  S.projects.unshift(p);
  pushInvoice('forge', `Forge · «${t.title}» — старт производства (30%)`, Math.round(price * 0.3));
  if (typeof pushAudit === 'function') pushAudit({ who:'CEO · Кирилл', what:`Заказ в Forge: «${t.title}» · фикс-цена ₽${price.toLocaleString('ru')} · бригада из ${crew.length} агентов собрана`, verdict:'allow' });
  return p;
}

/* тик производства: вызывается с экрана (демо-таймлапс) ------------------- */
function fgTick(p){
  if (p.status !== 'run') return null;
  const si = p.stage; const stId = FG_STAGES[si].id;
  p.prog[si] = Math.min(100, p.prog[si] + 6 + Math.floor(Math.random() * 9));
  let ev = null;
  if (Math.random() < 0.75){
    const pool = FG_FEED[stId];
    ev = pool[Math.floor(Math.random() * pool.length)]
      .replace('{n}', 1 + Math.floor(Math.random() * 14))
      .replace('{t}', 120 + Math.floor(Math.random() * 140))
      .replace('{c}', (p.crit[Math.floor(Math.random() * p.crit.length)] || ['—'])[0]);
  }
  /* в тестировании закрываются критерии приёмки */
  if (stId === 'test'){ const open = p.crit.filter(c => !c[1]);
    if (open.length && Math.random() < 0.5){ open[0][1] = true; ev = 'критерий «' + open[0][0] + '» подтверждён замером ✓'; } }
  if (p.prog[si] >= 100){
    if (stId === 'accept'){ p.status = 'done'; ev = 'артефакты упакованы — проект готов к передаче'; }
    else { p.status = 'gate'; p.gate = { stage: stId, timerMin: 6 * 60 }; ev = 'станция завершена — ' + FG_GATES[stId].title.toLowerCase() + ' ждут вашего решения'; }
  }
  return ev;
}
/* решение на воротах */
function fgGate(p, approve, comment){
  if (p.status !== 'gate' || !p.gate) return;
  const stId = p.gate.stage;
  if (approve){
    if (stId === 'build') pushInvoice('forge', `Forge · «${p.title}» — этап демо принят (40%)`, Math.round(p.price * 0.4));
    if (stId === 'test'){ pushInvoice('forge', `Forge · «${p.title}» — финальная приёмка (30%)`, Math.round(p.price * 0.3));
      p.crit.forEach(c => c[1] = true); p.status = 'done'; p.stage = 3; p.prog = [100,100,100,100]; p.gate = null;
      if (typeof pushAudit === 'function') pushAudit({ who:'CEO · Кирилл', what:`Forge: подписан акт приёмки «${p.title}»`, verdict:'allow' });
      return 'акт подписан · артефакты переданы · песочница будет стёрта по TTL'; }
    p.stage += 1; p.status = 'run'; p.gate = null;
    if (stId === 'design' && !p.artifacts.some(a => a[1].indexOf('Архитектурный') === 0))
      p.artifacts.unshift(['📄','Архитектурный документ','toast','утверждён вами на воротах 1']);
    if (typeof pushAudit === 'function') pushAudit({ who:'CEO · Кирилл', what:`Forge: ворота утверждены («${p.title}» → ${FG_STAGES[p.stage].label})`, verdict:'allow' });
    return 'ворота открыты — бригада продолжает автономно';
  }
  /* возврат с комментарием: видимая переработка */
  p.status = 'run'; p.gate = null; p.prog[p.stage] = Math.max(35, p.prog[p.stage] - 45);
  if (typeof pushAudit === 'function') pushAudit({ who:'CEO · Кирилл', what:`Forge: возврат с ворот («${p.title}»): ${comment || 'без комментария'}`, verdict:'deny' });
  return 'возвращено в работу с вашим комментарием — бригада перерабатывает';
}
