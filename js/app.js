const HOUR=3600000, STEP=2*HOUR;
const icons={
chat:`<svg class="icon" viewBox="0 0 24 24"><path d="M5 18l-1 3 4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3z"/></svg>`,
insta:`<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.4" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>`,
activity:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 13h3l2-6 4 11 2-6h5"/></svg>`,
search:`<svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/><path d="m7 7 7 7"/></svg>`
};
function uid(){return Math.random().toString(36).slice(2,10)}
function dayKey(ts=Date.now()){let d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmt(ms){let h=Math.floor(ms/HOUR),m=Math.floor((ms%HOUR)/60000);if(h>=24)return Math.floor(h/24)+'d '+(h%24)+'h';return h+'h '+String(m).padStart(2,'0')+'m'}


function showPage(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 document.querySelectorAll('.bottom button').forEach(b=>b.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 let nav=document.getElementById('nav-'+id);if(nav)nav.classList.add('active');
 window.scrollTo({top:0,behavior:'smooth'});render()
}

function openReward(){rewardModal.classList.add('show')}
function addReward(){let n=rewardName.value.trim(),c=+rewardCost.value;if(!n||!c)return toast('Completa el premio');let d=load();d.rewards.push({id:uid(),name:n,cost:c});save(d);rewardName.value='';closeModal('rewardModal');render()}
function redeem(id){let d=load(),r=d.rewards.find(x=>x.id===id);if(r&&Number(d.wallet||0)>=r.cost){d.wallet=Number(d.wallet||0)-r.cost;d.bank=d.wallet;save(d);toast('Premio canjeado');render()}}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>t.classList.remove('show'),1900)}



function drawOrbit(d){let el=bigOrbit;el.innerHTML='<div class="orbit-circle o1"></div><div class="orbit-circle o2"></div><div class="orbit-circle o3"></div><div class="me">yo</div>';let coords=[[50,18],[80,34],[82,67],[52,83],[19,68],[19,35],[65,25],[67,74]];d.orbit.slice(0,8).forEach((o,i)=>{let p=document.createElement('div');p.className='planet';p.style.left=coords[i][0]+'%';p.style.top=coords[i][1]+'%';p.textContent=o.name;el.appendChild(p)})}

