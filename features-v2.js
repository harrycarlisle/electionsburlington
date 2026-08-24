(() => {
  async function getJson(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url}`);
    return r.json();
  }

  function ensureStyle(href,key){
    if(document.querySelector(`link[data-style="${key}"]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet'; link.href=href; link.dataset.style=key;
    document.head.appendChild(link);
  }

  function ensureUiStyles(){
    ensureStyle('features-v3.css?v=20260823j','brief-v3');
    ensureStyle('ux-v8.css?v=20260823j','ux-v8');
  }

  function updatedLabel(value){
    const d=value?new Date(value):null;
    if(!d||Number.isNaN(d.valueOf())) return 'Updated daily';
    return `Updated ${new Intl.DateTimeFormat('en-CA',{hour:'numeric',minute:'2-digit'}).format(d)}`;
  }

  function sourceAction(item){
    if(item.mediaType==='video') return `Watch${item.source?` on ${item.source}`:''}`;
    return item.source || 'Source';
  }

  function whyBlock(item){
    return Number(item.importance||0)>=4 && item.why
      ? `<p class="brief-why"><strong>Why it matters:</strong> ${item.why}</p>`
      : '';
  }

  function storyVisual(item,cls='brief-story-image'){
    return item.image ? `<img class="${cls}" src="${item.image}" alt="" loading="lazy">` : '';
  }

  async function injectDailyBrief(){
    const hero=document.querySelector('.election-hero');
    if(!hero||document.querySelector('.daily-brief')) return;
    try{
      const data=await getJson('data/daily-brief.json');
      const items=(data.items||[]).slice(0,3);
      if(!items.length) return;
      const lead=items[0], others=items.slice(1), leadVisual=storyVisual(lead);
      const section=document.createElement('details');
      section.className='daily-brief'; section.id='daily-brief';
      section.innerHTML=`
        <summary class="brief-toggle">
          <span><span class="brief-toggle-main"><span class="brief-toggle-title">Burlington in 30 seconds</span><span class="brief-live-dot" aria-hidden="true"></span><span class="brief-toggle-updated">${updatedLabel(data.updated)}</span></span><span class="brief-toggle-sub">The biggest changes in Burlington politics.</span></span>
          <span class="brief-open-label">Open</span>
        </summary>
        <div class="brief-panel">
          <article class="brief-feature ${leadVisual?'has-image':'no-image'}">${leadVisual?`<div class="brief-feature-visual">${leadVisual}</div>`:''}<div class="brief-feature-copy"><span class="brief-tag">${lead.tag||'Update'}</span><h3><a href="${lead.url}" target="_blank" rel="noopener">${lead.headline}</a></h3><p class="brief-summary">${lead.summary}</p>${whyBlock(lead)}<a class="brief-source" href="${lead.url}" target="_blank" rel="noopener">${sourceAction(lead)}</a></div></article>
          <div class="brief-more">${others.map(item=>{const image=storyVisual(item,'brief-mini-image');return `<article class="brief-mini ${image?'has-image':'no-image'}">${image}<div class="brief-mini-copy"><span class="brief-tag">${item.tag||'Update'}</span><h3><a href="${item.url}" target="_blank" rel="noopener">${item.headline}</a></h3><p>${item.summary}</p>${whyBlock(item)}<a class="brief-source" href="${item.url}" target="_blank" rel="noopener">${sourceAction(item)}</a></div></article>`}).join('')}</div>
          <div class="brief-footer"><a href="updates.html">See all updates →</a></div>
        </div>`;
      hero.insertAdjacentElement('afterend',section);
    }catch(e){console.warn('Daily brief unavailable',e)}
  }

  async function injectBallotQuick(){
    const matters=document.getElementById('matters');
    if(!matters||document.querySelector('.ballot-quick')) return;
    try{
      const data=await getJson('data/ballot.json');
      const section=document.createElement('section');
      section.className='ballot-quick'; section.id='your-ballot';
      section.innerHTML=`<div class="ballot-quick-head"><div><h2>Your ballot</h2><p>Choose your ward to see your councillor race.</p></div><select class="ward-select" id="wardQuick" aria-label="Choose your Burlington ward">${[1,2,3,4,5,6].map(w=>`<option value="${w}">Ward ${w}</option>`).join('')}</select></div><div class="ballot-grid" id="ballotQuickGrid"></div><div class="ballot-actions"><a href="ward.html">What ward am I in? →</a><a href="ballot.html">Full ballot guide →</a></div>`;
      matters.insertAdjacentElement('beforebegin',section);
      const select=section.querySelector('#wardQuick'), grid=section.querySelector('#ballotQuickGrid');
      const render=()=>{const w=data.wards[select.value];grid.innerHTML=`<div class="ballot-block"><small>Mayor</small><b>Citywide</b><div class="ballot-names"><a class="ballot-name" href="index.html#candidates">5 candidates →</a></div></div><div class="ballot-block"><small>Councillor</small><b>Ward ${select.value}</b><div class="ballot-names"><a class="ballot-name" href="ballot.html?ward=${select.value}">${w.councillor.length} candidates →</a></div></div><div class="ballot-block ballot-school-mini"><small>School-board trustee</small><b>Optional ballot detail</b><div class="ballot-names"><a class="ballot-name" href="ballot.html?ward=${select.value}#school-board">View trustee race →</a></div></div>`};
      select.addEventListener('change',render); render();
    }catch(e){console.warn('Ballot quick view unavailable',e)}
  }

  function fixHeroMap(){
    const card=document.querySelector('.hero-map-card'); if(!card) return;
    card.querySelector('.hero-map-embed')?.remove(); card.querySelector('.map-credit')?.remove();
    card.classList.add('hero-map-image');
    card.style.backgroundImage="url('/db00c009-e70d-404d-a8dd-45c6153cff6f.png')";
    let pin=card.querySelector('.hero-place-dot'); if(!pin){pin=document.createElement('span');pin.className='hero-place-dot';card.appendChild(pin)}
    pin.setAttribute('aria-hidden','true');
  }

  function polishBrandAndMeta(){
    document.querySelectorAll('.brand').forEach(brand=>{
      brand.classList.add('brand-mark-only');
      brand.innerHTML='<span class="brand-letter" aria-hidden="true">B</span><span class="sr-only">Burlington</span>';
      brand.setAttribute('aria-label','Burlington home');
    });
    let icon=document.querySelector('link[rel="icon"]'); if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}
    icon.href='favicon.svg?v=20260823j';
    const trust=document.querySelector('.hero-trust'); if(trust) trust.innerHTML='<span>No endorsements</span><span>Independent</span>';
  }

  function installDesktopNav(){
    const inner=document.querySelector('.header-inner'), controls=document.querySelector('.header-controls');
    if(!inner||!controls||inner.querySelector('.desktop-primary-nav')) return;
    const nav=document.createElement('nav'); nav.className='desktop-primary-nav'; nav.setAttribute('aria-label','Quick links');
    const home=location.pathname==='/'||location.pathname.endsWith('/index.html');
    const href=h=>home?h:`index.html${h}`;
    nav.innerHTML=`<a href="${href('#candidates')}">Candidates</a><a href="${href('#matters')}">Issues</a><a href="head-to-head.html">Compare</a>`;
    inner.insertBefore(nav,controls);
    const drawer=document.querySelector('.menu-panel .menu-primary');
    if(drawer){
      [...drawer.querySelectorAll('.menu-link')].forEach(a=>{
        const label=a.textContent.trim().toLowerCase();
        if(label.startsWith('meet the candidates')||label==='issues›'||label.startsWith('compare')) a.classList.add('menu-core-duplicate');
        if(label.includes('burlington in 30 seconds')) a.remove();
      });
      if(!drawer.querySelector('a[href="puzzles.html"]')) drawer.insertAdjacentHTML('beforeend','<a class="menu-link" role="listitem" href="puzzles.html"><span>Puzzles</span><span aria-hidden="true">›</span></a>');
    }
  }

  function simplifyFooter(){
    const footer=document.querySelector('.site-legal-footer'); if(!footer) return;
    footer.innerHTML='<div class="site-legal-footer-inner footer-only-links"><nav class="site-legal-links" aria-label="Site information"><a href="help.html#accessibility">Accessibility</a><a href="terms.html">Terms of use</a><a href="privacy.html">Privacy policy</a><a href="independent.html">Independent</a></nav></div>';
  }

  function fixLabels(){
    const title=document.querySelector('#matters h2'); if(title) title.textContent='Issues';
    document.querySelectorAll('#candidateStrip .focus-label').forEach(x=>x.textContent='Overview Focus');
    document.querySelectorAll('.meaning-detail summary,.plain summary').forEach(s=>{if(/in plain english|what does that mean/i.test(s.textContent))s.textContent='What this means'});
    const menu=document.querySelector('.menu-icon-button');
    if(menu&&!menu.dataset.mobileTopBound){menu.dataset.mobileTopBound='1';menu.addEventListener('click',()=>{const header=document.querySelector('.header');if(header)document.documentElement.style.setProperty('--mobile-menu-top',`${Math.ceil(header.getBoundingClientRect().bottom)}px`)})}
  }

  function neutralizeProfileCopy(){
    const panel=document.getElementById('profilePanel'); if(!panel) return;
    const clean=()=>{
      document.querySelectorAll('#candidateStrip .focus-label').forEach(x=>x.textContent='Overview Focus');
      const first=panel.querySelector('.profile-box');
      if(first){
        [...first.querySelectorAll('li')].find(li=>/official candidate list confirms (he|she|they) (is|are) running for mayor/i.test(li.textContent))?.remove();
        const h=first.querySelector('h3'); if(h&&(/their argument|what we know so far|what they want to do/i.test(h.textContent))) h.textContent=/current priorities will be added|no detailed.*platform/i.test(first.textContent)?'What we know so far':'What they want to do';
      }
      const walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(n=>{n.nodeValue=n.nodeValue.replace(/\bHe is\b/g,'They are').replace(/\bhe is\b/g,'they are').replace(/\bShe is\b/g,'They are').replace(/\bshe is\b/g,'they are').replace(/\bHe previously\b/g,'They previously').replace(/\bhe previously\b/g,'they previously').replace(/\bShe previously\b/g,'They previously').replace(/\bshe previously\b/g,'they previously').replace(/\bHis campaign\b/g,'The campaign').replace(/\bhis campaign\b/g,'the campaign').replace(/\bHer campaign\b/g,'The campaign').replace(/\bher campaign\b/g,'the campaign').replace(/\bHis\b/g,'Their').replace(/\bhis\b/g,'their').replace(/\bHer\b/g,'Their').replace(/\bher\b/g,'their')});
    };
    clean(); new MutationObserver(()=>requestAnimationFrame(clean)).observe(panel,{childList:true,subtree:true});
  }

  async function addCommunityDiscussion(){
    const panel=document.getElementById('profilePanel'), strip=document.getElementById('candidateStrip'); if(!panel||!strip) return;
    try{
      const data=await getJson('data/community-discussion.json'); let busy=false;
      const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const render=()=>{
        if(busy)return;busy=true;
        panel.querySelector('.community-discussion')?.remove();
        [...panel.querySelectorAll('details')].forEach(d=>{if(/local commenters|local discussion/i.test(d.querySelector('summary')?.textContent||''))d.remove()});
        const name=strip.querySelector('.candidate-card[aria-pressed="true"] h3')?.textContent.trim(); const info=data.candidates?.[name];
        if(!name||!info){busy=false;return}
        const details=document.createElement('details');details.className='community-discussion';
        const items=info.items||[];
        details.innerHTML=`<summary>Local comments checked</summary><p class="community-note">Public comments are not polling or proof. We include substantive points, then check the factual part separately.</p>${items.length?`<div class="community-grid">${items.map(item=>`<article class="community-quote"><div class="community-quote-top"><span class="community-tone">${esc(item.tone)}</span><span class="community-status">${esc(item.status)}</span><span class="community-score">Evidence ${Number(item.evidenceScore||0)}/3</span></div><blockquote>“${esc(item.quote)}”</blockquote><p class="community-check">${esc(item.check)}</p><div class="community-evidence"><a class="community-source" href="${esc(item.url)}" target="_blank" rel="noopener">Original comment ↗</a>${(item.evidence||[]).map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a>`).join('')}</div></article>`).join('')}</div>`:`<p class="community-empty">${esc(info.note||'No substantive local comments have been verified yet.')}</p>`}`;
        panel.appendChild(details);busy=false;
      };
      render(); new MutationObserver(()=>requestAnimationFrame(render)).observe(panel,{childList:true,subtree:true});
    }catch(e){console.warn('Community discussion unavailable',e)}
  }

  function enhanceHeadToHead(){
    const grid=document.querySelector('.match-grid'), context=document.getElementById('context'), compare=document.getElementById('compare'), bottom=document.getElementById('bottomStrip');
    if(!grid||!context||!compare||!bottom)return;
    document.body.classList.add('h2h-polished');
    let internal=false,queued=false;
    const clean=()=>{
      if(internal)return;internal=true;
      document.querySelector('.method-link')?.remove();
      document.querySelectorAll('.person-card .fact').forEach(f=>{if(/question to ask/i.test(f.querySelector('b')?.textContent||''))f.remove()});
      document.querySelectorAll('.plain summary').forEach(s=>{if(/what does that mean|in plain english/i.test(s.textContent))s.textContent='What this means'});
      if(!context.querySelector('details')){const heading=context.querySelector('h2')?.textContent||'Context',body=context.querySelector('p')?.innerHTML||'';context.innerHTML=`<details class="h2h-context-details"><summary>${heading}</summary><div class="h2h-context-body"><p>${body}</p></div></details>`}
      const positions=[...compare.children], checks=[...bottom.children];
      [['leftCard',0],['rightCard',1]].forEach(([id,i])=>{
        const card=document.getElementById(id); if(!card)return;
        card.querySelector('.h2h-position-slot')?.remove();
        const slot=document.createElement('div');slot.className='h2h-position-slot';slot.innerHTML='<div class="h2h-section-label">On this issue</div>';
        if(positions[i]) slot.appendChild(positions[i].cloneNode(true));
        if(checks[i]){const c=checks[i].cloneNode(true),b=c.querySelector('b');if(b)b.textContent='What still needs checking';slot.appendChild(c)}
        card.appendChild(slot);
      });
      requestAnimationFrame(()=>internal=false);
    };
    clean();new MutationObserver(()=>{if(internal||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;clean()})}).observe(grid,{childList:true,subtree:true});
  }

  function eventStatus(start,end){
    const now=new Date(),s=new Date(start),e=end?new Date(end):null,today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),sd=new Date(s.getFullYear(),s.getMonth(),s.getDate(),12),days=Math.round((sd-today)/86400000);
    if(e&&now>=s&&now<=e)return'Happening now';if(now>(e||s))return'Finished';if(days===0)return'Today';if(days===1)return'Tomorrow';return`In ${days} days`;
  }

  function icsHref(event){
    const fmt=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const start=fmt(event.date),end=fmt(event.end||new Date(new Date(event.date).getTime()+3600000));
    const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Burlington Election Guide//EN','BEGIN:VEVENT',`UID:${start}-${event.title.replace(/\s+/g,'-')}@electionsburlington.ca`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${event.title.replace(/,/g,'\\,')}`,`DESCRIPTION:${event.detail.replace(/,/g,'\\,')} ${event.url}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
    return'data:text/calendar;charset=utf-8,'+encodeURIComponent(text);
  }

  async function syncImportantDates(){
    const section=document.getElementById('dates');if(!section)return;
    try{
      const data=await getJson('data/events.json'),grid=section.querySelector('.date-grid');if(!grid)return;
      grid.classList.add('date-timeline');
      grid.innerHTML=(data.events||[]).map(event=>{const [month,...dayParts]=event.displayDate.split(' '),status=eventStatus(event.date,event.end),critical=Number(event.importance||0)>=5?' is-critical':'',add=event.addToCalendar?`<a class="date-calendar-action" href="${icsHref(event)}" download="election-day.ics">Add to calendar</a>`:'';return`<article class="card date-card date-stop${critical} ${/Finished/i.test(status)?'is-past':''}"><div class="date-stop-top"><div class="date-calendar" aria-hidden="true"><span class="date-calendar-month">${month.toUpperCase().replace('.','')}</span><span class="date-calendar-day">${dayParts.join(' ')}</span></div><span class="date-status">${status}</span></div><div class="date-stop-body"><h3><a class="date-title-link" href="${event.url}" target="_blank" rel="noopener">${event.title}</a></h3><p>${event.detail}</p>${add}</div></article>`}).join('');
      simplifyDateCountdowns();
    }catch(e){console.warn('Election events unavailable',e)}
  }

  function simplifyDateCountdowns(){
    const cards=[...document.querySelectorAll('.date-stop')];if(!cards.length)return;const active=cards.filter(c=>!/finished/i.test(c.querySelector('.date-status')?.textContent||''));cards.forEach(c=>c.classList.remove('countdown-visible'));active[0]?.classList.add('countdown-visible');const election=cards.find(c=>/election day/i.test(c.textContent));if(election&&election!==active[0])election.classList.add('countdown-visible');
  }

  async function injectElectionResults(){
    try{
      const data=await getJson('data/election-results.json');if(!data||data.display!==true)return;const anchor=document.querySelector('.daily-brief')||document.querySelector('.election-hero');if(!anchor||document.querySelector('.election-results'))return;const rows=(data.mayor||[]).slice(0,5),section=document.createElement('section');section.className='election-results';section.innerHTML=`<div class="results-head"><div><span class="results-live-dot"></span><strong>Election results</strong><small>${data.official?'Official':'Unofficial'} · updated ${updatedLabel(data.updatedAt).replace('Updated ','')}</small></div><a href="${data.sourceUrl}" target="_blank" rel="noopener">City results</a></div>${rows.length?`<div class="results-list">${rows.map(r=>`<div class="result-row"><span>${r.name}</span><strong>${Number(r.votes||0).toLocaleString('en-CA')}</strong>${r.percent!=null?`<small>${r.percent}%</small>`:''}</div>`).join('')}</div>`:'<p class="results-waiting">Polls are closed. Waiting for the City of Burlington to publish result data.</p>'}`;anchor.insertAdjacentElement('afterend',section);
    }catch(_){ }
  }

  function injectHomeExtras(){
    const dates=document.getElementById('dates');if(!dates||document.querySelector('.home-extras'))return;const extras=document.createElement('section');extras.className='home-extras';extras.innerHTML=`<div class="home-extra-grid"><a class="home-extra-card puzzles-card" href="puzzles.html"><span class="home-extra-icon" aria-hidden="true">✦</span><div><small>Play</small><h2>Burlington puzzles</h2><p>Quick local trivia and visual challenges.</p></div><span aria-hidden="true">→</span></a><a class="home-extra-card partner-card" href="/feedback/?type=partnership"><span class="home-extra-icon" aria-hidden="true">↗</span><div><small>Partner with Burlington News</small><h2>Want to work with us?</h2><p>Local civic projects, data and collaborations.</p></div><span aria-hidden="true">→</span></a></div>`;dates.insertAdjacentElement('afterend',extras);
  }

  function init(){
    ensureUiStyles();polishBrandAndMeta();fixHeroMap();fixLabels();neutralizeProfileCopy();enhanceHeadToHead();injectDailyBrief();injectBallotQuick();injectElectionResults();addCommunityDiscussion();
    setTimeout(()=>{installDesktopNav();syncImportantDates();simplifyFooter();polishBrandAndMeta();injectHomeExtras();enhanceHeadToHead();fixLabels()},220);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();