const HOUR=3600000, STEP=2*HOUR;
const icons={
chat:`<svg class="icon" viewBox="0 0 24 24"><path d="M5 18l-1 3 4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3z"/></svg>`,
insta:`<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.4" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>`,
activity:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 13h3l2-6 4 11 2-6h5"/></svg>`,
search:`<svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/><path d="m7 7 7 7"/></svg>`
};
function uid(){return Math.random().toString(36).slice(2,10)}


function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmt(ms){let h=Math.floor(ms/HOUR),m=Math.floor((ms%HOUR)/60000);if(h>=24)return Math.floor(h/24)+'d '+(h%24)+'h';return h+'h '+String(m).padStart(2,'0')+'m'}


function showPage(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 document.querySelectorAll('.bottom button').forEach(b=>b.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 let nav=document.getElementById('nav-'+id);if(nav)nav.classList.add('active');
 let bottomNav=document.querySelector('.bottom');
 if(bottomNav){bottomNav.style.display=id==='universe'?'none':'grid'}
 window.scrollTo({top:0,behavior:'smooth'});render()
}

function openReward(){rewardModal.classList.add('show')}
function addReward(){let n=rewardName.value.trim(),c=+rewardCost.value;if(!n||!c)return toast('Completa el premio');let d=load();d.rewards.push({id:uid(),name:n,cost:c});save(d);rewardName.value='';closeModal('rewardModal');render()}
function redeem(id){let d=load(),r=d.rewards.find(x=>x.id===id);if(r&&Number(d.wallet||0)>=r.cost){d.wallet=Number(d.wallet||0)-r.cost;d.bank=d.wallet;save(d);toast('Premio canjeado');render()}}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>t.classList.remove('show'),1900)}



function drawOrbit(d){let el=bigOrbit;el.innerHTML='<div class="orbit-circle o1"></div><div class="orbit-circle o2"></div><div class="orbit-circle o3"></div><div class="me">yo</div>';let coords=[[50,18],[80,34],[82,67],[52,83],[19,68],[19,35],[65,25],[67,74]];d.orbit.slice(0,8).forEach((o,i)=>{let p=document.createElement('div');p.className='planet';p.style.left=coords[i][0]+'%';p.style.top=coords[i][1]+'%';p.textContent=o.name;el.appendChild(p)})}

