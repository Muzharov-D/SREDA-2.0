/* ========================================================================== */
/*  KAM-PULSE — «Пульс Я»: рабочее место, которое ВЕДЁТ день сотрудника.       */
/*  Вертикальный срез концепции (см. concept-interface-v1.md):                 */
/*   • Пульс = утренний вывод личного помощника (pull → push)                  */
/*   • Три высоты: Я / Отдел / Компания (модель контекстов)                    */
/*   • Подсветка = точки участия человека (🔴 блок на тебе / 🟡 вопрос к тебе) */
/*   • Разбор Zoom → кандидаты в задачи (ничего не создаётся молча)            */
/*  Протагонист среза — Вячеслав (глава департамента KAM). Только при ?org=kam. */
/* ========================================================================== */
(function(){
  'use strict';
  if (!window.__ORG_KAM) return;

  /* ── протагонист и его цифровой штат (реальные данные org-kam.js) ── */
  /* мультипользовательский демо-стенд: три руководителя со своей спецификой */
  const USERS = {
    mgmt: { id:'mgmt', first:'Вячеслав', full:'Вячеслав Закусилов', role:'Глава департамента KAM',            dept:'mgmt', av:'🏛️' },
    dev:  { id:'dev',  first:'Виктор',   full:'Виктор Рахманов',    role:'Глава направления Авандок.ИИ',        dept:'dev',  av:'🤖' },
    prod: { id:'prod', first:'Василий',  full:'Василий Новиков',    role:'Глава производственного направления', dept:'prod', av:'🏭' },
  };
  const UKEY = 'sreda_kam_user';
  let CURRENT = (function(){ try{ const u=localStorage.getItem(UKEY); return USERS[u]?u:'mgmt'; }catch(e){ return 'mgmt'; } })();
  const hero = () => USERS[CURRENT] || USERS.mgmt;
  /* штат = ростер из конструктора (свои ЦС минус уволенные плюс привлечённые) */
  const myStaff = () => { const ids=staffIds(); return allDigital().filter(w=>ids.indexOf(w.id)>=0); };
  const staffById = (id) => myStaff().find(w=>w.id===id) || null;
  window.__kamUser = hero; /* ассистент берёт текущего пользователя отсюда */
  let greeted = false; /* первый вход за сессию страницы — ассистент печатает приветствие вживую */
  const WD = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const weekday = () => WD[new Date().getDay()];
  const nowHM = () => { const t=new Date(); return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); };

  /* ── стили (scoped, в тон дизайн-системе Среды) ── */
  function injectStyle(){
    if (document.getElementById('mpStyle')) return;
    const s = document.createElement('style'); s.id='mpStyle';
    s.textContent = `
    .mp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:2px 0 18px;flex-wrap:wrap}
    .mp-title h2{font-size:24px;font-weight:700;letter-spacing:-.02em;margin:0}
    .mp-title p{margin:3px 0 0;color:var(--muted);font-size:13px}
    .mp-greet{display:flex;gap:14px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--acc) 24%,transparent);background:var(--acc-soft);border-radius:var(--r);margin:2px 0 14px}
    .mp-greet .av{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--acc-deep),var(--acc));color:var(--on-acc);display:flex;align-items:center;justify-content:center;font-size:15px;flex:none;box-shadow:var(--glow-acc)}
    .mp-greet .who{font-size:12px;color:var(--acc);font-weight:600;margin-bottom:5px;letter-spacing:.03em;text-transform:uppercase}
    .mp-greet .msg{font-size:15px;line-height:1.62;color:var(--txt)}
    .mp-greet .msg.streaming::after{content:'▋';color:var(--acc);margin-left:1px;animation:mpBlink 1s steps(1) infinite}
    @keyframes mpBlink{50%{opacity:0}}
    .mp-metarow{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 4px;flex-wrap:wrap}
    .mp-metarow .meta{color:var(--muted);font-size:13px}
    .mp-userswitch{display:inline-flex;border:1px solid var(--line2);border-radius:var(--r-xs);overflow:hidden;background:var(--panel)}
    .mp-us{border:0;background:transparent;color:var(--muted);padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;transition:var(--transition-fast);border-right:1px solid var(--line2)}
    .mp-us:last-child{border-right:0}
    .mp-us:hover{color:var(--txt2);background:var(--panel-hover)}
    .mp-us.on{background:var(--acc-soft);color:var(--acc);font-weight:600}
    .mp-userrole{color:var(--muted);font-size:13px;margin:0 0 4px}
    .mp-topsw{height:32px;align-self:center}
    .mp-topsw .mp-us{padding:5px 10px;font-size:12.5px}
    /* конструктор рабочего места */
    .mp-cr{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line2);border-radius:var(--r-sm);margin-bottom:8px;background:var(--panel);transition:var(--transition-fast)}
    .mp-cr:hover{border-color:color-mix(in srgb,var(--acc) 26%,transparent)}
    .mp-cr .tt{flex:1;min-width:0}
    .mp-cr .tt b{display:block;color:var(--txt);font-size:14px;font-weight:600;margin-bottom:2px}
    .mp-cr .tt span{display:block;color:var(--muted);font-size:12.5px;line-height:1.45}
    .mp-tg{position:relative;width:42px;height:24px;flex:none;border-radius:999px;border:1px solid var(--line2);background:var(--panel-hover);cursor:pointer;transition:var(--transition-fast);padding:0}
    .mp-tg i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--muted);transition:var(--transition-fast)}
    .mp-tg.on{background:var(--acc-soft);border-color:color-mix(in srgb,var(--acc) 45%,transparent)}
    .mp-tg.on i{left:21px;background:var(--acc)}
    .mp-in{flex:1;min-width:0;background:var(--panel-hover);border:1px solid var(--line2);border-radius:var(--r-xs);color:var(--txt);padding:9px 12px;font-family:inherit;font-size:13.5px;outline:none;transition:var(--transition-fast)}
    .mp-in::placeholder{color:var(--faint)}
    .mp-in:focus{border-color:color-mix(in srgb,var(--acc) 50%,transparent);background:var(--panel)}
    .mp-seg{display:inline-flex;border:1px solid var(--line2);border-radius:var(--r-xs);overflow:hidden;background:var(--panel)}
    .mp-seg-b{border:0;background:transparent;color:var(--muted);padding:7px 16px;font-size:13px;cursor:pointer;font-family:inherit;transition:var(--transition-fast)}
    .mp-seg-b:hover{color:var(--txt2);background:var(--panel-hover)}
    .mp-seg-b.on{background:var(--panel2);color:var(--txt);font-weight:600}
    .mp-seg-b .lk{font-size:11px;opacity:.7;margin-right:3px}
    .mp-segbar{margin:0 0 16px}
    .mp-sec{margin:22px 0 10px;display:flex;align-items:center;gap:9px;color:var(--muted);font-size:12.5px;text-transform:uppercase;letter-spacing:.06em}
    .mp-sec .cnt{font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;letter-spacing:0}
    .mp-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);margin-bottom:8px}
    .mp-row.red{border-left:3px solid var(--red);border-top-left-radius:0;border-bottom-left-radius:0}
    .mp-row.amber{border-left:3px solid var(--amber);border-top-left-radius:0;border-bottom-left-radius:0}
    .mp-pill{font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;white-space:nowrap;flex:none}
    .mp-pill.red{background:color-mix(in srgb,var(--red) 16%,transparent);color:var(--red)}
    .mp-pill.amber{background:color-mix(in srgb,var(--amber) 16%,transparent);color:var(--amber)}
    .mp-txt{flex:1;font-size:14px;color:var(--txt2);min-width:0}
    .mp-btn{border:1px solid var(--line2);background:transparent;color:var(--txt2);border-radius:var(--r-xs);padding:5px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:var(--transition-fast)}
    .mp-btn:hover{border-color:var(--acc);color:var(--acc);background:var(--acc-soft)}
    .mp-time{font-size:14px;font-weight:700;color:var(--txt);flex:none;font-variant-numeric:tabular-nums}
    .mp-emoji{font-size:18px;flex:none}
    .mp-bar{flex:1;height:6px;background:var(--bg3);border-radius:20px;overflow:hidden;min-width:60px}
    .mp-bar>i{display:block;height:100%;background:var(--acc)}
    .mp-pct{font-size:12px;color:var(--muted);flex:none;width:36px;text-align:right;font-variant-numeric:tabular-nums}
    .mp-mb{font-size:11px;color:var(--muted);flex:none}
    .mp-suggest{border:1px solid color-mix(in srgb,var(--acc) 26%,transparent);background:var(--acc-soft)}
    .mp-suggest .mp-txt{color:var(--txt)}
    .mp-asst{display:flex;align-items:center;gap:11px;margin-top:20px;padding:12px 15px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel2);cursor:pointer;transition:var(--transition-fast)}
    .mp-asst:hover{border-color:var(--acc);box-shadow:var(--glow-acc)}
    .mp-asst .ic{font-size:18px}
    .mp-asst .t{flex:1;color:var(--muted);font-size:13px}
    .mp-asst kbd{font-size:11px;border:1px solid var(--line2);border-radius:6px;padding:2px 7px;color:var(--txt2)}
    .mp-empty{padding:16px;border:1px dashed var(--line2);border-radius:var(--r-sm);color:var(--muted);font-size:13px;text-align:center}
    .mp-src{font-size:11.5px;color:var(--faint);margin-top:6px;padding-left:11px;border-left:2px solid var(--line2);font-style:italic}
    .mp-chk{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--acc);background:var(--acc);color:var(--on-acc);display:flex;align-items:center;justify-content:center;font-size:12px;flex:none;cursor:pointer}
    .mp-chk.off{background:transparent;border-color:var(--line3);color:transparent}
    .mp-who{font-size:12px;padding:2px 9px;border-radius:20px;background:var(--acc-soft);color:var(--acc);white-space:nowrap;flex:none;display:inflex}
    .mp-flow{display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-sm);padding:16px 14px}
    .mp-node{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--txt2);text-align:center;flex:none;width:96px}
    .mp-nb{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px}
    .mp-nb.acc{background:var(--acc-soft);border:1px solid color-mix(in srgb,var(--acc) 30%,transparent)}
    .mp-nb.mut{background:var(--bg3);border:1px solid var(--line2);opacity:.85}
    .mp-syn{flex:1;height:2px;position:relative;min-width:24px;border-radius:2px}
    .mp-syn.ok{background:var(--acc)}
    .mp-syn.red{background:var(--red)}
    .mp-syn .lk{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:12px}
    .mp-flowcap{font-size:12.5px;margin:9px 0 0;color:var(--muted)}
    .mp-linkrow{margin-top:16px}
    .mp-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .mp-ask{display:flex;align-items:center;gap:11px;border:1px solid var(--line2);border-radius:var(--r-sm);padding:11px 14px;background:var(--panel);margin:2px 0 16px}
    .mp-catrow{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);margin-bottom:8px;font-size:13px}
    .mp-esc{border:1px solid color-mix(in srgb,var(--acc) 26%,transparent);background:var(--acc-soft);border-radius:var(--r-sm);padding:12px 13px;margin-bottom:9px}
    .mp-escwork{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:10px 12px;background:var(--panel)}
    .mp-row.dashed{border-style:dashed;background:transparent}
    .mp-wctl{margin-left:auto;display:inline-flex;gap:6px;text-transform:none;letter-spacing:0}
    .mp-ic{border:1px solid var(--line2);background:var(--panel);color:var(--txt2);border-radius:6px;padding:2px 8px;font-size:12px;cursor:pointer;font-family:inherit;transition:var(--transition-fast)}
    .mp-ic:hover{border-color:var(--acc);color:var(--acc)}
    .mp-ic.rm:hover{border-color:var(--red);color:var(--red)}
    .mp-ic:disabled{opacity:.35;cursor:default}
    .mp-editing .mp-w.ed{outline:1px dashed var(--line3);outline-offset:6px;border-radius:8px;margin-bottom:16px}
    .mp-addpanel{margin-top:22px;padding:14px 16px;border:1px dashed var(--acc);border-radius:var(--r-sm);background:color-mix(in srgb,var(--acc) 5%,transparent)}
    .mp-doc{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:16px;align-items:start;margin-top:14px}
    .mp-docpane{border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);overflow:hidden;display:flex;flex-direction:column}
    .mp-docpane .hd{padding:11px 13px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px;background:var(--panel2)}
    .mp-docpane .hd b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mp-docpane textarea{width:100%;min-height:440px;border:0;background:transparent;color:var(--txt);font-family:var(--sans);font-size:14px;line-height:1.72;padding:16px 18px;resize:vertical;outline:none}
    .mp-chat{border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);display:flex;flex-direction:column;min-height:490px;max-height:74vh;position:sticky;top:12px}
    .mp-chat-hd{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid var(--line);font-size:13px}
    .mp-chat-hd .av2{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--acc-deep),var(--acc));color:var(--on-acc);display:flex;align-items:center;justify-content:center;font-size:12px}
    .mp-chat .thread{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .mp-b{max-width:90%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}
    .mp-b.u{align-self:flex-end;background:var(--acc-soft);color:var(--txt);border:1px solid color-mix(in srgb,var(--acc) 24%,transparent)}
    .mp-b.a{align-self:flex-start;background:var(--bg3);color:var(--txt)}
    .mp-b.a.streaming::after{content:'▋';color:var(--acc);animation:mpBlink 1s steps(1) infinite}
    .mp-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 13px 10px}
    .mp-chip{border:1px solid var(--line2);background:transparent;color:var(--txt2);border-radius:20px;padding:5px 11px;font-size:12px;cursor:pointer;font-family:inherit;transition:var(--transition-fast)}
    .mp-chip:hover{border-color:var(--acc);color:var(--acc)}
    .mp-chatin{display:flex;gap:8px;padding:11px 13px;border-top:1px solid var(--line)}
    .mp-chatin input{flex:1;background:var(--bg3);border:1px solid var(--line2);border-radius:var(--r-xs);padding:9px 12px;color:var(--txt);font-family:inherit;font-size:13.5px;outline:none}
    .mp-chatin input:focus{border-color:var(--acc)}
    .mp-chatin button{border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);background:var(--acc-soft);color:var(--acc);border-radius:var(--r-xs);padding:0 15px;cursor:pointer;font-family:inherit}
    @media(max-width:820px){.mp-doc{grid-template-columns:1fr}.mp-chat{position:static;max-height:none}}
    @media(max-width:720px){.mp-cols{grid-template-columns:1fr}}
    .mp-theme{width:34px;height:34px;border-radius:9px;border:1px solid var(--line2);background:var(--panel);color:var(--txt2);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:var(--transition-fast)}
    .mp-theme:hover{border-color:var(--acc);color:var(--acc)}
    /* ── Светлая тема (палитра питч-сайта: фиолет #8D61FE на белом) ── */
    :root[data-theme="light"]{
      color-scheme:light;
      --bg:#F6F4FE;--bg2:#EFEBFD;--bg3:#ECE6FE;
      --panel:#FFFFFF;--panel2:#FBFAFF;--panel-hover:#F3EFFE;
      --line:#E7DEFC;--line2:#D9CCFB;--line3:#C9B8F6;
      --txt:#17111F;--txt2:#5B4E7E;--muted:#6E6398;--faint:#8B82A8;
      --acc:#8D61FE;--acc-hover:#7A4CF5;--acc-deep:#6A3AD4;--on-acc:#FFFFFF;
      --vio:#8D61FE;--amber:#B45309;--red:#DC2626;--green:#059669;--blue:#2563EB;--teal:#0D9488;
      --shadow-sm:0 1px 2px rgba(80,60,140,.08);
      --shadow:0 2px 6px rgba(80,60,140,.10),0 1px 2px rgba(80,60,140,.06);
      --shadow-md:0 6px 14px rgba(80,60,140,.12),0 2px 5px rgba(80,60,140,.08);
      --shadow-lg:0 14px 32px rgba(80,60,140,.16),0 4px 10px rgba(80,60,140,.10);
      --shadow-xl:0 24px 56px rgba(80,60,140,.18),0 10px 18px rgba(80,60,140,.12);
      --glow-acc:0 0 0 1px color-mix(in srgb,var(--acc) 24%,transparent),0 0 20px color-mix(in srgb,var(--acc) 12%,transparent);
      background:#F6F4FE!important;
    }
    :root[data-theme="light"] body{background:#F6F4FE}
    `;
    document.head.appendChild(s);
  }

  /* ── переключатель высот (модель контекстов) ── */
  const HEIGHTS = [ ['me','Я','mypulse'], ['dept','Отдел','mypulse-dept'], ['company','Компания','mypulse-co'] ];
  function segHTML(active){
    return `<div class="mp-seg" role="tablist" aria-label="Высота контекста">`+
      HEIGHTS.map(h=>`<button class="mp-seg-b ${h[0]===active?'on':''}" data-h="${h[2]}" role="tab" aria-selected="${h[0]===active}">${h[1]}</button>`).join('')+
      `</div>`;
  }
  function wireSeg(scope){ scope.querySelectorAll('.mp-seg-b').forEach(b=>{ b.onclick=()=>{ if(!b.classList.contains('on')) navTo(b.dataset.h); }; }); }

  /* ── данные под каждого пользователя (своя специфика роли) ── */
  const UDATA = {
    mgmt: {
      day:'На столе — черновик КП для «Гаммы», протокол встречи и недельный дашборд.',
      meet:'2 встречи — брифинг в 09:00 и стратегическая в 14:00',
      zoom:'Из вчерашнего Zoom-звонка «Гамма»: 4 задачи и 1 встреча — кандидаты',
      extra:null,
      waiting:[
        { sev:'red',   tag:'приёмка',  text:'Недельный дашборд собран агентом отчётности — принять', open:'agent-reporting' },
        { sev:'red',   tag:'приёмка',  text:'Ежедневный брифинг от двойника главы департамента готов — проверить', open:'kam-director' },
        { sev:'amber', tag:'уточнение',text:'Двойник ассистента: подтвердить встречу 14:00 от вашего имени?', open:'exec-assistant' },
        { sev:'red',   tag:'санкция',  text:'Отправка КП банку-контрагенту — подтвердите (необратимо)' },
      ],
      drafts:[
        { id:'kp-gamma',       ic:'📄', t:'Черновик КП для банка «Гамма»',      by:'Двойник менеджера продаж', st:'на правку' },
        { id:'protocol-gamma', ic:'📝', t:'Протокол встречи «Гамма» · 10:00',    by:'Двойник ассистента',       st:'готов' },
        { id:'report-q3',      ic:'📊', t:'Отчёт Q3 — черновик',                 by:'Агент отчётности',         st:'на приёмку' },
        { id:'email-reply',    ic:'✉️', t:'Ответ контрагенту — черновик письма', by:'Двойник ассистента',       st:'на отправку' },
      ],
      meetings:[ { t:'09:00', text:'Ежедневный брифинг', by:'Двойник главы департамента', brief:false }, { t:'14:00', text:'Стратегическая встреча', by:'подготовлена ассистентом', brief:true } ],
    },
    dev: {
      day:'На столе — ТЗ интеграции CDP, отчёт бенчмарка LLM и релиз-ноты 2.4.',
      meet:'2 встречи — синк разработки в 10:00 и демо клиенту в 15:00',
      zoom:'Из вчерашнего созвона по РЖД: 5 задач разработки — кандидаты',
      extra:'models',
      waiting:[
        { sev:'red',   tag:'приёмка',  text:'Бенчмарк новой LLM готов — принять результат', open:'ai-internal-lead' },
        { sev:'red',   tag:'санкция',  text:'Деплой ML-модели в прод — подтвердите (необратимо)' },
        { sev:'amber', tag:'уточнение',text:'Двойник техлида: какую версию шины CDP брать в релиз 2.4?', open:'dev-team-lead' },
        { sev:'red',   tag:'приёмка',  text:'Код-ревью интеграции РЖД — 2 замечания, проверить', open:'rail-tech-lead' },
      ],
      drafts:[
        { id:'ts-cdp',     ic:'📄', t:'ТЗ интеграции CDP (черновик)', by:'Двойник разработчика РЖД',  st:'на правку' },
        { id:'bench-llm',  ic:'📊', t:'Отчёт бенчмарка LLM',          by:'Двойник главы ИИ-решений', st:'на приёмку' },
        { id:'release-24', ic:'📝', t:'Релиз-ноты 2.4 (черновик)',    by:'Двойник техлида',          st:'на согласование' },
      ],
      meetings:[ { t:'10:00', text:'Синк разработки', by:'команда CDP/EDP', brief:false }, { t:'15:00', text:'Демо клиенту', by:'подготовлено экспертом', brief:true } ],
    },
    prod: {
      day:'На столе — план внедрения, статус-отчёт клиенту и акт приёмки.',
      meet:'2 встречи — планёрка внедрений в 09:30 и статус с клиентом в 14:00',
      zoom:'Из вчерашнего статуса с клиентом: 4 задачи внедрения — кандидаты',
      extra:'sla',
      waiting:[
        { sev:'red',   tag:'приёмка',  text:'Приёмочные сценарии внедрения у клиента — проверить', open:'production-deputy' },
        { sev:'red',   tag:'санкция',  text:'Передача проекта в поддержку с SLA — подтвердите', open:'production-director' },
        { sev:'amber', tag:'уточнение',text:'Двойник зама: сдвигать ли веху внедрения на неделю?', open:'production-deputy' },
        { sev:'red',   tag:'приёмка',  text:'Статус-отчёт по внедрению — принять перед отправкой клиенту' },
      ],
      drafts:[
        { id:'impl-plan',      ic:'📄', t:'План внедрения у клиента (черновик)', by:'Двойник зама по производству', st:'на правку' },
        { id:'status-client',  ic:'📊', t:'Статус-отчёт клиенту',                by:'Двойник главы производства',   st:'на приёмку' },
        { id:'act-acceptance', ic:'📝', t:'Акт приёмки (черновик)',              by:'Двойник зама по производству', st:'на подпись' },
      ],
      meetings:[ { t:'09:30', text:'Планёрка внедрений', by:'проектный офис', brief:false }, { t:'14:00', text:'Статус с клиентом', by:'подготовлено ассистентом', brief:true } ],
    },
  };
  const udata = () => UDATA[CURRENT] || UDATA.mgmt;

  /* выключенный гейт → ассистент делает сам, решение не поднимается к вам */
  function waitingItems(){ return udata().waiting.filter(w=>gateOn(w.tag)); }
  window.__kamWaiting = waitingItems;
  const drafts   = () => udata().drafts;
  const meetings = () => udata().meetings;
  window.__kamDrafts = drafts; /* ассистент открывает черновики текущего пользователя */

  function greetingText(){
    const wait = waitingItems();
    const map = { 'приёмка':'на приёмку', 'уточнение':'уточнение', 'санкция':'на подпись' };
    const order = ['приёмка','уточнение','санкция']; const cnt = {};
    wait.forEach(w=>cnt[w.tag]=(cnt[w.tag]||0)+1);
    const wtext = order.filter(t=>cnt[t]).map(t=>cnt[t]+' '+map[t]).join(', ');
    const n = wait.length; const u = udata();
    return `Доброе утро, ${hero().first}. Пока вы отдыхали, ваши цифровые сотрудники собрали день. Коротко: ${n} ${n===1?'решение ждёт':'решения ждут'} вас (${wtext}); ${u.meet}. ${u.day} Я рядом — подскажу по ходу дня.`;
  }

  /* ── рабочий стол: набор блоков с полной кастомизацией (у каждого свой) ── */
  const BASE_W = ['waiting','drafts','meetings','staff','zoom'];
  const allW = () => { const e=udata().extra; return e ? BASE_W.concat([e]) : BASE_W.slice(); };
  const W_TITLE = { waiting:'Ждёт меня', drafts:'Черновики и документы', meetings:'Встречи дня', staff:'Мои цифровые сотрудники в работе', zoom:'Предложено помощником', models:'Модели и деплои', sla:'Внедрения и SLA' };
  const lkey = () => 'sreda_kam_layout_'+CURRENT;
  /* сохранённый пустой стол — валидное состояние, не подменяем стандартом */
  function loadLayout(){ try{ const l=JSON.parse(localStorage.getItem(lkey())); if(Array.isArray(l)) return l.filter(x=>allW().includes(x)); }catch(e){} return allW(); }
  function saveLayout(l){ try{ localStorage.setItem(lkey(), JSON.stringify(l)); }catch(e){} }
  function setUser(u){ if(!USERS[u]||u===CURRENT) return; CURRENT=u; greeted=false; try{ localStorage.setItem(UKEY,u); }catch(e){} }

  /* ── конструктор рабочего места: состояние под каждого пользователя ──
     Гейты — не декорация: выключенный гейт убирает эти решения из «Ждёт меня»
     (ассистент делает сам). Штат — реальный ростер ЦС, влияет на стол и пульс. */
  const W_DESC = {
    waiting:'Решения, которые не уходят дальше без вас.',
    drafts:'Черновики от цифровых сотрудников — правятся словами.',
    meetings:'Расписание дня с готовыми брифами.',
    staff:'Ваши цифровые сотрудники и что они делают сейчас.',
    zoom:'Кандидаты в задачи из вчерашних звонков.',
    models:'Модели, бенчмарки и деплои направления.',
    sla:'Внедрения у клиентов и состояние SLA.',
  };
  const GATES = [
    { id:'приёмка',   t:'Приёмка результатов',    d:'Результат цифрового сотрудника ждёт вашей приёмки. Выключите — ассистент принимает сам.' },
    { id:'санкция',   t:'Санкция на необратимое', d:'Отправка контрагенту, деплой в прод, подпись. Рекомендуем держать включённым.', warn:true },
    { id:'уточнение', t:'Уточнения при неоднозначности', d:'Ассистент спрашивает вас, когда не уверен. Выключите — решает сам по умолчанию.' },
  ];
  const GKEY = () => 'sreda_kam_gates_'+CURRENT;
  const SKEY = () => 'sreda_kam_staff_'+CURRENT;
  const EKEY = () => 'sreda_kam_esc_'+CURRENT;
  function gates(){ try{ const g=JSON.parse(localStorage.getItem(GKEY())); if(g&&typeof g==='object') return g; }catch(e){} return {}; }
  const gateOn  = (id) => gates()[id]!==false;
  const cntTag  = (id) => udata().waiting.filter(w=>w.tag===id).length;
  function setGate(id,on){ const g=gates(); g[id]=on; try{ localStorage.setItem(GKEY(), JSON.stringify(g)); }catch(e){} }

  const allDigital  = () => { try{ return Object.keys(DIGITAL_STAFF).reduce((a,k)=>a.concat(DIGITAL_STAFF[k]||[]),[]); }catch(e){ return []; } };
  const deptOfDigital = (id) => { try{ return Object.keys(DIGITAL_STAFF).find(k=>(DIGITAL_STAFF[k]||[]).some(w=>w.id===id))||''; }catch(e){ return ''; } };
  function staffIds(){ try{ const s=JSON.parse(localStorage.getItem(SKEY())); if(Array.isArray(s)) return s; }catch(e){} return digitalOf(hero().dept).map(w=>w.id); }
  function setStaffIds(ids){ try{ localStorage.setItem(SKEY(), JSON.stringify(ids)); }catch(e){} }
  function toggleStaff(id){ const s=staffIds(), i=s.indexOf(id); if(i>=0) s.splice(i,1); else s.push(id); setStaffIds(s); return i<0; }
  function escList(){ try{ const e=JSON.parse(localStorage.getItem(EKEY())); if(Array.isArray(e)) return e; }catch(e){} return []; }
  function addEsc(t){ const l=escList(); l.unshift(t); try{ localStorage.setItem(EKEY(), JSON.stringify(l)); }catch(e){} }
  function resetWorkplace(){ try{ [lkey(),GKEY(),SKEY(),EKEY()].forEach(k=>localStorage.removeItem(k)); }catch(e){} }

  /* специфические блоки роли */
  const MODELS = [
    { ic:'🧠', t:'GPT-совместимая LLM · бенчмарк', st:'готов к приёмке' },
    { ic:'⚙️', t:'ML-модель скоринга · staging',   st:'ждёт деплоя' },
    { ic:'🚄', t:'Шина CDP для РЖД · релиз 2.4',    st:'на ревью' },
  ];
  const SLA = [
    { ic:'🏭', t:'Внедрение «Гамма» · этап «Сдача»', st:'приёмочные сценарии' },
    { ic:'🛡️', t:'Поддержка «Дельта» · SLA 99.5%',  st:'в норме' },
    { ic:'⏱️', t:'Внедрение «Омега» · веха',         st:'риск сдвига' },
  ];

  function widgetBadge(id){
    if(id==='waiting') return `<span class="cnt mp-pill red">${waitingItems().length}</span>`;
    if(id==='drafts')  return `<span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${drafts().length}</span>`;
    if(id==='staff')   return `<span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${myStaff().length}</span>`;
    return '';
  }
  /* статус ЦС — из реальных данных: если его результат ждёт вас, он стоит на гейте */
  const GREEN_PILL = 'background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)';
  const staffPill = (w)=> waitingItems().some(x=>x.open===w.id)
    ? `<span class="mp-pill red">ждёт вашей приёмки</span>`
    : `<span class="mp-pill" style="${GREEN_PILL}">в работе</span>`;
  const infoRows = (arr)=> arr.map(r=>`<div class="mp-row"><span class="mp-emoji">${r.ic}</span><span class="mp-txt" style="flex:1;color:var(--txt)">${escHtml(r.t)}</span><span class="mp-pill" style="background:var(--acc-soft);color:var(--acc)">${escHtml(r.st)}</span></div>`).join('');
  function widgetBody(id){
    if(id==='waiting') return waitingItems().map(waitRowHTML).join('');
    if(id==='drafts')  return drafts().map(d=>`<div class="mp-row" data-doc="${d.id}" style="cursor:pointer"><span class="mp-emoji">${d.ic}</span><span class="mp-txt" style="flex:1;color:var(--txt)">${escHtml(d.t)} <span style="color:var(--faint)">· ${escHtml(d.by)}</span></span><span class="mp-pill" style="background:var(--acc-soft);color:var(--acc)">${escHtml(d.st)}</span><button class="mp-btn" data-doc="${d.id}">Открыть</button></div>`).join('');
    if(id==='meetings') return meetings().map(m=>`<div class="mp-row"><span class="mp-time">${m.t}</span><span class="mp-txt">${escHtml(m.text)} <span style="color:var(--faint)">· ${escHtml(m.by)}</span></span>${m.brief?`<button class="mp-btn" data-brief="1">бриф</button>`:''}</div>`).join('');
    if(id==='staff')   return myStaff().map(w=>`<div class="mp-row" data-open="${w.id}" style="cursor:pointer"><span class="mp-emoji">${w.emoji||'🤖'}</span><span class="mp-txt" style="flex:none;min-width:200px;color:var(--txt)">${escHtml(w.name)}</span><span class="mp-txt" style="flex:1;color:var(--muted);font-size:13px">${escHtml(w.now||w.title||'')}</span>${staffPill(w)}</div>`).join('');
    if(id==='zoom')    return `<div class="mp-row mp-suggest"><span class="mp-emoji">🎙️</span><span class="mp-txt">${escHtml(udata().zoom)}</span><button class="mp-btn" data-zoom="1">Разобрать</button></div>`;
    if(id==='models')  return infoRows(MODELS);
    if(id==='sla')     return infoRows(SLA);
    return '';
  }
  function widgetWrap(id){
    return `<section class="mp-w" data-w="${id}"><div class="mp-sec">${W_TITLE[id]} ${widgetBadge(id)}</div>${widgetBody(id)}</section>`;
  }

  /* ── экран: Личный ассистент — рабочий стол (высота «Я») ── */
  function renderMyPulse(root){
    const greet = greetingText();
    const layout = loadLayout();
    root.innerHTML = `
      <div class="mp-greet"><div class="av">◆</div><div style="flex:1;min-width:0"><div class="who">Личный ассистент</div><div class="msg" id="mpGreet">${greeted?escHtml(greet):''}</div></div></div>
      <div class="mp-metarow">
        <span class="meta">${escHtml(hero().first)} · ${escHtml(hero().role)} · ${weekday()}, 08:00 · день собран</span>
        <span style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="mp-btn" id="mpEdit">⚙ Конструктор рабочего места</button>
          ${segHTML('me')}
        </span>
      </div>
      <div id="mpDesk">
        ${layout.length ? layout.map(id=>widgetWrap(id)).join('')
          : `<div class="mp-empty">Стол пуст — соберите его в конструкторе.<div style="margin-top:12px"><button class="mp-btn" id="mpEdit2">⚙ Открыть конструктор</button></div></div>`}
      </div>
      <div class="mp-asst" data-asst="1"><span class="ic">💬</span><span class="t">Личный помощник — знает, на что вы смотрите. Спросите или поставьте задачу…</span><kbd>⌘K</kbd></div>`;

    root.querySelectorAll('[data-open]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.open); });
    root.querySelectorAll('[data-doc]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); window.__MP_DOC=b.dataset.doc; navTo('mypulse-doc'); });
    root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); const row=b.closest('.mp-row'); if(row){ row.style.transition='opacity .25s'; row.style.opacity='0'; setTimeout(()=>row.remove(),250); } toast('Готово — точка закрыта'); });
    const zb=root.querySelector('[data-zoom]'); if(zb) zb.onclick=()=>navTo('mypulse-zoom');
    const br=root.querySelector('[data-brief]'); if(br) br.onclick=()=>toast('Бриф к встрече готовит Двойник ассистента');
    const as=root.querySelector('[data-asst]'); if(as) as.onclick=()=>{ const ov=$('#overlay'); if(ov&&ov._open) ov._open(); };
    wireSeg(root);
    root.querySelectorAll('#mpEdit,#mpEdit2').forEach(b=>b.onclick=()=>navTo('mypulse-constructor'));
    if(!greeted){ greeted=true; const g=root.querySelector('#mpGreet'); if(g) typeInto(g, greet, null, null); }
  }

  /* ── экран: разбор Zoom → кандидаты в задачи (§6, ничего молча) ── */
  const CANDS = [
    { on:true,  text:'Подготовить КП по расширенному тарифу', who:'🤖 ЦС «Двойник менеджера продаж»', due:'до пт', src:'10:12 — «пришлём коммерческое до конца недели»' },
    { on:true,  text:'Проверить договор на санкционные риски', who:'🤖 ЦС «Юрист»', due:'до ср', src:'10:21 — «нужно свериться по контрагенту»' },
    { on:true,  text:'Уточнить объём поставки на Q1', who:'👤 Виктор В.', due:'завтра', src:'10:28 — «сколько берёте в первом квартале?»' },
    { on:false, text:'Отправить презентацию (уже отправляли ранее)', who:'снято', due:'', src:'10:31 — «скиньте ещё раз слайды»' },
    { on:true,  text:'Встреча-презентация КП', who:'📅 чт, 15:00 · Zoom', due:'', src:'10:35 — «давайте созвонимся в четверг»', mtg:true },
  ];
  function renderZoom(root){
    const S = (window.__MP_ZOOM = window.__MP_ZOOM || CANDS.map(c=>({...c})));
    function draw(){
      const on = S.filter(c=>c.on);
      const nt = on.filter(c=>!c.mtg).length, nm = on.filter(c=>c.mtg).length;
      root.innerHTML = `
        <div class="mp-head">
          <div class="mp-title">
            <h2>Разбор звонка · клиент «Гамма»</h2>
            <p>10:00–10:38 · протокол готов · помощник выделил кандидатов — подтвердите перед постановкой ЦС</p>
          </div>
          <button class="mp-btn" data-back="1">← В Пульс</button>
        </div>
        ${S.map((c,i)=>`
          <div class="mp-row ${c.mtg?'mp-suggest':''}" style="align-items:flex-start;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:center;gap:11px;width:100%">
              <span class="mp-chk ${c.on?'':'off'}" data-t="${i}">✓</span>
              <span class="mp-txt" style="${c.on?'':'color:var(--faint);text-decoration:line-through'}">${escHtml(c.text)}</span>
              <span class="mp-who" style="${c.on?'':'background:transparent;color:var(--faint)'}">${escHtml(c.who)}</span>
              ${c.due?`<span class="mp-mb">${escHtml(c.due)}</span>`:''}
            </div>
            <div class="mp-src" style="margin-left:29px">${escHtml(c.src)}</div>
          </div>`).join('')}
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="mp-btn" style="border-color:var(--acc);color:var(--acc);background:var(--acc-soft);font-weight:600;padding:9px 16px" data-put="1">Поставить отмеченные · ${nt} задач + ${nm} встреча</button>
          <button class="mp-btn" style="padding:9px 14px" data-tr="1">Открыть транскрипт</button>
        </div>`;
      root.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{ const i=+x.dataset.t; S[i].on=!S[i].on; draw(); });
      const bk=root.querySelector('[data-back]'); if(bk) bk.onclick=()=>navTo('mypulse');
      const tr=root.querySelector('[data-tr]'); if(tr) tr.onclick=()=>toast('Транскрипт и протокол — из сервиса протоколирования (MCP)');
      const pt=root.querySelector('[data-put]'); if(pt) pt.onclick=()=>{ window.__MP_ZOOM=null; toast('Задачи поставлены ЦС · встреча в календаре'); navTo('mypulse'); };
    }
    draw();
  }

  /* ── данные оргструктуры (из глобалов, которые заполнил org-kam.js) ── */
  const DEPTS   = () => (window.__ORG && window.__ORG.roleIds) || [];
  const dLabel  = (id) => ((typeof DEPARTMENTS!=='undefined' && DEPARTMENTS.find(x=>x.id===id)) || {label:id}).label;
  const dIcon   = (id) => ((typeof DEPARTMENTS!=='undefined' && DEPARTMENTS.find(x=>x.id===id)) || {icon:'▪'}).icon;
  const dLoad   = (id) => (((window.__ORG && window.__ORG.load) || {})[id]) || 60;
  const hc      = (id) => (typeof HEADCOUNT!=='undefined' && HEADCOUNT[id]) || 0;
  const dhc     = (id) => (typeof DIGITAL_HEADCOUNT!=='undefined' && DIGITAL_HEADCOUNT[id]) || 0;
  const peopleOf= (id) => (((typeof COCKPITS!=='undefined' && COCKPITS[id] && COCKPITS[id].team)) || []).map(t=>Array.isArray(t)?{name:t[0],role:t[1]}:{name:t.name,role:t.role});
  const digitalOf=(id) => ((typeof DIGITAL_STAFF!=='undefined' && DIGITAL_STAFF[id]) || []);
  const loadCol = (p) => p>=95?'var(--red)':p>=82?'var(--amber)':'var(--acc)';

  /* ── общие компоненты «точка участия» и «поток передач» ── */
  function waitRowHTML(w){
    const btn = w.sev==='amber' ? 'Ответить' : (w.tag==='санкция' ? 'Подписать' : (w.tag==='решение' ? 'Решить' : 'Принять'));
    return `<div class="mp-row ${w.sev}">
      <span class="mp-pill ${w.sev}">${w.tag}</span>
      <span class="mp-txt">${escHtml(w.text)}</span>
      ${w.open?`<button class="mp-btn" data-open="${w.open}">Открыть</button>`:''}
      <button class="mp-btn" data-accept="1">${btn}</button>
    </div>`;
  }
  function wireWait(root){
    root.querySelectorAll('[data-open]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.open); });
    root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation();
      const row=b.closest('.mp-row'); if(row){ row.style.transition='opacity .25s'; row.style.opacity='0'; setTimeout(()=>row.remove(),250); } toast('Готово — точка закрыта'); });
  }
  const fNode = (emoji,label,tone)=>`<div class="mp-node"><div class="mp-nb ${tone||'acc'}">${emoji}</div><span>${escHtml(label)}</span></div>`;
  const fSyn  = (kind)=> kind==='gate' ? `<div class="mp-syn red"><span class="lk">🔒</span></div>` : `<div class="mp-syn ok"></div>`;
  /* сколько ЦС подчиняется человеку — из поля lead цифрового сотрудника */
  const leadsCount = (dept,name)=>{ const first=String(name||'').split(' ')[0]; if(!first) return 0;
    return digitalOf(dept).filter(d=>String(d.lead||'').indexOf(first)>=0).length; };

  /* ── экран: Пульс «Отдел» (текущего пользователя) ── */
  function renderDeptPulse(root){
    const dept=hero().dept;
    const ppl=peopleOf(dept), dig=digitalOf(dept);
    const firstDig = dig[0] || { name:'Цифровой сотрудник', emoji:'🤖' };
    const wait = udata().waiting.slice(0,2);
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Пульс отдела «${dLabel(dept)}» · ${weekday()}, утро</span>${segHTML('dept')}</div>
      <div class="mp-sec">Ждёт отдел <span class="cnt mp-pill red">${wait.length}</span></div>
      ${wait.map(waitRowHTML).join('')}
      <div class="mp-sec">Передачи сейчас</div>
      <div class="mp-flow">
        ${fNode(firstDig.emoji||'🤖', firstDig.name,'acc')}
        ${fSyn('ok')}
        ${fNode('🧑‍💼',hero().first,'acc')}
        ${fSyn('gate')}
        ${fNode('🏛️','Руководство','mut')}
      </div>
      <div class="mp-flowcap"><span style="color:var(--red)">🔒 Передача застряла на гейте: результат ждёт вашей приёмки — дальше не уходит.</span></div>
      <div class="mp-sec">Кто над чем работает <span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${ppl.length+dig.length}</span></div>
      ${ppl.map(p=>{ const n=leadsCount(dept,p.name); return `<div class="mp-row">
        <span class="mp-emoji">🧑‍💼</span>
        <span class="mp-txt" style="flex:none;min-width:200px;color:var(--txt)">${escHtml(p.name||'')}</span>
        <span class="mp-txt" style="flex:1;color:var(--muted);font-size:13px">${escHtml(p.role||'')}</span>
        ${n?`<span class="mp-pill" style="background:var(--acc-soft);color:var(--acc)">${n} ЦС в подчинении</span>`:''}</div>`; }).join('')}
      ${dig.map(d=>`<div class="mp-row" data-open="${d.id}" style="cursor:pointer">
        <span class="mp-emoji">${d.emoji||'🤖'}</span>
        <span class="mp-txt" style="flex:none;min-width:200px;color:var(--txt)">${escHtml(d.name)}</span>
        <span class="mp-txt" style="flex:1;color:var(--muted);font-size:13px">${escHtml(d.now||d.title||'')}</span>
        ${staffPill(d)}</div>`).join('')}`;
    wireWait(root); wireSeg(root);   /* wireWait вешает и data-open на карточки ЦС */
  }

  /* ── экран: Пульс «Компания» (Оркестратор) ── */
  function renderCoPulse(root){
    const feed = ((window.__ORG && window.__ORG.pulseFeed) || []).filter(f=>f[0]==='x');
    const depts = DEPTS();
    const wait=[
      { sev:'red',   tag:'решение',      text:'Тендер РЖД: цена лота у порога маржи — нужно решение по участию' },
      { sev:'amber', tag:'согласование', text:'Кросс-отдельный проект «Внедрение Гамма» — подтвердить состав команды' },
    ];
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Пульс компании · Департамент KAM · ${weekday()}</span>${segHTML('company')}</div>
      <div class="mp-sec">Ждёт на стыках <span class="cnt mp-pill red">${wait.length}</span></div>
      ${wait.map(waitRowHTML).join('')}
      <div class="mp-sec">Межотделовые передачи <span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${feed.length}</span></div>
      ${feed.map(f=>`<div class="mp-row"><span class="mp-emoji">🔄</span><span class="mp-txt" style="flex:none;min-width:230px;color:var(--txt)">${escHtml(f[1])}</span><span class="mp-txt" style="color:var(--muted);font-size:13px">${escHtml(f[2])}</span></div>`).join('')}
      <div class="mp-sec">Отделы <span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${depts.length}</span></div>
      ${depts.map(id=>`<div class="mp-row" data-dept="${id}" style="cursor:pointer">
        <span class="mp-emoji">${dIcon(id)}</span>
        <span class="mp-txt" style="flex:none;min-width:170px;color:var(--txt)">${escHtml(dLabel(id))}</span>
        <span class="mp-mb" style="min-width:104px">${hc(id)} чел · ${dhc(id)} ЦС</span>
        <span class="mp-bar"><i style="width:${dLoad(id)}%;background:${loadCol(dLoad(id))}"></i></span>
        <span class="mp-pct">${dLoad(id)}%</span></div>`).join('')}
      <div class="mp-linkrow"><button class="mp-btn" data-map="1">Открыть карту оргструктуры →</button></div>`;
    root.querySelectorAll('[data-dept]').forEach(b=>b.onclick=()=>navTo(b.dataset.dept==='mgmt'?'mypulse-dept':'dpulse:'+b.dataset.dept));
    const mp=root.querySelector('[data-map]'); if(mp) mp.onclick=()=>navTo('pulse');
    wireWait(root); wireSeg(root);
  }

  /* ── экран: Конструктор рабочего места (§7, §4.3) ──
     Всё здесь настоящее: блоки, штат ЦС, гейты и эскалация сохраняются под
     текущего пользователя и сразу меняют его стол, пульс и очередь решений. */
  const ACC_PILL = 'background:var(--acc-soft);color:var(--acc)';
  const OTHERS_SHOWN = 6;
  function renderConstructor(root){
    const layout = loadLayout(), avail = allW();
    const mine   = staffIds();
    const own    = digitalOf(hero().dept);
    const ownIds = own.map(w=>w.id);
    const hiredOutside = allDigital().filter(w=>ownIds.indexOf(w.id)<0 && mine.indexOf(w.id)>=0);
    const others = allDigital().filter(w=>ownIds.indexOf(w.id)<0 && mine.indexOf(w.id)<0);
    const shown  = others.slice(0, OTHERS_SHOWN);
    const esc    = escList();

    const blockRow = (id)=>{ const on=layout.indexOf(id)>=0, pos=layout.indexOf(id);
      return `<div class="mp-cr">
        <button class="mp-tg ${on?'on':''}" data-w="${id}" role="switch" aria-checked="${on}" aria-label="${W_TITLE[id]}"><i></i></button>
        <span class="tt"><b>${W_TITLE[id]}</b><span>${W_DESC[id]||''}</span></span>
        ${on?`<span style="display:flex;gap:4px;flex:none">
          <button class="mp-ic" data-mv="up" data-id="${id}" ${pos===0?'disabled':''} aria-label="Выше">↑</button>
          <button class="mp-ic" data-mv="dn" data-id="${id}" ${pos===layout.length-1?'disabled':''} aria-label="Ниже">↓</button></span>`:''}</div>`; };

    const staffRow = (w,hired)=>`<div class="mp-cr">
      <span style="font-size:18px;flex:none">${w.emoji||'🤖'}</span>
      <span class="tt"><b>${escHtml(w.name)}</b><span>${escHtml(w.title||'')}${w.now?' · '+escHtml(w.now):''}</span></span>
      <button class="mp-btn" data-staff="${w.id}" style="flex:none">${hired?'Уволить':'＋ нанять'}</button></div>`;

    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Конструктор рабочего места · ${escHtml(hero().first)} · ${escHtml(hero().role)}</span>
        <span style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="mp-btn" data-reset="1">↺ сбросить</button>
          <button class="mp-btn" data-back="1">← На рабочий стол</button></span></div>

      <div class="mp-sec">Блоки рабочего стола <span class="cnt mp-pill" style="${ACC_PILL}">${layout.length} из ${avail.length}</span></div>
      ${avail.map(blockRow).join('')}

      <div class="mp-sec">Цифровой штат <span class="cnt mp-pill" style="${ACC_PILL}">${mine.length} в работе</span></div>
      ${own.map(w=>staffRow(w, mine.indexOf(w.id)>=0)).join('')}
      ${hiredOutside.length?`<div class="mp-flowcap" style="margin:2px 0 10px">Привлечены из других отделов:</div>${hiredOutside.map(w=>staffRow(w,true)).join('')}`:''}
      <div class="mp-sec" style="font-size:13px">Привлечь ЦС из другого отдела</div>
      ${shown.length?shown.map(w=>`<div class="mp-cr">
        <span style="font-size:18px;flex:none">${w.emoji||'🤖'}</span>
        <span class="tt"><b>${escHtml(w.name)}</b><span>${escHtml(dLabel(deptOfDigital(w.id)))} · нужна санкция владельца контекста</span></span>
        <button class="mp-btn" data-staff="${w.id}" style="flex:none">＋ привлечь</button></div>`).join(''):'<div class="mp-empty" style="text-align:left">Весь каталог уже привлечён.</div>'}
      ${others.length>shown.length?`<div class="mp-flowcap">Показаны ${shown.length} из ${others.length} — остальные в полном каталоге ЦС.</div>`:''}

      <div class="mp-sec">Права ассистента · гейты <span class="cnt mp-pill red">${waitingItems().length} ждёт вас</span></div>
      ${GATES.map(g=>`<div class="mp-cr">
        <button class="mp-tg ${gateOn(g.id)?'on':''}" data-gate="${g.id}" role="switch" aria-checked="${gateOn(g.id)}" aria-label="${g.t}"><i></i></button>
        <span class="tt"><b>${g.t}${g.warn?' <span style="color:var(--amber)">⚠</span>':''}</b><span>${g.d}</span></span>
        <span class="mp-pill" style="${ACC_PILL};flex:none">${cntTag(g.id)} в очереди</span></div>`).join('')}
      <div class="mp-flowcap">Выключенный гейт — ассистент делает сам и не спрашивает. Включённый — решение остаётся за вами. Счётчик «ждёт вас» меняется сразу.</div>

      <div class="mp-sec">Чего не хватает · эскалация ЦС-администратору</div>
      <div class="mp-cr"><input class="mp-in" id="mpEscIn" placeholder="Например: ЦС, сверяющий договоры с реестром санкций"><button class="mp-btn" data-escadd="1" style="flex:none">Эскалировать</button></div>
      ${esc.map(e=>`<div class="mp-escwork">
        <div style="font-size:12px;color:var(--amber);margin-bottom:4px">⏳ в работе у ЦС-администратора</div>
        <div style="font-size:13px;color:var(--txt)">${escHtml(e)}</div>
        <div style="font-size:11px;color:var(--faint);margin-top:4px">запрошено вами · вернётся готовым блоком</div></div>`).join('')}
      <div class="mp-flowcap">⤴ Полезная доработка поднимается в дефолт роли для всех — с санкцией владельца контекста (§4.3). Каждая эскалация обогащает библиотеку ролей.</div>`;

    const again = ()=>renderConstructor(root);
    root.querySelector('[data-back]').onclick=()=>navTo('mypulse');
    root.querySelector('[data-reset]').onclick=()=>{ resetWorkplace(); toast('Рабочее место сброшено к стандарту роли'); again(); };
    root.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ const id=b.dataset.w, l=loadLayout(), i=l.indexOf(id);
      if(i>=0) l.splice(i,1); else l.push(id); saveLayout(l); again(); });
    root.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ const l=loadLayout(), i=l.indexOf(b.dataset.id), j=b.dataset.mv==='up'?i-1:i+1;
      if(i>=0&&j>=0&&j<l.length){ const t=l[i]; l[i]=l[j]; l[j]=t; saveLayout(l); again(); } });
    root.querySelectorAll('[data-staff]').forEach(b=>b.onclick=()=>{ const hired=toggleStaff(b.dataset.staff);
      toast(hired?'Цифровой сотрудник нанят':'Цифровой сотрудник снят с задач'); again(); });
    root.querySelectorAll('[data-gate]').forEach(b=>b.onclick=()=>{ const id=b.dataset.gate, on=!gateOn(id); setGate(id,on);
      toast(on?'Гейт включён — решение за вами':'Гейт снят — ассистент делает сам'); again(); });
    const add=root.querySelector('[data-escadd]'), inp=root.querySelector('#mpEscIn');
    const doEsc=()=>{ const v=(inp.value||'').trim(); if(!v){ inp.focus(); return; } addEsc(v); toast('Передал ЦС-администратору · соберёт блок'); again(); };
    if(add) add.onclick=doEsc;
    if(inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); doEsc(); } });
  }

  /* ── экран: Онбординг компании (Экран 5) — штат из библиотеки ЦС (§9) ── */
  const ONB = [
    { group:'Отдел продаж', roles:[
      { icon:'💼', role:'KAM',                src:'lib', tag:'библиотека · KAM v3', btn:'взять' },
      { icon:'⚖️', role:'Юрист-договорник',   src:'lib', tag:'библиотека · v2',    btn:'взять' },
    ]},
    { group:'Логистика', roles:[
      { icon:'🚚', role:'Логист ВЭД',         src:'new', tag:'нет в библиотеке',   btn:'создать ЦС' },
      { icon:'📦', role:'Складской учёт',      src:'lib', tag:'библиотека · v1',    btn:'взять' },
    ]},
  ];
  function renderOnboarding(root){
    const flat = ONB.flatMap(g=>g.roles);
    const nLib = flat.filter(r=>r.src==='lib').length, nNew = flat.filter(r=>r.src==='new').length;
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Онбординг компании «Гамма» · Администратор + ассистент</span><span class="mp-pill" style="background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)">ТЗ проанализировано</span></div>
      <div class="mp-greet" style="margin-top:12px">
        <div class="av">◆</div>
        <div style="flex:1;min-width:0"><div class="who">Ассистент администратора</div>
        <div class="msg" style="font-size:14px">Из ТЗ я выделил 3 отдела и 7 ролей. Шесть закрываю из библиотеки, для «Логиста ВЭД» подходящего ЦС нет — предлагаю создать.</div></div>
      </div>
      ${ONB.map(g=>`
        <div class="mp-sec">${escHtml(g.group)}</div>
        ${g.roles.map(r=>`<div class="mp-catrow" style="gap:12px">
          <span style="font-size:16px">${r.icon}</span>
          <span style="flex:1">Роль «${escHtml(r.role)}»</span>
          <span class="mp-pill" style="background:${r.src==='lib'?'color-mix(in srgb,var(--green) 15%,transparent)':'color-mix(in srgb,var(--amber) 15%,transparent)'};color:${r.src==='lib'?'var(--green)':'var(--amber)'}">${r.src==='lib'?'📚 ':'✦ '}${escHtml(r.tag)}</span>
          <button class="mp-btn" data-take="1" ${r.src==='new'?'style="border-color:color-mix(in srgb,var(--acc) 40%,transparent);color:var(--acc)"':''}>${escHtml(r.btn)}</button>
        </div>`).join('')}`).join('')}
      <div style="display:flex;align-items:center;gap:14px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
        <div style="flex:1;font-size:13px;color:var(--txt2)">Итог: <b style="color:var(--txt)">${nLib} из библиотеки</b> · <b style="color:var(--txt)">${nNew} создать</b> · назначить РЦС</div>
        <button class="mp-btn" data-staff="1" style="border-color:color-mix(in srgb,var(--acc) 45%,transparent);color:var(--acc);font-weight:600;padding:9px 16px">Укомплектовать компанию</button>
      </div>`;
    root.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ b.textContent='✓ добавлен'; b.disabled=true; b.style.opacity='.6'; toast('ЦС добавлен в штат компании'); });
    const st=root.querySelector('[data-staff]'); if(st) st.onclick=()=>toast('Компания укомплектована · штат создан, РЦС назначены');
  }

  /* ── мастерская документа: документ + диалог с ассистентом (чат/IDE) ── */
  const DOCS = {
    'kp-gamma': { ic:'📄', kind:'КП', by:'Двойник менеджера продаж', status:'на правку',
      title:'Коммерческое предложение · АО «Банк Гамма»',
      chips:['Сократи вступление','Добавь скидку 10%','Проверь юр. риски','На согласование'],
      body:[
        'Коммерческое предложение для АО «Банк Гамма».',
        'СРЕДА — корпоративная платформа цифровых сотрудников, разворачиваемая on-premise в контуре заказчика. Каждый цифровой сотрудник занимает должность, подчиняется руководителю и работает по корпоративным правилам.',
        'Состав поставки: платформа + библиотека цифровых сотрудников под роли банка (KAM, юрист-договорник, аналитик), интеграции с почтой и внутренними системами через MCP.',
        'Стоимость: базовая лицензия на платформу + оплата по числу руководителей цифровых сотрудников (РЦС).',
        'Срок внедрения: 6–8 недель до продуктивной эксплуатации.',
      ] },
    'protocol-gamma': { ic:'📝', kind:'Протокол', by:'Двойник ассистента', status:'готов',
      title:'Протокол встречи · клиент «Гамма» · 10:00–10:38',
      chips:['Выдели решения','Назначь ответственных','Разослать участникам'],
      body:[
        'Участники: Вячеслав (КАМ), представители АО «Банк Гамма».',
        'Обсудили: расширенный тариф, объёмы поставки на Q1, санкционную проверку контрагента.',
        'Договорённости: прислать КП до конца недели; свериться по контрагенту; созвон-презентация в четверг 15:00.',
      ] },
    'report-q3': { ic:'📊', kind:'Отчёт', by:'Агент отчётности', status:'на приёмку',
      title:'Отчёт департамента KAM · Q3 (черновик)',
      chips:['Короткое резюме','Добавь график','На приёмку'],
      body:[
        'Итоги квартала по департаменту KAM.',
        'Выручка: план выполнен на 104%. Воронка: 18 MQL, 6 горячих сделок.',
        'Проекты РЖД: 2 в работе, риск-индекс в норме. Внедрения: SLA соблюдены.',
      ] },
    'email-reply': { ic:'✉️', kind:'Письмо', by:'Двойник ассистента', status:'на отправку',
      title:'Ответ контрагенту (черновик письма)',
      chips:['Сделай вежливее','Короче','Отправить'],
      body:[
        'Здравствуйте!',
        'Благодарим за интерес к платформе СРЕДА. Направляем коммерческое предложение во вложении и готовы обсудить пилот.',
        'С уважением, департамент KAM.',
      ] },

    /* документы Виктора (ИИ и разработка) */
    'ts-cdp': { ic:'📄', kind:'ТЗ', by:'Двойник разработчика РЖД', status:'на правку',
      title:'ТЗ интеграции CDP для РЖД (черновик)',
      chips:['Сократи требования','Добавь критерии приёмки','Проверь риски интеграции','На согласование'],
      body:[
        'Техническое задание: интеграция CDP с системами заказчика (РЖД).',
        'Цель: единая шина данных CDP/EDP с обменом событиями в реальном времени.',
        'Интеграции: внутренние системы клиента через MCP-коннекторы; форматы и SLA обмена.',
        'Критерии приёмки: нагрузочный тест, отказоустойчивость, журналирование.',
      ] },
    'bench-llm': { ic:'📊', kind:'Отчёт', by:'Двойник главы ИИ-решений', status:'на приёмку',
      title:'Отчёт бенчмарка LLM (черновик)',
      chips:['Короткое резюме','Добавь рекомендацию','Сравни стоимость','На приёмку'],
      body:[
        'Бенчмарк моделей для задач департамента: качество, скорость, стоимость.',
        'Результат: кандидат превосходит текущую модель по качеству на 6% при сопоставимой цене.',
        'Рекомендация: перевести скоринг MQL на новую модель после A/B на 2 недели.',
      ] },
    'release-24': { ic:'📝', kind:'Релиз-ноты', by:'Двойник техлида', status:'на согласование',
      title:'Релиз-ноты 2.4 (черновик)',
      chips:['Сгруппируй по компонентам','Добавь известные проблемы','Опубликовать'],
      body:[
        'Релиз 2.4: шина CDP, интеграции РЖД, ускорение обработки событий.',
        'Изменения: новый коннектор, оптимизация ретраев, снижение джиттера.',
        'Совместимость: обратно совместимо; миграции не требуются.',
      ] },

    /* документы Василия (производство/внедрения) */
    'impl-plan': { ic:'📄', kind:'План', by:'Двойник зама по производству', status:'на правку',
      title:'План внедрения у клиента (черновик)',
      chips:['Уточни вехи','Добавь риски','Назначь ответственных','На согласование'],
      body:[
        'План внедрения платформы у клиента: этапы, вехи, ответственные.',
        'Этапы: старт (доступы, стенды) → развёртывание (настройка, интеграции, обучение) → сдача (приёмка, передача в поддержку).',
        'Сроки: 6–8 недель до продуктивной эксплуатации; контроль по вехам.',
      ] },
    'status-client': { ic:'📊', kind:'Статус-отчёт', by:'Двойник главы производства', status:'на приёмку',
      title:'Статус-отчёт клиенту (черновик)',
      chips:['Короткое резюме','Выдели риски','Добавь следующие шаги','На приёмку'],
      body:[
        'Статус внедрения на текущую неделю.',
        'Готово: развёртывание в контуре, базовые интеграции, обучение первой группы.',
        'В работе: приёмочные сценарии. Риски: сдвиг вехи на неделю из-за доступов.',
      ] },
    'act-acceptance': { ic:'📝', kind:'Акт', by:'Двойник зама по производству', status:'на подпись',
      title:'Акт приёмки (черновик)',
      chips:['Проверь по критериям','Добавь замечания','На подпись'],
      body:[
        'Акт приёмки работ по внедрению платформы.',
        'Проверка по критериям приёмки: функциональность, производительность, SLA.',
        'Замечания: отсутствуют / приняты к устранению в поддержке.',
      ] },
  };

  function renderDoc(root){
    const id = window.__MP_DOC || 'kp-gamma';
    const d = DOCS[id] || DOCS['kp-gamma'];
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">${escHtml(d.kind)} · ${escHtml(d.by)} · статус: ${escHtml(d.status)}</span><button class="mp-btn" data-back="1">← В ассистента</button></div>
      <div class="mp-doc">
        <div class="mp-docpane">
          <div class="hd"><span class="mp-emoji">${d.ic}</span><b style="flex:1;min-width:0">${escHtml(d.title)}</b>
            <button class="mp-btn" data-save="1">Сохранить</button>
            <button class="mp-btn" data-approve="1" style="border-color:color-mix(in srgb,var(--acc) 40%,transparent);color:var(--acc)">На согласование</button></div>
          <textarea id="mpDocBody" spellcheck="false">${escHtml(d.body.join('\n\n'))}</textarea>
        </div>
        <div class="mp-chat">
          <div class="mp-chat-hd"><span class="av2">◆</span><b>Личный ассистент</b><span style="color:var(--muted);font-size:12px;margin-left:auto">видит документ</span></div>
          <div class="thread" id="mpThread"></div>
          <div class="mp-chips" id="mpChips">${(d.chips||[]).map(c=>`<button class="mp-chip">${escHtml(c)}</button>`).join('')}</div>
          <div class="mp-chatin"><input id="mpChatIn" placeholder="Спросите ассистента про документ…" autocomplete="off"/><button data-csend="1" aria-label="Отправить">▶</button></div>
        </div>
      </div>`;
    const thread=root.querySelector('#mpThread'); const body=root.querySelector('#mpDocBody');
    function bubble(cls,txt,stream){ const b=el(`<div class="mp-b ${cls}"></div>`); thread.appendChild(b); if(stream){ typeInto(b,txt,thread,null); } else { b.textContent=txt; } thread.scrollTop=thread.scrollHeight; return b; }
    bubble('a', `Открыл «${d.title}». Вижу документ целиком — могу переписать, добавить условия, проверить или отправить дальше. Что делаем?`, false);

    function respond(q){
      bubble('u', q);
      const lo=q.toLowerCase(); let reply='Готово. Что-то ещё по документу?'; let edit=null;
      if(/скидк/.test(lo)){ reply='Добавил специальные условия со скидкой 10% в раздел стоимости.'; edit=t=>t+'\n\nСпециальные условия: скидка 10% при годовой предоплате.'; }
      else if(/сократ|коротк|вступлен/.test(lo)){ reply='Сократил — оставил суть в двух абзацах.'; edit=t=>{ const p=t.split('\n\n'); return p.slice(0,2).join('\n\n'); }; }
      else if(/риск|юр/.test(lo)){ reply='Проверил по реестру: санкционных рисков по контрагенту не выявлено. Рекомендую приложить справку — добавил пометку.'; edit=t=>t+'\n\n[Проверка: санкционных рисков нет · справка прилагается]'; }
      else if(/вежлив|мягч/.test(lo)){ reply='Смягчил формулировки, добавил вступительную любезность.'; edit=t=>'Добрый день!\n\n'+t; }
      else if(/реш|ответствен/.test(lo)){ reply='Выделил решения и проставил ответственных по договорённостям.'; edit=t=>t+'\n\nРешения: 1) КП — Двойник менеджера продаж, до пт. 2) Проверка контрагента — Юрист, до ср. 3) Созвон — чт 15:00.'; }
      else if(/график|диаграм/.test(lo)){ reply='Добавил ссылку на график выручки по кварталам.'; edit=t=>t+'\n\n[График: выручка по кварталам Q1–Q3]'; }
      else if(/отправ|соглас|приёмк|приемк|разосл/.test(lo)){ reply='Отправляю на следующий шаг — статус обновлён.'; }
      setTimeout(()=>{ bubble('a', reply, true); if(edit) body.value=edit(body.value); }, 240);
    }

    root.querySelectorAll('.mp-chip').forEach(c=>c.onclick=()=>respond(c.textContent));
    const inp=root.querySelector('#mpChatIn');
    const send=()=>{ const v=(inp.value||'').trim(); if(!v) return; inp.value=''; respond(v); };
    root.querySelector('[data-csend]').onclick=send;
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
    root.querySelector('[data-back]').onclick=()=>navTo('mypulse');
    root.querySelector('[data-save]').onclick=()=>toast('Черновик сохранён');
    root.querySelector('[data-approve]').onclick=()=>{ toast('Отправлено на согласование'); navTo('mypulse'); };
  }

  /* ── маршруты: оборачиваем renderStage, добавляем свои экраны ── */
  const origStage = renderStage;
  renderStage = function(id){
    const MINE = { 'mypulse':renderMyPulse, 'mypulse-zoom':renderZoom, 'mypulse-dept':renderDeptPulse, 'mypulse-co':renderCoPulse, 'mypulse-constructor':renderConstructor, 'mypulse-onboard':renderOnboarding, 'mypulse-doc':renderDoc };
    if (MINE[id]){
      const stage=document.getElementById('stage');
      stage.classList.add('full'); stage.innerHTML='<div class="work" id="work"></div>';
      MINE[id](document.getElementById('work'));
      return;
    }
    return origStage.apply(this, arguments);
  };

  /* ── в KAM-демо не пускаем в старый ролевой кабинет с «демо-линзой» и чужими
        закрытыми данными: любой вход в ролевой «Мой ассистент» → чистый стол,
        а меню всегда держим менеджерским (exec) ── */
  const ROLE_CABS = (window.__ORG && window.__ORG.roleIds) || [];
  const origNavMP = navTo;
  navTo = function(id, opts){
    if (typeof id==='string'){
      /* ролевой «Мой ассистент» (asst:dev) или «Рабочий стол» (голый id отдела),
         а также канал/передачи/умения ролевого кабинета — уводим в чистый стол */
      if (id.indexOf('asst:')===0){ const d=id.slice(5); if (USERS[d]) setUser(d); return origNavMP('mypulse', opts); }
      if (ROLE_CABS.indexOf(id)>=0){ if (USERS[id]) setUser(id); return origNavMP('mypulse', opts); }
      if (/^(channel|flow|lib):/.test(id)){ return origNavMP('mypulse', opts); }
    }
    origNavMP(id, opts);
    try{
      if (state.ws!=='exec' && state.ws!=='owner' && state.ws!=='platform' && ROLE_CABS.indexOf(state.ws)>=0){
        if (USERS[state.ws]) setUser(state.ws);
        state.ws='exec'; renderNav(); if (typeof renderTopWho==='function') renderTopWho(); refreshUserSw();
      }
    }catch(e){}
  };

  /* ── подписи экранов (крошки / кнопка назад) ── */
  const origLabel = screenLabel;
  screenLabel = function(id){
    if (id==='mypulse') return 'Личный ассистент';
    if (id==='mypulse-zoom') return 'Разбор звонка «Гамма»';
    if (id==='mypulse-dept') return 'Пульс отдела';
    if (id==='mypulse-co') return 'Пульс компании';
    if (id==='mypulse-constructor') return 'Конструктор рабочего места';
    if (id==='mypulse-onboard') return 'Онбординг компании';
    if (id==='mypulse-doc') return 'Документ · ассистент';
    return origLabel.apply(this, arguments);
  };

  /* ── меню менеджмента: чистая иерархия вместо «навалено» ──
     Личный ассистент и три высоты сверху; компания и платформа — под группами. */
  const exWS = WORKSPACES.find(w=>w.id==='exec');
  if (exWS) exWS.nav = [
    { id:'mypulse',             label:'Личный ассистент',           icon:'💬' },
    { id:'mypulse-constructor', label:'Конструктор рабочего места', icon:'🧩' },
    { id:'mypulse-dept',        label:'Пульс отдела',               icon:'🫀' },
    { id:'kproj',        label:'Проекты департамента',  icon:'📁' },
    { sep:'Компания' },
    { id:'mypulse-co',   label:'Пульс компании',        icon:'🌐' },
    { id:'pulse',        label:'Карта оргструктуры',    icon:'🧠' },
    { id:'exec',         label:'Дашборд',               icon:'📊' },
  ];
  /* Онбординг компании и платформенные экраны — это работа админа/владельца
     платформы, а не главы департамента. Убрано из кабинета Вячеслава,
     онбординг перенесён в кабинет «Владелец платформы». */
  const ownWS = WORKSPACES.find(w=>w.id==='owner');
  if (ownWS && !ownWS.nav.some(n=>n.id==='mypulse-onboard')) ownWS.nav.unshift({ id:'mypulse-onboard', label:'Онбординг компании', icon:'🏢' });

  injectStyle();

  /* ── тема: применяем сохранённую сразу (без мигания), кнопку добавим в шапку ── */
  try{ if(localStorage.getItem('sreda_theme')==='light') document.documentElement.setAttribute('data-theme','light'); }catch(e){}
  function setupThemeToggle(){
    const tr=document.querySelector('.tb-right'); if(!tr || document.getElementById('mpTheme')) return;
    const b=document.createElement('button'); b.id='mpTheme'; b.className='mp-theme'; b.type='button'; b.setAttribute('aria-label','Переключить тему');
    const isLight=()=>document.documentElement.getAttribute('data-theme')==='light';
    b.textContent = isLight()?'☀':'☾';
    b.onclick=()=>{ const light=!isLight(); document.documentElement.setAttribute('data-theme', light?'light':'dark'); try{localStorage.setItem('sreda_theme', light?'light':'dark');}catch(e){} b.textContent=light?'☀':'☾'; };
    tr.insertBefore(b, tr.firstChild);
  }

  /* ── переключатель пользователя в топбаре (глобальный, всегда чистый кабинет) ── */
  function refreshUserSw(){ const sw=document.getElementById('mpUserSw'); if(sw&&sw.__r) sw.__r(); }
  function setupUserSwitch(){
    const tr=document.querySelector('.tb-right'); if(!tr || document.getElementById('mpUserSw')) return;
    const wrap=document.createElement('div'); wrap.id='mpUserSw'; wrap.className='mp-userswitch mp-topsw';
    wrap.__r=function(){
      wrap.innerHTML=Object.keys(USERS).map(k=>{const u=USERS[k];return `<button class="mp-us ${k===CURRENT?'on':''}" data-user="${k}" title="${escHtml(u.role)}">${u.av} ${u.first}</button>`;}).join('');
      wrap.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>{
        setUser(b.dataset.user); greeted=false;
        state.ws='exec'; state.screen='mypulse'; renderNav(); if(typeof renderTopWho==='function') renderTopWho();
        renderStage('mypulse'); if(typeof decorateStage==='function') decorateStage('mypulse');   /* форсируем перерисовку — мы уже могли быть на mypulse */
        wrap.__r();
      });
    };
    wrap.__r();
    tr.insertBefore(wrap, tr.firstChild);
  }

  /* ── посадочный экран: Личный ассистент вместо Пульса компании ── */
  document.addEventListener('DOMContentLoaded', ()=>{
    setupThemeToggle();
    setupUserSwitch();
    const h=(location.hash.slice(1)||'').trim();
    if (!h || h==='pulse' || h==='exec'){ try{ navTo('mypulse'); }catch(e){} }
  });
})();
