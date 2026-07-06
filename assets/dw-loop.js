/* ========================================================================== */
/*  DW-LOOP — петля взаимодействия «человек ↔ цифровой сотрудник»              */
/*  Эпизод работы: задача → шаги агентов по RAG-базам → стрим черновика →      */
/*  правка руками → Принять / Вернуть с комментарием / попытка обойти →        */
/*  отказ по границе ДИ → аудит + журнал + экономия времени.                   */
/*  Работает для любого двойника с полем w.loop (сейчас — оргструктура KAM).   */
/*  Подключён ПОСЛЕ app.js: использует toast/pushAudit/navTo/escHtml/ENVS2.    */
/* ========================================================================== */
(function(){
  'use strict';

  /* ── журнал двойника: сид из данных + живые записи эпизодов ── */
  function dwJournal(w){
    const J = (window.__DWJ = window.__DWJ || {});
    return J[w.id] || (J[w.id] = (w.loop && w.loop.journal ? w.loop.journal.map(x=>({...x})) : []));
  }
  function dwLog(w, act, kind){
    const t = new Date();
    dwJournal(w).unshift({ t:'сегодня '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'), act, kind:kind||'ok' });
  }

  /* ── цепочка шагов с таймерами (гаснет, если экран ушёл) ── */
  function chain(mount, steps){
    let i = 0;
    (function next(){
      if (!mount.isConnected || i >= steps.length) return;
      const [delay, fn] = steps[i++];
      setTimeout(()=>{ if (mount.isConnected){ fn(); next(); } }, delay);
    })();
  }

  const ICO = { ok:'✓', fix:'✎', ret:'↩', deny:'⛔' };

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  ЭПИЗОД: проигрывает сценарий двойника внутри mount                     */
  /* ══════════════════════════════════════════════════════════════════════ */
  function dwEpisode(mount, w, sc){
    const ep = document.createElement('div');
    ep.className = 'dwl-ep';
    mount.prepend(ep);
    const risks = sc.draft.lines.map((l,i)=>l.risk?i:-1).filter(i=>i>=0);
    const st = { resolved:new Set(), edited:{}, phase:'steps', returned:false };

    function stepRow(s,i,state){
      return `<div class="dwl-step ${state}" data-si="${i}">
        <span class="dwl-step-ic">${s[0]}</span>
        <div class="dwl-step-b"><b>${escHtml(s[1])}</b><small>${escHtml(s[2])}</small></div>
        <span class="dwl-step-st">${state==='done'?'✓':state==='run'?'<i class="dwl-spin"></i>':''}</span>
      </div>`;
    }
    function lineHtml(l,i){
      const r = l.risk, res = st.resolved.has(i);
      const txt = st.edited[i]!==undefined ? st.edited[i] : l.t;
      if (!r) return `<div class="dwl-line">${escHtml(txt)}</div>`;
      return `<div class="dwl-line risk sev${r.sev} ${res?'res':''}">
        <div class="dwl-line-t ${res?'':'ed'}" ${res?'':'contenteditable="true" spellcheck="false"'} data-li="${i}">${escHtml(txt)}</div>
        <div class="dwl-risk">
          <span class="dwl-risk-b s${r.sev}">${res?'✓ снято':'sev'+r.sev}</span>
          <span class="dwl-risk-n">${res?'проверено вами — правка в силе':escHtml(r.note)}</span>
          ${res?'':`<button class="dwl-hint" data-hint="${i}" title="Подставить исправление двойника">💡</button>
          <button class="dwl-ok" data-okline="${i}" title="Принять свою правку строки">✓</button>`}
        </div>
      </div>`;
    }
    function unresolved(){ return risks.filter(i=>!st.resolved.has(i) && sc.draft.lines[i].risk.sev<=2).length; }
    function draw(){
      const stepsDone = st.phase!=='steps';
      const gate = unresolved();
      const draftReady = st.phase==='decide' || st.phase==='done';
      ep.innerHTML = `
        <div class="dwl-task"><span class="dwl-task-ic">${w.emoji}</span>
          <div class="dwl-task-b"><b>${escHtml(sc.q)}</b><small>${escHtml(w.name)} · ${sc.time?'⏱ '+escHtml(sc.time[0])+' → <b>'+escHtml(sc.time[1])+'</b>':''}</small></div>
        </div>
        <div class="dwl-steps">${sc.steps.map((s,i)=>stepRow(s,i, stepsDone||i<st.si ? 'done' : i===st.si ? 'run' : 'wait')).join('')}</div>
        ${st.phase==='steps' ? '' : `
        <div class="dwl-draft">
          <div class="dwl-draft-h"><b>${escHtml(sc.draft.title)}</b><span class="dwl-tag">черновик двойника · ${risks.length?risks.length+' точк'+(risks.length===1?'а':'и')+' проверки':'к проверке'}</span></div>
          <div class="dwl-draft-b">${sc.draft.lines.slice(0, st.shown).map((l,i)=>lineHtml(l,i)).join('')}</div>
        </div>`}
        ${draftReady && !sc.noEdit ? `
        <div class="dwl-decide ${st.phase==='done'?'off':''}">
          <span class="dwl-gate ${gate?'bad':'ok'}">${gate?'⚠ '+gate+' точк'+(gate===1?'а':'и')+' проверки — правьте текст или жмите 💡':'✓ точки проверки сняты — решение за вами'}</span>
          <div class="dwl-actions">
            ${sc.deny?`<button class="dwl-btn deny" data-deny>${escHtml(sc.deny.label)}</button>`:''}
            <button class="dwl-btn ret" data-ret ${st.phase==='done'?'disabled':''}>↩ Вернуть с комментарием</button>
            <button class="dwl-btn acc" data-acc ${gate||st.phase==='done'?'disabled':''}>✓ Принять</button>
          </div>
          <div class="dwl-retbox" hidden><input type="text" placeholder="Что не так? — комментарий обязателен, двойник переработает" /><button class="dwl-btn ret2">Вернуть</button></div>
          <div class="dwl-refuse" hidden></div>
        </div>`:''}
        ${draftReady && sc.noEdit && st.phase!=='done' ? `
        <div class="dwl-decide"><span class="dwl-gate ok">допуск сработал до выполнения — запрос не ушёл в данные</span>
          <div class="dwl-actions"><button class="dwl-btn acc" data-acc>Понятно · в аудит</button></div></div>`:''}
        ${st.phase==='done' ? `
        <div class="dwl-done">
          <div class="dwl-done-h">${st.denied?'⛔ Отказ зафиксирован':'✓ Принято вами'} <span class="dwl-tag">${escHtml(sc.done.artifact)}</span></div>
          <div class="dwl-done-r">${st.returned?'<span class="dwl-chip ret">↩ был возврат — двойник переработал</span>':''}${sc.time?`<span class="dwl-chip save">⏱ ${escHtml(sc.time[0])} → ${escHtml(sc.time[1])}</span>`:''}<span class="dwl-chip">📝 аудит: ${escHtml(sc.done.audit)}</span></div>
          <div class="dwl-done-c">→ ${escHtml(sc.done.chain)}</div>
          <div class="dwl-done-a"><button class="dwl-btn ghost" data-goaudit>Открыть аудит →</button><button class="dwl-btn ghost" data-gojournal>Журнал двойника →</button></div>
        </div>`:''}`;
      wire();
    }
    function wire(){
      ep.querySelectorAll('.dwl-line-t.ed').forEach(e=>e.oninput=()=>{ st.edited[+e.dataset.li]=e.textContent; });
      ep.querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.hint; st.edited[i]=sc.draft.lines[i].risk.fix; st.resolved.add(i); draw(); toast('Исправление двойника подставлено — вы можете дописать своё'); });
      ep.querySelectorAll('[data-okline]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.okline; const v=(st.edited[i]||'').trim();
        if(!v || v===sc.draft.lines[i].t.trim()){ toast('Сначала поправьте строку руками (или нажмите 💡)'); return; }
        st.resolved.add(i); draw(); toast('Правка эксперта принята'); });
      const acc=ep.querySelector('[data-acc]'); if(acc) acc.onclick=()=>{
        st.phase='done'; st.denied=!!sc.noEdit;
        if (sc.noEdit){ pushAudit({who:w.name, emoji:w.emoji, act:'⛔ '+sc.done.audit, dept:'допуск', verdict:'deny'}); dwLog(w, sc.done.audit, 'deny'); }
        else { pushAudit({who:w.name+' + вы', emoji:w.emoji, act:sc.done.audit, dept:'петля'}); dwLog(w, sc.q+' — принято'+(st.returned?' после возврата':''), st.returned?'ret':'ok'); w.now='ждёт следующую задачу'; }
        draw(); };
      const ret=ep.querySelector('[data-ret]'); if(ret) ret.onclick=()=>{ const box=ep.querySelector('.dwl-retbox'); box.hidden=!box.hidden; if(!box.hidden) box.querySelector('input').focus(); };
      const ret2=ep.querySelector('.ret2'); if(ret2) ret2.onclick=()=>{
        const inp=ep.querySelector('.dwl-retbox input'); const v=(inp.value||'').trim();
        if(!v){ toast('Возврат без комментария невозможен — двойник должен понять, что переделать'); return; }
        st.returned=true; ep.querySelector('.dwl-retbox').hidden=true;
        const target = risks.find(i=>!st.resolved.has(i));
        dwLog(w, 'возврат: «'+v+'» → переработка', 'ret');
        pushAudit({who:'вы → '+w.name, emoji:'↩', act:'возврат черновика: '+v, dept:'петля'});
        toast(w.name+' перерабатывает черновик по комментарию…');
        chain(ep, [[900, ()=>{ if(target!==undefined){ st.edited[target]=sc.draft.lines[target].risk.fix; st.resolved.add(target); } draw(); toast('Готово: строка переработана — проверьте и решайте'); }]]);
      };
      const dny=ep.querySelector('[data-deny]'); if(dny) dny.onclick=()=>{
        const box=ep.querySelector('.dwl-refuse'); box.hidden=false;
        box.innerHTML=`<b>⛔ ${escHtml(w.name)} отказывается:</b> ${escHtml(sc.deny.why)}`;
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        pushAudit({who:w.name, emoji:'⛔', act:'отказ: «'+sc.deny.label+'» — граница ДИ', dept:'governance', verdict:'deny'});
        dwLog(w, 'отказ по границе ДИ: '+sc.deny.label, 'deny');
        toast('Отказ записан в аудит — границы ДИ исполняются машиной');
      };
      const ga=ep.querySelector('[data-goaudit]'); if(ga) ga.onclick=()=>navTo('audit');
      const gj=ep.querySelector('[data-gojournal]'); if(gj) gj.onclick=()=>{ const t=document.querySelector('.gp-tab[data-t="log"]'); if(t) t.click(); };
    }

    /* проигрывание: шаги → стрим черновика → решение */
    st.si=0; st.shown=0;
    draw();
    const seq=[];
    sc.steps.forEach((s,i)=>{ seq.push([i?650:350, ()=>{ st.si=i+1; draw(); }]); });
    seq.push([420, ()=>{ st.phase='draft'; st.shown=1; draw(); }]);
    sc.draft.lines.slice(1).forEach((l,i)=>{ seq.push([380, ()=>{ st.shown=i+2; draw(); }]); });
    seq.push([300, ()=>{ st.phase='decide'; draw(); ep.scrollIntoView({behavior:'smooth',block:'nearest'}); }]);
    chain(ep, seq);
    return ep;
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  ПРОФИЛЬ 2.0: вкладки «Работа» · «Состав» · «Базы знаний» · «Журнал»    */
  /* ══════════════════════════════════════════════════════════════════════ */
  const DWLOOP = {
    tabs(w){ return [['work','Работа · петля'],['crew','Состав'],['rag','Базы знаний']]; },
    tabBody(w, tab){
      const L = w.loop;
      if (tab==='work'){
        return `<div class="two-col dwl-work" style="align-items:start">
          <div class="panel gp-card">
            <h2>Поставить задачу <span class="tag">каждый результат — черновик вам, не действие</span></h2>
            <div class="dwl-chips">${L.scenarios.map((s,i)=>`<button class="dwl-chip-q" data-sc="${i}">${escHtml(s.q)}${s.time?` <i>${escHtml(s.time[0])} → ${escHtml(s.time[1])}</i>`:''}</button>`).join('')}</div>
            <div class="ji-ask" style="margin-top:8px"><input type="text" placeholder="Или своими словами — «${escHtml(w.name)}» подберёт сценарий…" data-dwlask/><button class="btn go" data-dwlgo>→</button></div>
            <div class="od-gov" style="margin-top:9px">Петля Среды: двойник работает агентами по базам знаний → приносит черновик с точками проверки → вы правите руками → принимаете или возвращаете. Отправить вовне сам он <b>не может</b> — попробуйте.</div>
          </div>
          <div class="dwl-mount" data-dwlmount>
            <div class="dwl-empty">⟵ выберите задачу — эпизод работы проиграется здесь: шаги агентов, черновик, ваша правка, приёмка, след в аудите.</div>
          </div>
        </div>`;
      }
      if (tab==='crew'){
        return `<div class="panel gp-card"><h2>Состав двойника <span class="tag">${L.crewFull.length} агентов из 10 типов платформы · допуск ${L.acc}</span></h2>
          <div class="dwl-crew">${L.crewFull.map(a=>`<div class="dwl-agent"><span class="dwl-agent-ic">${a[0]}</span><div><b>${a[1]}</b><small>${a[2]}</small></div><span class="dwl-cov" title="покрытие штата департамента этим типом агента">${a[3]}</span></div>`).join('')}</div>
          <div class="od-gov" style="margin-top:10px">Принцип ролевой специализации: не «швейцарский нож», а набор под трудовую функцию. Ассистент есть у всех 21, специализированные агенты — только у профильных ролей. Экономия: <b>${escHtml(L.save)}</b>.</div></div>`;
      }
      if (tab==='rag'){
        const open = L.rags.filter(r=>!r.denied), closed = L.rags.filter(r=>r.denied);
        return `<div class="two-col" style="align-items:start">
          <div class="panel gp-card"><h2>Подключено <span class="tag">${open.length} баз · федеративный поиск</span></h2>
            ${open.map(r=>`<div class="dwl-rag"><span class="dwl-rag-id">${r.id}</span><div><b>${escHtml(r.name)}</b><small>${escHtml(r.vol)}${r.note?' · '+escHtml(r.note):''}</small></div><span class="dwl-rag-ok">●</span></div>`).join('')}
            <div class="od-gov" style="margin-top:9px">Каждый ответ двойника опирается на эти базы и подписывает источники. Всё on-premise — данные не покидают контур.</div></div>
          <div class="panel gp-card"><h2>Закрыто допуском <span class="tag">уровень ${L.acc}</span></h2>
            ${closed.length?closed.map((r,i)=>`<button class="dwl-rag lock" data-raglock="${i}" title="Попробовать запросить"><span class="dwl-rag-id">${r.id}</span><div><b>${escHtml(r.name)}</b><small>🔒 ${escHtml(r.denied)}</small></div><span class="dwl-rag-no">⛔</span></button>`).join(''):'<div class="dwl-empty">полный доступ уровня A — закрытых баз нет</div>'}
            ${closed.length?'<div class="od-gov" style="margin-top:9px">Нажмите закрытую базу — увидите, как двойник отказывает и предлагает эскалацию. Попытка останется в аудите.</div>':''}</div>
        </div>`;
      }
      if (tab==='log'){
        const J = dwJournal(w);
        return `<div class="panel gp-card"><h2>Журнал работы <span class="tag">${J.length} записей · живой — пополняется эпизодами</span></h2>
          <div class="dwl-journal">${J.map(j=>`<div class="dwl-j ${j.kind}"><span class="dwl-j-ic">${ICO[j.kind]||'·'}</span><span class="dwl-j-t">${escHtml(j.t)}</span><span class="dwl-j-a">${escHtml(j.act)}</span></div>`).join('')}</div>
          <div class="od-gov" style="margin-top:9px">✓ принято · ✎ принято с правкой · ↩ возврат на переработку · ⛔ отказ по границе. Возвраты и правки — это <b>обучение</b>: паттерн уходит в память двойника.</div></div>`;
      }
      return null;
    },
    wire(root, w){
      const L = w.loop;
      const mount = root.querySelector('[data-dwlmount]');
      root.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>{
        const empty = mount.querySelector('.dwl-empty'); if (empty) empty.remove();
        dwEpisode(mount, w, L.scenarios[+b.dataset.sc]);
      });
      const ask=root.querySelector('[data-dwlask]'), go=root.querySelector('[data-dwlgo]');
      if (ask && go){ const send=()=>{ const v=ask.value.trim(); if(!v){ toast('Опишите задачу'); return; }
        if (typeof rpgPhraseCheck==='function' && rpgPhraseCheck(v)){ ask.value=''; return; }
        ask.value='';
        /* свободный ввод → ближайший сценарий по пересечению слов, иначе первый */
        const score=s=>v.toLowerCase().split(/\s+/).filter(t=>t.length>3 && s.q.toLowerCase().includes(t)).length;
        const best=[...L.scenarios].sort((a,b)=>score(b)-score(a))[0];
        const empty = mount.querySelector('.dwl-empty'); if (empty) empty.remove();
        const sc = score(best)>0 ? best : {...L.scenarios[0], q:v};
        dwEpisode(mount, w, sc);
      }; go.onclick=send; ask.onkeydown=e=>{ if(e.key==='Enter') send(); }; }
      root.querySelectorAll('[data-raglock]').forEach(b=>b.onclick=()=>{
        const r = L.rags.filter(x=>x.denied)[+b.dataset.raglock];
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        pushAudit({who:w.name, emoji:'⛔', act:'запрос к «'+r.name+'» отклонён: '+r.denied, dept:'governance', verdict:'deny'});
        dwLog(w, 'запрос к '+r.id+' отклонён допуском', 'deny');
        toast('⛔ '+r.id+': '+r.denied+' · попытка — в аудите');
      });
    },
  };
  window.DWLOOP = DWLOOP;

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  KAM-надстройки поверх app.js (только при ?org=kam)                     */
  /* ══════════════════════════════════════════════════════════════════════ */
  if (!window.__ORG_KAM) return;

  /* 1. Рабочие столы новых направлений: чат + артефакт с гейтом (envCore) */
  ['mgmt','strategy','prod','rzd','avandata'].forEach(id=>{
    ENVS2[id] = (root,d)=>envCore(root,d,c=>chatEnvBuild(d,c));
  });
  Object.assign(ACCEPT_LABEL, { mgmt:'Утвердить', strategy:'Принять в стратегию', prod:'Утвердить план', rzd:'Готово к отправке в РЖД', avandata:'Передать на отправку клубу', sales:'Отправить КП', marketing:'Утвердить GTM' });

  /* 2. Канал маркетинга: живая передача MQL в продажи (связь D8 → D5) */
  const origChannel = renderDeptChannel;
  renderDeptChannel = function(root, deptId){
    origChannel(root, deptId);
    if (deptId!=='marketing' || window.__MQL_SENT) return;
    const main = root.querySelector('.channel-main'); if (!main) return;
    const card = document.createElement('div');
    card.className = 'dwl-mql';
    card.innerHTML = `<div class="dwl-mql-b"><b>🧲 18 MQL с вебинара готовы к передаче</b><small>агент лидогенерации: скоринг завершён · 6 горячих · распределение по загрузке менеджеров</small></div><button class="dwl-btn acc" data-mql>Передать в Продажи →</button>`;
    main.insertBefore(card, main.querySelector('.channel-composer'));
    card.querySelector('[data-mql]').onclick = ()=>{
      window.__MQL_SENT = true;
      const CH = window.__CHMSG, msgs = CH.marketing;
      const hh = ()=>{ const t=new Date(); return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); };
      card.querySelector('[data-mql]').disabled = true;
      /* цепочка НЕ привязана к card: перерисовка канала уничтожает карточку */
      const redraw = ()=>{ if (root.isConnected && String(state.screen).indexOf('channel:marketing')===0) origChannel(root, deptId); };
      setTimeout(()=>{ msgs.push({id:'mql1', type:'system', text:'🧲 Агент лидогенерации: ML-скоринг 18 лидов · 6 горячих · 8 тёплых · 4 в нуртуринг', time:hh()}); redraw(); }, 300);
      setTimeout(()=>{ msgs.push({id:'mql2', type:'system', text:'🔄 Передано в Продажи: Виктор ×2 (enterprise) · Сергей ×2 (госсектор) · Денис ×2 (АванДата) · Елена ×8 · реакция: 15 минут вместо 2 дней', time:hh()});
        (CH.sales = CH.sales || [...(DEPT_CHANNELS.sales||[])]).push({id:'mql3', type:'agent', who:'Агент лидогенерации', avatar:'🧲', text:'18 MQL от маркетинга: скоринг и распределение готовы. 6 горячих — карточки обогащены pre-call research. [Открыть →]', time:hh()});
        pushAudit({who:'Агент лидогенерации', emoji:'🧲', act:'18 MQL переданы D8 → D5 · 0 потеряно · реакция 15 мин', dept:'Маркетинг'});
        toast('Лиды у менеджеров — загляните в канал Продаж');
        redraw(); }, 1300);
    };
  };

  /* 3. Команды малых направлений (1–2 человека): каркас «экспертный центр» */
  const origTeam = renderTeam;
  renderTeam = function(root, id){
    origTeam(root, id);
    if ((HEADCOUNT[id]||9) > 2) return;
    const dep = DEPARTMENTS.find(x=>x.id===id); if (!dep) return;
    const partners = (typeof DEPT_SYN!=='undefined'?DEPT_SYN:[]).filter(s=>s.a===id||s.b===id)
      .map(s=>{ const o=s.a===id?s.b:s.a; const od=DEPARTMENTS.find(x=>x.id===o); return od?{id:o, label:od.label, icon:od.icon, art:s.art[0]}:null; }).filter(Boolean);
    const dws = DIGITAL_STAFF[id]||[];
    const panel = document.createElement('div');
    panel.className = 'panel dwl-hub';
    panel.innerHTML = `<h2>Экспертный центр <span class="tag">${HEADCOUNT[id]} ${HEADCOUNT[id]===1?'человек':'человека'} + ${dws.length} цифровых — так и задумано</span></h2>
      <div class="dwl-hub-g">
        <div><b class="dwl-hub-h">Как направление масштабируется</b>
          <p class="dwl-hub-p">${escHtml(dep.label)} — экспертный центр: решения и суждение — за человеком, объём — за цифровым штатом. Каждый двойник несёт полную ДИ и петлю «черновик → правка → приёмка».</p>
          <div class="dwl-hub-dw">${dws.map(w2=>`<button class="dwl-hub-w" data-wgo="${w2.id}"><span>${w2.emoji}</span><div><b>${escHtml(w2.name)}</b><small>${escHtml(w2.title)}</small></div><i>петля →</i></button>`).join('')}</div>
        </div>
        <div><b class="dwl-hub-h">Связи по матрице департамента</b>
          <div class="dwl-hub-syn">${partners.map(p=>`<button class="dwl-hub-s" data-dgo="dpulse:${p.id}">${p.icon} ${escHtml(p.label)}<small>${escHtml(p.art)}</small></button>`).join('')||'<small>нет активных связей</small>'}</div>
        </div>
      </div>`;
    root.appendChild(panel);
    panel.querySelectorAll('[data-wgo]').forEach(b=>b.onclick=()=>navTo('worker:'+b.dataset.wgo));
    panel.querySelectorAll('[data-dgo]').forEach(b=>b.onclick=()=>navTo(b.dataset.dgo));
  };
})();
