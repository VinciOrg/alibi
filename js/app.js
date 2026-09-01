(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const THEMES=window.INTRUSO_THEMES||[];
const PREF_KEY='alibi_prefs_v05', LEGACY_PREF_KEYS=['alibi_prefs_v04'], USED_TERMS_KEY='alibi_used_terms_v04', REPEAT_WINDOW_MS=3*60*60*1000;
const VALID_THEME_IDS=new Set(THEMES.map(t=>t.id));
const THEME_ID_MIGRATION={
  filmes:'filmes',series:'series',jogos:'jogos',
  animes:'animes-desenhos',desenhos:'animes-desenhos',
  comidas:'comidas-bebidas',bebidas:'comidas-bebidas',
  objetos:'objetos-tecnologia',tecnologia:'objetos-tecnologia',marcas:'objetos-tecnologia',
  animais:'animais-natureza',natureza:'animais-natureza',
  esportes:'esportes',musica:'musica',
  brasil:'cotidiano',transporte:'cotidiano',escola:'cotidiano',roupas:'cotidiano'
};
const difficultyText={
  easy:'Mesmo microgrupo, mas com diferença mais clara entre os termos.',
  normal:'Relação direta dentro da mesma família semântica.',
  hard:'Termos próximos dentro do mesmo microgrupo.',
  insane:'Quase gêmeos: vizinhos ou variantes muito próximas do mesmo microgrupo.'
};
const tips=[
  'Não diga a palavra diretamente. Dê pistas que só quem conhece o contexto entenderia.',
  'Uma pista específica demais pode ajudar os civis e também revelar sua palavra.',
  'Observe quem repete ideias dos outros em vez de criar uma pista própria.',
  'O impostor também recebeu uma palavra relacionada. Não espere uma pista completamente sem sentido.',
  'Use exemplos, sensações, lugares e situações sem citar o termo exato.',
  'Se todo mundo jogar seguro demais, o impostor fica confortável. Arrisque uma pista inteligente.'
];
const state={
  screen:'home',history:[],selectedThemes:new Set(),players:[],config:{impostors:1,time:10,lives:2,rounds:2,difficulty:'normal',revealRole:true,secretVote:true},
  game:null,sound:true,timerId:null,toastId:null,audio:null,revealTimer:null,revealCountdownId:null,revealTransition:null
};

function loadPrefs(){
  let p=null;
  try{
    p=JSON.parse(localStorage.getItem(PREF_KEY)||'null');
    if(!p){
      for(const legacyKey of LEGACY_PREF_KEYS){
        p=JSON.parse(localStorage.getItem(legacyKey)||'null');
        if(p)break;
      }
    }
    if(p){
      Object.assign(state.config,p.config||{});
      state.sound=p.sound!==false;
      if(Array.isArray(p.selectedThemes)&&p.selectedThemes.length){
        p.selectedThemes.forEach(oldId=>{
          const mapped=THEME_ID_MIGRATION[oldId]||oldId;
          if(VALID_THEME_IDS.has(mapped))state.selectedThemes.add(mapped);
        });
      }
    }
  }catch(_){}
  if(!state.selectedThemes.size)THEMES.forEach(t=>state.selectedThemes.add(t.id));
}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({config:state.config,sound:state.sound,selectedThemes:[...state.selectedThemes]}));}catch(_){}}
function activeScreen(){return $(`.screen[data-screen="${state.screen}"]`)}
function showScreen(name,{push=true}={}){
  if(push && state.screen!==name) state.history.push(state.screen);
  $$('.screen').forEach(x=>x.classList.remove('active')); state.screen=name; const s=$(`#screen-${name}`); if(s)s.classList.add('active');
  const home=name==='home'; $('#topbar').classList.toggle('hidden',home||['starter','round','vote-pass','result','end'].includes(name));
  const meta={themes:['TEMAS','Biblioteca'],setup:['PARTIDA','Configuração'],reveal:['SEGREDO','Distribuição'],vote:['VOTAÇÃO','Escolha secreta']}[name];
  if(meta){$('#topKicker').textContent=meta[0];$('#topTitle').textContent=meta[1];}
  window.scrollTo({top:0,behavior:'instant'});
}
function back(){
  if(['reveal','starter','round','vote-pass','vote','result'].includes(state.screen) && state.game){confirmModal('Abandonar partida?','O progresso desta partida será perdido.',[{label:'Continuar jogando'},{label:'Abandonar',danger:true,action:()=>endToHome()}]);return;}
  const prev=state.history.pop()||'home';showScreen(prev,{push:false});
}
function endToHome(){stopTimer();clearRevealSequence();state.game=null;state.history=[];closeModal();showScreen('home',{push:false});updateHome();}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(state.toastId);state.toastId=setTimeout(()=>t.classList.add('hidden'),2200)}
function confirmModal(title,text,actions){$('#modalTitle').textContent=title;$('#modalText').textContent=text;const box=$('#modalActions');box.innerHTML='';actions.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.className=(a.primary?'primary ':'')+(a.danger?'danger':'');b.addEventListener('click',()=>{if(a.action)a.action();else closeModal();});box.appendChild(b)});$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
function haptic(ms=18){try{navigator.vibrate?.(ms)}catch(_){}}
function tone(freq=520,dur=.07,type='sine',vol=.035){if(!state.sound)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!state.audio)state.audio=new AC();const c=state.audio;if(c.state==='suspended')c.resume();const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+dur)}catch(_){}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function initials(n){return n.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?'}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rand(a){return a[Math.floor(Math.random()*a.length)]}

function updateHome(){
  $('#themeStat').textContent=THEMES.length;const terms=THEMES.reduce((n,t)=>n+t.count,0);$('#termStat').textContent=terms.toLocaleString('pt-BR')+'+';
  $('#homeThemeCount').textContent=state.selectedThemes.size===THEMES.length?'Todos':`${state.selectedThemes.size} temas`;
  document.body.classList.toggle('muted',!state.sound);
}
function renderThemes(filter=''){
  const q=filter.trim().toLocaleLowerCase('pt-BR');const grid=$('#themesGrid');grid.innerHTML='';
  THEMES.filter(t=>!q||t.name.toLocaleLowerCase('pt-BR').includes(q)||t.description.toLocaleLowerCase('pt-BR').includes(q)).forEach(t=>{
    const b=document.createElement('button');b.type='button';b.className='theme-card'+(state.selectedThemes.has(t.id)?' selected':'');b.dataset.id=t.id;
    b.innerHTML=`<div class="theme-art"><img src="${t.art}" alt=""><span class="theme-check"></span></div><div class="theme-copy"><strong>${esc(t.name)}${t.popular?'<em class="theme-badge">POPULAR</em>':''}</strong><span>${Number(t.count||0).toLocaleString('pt-BR')} termos · ${Number(t.microgroupCount||0)} microgrupos</span></div>`;
    b.addEventListener('click',()=>{tone(590,.04);haptic(10);state.selectedThemes.has(t.id)?state.selectedThemes.delete(t.id):state.selectedThemes.add(t.id);renderThemes($('#themeSearch').value);updateThemeSelection();savePrefs()});grid.appendChild(b);
  });updateThemeSelection();
}
function updateThemeSelection(){$('#selectedThemesText').textContent=`${state.selectedThemes.size} selecionado${state.selectedThemes.size===1?'':'s'}`;$('#themesDoneBtn').disabled=!state.selectedThemes.size;$('#themesDoneBtn').style.opacity=state.selectedThemes.size?1:.45;}

function renderPlayers(){
  const list=$('#playersList');list.innerHTML='';state.players.forEach((p,i)=>{const row=document.createElement('div');row.className='player-row';row.innerHTML=`<div class="player-avatar">${esc(initials(p))}</div><span>${esc(p)}</span><button class="remove-player" type="button" aria-label="Remover ${esc(p)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;row.querySelector('button').addEventListener('click',()=>{state.players.splice(i,1);renderPlayers();syncConfig()});list.appendChild(row)});syncConfig();
}
function syncConfig(){
  const maxImp=Math.max(1,state.players.length-2);state.config.impostors=Math.min(state.config.impostors,maxImp);const ir=$('#impostorRange');ir.max=maxImp;ir.value=state.config.impostors;$('#impostorValue').textContent=state.config.impostors;
  $('#timeRange').value=state.config.time;$('#timeValue').textContent=`${state.config.time} min`;$('#livesRange').value=state.config.lives;$('#livesValue').textContent=state.config.lives;$('#roundsRange').value=state.config.rounds;$('#roundsValue').textContent=state.config.rounds;
  $$('#difficultySeg button').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===state.config.difficulty));$('#difficultyHelp').textContent=difficultyText[state.config.difficulty];
  $('#revealRoleToggle').checked=state.config.revealRole;$('#secretVoteToggle').checked=state.config.secretVote;updateRepeatClock();
}
function addPlayer(name){name=name.trim().replace(/\s+/g,' ');if(!name)return;if(state.players.some(x=>x.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){toast('Esse nome já está na partida.');return}state.players.push(name);tone(640,.05);renderPlayers();}

function normWord(s){return String(s).trim().toLocaleLowerCase('pt-BR')}
function loadWordHistory(){
  const now=Date.now();let h=null;
  try{h=JSON.parse(localStorage.getItem(USED_TERMS_KEY)||'null')}catch(_){}
  if(!h||!Number.isFinite(h.resetAt)||now>=h.resetAt||!Array.isArray(h.terms))h={resetAt:now+REPEAT_WINDOW_MS,terms:[],groups:[]};
  h.terms=h.terms.filter(x=>x&&typeof x.word==='string'&&now-x.at<REPEAT_WINDOW_MS);
  h.groups=Array.isArray(h.groups)?h.groups.filter(x=>x&&now-x.at<REPEAT_WINDOW_MS):[];
  try{localStorage.setItem(USED_TERMS_KEY,JSON.stringify(h))}catch(_){}
  return h;
}
function saveWordHistory(h){try{localStorage.setItem(USED_TERMS_KEY,JSON.stringify(h))}catch(_){} updateRepeatClock();}
function updateRepeatClock(){
  const el=$('#repeatWindowText');if(!el)return;const h=loadWordHistory(),left=Math.max(0,h.resetAt-Date.now());
  const s=Math.ceil(left/1000),hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;
  el.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function microgroupCandidates(theme,micro,level){
  const items=[...new Set((micro.items||[]).filter(Boolean))];
  const out=[];if(items.length<2)return out;
  if(level==='insane'&&micro.insaneSafe===false)return out;

  const n=items.length,maxGap=Math.max(1,n-1);
  const ranges={
    easy:[Math.max(1,Math.ceil(maxGap*.55)),maxGap],
    normal:[Math.max(1,Math.floor(maxGap*.20)),Math.max(1,Math.ceil(maxGap*.80))],
    hard:[1,Math.max(1,Math.ceil(maxGap*.42))],
    insane:[1,Math.max(1,Math.ceil(maxGap*.20))]
  };
  const [minGap,maxAllowed]=ranges[level]||ranges.normal;
  const score={easy:1,normal:2,hard:3,insane:4}[level]||2;

  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const gap=j-i;
      if(gap>=minGap&&gap<=maxAllowed)out.push({theme,micro,pair:[items[i],items[j]],score,gap});
    }
  }
  if(!out.length&&n===2)out.push({theme,micro,pair:[items[0],items[1]],score,gap:1});
  return out;
}
function chooseWords(){
  const pool=THEMES.filter(t=>state.selectedThemes.has(t.id));if(!pool.length)throw Error('Selecione pelo menos um tema.');
  const level=state.config.difficulty||'normal',h=loadWordHistory(),used=new Set(h.terms.map(x=>x.word)),recentMicrogroups=new Map();
  h.groups.forEach(x=>recentMicrogroups.set(x.key,(recentMicrogroups.get(x.key)||0)+1));

  let candidates=[];
  pool.forEach(theme=>(theme.microgroups||[]).forEach(micro=>{
    const key=`${theme.id}::${micro.id}`;
    microgroupCandidates(theme,micro,level).forEach(c=>{
      c.groupKey=key;
      c.recentPenalty=recentMicrogroups.get(key)||0;
      candidates.push(c);
    });
  }));

  candidates=candidates.filter(c=>!used.has(normWord(c.pair[0]))&&!used.has(normWord(c.pair[1])));
  if(!candidates.length)throw Error('As palavras dos temas selecionados já foram usadas nas últimas 3 horas. Escolha mais temas ou aguarde o contador renovar.');

  const minPenalty=Math.min(...candidates.map(c=>c.recentPenalty));
  let shortlist=candidates.filter(c=>c.recentPenalty<=minPenalty+1);
  shortlist=shuffle(shortlist).slice(0,Math.min(shortlist.length,320));

  const picked=rand(shortlist),pair=picked.pair,theme=picked.theme,flip=Math.random()<.5;
  const civil=flip?pair[1]:pair[0],impostor=flip?pair[0]:pair[1],now=Date.now();
  h.terms.push({word:normWord(civil),label:civil,at:now},{word:normWord(impostor),label:impostor,at:now});
  h.groups.push({key:picked.groupKey,at:now});
  h.terms=h.terms.slice(-1800);h.groups=h.groups.slice(-500);saveWordHistory(h);

  return {theme,civil,impostor,groupName:picked.micro.cluster,microgroupId:picked.micro.id,source:picked.micro.source,similarity:picked.score};
}
function startGame(){
  if(state.players.length<3){$('#setupWarning').textContent='Adicione pelo menos 3 jogadores.';return}
  if(state.config.impostors>=state.players.length-1){$('#setupWarning').textContent='Precisa haver pelo menos 2 civis.';return}
  if(!state.selectedThemes.size){$('#setupWarning').textContent='Escolha pelo menos um tema.';return}
  $('#setupWarning').textContent='';let words;try{words=chooseWords()}catch(err){$('#setupWarning').textContent=err?.message||'Não foi possível sortear palavras agora.';toast('Escolha outros temas ou aguarde a renovação do acervo.');return}
  // A ordem da roda é a ordem EXATA cadastrada pelo grupo.
  // Só o papel de impostor é sorteado; a lista nunca é embaralhada.
  const order=state.players.map((name,id)=>({id,name,alive:true,role:'civil',word:words.civil}));
  const impostorIds=shuffle(order.map(p=>p.id)).slice(0,state.config.impostors);
  const impostorSet=new Set(impostorIds);
  order.forEach(p=>{if(impostorSet.has(p.id)){p.role='impostor';p.word=words.impostor}});
  state.game={players:order,words,lives:state.config.lives,maxLives:state.config.lives,revealIndex:0,revealSeen:false,starter:null,cycle:1,round:1,timeLeft:state.config.time*60,totalTime:state.config.time*60,paused:false,voteIndex:0,votes:{},voteChoice:null,candidateIds:null,tieRound:0,lastEliminated:null,winner:null};
  savePrefs();prepareReveal();showScreen('reveal');tone(420,.08,'triangle');
}
function currentRevealPlayer(){return state.game.players[state.game.revealIndex]}
function clearRevealSequence(){
  if(state.revealTimer){clearTimeout(state.revealTimer);state.revealTimer=null}
  if(state.revealTransition){clearTimeout(state.revealTransition);state.revealTransition=null}
  if(state.revealCountdownId){clearInterval(state.revealCountdownId);state.revealCountdownId=null}
  if(state.handoffTimer){clearInterval(state.handoffTimer);state.handoffTimer=null}
}
function setRevealStatus(label,count,mode=''){
  const box=$('#revealStatus');if(!box)return;box.classList.remove('revealing','handoff');if(mode)box.classList.add(mode);
  $('#revealStatusLabel').textContent=label;$('#revealStatusCount').textContent=count;
}
function prepareReveal({handoff=false}={}){
  clearRevealSequence();const g=state.game,p=currentRevealPlayer();if(!g||!p)return;
  g.revealSeen=false;g.revealBusy=handoff;g.handoffLocked=handoff;
  $('#revealProgressText').textContent=`${g.revealIndex+1} de ${g.players.length}`;
  $('#revealProgressBar').style.width=`${((g.revealIndex+1)/g.players.length)*100}%`;
  $('#revealPlayerName').textContent=p.name;$('#coverPlayerName').textContent=p.name;
  $('#roleName').textContent=p.role==='impostor'?'IMPOSTOR':'CIVIL';$('#secretWord').textContent=p.word;
  $('#roleHint').textContent=p.role==='impostor'?'Sua palavra é muito relacionada à dos civis. Use as pistas para se misturar sem entregar a diferença.':'A maioria recebeu exatamente esta palavra. Dê pistas sem falar o termo e observe quem parece estar se adaptando.';
  const card=$('#revealCard'),btn=$('#revealToggleBtn');card.classList.remove('revealed','closing');$('.reveal-under').classList.toggle('impostor',p.role==='impostor');
  btn.classList.remove('counting','handoff-lock');
  if(handoff){
    btn.disabled=true;btn.classList.add('handoff-lock');let sec=2;setRevealStatus('TROCA PROTEGIDA',`${sec}s`,'handoff');btn.innerHTML=`<span>Passe para ${esc(p.name)}</span><small>aguarde ${sec}s antes de revelar</small>`;
    state.handoffTimer=setInterval(()=>{sec--;if(sec<=0){clearInterval(state.handoffTimer);state.handoffTimer=null;g.handoffLocked=false;g.revealBusy=false;btn.disabled=false;btn.classList.remove('handoff-lock');btn.innerHTML='<span>Pressione para revelar</span><small>fica visível por 5 segundos</small>';setRevealStatus('PRONTO PARA REVELAR','—');tone(560,.04,'triangle');}else{setRevealStatus('TROCA PROTEGIDA',`${sec}s`,'handoff');btn.innerHTML=`<span>Passe para ${esc(p.name)}</span><small>aguarde ${sec}s antes de revelar</small>`;}},1000);
  }else{
    btn.disabled=false;btn.innerHTML='<span>Pressione para revelar</span><small>fica visível por 5 segundos</small>';setRevealStatus('PRONTO PARA REVELAR','—');
  }
}
function revealForFiveSeconds(){
  const g=state.game;if(!g||g.revealBusy||g.handoffLocked||state.screen!=='reveal')return;const p=currentRevealPlayer();g.revealSeen=true;g.revealBusy=true;
  const card=$('#revealCard'),btn=$('#revealToggleBtn');card.classList.remove('closing');card.classList.add('revealed');btn.disabled=true;btn.classList.add('counting');let seconds=5;
  setRevealStatus('MEMORIZE SUA PALAVRA',`${seconds}s`,'revealing');btn.innerHTML=`<span>Memorize sua palavra</span><small>ocultando automaticamente</small>`;tone(p.role==='impostor'?220:620,.09,'triangle');haptic(25);
  state.revealCountdownId=setInterval(()=>{seconds=Math.max(1,seconds-1);setRevealStatus('MEMORIZE SUA PALAVRA',`${seconds}s`,'revealing');},1000);
  state.revealTimer=setTimeout(closeRevealAndAdvance,5000);
}
function closeRevealAndAdvance(){
  const g=state.game;if(!g)return;if(state.revealCountdownId){clearInterval(state.revealCountdownId);state.revealCountdownId=null}state.revealTimer=null;
  const card=$('#revealCard'),btn=$('#revealToggleBtn');card.classList.add('closing');card.classList.remove('revealed');btn.disabled=true;btn.classList.remove('counting');btn.classList.add('handoff-lock');
  setRevealStatus('OCULTANDO PALAVRA','…','handoff');btn.innerHTML='<span>Palavra protegida</span><small>não toque ainda</small>';tone(430,.045,'triangle');haptic(12);
  state.revealTransition=setTimeout(()=>{state.revealTransition=null;if(!state.game||state.screen!=='reveal')return;card.classList.remove('closing');g.revealIndex++;
    if(g.revealIndex>=g.players.length){g.revealBusy=false;g.handoffLocked=false;prepareStarter();showScreen('starter');return}
    // Critical v0.4 safety: the NEXT player is shown only after the old card is fully closed,
    // then receives a mandatory 2-second tap lock to absorb accidental double taps.
    prepareReveal({handoff:true});
  },560);
}
function prepareStarter(){const g=state.game,alive=g.players.filter(p=>p.alive);g.starter=rand(alive);g.round=1;g.timeLeft=g.totalTime;$('#starterName').textContent=g.starter.name;$('#starterInfo').textContent='Depois dessa pessoa, siga no sentido horário.';$('#starterRounds').textContent=`${state.config.rounds} volta${state.config.rounds===1?'':'s'}`;$('#starterTimer').textContent=`${state.config.time} minuto${state.config.time===1?'':'s'}`;$('#starterLives').textContent=`${g.lives} vida${g.lives===1?'':'s'}`;}

function startDiscussion(){showScreen('round');renderRound();startTimer();tone(760,.07,'triangle')}
function renderRound(){const g=state.game;if(!g)return;$('#roundCounter').textContent=`Volta ${g.round} de ${state.config.rounds}`;$('#roundStarter').textContent=`Começou: ${g.starter.name}`;$('#roundTip').textContent=tips[(g.cycle+g.round-2)%tips.length];renderLives();updateTimerUI();$('#nextRoundBtn').textContent=g.round>=state.config.rounds?'Voltas concluídas':'Finalizar volta';}
function renderLives(){const g=state.game;$('#livesText').textContent=`${g.lives} restante${g.lives===1?'':'s'}`;const box=$('#lifePips');box.innerHTML='';for(let i=0;i<g.maxLives;i++){const x=document.createElement('i');if(i>=g.lives)x.classList.add('lost');box.appendChild(x)}}
function startTimer(){stopTimer();state.game.paused=false;$('#pauseBtn').innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';state.timerId=setInterval(()=>{const g=state.game;if(!g||g.paused)return;g.timeLeft=Math.max(0,g.timeLeft-1);updateTimerUI();if(g.timeLeft<=0){stopTimer();tone(180,.18,'sawtooth',.025);confirmModal('Tempo encerrado','A discussão acabou. É hora de votar.',[{label:'Ir para votação',primary:true,action:()=>{closeModal();beginVoting()}}])}},1000)}
function stopTimer(){if(state.timerId){clearInterval(state.timerId);state.timerId=null}}
function updateTimerUI(){const g=state.game;if(!g)return;const m=Math.floor(g.timeLeft/60),s=g.timeLeft%60;$('#timerText').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;const circ=2*Math.PI*92;$('#timerArc').style.strokeDasharray=circ;$('#timerArc').style.strokeDashoffset=circ*(1-g.timeLeft/g.totalTime);$('#timerState').textContent=g.paused?'PAUSADO':'TEMPO RESTANTE';}
function togglePause(){const g=state.game;g.paused=!g.paused;$('#pauseBtn').innerHTML=g.paused?'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';updateTimerUI();tone(g.paused?330:660,.05)}
function finishRound(){const g=state.game;if(g.round<state.config.rounds){g.round++;renderRound();tone(700,.05);toast(`Volta ${g.round} começou.`)}else{beginVoting()}}

function beginVoting(candidateIds=null){stopTimer();const g=state.game;g.voteIndex=0;g.votes={};g.voteChoice=null;g.candidateIds=candidateIds;if(state.config.secretVote){prepareVotePass();showScreen('vote-pass');}else{renderVote();showScreen('vote');}}
function votingPlayers(){return state.game.players.filter(p=>p.alive)}
function currentVoter(){return votingPlayers()[state.game.voteIndex]}
function prepareVotePass(){const v=currentVoter();$('#voterName').textContent=v.name;}
function openVote(){renderVote();showScreen('vote')}
function renderVote(){const g=state.game,v=currentVoter();g.voteChoice=null;$('#voteTitle').textContent=`${v.name}, escolha uma pessoa`;const grid=$('#voteGrid');grid.innerHTML='';let candidates=votingPlayers().filter(p=>p.id!==v.id);if(g.candidateIds)candidates=candidates.filter(p=>g.candidateIds.includes(p.id));candidates.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='vote-card';b.dataset.id=p.id;b.innerHTML=`<div class="vote-avatar">${esc(initials(p.name))}</div><strong>${esc(p.name)}</strong><i></i>`;b.addEventListener('click',()=>{$$('.vote-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');g.voteChoice=p.id;$('#confirmVoteBtn').disabled=false;tone(520,.04);haptic(10)});grid.appendChild(b)});$('#confirmVoteBtn').disabled=true;}
function confirmVote(){const g=state.game,v=currentVoter();if(g.voteChoice==null)return;g.votes[v.id]=g.voteChoice;tone(760,.05);haptic(18);g.voteIndex++;if(g.voteIndex<votingPlayers().length){if(state.config.secretVote){prepareVotePass();showScreen('vote-pass');}else{renderVote();showScreen('vote');}}else resolveVote();}
function resolveVote(){const g=state.game,counts={};Object.values(g.votes).forEach(id=>counts[id]=(counts[id]||0)+1);const max=Math.max(...Object.values(counts));const tied=Object.keys(counts).filter(id=>counts[id]===max).map(Number);
  if(tied.length>1){g.tieRound++;if(g.tieRound<=2){const names=tied.map(id=>g.players.find(p=>p.id===id)?.name).filter(Boolean).join(', ');confirmModal('Empate na votação',`${names} receberam ${max} voto${max===1?'':'s'}. A votação será refeita apenas entre os empatados.`,[{label:'Votar novamente',primary:true,action:()=>{closeModal();beginVoting(tied)}}]);return}const picked=rand(tied);eliminate(picked,true);return}g.tieRound=0;eliminate(tied[0],false);
}
function eliminate(id,randomTie){const g=state.game,p=g.players.find(x=>x.id===id);if(!p)return;p.alive=false;g.lastEliminated=p;if(p.role==='civil')g.lives=Math.max(0,g.lives-1);renderResult(p,randomTie);showScreen('result');tone(p.role==='impostor'?840:210,.14,p.role==='impostor'?'triangle':'sawtooth',.03);haptic(35)}
function renderResult(p,randomTie){const g=state.game;$('#resultAvatar').textContent=initials(p.name);$('#resultName').textContent=p.name;$('#resultKicker').textContent=randomTie?'DESEMPATE AUTOMÁTICO':'ELIMINADO';$('#resultRoleLine').textContent=state.config.revealRole?`${p.role==='impostor'?'Era impostor':'Era civil'}.`: 'O papel continua em segredo.';const life=$('#resultLives');life.innerHTML='';for(let i=0;i<g.maxLives;i++){const x=document.createElement('i');if(i>=g.lives)x.classList.add('lost');life.appendChild(x)}
  if(p.role==='civil')$('#resultMessage').textContent=`Os civis perderam uma vida. Restam ${g.lives}.`;else{const rest=g.players.filter(x=>x.alive&&x.role==='impostor').length;$('#resultMessage').textContent=rest?`Um impostor caiu, mas ${rest} ainda permanece${rest===1?'':'m'} na partida.`:'O último impostor foi descoberto.'}
  const winner=checkWinner();$('#continueAfterResult').textContent=winner?'Ver resultado final':'Continuar partida';
}
function checkWinner(){const g=state.game,remainingImp=g.players.filter(p=>p.alive&&p.role==='impostor').length;if(remainingImp===0)return g.winner='civilians';if(g.lives<=0)return g.winner='impostors';return null}
function afterResult(){const g=state.game;if(checkWinner()){showEnd();return}g.cycle++;prepareStarter();showScreen('starter')}
function showEnd(){stopTimer();const g=state.game,impWin=g.winner==='impostors';const s=$('#screen-end');s.classList.toggle('impostor-win',impWin);$('#endKicker').textContent='FIM DA PARTIDA';$('#endTitle').textContent=impWin?'Impostores venceram':'Civis venceram';$('#endSubtitle').textContent=impWin?'As vidas civis acabaram antes que todos os impostores fossem encontrados.':'O grupo descobriu todos os impostores antes de perder as vidas.';const impostors=g.players.filter(p=>p.role==='impostor').map(p=>p.name).join(', ');$('#endReveal').innerHTML=`<span>${g.players.filter(p=>p.role==='impostor').length===1?'O impostor era':'Os impostores eram'}</span><strong>${esc(impostors)}</strong><span style="margin-top:10px">Palavras</span><strong>${esc(g.words.civil)} <small style="color:#777;font-weight:600">×</small> ${esc(g.words.impostor)}</strong>`;showScreen('end');tone(impWin?250:880,.24,'triangle',.04)}
function playAgain(){clearRevealSequence();const names=[...state.players];state.game=null;state.players=names;renderPlayers();showScreen('setup');}

function bind(){
  $('#backBtn').addEventListener('click',back);$('#soundBtn').addEventListener('click',()=>{state.sound=!state.sound;savePrefs();updateHome();if(state.sound)tone(600,.05)});
  $('#playBtn').addEventListener('click',()=>{renderPlayers();showScreen('setup')});$('#themesBtn').addEventListener('click',()=>{renderThemes();showScreen('themes')});
  $('#themeSearch').addEventListener('input',e=>renderThemes(e.target.value));$('#selectAllThemes').addEventListener('click',()=>{THEMES.forEach(t=>state.selectedThemes.add(t.id));renderThemes($('#themeSearch').value);savePrefs()});$('#clearThemes').addEventListener('click',()=>{state.selectedThemes.clear();renderThemes($('#themeSearch').value);savePrefs()});$('#themesDoneBtn').addEventListener('click',()=>{if(!state.selectedThemes.size)return;savePrefs();updateHome();showScreen('home')});
  $('#addPlayerForm').addEventListener('submit',e=>{e.preventDefault();addPlayer($('#playerNameInput').value);$('#playerNameInput').value='';$('#playerNameInput').focus()});$('#quickPlayers').addEventListener('click',()=>{['Ana','Lucas','Rafa','Lia','Pedro','Melissa'].forEach(n=>{if(!state.players.includes(n))state.players.push(n)});renderPlayers()});
  [['impostorRange','impostors',Number],['timeRange','time',Number],['livesRange','lives',Number],['roundsRange','rounds',Number]].forEach(([id,key,fn])=>$('#'+id).addEventListener('input',e=>{state.config[key]=fn(e.target.value);syncConfig();savePrefs()}));
  $$('#difficultySeg button').forEach(b=>b.addEventListener('click',()=>{state.config.difficulty=b.dataset.difficulty;syncConfig();savePrefs();tone(540,.04)}));
  [['revealRoleToggle','revealRole'],['secretVoteToggle','secretVote']].forEach(([id,key])=>$('#'+id).addEventListener('change',e=>{state.config[key]=e.target.checked;savePrefs()}));
  $('#resetConfig').addEventListener('click',()=>{Object.assign(state.config,{impostors:1,time:10,lives:2,rounds:2,difficulty:'normal',revealRole:true,secretVote:true});syncConfig();savePrefs()});$('#startSetupBtn').addEventListener('click',startGame);
  $('#revealToggleBtn').addEventListener('click',revealForFiveSeconds);
  $('#beginRoundBtn').addEventListener('click',startDiscussion);$('#pauseBtn').addEventListener('click',togglePause);$('#nextRoundBtn').addEventListener('click',finishRound);$('#goVoteBtn').addEventListener('click',()=>confirmModal('Começar a votação?','A discussão será encerrada e cada jogador votará em segredo.',[{label:'Continuar discutindo'},{label:'Começar votação',primary:true,action:()=>{closeModal();beginVoting()}}]));
  $('#openVoteBtn').addEventListener('click',openVote);$('#confirmVoteBtn').addEventListener('click',confirmVote);$('#continueAfterResult').addEventListener('click',afterResult);$('#playAgainBtn').addEventListener('click',playAgain);$('#homeBtn').addEventListener('click',endToHome);
  $('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.game&&state.screen==='round'&&!state.game.paused)togglePause()});
}
function init(){loadPrefs();bind();updateHome();syncConfig();renderPlayers();showScreen('home',{push:false});updateRepeatClock();setInterval(updateRepeatClock,1000);}
init();
})();
