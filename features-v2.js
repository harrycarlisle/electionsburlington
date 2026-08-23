(() => {
  async function getJson(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url}`);
    return r.json();
  }

  function dateLabel(iso){
    try{return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(new Date(`${iso}T12:00:00`));}
    catch(_){return iso;}
  }

  async function injectDailyBrief(){
    const hero=document.querySelector('.election-hero');
    const candidates=document.getElementById('candidates');
    if(!hero||!candidates||document.querySelector('.daily-brief')) return;
    try{
      const data=await getJson('data/daily-brief.json');
      const section=document.createElement('section');
      section.className='daily-brief';
      section.id='daily-brief';
      const cards=(data.items||[]).slice(0,3).map(item=>`<a class="brief-card" href="${item.url}" target="_blank" rel="noopener"><span class="brief-tag">${item.tag}</span><h3>${item.headline}</h3><p>${item.summary}</p><p class="brief-why">Why it matters: ${item.why}</p></a>`).join('');
      const updated=data.updated?new Date(data.updated):null;
      const meta=updated&&!Number.isNaN(updated.valueOf())?`Updated ${new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(updated)}`:'Updated daily';
      section.innerHTML=`<div class="daily-brief-head"><div class="daily-brief-title-wrap"><span class="daily-brief-kicker">Burlington in 30 seconds</span><h2>What changed</h2></div><span class="daily-brief-meta">${meta}</span></div><div class="daily-brief-grid">${cards}</div><div class="daily-brief-footer"><p>Short, source-linked updates. Campaign claims, public records and reporting stay labelled separately.</p><a href="updates.html">See all updates →</a></div>`;
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
      section.innerHTML=`<div class="ballot-quick-head"><div><h2>Your ballot</h2><p>Pick your ward to see the other local races you can vote in.</p></div><select class="ward-select" id="wardQuick" aria-label="Choose your Burlington ward">${[1,2,3,4,5,6].map(w=>`<option value="${w}">Ward ${w}</option>`).join('')}</select></div><div class="ballot-grid" id="ballotQuickGrid"></div><div class="ballot-actions"><a href="ballot.html">See the full ballot guide →</a><a href="${data.findWard}" target="_blank" rel="noopener">Find my ward ↗</a></div>`;
      matters.insertAdjacentElement('beforebegin',section);
      const select=section.querySelector('#wardQuick');
      const grid=section.querySelector('#ballotQuickGrid');
      const render=()=>{
        const w=data.wards[select.value];
        grid.innerHTML=`<div class="ballot-block"><small>Mayor</small><b>Citywide</b><div class="ballot-names"><span class="ballot-name">5 candidates</span></div></div><div class="ballot-block"><small>City & regional councillor</small><b>Ward ${select.value}</b><div class="ballot-names">${w.councillor.map(n=>`<span class="ballot-name">${n}</span>`).join('')}</div></div><div class="ballot-block"><small>School board trustee</small><b>Also on your ballot</b><div class="ballot-names"><span class="ballot-name">Public board: ${w.publicTrustee.length}</span><span class="ballot-name">Catholic board: ${w.catholicTrustee.length}</span></div></div>`;
      };
      select.addEventListener('change',render); render();
    }catch(e){console.warn('Ballot quick view unavailable',e)}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    injectDailyBrief();
    injectBallotQuick();
  });
})();
