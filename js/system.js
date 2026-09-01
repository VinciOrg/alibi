(()=>{
'use strict';
const META=window.ALIBI_APP_META||{};
const LEGAL_KEY='alibi_legal_acceptance_v1';
const MOTION_KEY='alibi_reduce_motion_v1';
const LAST_CHECK_KEY='alibi_last_update_check_v1';
const ONE_HOUR=60*60*1000;
const $=(s,r=document)=>r.querySelector(s);

const termsHtml=`
  <h3>1. Sobre o ÁLIBI</h3>
  <p>ÁLIBI é um jogo social de blefe para uso local em um único dispositivo. O objetivo é entretenimento entre participantes de uma mesma roda.</p>
  <h3>2. Uso do jogo</h3>
  <p>Os participantes são responsáveis pelos nomes inseridos e pela forma como usam o jogo. Não use o ÁLIBI para assediar, constranger, ameaçar ou expor outras pessoas.</p>
  <h3>3. Conteúdo e referências</h3>
  <p>Alguns temas podem mencionar nomes de obras, marcas, personagens, jogos, artistas ou outros elementos culturais apenas para identificação dentro da brincadeira. ÁLIBI não representa afiliação, patrocínio ou endosso dessas marcas ou titulares.</p>
  <h3>4. Disponibilidade</h3>
  <p>O jogo é oferecido como está e pode receber ajustes, correções, novos temas e mudanças de funcionamento. Partidas e preferências locais podem ser apagadas ao limpar os dados do aplicativo.</p>
  <h3>5. Atualizações</h3>
  <p>Versões instaladas diretamente fora da Google Play podem consultar o servidor do ÁLIBI para avisar quando houver uma versão nova. Versões distribuídas pela Google Play devem usar o mecanismo de atualização da própria loja.</p>
  <h3>6. Contato</h3>
  <p>Use o canal de suporte informado na página oficial de distribuição do ÁLIBI para dúvidas relacionadas ao aplicativo.</p>`;

const privacyHtml=`
  <h3>Resumo</h3>
  <p>O ÁLIBI foi projetado para funcionar principalmente de forma local. Não há cadastro de conta, anúncios ou sistema de perfil dentro do jogo.</p>
  <h3>Dados mantidos no aparelho</h3>
  <p>Configurações da partida, preferência de som, temas selecionados, aceite legal e o histórico temporário usado para evitar repetição de palavras ficam no armazenamento local do aplicativo. Esses dados não são enviados pelo jogo para criar perfil de usuário.</p>
  <h3>Nomes dos jogadores</h3>
  <p>Os nomes digitados durante a preparação da partida são usados apenas durante a sessão atual e não são enviados ao servidor do ÁLIBI.</p>
  <h3>Verificação de atualização</h3>
  <p>Quando executado como aplicativo Android, o ÁLIBI pode consultar o backend hospedado no Supabase para receber somente informações de versão, como número da versão, build, notas e endereço de atualização. Como ocorre em qualquer conexão de rede, a infraestrutura pode processar dados técnicos necessários à comunicação e segurança, como endereço IP e informações básicas da requisição.</p>
  <h3>Publicidade e análise</h3>
  <p>Esta versão não integra anúncios nem ferramentas de análise comportamental.</p>
  <h3>Controle do usuário</h3>
  <p>Você pode limpar preferências e histórico local pelas Configurações do ÁLIBI ou pelas configurações do Android. Como o jogo não cria conta, não existe uma conta remota para excluir.</p>
  <h3>Alterações</h3>
  <p>Se o funcionamento do aplicativo mudar de forma relevante, esta política deverá ser atualizada e o aviso legal poderá ser apresentado novamente.</p>`;

function isNativeAndroid(){
  try{
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform?.()==='android');
  }catch(_){return false;}
}
function overlay(className=''){
  const el=document.createElement('div');el.className=`alibi-system-overlay ${className}`;return el;
}
function closeOverlay(el){if(el&&!el.dataset.locked)el.remove();}
function fmtSize(bytes){if(!Number.isFinite(Number(bytes))||Number(bytes)<=0)return null;const mb=Number(bytes)/1024/1024;return `${mb.toFixed(mb>=10?0:1)} MB`;}
function safeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function getAcceptance(){try{return JSON.parse(localStorage.getItem(LEGAL_KEY)||'null')}catch(_){return null}}
function hasCurrentAcceptance(){const a=getAcceptance();return !!(a&&a.legalVersion===META.legalVersion);}
function saveAcceptance(){localStorage.setItem(LEGAL_KEY,JSON.stringify({legalVersion:META.legalVersion,acceptedAt:new Date().toISOString()}));}
function applyMotionPref(){const reduced=localStorage.getItem(MOTION_KEY)==='1';document.documentElement.classList.toggle('alibi-reduce-motion',reduced);return reduced;}
function setMotionPref(v){localStorage.setItem(MOTION_KEY,v?'1':'0');applyMotionPref();}

function showLegalDoc(kind,parent){
  const old=$('.alibi-system-overlay'); if(old&&old!==parent)old.remove();
  const o=overlay('alibi-legal-view');
  o.innerHTML=`<section class="alibi-system-sheet"><header class="alibi-system-head"><div><small>YAKO DEV · ÁLIBI</small><h2>${kind==='terms'?'Termos de Uso':'Política de Privacidade'}</h2></div><button class="alibi-system-close" aria-label="Fechar">×</button></header><div class="alibi-legal-copy">${kind==='terms'?termsHtml:privacyHtml}</div><button class="alibi-legal-back">Voltar</button></section>`;
  document.body.appendChild(o);
  const back=()=>{o.remove();if(parent)document.body.appendChild(parent)};
  $('.alibi-system-close',o).onclick=back;$('.alibi-legal-back',o).onclick=back;
}

function showFirstRun(){
  if(hasCurrentAcceptance())return;
  const o=overlay('alibi-first-run');o.dataset.locked='1';
  o.innerHTML=`<section class="alibi-system-sheet"><div class="alibi-first-card"><div class="alibi-first-mark"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 4.7-3.2 7.7-8 9-4.8-1.3-8-4.3-8-9V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></div><small style="color:#8f83ff;font-size:8px;font-weight:900;letter-spacing:.16em">ANTES DE COMEÇAR</small><h2>Jogo local. Regras claras.</h2><p>O ÁLIBI funciona principalmente offline. Antes da primeira partida, confira como o app usa os dados locais e as regras de uso.</p><div class="alibi-privacy-summary"><div class="alibi-privacy-pill"><b>✓</b><span>Sem conta e sem cadastro para jogar.</span></div><div class="alibi-privacy-pill"><b>⌂</b><span>Nomes, preferências e histórico de repetição ficam no aparelho.</span></div><div class="alibi-privacy-pill"><b>↻</b><span>No Android, a internet é usada para consultar informações de atualização.</span></div></div><div class="alibi-legal-links"><button data-doc="terms">Ler Termos de Uso</button><button data-doc="privacy">Ler Privacidade</button></div><label class="alibi-accept-row"><input type="checkbox" id="alibiAcceptLegal"><span>Li e concordo com os Termos de Uso e confirmo que li a Política de Privacidade.</span></label><button class="alibi-continue" disabled>Continuar para o ÁLIBI</button></div></section>`;
  document.body.appendChild(o);
  const chk=$('#alibiAcceptLegal',o),btn=$('.alibi-continue',o);
  chk.onchange=()=>btn.disabled=!chk.checked;
  btn.onclick=()=>{if(!chk.checked)return;saveAcceptance();o.remove();setTimeout(()=>checkForUpdate({automatic:true}),650)};
  o.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>{o.remove();showLegalDoc(b.dataset.doc,o)});
}

