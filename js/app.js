const icons={
chat:`<svg class="icon" viewBox="0 0 24 24"><path d="M5 18l-1 3 4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3z"/></svg>`,
insta:`<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.4" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>`,
activity:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 13h3l2-6 4 11 2-6h5"/></svg>`,
search:`<svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/><path d="m7 7 7 7"/></svg>`
};


function showPage(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 document.querySelectorAll('.bottom button').forEach(b=>b.classList.remove('active'));
 let targetEl=document.getElementById(id);
 if(targetEl)targetEl.classList.add('active');
 let nav=document.getElementById('nav-'+id);if(nav)nav.classList.add('active');
 let bottomNav=document.querySelector('.bottom');
 if(bottomNav){bottomNav.style.display=id==='universe'?'none':'grid'}
 window.scrollTo({top:0,behavior:'smooth'});render()
}

function openSettings(sectionId){
  showPage('settings');
  if(sectionId){
    setTimeout(()=>{
      let el=document.getElementById(sectionId);
      if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    },80);
  }
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

    let todayKeyStr = (typeof dayKey === 'function') ? dayKey() : new Date().toISOString().split('T')[0];
    let memories=(d.goodThings||[]).filter(g=>g && g.pillarId===o.id && dayKey(g.ts)===todayKeyStr).slice(-3);
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

  // 5 Capítulos celestes del Atlas (un único libro continuo)
  const bookChapters = [
    { id: 'cielo-1', name: 'Primer cielo', roman: 'I', region: 'cielo-1', consts: ['lyra', 'cassiopeia', 'ursa-major'], desc: 'El firmamento visible a simple vista.' },
    { id: 'zodiaco', name: 'Zodiaco', roman: 'II', region: 'zodiaco', col: 'zodiaco', desc: 'Las doce constelaciones del cinturón solar.' },
    { id: 'norte', name: 'Cielo del norte', roman: 'III', region: 'cielo-1', consts: ['cygnus'], desc: 'Guías celestes del hemisferio septentrional.' },
    { id: 'invierno', name: 'Cielo de invierno', roman: 'IV', region: 'orion', col: 'invierno', desc: 'Estrellas brillantes de las noches frías.' },
    { id: 'profundo', name: 'Espacio profundo', roman: 'V', region: 'profundo', col: 'profundo', desc: 'Horizontes lejanos más allá de la galaxia.' }
  ];

  let regNames = {
    'cielo-1': 'Primer cielo',
    'zodiaco': 'Cinturón Zodiacal',
    'orion': 'Nebulosa de Orión',
    'profundo': 'Espacio profundo'
  };

  // Generación continua de todas las páginas del libro
  let allPagesHtml = '';
  let indexChipsHtml = '';

  bookChapters.forEach((ch) => {
    let isUnlocked = d.unlockedRegions && d.unlockedRegions.includes(ch.region);
    let chConsts = [];
    if (ch.consts) {
      chConsts = constellationDefs.filter(c => ch.consts.includes(c.id));
    } else if (ch.col) {
      chConsts = constellationDefs.filter(c => c.collection === ch.col);
    }
    let ownedInCh = isUnlocked ? chConsts.filter(c => d.claimed && d.claimed[c.id]).length : 0;

    indexChipsHtml += `<button class="atlas-chip" onclick="jumpToAtlasChapter('chapter-${ch.id}')">${ch.roman} · ${ch.name}${isUnlocked ? '' : ' 🔒'}</button>`;

    if (!isUnlocked) {
      // Tipo C: Portadilla de Capítulo Sellado (No genera páginas de constelaciones internas)
      let regName = regNames[ch.region] || ch.region;
      allPagesHtml += `
        <div class="atlas-page atlas-folio atlas-chapter-locked" id="chapter-${ch.id}">
          <div class="atlas-folio-inner atlas-chapter-locked-inner">
            <div class="atlas-folio-header">
              <span class="atlas-folio-chapter">CAPÍTULO ${ch.roman}</span>
              <span class="atlas-folio-num">SELLADO 🔒</span>
            </div>
            <div class="atlas-chapter-symbol">
              <div class="compass-ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:38px; height:38px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            </div>
            <div class="atlas-folio-body">
              <div class="atlas-chapter-title-tag">CAPÍTULO ${ch.roman}</div>
              <div class="atlas-chapter-name">${esc(ch.name.toUpperCase().split('').join(' '))}</div>
              <p class="atlas-folio-desc">Región aún no cartografiada.<br>Desbloquea la región <strong>${regName}</strong> desde la nave espacial para abrir este capítulo.</p>
            </div>
            <div class="atlas-folio-footer">
              <button class="btn btn-soft" style="font-size:10px; padding:6px 16px;" onclick="closeModal('constellationBookModal'); openShipModal(); setShipTab('regiones');">Ir a Exploración</button>
            </div>
          </div>
          <div class="atlas-fold-shade"></div>
        </div>
      `;
    } else {
      // Tipo A: Portadilla de Capítulo Abierto (Solemne y Ceremonial)
      allPagesHtml += `
        <div class="atlas-page atlas-folio atlas-chapter-cover" id="chapter-${ch.id}">
          <div class="atlas-folio-inner atlas-chapter-cover-inner">
            <div class="atlas-folio-header">
              <span class="atlas-folio-chapter">LIBRO I · FIRMAMENTO</span>
              <span class="atlas-folio-num">CAPÍTULO ${ch.roman}</span>
            </div>
            <div class="atlas-chapter-symbol">
              <div class="compass-ring">
                <span class="spark">✦</span>
              </div>
            </div>
            <div class="atlas-folio-body">
              <div class="atlas-chapter-title-tag">CAPÍTULO ${ch.roman}</div>
              <div class="atlas-chapter-name">${esc(ch.name.toUpperCase().split('').join(' '))}</div>
              <p class="atlas-chapter-desc">“${esc(ch.desc)}”</p>
            </div>
            <div class="atlas-folio-footer">
              <span class="atlas-status owned" style="margin:0;">✦ ${ownedInCh} de ${chConsts.length} descubiertas</span>
            </div>
          </div>
          <div class="atlas-fold-shade"></div>
        </div>
      `;

      // Tipo B: Páginas de Constelaciones de este capítulo
      chConsts.forEach((c, idx) => {
        let owned = d.claimed && d.claimed[c.id];
        let discovered = !owned && total >= c.need;
        let isTarget = !owned && !discovered && next && (next.id === c.id);
        
        let svgMarkup = '';
        let statusMarkup = '';
        let actionMarkup = '';
        let pageNum = String(idx + 1).padStart(2, '0') + ' / ' + String(chConsts.length).padStart(2, '0');

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
          let prevNeed = idx > 0 ? chConsts[idx - 1].need : 0;
          let pVal = Math.max(0, Math.min(1, (total - prevNeed) / (c.need - prevNeed)));
          svgMarkup = constellationSvg(c, false, pVal);
          statusMarkup = `<div class="atlas-status in-progress">En curso (${total.toFixed(1).replace('.', ',')} / ${c.need} ★)</div>`;
          actionMarkup = `<div class="atlas-req">Faltan ${(c.need - total).toFixed(1).replace('.', ',')} estrellas</div>`;
        } else {
          svgMarkup = constellationSvg(c, false, 0.0);
          statusMarkup = `<div class="atlas-status locked">Por descubrir</div>`;
          actionMarkup = `<div class="atlas-req">Requiere ${c.need} estrellas históricas</div>`;
        }

        let nameSpaced = c.name.toUpperCase().split('').join(' ');

        allPagesHtml += `
          <div class="atlas-page atlas-folio ${owned ? 'owned' : (discovered ? 'discovered' : (isTarget ? 'in-progress' : 'locked'))}">
            <div class="atlas-folio-inner atlas-constellation-folio-inner">
              <div class="atlas-folio-header">
                <span class="atlas-folio-chapter">${ch.roman} · ${esc(ch.name).toUpperCase()}</span>
                <span class="atlas-folio-num">FOLIO ${pageNum}</span>
              </div>
              
              <div class="atlas-sky-canvas">
                ${svgMarkup}
              </div>

              <div class="atlas-folio-body">
                <div class="atlas-folio-name">${esc(nameSpaced)}${c.extra === 'tu signo' ? '<span class="sign-tag" style="margin-left:8px; font-size:8.5px; vertical-align:middle; letter-spacing:normal;">tu signo</span>' : ''}</div>
                <p class="atlas-folio-desc">${esc(c.desc || 'Constelación del firmamento.')}</p>
              </div>

              <div class="atlas-folio-footer">
                <div class="atlas-folio-status-badge">${statusMarkup}</div>
                ${actionMarkup ? `<div class="atlas-folio-action">${actionMarkup}</div>` : ''}
              </div>
            </div>
            <div class="atlas-fold-shade"></div>
          </div>
        `;
      });
    }
  });

  constellationBook.innerHTML = `
    <div class="atlas-container">
      <div class="atlas-chapters">
        ${indexChipsHtml}
      </div>
      <div class="atlas-carousel">
        ${allPagesHtml}
      </div>
      <div class="atlas-swipe-hint">← Desliza para pasar de página y capítulo →</div>
    </div>
  `;

  let carousel = document.querySelector('.atlas-carousel');
  if (carousel) initAtlasPageTurn(carousel);
 
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
   { id: 'exterior', name: 'Cielo del norte / Exterior', cost: 7, desc: 'Estrellas lejanas en las afueras de la galaxia.' },
   { id: 'orion', name: 'Nebulosa de Orión', cost: 10, desc: 'Cuna de estrellas en el brazo de Orión.' },
   { id: 'profundo', name: 'Espacio profundo', cost: 15, desc: 'Galaxias externas y horizontes lejanos.' }
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

