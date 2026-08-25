(() => {
  const host=document.getElementById('localNow');if(!host)return;
  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const ageMinutes=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?Math.max(0,(Date.now()-date.getTime())/60000):Infinity};
  const relative=value=>{const minutes=Math.round(ageMinutes(value));if(!Number.isFinite(minutes))return'recently';if(minutes<2)return'1 min ago';if(minutes<60)return`${minutes} min ago`;const hours=Math.round(minutes/60);return hours<24?`${hours} hr ago`:new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(new Date(value))};
  const isFresh=(value,maxMinutes)=>ageMinutes(value)<=maxMinutes;
  const torontoDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(value?new Date(value):new Date());
  const sameTorontoDay=value=>torontoDay(value)===torontoDay();
  const timeOnly=value=>{if(!value)return'';const match=String(value).match(/(\d{1,2}):(\d{2})/);if(!match)return String(value);let hour=Number(match[1]);const suffix=hour>=12?'pm':'am';hour=hour%12||12;return`${hour}:${match[2]} ${suffix}`};
  const shortDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'}).format(new Date(value));
  const torontoDate=()=>torontoDay();
  const goTripUrl=destination=>`https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(torontoDate())}&transfers=true`;
  function routeTimes(data,code){const route=(Array.isArray(data?.routes)?data.routes:[]).find(item=>String(item.destination?.stopCode||'').toUpperCase()===code);return (Array.isArray(route?.journeys)?route.journeys:[]).slice(0,2).map(j=>timeOnly(j.computedDeparture||j.departure)).filter(Boolean)}
  function goSummary(data){const alert=Array.isArray(data?.alerts)&&data.alerts[0];if(alert)return{alert:true,headline:alert.headline||'Service alert',url:data.liveStatusUrl||'https://www.gotransit.com/en/service-updates/service-updates'};return{union:routeTimes(data,'UN'),west:routeTimes(data,'WR')}}
  function intelligenceSummary(data){
    const top=data?.topSignal;
    if(!top||!isFresh(data.generatedAt,120))return null;
    const hay=`${top.headline||''} ${top.location||''} ${top.neighbourhood||''}`.toLowerCase();
    const local=/burlington|skyway|brant|guelph line|walkers|appleby|burloak|aldershot|plains|qew/.test(hay);
    const incident=/collision|crash|accident|closure|fire|outage|alert|blocked/.test(hay);
    if(!local)return null;
    if((Number(top.score)||0)<65)return null;
    if(!incident&&(Number(top.score)||0)<80)return null;
    return{headline:top.headline,status:top.kind==='transit'?'Transit alert':'Traffic alert',location:top.location||top.neighbourhood||'Burlington',url:top.url||'/traffic/',lastUpdatedAt:data.generatedAt,score:Number(top.score)||0};
  }
  function skywaySummary(data){const incidents=Array.isArray(data?.traffic?.incidents)?data.traffic.incidents:[];const major=incidents.find(item=>(Number(item.score)||0)>=60);if(major)return{value:major.headline?'Incident':'Incident',alert:true,detail:major.headline||''};return{value:incidents.length?'Watch':'Clear',alert:false,detail:''}}
  function nextEvent(data){
    const now=Date.now();
    const events=(Array.isArray(data?.events)?data.events:[]).filter(item=>Date.parse(item.end||item.start)>now).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
    const event=events[0];
    if(!event)return null;
    return{title:event.title,start:event.start,dateLabel:event.dateLabel||shortDate(event.start),url:`/explore/#event-${encodeURIComponent(event.id||'')}`};
  }
  function render(payload){
    const {data,go,intel,explore}=payload;
    const incidents=(Array.isArray(data.incidents)?data.incidents:[]).filter(item=>isFresh(item.lastUpdatedAt||data.generatedAt,180)&&sameTorontoDay(item.lastUpdatedAt||data.generatedAt));
    const recent=(Array.isArray(data.recentlyLive)?data.recentlyLive:[]).filter(item=>isFresh(item.lastUpdatedAt||item.resolvedAt,720)&&sameTorontoDay(item.lastUpdatedAt||item.resolvedAt));
    const editorial=incidents[0]||recent[0]||null;
    const live=intelligenceSummary(intel);
    const machinePriority=live&&live.score>=65?live:null;
    const priority=machinePriority||editorial;
    const priorityTime=priority?.lastUpdatedAt||priority?.resolvedAt||data.generatedAt;
    const isCurrent=Boolean(machinePriority)||incidents.includes(priority);
    const skyway=skywaySummary(intel);
    const goInfo=goSummary(go);
    const event=nextEvent(explore);
    const generatedCandidates=[intel?.generatedAt,go?.generatedAt,data.generatedAt].filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a));
    const generatedAt=generatedCandidates[0]||new Date().toISOString();
    const recentLabel=sameTorontoDay(priorityTime)?'Earlier today':'Earlier';
    const priorityMarkup=priority?`<a class="now-priority${isCurrent?'':' is-recent'}" href="${esc(priority.url||'/news/')}"><span><small>${esc(isCurrent?(priority.status||'Local update'):recentLabel)}</small><strong>${esc(priority.headline)}</strong><em>${esc(priority.location?.label||priority.location||priority.impact||'')}</em></span><time>${esc(relative(priorityTime))}</time></a>`:'';
    const goMarkup=goInfo.alert?`<a class="now-utility now-go is-alert" href="${esc(goInfo.url)}"><small>GO</small><strong>${esc(goInfo.headline)}</strong></a>`:`<div class="now-utility now-go"><small>GO</small><span><a href="${esc(goTripUrl('UN'))}" target="_blank" rel="noopener"><b>Union</b> ${esc(goInfo.union.length?goInfo.union.join(' · '):'Check times')}</a><a href="${esc(goTripUrl('WR'))}" target="_blank" rel="noopener"><b>West Harbour</b> ${esc(goInfo.west.length?goInfo.west.join(' · '):'Check times')}</a></span></div>`;
    const eventMarkup=event?`<a class="now-utility now-event" href="${esc(event.url)}"><small>Next</small><span><strong>${esc(event.title)}</strong><em>${esc(event.dateLabel)}</em></span></a>`:'';
    host.innerHTML=`<div class="now-heading"><span><i class="live-pulse" aria-hidden="true"></i>Right now</span><time datetime="${esc(generatedAt)}">Updated ${esc(relative(generatedAt))}</time></div>${priorityMarkup}<div class="now-utilities"><span class="now-utility now-weather"><small>Weather</small><strong class="now-weather-value" data-weather-temperature data-weather-alert-host>--</strong></span><a class="now-utility${skyway.alert?' is-alert':''}" href="/traffic/"><small>Skyway</small><strong>${esc(skyway.value)}</strong></a>${goMarkup}${eventMarkup}</div>`;
    if(window.BurlingtonWeather?.load)window.BurlingtonWeather.load();
  }
  function load(){
    Promise.allSettled([
      fetch('/data/local-status.json',{cache:'no-store'}).then(r=>r.ok?r.json():null),
      fetch('/data/go-status.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/data/local-intelligence.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/data/explore-events.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
    ]).then(results=>{
      render({
        data:results[0].status==='fulfilled'&&results[0].value?results[0].value:{incidents:[],recentlyLive:[]},
        go:results[1].status==='fulfilled'?results[1].value:null,
        intel:results[2].status==='fulfilled'?results[2].value:null,
        explore:results[3].status==='fulfilled'?results[3].value:null
      });
    }).catch(()=>{host.hidden=true});
  }
  load();
  setInterval(load,120000);
})();