function settingsRow(icon,title,sub,tail='',extra=''){
  return `<button class="alibi-setting-row ${extra}" type="button"><span class="alibi-setting-icon">${icon}</span><span class="alibi-setting-copy"><strong>${title}</strong><span>${sub}</span></span>${tail||'<span class="alibi-setting-chevron">›</span>'}</button>`;
}
function showSettings(){
  const o=overlay('alibi-settings-overlay');const muted=document.body.classList.contains('muted');const reduced=applyMotionPref();
  o.innerHTML=`<section class="alibi-system-sheet"><header class="alibi-system-head"><div><small>ÁLIBI</small><h2>Configurações</h2></div><button class="alibi-system-close" aria-label="Fechar">×</button></header><div class="alibi-settings-group"><div class="alibi-settings-label">Geral</div>${settingsRow('♪','Som','Efeitos sonoros durante o jogo','<span class="alibi-switch"><i></i></span>',muted?'':'on').replace('class="alibi-setting-row','data-action="sound" class="alibi-setting-row')}${settingsRow('◌','Reduzir animações','Desativa movimentos e transições visuais','<span class="alibi-switch"><i></i></span>',reduced?'on':'').replace('class="alibi-setting-row','data-action="motion" class="alibi-setting-row')}</div><div class="alibi-settings-group"><div class="alibi-settings-label">Aplicativo</div>${settingsRow('↻','Verificar atualizações',isNativeAndroid()?'Consulta a versão publicada para Android':'Disponível somente no aplicativo Android').replace('class="alibi-setting-row','data-action="update" class="alibi-setting-row')}${settingsRow('⌫','Limpar dados locais','Apaga preferências, aceite e histórico de palavras').replace('class="alibi-setting-row','data-action="clear" class="alibi-setting-row')}</div><div class="alibi-settings-group"><div class="alibi-settings-label">Legal</div>${settingsRow('§','Termos de Uso','Regras de uso do ÁLIBI').replace('class="alibi-setting-row','data-action="terms" class="alibi-setting-row')}${settingsRow('◇','Política de Privacidade','Como os dados locais e a rede são usados').replace('class="alibi-setting-row','data-action="privacy" class="alibi-setting-row')}${settingsRow('i','Sobre o ÁLIBI','Jogo local de blefe · YAKO DEV').replace('class="alibi-setting-row','data-action="about" class="alibi-setting-row')}</div><div class="alibi-version-box"><span>Versão instalada</span><strong>${safeText(META.version||'—')} · build ${Number(META.build)||'—'}</strong></div><p class="alibi-system-note">Configurações e histórico ficam neste aparelho. O app não precisa de conta para funcionar.</p></section>`;
  document.body.appendChild(o);$('.alibi-system-close',o).onclick=()=>o.remove();o.addEventListener('click',e=>{if(e.target===o)o.remove()});
  $('[data-action="sound"]',o).onclick=(e)=>{document.querySelector('#soundBtn')?.click();e.currentTarget.classList.toggle('on',!document.body.classList.contains('muted'));};
  $('[data-action="motion"]',o).onclick=(e)=>{const next=!document.documentElement.classList.contains('alibi-reduce-motion');setMotionPref(next);e.currentTarget.classList.toggle('on',next);};
  $('[data-action="update"]',o).onclick=()=>{if(!isNativeAndroid()){notify('A verificação de atualização aparece somente no APK Android.');return;}o.remove();checkForUpdate({manual:true});};
  $('[data-action="terms"]',o).onclick=()=>{o.remove();showLegalDoc('terms',o)};
  $('[data-action="privacy"]',o).onclick=()=>{o.remove();showLegalDoc('privacy',o)};
  $('[data-action="about"]',o).onclick=()=>{o.remove();showAbout(o)};
  $('[data-action="clear"]',o).onclick=()=>showClearConfirm(o);
}
function showAbout(parent){
  const o=overlay();o.innerHTML=`<section class="alibi-system-sheet"><header class="alibi-system-head"><div><small>YAKO DEV</small><h2>Sobre o ÁLIBI</h2></div><button class="alibi-system-close">×</button></header><div class="alibi-legal-copy"><p><strong style="color:#fff">ÁLIBI ${safeText(META.version||'')}</strong> é um jogo local de blefe feito para uma única roda e um único celular.</p><h3>Privacidade por padrão</h3><p>Sem conta, sem feed e sem perfil. A partida acontece no aparelho.</p><h3>Versão</h3><p>Build ${Number(META.build)||'—'} · pacote Android <code>com.alibi.partygame</code>.</p></div><button class="alibi-legal-back">Voltar</button></section>`;document.body.appendChild(o);const back=()=>{o.remove();if(parent)document.body.appendChild(parent)};$('.alibi-system-close',o).onclick=back;$('.alibi-legal-back',o).onclick=back;
}
function showClearConfirm(settingsOverlay){
  const o=overlay();o.innerHTML=`<section class="alibi-system-sheet" style="max-width:420px"><header class="alibi-system-head"><div><small>DADOS LOCAIS</small><h2>Limpar este aparelho?</h2></div><button class="alibi-system-close">×</button></header><p class="alibi-update-message">Isso apaga preferências, histórico anti-repetição, configurações e o aceite legal. O jogo será recarregado como na primeira abertura.</p><div class="alibi-update-actions"><button class="alibi-update-primary" data-clear>Limpar e reiniciar</button><button class="alibi-update-later" data-cancel>Cancelar</button></div></section>`;document.body.appendChild(o);const cancel=()=>o.remove();$('.alibi-system-close',o).onclick=cancel;$('[data-cancel]',o).onclick=cancel;$('[data-clear]',o).onclick=()=>{['alibi_prefs_v04','alibi_used_terms_v04',LEGAL_KEY,MOTION_KEY,LAST_CHECK_KEY].forEach(k=>localStorage.removeItem(k));location.reload();};
}
function notify(text){const n=document.createElement('div');n.className='toast';n.style.zIndex='500';n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),2600)}

