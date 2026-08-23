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
    link.href='features-v3.css?v=20260823c';
    link.dataset.style='brief-v3';
    document.head.appendChild(link);
  }

  function updatedLabel(value){
    const d=value?new Date(value):null;
    if(!d||Number.isNaN(d.valueOf())) return 'Updated daily';
    return `Updated ${new Intl.DateTimeFormat('en-CA',{hour:'numeric',minute:'2-digit'}).format(d)}`;
  }

  function sourceAction(item){
    if(item.mediaType==='video') return `Watch${item.source?` on ${item.source}`:''} ↗`;
    if(item.sourceType==='official') return 'Official source ↗';
    return `Read${item.source?` on ${item.source}`:''} ↗`;
  }

  function whyBlock(item){
    return Number(item.importance||0)>=3 && item.why
      ? `<p class="brief-why"><strong>Why it matters:</strong> ${item.why}</p>`
      : '';
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
      const visual=lead.image
        ? `<img class="brief-story-image" src="${lead.image}" alt="" loading="lazy">`
        : `<div class="brief-feature-placeholder"><span>Burlington</span><strong>Election update</strong></div>`;

      const section=document.createElement('details');
      section.className='daily-brief'; section.id='daily-brief';
      section.innerHTML=`
        <summary class="brief-toggle">
          <span>
            <span class="brief-toggle-main"><span class="brief-toggle-title">Burlington in 30 seconds</span><span class="brief-live-dot" aria-hidden="true"></span><span class="brief-toggle-updated">${updatedLabel(data.updated)}</span></span>
            <span class="brief-toggle-sub">The main Burlington political updates, cut down.</span>
          </span>
          <span class="brief-open-label">Open</span>
        </summary>
        <div class="brief-panel">
          <article class="brief-feature">
            <div class="brief-feature-visual">${visual}</div>
            <div class="brief-feature-copy">
              <span class="brief-tag">${lead.tag||'Update'}</span>
              <h3>${lead.headline}</h3>
              <p class="brief-summary">${lead.summary}</p>
              ${whyBlock(lead)}
              <a class="brief-source" href="${lead.url}" target="_blank" rel="noopener">${sourceAction(lead)}</a>
            </div>
          </article>
          <div class="brief-more">
            ${others.map(item=>`<article class="brief-mini"><span class="brief-tag">${item.tag||'Update'}</span><h3>${item.headline}</h3><p>${item.summary}</p>${whyBlock(item)}<a class="brief-source" href="${item.url}" target="_blank" rel="noopener">${sourceAction(item)}</a></article>`).join('')}
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
      section.innerHTML=`<div class="ballot-quick-head"><div><h2>Your ballot</h2><p>Choose your ward to see the other local races.</p></div><select class="ward-select" id="wardQuick" aria-label="Choose your Burlington ward">${[1,2,3,4,5,6].map(w=>`<option value="${w}">Ward ${w}</option>`).join('')}</select></div><div class="ballot-grid" id="ballotQuickGrid"></div><div class="ballot-actions"><a href="ward.html">What ward am I in? →</a><a href="ballot.html">Full ballot guide →</a></div>`;
      matters.insertAdjacentElement('beforebegin',section);
      const select=section.querySelector('#wardQuick'), grid=section.querySelector('#ballotQuickGrid');
      const render=()=>{
        const w=data.wards[select.value];
        grid.innerHTML=`<div class="ballot-block"><small>Mayor</small><b>Citywide</b><div class="ballot-names"><span class="ballot-name">5 candidates</span></div></div><div class="ballot-block"><small>Councillor</small><b>Ward ${select.value}</b><div class="ballot-names">${w.councillor.map(n=>`<span class="ballot-name">${n}</span>`).join('')}</div></div><div class="ballot-block"><small>Trustee</small><b>School board</b><div class="ballot-names"><span class="ballot-name">Public: ${w.publicTrustee.length}</span><span class="ballot-name">Catholic: ${w.catholicTrustee.length}</span></div></div>`;
      };
      select.addEventListener('change',render); render();
    }catch(e){console.warn('Ballot quick view unavailable',e)}
  }

  function fixHeroMap(){
    const card=document.querySelector('.hero-map-card');
    if(!card||card.querySelector('.hero-map-embed')) return;
    const frame=document.createElement('iframe');
    frame.className='hero-map-embed';
    frame.src='https://www.openstreetmap.org/export/embed.html?bbox=-79.930%2C43.272%2C-79.690%2C43.410&layer=mapnik&marker=43.3255%2C-79.7990';
    frame.title='Map of Burlington, Ontario';
    frame.loading='lazy';
    frame.tabIndex=-1;
    frame.setAttribute('aria-hidden','true');
    card.prepend(frame);
    card.querySelector('.map-credit')?.remove();
  }

  function fixMenuAndIssueLabels(){
    const mattersTitle=document.querySelector('#matters h2');
    if(mattersTitle) mattersTitle.textContent='Issues';
    const issueMenu=[...document.querySelectorAll('.menu-link')].find(a=>a.textContent.trim().toLowerCase().startsWith('issues'));
    if(issueMenu) issueMenu.querySelector('span')?.replaceChildren(document.createTextNode('Issues'));
    document.querySelectorAll('.meaning-detail summary,.plain summary').forEach(s=>{
      if(/in plain english|what does that mean/i.test(s.textContent)) s.textContent='What this means';
    });
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
        if(h && /what they want to do/i.test(h.textContent) && /current priorities will be added|no detailed.*platform/i.test(firstBox.textContent)) h.textContent='What we know so far';
      }
      const walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);
      const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(n=>{
        n.nodeValue=n.nodeValue
          .replace(/\bHe is\b/g,'They are').replace(/\bhe is\b/g,'they are')
          .replace(/\bShe is\b/g,'They are').replace(/\bshe is\b/g,'they are')
          .replace(/\bHe previously\b/g,'They previously').replace(/\bhe previously\b/g,'they previously')
          .replace(/\bShe previously\b/g,'They previously').replace(/\bshe previously\b/g,'they previously')
          .replace(/\bhis\b/g,'their').replace(/\bHis\b/g,'Their')
          .replace(/\bher\b/g,'their').replace(/\bHer\b/g,'Their');
      });
    };
    clean();
    new MutationObserver(()=>clean()).observe(panel,{childList:true,subtree:true});
  }

  function simplifyDateCountdowns(){
    const cards=[...document.querySelectorAll('.date-stop')];
    if(!cards.length) return;
    const active=cards.filter(c=>!/finished/i.test(c.querySelector('.date-status')?.textContent||''));
    cards.forEach(c=>c.classList.remove('countdown-visible'));
    active[0]?.classList.add('countdown-visible');
    const election=cards.find(c=>/election day/i.test(c.textContent));
    if(election && election!==active[0]) election.classList.add('countdown-visible');
  }

  async function injectElectionResults(){
    try{
      const data=await getJson('data/election-results.json');
      if(!data||data.display!==true) return;
      const anchor=document.querySelector('.daily-brief')||document.querySelector('.election-hero');
      if(!anchor||document.querySelector('.election-results')) return;
      const section=document.createElement('section');
      section.className='election-results';
      const rows=(data.mayor||[]).slice(0,5);
      section.innerHTML=`<div class="results-head"><div><span class="results-live-dot"></span><strong>Election results</strong><small>${data.official?'Official':'Unofficial'} · updated ${updatedLabel(data.updatedAt).replace('Updated ','')}</small></div><a href="${data.sourceUrl}" target="_blank" rel="noopener">City results ↗</a></div>${rows.length?`<div class="results-list">${rows.map(r=>`<div class="result-row"><span>${r.name}</span><strong>${Number(r.votes||0).toLocaleString('en-CA')}</strong>${r.percent!=null?`<small>${r.percent}%</small>`:''}</div>`).join('')}</div>`:'<p class="results-waiting">Polls are closed. Waiting for the City of Burlington to publish result data.</p>'}`;
      anchor.insertAdjacentElement('afterend',section);
    }catch(_){ }
  }

  function init(){
    ensureBriefStyle();
    fixHeroMap();
    fixMenuAndIssueLabels();
    neutralizeProfileCopy();
    injectDailyBrief();
    injectBallotQuick();
    injectElectionResults();
    setTimeout(simplifyDateCountdowns,250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();