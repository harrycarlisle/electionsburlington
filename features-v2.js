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
    link.href='features-v3.css?v=20260823a';
    link.dataset.style='brief-v3';
    document.head.appendChild(link);
  }

  function candidateImages(){
    return [...document.querySelectorAll('#candidateStrip .candidate-card')].map(card=>({
      name:card.querySelector('h3')?.textContent.trim()||'Candidate',
      img:card.querySelector('img')?.src||''
    })).filter(x=>x.img);
  }

  function updatedLabel(value){
    const d=value?new Date(value):null;
    if(!d||Number.isNaN(d.valueOf())) return 'Updated daily';
    return `Updated ${new Intl.DateTimeFormat('en-CA',{hour:'numeric',minute:'2-digit'}).format(d)}`;
  }

  async function injectDailyBrief(){
    const hero=document.querySelector('.election-hero');
    const candidates=document.getElementById('candidates');
    if(!hero||!candidates||document.querySelector('.daily-brief')) return;
    try{
      ensureBriefStyle();
      const data=await getJson('data/daily-brief.json');
      const items=(data.items||[]).slice(0,3);
      if(!items.length) return;
      const lead=items[0];
      const others=items.slice(1);
      const photos=candidateImages();
      const visual=photos.length
        ? photos.map(p=>`<img src="${p.img}" alt="${p.name}">`).join('')
        : '<div class="brief-feature-placeholder">Burlington election</div>';

      const section=document.createElement('details');
      section.className='daily-brief';
      section.id='daily-brief';
      section.innerHTML=`
        <summary class="brief-toggle">
          <span>
            <span class="brief-toggle-main">
              <span class="brief-toggle-title">Burlington in 30 seconds</span>
              <span class="brief-live-dot" aria-hidden="true"></span>
              <span class="brief-toggle-updated">${updatedLabel(data.updated)}</span>
            </span>
            <span class="brief-toggle-sub">A quick briefing on what changed in Burlington politics.</span>
          </span>
          <span class="brief-open-label">Open</span>
        </summary>
        <div class="brief-panel">
          <article class="brief-feature">
            <div class="brief-feature-visual">${visual}</div>
            <div class="brief-feature-copy">
              <span class="brief-tag">${lead.tag}</span>
              <h3>${lead.headline}</h3>
              <p class="brief-summary">${lead.summary}</p>
              <p class="brief-why"><strong>Why it matters:</strong> ${lead.why}</p>
              <a class="brief-source" href="${lead.url}" target="_blank" rel="noopener">Original source ↗</a>
            </div>
          </article>
          <div class="brief-more">
            ${others.map(item=>`<a class="brief-mini" href="${item.url}" target="_blank" rel="noopener"><span class="brief-tag">${item.tag}</span><h3>${item.headline}</h3><p>${item.summary}</p></a>`).join('')}
          </div>
          <div class="brief-footer"><span>Only the main point, why it matters and the original source.</span><a href="updates.html">See all updates →</a></div>
        </div>`;
      hero.insertAdjacentElement('afterend',section);
    }catch(e){console.warn('Daily brief unavailable',e)}
  }

  async function injectBallotQuick(){
    const candidates=document.getElementById('candidates');
    const matters=document.getElementById('matters');
    if(!candidates||!matters||document.querySelector('.ballot-quick')) return;
    try{
      const data=await getJson('data/ballot.json');
      const section=document.createElement('section');
      section.className='ballot-quick';
      section.id='your-ballot';
      section.innerHTML=`<div class="ballot-quick-head"><div><h2>Your ballot</h2><p>Pick your ward. We’ll show the other races you can vote in.</p></div><select class="ward-select" id="wardQuick" aria-label="Choose your Burlington ward">${[1,2,3,4,5,6].map(w=>`<option value="${w}">Ward ${w}</option>`).join('')}</select></div><div class="ballot-grid" id="ballotQuickGrid"></div><div class="ballot-actions"><a href="ballot.html">Full ballot guide →</a><a href="ward.html">What ward am I in? →</a></div>`;
      matters.insertAdjacentElement('beforebegin',section);
      const select=section.querySelector('#wardQuick');
      const grid=section.querySelector('#ballotQuickGrid');
      const render=()=>{
        const w=data.wards[select.value];
        grid.innerHTML=`<div class="ballot-block"><small>Mayor</small><b>Citywide</b><div class="ballot-names"><span class="ballot-name">5 candidates</span></div></div><div class="ballot-block"><small>Councillor</small><b>Ward ${select.value}</b><div class="ballot-names">${w.councillor.map(n=>`<span class="ballot-name">${n}</span>`).join('')}</div></div><div class="ballot-block"><small>Trustee</small><b>School board</b><div class="ballot-names"><span class="ballot-name">Public: ${w.publicTrustee.length}</span><span class="ballot-name">Catholic: ${w.catholicTrustee.length}</span></div></div>`;
      };
      select.addEventListener('change',render); render();
    }catch(e){console.warn('Ballot quick view unavailable',e)}
  }

  function init(){injectDailyBrief();injectBallotQuick();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();