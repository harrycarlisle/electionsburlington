(() => {
  async function getJson(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url}`);
    return r.json();
  }

  function ensureBriefStyle(){
    if(document.querySelector('link[data-style="brief-v3"]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='features-v3.css?v=20260823f';
    link.dataset.style='brief-v3';
    document.head.appendChild(link);
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
      ensureBriefStyle();
      const data=await getJson('data/daily-brief.json');
      const items=(data.items||[]).slice(0,3);
      if(!items.length) return;
      const lead=items[0], others=items.slice(1);
      const leadVisual=storyVisual(lead);
      const section=document.createElement('details');
      section.className='daily-brief'; section.id='daily-brief';
      section.innerHTML=`
        <summary class="brief-toggle">
          <span>
            <span class="brief-toggle-main"><span class="brief-toggle-title">Burlington in 30 seconds</span><span class="brief-live-dot" aria-hidden="true"></span><span class="brief-toggle-updated">${updatedLabel(data.updated)}</span></span>
            <span class="brief-toggle-sub">The biggest changes in Burlington politics.</span>
          </span>
          <span class="brief-open-label">Open</span>
        </summary>
        <div class="brief-panel">
          <article class="brief-feature ${leadVisual?'has-image':'no-image'}">
            ${leadVisual?`<div class="brief-feature-visual">${leadVisual}</div>`:''}
            <div class="brief-feature-copy">
              <span class="brief-tag">${lead.tag||'Update'}</span>
              <h3><a href="${lead.url}" target="_blank" rel="noopener">${lead.headline}</a></h3>
              <p class="brief-summary">${lead.summary}</p>
              ${whyBlock(lead)}
              <a class="brief-source" href="${lead.url}" target="_blank" rel="noopener">${sourceAction(lead)}</a>
            </div>
          </article>
          <div class="brief-more">
            ${others.map(item=>{const image=storyVisual(item,'brief-mini-image');return `<article class="brief-mini ${image?'has-image':'no-image'}">${image}<div class="brief-mini-copy"><span class="brief-tag">${item.tag||'Update'}</span><h3><a href="${item.url}" target="_blank" rel="noopener">${item.headline}</a></h3><p>${item.summary}</p>${whyBlock(item)}<a class="brief-source" href="${item.url}" target="_blank" rel="noopener">${sourceAction(item)}</a></div></article>`}).join('')}
          </div>
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
      const linkedName=n=>{
        const site=data.candidateWebsites?.[n];
        return site?`<a class="ballot-name" href="${site}" target="_blank" rel="noopener">${n}</a>`:`<span class="ballot-name">${n}</span>`;
      };
      const render=()=>{
        const w=data.wards[select.value];
        grid.innerHTML=`<div class="ballot-block"><small>Mayor</small><b>Citywide</b><div class="ballot-names"><a class="ballot-name" href="ballot.html">5 candidates →</a></div></div><div class="ballot-block"><small>Councillor</small><b>Ward ${select.value}</b><div class="ballot-names">${w.councillor.map(linkedName).join('')}</div></div><div class="ballot-block ballot-school-mini"><small>School-board trustee</small><b>Optional ballot detail</b><div class="ballot-names"><a class="ballot-name" href="ballot.html#school-board">View trustee race →</a></div></div>`;
      };
      select.addEventListener('change',render); render();
    }catch(e){console.warn('Ballot quick view unavailable',e)}
  }

  function fixHeroMap(){
    const card=document.querySelector('.hero-map-card');
    if(!card) return;
    card.querySelector('.hero-map-embed')?.remove();
    card.querySelector('.map-credit')?.remove();
    card.classList.add('hero-map-image');
    card.style.backgroundImage="url('/db00c009-e70d-404d-a8dd-45c6153cff6f.png')";
    let pin=card.querySelector('.hero-place-dot');
    if(!pin){ pin=document.createElement('span'); pin.className='hero-place-dot'; card.appendChild(pin); }
    pin.setAttribute('aria-hidden','true');
  }

  function polishBrandAndMeta(){
    document.querySelectorAll('.brand').forEach(brand=>{
      brand.classList.add('brand-mark-only');
      brand.innerHTML='<span class="brand-letter" aria-hidden="true">B</span><span class="sr-only">Burlington</span>';
      brand.setAttribute('aria-label','Burlington');
    });
    let icon=document.querySelector('link[rel="icon"]');
    if(!icon){ icon=document.createElement('link'); icon.rel='icon'; document.head.appendChild(icon); }
    icon.href='favicon.svg?v=20260823f';
    const trust=document.querySelector('.hero-trust');
    if(trust) trust.innerHTML='<span>No endorsements</span><span>Independent</span>';
  }

  function simplifyFooter(){
    const footer=document.querySelector('.site-legal-footer');
    if(!footer) return;
    footer.innerHTML='<div class="site-legal-footer-inner footer-only-links"><nav class="site-legal-links" aria-label="Site information"><a href="help.html#accessibility">Accessibility</a><a href="terms.html">Terms of use</a><a href="privacy.html">Privacy policy</a><a href="independent.html">Independent</a></nav></div>';
  }

  function fixMenuAndIssueLabels(){
    const mattersTitle=document.querySelector('#matters h2');
    if(mattersTitle) mattersTitle.textContent='Issues';
    document.querySelectorAll('.meaning-detail summary,.plain summary').forEach(s=>{
      if(/in plain english|what does that mean/i.test(s.textContent)) s.textContent='What this means';
    });
    const menu=document.querySelector('.menu-icon-button');
    if(menu&&!menu.dataset.mobileTopBound){
      menu.dataset.mobileTopBound='1';
      menu.addEventListener('click',()=>{
        const header=document.querySelector('.header');
        if(header) document.documentElement.style.setProperty('--mobile-menu-top',`${Math.ceil(header.getBoundingClientRect().bottom)}px`);
      });
    }
  }

  function neutralizeProfileCopy(){
    const panel=document.getElementById('profilePanel');
    if(!panel) return;
    const clean=()=>{
      const firstBox=panel.querySelector('.profile-box');
      if(firstBox){
        const redundant=[...firstBox.querySelectorAll('li')].find(li=>/official candidate list confirms (he|she|they) (is|are) running for mayor/i.test(li.textContent));
        redundant?.remove();
        const h=firstBox.querySelector('h3');
        if(h && /what they want to do/i.test(h.textContent)) h.textContent=/current priorities will be added|no detailed.*platform/i.test(firstBox.textContent)?'What we know so far':'Their argument';
      }
      const walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(n=>{n.nodeValue=n.nodeValue.replace(/\bHe is\b/g,'They are').replace(/\bhe is\b/g,'they are').replace(/\bShe is\b/g,'They are').replace(/\bshe is\b/g,'they are').replace(/\bHe previously\b/g,'They previously').replace(/\bhe previously\b/g,'they previously').replace(/\bShe previously\b/g,'They previously').replace(/\bshe previously\b/g,'they previously').replace(/\bHis campaign\b/g,'The campaign').replace(/\bhis campaign\b/g,'the campaign').replace(/\bHer campaign\b/g,'The campaign').replace(/\bher campaign\b/g,'the campaign').replace(/\bhis\b/g,'their').replace(/\bHis\b/g,'Their').replace(/\bher\b/g,'their').replace(/\bHer\b/g,'Their')});
    };
    clean(); new MutationObserver(clean).observe(panel,{childList:true,subtree:true});
  }

  function enhanceHeadToHead(){
    const grid=document.querySelector('.match-grid');
    const context=document.getElementById('context');
    if(!grid||!context) return;
    const clean=()=>{
      document.querySelector('.method-link')?.remove();
      document.querySelectorAll('.person-card .fact').forEach(f=>{if(/question to ask/i.test(f.querySelector('b')?.textContent||'')) f.remove()});
      document.querySelectorAll('.plain summary').forEach(s=>{if(/what does that mean|in plain english/i.test(s.textContent))s.textContent='What this means'});
      if(!context.querySelector('details')){
        const heading=context.querySelector('h2')?.textContent||'Context';
        const body=context.querySelector('p')?.innerHTML||'';
        context.innerHTML=`<details class="h2h-context-details"><summary>${heading}</summary><div class="h2h-context-body"><p>${body}</p></div></details>`;
      }
    };
    clean();
    let queued=false;
    new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;clean()})}).observe(grid,{childList:true,subtree:true});
  }

  function eventStatus(start,end){
    const now=new Date(), s=new Date(start), e=end?new Date(end):null;
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12), startDay=new Date(s.getFullYear(),s.getMonth(),s.getDate(),12);
    const days=Math.round((startDay-today)/86400000);
    if(e&&now>=s&&now<=e) return 'Happening now'; if(now>(e||s)) return 'Finished'; if(days===0) return 'Today'; if(days===1) return 'Tomorrow'; return `In ${days} days`;
  }

  function icsHref(event){
    const fmt=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const start=fmt(event.date), end=fmt(event.end||new Date(new Date(event.date).getTime()+60*60*1000));
    const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Burlington Election Guide//EN','BEGIN:VEVENT',`UID:${start}-${event.title.replace(/\s+/g,'-')}@electionsburlington.ca`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${event.title.replace(/,/g,'\\,')}`,`DESCRIPTION:${event.detail.replace(/,/g,'\\,')} ${event.url}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(text);
  }

  async function syncImportantDates(){
    const section=document.getElementById('dates'); if(!section) return;
    try{
      const data=await getJson('data/events.json'), grid=section.querySelector('.date-grid'); if(!grid) return;
      grid.classList.add('date-timeline');
      grid.innerHTML=(data.events||[]).map(event=>{
        const [month,...dayParts]=event.displayDate.split(' '), status=eventStatus(event.date,event.end);
        const critical=Number(event.importance||0)>=5?' is-critical':'';
        const add=event.addToCalendar?`<a class="date-calendar-action" href="${icsHref(event)}" download="${event.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.ics">Add to calendar</a>`:'';
        return `<article class="card date-card date-stop${critical} ${/Finished/i.test(status)?'is-past':''}"><div class="date-stop-top"><div class="date-calendar" aria-hidden="true"><span class="date-calendar-month">${month.toUpperCase().replace('.','')}</span><span class="date-calendar-day">${dayParts.join(' ')}</span></div><span class="date-status">${status}</span></div><div class="date-stop-body"><h3><a class="date-title-link" href="${event.url}" target="_blank" rel="noopener">${event.title}</a></h3><p>${event.detail}</p><a class="date-source" href="${event.url}" target="_blank" rel="noopener">${event.source}</a>${add}</div></article>`;
      }).join(''); simplifyDateCountdowns();
    }catch(e){console.warn('Election events unavailable',e)}
  }

  function simplifyDateCountdowns(){
    const cards=[...document.querySelectorAll('.date-stop')]; if(!cards.length) return;
    const active=cards.filter(c=>!/finished/i.test(c.querySelector('.date-status')?.textContent||''));
    cards.forEach(c=>c.classList.remove('countdown-visible')); active[0]?.classList.add('countdown-visible');
    const election=cards.find(c=>/election day/i.test(c.textContent)); if(election&&election!==active[0]) election.classList.add('countdown-visible');
  }

  async function injectElectionResults(){
    try{
      const data=await getJson('data/election-results.json'); if(!data||data.display!==true) return;
      const anchor=document.querySelector('.daily-brief')||document.querySelector('.election-hero'); if(!anchor||document.querySelector('.election-results')) return;
      const section=document.createElement('section'); section.className='election-results'; const rows=(data.mayor||[]).slice(0,5);
      section.innerHTML=`<div class="results-head"><div><span class="results-live-dot"></span><strong>Election results</strong><small>${data.official?'Official':'Unofficial'} · updated ${updatedLabel(data.updatedAt).replace('Updated ','')}</small></div><a href="${data.sourceUrl}" target="_blank" rel="noopener">City results</a></div>${rows.length?`<div class="results-list">${rows.map(r=>`<div class="result-row"><span>${r.name}</span><strong>${Number(r.votes||0).toLocaleString('en-CA')}</strong>${r.percent!=null?`<small>${r.percent}%</small>`:''}</div>`).join('')}</div>`:'<p class="results-waiting">Polls are closed. Waiting for the City of Burlington to publish result data.</p>'}`;
      anchor.insertAdjacentElement('afterend',section);
    }catch(_){ }
  }

  function injectHomeExtras(){
    const dates=document.getElementById('dates');
    if(!dates||document.querySelector('.home-extras')) return;
    const extras=document.createElement('section');
    extras.className='home-extras';
    extras.innerHTML=`<div class="home-extra-grid"><a class="home-extra-card puzzles-card" href="puzzles.html"><span class="home-extra-icon" aria-hidden="true">✦</span><div><small>Take a break</small><h2>Burlington puzzles</h2><p>Quick local trivia and visual challenges.</p></div><span aria-hidden="true">→</span></a><a class="home-extra-card partner-card" href="/feedback/?type=partnership"><span class="home-extra-icon" aria-hidden="true">↗</span><div><small>Local organizations & creators</small><h2>Want to partner with Burlington News?</h2><p>Have a civic project, dataset or local collaboration in mind?</p></div><span aria-hidden="true">→</span></a></div>`;
    dates.insertAdjacentElement('afterend',extras);
  }

  function init(){
    ensureBriefStyle();
    polishBrandAndMeta();
    fixHeroMap();
    fixMenuAndIssueLabels();
    neutralizeProfileCopy();
    enhanceHeadToHead();
    injectDailyBrief();
    injectBallotQuick();
    injectElectionResults();
    setTimeout(()=>{syncImportantDates();simplifyFooter();polishBrandAndMeta();injectHomeExtras();enhanceHeadToHead();},250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();