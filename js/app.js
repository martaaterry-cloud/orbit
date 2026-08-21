const icons={
chat:`<svg class="icon" viewBox="0 0 24 24"><path d="M5 18l-1 3 4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3z"/></svg>`,
insta:`<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.4" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>`,
activity:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 13h3l2-6 4 11 2-6h5"/></svg>`,
search:`<svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/><path d="m7 7 7 7"/></svg>`
};


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

// ==========================================================================
// SWIPE TO DELETE REUTILIZABLE (TOUCH & DESKTOP)
// ==========================================================================
let swipeTouchState = {
  startX: 0,
  startY: 0,
  currentEl: null,
  isHorizontal: null,
  currentTx: 0,
  didSwipe: false,
  openedEl: null
};

function handleSwipeTouchStart(e, el) {
  if (swipeTouchState.openedEl && swipeTouchState.openedEl !== el) {
    swipeTouchState.openedEl.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
    swipeTouchState.openedEl.style.transform = 'translateX(0px)';
    swipeTouchState.openedEl = null;
  }
  let touch = e.touches[0];
  swipeTouchState.startX = touch.clientX;
  swipeTouchState.startY = touch.clientY;
  swipeTouchState.currentEl = el;
  swipeTouchState.isHorizontal = null;
  swipeTouchState.currentTx = 0;
  swipeTouchState.didSwipe = false;
  el.style.transition = 'none';
}

function handleSwipeTouchMove(e, el) {
  if (swipeTouchState.currentEl !== el) return;
  let touch = e.touches[0];
  let dx = touch.clientX - swipeTouchState.startX;
  let dy = touch.clientY - swipeTouchState.startY;

  if (swipeTouchState.isHorizontal === null) {
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      swipeTouchState.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
  }

  if (swipeTouchState.isHorizontal) {
    if (Math.abs(dx) > 8) {
      swipeTouchState.didSwipe = true;
    }
    let tx = Math.min(0, Math.max(-85, dx));
    swipeTouchState.currentTx = tx;
    el.style.transform = `translateX(${tx}px)`;
    if (Math.abs(dx) > 8 && e.cancelable) {
      e.preventDefault();
    }
  }
}

function handleSwipeTouchEnd(e, el) {
  if (swipeTouchState.currentEl !== el) return;
  el.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
  if (swipeTouchState.currentTx < -40) {
    el.style.transform = 'translateX(-75px)';
    swipeTouchState.openedEl = el;
  } else {
    el.style.transform = 'translateX(0px)';
    if (swipeTouchState.openedEl === el) swipeTouchState.openedEl = null;
  }
  setTimeout(() => {
    swipeTouchState.didSwipe = false;
  }, 80);
  swipeTouchState.currentEl = null;
}

function handleSwipeCardClick(e, el, actionFn) {
  if (swipeTouchState.didSwipe || (swipeTouchState.openedEl === el)) {
    if (swipeTouchState.openedEl === el) {
      el.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
      el.style.transform = 'translateX(0px)';
      swipeTouchState.openedEl = null;
    }
    return;
  }
  if (typeof actionFn === 'function') {
    actionFn(e);
  }
}

function wrapSwipe(contentHtml, deleteActionAttr, extraClasses = '', clickActionAttr = '') {
  const isClickable = Boolean(clickActionAttr);
  const clickableClass = isClickable ? 'clickable' : '';
  const clickHandler = isClickable ? `onclick="handleSwipeCardClick(event, this, () => { ${clickActionAttr} })"` : '';

  return `<div class="swipe-row">
    <div class="swipe-action-bg">
      <button class="swipe-delete-btn" onclick="${deleteActionAttr}">
        <svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Eliminar</span>
      </button>
    </div>
    <div class="card ${extraClasses} swipe-front ${clickableClass}" ${clickHandler} ontouchstart="handleSwipeTouchStart(event,this)" ontouchmove="handleSwipeTouchMove(event,this)" ontouchend="handleSwipeTouchEnd(event,this)">
      ${contentHtml}
      <div class="desktop-delete-btn-wrap">
        <button class="btn btn-line btn-sm desktop-delete-btn" onclick="event.stopPropagation(); ${deleteActionAttr}" title="Eliminar">
          <svg class="icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke:currentColor;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span>Eliminar</span>
        </button>
      </div>
    </div>
  </div>`;
}



