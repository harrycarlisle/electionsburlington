import {
  canLabelMostRead,
  effectiveFreshnessTimestamp,
  popularityScore,
  relativeTime
} from '/lib/homepage-ranking.js?v=20260826nv2';

(() => {
  const latestList=document.getElementById('latestList'),newestRail=document.getElementById('newestRail'),pickGrid=document.getElementById('pickGrid'),picksTitle=document.getElementById('picksTitle'),lead=document.querySelector('.top-story');
  const REFRESH_MS=5*60*1000,NEWEST_HOME_WINDOW_MS=7*24*60*60*1000;
  const cleanDash=value=>String(value||'').replace(/(\d)[—–](\d)/g,'$1-$2').replace(/[—–]/g,',').replace(/\s+,/g,',');
  const esc=value=>cleanDash(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORY_ALIASES={'burlington-hotspots-0-24':'burlington-ultimate-team-0-24'};
  const publicUrl=value=>{const raw=String(value||'');if(/^https?:\/\//.test(raw))return raw;const story=raw.match(/^articles\/([^/]+)\.html$/);if(story)return `/stories/${STORY_ALIASES[story[1]]||story[1]}/`;return raw.startsWith('/')?raw:`/${raw}`};
  const TOPIC_LABELS={'public-safety':'Public safety',food:'Food',development:'Development',history:'History',election:'Election',schools:'Schools',events:'Events',sports:'Sports',nature:'Nature',traffic:'Traffic',transportation:'Transportation',canada:'Canada',burlington:'Burlington'};
  const categoryLabel=item=>item?.topic&&TOPIC_LABELS[item.topic]?TOPIC_LABELS[item.topic]:(item?.label||item?.category||'Burlington');
  const CRIME_IMAGE='/assets/stories/public-safety/halton-police-crime-burlington.webp';

  const BREAKING_HERO_OVERRIDES={
    'burlington-maple-richmond-fatal-hit-and-run':{
      image:'assets/IMG_4780.jpeg',
      alt:'Image related to the fatal hit-and-run investigation near Maple Avenue and Richmond Road in Burlington.',
      deck:'Police are asking for help finding a dark sedan after Thursday’s collision near Maple Avenue and Richmond Road.'
    },
    '57a3ede36411e1b6':{
      image:'assets/cops-2.png',
      alt:'Police vehicles and emergency lights at a nighttime police scene.',
      deck:'Several people fled as officers arrived on Mud Street East, and the Shooting Response Team is investigating what happened.'
    },
    'police-seize-five-firearms-mud-street':{
      image:'assets/cops-2.png',
      alt:'Police vehicles and emergency lights at a nighttime police scene.',
      deck:'Several people fled as officers arrived on Mud Street East, and the Shooting Response Team is investigating what happened.'
    }
  };

  /* Only reference assets that actually exist in the published repository. */
  const IMAGE_OVERRIDES={
    'e-scooter-burlington-rules':'assets/e-scooter.png',
    'burlington-rabies-bat-2026':'assets/bat.png',
    'upper-middle-road-construction-2026':'assets/upper-middle-construction.png',
    'burlington-road-closures-september-2026':'assets/road-closure.png',
    'burlington-flood-protection-90-million':'assets/upper-middle-construction.png',
    'sekisui-burlington-modular-factory':'assets/condo-construction.png',
    'ribfest-2026':'assets/rib-fest.png',
    'ontario-student-rights-school':'assets/back-to-school.png',
    'back-to-school-2026':'assets/back-to-school.png',
    'millcroft-phase-2-138-homes':'assets/condo-construction.png',
    'costco-burloak-wyecroft':'assets/costco.png',
    'nelson-quarry-tribunal-decision':'assets/nelson-quarry.png',
    'burlington-maple-richmond-fatal-hit-and-run':'assets/IMG_4780.jpeg',
    '57a3ede36411e1b6':'assets/cops-2.png',
    'police-seize-five-firearms-mud-street':'assets/cops-2.png'
  };

  const ALT_OVERRIDES={
    'e-scooter-burlington-rules':'A person riding an e-scooter along the right side of a suburban Burlington-area street.',
    'burlington-rabies-bat-2026':'A bat hanging beneath the eaves of a suburban home at dusk.',
    'upper-middle-road-construction-2026':'Road construction on a wide Burlington arterial road.',
    'burlington-road-closures-september-2026':'Road construction and lane restrictions on a Burlington arterial road.',
    'burlington-flood-protection-90-million':'Infrastructure construction along a Burlington roadway.',
    'sekisui-burlington-modular-factory':'Residential construction underway in the Burlington area.',
    'ribfest-2026':'Ribs cooking on a grill at Burlington Ribfest.',
    'ontario-student-rights-school':'Students walking toward a school entrance beside a yellow school bus.',
    'back-to-school-2026':'Students walking toward a school entrance beside a yellow school bus.',
    'millcroft-phase-2-138-homes':'A mid-rise residential building under construction with a tower crane.',
    'costco-burloak-wyecroft':'Costco storefront and entrance in a suburban shopping area.',
    'nelson-quarry-tribunal-decision':'Nelson Quarry and the Mount Nemo area in north Burlington.',
    'burlington-maple-richmond-fatal-hit-and-run':'Image related to the fatal hit-and-run investigation near Maple Avenue and Richmond Road in Burlington.',
    '57a3ede36411e1b6':'Police vehicles and emergency lights at a nighttime police scene.',
    'police-seize-five-firearms-mud-street':'Police vehicles and emergency lights at a nighttime police scene.'
  };

  const imageFor=item=>BREAKING_HERO_OVERRIDES[item?.id]?.image||IMAGE_OVERRIDES[item?.id]||item?.image||'';
  const altFor=item=>BREAKING_HERO_OVERRIDES[item?.id]?.alt||ALT_OVERRIDES[item?.id]||item?.alt||item?.headline||'Burlington News';
  const fallbackImageFor=item=>{
    const topic=String(item?.topic||item?.label||item?.category||'').toLowerCase();
    if(/public|safety|police|crime/.test(topic))return '/assets/cops-2.png';
    if(/sport/.test(topic))return '/assets/ultimate-frisbee-burlington.png';
    if(/traffic|road|transport/.test(topic))return '/assets/road-closure.png';
    if(/development|infrastructure|burlington/.test(topic))return '/assets/condo-construction.png';
    return '/assets/editorial/home-share.webp';
  };

  const SAFE_PICK_FALLBACKS=[
    {id:'burlington-ultimate-team-0-24',headline:'This Burlington team is 0-24. Why do they keep coming back?',deck:'Two seasons have ended without a win, but the team finishing this summer did not look like the one that started it.',label:'Sports',topic:'sports',url:'articles/burlington-ultimate-team-0-24.html',image:'assets/ultimate-frisbee-burlington.png',alt:'Burlington ultimate players on a grass field during a recreational game.',placementScore:70},
    {id:'skyway-bridge-story',headline:'Ontario nearly replaced the Skyway with three tunnels.',deck:'The tunnel plan got much further than most Burlington residents probably realize.',label:'History',topic:'history',url:'articles/skyway-bridge-story.html',image:'assets/home/skyway-reader.webp',alt:'The Burlington Bay James N. Allan Skyway across Burlington Bay.',placementScore:68},
    {id:'nostalgia-games-cafe-closure',headline:'A Burlington gathering place closed. The problem wasn’t demand.',deck:'A large community and a last fundraising push could not solve an occupancy and renovation problem.',label:'Local business',topic:'food',url:'articles/nostalgia-games-cafe-closure.html',image:'assets/local-business/nostalgia-games-cafe.webp',alt:'The interior of Nostalgia Candy Café in Burlington.',placementScore:66}
  ];

  const naturalHeadline=value=>cleanDash(value).replace(/\.\s+Here is where\.?$/i,'.').replace(/\.\s+Here is how\.?$/i,'.').replace(/\.\s+Here is why\.?$/i,'.');
  const displayHeadline=item=>/crime|burlington-crime/i.test(`${item?.id||''} ${item?.headline||''}`)?'How bad is crime in Burlington, really?':(/hotspots-0-24|ultimate-team-0-24|toss bosses|0–24|0-24/i.test(`${item?.id||''} ${item?.headline||''}`)?'This Burlington team is 0-24. Why do they keep coming back?':naturalHeadline(item.headline));
  const displayDeck=item=>{
    if(BREAKING_HERO_OVERRIDES[item?.id]?.deck)return BREAKING_HERO_OVERRIDES[item.id].deck;
    const key=`${item?.id||''} ${item?.headline||''}`;
    if(/burlington-flood-protection-90-million|stormwater/i.test(key))return 'Tuck Creek is one place to see what changed after 2014, and what remains unfinished.';
    if(/crime|burlington-crime/i.test(key))return 'Burlington remains one of Canada’s safer large communities, but the latest comparable data point in one direction worth watching.';
    if(/ultimate-team-0-24|toss bosses|0-24|0–24/i.test(key))return 'Two seasons have ended without a win, but the team finishing this summer did not look like the one that started it.';
    return cleanDash(item?.deck||item?.summary||item?.description||'').replace(/\s+/g,' ').trim();
  };

  const isEditorialGraphic=item=>{const image=imageFor(item),descriptor=`${image} ${altFor(item)} ${item?.credit||''}`;return /\.svg(?:\?|$)/i.test(String(image||''))||/timeline|chart|map|diagram|comparison|infographic|schematic|orientation graphic/i.test(descriptor)};
  const hasPhoto=item=>Boolean(imageFor(item))&&!isEditorialGraphic(item);
  const uniqueById=items=>{const seen=new Set();return items.filter(item=>{const key=item?.id||item?.url||item?.headline;if(!key||seen.has(key))return false;seen.add(key);return true})};
  const storyAgeMs=(item,now=Date.now())=>{const ts=effectiveFreshnessTimestamp(item);return ts?Math.max(0,now-ts):Infinity};
  const freshnessScore=(item,now=Date.now())=>{const age=storyAgeMs(item,now);if(age<=6*3600000)return 100;if(age<=24*3600000)return 85;if(age<=72*3600000)return 65;if(age<=NEWEST_HOME_WINDOW_MS)return 40;return 20};
  const heroScore=(item,now=Date.now())=>hasPhoto(item)?((Number(item?.placementScore)||0)*0.9+freshnessScore(item,now)*0.1):-Infinity;
  const heroReason=(item,score)=>`final=${score.toFixed(1)}; placement=${Number(item?.placementScore)||0} (90%); freshness=${freshnessScore(item)} (10%); real-photo gate=pass`;
  const statsFor=(item,statsMap)=>{const candidates=[item?.id,item?.url,publicUrl(item?.url),item?.headline].filter(Boolean);for(const key of candidates){const row=statsMap?.[key];if(row&&typeof row==='object')return row}return{}};
  const topPickScore=(item,statsMap)=>popularityScore(statsFor(item,statsMap),Number(item?.placementScore)||0);
  const totalBehaviourSample=statsMap=>Object.values(statsMap||{}).reduce((sum,row)=>sum+(Number(row?.reads24h)||Number(row?.opens)||0),0);
  const liveKeys=doc=>{const keys=new Set();for(const item of doc?.items||[]){if(item?.id)keys.add(String(item.id));if(item?.storyUrl)keys.add(publicUrl(item.storyUrl));}return keys};
  const isLiveStory=(item,keys)=>keys.has(String(item?.id||''))||keys.has(publicUrl(item?.url||''));

  const breakingHeroFrom=doc=>{
    if(doc?.mode!=='breaking')return null;
    const item=(doc.items||[]).find(row=>row?.storyUrl&&row?.id&&!/road-closure$/.test(row.id));
    if(!item)return null;
    const override=BREAKING_HERO_OVERRIDES[item.id]||{};
    return {...item,url:item.storyUrl,label:item.category||'Breaking News',topic:'public-safety',image:override.image||IMAGE_OVERRIDES[item.id]||item.image||'',alt:override.alt||ALT_OVERRIDES[item.id]||item.alt||item.headline,deck:override.deck||item.deck||item.summary||'',placementScore:100};
  };

  function renderLead(item,score){
    if(!lead||!item?.headline||!item?.url||isEditorialGraphic(item))return;
    const url=publicUrl(item.url),external=/^https?:\/\//.test(url),raw=imageFor(item),image=/crime/i.test(`${item.id||''} ${item.headline||''}`)?CRIME_IMAGE:(raw.startsWith('/')?raw:`/${raw}`),deck=displayDeck(item),fallback=fallbackImageFor(item);
    if(!raw)return;
    lead.dataset.selectionScore=score.toFixed(1);lead.dataset.selectionReason=heroReason(item,score);lead.dataset.storyId=item.id||'';
    lead.innerHTML=`<a href="${esc(url)}"${external?' target="_blank" rel="noopener"':''}><div class="top-image"><img src="${esc(image)}" alt="${esc(altFor(item))}" fetchpriority="high" onerror="this.onerror=null;this.src='${esc(fallback)}';this.closest('.top-image')?.classList.add('image-fallback')"></div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(displayHeadline(item))}</h1>${deck?`<p>${esc(deck)}</p>`:''}</div></a>`;
  }

  function hideNewest(){if(newestRail){newestRail.hidden=true;newestRail.setAttribute('aria-hidden','true')}if(latestList)latestList.innerHTML=''}
  function renderNewest(items,heroId,liveSet){
    const now=Date.now();
    const picked=uniqueById(items).filter(item=>item?.id&&item.id!==heroId&&!isLiveStory(item,liveSet)&&item.status!=='expired').map(item=>({item,ts:effectiveFreshnessTimestamp(item)})).filter(row=>row.ts&&now-row.ts>=0&&now-row.ts<=NEWEST_HOME_WINDOW_MS).sort((a,b)=>b.ts-a.ts).slice(0,3).map(row=>row.item);
    if(!latestList||!newestRail||!picked.length){hideNewest();return[]}
    newestRail.hidden=false;newestRail.removeAttribute('aria-hidden');newestRail.dataset.selectionReason='strict chronology; current breaking/hero excluded; past breaking stories stay eligible; 3 stories';
    latestList.innerHTML=picked.map(item=>{const url=publicUrl(item.url),stamp=relativeTime(item.lastMeaningfulUpdate||item.publishedAt||item.datePublished||item.published||item.activeFrom);return `<a href="${esc(url)}" data-story-id="${esc(item.id||'')}"><span><small>${esc(categoryLabel(item))}</small><strong>${esc(displayHeadline(item))}</strong>${stamp?`<time>${esc(stamp)}</time>`:''}</span></a>`}).join('');return picked
  }

  function renderPicks(items,readStats){
    if(!pickGrid||!items.length)return;
    const sample=totalBehaviourSample(readStats);if(picksTitle)picksTitle.textContent=canLabelMostRead(sample)?'Popular now':'Top picks';
    const visible=uniqueById([...items.filter(hasPhoto),...SAFE_PICK_FALLBACKS]).filter(hasPhoto).map(item=>({item,score:topPickScore(item,readStats)})).sort((a,b)=>b.score-a.score).slice(0,3);if(!visible.length)return;
    pickGrid.dataset.selectionReason='per-story popularity score; active live-update stories excluded; three desktop cards, two on mobile';
    pickGrid.innerHTML=visible.map(({item,score})=>{const url=publicUrl(item.url),raw=imageFor(item),image=raw.startsWith('/')?raw:`/${raw}`,hook=displayDeck(item),stats=statsFor(item,readStats),fallback=fallbackImageFor(item);return `<a class="pick-card" href="${esc(url)}" data-story-id="${esc(item.id||'')}" data-selection-score="${score.toFixed(2)}" data-reads-24h="${Number(stats.reads24h)||0}"><div class="pick-image"><img src="${esc(image)}" alt="${esc(altFor(item))}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallback)}'"></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(displayHeadline(item))}</h3>${hook?`<p class="pick-hook">${esc(hook)}</p>`:''}</a>`}).join('')
  }

  function localReadStats(){try{return JSON.parse(localStorage.getItem('bn-article-read-counts')||'{}')}catch(_){return{}}}

  async function refresh(){
    try{
      const [homeResponse,liveResponse,archiveResponse]=await Promise.all([
        fetch('/data/home-surface.json',{cache:'no-store'}),
        fetch('/data/breaking-now.json',{cache:'no-store'}).catch(()=>null),
        fetch('/data/breaking-archive.json',{cache:'no-store'}).catch(()=>null)
      ]);
      if(!homeResponse.ok)return;
      const data=await homeResponse.json(),liveDoc=liveResponse?.ok?await liveResponse.json():{},archiveDoc=archiveResponse?.ok?await archiveResponse.json():{},archiveItems=archiveDoc?.items||[],activeLive=liveKeys(liveDoc),breakingHero=breakingHeroFrom(liveDoc),all=uniqueById([...(data.feature||[]),...(data.latest||[]),...(data.rail||[]),...archiveItems]),heroCandidates=uniqueById([...(data.feature||[]),...all]).filter(item=>hasPhoto(item)&&!isLiveStory(item,activeLive)).map(item=>({item,score:heroScore(item)})).sort((a,b)=>b.score-a.score),heroPick=breakingHero?{item:breakingHero,score:100}:heroCandidates[0];
      if(heroPick)renderLead(heroPick.item,heroPick.score);
      const feature=heroPick?.item,items=uniqueById([...archiveItems,...(data.latest||[]),...(data.rail||[]),...(data.feature||[])]),newest=renderNewest(items,feature?.id,activeLive),exclude=new Set([feature?.id,...newest.map(x=>x.id)].filter(Boolean)),readStats=localReadStats();
      const candidates=uniqueById([...(data.popular||[]),...all,...SAFE_PICK_FALLBACKS]).filter(x=>!exclude.has(x.id)&&!isLiveStory(x,activeLive));
      renderPicks(candidates,readStats);
    }catch(_){ }
  }

  refresh();
  setInterval(refresh,REFRESH_MS);
})();
