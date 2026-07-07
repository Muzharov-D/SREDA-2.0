/* ============================================================================
   СРЕДА — «Пульс компании»: ФРАКТАЛЬНЫЙ организм (Canvas)
   Самоподобие: один примитив (сущность = рой + скилы + governance + синтез)
   повторяется на любом уровне. Меняется только глубина дерева.
   Масштаб: 10 ⇄ 20 000 человек — логика одна, отличается лишь вложенность.
   ========================================================================== */
const Organism = (() => {
  let cv, ctx, dpr, W, H, raf, t0 = 0;
  let nodes = [], edges = [], particles = [], hover = null, selected = null;
  let onSelect = null, onView = null, scenarioActive = false;
  const TAU = Math.PI * 2;

  /* --- Структура компании ------------------------------------------------- */
  const DEPTS = [
    { id:'analytics', label:'Аналитика',  w:0.12 },
    { id:'marketing', label:'Маркетинг',  w:0.16 },
    { id:'design',    label:'Дизайн',     w:0.08 },
    { id:'dev',       label:'Разработка', w:0.34 },
    { id:'sales',     label:'Продажи',    w:0.18 },
    { id:'finance',   label:'Финансы',    w:0.12 },
  ];
  // персональный рой сотрудника по отделу (тип агента → модель)
  const DEPT_SWARM = {
    analytics:[['analyst','sonnet'],['analyst','opus'],['review','haiku']],
    marketing:[['copy','opus'],['design','flux'],['analyst','sonnet'],['legal','llama']],
    design:[['design','flux'],['copy','sonnet'],['review','haiku']],
    dev:[['backend','opus'],['qa','haiku'],['review','opus'],['backend','sonnet']],
    sales:[['sales','sonnet'],['copy','haiku'],['legal','llama']],
    finance:[['analyst','sonnet'],['review','opus']],
  };
  const TEAM_SIZE = 8, AVG_SWARM = 6, SHARED_SKILLS = 124, NODE_CAP = 26;

  const SCALES = [
    { id:'startup', label:'Стартап',     people:10 },
    { id:'scaleup', label:'Скейлап',     people:500 },
    { id:'corp',    label:'Корпорация',  people:20000 },
  ];
  let scale = SCALES[0];
  let view = { level:'company', focus:null, crumb:[] };

  /* --- Производная модель организма от размера ---------------------------- */
  function model(N){
    let depts = DEPTS.map(d => {
      const people = Math.max(1, Math.round(N * d.w));
      const teams  = people > TEAM_SIZE ? Math.max(1, Math.round(people/TEAM_SIZE)) : 1;
      return { ...d, people, teams };
    });
    const sumP = depts.reduce((a,d)=>a+d.people,0);
    const teams = depts.reduce((a,d)=>a+d.teams,0);
    return { N, depts, people:sumP, teamsTotal:teams, swarms:sumP, agents:sumP*AVG_SWARM, skills:SHARED_SKILLS };
  }
  function dept(id){ return model(scale.people).depts.find(d=>d.id===id); }

  /* --- Утилиты ------------------------------------------------------------ */
  const lerp=(a,b,t)=>a+(b-a)*t;
  const dist2=(x1,y1,x2,y2)=>(x1-x2)**2+(y1-y2)**2;
  function rgba(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
  const C={acc:'#34d399',vio:'#a78bfa',blue:'#60a5fa',amber:'#fbbf24',cyan:'#22d3ee',pink:'#f472b6'};
  const modelColor=id=>({opus:C.vio,sonnet:C.blue,haiku:C.acc,gpt:C.blue,flux:C.amber,llama:C.cyan,whisper:C.cyan,
    o3:C.acc,gemini:C.blue,deepseek:C.cyan,mistral:C.amber,qwen:C.cyan,grok:C.blue,command:C.pink}[id]||C.blue);
  const NAMED_MODELS=['opus','sonnet','haiku','o3','gpt','gemini','deepseek','mistral','qwen','grok','command','llama','flux'];

  /* --- Построение текущего уровня дерева ---------------------------------- */
  function build(){
    nodes=[]; edges=[]; const cx=W/2, cy=H/2;
    const Rring = Math.min(W,H)*0.255, Rmodel = Math.min(W,H)*0.46;
    const m = model(scale.people);

    // ядро = текущая сущность
    const core = coreNode(cx,cy,m);
    nodes.push(core);

    // дети уровня
    let children = childrenOf(m);
    const shown = Math.min(children.length, NODE_CAP);
    for (let i=0;i<shown;i++){
      const ch = children[i];
      const ang = -Math.PI/2 + i/shown*TAU;
      const n = { ...ch, x:cx+Math.cos(ang)*Rring, y:cy+Math.sin(ang)*Rring, active:0, pulse:0, ang };
      nodes.push(n);
      edges.push({ a:core, b:n, kind:n.type==='dept'?'core':'agent', glow:0 });
    }
    if (children.length>shown){
      nodes.push({ id:'more', type:'more', x:cx, y:cy+Rring+30, r:0, active:0, pulse:0,
                   label:`+${children.length-shown} ещё (всего ${children.length})` });
    }
    // цепочка передачи работы — только на уровне компании
    if (view.level==='company'){
      const dn = nodes.filter(n=>n.type==='dept');
      for (let i=0;i<dn.length-1;i++) edges.push({ a:dn[i], b:dn[i+1], kind:'handoff', glow:0 });
    }
    // море моделей — на уровне компании и человека (где идёт маршрутизация)
    if (view.level==='company' || view.level==='person'){
      NAMED_MODELS.forEach((mid,i)=>{ const ang=-Math.PI/2+(i+0.5)/NAMED_MODELS.length*TAU;
        nodes.push({ id:`m-${mid}`, type:'model', x:cx+Math.cos(ang)*Rmodel, y:cy+Math.sin(ang)*Rmodel,
          r:7, label:MODELS[mid].name, sub:MODELS[mid].why, color:modelColor(mid), mid, active:0, pulse:0 }); });
      for (let i=0;i<96;i++){ const ang=i/96*TAU+0.12; const rr=Rmodel+(Math.sin(i*2.3)*0.5+0.5)*30-8;
        nodes.push({ id:`mb-${i}`, type:'modeldot', x:cx+Math.cos(ang)*rr, y:cy+Math.sin(ang)*rr, r:2.2, color:'#3a4459', active:0, pulse:0 }); }
    }
  }

  function coreNode(cx,cy,m){
    if (view.level==='company') return { id:'core', type:'core', x:cx, y:cy, r:26, label:'СРЕДА', sub:`${fmt(m.N)} человек`, color:C.acc, active:1, pulse:0 };
    if (view.level==='department'){ const d=dept(view.focus); return { id:'core', type:'core', x:cx,y:cy,r:24, label:d.label, sub:`${fmt(d.people)} чел · ${fmt(d.teams)} команд`, color:C.acc, active:1, pulse:0 }; }
    if (view.level==='team') return { id:'core', type:'core', x:cx,y:cy,r:22, label:view.teamLabel||'Команда', sub:`${TEAM_SIZE} человек`, color:C.acc, active:1, pulse:0 };
    if (view.level==='person') return { id:'core', type:'core', x:cx,y:cy,r:20, label:view.personLabel||'Сотрудник', sub:'личный рой агентов', color:C.acc, active:1, pulse:0 };
  }

  function childrenOf(m){
    if (view.level==='company')
      return m.depts.map(d=>({ id:d.id, type:'dept', r:15, label:d.label, sub:`${fmt(d.people)} чел`, color:C.acc, people:d.people, teams:d.teams }));
    if (view.level==='department'){
      const d = dept(view.focus);
      if (d.teams>1) return Array.from({length:d.teams},(_,i)=>({ id:`${d.id}-t${i}`, type:'team', r:11, label:`Команда ${i+1}`, sub:`${TEAM_SIZE} чел`, color:C.blue, deptId:d.id, idx:i }));
      return Array.from({length:d.people},(_,i)=>person(d.id,i));            // мало людей → сразу люди
    }
    if (view.level==='team'){ const did=view.focus.split('-t')[0];
      return Array.from({length:TEAM_SIZE},(_,i)=>person(did,i)); }
    if (view.level==='person'){
      const swarm = DEPT_SWARM[view.deptId] || DEPT_SWARM.dev;
      const pad = []; for (let i=0;i<AVG_SWARM;i++) pad.push(swarm[i%swarm.length]);
      return pad.map((s,i)=>({ id:`ag${i}`, type:'agent', r:9, label:AGENTS[s[0]].name, sub:AGENTS[s[0]].skill, emoji:AGENTS[s[0]].emoji, model:s[1], color:C.vio }));
    }
    return [];
  }
  function person(deptId,i){ return { id:`${deptId}-p${i}`, type:'person', r:8, label:`Сотрудник ${i+1}`, sub:`${labelOf(deptId)} · личный рой`, color:C.vio, deptId, idx:i }; }
  function labelOf(id){ return DEPTS.find(d=>d.id===id)?.label || id; }
  function fmt(n){ return n>=1000 ? (n/1000).toFixed(n%1000?1:0)+'k' : ''+n; }

  /* --- Навигация по дереву ------------------------------------------------ */
  function setView(v){ view=v; build(); emitView(); }
  function emitView(){
    const m = model(scale.people);
    onView && onView({ level:view.level, crumb:view.crumb, scale:{
      label:scale.label, people:m.N, depts:m.depts.length, teams:m.teamsTotal, swarms:m.swarms, agents:m.agents, skills:m.skills } });
  }
  function drill(n){
    if (n.type==='dept'){ view.crumb=[{label:'Компания',go:goCompany}]; setView({ level:'department', focus:n.id, crumb:[...view.crumb,{label:n.label}] }); }
    else if (n.type==='team'){ const did=n.deptId; setView({ level:'team', focus:n.id, deptId:did, teamLabel:n.label,
        crumb:[{label:'Компания',go:goCompany},{label:labelOf(did),go:()=>goDept(did)},{label:n.label}] }); }
    else if (n.type==='person'){ const did=n.deptId; setView({ level:'person', focus:n.id, deptId:did, personLabel:n.label,
        crumb:[{label:'Компания',go:goCompany},{label:labelOf(did),go:()=>goDept(did)},{label:n.label}] }); }
  }
  function goCompany(){ setView({ level:'company', focus:null, crumb:[] }); }
  function goDept(id){ setView({ level:'department', focus:id, crumb:[{label:'Компания',go:goCompany},{label:labelOf(id)}] }); }
  // публичная навигация (для UI-кликов и будущего авто-тура «кино»)
  function focusDept(id){ const d=dept(id); drill({ type:'dept', id, label:d.label, people:d.people, teams:d.teams }); }
  function focusTeam(deptId,idx=0){ drill({ type:'team', id:`${deptId}-t${idx}`, deptId, label:`Команда ${idx+1}` }); }
  function focusPerson(deptId,idx=0){ drill({ type:'person', id:`${deptId}-p${idx}`, deptId, label:`Сотрудник ${idx+1}`, sub:`${labelOf(deptId)} · личный рой` }); }
  function up(){ if (view.crumb.length){ const prev=view.crumb[view.crumb.length-2]; if (prev&&prev.go) prev.go(); else goCompany(); } }
  function setScale(id){ scale = SCALES.find(s=>s.id===id)||SCALES[0]; goCompany(); }

  /* --- Частицы ------------------------------------------------------------ */
  function spawn(a,b,color,speed=0.014,label){ particles.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,t:0,speed,color,label}); }
  function spawnBurst(a,b,color,n=6){ for(let i=0;i<n;i++) particles.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,t:-i*0.12,speed:0.016,color}); }
  // задачи по типам (цвет = домен): код · продажи · деньги · юр · дизайн · данные · HR
  const TASKS_T=[
    {t:'PR #483',c:C.blue},{t:'код-ревью',c:C.blue},{t:'деплой',c:C.blue},{t:'тест 143✓',c:C.blue},{t:'миграция БД',c:C.blue},
    {t:'КП',c:C.acc},{t:'follow-up',c:C.acc},{t:'лид',c:C.acc},{t:'кампания',c:C.acc},
    {t:'счёт',c:C.amber},{t:'инвойс',c:C.amber},{t:'бюджет',c:C.amber},{t:'платёж',c:C.amber},
    {t:'38-ФЗ',c:C.red||'#f87171'},{t:'DPA',c:'#f87171'},{t:'договор',c:'#f87171'},
    {t:'макет',c:C.vio},{t:'UI-кит',c:C.vio},{t:'иконки',c:C.vio},
    {t:'SQL-запрос',c:C.cyan},{t:'отчёт',c:C.cyan},{t:'дашборд',c:C.cyan},
    {t:'скрининг',c:C.pink},{t:'оффер',c:C.pink},{t:'онбординг',c:C.pink},
  ];
  const rndTask=()=>TASKS_T[Math.floor(Math.random()*TASKS_T.length)];
  // всплеск: волна типизированных задач из ядра по компании (для «Запустить рой» и кликов)
  function surge(n=24){ const core=nodes.find(x=>x.id==='core'); const dn=nodes.filter(x=>['dept','team','person','agent'].includes(x.type));
    if(!core||!dn.length) return;
    for(let i=0;i<n;i++){ const a=dn[Math.floor(Math.random()*dn.length)]; const task=Math.random()<0.6?rndTask():null;
      particles.push({ax:core.x,ay:core.y,bx:a.x,by:a.y,t:-i*0.03,speed:0.017,color:task?rgba(task.c,0.85):'rgba(52,211,153,0.75)',label:task});
      a.pulse=Math.max(a.pulse,0.5); }
    core.pulse=1; ambientStats.doneToday+=Math.round(20+Math.random()*30); }

  /* --- Рендер ------------------------------------------------------------- */
  const PREFERS_REDUCED=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function draw(now){
    const t=PREFERS_REDUCED?0:(now-t0)/1000; ctx.clearRect(0,0,W,H);
    const cx=W/2, cy=H/2;
    /* темочувствительные «чернила»: тёмные подписи на светлой теме, светлые — на тёмной */
    const _lt=document.documentElement.getAttribute('data-theme')==='light';
    const INK=_lt
      ?{label:'#4a3f6b',label2:'#6a5f8c',faint:'#8a80a8',glyph:'#2a2140',nodeOff:'rgba(150,130,200,0.30)',stroke:'rgba(70,50,130,0.20)'}
      :{label:'#cfd6e4',label2:'#aeb6c6',faint:'#8a93a6',glyph:'#ffffff',nodeOff:'rgba(20,24,34,0.9)',stroke:'rgba(255,255,255,0.10)'};
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(W,H)*0.5);
    g.addColorStop(0,'rgba(52,211,153,0.05)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    edges.forEach(e=>{ const base=e.kind==='handoff'?0.06:0.05, a=base+e.glow*0.5;
      ctx.strokeStyle=e.kind==='handoff'?rgba('#34d399',a):rgba(INK.faint,a*0.9);
      ctx.lineWidth=e.kind==='handoff'?1.6+e.glow*2:1+e.glow*1.4; ctx.beginPath();
      if(e.kind==='handoff'){ const mx=(e.a.x+e.b.x)/2,my=(e.a.y+e.b.y)/2,ox=(cx-mx)*0.28,oy=(cy-my)*0.28;
        ctx.moveTo(e.a.x,e.a.y); ctx.quadraticCurveTo(mx+ox,my+oy,e.b.x,e.b.y); }
      else { ctx.moveTo(e.a.x,e.a.y); ctx.lineTo(e.b.x,e.b.y); } ctx.stroke(); e.glow*=0.96; });

    particles=particles.filter(p=>p.t<1); particles.forEach(p=>{ p.t+=p.speed; if(p.t<0)return;
      const x=lerp(p.ax,p.bx,p.t),y=lerp(p.ay,p.by,p.t);
      ctx.beginPath(); ctx.arc(x,y,p.label?3.1:2.6,0,TAU); ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
      if(p.label){ const al=0.9*(1-Math.abs(p.t-0.5)*1.5); if(al>0.05){ ctx.fillStyle=rgba(toHex(p.label.c),al); ctx.font='600 9px Inter, system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(p.label.t,x,y-8); } } });

    nodes.forEach(n=>{
      if(n.type==='more'){ ctx.fillStyle=rgba(INK.faint,0.5); ctx.font='600 11px Inter'; ctx.textAlign='center'; ctx.fillText(n.label,n.x,n.y); return; }
      const breathe=n.type==='core'?(Math.sin(t*1.4)*0.5+0.5):0; const act=n.active; n.pulse*=0.93;
      const rr=(n.r||9)+breathe*3+n.pulse*6;
      if((act>0.02||n.pulse>0.02)&&n.type!=='modeldot'){ ctx.beginPath(); ctx.arc(n.x,n.y,rr+10,0,TAU); ctx.fillStyle=rgba(toHex(n.color),0.10*Math.max(act,n.pulse)); ctx.fill(); }
      ctx.beginPath(); ctx.arc(n.x,n.y,rr,0,TAU);
      if(n.type==='modeldot') ctx.fillStyle=n.active>0.1?rgba(toHex(n.color),0.9):'rgba(90,100,120,0.45)';
      else if(n.type==='core') ctx.fillStyle=rgba('#34d399',0.18);
      else ctx.fillStyle=act>0.05?rgba(toHex(n.color),0.22+0.2*act):INK.nodeOff;
      ctx.fill();
      ctx.lineWidth=(hover===n||selected===n)?2.4:1.4;
      ctx.strokeStyle=(act>0.05||hover===n||selected===n)?n.color:INK.stroke;
      ctx.shadowColor=n.color; ctx.shadowBlur=(act>0.05||hover===n)?14:0; ctx.stroke(); ctx.shadowBlur=0;

      if(n.type==='core'){ glyph(n.x,n.y,'◆',15,C.acc); label(n,n.label,11,C.acc,40); if(n.sub) label(n,n.sub,10,INK.faint,55); }
      else if(n.type==='dept'){ ctx.fillStyle=act>0.05?C.acc:INK.label; ctx.beginPath(); ctx.arc(n.x,n.y,2.4,0,TAU); ctx.fill(); label(n,n.label,12.5,act>0.05?C.acc:INK.label2); if(hover===n) label(n,n.sub,10,INK.faint,n.r+26); }
      else if(n.type==='team'){ glyph(n.x,n.y,'👥',11,INK.label); if(hover===n||selected===n) label(n,n.label,10.5,INK.label); }
      else if(n.type==='person'){ glyph(n.x,n.y,'•',13,act>.05?INK.glyph:INK.label2); if(hover===n||selected===n) label(n,n.label,10,INK.label); }
      else if(n.type==='agent'&&(hover===n||selected===n||act>0.4)){ glyph(n.x,n.y,n.emoji,11,INK.glyph); label(n,n.label,10.5,INK.label); }
      else if(n.type==='model'){ label(n,n.label,10.5,hover===n?n.color:INK.faint); }
    });
    raf=requestAnimationFrame(draw);
  }
  function toHex(c){ return c&&c[0]==='#'?c:'#34d399'; }
  function glyph(x,y,s,size,color){ ctx.fillStyle=color; ctx.font=`${size}px Inter, system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }
  function label(n,txt,size,color,dy){ ctx.fillStyle=color; ctx.font=`600 ${size}px Inter, system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,n.x,n.y+(dy||((n.r||9)+13))); }

  /* --- Интерактивность ---------------------------------------------------- */
  function pick(mx,my){ let best=null,bd=1e9; for(const n of nodes){ if(n.type==='modeldot'||n.type==='more')continue;
    const d=dist2(mx,my,n.x,n.y), rr=((n.r||9)+8)**2; if(d<rr&&d<bd){bd=d;best=n;} } return best; }
  function onMove(e){ const r=cv.getBoundingClientRect(); hover=pick(e.clientX-r.left,e.clientY-r.top);
    cv.style.cursor=hover?(['dept','team','person'].includes(hover.type)?'zoom-in':'pointer'):'default'; }
  function onClick(e){ const r=cv.getBoundingClientRect(); const n=pick(e.clientX-r.left,e.clientY-r.top);
    if(!n) return;
    if(n.type==='core'){ up(); return; }
    if(['dept','team','person'].includes(n.type)){ selected=n; onSelect&&onSelect(n,levelMeta()); drill(n); return; }
    selected=n; onSelect&&onSelect(n,levelMeta()); }
  function levelMeta(){ return { level:view.level, scale:scale }; }

  /* --- Сценарий цели: ОДИН примитив, работает на любом уровне дерева ------- */
  async function runGoal(goal, hud){
    if (scenarioActive) return; scenarioActive=true;
    const core=nodes.find(n=>n.id==='core'); core.pulse=1;
    hud&&hud({goal,level:view.level,activeAgents:0,tasksFlown:0,models:0,cost:0,progress:0});
    await sleepO(450);
    if (view.level==='company') await runCompany(core, hud);
    else                        await runLevel(core, hud);   // отдел / команда / человек
    setTimeout(()=>nodes.forEach(n=>{ if(n.type!=='core') n.active=0; }),2600);
    scenarioActive=false;
  }

  // уровень компании: межотделовый поток с передачей работы
  async function runCompany(core, hud){
    let activeAgents=0,tasksFlown=0,modelsUsed=new Set(),cost=0,done=0;
    const upd=()=>hud&&hud({activeAgents,tasksFlown,models:modelsUsed.size,cost:Math.round(cost),progress:Math.round(done/DEPTS.length*100)});
    let prev=null;
    for(const d of DEPTS){ const dn=nodes.find(n=>n.id===d.id); if(!dn) continue;
      if(prev){ const e=edges.find(x=>x.kind==='handoff'&&((x.a===prev&&x.b===dn)||(x.a===dn&&x.b===prev))); if(e){e.glow=1; spawnBurst(prev,dn,C.acc,8);} }
      else { spawnBurst(core,dn,C.acc,8); const e=edges.find(x=>x.a===core&&x.b===dn); if(e)e.glow=1; }
      dn.active=1; dn.pulse=1; await sleepO(420);
      for(const s of (DEPT_SWARM[d.id]||[]).slice(0,2)){ activeAgents++; tasksFlown++; const mid=s[1]; modelsUsed.add(mid); cost+=MODELS[mid].cost*2.3;
        const mn=nodes.find(n=>n.id===`m-${mid}`); if(mn){ mn.active=1; mn.pulse=1; spawn(dn,mn,modelColor(mid),0.02); spawn(mn,dn,modelColor(mid),0.02); }
        upd(); await sleepO(300); }
      done++; upd(); prev=dn; await sleepO(180);
    }
    DEPTS.forEach(d=>{ const dn=nodes.find(n=>n.id===d.id); if(dn) spawnBurst(dn,core,C.acc,5); });
    core.pulse=1; await sleepO(900);
    hud&&hud({done:true,synthUp:true,activeAgents,tasksFlown,models:modelsUsed.size,cost:Math.round(cost),progress:100});
  }

  // любой нижний уровень: тот же примитив — рой исполнителей → маршрут на модели → синтез наверх
  async function runLevel(core, hud){
    const ring=nodes.filter(n=>['agent','team','person','dept'].includes(n.type));
    let activeAgents=0,tasksFlown=0,modelsUsed=new Set(),cost=0,done=0;
    const upd=()=>hud&&hud({activeAgents,tasksFlown,models:modelsUsed.size,cost:Math.round(cost),progress:Math.round(done/Math.max(1,ring.length)*100)});
    for(const ch of ring){ ch.active=1; ch.pulse=1; spawnBurst(core,ch,C.vio,4); activeAgents++; tasksFlown++;
      if(ch.type==='agent'&&ch.model){ const mn=nodes.find(n=>n.id===`m-${ch.model}`); modelsUsed.add(ch.model); cost+=MODELS[ch.model].cost*2.3;
        if(mn){ mn.active=1; mn.pulse=1; spawn(ch,mn,modelColor(ch.model),0.024); spawn(mn,ch,modelColor(ch.model),0.024); } }
      upd(); await sleepO(300);
    }
    ring.forEach(ch=>spawnBurst(ch,core,C.acc,4));   // синтез наверх по дереву
    core.pulse=1; await sleepO(850);
    hud&&hud({done:true,synthUp:true,activeAgents,tasksFlown,models:modelsUsed.size,cost:Math.round(cost),progress:100});
  }
  const sleepO=ms=>new Promise(r=>setTimeout(r,ms));

  let ambientTimer, ambientStats={ inflight:0, doneToday:0 };
  // сколько задач в фоне «бежит» — растёт с размером компании
  function ambientBurst(){ return scale.people>=20000?7 : scale.people>=500?4 : 2; }
  function ambient(){ if(scenarioActive){ return; }
    const core=nodes.find(n=>n.id==='core'); if(!core) return;
    const dn=nodes.filter(n=>['dept','team','person','agent'].includes(n.type));
    const mods=nodes.filter(n=>n.type==='model');
    if(!dn.length) return;
    const burst=ambientBurst();
    for(let k=0;k<burst;k++){
      const a=dn[Math.floor(Math.random()*dn.length)];
      const task=Math.random()<0.4?rndTask():null;
      spawn(core,a, task?rgba(task.c,0.7):'rgba(52,211,153,0.55)', 0.011+Math.random()*0.012, task||undefined);
      a.pulse=Math.max(a.pulse,0.3);
      const e=edges.find(x=>x.a===core&&x.b===a); if(e) e.glow=Math.max(e.glow,0.4);
      if(mods.length && Math.random()<0.6){ const m=mods[Math.floor(Math.random()*mods.length)];
        spawn(a,m,m.color,0.02); spawn(m,a,m.color,0.02); m.pulse=Math.max(m.pulse,0.4); }
      if(Math.random()<0.3) spawn(a,core,'rgba(52,211,153,0.5)',0.016);
      ambientStats.doneToday += Math.round(1+Math.random()*3);
    }
    core.pulse=Math.max(core.pulse,0.22);
    // «в работе сейчас» ~ агенты × коэффициент загрузки, шумит вокруг базы
    const base=Math.round(model(scale.people).agents*0.18);
    ambientStats.inflight = Math.max(0, base + Math.round((Math.random()-0.5)*base*0.4));
  }
  function getAmbient(){ return { ...ambientStats, rate:ambientBurst() }; }

  /* --- Жизненный цикл ----------------------------------------------------- */
  function resize(){ const r=cv.parentElement.getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
    W=r.width; H=r.height; cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0); build(); }
  function init(canvas,opts={}){ cv=canvas; ctx=cv.getContext('2d'); onSelect=opts.onSelect; onView=opts.onView;
    selected=null; hover=null; particles=[]; scale=SCALES[0]; view={level:'company',focus:null,crumb:[]};
    resize(); emitView(); t0=performance.now();
    cv.addEventListener('mousemove',onMove); cv.addEventListener('click',onClick); window.addEventListener('resize',resize);
    ambientStats={ inflight:0, doneToday:Math.round(1200+Math.random()*400) };
    cancelAnimationFrame(raf); raf=requestAnimationFrame(draw); clearInterval(ambientTimer); ambientTimer=setInterval(ambient,420); }
  function destroy(){ cancelAnimationFrame(raf); clearInterval(ambientTimer);
    cv&&cv.removeEventListener('mousemove',onMove); cv&&cv.removeEventListener('click',onClick); window.removeEventListener('resize',resize); }

  return { init, destroy, runGoal, surge, setScale, goCompany, focusDept, focusTeam, focusPerson, getAmbient,
           SCALES, DEPTS, model:()=>model(scale.people),
           get view(){return {level:view.level,focus:view.focus};},
           get scale(){return scale;}, get scenarioActive(){return scenarioActive;} };
})();
