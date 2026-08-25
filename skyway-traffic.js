(() => {
  const images = [...document.querySelectorAll('[data-camera]')];
  const cameraStatus = document.getElementById('cameraStatus');
  const trafficEstimate = document.getElementById('trafficEstimate');
  const incidentSummary = document.getElementById('incidentSummary');
  const liveCameras = new Set();

  const SKYWAY = {lat:43.295, lon:-79.79};
  const kmBetween = (a,b,c,d) => {
    const r=6371, toRad=x=>x*Math.PI/180;
    const dLat=toRad(c-a), dLon=toRad(d-b);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(q));
  };

  function paintCameraStatus(){
    if(cameraStatus) cameraStatus.textContent=`${liveCameras.size} of ${images.length} cameras live`;
  }
  function markLoaded(image){
    image.closest('.camera-card')?.classList.remove('is-error');
    liveCameras.add(image.dataset.camera); paintCameraStatus();
  }
  function markError(image){
    liveCameras.delete(image.dataset.camera);
    image.closest('.camera-card')?.classList.add('is-error'); paintCameraStatus();
  }

  images.forEach(image=>{
    image.addEventListener('load',()=>{markLoaded(image); scheduleVisualEstimate();});
    image.addEventListener('error',()=>markError(image));
    if(image.complete&&image.naturalWidth) markLoaded(image);
  });

  async function loadIncidents(){
    try{
      const response=await fetch('https://511on.ca/api/v2/get/event?format=json&lang=en',{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const events=await response.json();
      const nearby=(Array.isArray(events)?events:[]).filter(event=>{
        const lat=Number(event.Latitude),lon=Number(event.Longitude);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)) return false;
        const road=String(event.RoadwayName||'').toLowerCase();
        return kmBetween(SKYWAY.lat,SKYWAY.lon,lat,lon)<=8 && (road.includes('qew')||road.includes('403')||road.includes('skyway')||road.includes('burlington'));
      });
      const serious=nearby.filter(event=>event.IsFullClosure||/accident|collision|closure/i.test(`${event.EventType||''} ${event.EventSubType||''} ${event.Description||''}`));
      if(serious.length){
        incidentSummary.textContent=`Ontario 511 reports ${serious.length} active ${serious.length===1?'incident':'incidents'} near the Burlington Skyway. Open Ontario 511 for lane and closure details.`;
        trafficEstimate.dataset.incident='true';
      }else if(nearby.length){
        incidentSummary.textContent=`Ontario 511 reports ${nearby.length} active road ${nearby.length===1?'notice':'notices'} near the Skyway, with no nearby full closure detected.`;
      }else{
        incidentSummary.textContent='Ontario 511 is not reporting a current collision or closure near the Burlington Skyway.';
      }
    }catch(_){
      incidentSummary.textContent='Ontario 511 incident data is temporarily unavailable. The live cameras are still shown below.';
    }
  }

  let visualTimer;
  function scheduleVisualEstimate(){
    clearTimeout(visualTimer);
    visualTimer=setTimeout(runVisualEstimate,900);
  }
  function frameScore(image){
    const canvas=document.createElement('canvas');
    const w=160,h=90; canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,w,h);
    const data=ctx.getImageData(0,Math.floor(h*.28),w,Math.floor(h*.72)).data;
    let edges=0,samples=0,prev=null;
    for(let i=0;i<data.length;i+=16){
      const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
      if(prev!==null&&Math.abs(lum-prev)>34) edges++;
      prev=lum;samples++;
    }
    return samples?edges/samples:0;
  }
  function runVisualEstimate(){
    const readable=images.filter(i=>liveCameras.has(i.dataset.camera)&&i.naturalWidth);
    if(!readable.length){trafficEstimate.textContent='Live camera estimate unavailable';return;}
    try{
      const scores=readable.map(frameScore);
      const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
      const label=avg>.34?'busy':avg>.25?'moderate':'light';
      trafficEstimate.textContent=`Camera view looks ${label}`;
      trafficEstimate.title='Experimental visual estimate from the current camera frames; not an official traffic-speed measurement.';
    }catch(_){
      trafficEstimate.textContent='Live camera views available';
      trafficEstimate.title='This browser does not allow Burlington News to inspect the cross-origin camera pixels, so no visual traffic estimate is shown.';
    }
  }

  function refresh(){
    if(document.hidden) return;
    liveCameras.clear();
    if(cameraStatus) cameraStatus.textContent=`Refreshing ${images.length} cameras…`;
    images.forEach(image=>{image.src=`https://511on.ca/map/Cctv/${image.dataset.camera}?t=${Date.now()}`;});
    loadIncidents();
  }

  loadIncidents();
  scheduleVisualEstimate();
  setInterval(refresh,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
