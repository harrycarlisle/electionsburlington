import {
  canLabelMostRead,
  effectiveFreshnessTimestamp,
  popularityScore,
  relativeTime,
  selectNewest
} from '/lib/homepage-ranking.js?v=20260826nv2';

(() => {
  const latestList = document.getElementById('latestList');
  const newestRail = document.querySelector('.newest');
  const pickGrid = document.getElementById('pickGrid');
  const picksTitle = document.getElementById('picksTitle');
  const lead = document.querySelector('.top-story');
  const leadGrid = document.querySelector('.lead-grid');
  const REFRESH_MS = 5 * 60 * 1000;
  const cleanDash = value => String(value || '').replace(/(\d)[—–](\d)/g, '$1-$2').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const STORY_ALIASES = {'burlington-hotspots-0-24':'burlington-ultimate-team-0-24'};
  const publicUrl = value => { const raw=String(value||''); if(/^https?:\/\//.test(raw))return raw; const story=raw.match(/^articles\/([^/]+)\.html$/); if(story)return `/stories/${STORY_ALIASES[story[1]]||story[1]}/`; const clean=raw.match(/^\/stories\/([^/]+)\/?$/); if(clean&&STORY_ALIASES[clean[1]])return `/stories/${STORY_ALIASES[clean[1]]}/`; if(raw==='updates.html')return '/news/'; if(raw==='explore.html')return '/explore/'; if(raw==='election-guide.html'||raw.startsWith('election-guide.html'))return raw.replace('election-guide.html','/elections/'); if(raw==='skyway-traffic.html')return '/traffic/'; if(raw==='sports.html')return '/sports/'; if(raw==='puzzles.html')return '/games/'; return raw.startsWith('/')?raw:`/${raw}`; };
  const TOPIC_LABELS={'public-safety':'Public safety',food:'Food',development:'Development',history:'History',election:'Election',schools:'Schools',events:'Events',sports:'Sports',nature:'Nature',traffic:'Traffic',transportation:'Transportation',canada:'Canada',burlington:'Burlington'};
  const categoryLabel=item=>{if(item?.topic&&TOPIC_LABELS[item.topic])return TOPIC_LABELS[item.topic];const h=`${item?.label||''} ${item?.tag||''} ${item?.kind||''} ${item?.headline||''}`.toLowerCase();if(/election|ward|vote|candidate|ballot/.test(h))return'Election';if(/school|student|teacher|back to school/.test(h))return'Schools';if(/cafe|restaurant|food|ribfest/.test(h))return'Food';if(/tunnel|history/.test(h))return'History';if(/development|brant|building|housing|millcroft|zoning|construction|data centre/.test(h))return'Development';if(/traffic|qew|skyway|road|closure/.test(h))return'Traffic';if(/sport|soccer|hockey|ringette|lacrosse|ultimate|golf/.test(h))return'Sports';if(/event|festival|weekend|concert/.test(h))return'Events';if(/fish|wildlife|nature|salamander|marsh|park|quarry|rabies/.test(h))return'Nature';if(/crime|police|safety/.test(h))return'Public safety';return item?.label||'Burlington';};
  function tightenDeck(value){let text=cleanDash(value).replace(/\s+/g,' ').trim();if(!text)return'';const sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);const words=text.split(/\s+/);if(words.length<=18&&sentences.length<=1)return text;if(sentences[0]&&sentences[0].split(/\s+/).length<=18)return sentences[0];return `${words.slice(0,16).join(' ').replace(/[.,;:]$/,'')}.`;}
  const CRIME_IMAGE='/assets/stories/public-safety/halton-police-crime-burlington.webp';
  const HERO_FALLBACKS={
    'burlington-flood-protection-90-million':'/assets/home/skyway-reader.webp',
    'burlington-road-closures-september-2026':'/assets/home/skyway.webp',
    'e-scooter-burlington-rules':'/assets/editorial/centennial-trail-e-scooter.webp',
    'burlington-ultimate-team-0-24':'/assets/sports/burlington-ultimate-toss-bosses.webp',
    'burlington-hotspots-0-24':'/assets/sports/burlington-ultimate-toss-bosses.webp',
    'nostalgia-games-cafe-closure':'/assets/local-business/nostalgia-games-cafe.webp',
    '730-brant-vacant-building':'/assets/editorial/730-brant-vacant-building.webp'
  };
  const displayHeadline=item=>/crime|burlington-crime/i.test(`${item?.id||''} ${item?.headline||''}`)?'How bad is crime in Burlington, really?':(/hotspots-0-24|ultimate-team-0-24|toss bosses|0–24|0-24/i.test(`${item?.id||''} ${item?.headline||''}`)?'This Burlington team has lost 24 straight games. Why do they keep coming back?':cleanDash(item.headline));
  const displayDeck=item=>tightenDeck(item.deck||'');
  function storyImage(item,fallback,hero=false){const raw=item.image?(item.image.startsWith('/')?item.image:`/${item.image}`):fallback;if(/crime/i.test(`${item.id||''} ${item.headline||''}`)&&/\.svg$|chart|comparison|halton-police-dusk/i.test(raw))return CRIME_IMAGE;if(hero&&(/\.svg(?:\?|$)/i.test(raw)||/timeline|chart|map|diagram|comparison|infographic/i.test(raw)))return HERO_FALLBACKS[item.id]||fallback;return raw;}
  function renderLead(item){if(!lead||!item?.headline||!item?.url)return;const url=publicUrl(item.url);const external=/^https?:\/\//.test(url);const image=storyImage(item,'/assets/editorial/home-share.webp',true);const deck=displayDeck(item);lead.innerHTML=`<a href="${esc(url)}"${external?' target="_blank" rel="noopener"':''}><div class="top-image"><img src="${esc(image)}" alt="${esc(item.alt||item.headline)}" fetchpriority="high"></div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(displayHeadline(item))}</h1>${deck?`<p>${esc(deck)}</p>`:''}</div></a>`;}
  function hideNewest(){if(newestRail){newestRail.hidden=true;newestRail.setAttribute('aria-hidden','true')}if(latestList)latestList.innerHTML='';leadGrid?.classList.add('is-hero-only');}
  function renderNewest(items,heroId){const picked=selectNewest(items,{heroId,limit:3});if(!latestList||!newestRail||!picked.items.length){hideNewest();return[]}newestRail.hidden=false;newestRail.removeAttribute('aria-hidden');leadGrid?.classList.remove('is-hero-only');latestList.innerHTML=picked.items.map(item=>{const url=publicUrl(item.url);const stamp=relativeTime(item.lastMeaningfulUpdate||item.publishedAt||item.datePublished||item.published||item.activeFrom);return `<a href="${esc(url)}"><span><small>${esc(categoryLabel(item))}</small><strong>${esc(displayHeadline(item))}</strong>${stamp?`<time>${esc(stamp)}</time>`:''}</span></a>`}).join('');return picked.items;}
  function renderPicks(items,readStats){if(!pickGrid||!items.length)return;const sample=Object.values(readStats||{}).reduce((sum,row)=>sum+(Number(row.opens)||0),0);if(picksTitle)picksTitle.textContent=canLabelMostRead(sample)?'Popular now':'Top picks';pickGrid.innerHTML=items.slice(0,3).map(item=>{const url=publicUrl(item.url);const image=storyImage(item,'/assets/editorial/home-share.webp');const hook=displayDeck(item);return `<a class="pick-card" href="${esc(url)}"><div class="pick-image"><img src="${esc(image)}" alt="${esc(item.alt||item.headline)}" loading="lazy"></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(displayHeadline(item))}</h3>${hook?`<p class="pick-hook">${esc(hook)}</p>`:''}</a>`}).join('');}
  function localReadStats(){try{return JSON.parse(localStorage.getItem('bn-article-read-counts')||'{}')}catch(_){return{}}}
  async function refresh(){try{const r=await fetch('/data/home-surface.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json();const feature=(data.feature||[])[0];if(feature)renderLead(feature);const items=data.latest||data.items||[];const newest=renderNewest(items,feature?.id);const exclude=new Set([feature?.id,...newest.map(x=>x.id)].filter(Boolean));const picks=(data.popular||items).filter(x=>!exclude.has(x.id)).sort((a,b)=>popularityScore(b,localReadStats())-popularityScore(a,localReadStats()));renderPicks(picks,localReadStats());}catch(_){}}
  refresh();setInterval(refresh,REFRESH_MS);
})();
