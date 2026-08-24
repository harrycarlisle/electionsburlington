(() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fetchJson=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return r.json()};
  const home=()=>location.pathname==='/'||location.pathname.endsWith('/index.html');
  const brandMarkup='<span class="news-brand-mark" aria-hidden="true"></span><span class="news-brand-copy"><strong>Burlington News</strong><small>Burlington, Ontario</small></span>';

  function restoreBrand(){
    document.querySelectorAll('.brand').forEach(b=>{if(!b.classList.contains('news-brand')||!b.querySelector('.news-brand-copy')){b.className='brand news-brand';b.href='index.html';b.innerHTML=brandMarkup;b.setAttribute('aria-label','Burlington News home')}});
    let icon=document.querySelector('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href='favicon.svg?v=20260824a';
    const path=location.pathname.replace(/\/$/,'');
    const titles={
      '':'Burlington News | 2026 Municipal Election Guide','/index.html':'Burlington News | 2026 Municipal Election Guide',
      '/head-to-head.html':'Compare Burlington Mayor Candidates | Burlington News','/ballot.html':'Your Burlington Ballot | Burlington News','/ward.html':'What Ward Am I In? | Burlington News',
      '/updates.html':'Burlington in 30 Seconds | Burlington News','/explore.html':'Explore Burlington | Burlington News','/promises.html':'Promises & Records | Burlington News','/puzzles.html':'Burlington Puzzles | Burlington News','/elections-for-beginners.html':'Elections for Beginners | Burlington News',
      '/methodology.html':'Sources & Methodology | Burlington News','/help.html':'Help & Feedback | Burlington News','/privacy.html':'Privacy Policy | Burlington News','/terms.html':'Terms of Use | Burlington News','/independent.html':'Independent | Burlington News','/feedback':'Give feedback | Burlington News'
    };
    if(titles[path])document.title=titles[path];else if(/Burlington Election Guide/i.test(document.title))document.title=document.title.replace(/Burlington Election Guide/ig,'Burlington News');
  }
  function restoreBanner(){let b=document.querySelector('.banner'),h=document.querySelector('.header');if(!b&&h){b=document.createElement('div');b.className='banner';h.before(b)}if(b)b.innerHTML='<div class="wrap"><strong>2026 Election Guide</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Voting starts Oct. 14&nbsp;&nbsp;·&nbsp;&nbsp;Election Day Oct. 26</div>'}
  function restoreFooter(){
    let f=document.querySelector('.site-legal-footer');if(!f){f=document.createElement('footer');f.className='site-legal-footer';document.body.appendChild(f)}
    if(f.dataset.newsFooter==='2')return;f.dataset.newsFooter='2';
    f.innerHTML='<div class="site-legal-footer-inner"><div class="footer-news-brand"><span class="news-brand-mark" aria-hidden="true"></span><div><strong>Burlington News</strong><p>Independent Burlington civic news and a plain-language 2026 municipal election guide.</p></div></div><nav class="site-legal-links" aria-label="Burlington News sections"><a href="updates.html">News</a><a href="election-guide.html#candidates">Candidates</a><a href="ballot.html">Your ballot</a><a href="elections-for-beginners.html">Election 101</a><a href="puzzles.html">Puzzles</a><a href="methodology.html">Sources & methodology</a><a href="help.html#accessibility">Accessibility</a><a href="independent.html">About / Independent</a><a href="/feedback/">Give feedback</a><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a></nav></div>';
  }

  const isLocalStory=i=>{
    const hay=`${i.title||i.headline||''} ${i.description||i.summary||''} ${i.url||''} ${i.source||''}`.toLowerCase();
    if(/city of burlington|burlingtontoday|focus burlington|burlington election/.test((i.source||'').toLowerCase()))return true;
    return /\bburlington\b|appleby|aldershot|brant street|ward [1-6]|halton region|burloak/.test(hay);
  };
  const normalizedStory=i=>({date:(i.published||i.date||'').slice(0,10),tag:i.tag||'Burlington',headline:i.headline||i.title||'Burlington update',summary:i.summary||i.description||i.headline||i.title||'',why:i.why||'',importance:Number(i.importance||0),url:i.url||'#',image:i.image||''});
  async function getLocalStories(limit=8){
    let items=[];
    try{const monitor=await fetchJson('data/source-monitor.json');items=(monitor.items||[]).filter(isLocalStory).map(normalizedStory)}catch(_){}
    if(items.length<3){try{const brief=await fetchJson('data/daily-brief.json');items.push(...(brief.items||[]).filter(isLocalStory).map(normalizedStory))}catch(_){} }
    const seen=new Set();return items.filter(i=>{const key=i.url||i.headline;if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,limit);
  }
  function integratedSummary(item){let text=item.summary||'';if(item.importance>=5&&item.why){const w=item.why.trim();if(w&&!text.toLowerCase().includes(w.toLowerCase()))text=`${text.replace(/[.]?$/,'')}. ${w}`}return text}
  function storyCard(item){return `<a class="news-story-card" href="${esc(item.url)}" target="_blank" rel="noopener"><div class="news-story-media">${item.image?`<img src="${esc(item.image)}" alt="" loading="lazy">`:`<div class="news-story-fallback" aria-hidden="true">B</div>`}</div><div class="news-story-body"><span class="news-story-tag">${esc(item.tag)}</span><h3>${esc(item.headline)}</h3><p>${esc(integratedSummary(item))}</p></div></a>`}

  async function rebuildHomeBrief(){
    if(!home())return;const old=document.querySelector('.daily-brief');if(!old)return;
    const items=(await getLocalStories(6)).slice(0,3);if(!items.length)return;
    const section=document.createElement('section');section.className='daily-brief news-brief';section.id='daily-brief';section.innerHTML=`<div class="news-brief-head"><div><h2>Latest in Burlington</h2><p>New local stories and source-linked updates.</p></div><a href="updates.html">All news →</a></div><div class="news-brief-grid">${items.map(storyCard).join('')}</div>`;old.replaceWith(section);
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
