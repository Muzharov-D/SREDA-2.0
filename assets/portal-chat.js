/* ========================================================================== */
/*  PORTAL-CHAT — экран «Сотрудники»: привычные каналы связи с агентами       */
/*  Слева — контакты (как в мессенджере), справа — тред: Чат (Telegram-стиль) */
/*  и Почта (email-тред). Работает с API /api/messages, при его отсутствии — */
/*  локальный режим с симуляцией ответов агента.                              */
/*  Зависимости (доступны на момент вызова): $, el, toast, escHtml,           */
/*  portalState, renderPortalNav, renderPortalStage (portal-app.js);          */
/*  talentStore, talentAgent, tlContractOf, TL_ROLES, pushInvoice (talent.js) */
/* ========================================================================== */

const PC_POLL_MS = 1500;          /* интервал поллинга API, мс */
const PC_TYPE_MS = 14;            /* скорость посимвольной печати, мс/символ */
const PC_REPLY_DELAY_MS = 1600;   /* локальный режим: задержка ответа агента */
const PC_ARTIFACT_MIN_MS = 6000;  /* локальный режим: артефакт через 6-8 с */
const PC_ARTIFACT_SPREAD_MS = 2000;

const PC_DEPT_C = { dev:'#60a5fa', analytics:'#2dd4bf', finance:'#f0c34d', legal:'#c084fc' };

/* что приносит агент каждой роли: [заголовок артефакта, состав] */
const PC_ART = {
  backend:  ['Рабочий код + тесты',      'эндпоинты · тесты · README'],
  data:     ['Аналитический отчёт',      'выводы · графики · выгрузка данных'],
  qa:       ['Набор тест-кейсов',        'кейсы по приоритетам · авто-сценарии'],
  bi:       ['Дашборд',                  'витрина · метрики · алерты'],
  devops:   ['Настроенный пайплайн',     'CI/CD · мониторинг · документация'],
  product:  ['Продуктовый разбор',       'гипотезы · срезы · рекомендация'],
  finmodel: ['Финансовая модель',        'сценарии · чувствительность · выводы'],
  legalast: ['Юридическое заключение',   'риски · правки · протокол разногласий'],
};

const pcView = { contact:null, tab:'chat', mobileThread:false };
let _pcPoll = null;        /* таймер поллинга — чистится при уходе с экрана */
let _pcApiOk = null;       /* null = не проверяли, true/false после 1-го fetch */

/* ── хранилище тредов ── */
function pcStore(){
  if (window.__PCHAT) return window.__PCHAT;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('sreda_pchat') || 'null'); } catch(e){}
  if (saved && saved.threads && saved.seq) return (window.__PCHAT = saved);
  return (window.__PCHAT = pcSeed());
}
function pcPersist(){
  try { localStorage.setItem('sreda_pchat', JSON.stringify(window.__PCHAT || null)); } catch(e){}
}
function pcThread(aid){
  const S = pcStore();
  if (!S.threads[aid]) S.threads[aid] = { msgs:[], unread:0, busy:false, cursor:0 };
  return S.threads[aid];
}
function pcNextId(){ return ++pcStore().seq; }
function pcUnreadTotal(){
  if (!window.__PCHAT) pcStore();
  return Object.values(pcStore().threads).reduce((a, t) => a + (t.unread || 0), 0);
}