function populatePillarSelect(d){
  let sel=document.getElementById('goodPillarSelect');
  if(!sel)return;
  let currentVal=sel.value;
  let html='<option value="">Sin asociar</option>';
  if(Array.isArray(d.orbit)){
    d.orbit.forEach(p=>{
      if(p&&p.id&&p.name){
        html+=`<option value="${esc(p.id)}">${esc(p.name)}</option>`;
      }
    });
  }
  sel.innerHTML=html;
  if(currentVal)sel.value=currentVal;
}

function showPillarMemory(goodId){
  let d=load();
  let m=(d.goodThings||[]).find(g=>g&&g.id===goodId);
  if(!m)return;
  let p=(d.orbit||[]).find(o=>o&&o.id===m.pillarId);
  let pName=p?p.name:'Pilar';
  toast(`“${m.text}” · ${pName}`);
}

async function previewGoodPhoto(photoPath){
  if(!photoPath)return;
  toast('Cargando foto…');
  let signedUrl = typeof getPhotoSignedUrl === 'function' ? await getPhotoSignedUrl(photoPath) : null;
  if(!signedUrl){
    return toast('No se pudo cargar la foto.');
  }
  let modalImg = document.getElementById('photoModalImg');
  if(modalImg) modalImg.src = signedUrl;
  let modal = document.getElementById('photoModal');
  if(modal) modal.classList.add('show');
}

function loadPhotoThumbnails(){
  let wraps = document.querySelectorAll('.good-photo-thumb-wrap[data-photo-path]');
  wraps.forEach(wrap => {
    let path = wrap.getAttribute('data-photo-path');
    if(!path) return;
    let img = wrap.querySelector('.good-photo-thumb');
    let spinner = wrap.querySelector('.good-photo-loading');
    if(img && img.getAttribute('data-loaded-path') === path) return;

    if(typeof getPhotoSignedUrl === 'function'){
      getPhotoSignedUrl(path).then(signedUrl => {
        if(signedUrl && img){
          img.src = signedUrl;
          img.style.display = 'block';
          img.setAttribute('data-loaded-path', path);
          if(spinner) spinner.style.display = 'none';
        } else if(spinner) {
          spinner.style.display = 'none';
        }
      });
    }
  });
}

function drawOrbit(d){
  let el=bigOrbit;
  if(!el)return;
  el.innerHTML='<div class="orbit-circle o1"></div><div class="orbit-circle o2"></div><div class="orbit-circle o3"></div><div class="me">yo</div>';
  
  let pillars=Array.isArray(d.orbit)?d.orbit:[];
  let N=pillars.length;
  if(N===0){
    let emptyHint=document.createElement('div');
    emptyHint.className='orbit-empty-hint';
    emptyHint.style.cssText='position:absolute; bottom:16px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--muted); white-space:nowrap;';
    emptyHint.textContent='Añade pilares para ver tu órbita';
    el.appendChild(emptyHint);
    return;
  }

  // Distribución dinámica sobre la órbita adaptada a cualquier cantidad N de pilares
  let rx=37;
  let ry=36;

  pillars.forEach((o,i)=>{
    let p=document.createElement('div');
    p.className='planet';
    let angle=(i/N)*2*Math.PI-(Math.PI/2);
    let x=50+rx*Math.cos(angle);
    let y=50+ry*Math.sin(angle);

    p.style.left=x.toFixed(1)+'%';
    p.style.top=y.toFixed(1)+'%';

    let memories=(d.goodThings||[]).filter(g=>g&&g.pillarId===o.id).slice(-3);
    let html=`<span class="planet-name">${esc(o.name)}</span>`;
    if(memories.length){
      html+=`<span class="planet-sparks">${memories.map(m=>`<button type="button" class="planet-spark" onclick="event.stopPropagation(); showPillarMemory('${esc(m.id)}')" title="${esc(m.text)}">✦</button>`).join('')}</span>`;
    }
    p.innerHTML=html;
    el.appendChild(p);
  });
}

