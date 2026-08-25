(() => {
  const host = document.getElementById('localNow');
  if (!host) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const relative = value => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'recently';
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 2) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} hr ago` : new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(date);
  };
  const isFresh = (value,maxMinutes=90) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && Date.now() - date.getTime() <= maxMinutes * 60000;
  };

  function cachedSkyway(){
    try{
      const saved=JSON.parse(localStorage.getItem('burlington-skyway-traffic')||'null');
      if(saved&&saved.label&&isFresh(saved.updatedAt,20)) return saved.label;
    }catch(_){}
    return '';
  }

  function goSummary(data){
    if(!data||!isFresh(data.generatedAt,90)) return {label:'GO',value:'Schedule',url:'https://www.gotransit.com/en/see-schedules'};
    const alert=Array.isArray(data.alerts)&&data.alerts[0];
    if(alert) return {label:'GO',value:alert.headline||'Service alert',url:data.liveStatusUrl||'https://www.gotransit.com/en/see-schedules',alert:true};
    const routes=Array.isArray(data.routes)?data.routes:[];
    const first=routes.flatMap(r=>Array.isArray(r.journeys)?r.journeys:[])[0];
    if(first?.departureStatus&&/delay|late|cancel/i.test(first.departureStatus)) return {label:'GO',value:first.departureStatus,url:data.liveStatusUrl};
    return {label:'GO',value:data.dataKind==='realtime'?'On time':'Scheduled',url:data.liveStatusUrl||'https://www.gotransit.com/en/see-schedules'};
  }

  async function skywaySummary(){
    const cached=cachedSkyway();
    if(cached) return {label:'Skyway traffic',value:cached[0].toUpperCase()+cached.slice(1),url:'skyway-traffic.html'};
    try{
      const response=await fetch('https://511on.ca/api/v2/get/event?format=json&lang=en',{cache:'no-store'});
      if(!response.ok) throw new Error();
      const events=await response.json();
      const nearby=(Array.isArray(events)?events:[]).filter(event=>{
        const text=`${event.RoadwayName||''} ${event.EventType||''} ${event.EventSubType||''} ${event.Description||''}`.toLowerCase();
        return /qew|skyway|burlington/.test(text)&&/collision|accident|closure|blocked|lane/.test(text);
      });
      return nearby.length?{label:'Skyway traffic',value:'Incident',url:'skyway-traffic.html',alert:true}:{label:'Skyway traffic',value:'Clear',url:'skyway-traffic.html'};
    }catch(_){
      return {label:'Skyway',value:'Live cameras',url:'skyway-traffic.html'};
    }
  }

  const source = 'data/local-status.json';
  Promise.allSettled([
    fetch(source,{cache:'no-store'}).then(response => response.ok ? response.json() : Promise.reject()),
    fetch('data/go-status.json',{cache:'no-store'}).then(response => response.ok ? response.json() : null).catch(() => null),
    skywaySummary()
  ]).then(results => {
    if (results[0].status !== 'fulfilled') { host.hidden = true; return; }
    const data = results[0].value;
    const go = results[1].status === 'fulfilled' ? results[1].value : null;
    const skyway = results[2].status === 'fulfilled' ? results[2].value : {label:'Skyway',value:'Live cameras',url:'skyway-traffic.html'};
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    const recent = Array.isArray(data.recentlyLive) ? data.recentlyLive : [];
    const current = incidents[0];
    const goItem=goSummary(go);

    const incidentMarkup = current ? `<a class="now-priority" href="${esc(current.url||'updates.html')}"><span class="now-priority-dot" aria-hidden="true"></span><span><small>${esc(current.status||'Local alert')}</small><strong>${esc(current.headline)}</strong><em>${esc(current.location?.label||current.impact||'')}</em></span><time>${esc(relative(current.lastUpdatedAt||data.generatedAt))}</time></a>` : '';
    const recentMarkup = !current && recent.length ? `<a class="now-priority is-recent" href="${esc(recent[0].url||'updates.html')}"><span class="now-priority-dot" aria-hidden="true"></span><span><small>Earlier today</small><strong>${esc(recent[0].headline)}</strong><em>${esc(recent[0].location?.label||recent[0].status||'')}</em></span><time>${esc(relative(recent[0].resolvedAt||recent[0].lastUpdatedAt||data.generatedAt))}</time></a>` : '';

    host.innerHTML = `<div class="now-heading"><span><i class="live-pulse" aria-hidden="true"></i>Right now</span><time>Updated ${esc(relative(data.generatedAt))}</time></div>${incidentMarkup||recentMarkup}<div class="now-inline"><span class="now-inline-item"><small>Weather</small><strong data-weather-temperature>--</strong></span><a class="now-inline-item${skyway.alert?' is-alert':''}" href="${esc(skyway.url)}"><small>${esc(skyway.label)}</small><strong>${esc(skyway.value)}</strong></a><a class="now-inline-item${goItem.alert?' is-alert':''}" href="${esc(goItem.url)}" target="_blank" rel="noopener"><small>${esc(goItem.label)}</small><strong>${esc(goItem.value)}</strong></a><a class="now-inline-item" href="explore.html"><small>This week</small><strong>Events</strong></a></div>`;
    if (window.BurlingtonWeather?.load) window.BurlingtonWeather.load();
  }).catch(() => { host.hidden = true; });
})();