/* ── сидовый диалог Дарьи Спектр (преднанятый аналитик tl-da-02) ── */
function pcSeed(){
  let id = 0;
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const ch = 'tg:tl-da-02', em = 'email:tl-da-02';
  const msgs = [
    { id:++id, channel:ch, who:'system', kind:'status', text:'Контракт активен · Дарья Спектр в штате · подписка, месяц 2', meta:null, created_at:ago(4320) },
    { id:++id, channel:ch, who:'client', kind:'chat', text:'Дарья, нужна RFM-сегментация базы за последние 6 месяцев. Хочу понять, кого будим реактивацией. Срок — четверг.', meta:null, created_at:ago(4310) },
    { id:++id, channel:ch, who:'agent', kind:'chat', text:'Принято! Уточнение: тестовых и оптовых клиентов исключаю, сегментирую по 9 ячейкам R×F×M. К четвергу к 12:00 будет готово вместе с триггерами реактивации.', meta:null, created_at:ago(4305) },
    { id:++id, channel:ch, who:'agent', kind:'artifact', text:'Готово! Результат по задаче — во вложении.',
      meta:{ title:'RFM-сегментация клиентской базы', desc:'9 сегментов · 3 триггера реактивации · выгрузка в CRM', price:2800, accepted:true }, created_at:ago(2950) },
    { id:++id, channel:ch, who:'client', kind:'chat', text:'Принял. Сегмент «спящие киты» — давайте по ним отдельную кампанию.', meta:null, created_at:ago(2940) },
    { id:++id, channel:ch, who:'agent', kind:'chat', text:'Отличная идея — посчитала: 1 240 клиентов, средний чек ×2.3 к базе. Драфт кампании пришлю в понедельник в почту.', meta:null, created_at:ago(2930) },
    { id:++id, channel:em, who:'agent', kind:'email',
      text:'Добрый день!\n\nСводка по e-commerce за неделю 23:\n· Выручка: ₽4.82 млн (+6.2% к нед. 22)\n· Конверсия: 3.4% (+0.2 п.п.)\n· Повторные покупки: 18.3% (+1.1 п.п. — сработали RFM-триггеры)\n· Средний чек: ₽2 540 (−1.8%)\n\nРиск: падение среднего чека в категории «аксессуары» — копаю, детали в четверг.\n\nПолная сводка в дашборде, вкладка «Неделя».\n— Дарья Спектр, аналитик данных',
      meta:{ subject:'Еженедельная сводка · неделя 23' }, created_at:ago(1500) },
    { id:++id, channel:em, who:'system', kind:'email',
      text:'Счёт за подписку на цифрового сотрудника:\n\nДарья Спектр · Аналитик данных · Middle+\nПериод: месяц 2\nСумма: ₽47 000\nСтатус: оплачен ✓\n\nПринятых задач за период: 31 · приёмка с 1-й подачи 93%.\nДетализация — в разделе «Счета».\n— Биллинг Платформы Среды',
      meta:{ subject:'Счёт № SR-1142 · подписка, месяц 2 — ₽47 000' }, created_at:ago(700) },
  ];
  return { seq:id, threads:{ 'tl-da-02': { msgs, unread:0, busy:false, cursor:0 } } };
}

/* ── вспомогательные ── */
function pcColor(a){
  const R = (typeof TL_ROLES !== 'undefined') ? TL_ROLES[a.role] : null;
  return PC_DEPT_C[R ? R.dept : ''] || 'var(--teal)';
}
function pcAv(a, big){
  return `<span class="hex-av ${big ? 'big' : ''}" style="--c:${pcColor(a)}">${escHtml(a.name[0])}</span>`;
}
function pcTime(iso){
  try { return new Date(iso).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' }); } catch(e){ return ''; }
}
function pcDate(iso){
  try { return new Date(iso).toLocaleDateString('ru', { day:'numeric', month:'short' }) + ', ' + pcTime(iso); } catch(e){ return ''; }
}
function pcFirstName(a){ return a.name.split(' ')[0]; }
function pcRoleLbl(a){
  const R = (typeof TL_ROLES !== 'undefined') ? TL_ROLES[a.role] : null;
  return R ? R.label : a.role;
}

/* посимвольная печать с кареткой (.streaming уже есть в styles.css);
   уважает prefers-reduced-motion — движущийся текст триггерит вестибулярные
   проблемы, поэтому при reduce выводим полный текст сразу, без интервала */
function pcTypeInto(node, text, scroller, onDone){
  if (!node) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce){
    node.textContent = text;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    if (typeof onDone === 'function') onDone();
    return;
  }
  node.classList.add('streaming');
  let i = 0;
  const t = setInterval(() => {
    i++;
    node.textContent = text.slice(0, i);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    if (i >= text.length){ clearInterval(t); node.classList.remove('streaming'); if (typeof onDone === 'function') onDone(); }
  }, PC_TYPE_MS);
}