const constellationDefs=[
 {id:'lyra',name:'Lira',need:8,desc:'Una primera señal de que algo nuevo empieza a dibujarse.',
  pts:[[50,18],[34,44],[50,63],[70,45],[50,18],[50,63]],edges:[[0,1],[1,2],[2,3],[3,0],[0,4]]},
 {id:'cassiopeia',name:'Casiopea',need:15,desc:'Cinco estrellas que recuerdan que también hay belleza en los cambios.',
  pts:[[18,48],[34,30],[50,52],[68,28],[84,47]],edges:[[0,1],[1,2],[2,3],[3,4]]},
 {id:'ursa-major',name:'Osa Mayor',need:30,desc:'Una constelación para orientarte cuando cuesta encontrar el norte.',
  pts:[[15,54],[31,46],[47,50],[60,39],[71,26],[83,31],[73,45]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]},
 {id:'orion',name:'Orión',need:50,desc:'Fuerza, invierno y la certeza de que las noches también cambian.',
  pts:[[34,20],[66,22],[46,43],[52,44],[58,45],[36,72],[65,74]],edges:[[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]]},
 {id:'cygnus',name:'Cisne',need:80,desc:'Una cruz de estrellas que atraviesa el cielo como un camino.',
  pts:[[50,12],[50,35],[50,58],[50,83],[26,47],[76,47]],edges:[[0,1],[1,2],[2,3],[4,2],[2,5]]},
 {id:'andromeda',name:'Andrómeda',need:120,desc:'Una constelación que comparte nombre con una galaxia: todavía hay universo por delante.',
  pts:[[15,55],[31,46],[47,38],[61,31],[76,20],[58,54],[72,63]],edges:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]]}
];
function constellationSvg(def,unlocked,progress){
 let activeCount=unlocked?def.pts.length:Math.max(1,Math.floor(def.pts.length*progress));
 let lines=def.edges.map(([a,b])=>{
   let cls=(a<activeCount&&b<activeCount)?'line':'ghost-line';
   return `<line class="${cls}" x1="${def.pts[a][0]}%" y1="${def.pts[a][1]}%" x2="${def.pts[b][0]}%" y2="${def.pts[b][1]}%"/>`
 }).join('');
 let stars=def.pts.map((p,i)=>`<circle class="${i<activeCount?'star':'ghost-star'}" cx="${p[0]}%" cy="${p[1]}%" r="${i<activeCount?3.4:2.4}"/>`).join('');
 return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}${stars}</svg>`
}
function renderUniverse(d){
 let total=Number(d.lifetimeStars||0),wallet=Number(d.wallet||0);
 universeWallet.textContent=wallet.toFixed(1).replace('.',',');
 universeLifetime.textContent=total.toFixed(1).replace('.',',');
 let next=constellationDefs.find(c=>total<c.need);
 let current=next||constellationDefs[constellationDefs.length-1];
 let idx=constellationDefs.indexOf(current);
 let prevNeed=idx>0?constellationDefs[idx-1].need:0;
 let progress=next?Math.max(0,Math.min(1,(total-prevNeed)/(current.need-prevNeed))):1;
 constellationProgressText.textContent=next?`${total.toFixed(1).replace('.',',')} / ${current.need} estrellas`:'Colección actual completada';
 constellationStage.innerHTML=constellationSvg(current,!next,progress)+
   `<div class="constellation-caption"><strong>${next?'Dibujando '+current.name:current.name+' completada'}</strong><small>${next?`Faltan ${(current.need-total).toFixed(1).replace('.',',')} estrellas`:current.desc}</small></div>`;
 constellationBook.innerHTML=constellationDefs.map(c=>{
   let unlocked=total>=c.need;
   return `<div class="card book-card ${unlocked?'':'locked'}">
     <div class="mini-const">${constellationSvg(c,unlocked,unlocked?1:0)}</div>
     <span class="unlock">${unlocked?'desbloqueada':c.need+' estrellas'}</span>
     <h3>${c.name}</h3><p>${unlocked?c.desc:'Todavía por descubrir.'}</p>
   </div>`
 }).join('')
}

function render(){let d=accrue(),now=Date.now(),p=prompts[new Date().getDate()%prompts.length];todayDate.textContent=new Date().toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});dailyPromptTitle.textContent=p[0];dailyPromptSub.textContent=p[1];let c=d.checkins[dayKey()];if(c){needToday.value=c.need||'';forMeToday.value=c.forMe||'';mood=c.mood||3;document.querySelectorAll('#moodScale button').forEach((b,i)=>b.classList.toggle('sel',i+1===mood))}
 drawOrbit(d);
 orbitItems.innerHTML=d.orbit.map(o=>`<div class="card good-card"><div><strong>${esc(o.name)}</strong><small>${esc(o.meaning||'')}</small></div><button class="btn btn-line" onclick="removeOrbit('${o.id}')">Quitar</button></div>`).join('');
 let todays=d.goodThings.filter(g=>dayKey(g.ts)===dayKey()).slice().reverse();todayGoodThings.innerHTML=todays.length?'<div class="section-head"><h2>Hoy también pasó esto</h2></div>'+todays.map(g=>`<div class="card good-card"><div><strong>${esc(g.text)}</strong><small>${esc(g.meaning||'')}</small></div><button class="btn btn-line" onclick="deleteGood('${g.id}')">Quitar</button></div>`).join(''):'';
 bank.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');shopWallet.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');shopLifetime.textContent=Number(d.lifetimeStars||0).toFixed(1).replace('.',',');todayPoints.textContent=todayPointsTotal(d).toFixed(1).replace('.',',');bestStreak.textContent=fmt(d.returnToMe?.best||d.best||0);
 goals.innerHTML=d.goals.map(g=>`<div class="card goal">
   <div class="goal-top">
     <div class="goal-icon">${icons[g.icon]||icons.search}</div>
     <div><div class="goal-title">${esc(g.name)}</div><div class="goal-sub">${esc(g.sub)}</div></div>
   </div>
   <div class="goal-actions">
     <button class="btn btn-soft" onclick="openUrge('${g.id}')">Tengo ganas</button>
     <button class="btn btn-line" onclick="slip('${g.id}')">Lo he comprobado</button>
   </div>
 </div>`).join('');
 let sm=sharedMilestoneInfo(d);
 sharedStreak.textContent=fmt(now-d.returnToMe.since);
 sharedNextMilestone.textContent=sm.text;
 sharedProgress.style.width=sm.pct+'%';
 rewards.innerHTML=d.rewards.map(r=>`<div class="card reward"><div><strong>${esc(r.name)}</strong><small>${r.cost} estrellas</small></div><button class="btn ${Number(d.wallet||0)>=r.cost?'btn-main':'btn-soft'}" ${Number(d.wallet||0)>=r.cost?'':'disabled'} onclick="redeem('${r.id}')">${Number(d.wallet||0)>=r.cost?'Canjear':'Aún no'}</button></div>`).join('');
 renderArchive()
}
setInterval(render,60000);render();
