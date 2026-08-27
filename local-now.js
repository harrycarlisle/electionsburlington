import { buildGoModel } from '/lib/go-times.js';
import { uniqueCameraCount } from '/lib/homepage-ranking.js';

(() => {
  const host = document.getElementById('localNow');
  if (!host) return;
  const VARIANT='icon-carousel',MODES=['driving','go','skyway','today'],MODE_SHOW={driving:'Show Driving',go:'Show GO',skyway:'Show Skyway',today:'Show Event'},MODE_CAT={driving:'TRAFFIC',go:'GO',skyway:'SKYWAY',today:'EVENT'},SWIPE_PX=36,TRAFFIC_ROTATE_MS=9000;
  window.liveUtilityVariant=VARIANT;
  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let selectedMode=null,lastModels=null,viewed=false,trafficIndex=0,trafficTimer=null;
  const icon=(name,path)=>`<span class="now-icon now-icon-${name}" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
  const icons={driving:icon('traffic','<path d="M5 16h14l-1.2-6.2A2 2 0 0 0 15.9 8H8.1a2 2 0 0 0-1.9 1.8L5 16Z"/><path d="M7 16v2M17 16v2M8 11h8"/>'),go:icon('go','<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M9 8h6M9 12h6M10 18h4"/>'),skyway:icon('skyway','<path d="M3 16h18M5 16c2-6 5-9 7-9s5 3 7 9"/><path d="M8 16v-3M16 16v-3"/>'),today:icon('event','<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>')};
  const pagerDots=()=>`<span class="now-card-dots" role="tablist" aria-label="Live local update">${MODES.map(mode=>`<button type="button" class="now-card-dot-btn${mode===selectedMode?' is-active':''}" role="tab" data-now-dot data-mode="${mode}" aria-label="${MODE_SHOW[mode]}" aria-selected="${mode===selectedMode}" aria-current="${mode===selectedMode?'true':'false'}"><span aria-hidden="true"></span></button>`).join('')}</span>`;
  function track(name,mode){try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,liveUtilityVariant:VARIANT,mode:mode||selectedMode||'driving'})}catch(_){}}
  function routeModel(route,key){if(!route)return null;const west=key==='hamilton';return{title:west?'QEW → Hamilton':'QEW → Toronto',metric:route?.status?.looks||'Live',detail:route?.status?.summary||route?.status?.detail||'Live cameras and incidents',url:`/traffic/?destination=${west?'hamilton':'toronto'}`}}
  function drivingModels(surface){const rows=[];const incident=(surface?.incidents||[]).find(x=>/burlington|oakville|halton|qew|403|skyway/i.test(`${x.municipality||''} ${x.roadway||''} ${x.title||''}`));if(incident&&/closed|collision|crash|blocked|closure|incident/i.test(incident.title||''))rows.push({title:(incident.roadway||'QEW')+' traffic',metric:/closed/i.test(incident.title||'')?'Closed':'Watch',detail:incident.title||'',url:'/traffic/',alert:true});const east=routeModel(surface?.routes?.toronto,'toronto'),west=routeModel(surface?.routes?.hamilton,'hamilton');if(east)rows.push(east);if(west)rows.push(west);return rows.length?rows:[{title:'QEW → Toronto',metric:'Live',detail:'Live cameras and incidents',url:'/traffic/?destination=toronto'}]}
  function goModel(data){const model=buildGoModel(data||{},new Date());return{title:'Burlington → Union',time:model?.time||'',status:model?.status||'',detail:model?.detail||'',url:'/go/burlington-to-union/',alert:!!model?.alert};}
  function skywayModel(surface){const route=surface?.routes?.hamilton||surface?.routes?.toronto;const cameras=uniqueCameraCount(route?.cameras||[]);return{title:'Burlington Skyway',metric:cameras?`${cameras} cameras`:'Live',detail:'Check current bridge traffic',url:'/traffic/?focus=skyway'};}
  function todayModel(explore){const now=Date.now(),items=(explore?.items||explore?.events||[]).filter(item=>!item?.end||new Date(item.end).getTime()>=now).sort((a,b)=>new Date(a.start||0)-new Date(b.start||0)),item=items[0];return item?{title:item.title||item.name,relative:item.dateLabel||item.relative||'',hours:item.venue||item.hours||'',url:item.url||'/explore/'}:null;}
  function compactCard(mode,model){if(mode==='today'&&!model)model={title:'What’s on in Burlington',url:'/explore/'};const title=model.title||model.headline,metric=mode==='go'?(model.time||''):(mode==='today'?'':(model.metric||'')),detail=mode==='go'?[model.status,model.detail].filter(Boolean).join(' · '):(mode==='today'?[model.relative,model.hours].filter(Boolean).join(' · '):(model.extra||model.detail||''));return `<div class="now-card-shell"><a class="now-card now-card-${mode}${model.alert?' is-alert':''}" href="${esc(model.url||'#')}" data-utility-card="${mode}">${icons[mode]}<span class="now-card-copy"><small class="now-card-cat">${MODE_CAT[mode]}</small><strong>${esc(title)}</strong>${detail?`<em>${esc(detail)}</em>`:''}</span>${metric?`<b class="now-card-metric">${esc(metric)}</b>`:''}</a>${pagerDots()}</div>`;}
  function modelFor(mode){if(mode==='driving'){const rows=lastModels.driving||[];return rows[trafficIndex%rows.length]}return lastModels[mode]}
  function panel(){return document.querySelector('#localNow [role="tabpanel"], #headerLive [role="tabpanel"]')}
  function cardFor(mode){return compactCard(mode,modelFor(mode));}
  function syncDots(mode){document.querySelectorAll('#localNow [data-now-dot], #headerLive [data-now-dot]').forEach(tab=>{const on=tab.dataset.mode===mode;tab.classList.toggle('is-active',on);tab.setAttribute('aria-selected',String(on));tab.setAttribute('aria-current',on?'true':'false')})}
  function bindDots(root){root?.querySelectorAll('[data-now-dot]').forEach(tab=>tab.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();applyMode(tab.dataset.mode)}))}
  function applyMode(mode){if(!lastModels||!MODES.includes(mode))return;selectedMode=mode;const target=panel();if(target){target.innerHTML=cardFor(mode);bindCard(target);bindDots(target)}syncDots(mode);restartTrafficRotation()}
  function stepMode(delta){const i=MODES.indexOf(selectedMode);applyMode(MODES[(i+delta+MODES.length)%MODES.length]);track('live_utility_mode_change',selectedMode)}
  function bindCard(target){const card=target?.querySelector('[data-utility-card]');if(!card)return;let sx=0,sy=0,swiping=false;card.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;swiping=false},{passive:true});card.addEventListener('touchmove',e=>{const dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){swiping=true;if(e.cancelable)e.preventDefault()}},{passive:false});card.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(swiping&&Math.abs(dx)>=SWIPE_PX)stepMode(dx<0?1:-1)});card.addEventListener('click',e=>{if(swiping){e.preventDefault();return}track('live_utility_card_click',selectedMode)});}
  function restartTrafficRotation(){clearInterval(trafficTimer);trafficTimer=null;if(selectedMode!=='driving'||!lastModels?.driving||lastModels.driving.length<2)return;trafficTimer=setInterval(()=>{if(selectedMode!=='driving')return;trafficIndex=(trafficIndex+1)%lastModels.driving.length;const target=panel();if(target){target.innerHTML=cardFor('driving');bindCard(target);bindDots(target)}},TRAFFIC_ROTATE_MS)}
  function render(payload){lastModels={driving:drivingModels(payload.surface),go:goModel(payload.go),skyway:skywayModel(payload.surface),today:todayModel(payload.explore)};selectedMode=selectedMode||'driving';host.innerHTML=`<div class="now-panel" role="tabpanel">${cardFor(selectedMode)}</div><div class="now-dots" role="tablist" aria-label="Live local update">${MODES.map(mode=>`<button type="button" class="now-dot-btn${mode===selectedMode?' is-active':''}" role="tab" data-now-dot data-mode="${mode}" aria-label="${MODE_SHOW[mode]}" aria-selected="${mode===selectedMode}" aria-current="${mode===selectedMode?'true':'false'}"><span class="now-pager-dot" aria-hidden="true"></span></button>`).join('')}</div>`;bindDots(host);bindCard(host.querySelector('[role="tabpanel"]'));restartTrafficRotation();if(!viewed){viewed=true;track('live_utility_view',selectedMode)}}

  async function fetchJson(url, timeoutMs=2200){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok) return null;
      return await response.json();
    }catch(_){
      return null;
    }finally{
      clearTimeout(timer);
    }
  }

  async function load(){
    const [surface,go,intel,explore]=await Promise.all([
      fetchJson('/data/traffic-surface.json'),
      fetchJson('/data/go-status.json'),
      fetchJson('/data/local-intelligence.json'),
      fetchJson('/data/explore-events.json')
    ]);
    // The page already contains a static traffic fallback. Only replace it
    // when at least one live source answered in time.
    if(surface||go||intel||explore) render({surface,go,intel,explore});
  }

  load();
  setInterval(load,120000);
})();