/* ── API: первичная загрузка треда + поллинг с after-курсором ── */
async function pcApiLoad(aid){
  try {
    const [tg, em] = await Promise.all([
      apiGet('/messages?channel=' + encodeURIComponent('tg:' + aid)),
      apiGet('/messages?channel=' + encodeURIComponent('email:' + aid)),
    ]);
    const items = [ ...((tg && tg.items) || []), ...((em && em.items) || []) ];
    _pcApiOk = true;
    if (items.length){
      const th = pcThread(aid);
      th.msgs = items;
      th.cursor = items.reduce((m, x) => Math.max(m, +x.id || 0), 0);
      pcPersist();
    }
  } catch(e){ _pcApiOk = false; }
}

function pcStartPoll(aid){
  pcStopPoll();
  if (_pcApiOk !== true) return;
  _pcPoll = setInterval(async () => {
    try {
      const th = pcThread(aid);
      const r = await apiGet('/messages?channel=' + encodeURIComponent('tg:' + aid) + '&after=' + (th.cursor || 0));
      const items = (r && r.items) || [];
      if (!items.length) return;
      items.forEach(m => { if (!th.msgs.some(x => x.id === m.id)) th.msgs.push(m); });
      th.cursor = items.reduce((m, x) => Math.max(m, +x.id || 0), th.cursor || 0);
      th.busy = false;
      pcHideTyping();
      pcRenderMsgs();
      pcRefreshContacts();
      pcPersist();
    } catch(e){ /* тихий фолбэк: следующая попытка через интервал */ }
  }, PC_POLL_MS);
}
function pcStopPoll(){ if (_pcPoll){ clearInterval(_pcPoll); _pcPoll = null; } }
/* вызывается из renderPortalStage перед сменой экрана */
function pcTeardown(){ pcStopPoll(); }

/* ── ЭКРАН «Сотрудники» ── */
function renderTeam(root){
  const hired = (typeof talentStore === 'function' ? talentStore().hired : []).filter(h => h.status === 'active');
  if (!hired.length){
    root.innerHTML = portalHead('💬','Сотрудники','Чат и почта с вашими цифровыми сотрудниками — как с обычными коллегами') + `
      <div class="panel pc-empty">
        <div class="pc-empty-ic">💬</div>
        <h2>Наймите первого сотрудника</h2>
        <p>Нанятые агенты появятся здесь — пишите им в чат, ставьте задачи и принимайте результаты, как с обычными коллегами.</p>
        <button class="btn go" id="pcGoCat">Открыть каталог →</button>
      </div>`;
    $('#pcGoCat', root).onclick = () => { portalState.screen = 'catalog'; renderPortalNav(); renderPortalStage(); };
    return;
  }
  if (!pcView.contact || !hired.some(h => h.aid === pcView.contact)) pcView.contact = hired[0].aid;

  root.innerHTML = portalHead('💬','Сотрудники','Чат и почта с вашими цифровыми сотрудниками — как с обычными коллегами') + `
    <div class="pc-connect">
      <span class="pc-connect-ic">🔌</span>
      <div class="pc-connect-t"><b>Привычные каналы</b><small>Подключите сотрудников в свой Telegram и Email — диалоги синхронизируются</small></div>
      <button class="btn ghost" id="pcConnect">Подключить в свой Telegram / Email</button>
    </div>
    <div class="pc-wrap ${pcView.mobileThread ? 'thread-open' : ''}" id="pcWrap">
      <div class="pc-contacts" id="pcContacts"></div>
      <div class="pc-thread" id="pcThread"></div>
    </div>`;

  $('#pcConnect', root).onclick = pcConnectModal;
  pcRefreshContacts();
  pcRenderThread();
}