async function fetchUpdate(){
  const url=`${String(META.supabaseUrl||'').replace(/\/$/,'')}/rest/v1/rpc/alibi_get_android_update`;
  const key=META.supabaseAnonKey;if(!url.startsWith('https://')||!key)throw new Error('update_config_missing');
  const res=await fetch(url,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  if(!res.ok)throw new Error(`update_http_${res.status}`);const json=await res.json();return Array.isArray(json)?json[0]:json;
}
function openUpdateTarget(data){
  const url=META.distribution==='play'?(META.playStoreUrl||''):data.apk_url;if(!url)return notify('Endereço de atualização indisponível.');
  try{window.open(url,'_blank','noopener,noreferrer');}catch(_){location.href=url;}
}
function showUpdate(data,{manual=false}={}){
  const mandatory=!!data.latest_mandatory;const o=overlay('alibi-update-overlay');if(mandatory)o.dataset.locked='1';
  const size=fmtSize(data.file_size_bytes);const notes=String(data.release_notes||'').trim();const message=String(data.update_message||'').trim()||'Uma nova versão do ÁLIBI está disponível.';
  o.innerHTML=`<section class="alibi-system-sheet alibi-update-sheet"><span class="alibi-update-badge">↻ atualização disponível</span><h2 class="alibi-update-title">Tem ÁLIBI novo.</h2><p class="alibi-update-message">${safeText(message)}</p><div class="alibi-update-meta"><span>v${safeText(data.latest_version||'—')}</span><span>build ${Number(data.latest_build)||'—'}</span>${size?`<span>${safeText(size)}</span>`:''}${mandatory?'<span>atualização necessária</span>':''}</div>${notes?`<div class="alibi-release-notes">${safeText(notes)}</div>`:''}<div class="alibi-update-actions"><button class="alibi-update-primary" data-update-now>${META.distribution==='play'?'Abrir Google Play':'Atualizar agora'}</button>${mandatory?'':'<button class="alibi-update-later" data-update-later>Agora não</button>'}</div><p class="alibi-update-status">Versão instalada: ${safeText(META.version||'—')} · build ${Number(META.build)||'—'}</p></section>`;
  document.body.appendChild(o);$('[data-update-now]',o).onclick=()=>openUpdateTarget(data);const later=$('[data-update-later]',o);if(later)later.onclick=()=>o.remove();if(!mandatory)o.addEventListener('click',e=>{if(e.target===o)o.remove()});
}
async function checkForUpdate({manual=false,automatic=false}={}){
  if(!isNativeAndroid()){if(manual)notify('Atualizações automáticas são verificadas somente no aplicativo Android.');return;}
  if(automatic){const last=Number(localStorage.getItem(LAST_CHECK_KEY)||0);if(Date.now()-last<ONE_HOUR)return;}
  try{
    const data=await fetchUpdate();localStorage.setItem(LAST_CHECK_KEY,String(Date.now()));
    if(!data||data.enabled===false){if(manual)notify('Canal de atualização desativado.');return;}
    const newer=Number(data.latest_build)>Number(META.build||0);
    const shouldPopup=newer&&(manual||data.notification_enabled!==false);
    if(shouldPopup)showUpdate(data,{manual});else if(manual)notify(newer?'Há uma versão nova, mas o aviso automático está desativado.':'Você já está na versão mais recente.');
  }catch(err){if(manual)notify('Não foi possível verificar atualizações agora.');console.warn('[ÁLIBI update]',err);}
}

function injectSettings(){
  const home=$('#screen-home');if(!home||$('.alibi-settings-btn',home))return;const b=document.createElement('button');b.type='button';b.className='alibi-settings-btn';b.setAttribute('aria-label','Configurações');b.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.37.72.7 1 .3.25.7.4 1.1.4H21v4h-.09c-.4 0-.8.14-1.1.4-.33.28-.56.62-.7 1Z"/></svg>';b.onclick=showSettings;home.appendChild(b);
}
function init(){applyMotionPref();injectSettings();setTimeout(()=>{if(!hasCurrentAcceptance())showFirstRun();else checkForUpdate({automatic:true});},420)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.ALIBI_SYSTEM={checkForUpdate,showSettings,isNativeAndroid};
})();