function constellationSvg(def, unlocked, progress) {
  let N = def.pts.length;
  let pVal = unlocked ? 1 : Math.max(0, Math.min(1, Number(progress) || 0));
  
  // Progresión estrella por estrella: cada estrella ganada activa un nodo y sus conexiones
  // Para Lira (need: 8, 6 nodos): 0 -> 0, 1 -> 1, 2 -> 2, 3 -> 3, 4 -> 4, 5 -> 5, 6..8 -> 6
  let totalNeed = def.need || N;
  let earned = Math.floor(pVal * totalNeed);
  let achieved = unlocked ? N : Math.min(N, earned);
  let nextTarget = unlocked ? -1 : (achieved < N ? achieved : -1);
  let isRefined = unlocked || pVal >= 0.875;
  
  let lines = def.edges.map(([a, b]) => {
    let active = a < achieved && b < achieved;
    let cls = active ? ('line' + (isRefined ? ' refined-line' : '')) : 'ghost-line';
    return `<line class="${cls}" x1="${def.pts[a][0]}%" y1="${def.pts[a][1]}%" x2="${def.pts[b][0]}%" y2="${def.pts[b][1]}%"/>`;
  }).join('');
  
  let stars = def.pts.map((p, i) => {
    let cls = 'ghost-star';
    let isMain = (def.id === 'lyra' && i === 0);
    let r = isMain ? 1.8 : 1.7;
    
    if (i < achieved) {
      if (isMain) {
        let level = isRefined ? 'main-star-full' : (pVal >= 0.38 ? 'main-star-mid' : 'main-star-low');
        cls = `star ${level}`;
        r = isRefined ? 3.5 : (pVal >= 0.38 ? 3.0 : 2.6);
      } else {
        cls = 'star' + (isRefined ? ' refined-star' : '');
        r = isRefined ? 2.6 : 2.3;
      }
    } else if (i === nextTarget) {
      cls = 'target-star';
      r = isMain ? 2.1 : 2.0;
    }
    return `<circle class="${cls}" cx="${p[0]}%" cy="${p[1]}%" r="${r}"/>`;
  }).join('');
  
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${lines}${stars}</svg>`;
}
function renderUniverse(d){
 let total=Number(d.lifetimeStars||0),wallet=Number(d.wallet||0);
 universeWallet.textContent=wallet.toFixed(1).replace('.',',');
 universeLifetime.textContent=total.toFixed(1).replace('.',',');
 
 // Filter constellationDefs by unlocked regions
 let allowedCols = [];
 if (d.unlockedRegions && d.unlockedRegions.includes('cielo-1')) allowedCols.push('norte');
 if (d.unlockedRegions && d.unlockedRegions.includes('zodiaco')) allowedCols.push('zodiaco');
 if (d.unlockedRegions && d.unlockedRegions.includes('orion')) allowedCols.push('invierno');
 if (d.unlockedRegions && d.unlockedRegions.includes('profundo')) allowedCols.push('profundo');
 
 let available = constellationDefs.filter(c => allowedCols.includes(c.collection));
 available.sort((a, b) => a.need - b.need);
 
 let next = available.find(c => total < c.need);
 if (next) {
   let current = next;
   constellationStage.style.display = 'block';
   
   // Posicionamiento y escala celeste armónica (Mobile-first, preparado para convivir con más constelaciones)
   let vw = window.innerWidth || document.documentElement.clientWidth || 360;
   let vh = window.innerHeight || document.documentElement.clientHeight || 640;
   
   // Escala contenida (~120px-160px en móvil) que deja libre el resto del mapa estelar
   let baseSize = current.size || 125;
   let size = Math.round(Math.max(110, Math.min(vw * 0.38, (vh - 140) * 0.28, baseSize, 160)));
   
   constellationStage.style.width = size + 'px';
   constellationStage.style.height = size + 'px';
   constellationStage.style.left = (current.x || 50) + '%';
   constellationStage.style.top = (current.y || 34) + '%';
   constellationStage.style.transform = `translate(-50%, -50%) rotate(${current.rot || 0}deg)`;
   
   let idx = available.indexOf(current);
   let prevNeed = idx > 0 ? available[idx - 1].need : 0;
   let progress = Math.max(0, Math.min(1, (total - prevNeed) / (current.need - prevNeed)));
   
   constellationProgressText.textContent = `${total.toFixed(1).replace('.', ',')} / ${current.need} estrellas`;
   constellationStage.innerHTML = constellationSvg(current, false, progress);
   
   let detailsStage = document.getElementById('universeDetailsStage');
   if (detailsStage) {
     detailsStage.innerHTML = constellationSvg(current, false, progress);
   }
   let captionDetails = document.getElementById('constellationDetailsCaption');
   if (captionDetails) {
     captionDetails.innerHTML = `<div class="constellation-caption" style="position:static;color:#fff;padding:0;"><strong style="font-size:15px;color:var(--rose2);">${'Dibujando ' + current.name}</strong><br><small style="color:rgba(255,255,255,0.6);font-size:12px;">Faltan ${(current.need - total).toFixed(1).replace('.', ',')} estrellas: ${current.desc}</small></div>`;
   }
 } else {
   constellationStage.style.display = 'none';
   constellationProgressText.textContent = 'Has cartografiado todo lo accesible. Desbloquea una nueva región para seguir explorando.';
   let detailsStage = document.getElementById('universeDetailsStage');
   if (detailsStage) {
     detailsStage.innerHTML = '<div class="empty" style="padding:40px;color:rgba(255,255,255,0.4);text-align:center;font-size:12px;">Todo cartografiado</div>';
   }
   let captionDetails = document.getElementById('constellationDetailsCaption');
   if (captionDetails) {
     captionDetails.innerHTML = `<div class="constellation-caption" style="position:static;color:#fff;padding:0;"><strong style="font-size:14px;color:var(--rose2);">Exploración completa</strong><br><small style="color:rgba(255,255,255,0.5);font-size:11px;">Desbloquea una nueva región en Exploración para seguir descubriendo el universo.</small></div>`;
   }
 }
 
 // Render constellation book tabbed navigation
 const bookTabs = [
   { id: 'cielo-1', name: 'Primer cielo', region: 'cielo-1', consts: ['lyra', 'cassiopeia', 'ursa-major'] },
   { id: 'zodiaco', name: 'Zodiaco', region: 'zodiaco', col: 'zodiaco' },
   { id: 'norte', name: 'Cielo del norte', region: 'cielo-1', consts: ['cygnus'] },
   { id: 'invierno', name: 'Cielo de invierno', region: 'orion', col: 'invierno' },
   { id: 'profundo', name: 'Espacio profundo', region: 'profundo', col: 'profundo' }
 ];
 if (typeof window.currentBookTab === 'undefined') window.currentBookTab = 'cielo-1';
 
 let tabsHtml = bookTabs.map(tab => {
   let active = window.currentBookTab === tab.id;
   let isTabUnlocked = d.unlockedRegions && d.unlockedRegions.includes(tab.region);
   let label = tab.name + (isTabUnlocked ? '' : ' 🔒');
   return `<button class="chip ${active ? 'active' : ''}" style="padding:6px 12px; font-size:10px; border-radius:99px; background:${active ? 'var(--wine)' : 'rgba(255,255,255,0.04)'}; border:1px solid ${active ? 'var(--rose2)' : 'rgba(255,255,255,0.1)'}; color:${active ? '#fff' : 'rgba(255,255,255,0.6)'}; cursor:pointer;" onclick="window.currentBookTab='${tab.id}'; render()">${label}</button>`;
 }).join('');
 
 let activeTab = bookTabs.find(t => t.id === window.currentBookTab) || bookTabs[0];
 let isTabUnlocked = d.unlockedRegions && d.unlockedRegions.includes(activeTab.region);
 let tabConsts = [];
 if (activeTab.consts) {
   tabConsts = constellationDefs.filter(c => activeTab.consts.includes(c.id));
 } else if (activeTab.col) {
   tabConsts = constellationDefs.filter(c => c.collection === activeTab.col);
 }
 let ownedCount = isTabUnlocked ? tabConsts.filter(c => d.claimed && d.claimed[c.id]).length : 0;
 
 let headerHtml = `
   <div class="collection-header" style="grid-column: 1 / -1; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
     <h4 style="margin: 0; font-size: 13px; color: var(--rose2); text-transform: uppercase; letter-spacing: 0.05em;">
       ${activeTab.name} ${isTabUnlocked ? `(${ownedCount}/${tabConsts.length})` : '(Bloqueada)'}
     </h4>
   </div>
 `;
 
 let bodyHtml = '';
 if (!isTabUnlocked) {
   let regNames = {
     'zodiaco': 'Cinturón Zodiacal',
     'orion': 'Nebulosa de Orión',
     'profundo': 'Espacio profundo'
   };
   let regName = regNames[activeTab.region] || activeTab.region;
   bodyHtml = `
     <div class="empty" style="grid-column: 1 / -1; padding: 30px; background: rgba(255,255,255,0.02); border-radius: 12px; text-align: center; border: 1px dashed rgba(255,255,255,0.08);">
       <p style="margin: 0 0 10px 0; font-size: 11px; color: rgba(247,244,235,0.6);">Requiere desbloquear la región <strong>${regName}</strong> en Exploración.</p>
       <button class="btn btn-soft" style="padding: 6px 12px; font-size: 10px; border-radius: 8px;" onclick="closeModal('constellationBookModal'); openShipModal(); setShipTab('regiones');">Ir a Regiones</button>
     </div>
   `;
 } else {
   bodyHtml = tabConsts.map(c => {
     let owned = d.claimed && d.claimed[c.id];
     let discovered = !owned && total >= c.need;
     if (owned) {
       let acqDate = new Date(d.claimed[c.id]).toLocaleDateString('es-ES', {day:'numeric', month:'short'});
       return `<div class="card book-card owned">
         <div class="mini-const">${constellationSvg(c, true, 1.0)}</div>
         <span class="unlock text-owned" style="color: var(--rose2); font-weight: bold; font-size: 9px;">En mi universo</span>
         <h3>${c.name}${c.extra === 'tu signo' ? '<span class="sign-tag">tu signo</span>' : ''}</h3>
         <p style="font-size: 9px; color: rgba(247,244,235,0.5); margin-bottom: 6px;">Adquirida: ${acqDate}</p>
         <button class="btn btn-line" style="padding: 4px 8px; font-size: 9px; border-radius: 8px;" onclick="verFichaConstelacion('${c.id}')">Ficha</button>
       </div>`;
     } else if (discovered) {
       return `<div class="card book-card discovered">
         <div class="mini-const">${constellationSvg(c, true, 0.5)}</div>
         <span class="unlock text-discovered" style="color: #fcc2cd; font-size: 9px;">Descubierta</span>
         <h3>${c.name}${c.extra === 'tu signo' ? '<span class="sign-tag">tu signo</span>' : ''}</h3>
         <button class="btn btn-main" style="padding: 4px 8px; font-size: 9px; border-radius: 8px; margin-top: 5px;" onclick="guardarConstelacion('${c.id}', ${c.cost})">Guardar · ${c.cost} estrellas</button>
       </div>`;
     } else {
       return `<div class="card book-card locked">
         <div class="mini-const">${constellationSvg(c, false, 0.0)}</div>
         <span class="unlock" style="color: rgba(247,244,235,0.4); font-size: 9px;">${c.need} hist.</span>
         <h3>${c.name}</h3>
         <p style="font-size: 9px; color: rgba(247,244,235,0.4);">Bloqueada. Necesitas ${c.need} estrellas históricas.</p>
       </div>`;
     }
   }).join('');
 }
 
 constellationBook.innerHTML = `
   <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:10px; margin-bottom:10px;">
     <div class="book-tabs" style="display:flex; gap:6px; overflow-x:auto; padding-bottom:5px; -webkit-overflow-scrolling:touch;">
       ${tabsHtml}
     </div>
   </div>
   ${headerHtml}
   ${bodyHtml}
 `;
 
 // Render Ship Level & Status
 const shipLevels = [
   { level: 0, name: 'Navegación orbital', cost: 0 },
   { level: 1, name: 'Sistema de aproximación', cost: 5 },
   { level: 2, name: 'Cartografía estelar', cost: 10 },
   { level: 3, name: 'Navegación profunda', cost: 15 },
   { level: 4, name: 'Salto interestelar', cost: 20 }
 ];
 
 const destinations = [
   { name: 'Luna', reqLevel: 0, desc: 'Satélite natural terrestre.' },
   { name: 'Venus', reqLevel: 1, desc: 'Atmósfera densa e infierno de calor.' },
   { name: 'Marte', reqLevel: 1, desc: 'El planeta rojo y desértico.' },
   { name: 'Júpiter', reqLevel: 2, desc: 'Gigante gaseoso con su gran mancha roja.' },
   { name: 'Saturno', reqLevel: 2, desc: 'Señor de los anillos.' },
   { name: 'Europa', reqLevel: 3, desc: 'Luna helada con océano subterráneo.' },
   { name: 'Titán', reqLevel: 4, desc: 'Luna con lagos de metano líquido.' }
 ];
 
 const regions = [
   { id: 'cielo-1', name: 'Primer cielo', cost: 0, desc: 'El cielo visible a simple vista.' },
   { id: 'zodiaco', name: 'Cinturón Zodiacal', cost: 5, desc: 'Camino solar que cruzan las 12 constelaciones.' },
   { id: 'orion', name: 'Nebulosa de Orión', cost: 10, desc: 'Cuna de estrellas en el brazo de Orión.' },
   { id: 'exterior', name: 'Sistema exterior', cost: 15, desc: 'Estrellas lejanas en las afueras de la galaxia.' },
   { id: 'profundo', name: 'Espacio profundo', cost: 20, desc: 'Galaxias externas y horizontes lejanos.' }
 ];
 
 let currentLvl = d.shipLevel || 0;
 let nextLvl = shipLevels.find(l => l.level === currentLvl + 1);
 let shipHtml = `
   <div class="card" style="padding:15px; background:var(--soft); border:1px solid var(--rose2);">
     <small style="text-transform:uppercase; font-size:9px; color:var(--muted); font-weight:700; letter-spacing:0.05em;">Rango de la nave</small>
     <h3 style="margin:5px 0; font-family:Georgia,serif; font-size:18px; color:var(--wine);">${shipLevels[currentLvl].name}</h3>
     ${nextLvl ? `
       <p style="font-size:11px; color:var(--muted); margin: 5px 0 10px;">Siguiente nivel: <strong>${nextLvl.name}</strong></p>
       <button class="btn btn-main btn-wide" onclick="upgradeShip(${nextLvl.level}, ${nextLvl.cost})">Mejorar nave · ${nextLvl.cost} estrellas</button>
     ` : `
       <p style="font-size:11px; color:green; margin:5px 0 0 0; font-weight:700;">Nivel máximo alcanzado</p>
     `}
   </div>
 `;
 let shipLevelStatusEl = document.getElementById('shipLevelStatus');
 if (shipLevelStatusEl) shipLevelStatusEl.innerHTML = shipHtml;
 
 let destHtml = '<h4 style="margin: 15px 3px 10px; font-size: 11px; text-transform: uppercase; color:var(--wine); letter-spacing:0.05em;">Destinos orbitales</h4>';
 destinations.forEach(dest => {
   let unlocked = currentLvl >= dest.reqLevel;
   destHtml += `
     <div class="card" style="padding:12px; margin-bottom:8px; opacity: ${unlocked ? 1 : 0.6}; border: 1px solid ${unlocked ? 'var(--line)' : 'dashed var(--muted)'}; display: flex; flex-direction: column; gap: 4px;">
       <div style="display:flex; justify-content:space-between; align-items:center;">
         <strong style="font-size:13px; color:${unlocked ? 'var(--ink)' : 'var(--muted)'};">${dest.name}</strong>
         <span style="font-size:9px; font-weight:700; color:${unlocked ? 'green' : 'var(--wine)'};">
           ${unlocked ? 'Disponible' : 'Requiere ' + shipLevels[dest.reqLevel].name}
         </span>
       </div>
       <p style="font-size:10px; color:var(--muted); margin: 0;">${dest.desc}</p>
     </div>
   `;
 });
 let shipDestinationsEl = document.getElementById('shipDestinations');
 if (shipDestinationsEl) shipDestinationsEl.innerHTML = destHtml;
 
 // Render Regions
 let regHtml = '';
 regions.forEach(reg => {
   let unlocked = d.unlockedRegions && d.unlockedRegions.includes(reg.id);
   regHtml += `
     <div class="card" style="padding:12px; margin-bottom:8px; border: 1px solid ${unlocked ? 'var(--line)' : 'dashed var(--rose2)'}; display: flex; flex-direction: column; gap: 4px;">
       <div style="display:flex; justify-content:space-between; align-items:center;">
         <strong style="font-size:13px; color:var(--ink);">${reg.name}</strong>
         ${unlocked ? `
           <span style="font-size:10px; font-weight:700; color:green;">Desbloqueada</span>
         ` : `
           <button class="btn btn-main" style="padding: 4px 8px; font-size: 9px; border-radius: 8px;" onclick="unlockRegion('${reg.id}', ${reg.cost})">Desbloquear · ${reg.cost} estrellas</button>
         `}
       </div>
       <p style="font-size:10px; color:var(--muted); margin: 0;">${reg.desc}</p>
     </div>
   `;
 });
 let skyRegionsEl = document.getElementById('skyRegions');
 if (skyRegionsEl) skyRegionsEl.innerHTML = regHtml;
}

function guardarConstelacion(id, cost){
  let d = load();
  if (Number(d.wallet || 0) < cost) {
    return toast('No tienes suficientes estrellas disponibles en tu cesta.');
  }
  d.wallet = Number(d.wallet || 0) - cost;
  d.bank = d.wallet;
  if(!d.claimed) d.claimed = {};
  d.claimed[id] = Date.now();
  save(d);
  toast(`${constellationDefs.find(x => x.id === id).name} guardada en tu universo.`);
  render();
}

function verFichaConstelacion(id){
  let c=constellationDefs.find(x=>x.id===id);
  detailConstName.textContent=c.name;
  detailConstMeta.textContent=c.collection === 'zodiaco' ? 'Colección: Zodiaco' : c.collection === 'norte' ? 'Colección: Cielo del norte' : c.collection === 'invierno' ? 'Colección: Cielo de invierno' : 'Colección: Espacio profundo';
  detailConstDesc.textContent=c.desc;
  document.getElementById('constellationDetailModal').classList.add('show');
}

function setShipTab(tab){
  let secNave = document.getElementById('shipSecNave');
  let secRegiones = document.getElementById('shipSecRegiones');
  let btnTabNave = document.getElementById('btnTabNave');
  let btnTabRegiones = document.getElementById('btnTabRegiones');
  if(secNave) secNave.style.display = tab === 'nave' ? 'block' : 'none';
  if(secRegiones) secRegiones.style.display = tab === 'regiones' ? 'block' : 'none';
  if(btnTabNave) btnTabNave.classList.toggle('active', tab === 'nave');
  if(btnTabRegiones) btnTabRegiones.classList.toggle('active', tab === 'regiones');
}

function upgradeShip(level, cost){
  let d = load();
  if (Number(d.wallet || 0) < cost) {
    return toast('No tienes suficientes estrellas en tu cesta.');
  }
  d.wallet = Number(d.wallet || 0) - cost;
  d.bank = d.wallet;
  d.shipLevel = level;
  save(d);
  const shipNames = ['Navegación orbital', 'Sistema de aproximación', 'Cartografía estelar', 'Navegación profunda', 'Salto interestelar'];
  toast(`Nave mejorada a ${shipNames[level] || level}`);
  render();
}

function unlockRegion(id, cost){
  let d = load();
  if (Number(d.wallet || 0) < cost) {
    return toast('No tienes suficientes estrellas en tu cesta.');
  }
  d.wallet = Number(d.wallet || 0) - cost;
  d.bank = d.wallet;
  if (!d.unlockedRegions) d.unlockedRegions = ['cielo-1'];
  if (!d.unlockedRegions.includes(id)) {
    d.unlockedRegions.push(id);
  }
  save(d);
  const regionNames = {
    'zodiaco': 'Cinturón Zodiacal',
    'orion': 'Nebulosa de Orión',
    'exterior': 'Sistema exterior',
    'profundo': 'Espacio profundo'
  };
  toast(`Región ${regionNames[id] || id} desbloqueada.`);
  render();
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
 renderArchive();
 renderUniverse(d);
}
setInterval(render,60000);render();

function openShopModal(){document.getElementById('shopModal').classList.add('show')}
function openInfoModal(){document.getElementById('infoModal').classList.add('show')}
function openShipModal(){document.getElementById('shipModal').classList.add('show')}
function openUniverseDetailsModal(){document.getElementById('universeDetailsModal').classList.add('show')}
function openConstellationBookModal(){document.getElementById('constellationBookModal').classList.add('show')}

window.addEventListener('resize', () => {
  let u = document.getElementById('universe');
  if (u && u.classList.contains('active')) renderUniverse(load());
});
