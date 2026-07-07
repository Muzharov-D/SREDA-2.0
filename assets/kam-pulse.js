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
  const HERO = { first:'Вячеслав', full:'Вячеслав Закусилов', role:'Глава департамента KAM', dept:'mgmt' };
  const myStaff = () => (typeof DIGITAL_STAFF!=='undefined' && DIGITAL_STAFF.mgmt) || [];
  const staffById = (id) => myStaff().find(w=>w.id===id) || null;
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

  /* ── «Ждёт меня» — точки участия человека (§7.2), часть выведена из штата ── */
  function waitingItems(){
    const items = [];
    if (staffById('agent-reporting')) items.push({ sev:'red', tag:'приёмка', text:'Недельный дашборд собран агентом отчётности — принять', open:'agent-reporting' });
    if (staffById('kam-director'))    items.push({ sev:'red', tag:'приёмка', text:'Ежедневный брифинг KAM-DIRECTOR готов — проверить', open:'kam-director' });
    if (staffById('exec-assistant'))  items.push({ sev:'amber', tag:'уточнение', text:'EXECUTIVE-ASSISTANT: подтвердить встречу 14:00 от вашего имени?', open:'exec-assistant' });
    items.push({ sev:'red', tag:'санкция', text:'Отправка КП банку-контрагенту — подтвердите (необратимо)' });
    return items;
  }

  /* ── приветствие личного ассистента: короткое резюме дня (§5.2) ── */
  function greetingText(){
    const wait = waitingItems();
    const map = { 'приёмка':'на приёмку', 'уточнение':'уточнение', 'санкция':'на подпись' };
    const order = ['приёмка','уточнение','санкция']; const cnt = {};
    wait.forEach(w=>cnt[w.tag]=(cnt[w.tag]||0)+1);
    const wtext = order.filter(t=>cnt[t]).map(t=>cnt[t]+' '+map[t]).join(', ');
    const n = wait.length;
    return `Доброе утро, ${HERO.first}. Пока вы отдыхали, ваши цифровые сотрудники собрали день. Коротко: ${n} ${n===1?'решение ждёт':'решения ждут'} вас (${wtext}); 2 встречи — брифинг в 09:00 и стратегическая в 14:00. Готовы недельный дашборд и утренний брифинг KAM-DIRECTOR. Из вчерашнего звонка «Гамма» я выделил 4 задачи — подскажу по ходу дня.`;
  }

  /* ── экран: Личный ассистент (высота «Я») ── */
  function renderMyPulse(root){
    const staff = myStaff();
    const wait = waitingItems();
    const greet = greetingText();
    const meetings = [
      { t:'09:00', text:'Ежедневный брифинг', by:'KAM-DIRECTOR', brief:false },
      { t:'14:00', text:'Стратегическая встреча', by:'подготовлена ассистентом', brief:true },
    ];
    root.innerHTML = `
      <div class="mp-greet">
        <div class="av">◆</div>
        <div style="flex:1;min-width:0">
          <div class="who">Личный ассистент</div>
          <div class="msg" id="mpGreet">${greeted?escHtml(greet):''}</div>
        </div>
      </div>
      <div class="mp-metarow">
        <span class="meta">${HERO.first} · ${HERO.role} · ${weekday()}, 08:00 · день собран</span>
        ${segHTML('me')}
      </div>

      <div class="mp-sec">Ждёт меня <span class="cnt mp-pill red">${wait.length}</span></div>
      ${wait.map((w,i)=>`
        <div class="mp-row ${w.sev}" data-wi="${i}">
          <span class="mp-pill ${w.sev}">${w.tag}</span>
          <span class="mp-txt">${escHtml(w.text)}</span>
          ${w.sev==='red' && w.tag==='приёмка' ? `<button class="mp-btn" data-accept="${i}">Принять</button>` : ''}
          ${w.sev==='amber' ? `<button class="mp-btn" data-accept="${i}">Ответить</button>` : ''}
          ${w.tag==='санкция' ? `<button class="mp-btn" data-accept="${i}">Разрешить</button>` : ''}
          ${w.open ? `<button class="mp-btn" data-open="${w.open}">Открыть</button>` : ''}
        </div>`).join('')}

      <div class="mp-sec">Встречи дня</div>
      ${meetings.map(m=>`
        <div class="mp-row">
          <span class="mp-time">${m.t}</span>
          <span class="mp-txt">${escHtml(m.text)} <span style="color:var(--faint)">· ${escHtml(m.by)}</span></span>
          ${m.brief?`<button class="mp-btn" data-brief="1">бриф</button>`:''}
        </div>`).join('')}

      <div class="mp-sec">Мои цифровые сотрудники в работе <span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${staff.length}</span></div>
      ${staff.map(w=>{
        const pct = 40 + (String(w.id).length*7)%55;
        return `<div class="mp-row" data-open="${w.id}" style="cursor:pointer">
          <span class="mp-emoji">${w.emoji||'🤖'}</span>
          <span class="mp-txt" style="flex:none;min-width:150px;color:var(--txt)">${escHtml(w.name)}</span>
          <span class="mp-txt" style="color:var(--muted);font-size:13px">${escHtml(w.now||w.title||'')}</span>
          <span class="mp-bar"><i style="width:${pct}%"></i></span>
          <span class="mp-pct">${pct}%</span>
        </div>`;
      }).join('')}
      <div class="mp-row dashed" data-constructor="1" style="cursor:pointer">
        <span class="mp-emoji">🧩</span>
        <span class="mp-txt" style="color:var(--muted)">Настроить рабочее место — чего не хватает?</span>
        <span class="mp-mb">конструктор</span>
      </div>

      <div class="mp-sec">Предложено помощником</div>
      <div class="mp-row mp-suggest">
        <span class="mp-emoji">🎙️</span>
        <span class="mp-txt">Из вчерашнего Zoom-звонка «Гамма»: 4 задачи и 1 встреча — кандидаты</span>
        <button class="mp-btn" data-zoom="1">Разобрать</button>
      </div>

      <div class="mp-asst" data-asst="1">
        <span class="ic">💬</span>
        <span class="t">Личный помощник — знает, на что вы смотрите. Спросите или поставьте задачу…</span>
        <kbd>⌘K</kbd>
      </div>`;

    /* интерактив */
    root.querySelectorAll('[data-open]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); navTo('worker:'+b.dataset.open); });
    root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation();
      const row=b.closest('.mp-row'); if(row){ row.style.transition='opacity .25s'; row.style.opacity='0'; setTimeout(()=>{ row.remove(); recount(root); },250); }
      toast('Готово — точка закрыта'); });
    const zb=root.querySelector('[data-zoom]'); if(zb) zb.onclick=()=>navTo('mypulse-zoom');
    const cn=root.querySelector('[data-constructor]'); if(cn) cn.onclick=()=>navTo('mypulse-constructor');
    const br=root.querySelector('[data-brief]'); if(br) br.onclick=()=>toast('Бриф к встрече готовит EXECUTIVE-ASSISTANT');
    const as=root.querySelector('[data-asst]'); if(as) as.onclick=()=>{ const ov=$('#overlay'); if(ov && ov._open) ov._open(); };
    wireSeg(root);
    /* первый вход — ассистент печатает приветствие вживую, дальше показываем статично */
    if(!greeted){ greeted=true; const g=root.querySelector('#mpGreet'); if(g) typeInto(g, greet, null, null); }
  }
  function recount(root){
    const left = root.querySelectorAll('.mp-row.red, .mp-row.amber').length;
    const cnt = root.querySelector('.mp-sec .cnt.red');
    if(cnt) cnt.textContent = left;
    if(left===0){
      const first = root.querySelector('.mp-sec');
      if(first){ const e=el(`<div class="mp-empty">Всё под контролем. ${myStaff().length} ЦС в работе, ближайшее решение — в 14:00.</div>`); first.insertAdjacentElement('afterend', e); }
    }
  }

  /* ── экран: разбор Zoom → кандидаты в задачи (§6, ничего молча) ── */
  const CANDS = [
    { on:true,  text:'Подготовить КП по расширенному тарифу', who:'🤖 ЦС «PLATFORM-SALES-AI»', due:'до пт', src:'10:12 — «пришлём коммерческое до конца недели»' },
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
  const loadRow = (emoji,label,pct)=>`<div class="mp-row">
    <span class="mp-emoji">${emoji}</span>
    <span class="mp-txt" style="flex:none;min-width:200px;color:var(--txt)">${escHtml(label)}</span>
    <span class="mp-bar"><i style="width:${pct}%;background:${loadCol(pct)}"></i></span>
    <span class="mp-pct">${pct}%</span></div>`;

  /* ── экран: Пульс «Отдел» (Управление) ── */
  function renderDeptPulse(root){
    const dept='mgmt';
    const ppl=peopleOf(dept), dig=digitalOf(dept);
    const wait=[
      { sev:'red',   tag:'санкция',      text:'Отправка договора «Гамма» контрагенту — ждёт вашей подписи · висит 2 ч' },
      { sev:'amber', tag:'согласование', text:'Привлечение чужого ЦС «Логист» из соседнего отдела в проект' },
    ];
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Пульс отдела «${dLabel(dept)}» · ${weekday()}, утро</span>${segHTML('dept')}</div>
      <div class="mp-sec">Ждёт отдел <span class="cnt mp-pill red">${wait.length}</span></div>
      ${wait.map(waitRowHTML).join('')}
      <div class="mp-sec">Передачи сейчас</div>
      <div class="mp-flow">
        ${fNode('🤖','Агент отчётности','acc')}
        ${fSyn('ok')}
        ${fNode('🧑‍💼','Вячеслав','acc')}
        ${fSyn('gate')}
        ${fNode('🏛️','Правление','mut')}
      </div>
      <div class="mp-flowcap"><span style="color:var(--red)">🔒 Передача застряла на гейте: недельный дашборд ждёт вашей приёмки — дальше в Правление не уходит.</span></div>
      <div class="mp-sec">Загрузка штата <span class="cnt mp-pill" style="background:var(--acc-soft);color:var(--acc)">${ppl.length+dig.length}</span></div>
      ${ppl.map(p=>loadRow('🧑‍💼', (p.name||'')+' · '+(p.role||''), 55+((p.name||'').length*7)%38)).join('')}
      ${dig.map(d=>loadRow(d.emoji||'🤖', d.name, 45+(String(d.id).length*11)%55)).join('')}`;
    wireWait(root); wireSeg(root);
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

  /* ── экран: Конструктор рабочего места + эскалация (§7, §4.3) ── */
  const catRow = (emoji,label,btn)=>`<div class="mp-catrow"><span style="font-size:16px">${emoji}</span><span style="flex:1">${label}</span><button class="mp-btn" data-add="1">${btn}</button></div>`;
  function renderConstructor(root){
    root.innerHTML = `
      <div class="mp-metarow"><span class="meta">Конструктор рабочего места · роль KAM · дефолт — гипотеза</span><button class="mp-btn" data-back="1">← В ассистента</button></div>
      <div class="mp-ask"><span style="font-size:16px;color:var(--muted)">🔎</span><span class="mp-txt" style="color:var(--muted)">Сверять договоры с реестром санкций…</span><span class="mp-mb">чего не хватает?</span></div>
      <div class="mp-cols">
        <div>
          <div class="mp-sec" style="margin-top:0">Есть в системе · добавить сейчас</div>
          ${catRow('🧩','Блок «Воронка сделок»','＋ добавить')}
          ${catRow('🤖','ЦС «Переводчик»','＋ нанять')}
          ${catRow('📁','Контекст «Проект Гамма»','＋ подключить')}
        </div>
        <div>
          <div class="mp-sec" style="margin-top:0">Нет в системе · эскалация</div>
          <div class="mp-esc">
            <div style="font-size:13px;color:var(--txt);margin-bottom:10px">«ЦС, сверяющий договоры с реестром санкций» — в каталоге нет.</div>
            <button class="mp-btn" data-esc="1" style="width:100%;border-color:color-mix(in srgb,var(--acc) 40%,transparent);color:var(--acc);font-weight:600">Эскалировать ЦС-администратору</button>
          </div>
          <div class="mp-escwork">
            <div style="font-size:12px;color:var(--amber);margin-bottom:4px">⏳ в работе у ЦС-администратора</div>
            <div style="font-size:13px;color:var(--txt)">Коннектор к 1С · провижинит доступ</div>
            <div style="font-size:11px;color:var(--faint);margin-top:4px">запрошено вчера · вернётся с готовым блоком</div>
          </div>
        </div>
      </div>
      <div class="mp-flowcap" style="margin-top:18px">⤴ Полезная доработка поднимается в дефолт роли «KAM» для всех — с санкцией владельца контекста (§4.3). Каждая эскалация обогащает библиотеку ролей.</div>`;
    root.querySelector('[data-back]').onclick=()=>navTo('mypulse');
    root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ const r=b.closest('.mp-catrow'); if(r){ r.style.opacity='.5'; b.textContent='✓ добавлено'; b.disabled=true; } toast('Добавлено в рабочее место'); });
    const esc=root.querySelector('[data-esc]'); if(esc) esc.onclick=()=>{ esc.textContent='✓ передано ЦС-администратору'; esc.disabled=true; toast('Передал ЦС-администратору · соберёт блок'); };
    wireSeg(root);
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

  /* ── маршруты: оборачиваем renderStage, добавляем свои экраны ── */
  const origStage = renderStage;
  renderStage = function(id){
    const MINE = { 'mypulse':renderMyPulse, 'mypulse-zoom':renderZoom, 'mypulse-dept':renderDeptPulse, 'mypulse-co':renderCoPulse, 'mypulse-constructor':renderConstructor, 'mypulse-onboard':renderOnboarding };
    if (MINE[id]){
      const stage=document.getElementById('stage');
      stage.classList.add('full'); stage.innerHTML='<div class="work" id="work"></div>';
      MINE[id](document.getElementById('work'));
      return;
    }
    return origStage.apply(this, arguments);
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
    return origLabel.apply(this, arguments);
  };

  /* ── меню менеджмента: чистая иерархия вместо «навалено» ──
     Личный ассистент и три высоты сверху; компания и платформа — под группами. */
  const exWS = WORKSPACES.find(w=>w.id==='exec');
  if (exWS) exWS.nav = [
    { id:'mypulse',      label:'Личный ассистент',      icon:'💬' },
    { id:'mypulse-dept', label:'Пульс отдела',          icon:'🫀' },
    { id:'kproj',        label:'Проекты департамента',  icon:'📁' },
    { sep:'Компания' },
    { id:'mypulse-co',   label:'Пульс компании',        icon:'🌐' },
    { id:'pulse',        label:'Карта оргструктуры',    icon:'🧠' },
    { id:'flowx',        label:'Передачи компании',     icon:'🔄' },
    { id:'project',      label:'Проекты на ревью',      icon:'📋' },
    { id:'exec',         label:'Дашборд',               icon:'📊' },
    { sep:'Платформа Среды' },
    { id:'mypulse-onboard', label:'Онбординг компании', icon:'🏢' },
    { id:'modules', label:'С чего начать',        icon:'🪜' },
    { id:'talent',  label:'Цифровой найм',        icon:'🌊' },
    { id:'forge',   label:'Цифровое производство',icon:'🏭' },
    { id:'bills',   label:'Счета Среды',          icon:'🧾' },
  ];

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

  /* ── посадочный экран: Личный ассистент вместо Пульса компании ── */
  document.addEventListener('DOMContentLoaded', ()=>{
    setupThemeToggle();
    const h=(location.hash.slice(1)||'').trim();
    if (!h || h==='pulse' || h==='exec'){ try{ navTo('mypulse'); }catch(e){} }
  });
})();