/* список контактов — обновляется без перерендера всего экрана */
function pcRefreshContacts(){
  const box = $('#pcContacts'); if (!box) return;
  const hired = (typeof talentStore === 'function' ? talentStore().hired : []).filter(h => h.status === 'active');
  const rows = hired.map(h => {
    const a = talentAgent(h.aid); if (!a) return null;
    const th = pcThread(h.aid);
    const chat = th.msgs.filter(m => m.kind !== 'email');
    const last = chat[chat.length - 1];
    return { h, a, th, last, ts: last ? Date.parse(last.created_at) || 0 : 0 };
  }).filter(Boolean).sort((x, y) => y.ts - x.ts);

  box.innerHTML = rows.map(({ h, a, th, last }) => {
    const preview = last ? (last.kind === 'artifact' ? '📎 ' + (last.meta && last.meta.title || 'вложение') : last.text) : 'нет сообщений';
    const short = preview.length > 42 ? preview.slice(0, 42) + '…' : preview;
    return `<div class="pc-contact ${pcView.contact === h.aid ? 'active' : ''}" data-aid="${h.aid}">
      ${pcAv(a)}
      <div class="pc-c-info">
        <div class="pc-c-top"><b>${escHtml(a.name)}</b><span class="pc-c-time">${last ? pcTime(last.created_at) : ''}</span></div>
        <div class="pc-c-sub"><span class="pc-dot ${th.busy ? 'busy' : ''}"></span>${th.busy ? 'на задаче' : 'в сети'} · ${escHtml(pcRoleLbl(a))}</div>
        <div class="pc-c-last">${escHtml(short)}${th.unread ? `<span class="pc-c-badge">${th.unread}</span>` : ''}</div>
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('.pc-contact').forEach(c => c.onclick = () => {
    pcView.contact = c.dataset.aid;
    pcView.tab = 'chat';
    pcView.mobileThread = true;
    const wrap = $('#pcWrap'); if (wrap) wrap.classList.add('thread-open');
    pcRefreshContacts();
    pcRenderThread();
  });
}

/* правая колонка: шапка + вкладки + тело */
function pcRenderThread(){
  const pane = $('#pcThread'); if (!pane) return;
  const aid = pcView.contact;
  const a = talentAgent(aid); if (!a){ pane.innerHTML = ''; return; }
  const th = pcThread(aid);
  const c = (typeof tlContractOf === 'function') ? tlContractOf(aid) : null;
  const modeLbl = c ? (c.mode === 'staff' ? 'в штате' : 'за результат') : 'контракт завершён';
  const mails = th.msgs.filter(m => m.kind === 'email');

  th.unread = 0;
  if (typeof renderPortalNav === 'function') renderPortalNav();

  pane.innerHTML = `
    <div class="pc-th-head">
      <button class="pc-back" id="pcBack" title="К списку">←</button>
      ${pcAv(a)}
      <div class="pc-th-info">
        <b>${escHtml(a.name)}</b>
        <small><span class="pc-dot ${th.busy ? 'busy' : ''}"></span>${th.busy ? 'на задаче' : 'в сети'} · ${escHtml(pcRoleLbl(a))} · ${modeLbl}</small>
      </div>
      <div class="pc-tabs">
        <button class="pc-tab ${pcView.tab === 'chat' ? 'active' : ''}" data-tab="chat">💬 Чат</button>
        <button class="pc-tab ${pcView.tab === 'mail' ? 'active' : ''}" data-tab="mail">✉️ Почта${mails.length ? ` <i>${mails.length}</i>` : ''}</button>
      </div>
    </div>
    ${pcView.tab === 'chat' ? `
      <div class="ch-msgs" id="pcMsgs"></div>
      <div class="ch-composer">
        <input class="ch-input" id="pcInput" placeholder="Сообщение или задача для ${escHtml(pcFirstName(a))}… (Enter — отправить)"/>
        <button class="ch-send" id="pcSendBtn">➤</button>
      </div>` : `
      <div class="pc-mail" id="pcMail"></div>`}
  `;

  $('#pcBack', pane).onclick = () => {
    pcView.mobileThread = false;
    const wrap = $('#pcWrap'); if (wrap) wrap.classList.remove('thread-open');
  };
  pane.querySelectorAll('.pc-tab').forEach(t => t.onclick = () => { pcView.tab = t.dataset.tab; pcRenderThread(); });

  if (pcView.tab === 'chat'){
    const input = $('#pcInput', pane), send = $('#pcSendBtn', pane);
    const doSend = () => {
      const v = input.value.trim();
      if (!v){ toast('Напишите сообщение или задачу'); return; }
      input.value = '';
      pcSend(aid, v);
    };
    send.onclick = doSend;
    input.onkeydown = (e) => { if (e.key === 'Enter'){ e.preventDefault(); doSend(); } };
    /* API: первая загрузка определяет режим; повторные заходы — сразу поллинг.
       Пока GET /messages не вернулся (режим ещё неизвестен) и тред пуст —
       показываем скелетон вместо пустоты/прыжка; иначе сразу рендерим. */
    const th0 = pcThread(aid);
    if (_pcApiOk === null && !th0.msgs.length){
      pcRenderSkeleton();
      pcApiLoad(aid).then(() => { pcRenderMsgs(); pcStartPoll(aid); });
    } else if (_pcApiOk === null){
      pcRenderMsgs();
      pcApiLoad(aid).then(() => { pcRenderMsgs(); pcStartPoll(aid); });
    } else {
      pcRenderMsgs();
      if (_pcApiOk === true) pcStartPoll(aid);
    }
  } else {
    pcRenderMail(mails, a);
  }
  pcPersist();
}

/* ── сообщения чата ── */
function pcMsgHTML(m, a){
  if (m.who === 'system' || m.kind === 'status'){
    return `<div class="ch-msg system"><div class="pc-sys">${escHtml(m.text)}</div></div>`;
  }
  const own = m.who === 'client';
  const av = own ? `<span class="pc-me-av">Вы</span>` : pcAv(a);
  const name = own ? 'Вы' : escHtml(a.name);
  const tag = own ? '' : `<span class="ch-msg-tag agent-tag">агент Среды</span>`;
  let body = `<div class="ch-msg-t" data-mid="${m.id}">${escHtml(m.text)}</div>`;
  if (m.kind === 'artifact'){
    const mt = m.meta || {};
    const state = mt.accepted
      ? `<span class="pc-art-state ok">✓ Принят · счёт выставлен</span>`
      : mt.returned
        ? `<span class="pc-art-state ret">↩ Возвращён на доработку</span>`
        : `<div class="pc-art-actions">
             <button class="btn go pc-art-ok" data-mid="${m.id}">✓ Принять</button>
             <button class="btn ghost pc-art-no" data-mid="${m.id}">↩ Вернуть</button>
           </div>`;
    body += `<div class="pc-art">
      <div class="pc-art-h"><span class="pc-art-ic">📎</span><div><b>${escHtml(mt.title || 'Артефакт')}</b><small>${escHtml(mt.desc || '')}</small></div></div>
      ${mt.price ? `<div class="pc-art-price">к оплате при приёмке: <b>₽${(+mt.price).toLocaleString('ru')}</b></div>` : ''}
      ${state}
    </div>`;
  }
  return `<div class="ch-msg ${own ? 'pc-own' : 'agent'}">
    <span class="ch-msg-av pc-av-slot">${av}</span>
    <div class="ch-msg-body">
      <div class="ch-msg-h"><b>${name}</b>${tag}<span class="pc-msg-time">${pcTime(m.created_at)}</span></div>
      ${body}
    </div>
  </div>`;
}

function pcRenderMsgs(streamId){
  const box = $('#pcMsgs'); if (!box) return;
  const aid = pcView.contact;
  const a = talentAgent(aid); if (!a) return;
  const th = pcThread(aid);
  const msgs = th.msgs.filter(m => m.kind !== 'email');
  box.innerHTML = msgs.map(m => pcMsgHTML(m, a)).join('') || '<div class="pc-sys" style="margin:auto">Начните диалог — опишите задачу</div>';
  box.scrollTop = box.scrollHeight;

  box.querySelectorAll('.pc-art-ok').forEach(b => b.onclick = () => pcAccept(aid, +b.dataset.mid || b.dataset.mid));
  box.querySelectorAll('.pc-art-no').forEach(b => b.onclick = () => pcReturn(aid, +b.dataset.mid || b.dataset.mid));

  if (streamId != null){
    const node = box.querySelector(`.ch-msg-t[data-mid="${streamId}"]`);
    const m = msgs.find(x => String(x.id) === String(streamId));
    if (node && m){ node.textContent = ''; pcTypeInto(node, m.text, box); }
  }
}

/* скелетон-плейсхолдер на время первого реального API-фетча треда */
function pcRenderSkeleton(){
  const box = $('#pcMsgs'); if (!box) return;
  box.innerHTML = `
    <div class="pc-skel-row"><span class="pc-skel-bub w55"></span></div>
    <div class="pc-skel-row own"><span class="pc-skel-bub w40"></span></div>
    <div class="pc-skel-row"><span class="pc-skel-bub w70"></span></div>`;
}

/* индикатор «печатает…» */
function pcShowTyping(aid){
  if (pcView.contact !== aid) return;
  const box = $('#pcMsgs'); if (!box || $('#pcTyping')) return;
  const a = talentAgent(aid); if (!a) return;
  box.insertAdjacentHTML('beforeend', `<div class="ch-msg agent" id="pcTyping">
    <span class="ch-msg-av pc-av-slot">${pcAv(a)}</span>
    <div class="ch-msg-body"><div class="pc-typing">${escHtml(pcFirstName(a))} печатает<i>.</i><i>.</i><i>.</i></div></div>
  </div>`);
  box.scrollTop = box.scrollHeight;
}
function pcHideTyping(){ const t = $('#pcTyping'); if (t) t.remove(); }

/* добавить сообщение агента/системы; вне экрана — копится в «непрочитанные» */
function pcPushAgent(aid, kind, text, meta, stream){
  const th = pcThread(aid);
  const m = { id:pcNextId(), channel:'tg:' + aid, who: kind === 'status' ? 'system' : 'agent',
    kind, text, meta: meta || null, created_at: new Date().toISOString() };
  th.msgs.push(m);
  const onScreen = (typeof portalState !== 'undefined') && portalState.screen === 'team' && pcView.contact === aid && $('#pcMsgs');
  if (onScreen){
    pcRenderMsgs(stream ? m.id : null);
  } else if (kind !== 'status'){
    th.unread = (th.unread || 0) + 1;
  }
  pcRefreshContacts();
  if (typeof renderPortalNav === 'function') renderPortalNav();
  pcPersist();
  return m;
}

/* ── отправка: клиентский пузырь → API или локальная симуляция ── */
async function pcSend(aid, text){
  const th = pcThread(aid);
  const local = { id:pcNextId(), channel:'tg:' + aid, who:'client', kind:'chat', text, meta:null, created_at:new Date().toISOString() };
  th.msgs.push(local);
  pcRenderMsgs();
  pcRefreshContacts();
  pcPersist();

  if (_pcApiOk === true){
    try {
      const r = await apiPost('/messages', { channel:'tg:' + aid, text });
      /* сервер вернул то же сообщение со своим id — выравниваем локальный пузырь
         и двигаем курсор, иначе поллинг притащит эхо-дубль клиентской реплики */
      const srv = r && r.message;
      if (srv && srv.id != null){
        local.id = srv.id;
        if (srv.created_at) local.created_at = srv.created_at;
        th.cursor = Math.max(th.cursor || 0, +srv.id || 0);
        pcPersist();
      }
      th.busy = true;
      pcRefreshContacts();
      const eta = (r && r.agentReply && r.agentReply.etaMs) || 2500;
      setTimeout(() => pcShowTyping(aid), 400);
      setTimeout(() => pcHideTyping(), eta + 6000); /* страховка, если поллинг молчит */
      return;
    } catch(e){
      /* доставка в API-режиме не прошла — сообщаем юзеру, а не молчим */
      if (typeof toast === 'function') toast('Не удалось отправить — попробуйте ещё раз');
      _pcApiOk = false; /* падаем в локальный режим */
    }
  }
  pcSimReply(aid, text);
}

/* ── локальный режим: симуляция ответа агента ── */
function pcSimReply(aid, userText){
  const a = talentAgent(aid); if (!a) return;
  const th = pcThread(aid);
  const isRevision = /^Вернул на доработку/i.test(userText);
  const short = userText.length > 64 ? userText.slice(0, 64) + '…' : userText;
  const ack = isRevision
    ? 'Принято, замечания вижу. Исправлю и пришлю обновлённую версию — кнопки приёмки будут под ней.'
    : `Принято, беру в работу: «${short}». Вернусь с результатом во вложении — кнопки приёмки будут под ним.`;

  th.busy = true;
  pcRefreshContacts();
  setTimeout(() => pcShowTyping(aid), 500);
  setTimeout(() => { pcHideTyping(); pcPushAgent(aid, 'chat', ack, null, true); }, PC_REPLY_DELAY_MS);

  const art = PC_ART[a.role] || ['Результат задачи', 'материалы · выводы · следующие шаги'];
  const delay = PC_ARTIFACT_MIN_MS + Math.random() * PC_ARTIFACT_SPREAD_MS;
  setTimeout(() => {
    pcHideTyping();
    th.busy = false;
    pcPushAgent(aid, 'artifact', isRevision ? 'Обновлённая версия готова — учёл(ла) замечания, вложение ниже.' : 'Готово! Результат по задаче — во вложении.', {
      title: art[0] + (isRevision ? ' · v2' : ''),
      desc: art[1],
      price: a.priceTask || 2500,
      task: short,
    });
  }, delay);
}

/* ── приёмка артефакта: счёт + благодарность агента ── */
async function pcAccept(aid, msgId){
  const th = pcThread(aid);
  const m = th.msgs.find(x => String(x.id) === String(msgId));
  if (!m || (m.meta && m.meta.accepted)) return;
  let inv = null;
  if (_pcApiOk === true){
    try { const r = await apiPost('/messages/' + msgId + '/accept', {}); inv = (r && r.invoice) || null; }
    catch(e){ /* локальный счёт ниже */ }
  }
  m.meta = { ...(m.meta || {}), accepted:true, returned:false };
  const a = talentAgent(aid);
  if (typeof pushInvoice === 'function'){
    if (inv) pushInvoice(inv.kind || 'task', inv.title, inv.amount);
    else pushInvoice('task', `Talent · ${a.name} — «${(m.meta.title || 'результат')}» (принят)`, m.meta.price || a.priceTask || 0);
  }
  toast('Результат принят · счёт выставлен');
  pcRenderMsgs();
  pcPersist();
  setTimeout(() => pcPushAgent(aid, 'chat', 'Спасибо за приёмку! На связи — готов(а) взять следующую задачу.'), 1400);
}

/* ── возврат на доработку: комментарий из композера или дефолтный ── */
function pcReturn(aid, msgId){
  const th = pcThread(aid);
  const m = th.msgs.find(x => String(x.id) === String(msgId));
  if (!m || (m.meta && (m.meta.accepted || m.meta.returned))) return;
  m.meta = { ...(m.meta || {}), returned:true };
  /* фиксируем возврат на сервере, иначе после F5 кнопки приёмки вернутся */
  if (_pcApiOk === true){
    apiPost('/messages/' + msgId + '/return', {}).catch(() => {});
  }
  const input = $('#pcInput');
  const cmt = (input && input.value.trim()) || 'нужны уточнения, детали обсудим в чате';
  if (input) input.value = '';
  pcRenderMsgs();
  pcSend(aid, 'Вернул на доработку: ' + cmt);
}

/* ── почта ── */
function pcRenderMail(mails, a){
  const box = $('#pcMail'); if (!box) return;
  if (!mails.length){
    box.innerHTML = `<div class="pc-sys" style="margin:auto">Писем пока нет — еженедельные отчёты и счета будут приходить сюда</div>`;
    return;
  }
  const sorted = [...mails].sort((x, y) => (Date.parse(y.created_at) || 0) - (Date.parse(x.created_at) || 0));
  box.innerHTML = sorted.map(m => {
    const from = m.who === 'system'
      ? 'Биллинг Платформы Среды &lt;billing@sreda.app&gt;'
      : `${escHtml(a.name)} &lt;${a.id}@sreda.app&gt;`;
    return `<div class="pc-mail-item">
      <div class="pc-mail-su">✉️ ${escHtml((m.meta && m.meta.subject) || 'Без темы')}</div>
      <div class="pc-mail-meta">от: ${from} · ${pcDate(m.created_at)}</div>
      <div class="pc-mail-body">${escHtml(m.text)}</div>
    </div>`;
  }).join('');
}

/* ── после найма: редирект в чат + приветствие нового сотрудника ── */
function pcAfterHire(aid){
  const a = talentAgent(aid); if (!a) return;
  const th = pcThread(aid);
  const hasAgentMsg = th.msgs.some(m => m.who === 'agent');
  if (!th.msgs.length){
    th.msgs.push({ id:pcNextId(), channel:'tg:' + aid, who:'system', kind:'status',
      text:'Контракт подписан · контактная поверхность установлена', meta:null, created_at:new Date().toISOString() });
  }
  th.unread = 0;
  pcView.contact = aid; pcView.tab = 'chat'; pcView.mobileThread = true;
  portalState.screen = 'team'; portalState.selectedAgent = null;
  renderPortalNav(); renderPortalStage();
  if (!hasAgentMsg){
    const hello = `Здравствуйте! Я ${a.name}, ${pcRoleLbl(a).toLowerCase()} (${a.grade}). Уже на связи — здесь, в Telegram и по почте. Опишите первую задачу прямо в чате: беру в работу сразу, результат пришлю вложением с кнопками приёмки.`;
    setTimeout(() => pcShowTyping(aid), 800);
    setTimeout(() => { pcHideTyping(); pcPushAgent(aid, 'chat', hello, null, true); }, 2200);
  }
  pcPersist();
}

/* переход в чат конкретного агента (с карточки агента) */
function pcGoToChat(aid, tab){
  pcView.contact = aid; pcView.tab = tab || 'chat'; pcView.mobileThread = true;
  portalState.screen = 'team'; portalState.selectedAgent = null;
  renderPortalNav(); renderPortalStage();
}

/* ── мок-модалка «Подключить в свой Telegram / Email» ── */
function pcConnectModal(){
  const ov = el(`<div class="overlay show">
    <div class="modal">
      <div class="modal-head"><h2>🔌 Подключение каналов</h2></div>
      <p>Диалоги с сотрудниками синхронизируются: отвечайте там, где удобно — история одна.</p>
      <div class="pc-steps">
        <div class="pc-steps-col">
          <b>📨 Telegram</b>
          <ol>
            <li>Откройте бота <b>@SredaWorkBot</b></li>
            <li>Отправьте код подключения <code>SRD-4F2A-9K</code></li>
            <li>Диалоги сотрудников появятся в Telegram — отвечайте как обычно</li>
          </ol>
        </div>
        <div class="pc-steps-col">
          <b>✉️ Email</b>
          <ol>
            <li>Добавьте <b>team@sreda.app</b> в контакты</li>
            <li>Подтвердите ящик по ссылке из письма</li>
            <li>Отчёты, счета и треды будут приходить в вашу почту</li>
          </ol>
        </div>
      </div>
      <div class="row">
        <button class="btn ghost" id="pccClose">Закрыть</button>
        <button class="btn go" id="pccDone">Готово ✓</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('#pccClose').onclick = close;
  ov.querySelector('#pccDone').onclick = () => { close(); toast('Запрос на подключение отправлен — каналы активируются (демо)'); };
}