function guardarConstelacion(id, cost = 1){
  let d = load();
  let cDef = constellationDefs.find(x => x.id === id);
  let finalCost = cDef ? Number(cDef.cost || 1) : Number(cost || 1);
  if (Number(d.wallet || 0) < finalCost) {
    return toast('No tienes suficientes estrellas disponibles en tu cesta.');
  }
  d.wallet = Math.round((Number(d.wallet || 0) - finalCost) * 100) / 100;
  d.bank = d.wallet;
  if(!d.claimed) d.claimed = {};
  d.claimed[id] = Date.now();
  save(d);
  toast(`${cDef ? cDef.name : 'Constelación'} guardada en tu universo.`);
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


const reflectionPrompts = [
  ['¿Qué emoción ha estado más presente hoy?', 'Obsérvala sin juzgarla ni intentar cambiarla de inmediato.'],
  ['¿Qué límite has respetado o necesitas cuidar hoy?', 'Con los demás o en tus propias autoexigencias.'],
  ['¿Qué pequeña cosa has hecho hoy por tu bienestar?', 'Un respiro, descansar o comer algo rico también cuenta.'],
  ['¿A quién te alegra tener en tu vida hoy?', 'Recuerda un vínculo o gesto que te dé tranquilidad.'],
  ['¿Qué pensamiento duro puedes suavizar hoy?', 'Practica mirarte con un poco más de compasión.'],
  ['¿Qué parte de tu energía quieres reservar solo para ti?', 'No todo requiere tu respuesta inmediata.'],
  ['¿Qué aprendizaje te deja lo vivido hoy?', 'Incluso en los días difíciles hay pequeñas certezas.'],
  ['¿Qué te gustaría recordar de la persona que eres hoy?', 'Desde la calma y el proceso que estás construyendo.']
];

function getStoredReflectionIndex(){
  let idx = localStorage.getItem('orbitReflectionIndex');
  if(idx === null || isNaN(Number(idx))) {
    let dayNum = new Date().getDate();
    idx = dayNum % reflectionPrompts.length;
    localStorage.setItem('orbitReflectionIndex', String(idx));
  }
  return Number(idx) % reflectionPrompts.length;
}

function nextReflectionPrompt(){
  let curr = getStoredReflectionIndex();
  let next = (curr + 1) % reflectionPrompts.length;
  localStorage.setItem('orbitReflectionIndex', String(next));
  renderReflectionPrompt();
}

function renderReflectionPrompt(){
  let tEl = document.getElementById('reflectionPromptTitle');
  let sEl = document.getElementById('reflectionPromptSub');
  if(!tEl || !sEl) return;
  let idx = getStoredReflectionIndex();
  let p = reflectionPrompts[idx] || reflectionPrompts[0];
  tEl.textContent = p[0];
  sEl.textContent = p[1];
}

function render(){
  let d=accrue(),now=Date.now(),p=(typeof prompts!=='undefined'&&prompts.length)?prompts[new Date().getDate()%prompts.length]:['Hoy',''];
  if(typeof todayDate!=='undefined'&&todayDate) todayDate.textContent=new Date().toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
  let dpTitle=document.getElementById('dailyPromptTitle'), dpSub=document.getElementById('dailyPromptSub');
  if(dpTitle) dpTitle.textContent=p[0];
  if(dpSub) dpSub.textContent=p[1];
  renderReflectionPrompt();
  let c=d.checkins[dayKey()];
  if(c){
    if(typeof needToday!=='undefined'&&needToday) needToday.value=c.need||'';
    if(typeof forMeToday!=='undefined'&&forMeToday) forMeToday.value=c.forMe||'';
    mood=c.mood||5;
    document.querySelectorAll('#moodScale button').forEach((b,i)=>b.classList.toggle('sel',i+1===mood));
  }
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
  renderShopBoosters(d);
  renderActiveBoosterBadge(d);
  renderFocusAreas(d);
  renderProfile(d);
  renderArchive();
  renderUniverse(d);
}

function buyStellarWindow(){
  let d=load();
  if(!d.boosters)d.boosters={active:[],inventory:[],progress:{}};
  cleanExpiredBoosters(d);
  let isWindowActive=(d.boosters.active||[]).some(b=>b&&b.id==='stellar-window');
  if(isWindowActive){
    return toast('Ya tienes una Ventana Estelar activa.');
  }
  if(Number(d.wallet||0)<2){
    return toast('Necesitas 2 estrellas disponibles en tu cesta.');
  }
  if(!confirm('¿Activar Ventana Estelar por 2 estrellas?\n\nMultiplicador x1.5 en acciones de esfuerzo (impulsos y rachas) durante 2 horas. Máximo +2.0 ★ extra.')){
    return;
  }
  d.wallet=Math.round((Number(d.wallet||0)-2)*100)/100;
  d.bank=d.wallet;
  if(!Array.isArray(d.boosters.active))d.boosters.active=[];
  d.boosters.active.push({
    id:'stellar-window',
    name:'Ventana Estelar',
    multiplier:1.5,
    startedAt:Date.now(),
    expiresAt:Date.now()+2*HOUR,
    maxExtraStars:2.0,
    extraStarsGenerated:0.0,
    scope:['impulso','racha']
  });
  save(d);
  toast('✦ ¡Ventana Estelar activada! (x1.5 durante 2 h)');
  render();
}

function renderShopBoosters(d){
  let container=document.getElementById('shopBoostersList');
  if(!container)return;
  cleanExpiredBoosters(d);
  
  let now=Date.now();
  let activeWindow=(d.boosters?.active||[]).find(b=>b&&b.id==='stellar-window');
  let activeNight=(d.boosters?.active||[]).find(b=>b&&b.id==='constancy-night');
  let braveUrge=(d.boosters?.inventory||[]).find(b=>b&&b.id==='brave-urge'&&b.usesRemaining>0);
  let survivedCount=d.boosters?.progress?.survivedUrgesCount||0;
  let nextBraveProgress=survivedCount%3;
  let wallet=Number(d.wallet||0);
  
  let html='';
  
  // 1. Ventana Estelar
  let windowStatus='';
  if(activeWindow){
    let remMin=Math.max(1,Math.ceil(((activeWindow.expiresAt||now)-now)/60000));
    let remStr=remMin>=60?`${Math.floor(remMin/60)}h ${remMin%60}m`:`${remMin} min`;
    windowStatus=`<button class="btn btn-line btn-sm" disabled style="font-size:10px; opacity:0.85; color:var(--wine);">Activa · ${remStr}</button>`;
  }else{
    windowStatus=`<button class="btn ${wallet>=2?'btn-main':'btn-soft'} btn-sm" ${wallet>=2?'':'disabled'} onclick="buyStellarWindow()" style="font-size:10px;">${wallet>=2?'Activar · 2 ★':'2 ★'}</button>`;
  }
  
  html+=`
    <div class="card booster-card" style="padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid ${activeWindow?'var(--rose2)':'var(--line)'}; background: ${activeWindow?'var(--soft)':'#fffdfb'};">
      <div style="text-align:left; flex:1; padding-right:10px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <strong style="font-size:12.5px; color:var(--ink);">Ventana Estelar</strong>
          <span class="badge" style="font-size:9px; background:rgba(180,120,160,0.15); color:var(--wine); padding:2px 6px; border-radius:6px; font-weight:700;">x1.5 · 2 h</span>
        </div>
        <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0;">x1.5 en impulsos y racha. Máx +2 ★ extra.</p>
      </div>
      <div>${windowStatus}</div>
    </div>
  `;
  
  // 2. Impulso Valiente
  if(braveUrge){
    html+=`
      <div class="card booster-card" style="padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--rose2); background: var(--soft);">
        <div style="text-align:left; flex:1;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="font-size:12.5px; color:var(--wine);">✦ Impulso Valiente</strong>
            <span class="badge" style="font-size:9px; background:var(--wine); color:#fff; padding:2px 6px; border-radius:6px; font-weight:700;">x2 en próx. impulso</span>
          </div>
          <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0;">Disponible en inventario. Se aplicará al próximo temporizador superado.</p>
        </div>
      </div>
    `;
  }else{
    html+=`
      <div class="card booster-card" style="padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border: 1px dashed var(--line); opacity:0.85;">
        <div style="text-align:left; flex:1;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="font-size:11.5px; color:var(--ink);">Impulso Valiente (x2)</strong>
            <span style="font-size:9.5px; color:var(--muted); font-weight:600;">${nextBraveProgress} / 3 superados</span>
          </div>
          <p style="font-size:10px; color:var(--muted); margin:2px 0 0 0;">Se gana cada 3 impulsos con temporizador superados.</p>
        </div>
      </div>
    `;
  }
  
  // 3. Noche de Constancia
  if(activeNight){
    let remMin=Math.max(1,Math.ceil(((activeNight.expiresAt||now)-now)/60000));
    let remStr=remMin>=60?`${Math.floor(remMin/60)}h ${remMin%60}m`:`${remMin} min`;
    html+=`
      <div class="card booster-card" style="padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--rose2); background: var(--soft);">
        <div style="text-align:left; flex:1;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="font-size:12.5px; color:var(--wine);">✦ Noche de Constancia</strong>
            <span class="badge" style="font-size:9px; background:var(--wine); color:#fff; padding:2px 6px; border-radius:6px; font-weight:700;">x1.5 · ${remStr}</span>
          </div>
          <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0;">Activo por alcanzar 7 días de racha. Máx +3 ★ extra.</p>
        </div>
      </div>
    `;
  }
  
  container.innerHTML=html;
}

function renderActiveBoosterBadge(d){
  let el=document.getElementById('activeBoosterBadge');
  if(!el)return;
  cleanExpiredBoosters(d);
  let now=Date.now();
  let activeList=d.boosters?.active||[];
  let inventoryList=d.boosters?.inventory||[];
  
  let label='';
  if(activeList.length){
    let top=activeList[0];
    let remMin=Math.max(1,Math.ceil(((top.expiresAt||now)-now)/60000));
    let remStr=remMin>=60?`${Math.floor(remMin/60)}h ${remMin%60}m`:`${remMin}m`;
    label=`✦ x${top.multiplier} · ${remStr}`;
  }else if(inventoryList.some(b=>b&&b.id==='brave-urge'&&b.usesRemaining>0)){
    label=`✦ x2 próx. impulso`;
  }
  
  if(label){
    el.style.display='inline-flex';
    el.innerHTML=`<span class="active-booster-chip">${esc(label)}</span>`;
  }else{
    el.style.display='none';
  }
}

function renderFocusAreas(d){
  let container=document.getElementById('focusAreasList');
  if(!container)return;
  if(!d)d=load();
  
  if(typeof orbitTemplates==='undefined'){
    container.innerHTML='<div class="empty" style="padding:10px; font-size:12px;">No se encontraron plantillas.</div>';
    return;
  }
  
  let activeIds=(d.focusAreas||[]).filter(a=>a&&a.status==='active').map(a=>a.id);
  
  let html=Object.keys(orbitTemplates).map(key=>{
    let t=orbitTemplates[key];
    let isActive=activeIds.includes(key);
    
    return `
      <div class="card" style="margin-bottom:8px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid ${isActive?'var(--rose2, #e8c8cf)':'var(--line, #efe8e9)'}; background:${isActive?'rgba(235, 210, 220, 0.14)':'#fffdfb'}; border-radius:14px;">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
            <strong style="font-size:13px; color:var(--text, #332d30);">${esc(t.name||key)}</strong>
            ${isActive?'<span style="font-size:10px; font-weight:700; color:#2e7d32; background:rgba(46,125,50,0.1); border:1px solid rgba(46,125,50,0.25); padding:2px 7px; border-radius:99px;">● Activa</span>':'<span style="font-size:10px; font-weight:600; color:var(--muted, #8b7d82); background:var(--soft, #f7f1f2); padding:2px 7px; border-radius:99px;">Disponible</span>'}
          </div>
          <div style="font-size:11px; color:var(--muted, #8b7d82); line-height:1.35;">${esc(t.home?.title||t.home?.subtitle||'')}</div>
        </div>
        <div>
          ${isActive?'<span style="font-size:11px; color:var(--muted, #8b7d82); font-weight:600;">En curso</span>':`<button class="btn btn-line btn-sm" style="font-size:11px; padding:6px 12px; font-weight:600;" onclick="activateFocusArea('${esc(key)}')">Activar</button>`}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML=html;
}

function activateFocusArea(areaId){
  if(!areaId)return;
  let d=load();
  if(!Array.isArray(d.focusAreas))d.focusAreas=[];
  
  let existing=d.focusAreas.find(a=>a&&a.id===areaId);
  if(existing){
    if(existing.status==='active'){
      toast('Esta área ya está activa');
      return;
    }
    existing.status='active';
    existing.archivedAt=null;
  }else{
    d.focusAreas.push({
      id:areaId,
      status:'active',
      startedAt:Date.now(),
      archivedAt:null
    });
  }
  
  save(d);
  let name=(typeof orbitTemplates!=='undefined'&&orbitTemplates[areaId]?.name)||areaId;
  toast(`Área activada: ${name}`);
  render();
}

function getProfileBirthInfo(birthDateStr){
  if(!birthDateStr) return null;
  let parts=birthDateStr.split('-');
  if(parts.length!==3) return null;
  let y=parseInt(parts[0],10), m=parseInt(parts[1],10)-1, day=parseInt(parts[2],10);
  if(isNaN(y)||isNaN(m)||isNaN(day)) return null;
  let now=new Date();
  let age = now.getFullYear() - y;
  let hasHadBirthdayThisYear = (now.getMonth() > m) || (now.getMonth() === m && now.getDate() >= day);
  if(!hasHadBirthdayThisYear) age--;
  let isToday = (now.getMonth() === m && now.getDate() === day);
  
  let nextBday = new Date(now.getFullYear(), m, day);
  let todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(nextBday < todayZero) {
    nextBday = new Date(now.getFullYear()+1, m, day);
  }
  let diffMs = nextBday - todayZero;
  let daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  return { age, isToday, daysUntil };
}

function renderProfile(d){
  if(!d) d=load();
  let dn=document.getElementById('profileDisplayName');
  let un=document.getElementById('profileUsername');
  let bd=document.getElementById('profileBirthDate');
  if(dn && document.activeElement !== dn) dn.value = d.profile?.displayName || '';
  if(un && document.activeElement !== un) un.value = d.profile?.username || '';
  if(bd && document.activeElement !== bd) bd.value = d.profile?.birthDate || '';

  let birthInfo = getProfileBirthInfo(d.profile?.birthDate);

  // Recompensa automática de cumpleaños (+25 estrellas una vez por año)
  if(birthInfo && birthInfo.isToday){
    let currentYear = new Date().getFullYear();
    if(d.profile.birthdayStarsClaimedYear !== currentYear){
      d.profile.birthdayStarsClaimedYear = currentYear;
      addPoints(d, 25, 'cumpleanos', 'Regalo de Cumpleaños 🌟', 'birthday-' + currentYear);
      save(d);
      toast('🎂 ¡Feliz Cumpleaños! Orbit te regala 25 estrellas 🌟');
      let bankEl=document.getElementById('bank'), shopWalletEl=document.getElementById('shopWallet');
      if(bankEl) bankEl.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');
      if(shopWalletEl) shopWalletEl.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');
    }
  }

  // Tarjeta de perfil en ajustes
  let sumCard=document.getElementById('profileSummaryCard');
  if(sumCard){
    let name=d.profile?.displayName || '';
    let uname=d.profile?.username || '';
    if(name || uname || birthInfo){
      sumCard.style.display='block';
      let initial = (name ? name.charAt(0) : (uname ? uname.replace('@','').charAt(0) : '✦')).toUpperCase();
      let ageText = '';
      if(birthInfo){
        if(birthInfo.isToday){
          ageText = `<div style="font-size:11px; color:var(--wine); font-weight:700; margin-top:4px;">🎂 ${birthInfo.age} años · ¡Hoy es tu cumpleaños! (+25 ★ regalo)</div>`;
        } else {
          let bdayLabel = birthInfo.daysUntil === 1 ? 'mañana' : `en ${birthInfo.daysUntil} días`;
          ageText = `<div style="font-size:11px; color:var(--muted); margin-top:4px;">🎂 ${birthInfo.age} años · Próximo cumple ${bdayLabel}</div>`;
        }
      }
      sumCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:46px; height:46px; border-radius:50%; background:linear-gradient(135deg,#f0cfd4,#aa5966); color:white; display:grid; place-items:center; font-family:Georgia,serif; font-size:20px; font-weight:600; flex-shrink:0; box-shadow:0 4px 12px rgba(141,76,87,0.2);">
            ${esc(initial)}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-family:Georgia,serif; font-size:17px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${esc(name || 'Mi Perfil Orbit')}
            </div>
            ${uname ? `<div style="font-size:12px; color:var(--wine); font-weight:600;">@${esc(uname.replace(/^@/,''))}</div>` : ''}
            ${ageText}
          </div>
        </div>
      `;
    } else {
      sumCard.style.display='none';
    }
  }

  // Personalización del saludo en la pantalla de inicio (Today)
  let kickerEl=document.getElementById('todayHeroKicker');
  let titleEl=document.getElementById('todayHeroTitle');
  let bdayBanner=document.getElementById('birthdayHeroBanner');
  
  if(kickerEl && titleEl){
    let name=d.profile?.displayName;
    if(name){
      kickerEl.textContent = 'HOY · ' + name.toUpperCase();
      if(birthInfo && birthInfo.isToday){
        titleEl.textContent = '¡Feliz cumpleaños, ' + name + '! ✨';
      } else {
        titleEl.textContent = 'Hola, ' + name;
      }
    } else {
      let tName = (typeof orbitTemplates!=='undefined' && orbitTemplates[d.templateId]?.home?.title) || 'Un lugar para volver a ti';
      kickerEl.textContent = 'HOY';
      titleEl.textContent = tName;
    }
  }

  if(bdayBanner){
    if(birthInfo && birthInfo.isToday){
      bdayBanner.style.display='block';
      let name=d.profile?.displayName || 'viajero';
      bdayBanner.innerHTML=`
        <div style="font-size:18px; margin-bottom:4px;">🎂 ✨ 🌟</div>
        <strong style="font-size:14px; color:var(--wine);">¡Feliz Cumpleaños, ${esc(name)}!</strong>
        <p style="font-size:12px; color:var(--ink); margin:6px 0 0; line-height:1.45;">Orbit celebra tu día especial. Tienes un regalo de <strong>+25 estrellas</strong> en tu cesta estelar para iluminar tu universo.</p>
      `;
    } else {
      bdayBanner.style.display='none';
    }
  }
}

function saveProfile(){
  let d=load();
  let dn=document.getElementById('profileDisplayName');
  let un=document.getElementById('profileUsername');
  let bd=document.getElementById('profileBirthDate');
  if(!d.profile) d.profile={};
  d.profile.displayName = dn ? dn.value.trim() : '';
  d.profile.username = un ? un.value.trim() : '';
  d.profile.birthDate = (bd && bd.value) ? bd.value : null;
  save(d);
  toast('Perfil guardado');
  renderProfile(d);
  render();
}

setInterval(render,60000);render();

function initAtlasPageTurn(carouselEl) {
  if (!carouselEl) return;
  
  function update3DPageTurns() {
    let pages = carouselEl.querySelectorAll('.atlas-page.atlas-folio');
    if (!pages.length) return;
    let carouselRect = carouselEl.getBoundingClientRect();
    let carouselCenter = carouselRect.left + carouselRect.width / 2;
    let width = carouselRect.width || 360;
    
    pages.forEach((page) => {
      let pageRect = page.getBoundingClientRect();
      let pageCenter = pageRect.left + pageRect.width / 2;
      let diff = (pageCenter - carouselCenter) / width;
      let clamped = Math.max(-1, Math.min(1, diff));
      
      let isPassingNext = clamped < 0;
      let p = Math.abs(clamped);
      
      if (isPassingNext) {
        // Curvatura temprana y suave (desde 5-8% de progreso)
        // Elevación armónica de la esquina inferior derecha
        let rotY = clamped * -20.0;
        let rotZ = -p * 3.0;
        let transZ = -p * 16.0;
        let transX = -p * 12.0;
        
        page.style.transformOrigin = 'left 78%';
        page.style.transform = `perspective(1200px) translateX(${transX.toFixed(1)}px) translateZ(${transZ.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg)`;
        
        // Sombra suave en el pliegue
        let foldShade = page.querySelector('.atlas-fold-shade');
        if (foldShade) {
          let shadeOpacity = Math.min(1, p * 1.35);
          foldShade.style.opacity = shadeOpacity.toFixed(2);
        }
        page.style.opacity = '1';
      } else {
        // Página siguiente que asoma progresivamente debajo sin saltos
        if (p < 0.95 && p > 0.05) {
          let scale = 0.985 + (1 - p) * 0.015;
          let op = 0.75 + (1 - p) * 0.25;
          page.style.transform = `perspective(1200px) scale(${scale.toFixed(3)})`;
          page.style.opacity = op.toFixed(2);
        } else if (p <= 0.05) {
          page.style.transform = '';
          page.style.opacity = '1';
        } else {
          page.style.transform = '';
          page.style.opacity = '0.75';
        }
        
        let foldShade = page.querySelector('.atlas-fold-shade');
        if (foldShade) foldShade.style.opacity = '0';
      }
    });
  }

  if (carouselEl._atlasScrollHandler) {
    carouselEl.removeEventListener('scroll', carouselEl._atlasScrollHandler);
  }
  carouselEl._atlasScrollHandler = () => {
    requestAnimationFrame(update3DPageTurns);
  };
  carouselEl.addEventListener('scroll', carouselEl._atlasScrollHandler, { passive: true });
  requestAnimationFrame(update3DPageTurns);
}

function jumpToAtlasChapter(targetId) {
  let el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function openShopModal(){document.getElementById('shopModal').classList.add('show')}
function openInfoModal(){document.getElementById('infoModal').classList.add('show')}
function openShipModal(){document.getElementById('shipModal').classList.add('show')}
function openUniverseDetailsModal(){document.getElementById('universeDetailsModal').classList.add('show')}
function openConstellationBookModal(){
  document.getElementById('constellationBookModal').classList.add('show');
  setTimeout(() => {
    let carousel = document.querySelector('.atlas-carousel');
    if (carousel) initAtlasPageTurn(carousel);
  }, 60);
}

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