function constellationSvg(def, unlocked, progress) {
  let N = def.pts.length;
  let pVal = unlocked ? 1 : Math.max(0, Math.min(1, Number(progress) || 0));
  
  // Progresión estrella por estrella: cada estrella ganada activa un nodo y sus conexiones
  let totalNeed = def.need || N;
  let earned = Math.floor(pVal * totalNeed);
  let achieved = unlocked ? N : Math.min(N, earned);
  let nextTarget = unlocked ? -1 : (achieved < N ? achieved : -1);
  let isRefined = unlocked || pVal >= 0.875;
  
  // Micro-estrellas de fondo suaves para ambientar el cielo nocturno
  let ambientStars = [
    [14, 22, 0.8, 0.22],
    [85, 17, 1.0, 0.28],
    [11, 72, 0.7, 0.18],
    [88, 70, 0.9, 0.25],
    [48, 90, 0.8, 0.20],
    [80, 42, 0.6, 0.16],
    [20, 50, 0.7, 0.19],
    [64, 12, 0.9, 0.24]
  ].map(([cx, cy, r, op]) => `<circle class="ambient-sky-star" cx="${cx}%" cy="${cy}%" r="${r}" opacity="${op}"/>`).join('');

  let lines = def.edges.map(([a, b]) => {
    let active = a < achieved && b < achieved;
    let cls = active ? ('line' + (isRefined ? ' refined-line' : '')) : 'ghost-line';
    return `<line class="${cls}" x1="${def.pts[a][0]}%" y1="${def.pts[a][1]}%" x2="${def.pts[b][0]}%" y2="${def.pts[b][1]}%"/>`;
  }).join('');
  
  let stars = def.pts.map((p, i) => {
    let cls = 'ghost-star';
    let isMain = (def.id === 'lyra' && i === 0);
    let r = isMain ? 2.3 : 2.1;
    
    if (i < achieved) {
      if (isMain) {
        let level = isRefined ? 'main-star-full' : (pVal >= 0.38 ? 'main-star-mid' : 'main-star-low');
        cls = `star ${level}`;
        r = isRefined ? 3.6 : (pVal >= 0.38 ? 3.3 : 3.0);
      } else {
        cls = 'star' + (isRefined ? ' refined-star' : '');
        r = isRefined ? 2.8 : 2.6;
      }
    } else if (i === nextTarget) {
      cls = 'target-star';
      r = isMain ? 2.5 : 2.3;
    }
    return `<circle class="${cls}" cx="${p[0]}%" cy="${p[1]}%" r="${r}"/>`;
  }).join('');
  
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${ambientStars}${lines}${stars}</svg>`;
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
   return `<button class="atlas-chip ${active ? 'active' : ''}" onclick="window.currentBookTab='${tab.id}'; render()">${label}</button>`;
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
 
 let pagesHtml = '';
 if (!isTabUnlocked) {
   let regNames = {
     'zodiaco': 'Cinturón Zodiacal',
     'orion': 'Nebulosa de Orión',
     'profundo': 'Espacio profundo'
   };
   let regName = regNames[activeTab.region] || activeTab.region;
   pagesHtml = `
     <div class="atlas-page locked-region" style="flex: 0 0 100%;">
       <div class="atlas-drawing-stage" style="border: 1px dashed rgba(255,255,255,0.15);">
         <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:36px; height:36px;"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/></svg>
       </div>
       <div class="atlas-name">${activeTab.name}</div>
       <div class="atlas-status locked">Región por explorar</div>
       <p class="atlas-desc">Desbloquea la región <strong>${regName}</strong> desde la nave para cartografiar este capítulo.</p>
       <button class="btn btn-soft" style="margin-top:10px; font-size:10px; padding:6px 14px;" onclick="closeModal('constellationBookModal'); openShipModal(); setShipTab('regiones');">Ir a Exploración</button>
     </div>
   `;
 } else {
   pagesHtml = tabConsts.map((c, idx) => {
     let owned = d.claimed && d.claimed[c.id];
     let discovered = !owned && total >= c.need;
     let isTarget = !owned && !discovered && next && (next.id === c.id);
     
     let svgMarkup = '';
     let statusMarkup = '';
     let actionMarkup = '';
     let pageNum = String(idx + 1).padStart(2, '0') + ' / ' + String(tabConsts.length).padStart(2, '0');

     if (owned) {
       let acqDate = new Date(d.claimed[c.id]).toLocaleDateString('es-ES', {day:'numeric', month:'short'});
       svgMarkup = constellationSvg(c, true, 1.0);
       statusMarkup = `<div class="atlas-status owned">✦ En tu universo</div>`;
       actionMarkup = `
         <div class="atlas-meta-row">
           <span class="atlas-date">Adquirida: ${acqDate}</span>
           <button class="btn btn-line btn-sm" style="padding:3px 8px; font-size:9px; border-radius:8px;" onclick="verFichaConstelacion('${c.id}')">Ficha</button>
         </div>`;
     } else if (discovered) {
       svgMarkup = constellationSvg(c, true, 0.7);
       statusMarkup = `<div class="atlas-status discovered">✧ Descubierta</div>`;
       actionMarkup = `<button class="btn btn-main btn-sm" style="padding:6px 14px; font-size:10px; margin-top:4px;" onclick="guardarConstelacion('${c.id}', ${c.cost})">Guardar en universo · ${c.cost} ★</button>`;
     } else if (isTarget) {
       let prevNeed = idx > 0 ? tabConsts[idx - 1].need : 0;
       let pVal = Math.max(0, Math.min(1, (total - prevNeed) / (c.need - prevNeed)));
       svgMarkup = constellationSvg(c, false, pVal);
       statusMarkup = `<div class="atlas-status in-progress">En curso (${total.toFixed(1).replace('.', ',')} / ${c.need} ★)</div>`;
       actionMarkup = `<div class="atlas-req">Faltan ${(c.need - total).toFixed(1).replace('.', ',')} estrellas</div>`;
     } else {
       svgMarkup = constellationSvg(c, false, 0.0);
       statusMarkup = `<div class="atlas-status locked">Por descubrir</div>`;
       actionMarkup = `<div class="atlas-req">Requiere ${c.need} estrellas históricas</div>`;
     }

     // Página Piloto de Lira: lámina de atlas astronómico encuadernado
     if (c.id === 'lyra') {
       let lyraNameSpaced = 'L I R A';
       return `
         <div class="atlas-page atlas-folio atlas-folio-lyra ${owned ? 'owned' : (discovered ? 'discovered' : (isTarget ? 'in-progress' : 'locked'))}">
           <div class="atlas-folio-header">
             <span class="atlas-folio-chapter">I · ${esc(activeTab.name).toUpperCase()}</span>
             <span class="atlas-folio-num">FOLIO ${pageNum}</span>
           </div>
           
           <div class="atlas-sky-canvas">
             ${svgMarkup}
           </div>

           <div class="atlas-folio-body">
             <div class="atlas-folio-name">${lyraNameSpaced}</div>
             <p class="atlas-folio-desc">${esc(c.desc || 'Una primera señal de que algo nuevo empieza a dibujarse.')}</p>
           </div>

           <div class="atlas-folio-footer">
             <div class="atlas-folio-status-badge">${statusMarkup}</div>
             ${actionMarkup ? `<div class="atlas-folio-action">${actionMarkup}</div>` : ''}
           </div>
         </div>
       `;
     }

     return `
        <div class="atlas-page ${owned ? 'owned' : (discovered ? 'discovered' : 'locked')}">
          <div class="atlas-page-header">
            <span class="atlas-chapter-title">${esc(activeTab.name)}</span>
            <span class="atlas-page-num">${pageNum}</span>
          </div>
          <div class="atlas-drawing-stage">
            <div class="atlas-compass-ring"></div>
            ${svgMarkup}
          </div>
          <div class="atlas-name">${esc(c.name)}${c.extra === 'tu signo' ? '<span class="sign-tag" style="margin-left:6px; font-size:8.5px;">tu signo</span>' : ''}</div>
          ${statusMarkup}
          <p class="atlas-desc">${esc(c.desc || 'Constelación del firmamento.')}</p>
          <div class="atlas-page-footer">
            ${actionMarkup}
          </div>
        </div>
      `;
   }).join('');
 }
 
 constellationBook.innerHTML = `
   <div class="atlas-container">
     <div class="atlas-chapters">
       ${tabsHtml}
     </div>
     <div class="atlas-collection-info">
       <span>${activeTab.name}</span>
       <small>${isTabUnlocked ? `${ownedCount} de ${tabConsts.length} descubiertas` : 'Bloqueada'}</small>
     </div>
     <div class="atlas-carousel">
       ${pagesHtml}
     </div>
     ${isTabUnlocked && tabConsts.length > 1 ? '<div class="atlas-swipe-hint">← Desliza para explorar →</div>' : ''}
   </div>
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
 populatePillarSelect(d);
 orbitItems.innerHTML=(d.orbit||[]).length?d.orbit.map(o=>{
   let contentHtml=`<div style="flex:1;"><strong>${esc(o.name)}</strong><small>${esc(o.meaning||'')}</small></div>`;
   return wrapSwipe(contentHtml, `removeOrbit('${o.id}')`, 'good-card', `openEditOrbitItem('${o.id}')`);
 }).join(''):'<div class="empty" style="padding:14px; text-align:center; font-size:12px; color:var(--muted);">No tienes pilares guardados todavía.</div>';
 
  let todays=d.goodThings.filter(g=>dayKey(g.ts)===dayKey()).slice().reverse();
  todayGoodThings.innerHTML=todays.length?'<div class="section-head"><h2>Hoy también pasó esto</h2></div>'+todays.map(g=>{
    let p=g.pillarId?(d.orbit||[]).find(o=>o&&o.id===g.pillarId):null;
    let photoHtml=g.photoPath?`<div class="good-photo-thumb-wrap" data-photo-path="${esc(g.photoPath)}" onclick="event.stopPropagation(); previewGoodPhoto('${esc(g.photoPath)}')"><div class="good-photo-loading"></div><img class="good-photo-thumb" style="display:none;" alt="Foto del recuerdo"></div>`:'';
    let contentHtml=`<div class="good-card-row"><div class="good-card-text"><strong>${esc(g.text)}</strong>${p?`<small style="color:var(--wine); font-weight:600; margin-bottom:2px;">✦ ${esc(p.name)}</small>`:''}<small>${esc(g.meaning||'')}</small></div>${photoHtml}</div>`;
    return wrapSwipe(contentHtml, `deleteGood('${g.id}')`, 'good-card');
  }).join(''):'';
  loadPhotoThumbnails();
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

// ==========================================================================
// PWA & SERVICE WORKER UPDATES
// ==========================================================================
let newWorkerWaiting = null;
let refreshing = false;

function initPWAUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.waiting) {
        newWorkerWaiting = reg.waiting;
        showUpdateBanner();
      }

      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorkerWaiting = installingWorker;
            showUpdateBanner();
          }
        });
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });
    }).catch((err) => {
      console.warn('Registro Service Worker:', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function showUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) banner.style.display = 'flex';
}

function applyAppUpdate() {
  if (newWorkerWaiting) {
    newWorkerWaiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

initPWAUpdate();
