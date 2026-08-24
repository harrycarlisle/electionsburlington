/* news-v1.js */
(() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fetchJson=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return r.json()};
  const home=()=>location.pathname==='/'||location.pathname.endsWith('/index.html');
  const brandMarkup='<img class="news-brand-logo" src="/logo-mark.png?v=20260824z4" alt="">';

  function restoreBrand(){
    document.querySelectorAll('.header .brand').forEach(b=>{if(!b.classList.contains('brand-mark-only')||!b.querySelector('.news-brand-logo')){b.className='brand news-brand brand-mark-only';b.href='/';b.innerHTML=brandMarkup;b.setAttribute('aria-label','Burlington News home')}});
    let icon=document.querySelector('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href='/logo-mark.png?v=20260824z4';
    const path=location.pathname.replace(/\/$/,'');
    const titles={
      '':'Burlington News | Local news, events and election coverage','/index.html':'Burlington News | Local news, events and election coverage',
      '/head-to-head.html':'Compare Burlington Mayor Candidates | Burlington News','/ballot.html':'Your Burlington Ballot | Burlington News','/ward.html':'What Ward Am I In? | Burlington News',
      '/updates.html':'Latest Burlington News | Burlington News','/explore.html':'Explore Burlington | Burlington News','/promises.html':'Promises & Records | Burlington News','/puzzles.html':'Burlington Puzzles | Burlington News','/elections-for-beginners.html':'Elections for Beginners | Burlington News',
      '/methodology.html':'Sources & Methodology | Burlington News','/help.html':'Help & Feedback | Burlington News','/privacy.html':'Privacy Policy | Burlington News','/terms.html':'Terms of Use | Burlington News','/independent.html':'Independent | Burlington News','/feedback':'Give feedback | Burlington News'
    };
    if(titles[path])document.title=titles[path];else if(/Burlington Election Guide/i.test(document.title))document.title=document.title.replace(/Burlington Election Guide/ig,'Burlington News');
  }
  function restoreBanner(){const election=/(election-guide|head-to-head|ballot|ward|promises|elections-for-beginners)\.html$/.test(location.pathname);let b=document.querySelector('.banner'),h=document.querySelector('.header');if(!election){b?.remove();return}if(!b&&h){b=document.createElement('div');b.className='banner';h.before(b)}if(b)b.innerHTML='<div class="wrap"><strong>2026 election</strong><span class="banner-sep" aria-hidden="true"> · </span><span>Voting starts Oct. 14</span><span class="banner-sep" aria-hidden="true"> · </span><span>Election Day Oct. 26</span></div>'}
  function restoreFooter(){
    let f=document.querySelector('.site-legal-footer');if(!f){f=document.createElement('footer');f.className='site-legal-footer';document.body.appendChild(f)}
    if(f.dataset.newsFooter==='2')return;f.dataset.newsFooter='2';
    f.innerHTML='<div class="site-legal-footer-inner"><div class="footer-news-brand"><span class="news-brand-mark" aria-hidden="true"></span><div><strong>Burlington News</strong><p>Independent news for Burlington, Ontario.</p></div></div><nav class="site-legal-links" aria-label="Burlington News sections"><a href="updates.html">News</a><a href="election-guide.html">Elections</a><a href="explore.html">Explore</a><a href="sports.html">Sports</a><a href="puzzles.html">Games</a><a href="methodology.html">Sources</a><a href="about.html">About Burlington News</a><a href="/feedback/">Feedback</a><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a></nav></div>';
  }

  const isLocalStory=i=>{
    const hay=`${i.title||i.headline||''} ${i.description||i.summary||''} ${i.url||''} ${i.source||''}`.toLowerCase();
    if(/city of burlington|burlingtontoday|focus burlington|burlington election/.test((i.source||'').toLowerCase()))return true;
    return /\bburlington\b|appleby|aldershot|brant street|ward [1-6]|halton region|burloak/.test(hay);
  };
  const normalizedStory=i=>({date:(i.published||i.date||'').slice(0,10),tag:i.tag||'Burlington',headline:i.headline||i.title||'Burlington update',summary:i.summary||i.description||i.headline||i.title||'',why:i.why||'',importance:Number(i.importance||0),url:i.url||'#',image:i.image||''});
  const isEditorialStory=i=>{
    const headline=String(i.headline||'').replace(/\s+/g,' ').trim(),summary=String(i.summary||'').replace(/\s+/g,' ').trim(),words=headline.split(/\s+/).filter(Boolean);
    const blocked=/^(list of candidates|for candidates|candidate financials|candidate news and updates|infrastructure and growth|water and wastewater services|water and wastewater for business|low water.*)$/i;
    return i.url&&!blocked.test(headline)&&words.length>=6&&words.length<=20&&summary.length>=45&&summary.toLowerCase()!==headline.toLowerCase()&&!/(\b\w+\b)(?:\s+\1){2,}/i.test(headline);
  };
  async function getLocalStories(limit=8){
    let items=[];
    try{const monitor=await fetchJson('data/source-monitor.json');items=(monitor.items||[]).filter(isLocalStory).map(normalizedStory).filter(isEditorialStory)}catch(_){}
    if(items.length<3){try{const brief=await fetchJson('data/daily-brief.json');items.push(...(brief.items||[]).filter(isLocalStory).map(normalizedStory))}catch(_){} }
    const seen=new Set();return items.filter(isEditorialStory).filter(i=>{const key=i.url||i.headline;if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,limit);
  }
  function integratedSummary(item){let text=item.summary||'';if(item.importance>=5&&item.why){const w=item.why.trim();if(w&&!text.toLowerCase().includes(w.toLowerCase()))text=`${text.replace(/[.]?$/,'')}. ${w}`}return text}
  function storyCard(item){return `<a class="news-story-card" href="${esc(item.url)}" target="_blank" rel="noopener"><div class="news-story-media">${item.image?`<img src="${esc(item.image)}" alt="" loading="lazy">`:`<div class="news-story-fallback" aria-hidden="true">B</div>`}</div><div class="news-story-body"><span class="news-story-tag">${esc(item.tag)}</span><h3>${esc(item.headline)}</h3><p>${esc(integratedSummary(item))}</p></div></a>`}

  async function rebuildHomeBrief(){
    if(!home())return;const old=document.querySelector('.daily-brief');if(!old)return;
    const items=(await getLocalStories(6)).slice(0,3);if(!items.length)return;
    const section=document.createElement('section');section.className='daily-brief news-brief';section.id='daily-brief';section.innerHTML=`<div class="news-brief-head"><div><h2>Latest in Burlington</h2></div><a href="updates.html">All news →</a></div><div class="news-brief-grid">${items.map(storyCard).join('')}</div>`;old.replaceWith(section);
  }

  async function rebuildUpdates(){
    const out=document.getElementById('updatesList');if(!out)return;
    const items=await getLocalStories(12);if(!items.length)return;const top=items.slice(0,3),newest=items.slice(3);
    out.className='news-page-feed';out.innerHTML=`<section class="updates-top"><div class="section-rule"><h2>Top stories</h2><small>What to know now</small></div><div class="news-brief-grid">${top.map(storyCard).join('')}</div></section>${newest.length?`<section class="updates-newest"><div class="section-rule"><h2>Newest</h2><small>Latest updates</small></div><div class="newest-list">${newest.map(i=>`<a class="newest-row" href="${esc(i.url)}" target="_blank" rel="noopener"><span><small>${esc(i.tag)}</small><strong>${esc(i.headline)}</strong><em>${esc(integratedSummary(i))}</em></span><span aria-hidden="true">→</span></a>`).join('')}</div></section>`:''}`;
    document.querySelector('.updates-page .content-lead')?.replaceChildren(document.createTextNode('Local government, elections, development, transit and decisions that affect Burlington.'));
  }

  function rebuildDates(){
    const grid=document.querySelector('#dates .date-grid');if(!grid)return;
    [...grid.querySelectorAll('.date-stop')].forEach(card=>{
      if(card.tagName==='A'){card.querySelector('.date-calendar-action')?.remove();card.querySelector('.date-source')?.remove();return}
      const titleLink=card.querySelector('.date-title-link'),href=titleLink?.getAttribute('href');if(!href)return;
      if(titleLink){const h=titleLink.closest('h3');if(h)h.textContent=titleLink.textContent}
      card.querySelector('.date-calendar-action')?.remove();card.querySelector('.date-source')?.remove();
      const a=document.createElement('a');a.className=card.className;a.href=href;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',`${card.querySelector('h3')?.textContent||'Election date'} — open details`);a.innerHTML=card.innerHTML;card.replaceWith(a);
    });
  }
  function replacePartner(){const card=document.querySelector('.home-extra-card.partner-card');if(!card)return;card.className='home-extra-card beginner-card';card.href='elections-for-beginners.html';card.innerHTML='<span class="home-extra-icon" aria-hidden="true">?</span><div><small>Start here</small><h2>Elections for beginners</h2><p>What a municipal election is, what each job controls and how a city decision actually gets made.</p></div><span aria-hidden="true">→</span>'}
  function cleanCandidateLabels(){document.querySelectorAll('#candidateStrip .focus-label').forEach(x=>x.textContent='Overview')}
  function watchCandidateLabels(){const strip=document.getElementById('candidateStrip');if(!strip||strip.dataset.newsLabelWatch)return;strip.dataset.newsLabelWatch='1';new MutationObserver(()=>cleanCandidateLabels()).observe(strip,{childList:true,subtree:true,characterData:true})}

  async function runDynamic(){restoreBrand();restoreBanner();restoreFooter();cleanCandidateLabels();watchCandidateLabels();replacePartner();rebuildDates();try{await rebuildHomeBrief()}catch(e){console.warn('Local brief unavailable',e)}try{await rebuildUpdates()}catch(e){console.warn('News feed unavailable',e)}restoreBrand();restoreFooter()}
  const schedule=()=>{runDynamic();setTimeout(runDynamic,350);setTimeout(runDynamic,1100)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();

/* news-v2.js */
(() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const home=()=>location.pathname==='/'||location.pathname.endsWith('/index.html');
  const dateText=()=>new Intl.DateTimeFormat('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());
  const evidenceLabel=item=>{
    const status=String(item.status||'').toLowerCase(),score=Number(item.evidenceScore||0);
    if(/personal experience|assessment|opinion/.test(status))return['Personal experience','evidence-opinion'];
    if(/unsupported|not verified|no reliable/.test(status)||score===0)return['Not verified','evidence-unverified'];
    if(/partly|incomplete|motive/.test(status)||score===1||score===2)return['Partly verified','evidence-partly'];
    return['Verified','evidence-verified'];
  };

  async function stories(){
    try{const r=await fetch('data/source-monitor.json',{cache:'no-store'}),d=await r.json();return (d.items||[]).map(x=>({...x,headline:x.headline||x.title||'',summary:x.summary||x.description||''})).filter(x=>{const words=x.headline.trim().split(/\s+/);return x.url&&words.length>=6&&words.length<=20&&x.summary.length>=45&&!/^(List of Candidates|For Candidates|Candidate Financials|Candidate News and Updates|Infrastructure and Growth|Low Water.*)$/i.test(x.headline)&&x.summary.toLowerCase()!==x.headline.toLowerCase()&&!/(\b\w+\b)(?:\s+\1){2,}/i.test(x.headline)}).slice(0,3)}catch(_){return[]}
  }
  const media=item=>item?.image?`<img src="${esc(item.image)}" alt="" loading="eager">`:'<span class="publication-media-mark" aria-hidden="true">B</span>';
  async function buildPublicationHome(){
    if(!home()||document.querySelector('.publication-home'))return;
    const main=document.getElementById('main'),items=await stories();if(!main)return;
    const fallback=[
      {tag:'Election',headline:'A clear guide to Burlington’s 2026 election',summary:'Compare candidates, understand the jobs and see the dates that matter.',url:'#election-guide'},
      {tag:'Your ballot',headline:'See every race on your Burlington ballot',summary:'Choose your ward, then review mayor, councillor and trustee candidates.',url:'ballot.html'},
      {tag:'Explainer',headline:'Municipal elections, explained from zero',summary:'What council controls, who you elect and how a decision becomes real.',url:'elections-for-beginners.html'}
    ];
    const lead=items.find(x=>x.image&&/burlington|burloak|transit/i.test(`${x.tag||''} ${x.headline||''}`))||items.find(x=>x.image)||items[0]||fallback[0];
    const side=[
      {tag:'Wildlife',headline:'Why Burlington closes a road for salamanders',summary:'The annual King Road closure protects endangered Jefferson salamanders during their spring migration.',url:'https://www.burlington.ca/en/news/burlington-protecting-endangered-salamanders-by-closing-king-road.aspx',image:'https://static.inaturalist.org/photos/24040203/large.jpeg'},
      {tag:'Bird migration',headline:'The birds passing Burlington that most people never notice',summary:'RBG’s long-running monitoring tracks migratory birds moving through the western Lake Ontario area.',url:'https://www.rbg.ca/app/uploads/Long-Watch-Birds-2015-2024-Summary-Report.pdf?x51525=',image:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Cerulean%20Warbler,%20Rondeau%20Provincial%20Park,%20Ontario,%20Canada.jpg?width=900'},
      {tag:'Fish',headline:'More than 26,000 fish passed through one local fishway',summary:'RBG’s 2025 count shows what is migrating into Cootes Paradise and which native species are recovering.',url:'https://www.rbg.ca/2025-cootes-paradise-fishway-highlights-fish-and-fish-migration/',image:'https://rbg-1c124.kxcdn.com/app/uploads/DSC03362-scaled.jpg?x51525'}
    ];
    const section=document.createElement('section');section.className='publication-home';section.innerHTML=`
      <div class="publication-dateline"><span>${esc(dateText())}</span><span>Burlington, Ontario</span></div>
      <div class="publication-heading"><h1>Burlington, in one place.</h1><p>Local news, things to do, civic decisions and an election guide that tells you exactly what each choice means.</p></div>
      <div class="publication-lead-grid"><a class="publication-lead" href="${esc(lead.url)}"><div class="publication-lead-media">${media(lead)}</div><span class="publication-tag">${esc(lead.tag||'Burlington')}</span><h2>${esc(lead.headline)}</h2><p>${esc(lead.summary||lead.description||'Open the full update.')}</p></a><div class="publication-side">${side.map(x=>`<a class="publication-side-story" href="${esc(x.url)}" target="_blank" rel="noopener"><div class="publication-side-media">${media(x)}</div><div class="publication-side-copy"><span class="publication-tag">${esc(x.tag||'Burlington')}</span><h3>${esc(x.headline)}</h3><p>${esc(x.summary||x.description||'Open the full update.')}</p></div></a>`).join('')}</div></div>
      <p class="publication-credit">Wildlife images: Jefferson salamander by Jake Scott, CC BY-SA 3.0; Cerulean warbler by Mdf/MPF, CC BY-SA 3.0; Fishway photo via Royal Botanical Gardens.</p>
      <nav class="publication-shortcuts" aria-label="Popular Burlington sections"><a href="updates.html"><small>Newest</small><strong>Today in Burlington</strong></a><a href="explore.html"><small>Do something</small><strong>Explore Burlington</strong></a><a href="#election-guide"><small>2026 vote</small><strong>Election guide</strong></a><a href="puzzles.html"><small>Play</small><strong>Local puzzles</strong></a></nav>`;
    main.prepend(section);
    const hero=document.querySelector('.election-hero');if(hero)hero.id='election-guide';
    const candidates=document.getElementById('candidates');if(candidates&&!document.querySelector('.explore-teaser')){const e=document.createElement('section');e.className='explore-teaser';e.innerHTML='<div><span class="publication-tag">Shuffle your city</span><h2>Find something in Burlington you would never search for.</h2><p>Local oddities, free stops, overlooked history and small challenges. Start with one card and see where it takes you.</p><a href="explore.html">Shuffle the deck →</a></div><div class="explore-stack" aria-hidden="true"><div class="explore-stack-card"></div><div class="explore-stack-card"></div><div class="explore-stack-card"><small>Try this</small><strong>Find the plaque most people walk past.</strong></div></div>';candidates.insertAdjacentElement('beforebegin',e)}
  }
  function fixEvidence(){
    document.querySelectorAll('.community-quote,.ward-community-card').forEach(card=>{const score=card.querySelector('.community-score,.ward-community-score'),status=card.querySelector('.community-status,.ward-community-status');if(!score||score.dataset.fixed)return;const item={status:status?.textContent||'',evidenceScore:Number((score.textContent.match(/\d+/)||[0])[0])},[label,cls]=evidenceLabel(item);score.textContent=label;score.classList.add(cls);score.dataset.fixed='1'});
  }
  function fixCompare(){const head=document.querySelector('main>.head');if(!head||head.dataset.fixed)return;head.dataset.fixed='1';head.className='compare-intro';head.innerHTML='<h1>Settle the debate in seconds.</h1><p>Choose two mayoral candidates and one issue. You’ll see what each person proposes, the shared facts behind the issue and what still needs checking.</p><div class="compare-how"><div><b>1 · Pick two people</b><span>Change either candidate at any time.</span></div><div><b>2 · Choose an issue</b><span>Taxes, housing, traffic and more.</span></div><div><b>3 · Read the difference</b><span>Promises stay separate from verified records.</span></div></div>'}
  function fixBallot(){document.querySelectorAll('.ballot-school-mini b').forEach(label=>{if(/optional ballot detail/i.test(label.textContent))label.textContent='Your trustee race'});document.querySelectorAll('.ward-candidate-card').forEach(card=>{if(card.querySelector('.ward-incumbent'))return;const name=card.dataset.name;if(['Kelvin Galbraith','Paul Sharman','Angelo Bentivegna'].includes(name)){const body=card.querySelector('.ward-candidate-body'),tag=document.createElement('span');tag.className='ward-incumbent';tag.textContent='Current councillor';body?.insertBefore(tag,body.querySelector('.ward-focus-label'))}})}
  function fixPuzzles(){const main=document.querySelector('.puzzles-main');if(!main||main.dataset.copyFixed)return;main.dataset.copyFixed='1';const h=main.querySelector('h1'),lead=main.querySelector('.puzzles-lead');if(h)h.textContent='Puzzles about Burlington.';if(lead)lead.textContent='Visual questions about local places, history and how the city works.';main.querySelectorAll('.section-rule small').forEach(s=>{if(/quick local games/i.test(s.textContent))s.textContent='Popular puzzles'});main.querySelectorAll('.pick-copy h3').forEach(h3=>{if(/how well do you know burlington/i.test(h3.textContent))h3.textContent='Where in Burlington?'})}
  function fixDates(){const section=document.getElementById('dates'),grid=section?.querySelector('.date-grid');if(!section||!grid)return;let detail=section.querySelector('.date-event-detail');if(!detail){detail=document.createElement('article');detail.className='date-event-detail';detail.id='date-event-detail';detail.innerHTML='<span class="date-detail-kicker">Event details</span><h3>Select a date above</h3><p>The full date and time will appear here.</p>';grid.insertAdjacentElement('afterend',detail)}grid.querySelectorAll('.date-stop,.date-card').forEach(card=>{if(card.dataset.detailBound)return;card.dataset.detailBound='1';card.addEventListener('click',e=>{e.preventDefault();const date=card.querySelector('.date-calendar-day,.date')?.textContent?.trim()||'',month=card.querySelector('.date-calendar-month')?.textContent?.trim()||'',title=card.querySelector('h3')?.textContent?.trim()||'Election event',copy=card.querySelector('p')?.textContent?.trim()||'';detail.innerHTML=`<span class="date-detail-kicker">${esc([month,date].filter(Boolean).join(' '))}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p>`;detail.scrollIntoView({behavior:'smooth',block:'center'})})})}
  function tidyFooter(){document.querySelectorAll('.site-legal-links').forEach(nav=>{if(!nav.querySelector('a[href="promises.html"]'))nav.insertAdjacentHTML('afterbegin','<a href="promises.html">Promises & records</a><a href="explore.html">Explore Burlington</a>')})}
  async function enhancePromises(){const shell=document.querySelector('.record-shell'),toolbar=document.querySelector('.record-toolbar');if(!shell||!toolbar||document.querySelector('.polimeter-summary')||shell.dataset.summaryLoading)return;shell.dataset.summaryLoading='1';try{const data=await fetch('data/track-record.json',{cache:'no-store'}).then(r=>r.json()),wrap=document.createElement('section');wrap.className='polimeter-summary';wrap.innerHTML=Object.entries(data.candidates||{}).map(([name,p])=>{const counts={kept:0,progress:0,partial:0,broken:0,other:0};(p.items||[]).forEach(i=>{const s=String(i.status||'').toLowerCase();if(s==='kept')counts.kept++;else if(/advanced|progress/.test(s))counts.progress++;else if(/partial/.test(s))counts.partial++;else if(/broken|not kept/.test(s))counts.broken++;else counts.other++});const total=p.items.length||1,bar=Object.entries(counts).filter(([,n])=>n).map(([k,n])=>`<span class="bar-${k}" style="width:${n/total*100}%"></span>`).join('');return `<article class="promise-overview"><div class="promise-overview-top"><div><span class="promise-place">Burlington · In office</span><small>Current Ward 2 councillor</small><h2>${esc(name)}</h2></div><span class="promise-see">Reviewed record</span></div><div class="promise-metrics"><div><small>Promises tracked</small><strong>${p.items.length}</strong></div><div><small>Last review</small><strong>${esc(data.updated)}</strong></div><div><small>Overall score</small><strong>Not published</strong></div></div><div class="promise-bar" aria-label="Reviewed promise statuses">${bar}</div><div class="promise-legend"><span><i class="bar-kept"></i>Kept ${counts.kept}</span><span><i class="bar-progress"></i>In progress ${counts.progress}</span>${counts.partial?`<span><i class="bar-partial"></i>Partly kept ${counts.partial}</span>`:''}${counts.broken?`<span><i class="bar-broken"></i>Broken ${counts.broken}</span>`:''}</div><p class="promise-sample-note">This describes the ${p.items.length} commitments reviewed so far. It is not a complete record or a candidate grade.</p></article>`}).join('');toolbar.before(wrap)}catch(_){}finally{shell.dataset.summaryLoading=''}}
  function run(){fixCompare();fixBallot();fixEvidence();fixPuzzles();fixDates();tidyFooter();enhancePromises()}
  document.addEventListener('DOMContentLoaded',()=>{buildPublicationHome();run();const body=document.body;if(body)new MutationObserver(()=>run()).observe(body,{childList:true,subtree:true})},{once:true});
})();
