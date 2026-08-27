import {
  canLabelMostRead,
  popularityScore,
  relativeTime,
  selectNewest
} from '/lib/homepage-ranking.js?v=20260826nv2';

(() => {
  const latestList=document.getElementById('latestList'),newestRail=document.getElementById('newestRail'),pickGrid=document.getElementById('pickGrid'),picksTitle=document.getElementById('picksTitle'),lead=document.querySelector('.top-story');
  const REFRESH_MS=5*60*1000,NEWEST_HOME_WINDOW_MS=7*24*60*60*1000;
  const cleanDash=value=>String(value||'').replace(/(\d)[—–](\d)/g,'$1-$2').replace(/[—–]/g,',').replace(/\s+,/g,',');
  const esc=value=>cleanDash(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORY_ALIASES={'burlington-hotspots-0-24':'burlington-ultimate-team-0-24'};
  const publicUrl=value=>{const raw=String(value||'');if(/^https?:\/\//.test(raw))return raw;const story=raw.match(/^articles\/([^/]+)\.html$/);if(story)return `/stories/${STORY_ALIASES[story[1]]||story[1]}/`;return raw.startsWith('/')?raw:`/${raw}`};
  const TOPIC_LABELS={'public-safety':'Public safety',food:'Food',development:'Development',history:'History',election:'Election',schools:'Schools',events:'Events',sports:'Sports',nature:'Nature',traffic:'Traffic',transportation:'Transportation',canada:'Canada',burlington:'Burlington'};
  const categoryLabel=item=>item?.topic&&TOPIC_LABELS[item.topic]?TOPIC_LABELS[item.topic]:(item?.label||'Burlington');
  const CRIME_IMAGE='/assets/stories/public-safety/halton-police-crime-burlington.webp';
  const SAFE_PICK_FALLBACKS=[
    {id:'burlington-ultimate-team-0-24',headline:'This Burlington team has lost 24 straight games. Why do they keep coming back?',deck:'After an 0-12 season, they changed the name. Twelve games later, they were still waiting for a win.',label:'Sports',topic:'sports',url:'articles/burlington-ultimate-team-0-24.html',image:'assets/ultimate-frisbee-burlington.png',alt:'Burlington ultimate players on a grass field during a recreational game.'},
    {id:'skyway-bridge-story',headline:'Ontario nearly replaced the Skyway with three tunnels.',deck:'The tunnel plan got much further than most Burlington residents probably realize.',label:'History',topic:'history',url:'articles/skyway-bridge-story.html',image:'assets/home/skyway-reader.webp',alt:'The Burlington Bay James N. Allan Skyway across Burlington Bay.'}
  ];
  const displayHeadline=item=>/crime|burlington-crime/i.test(`${item?.id||''} ${item?.headline||''}`)?'How bad is crime in Burlington, really?':(/hotspots-0-24|ultimate-team-0-24|toss bosses|0–24|0-24/i.test(`${item?.id||''} ${item?.headline||''}`)?'This Burlington team has lost 24 straight games. Why do they keep coming back?':cleanDash(item.headline));
  const displayDeck=item=>{
    if(/crime|burlington-crime/i.test(`${item?.id||''} ${item?.headline||''}`))return 'Burlington remains one of the safer large communities in Canada, but the latest comparable data shows one category moving in the wrong direction.';
    return cleanDash(item?.deck||'').replace(/\s+/g,' ').trim();
  };
  const isEditorialGraphic=item=>{const descriptor=`${item?.image||''} ${item?.alt||''} ${item?.credit||''}`;return /\.svg(?:\?|$)/i.test(String(item?.image||''))||/timeline|chart|map|diagram|comparison|infographic|schematic|orientation graphic/i.test(descriptor)};
  const hasPhoto=item=>Boolean(item?.image)&&!isEditorialGraphic(item);
  const uniqueById=items=>{const seen=new Set();return items.filter(item=>{const key=item?.id||item?.url||item?.headline;if(!key||seen.has(key))return false;seen.add(key);return true})};
  function renderLead(item){
    if(!lead||!item?.headline||!item?.url||isEditorialGraphic(item))return;
    const url=publicUrl(item.url),external=/^https?:\/\//.test(url),raw=item.image?(item.image.startsWith('/')?item.image:`/${item.image}`):CRIME_IMAGE,image=/crime/i.test(`${item.id||''} ${item.headline||''}`)?CRIME_IMAGE:raw,deck=displayDeck(item);
    lead.innerHTML=`<a href="${esc(url)}"${external?' target="_blank" rel="noopener"':''}><div class="top-image"><img src="${esc(image)}" alt="${esc(item.alt||item.headline)}" fetchpriority="high"></div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(displayHeadline(item))}</h1>${deck?`<p>${esc(deck)}</p>`:''}</div></a>`;
  }
  function hideNewest(){if(newestRail){newestRail.hidden=true;newestRail.setAttribute('aria-hidden','true')}if(latestList)latestList.innerHTML=''}
  function renderNewest(items,heroId){
    const picked=selectNewest(items,{heroId,limit:4,windowMs:NEWEST_HOME_WINDOW_MS});
    if(!latestList||!newestRail||!picked.items.length){hideNewest();return[]}
    newestRail.hidden=false;newestRail.removeAttribute('aria-hidden');
    latestList.innerHTML=picked.items.map(item=>{const url=publicUrl(item.url),stamp=relativeTime(item.lastMeaningfulUpdate||item.publishedAt||item.datePublished||item.published||item.activeFrom);return `<a href="${esc(url)}"><span><small>${esc(categoryLabel(item))}</small><strong>${esc(displayHeadline(item))}</strong>${stamp?`<time>${esc(stamp)}</time>`:''}</span></a>`}).join('');return picked.items
  }
  function renderPicks(items,readStats){
    if(!pickGrid||!items.length)return;
    const sample=Object.values(readStats||{}).reduce((sum,row)=>sum+(Number(row.opens)||0),0);if(picksTitle)picksTitle.textContent=canLabelMostRead(sample)?'Popular now':'Top picks';
    const visible=uniqueById([...items.filter(hasPhoto),...SAFE_PICK_FALLBACKS]).filter(hasPhoto).slice(0,3);if(!visible.length)return;
    pickGrid.innerHTML=visible.map(item=>{const url=publicUrl(item.url),raw=item.image?(item.image.startsWith('/')?item.image:`/${item.image}`):CRIME_IMAGE,hook=displayDeck(item);return `<a class="pick-card" href="${esc(url)}"><div class="pick-image"><img src="${esc(raw)}" alt="${esc(item.alt||item.headline)}" loading="lazy"></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(displayHeadline(item))}</h3>${hook?`<p class="pick-hook">${esc(hook)}</p>`:''}</a>`}).join('')
  }
  function localReadStats(){try{return JSON.parse(localStorage.getItem('bn-article-read-counts')||'{}')}catch(_){return{}}}
  async function refresh(){
    try{
      const r=await fetch('/data/home-surface.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),all=uniqueById([...(data.feature||[]),...(data.latest||[]),...(data.rail||[])]),feature=(data.feature||[]).find(hasPhoto)||all.find(hasPhoto);
      if(feature)renderLead(feature);
      const items=uniqueById([...(data.latest||[]),...(data.rail||[]),...(data.feature||[])]),newest=renderNewest(items,feature?.id),exclude=new Set([feature?.id,...newest.map(x=>x.id)].filter(Boolean));
      const ranked=uniqueById([...(data.popular||all),...SAFE_PICK_FALLBACKS]).filter(x=>!exclude.has(x.id)).sort((a,b)=>popularityScore(b,localReadStats())-popularityScore(a,localReadStats()));renderPicks(ranked,localReadStats())
    }catch(_){}
  }
  refresh();setInterval(refresh,REFRESH_MS);
})();
