const icons={
chat:`<svg class="icon" viewBox="0 0 24 24"><path d="M5 18l-1 3 4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3z"/></svg>`,
insta:`<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.4" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>`,
activity:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 13h3l2-6 4 11 2-6h5"/></svg>`,
search:`<svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/><path d="m7 7 7 7"/></svg>`,
lock:`<svg class="icon" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
pencil:`<svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
close:`<svg class="icon" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
check:`<svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
back:`<svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
plus:`<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
trash:`<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
refresh:`<svg class="icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`
};


let currentActivePage = 'today';
let lastActivePage = 'today';

function showPage(id){
  if (currentActivePage === 'observatory' && id !== 'observatory') {
    if (typeof window.pauseObservatory3D === 'function') window.pauseObservatory3D();
  }

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.bottom button').forEach(b=>b.classList.remove('active'));
  let targetEl=document.getElementById(id);
  if(targetEl)targetEl.classList.add('active');
  let nav=document.getElementById('nav-'+id);if(nav)nav.classList.add('active');
  let bottomNav=document.querySelector('.bottom');
  if(bottomNav){bottomNav.style.display=(id==='universe'||id==='settings'||id==='observatory')?'none':'grid'}
  if(id !== 'settings' && id !== 'universe' && id !== 'observatory') lastActivePage = id;
  currentActivePage = id;
  window.scrollTo({top:0,behavior:'smooth'});
  render();

  if (id === 'observatory') {
    setTimeout(() => {
      if (typeof window.initObservatory3D === 'function') {
        window.initObservatory3D();
      }
      selectObservatoryModule(window.activeObservatoryModuleId || 'telescope');
    }, 60);
  }
}

function closeSettings(){
  showPage(lastActivePage || 'today');
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
function deleteReward(id){let d=load();d.rewards=d.rewards.filter(r=>r.id!==id);save(d);toast('Premio eliminado');render()}
function redeem(id){let d=load(),r=d.rewards.find(x=>x.id===id);if(r&&Number(d.wallet||0)>=r.cost){d.wallet=Number(d.wallet||0)-r.cost;d.bank=d.wallet;save(d);toast(`✦ Premio canjeado: ${r.name}`);render()}}
function openModal(id){let el=document.getElementById(id);if(el){el.classList.add('show');el.classList.add('active');}}
function closeModal(id){
  let el=document.getElementById(id);
  if(el){
    el.classList.remove('show');
    el.classList.remove('active');
    if(id === 'observatoryModal' && typeof window.pauseObservatory3D === 'function'){
      window.pauseObservatory3D();
    }
  }
}
function closeTopModal(){let openModals=document.querySelectorAll('.modal.show, .ceremony-modal.active');if(openModals.length>0){let top=openModals[openModals.length-1];top.classList.remove('show');top.classList.remove('active');}}
function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>t.classList.remove('show'),1900)}

// Global listeners para cerrar modales pulsando fuera o con Esc
document.addEventListener('click', (e) => {
  if(e.target && e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('show')){
    closeModal(e.target.id);
  }
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    closeTopModal();
  }
});

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
  let cDef = (typeof ConstellationUtils !== 'undefined' && ConstellationUtils.normalizeConstellation)
    ? ConstellationUtils.normalizeConstellation(def)
    : def;
  
  let pts = cDef.pts || (cDef.stars ? cDef.stars.map(s => [s.x, s.y]) : []);
  let edges = cDef.edges || [];
  let N = pts.length;
  let pVal = unlocked ? 1 : Math.max(0, Math.min(1, Number(progress) || 0));
  
  // Progresión estrella por estrella: cada estrella ganada activa un nodo y sus conexiones
  let totalNeed = cDef.need || N;
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

  let lines = edges.map(([a, b]) => {
    let active = a < achieved && b < achieved;
    let cls = active ? ('line' + (isRefined ? ' refined-line' : '')) : 'ghost-line';
    if (!pts[a] || !pts[b]) return '';
    return `<line class="${cls}" x1="${pts[a][0]}%" y1="${pts[a][1]}%" x2="${pts[b][0]}%" y2="${pts[b][1]}%"/>`;
  }).join('');
  
  let stars = pts.map((p, i) => {
    let cls = 'ghost-star';
    let isMain = (cDef.id === 'lyra' && i === 0);
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
const skyRegionsList = [
  { id: 'cielo-1', name: 'Primer cielo', col: 'norte', roman: 'I' },
  { id: 'zodiaco', name: 'Zodiaco', col: 'zodiaco', roman: 'II' },
  { id: 'orion', name: 'Cielo de invierno', col: 'invierno', roman: 'III' },
  { id: 'profundo', name: 'Espacio profundo', col: 'profundo', roman: 'IV' }
];

let currentSkyIndex = 0;
let skyTouchStartX = 0;
let skyTouchStartY = 0;
let isSkySwiping = false;

function initSkySwipe(){
  let sky = document.getElementById('universe');
  if(!sky || sky._hasSwipeListener) return;
  sky._hasSwipeListener = true;
  
  sky.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1){
      skyTouchStartX = e.touches[0].clientX;
      skyTouchStartY = e.touches[0].clientY;
      isSkySwiping = true;
    }
  }, { passive: true });

  sky.addEventListener('touchend', (e) => {
    if(!isSkySwiping) return;
    isSkySwiping = false;
    let endX = e.changedTouches[0].clientX;
    let endY = e.changedTouches[0].clientY;
    let dx = endX - skyTouchStartX;
    let dy = endY - skyTouchStartY;
    
    if(Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2){
      if(dx < 0) navigateSky(1);
      else navigateSky(-1);
    }
  }, { passive: true });

  sky.addEventListener('wheel', (e) => {
    if(Math.abs(e.deltaX) > 35){
      if(e.deltaX > 0) navigateSky(1);
      else navigateSky(-1);
    }
  }, { passive: true });
}

let currentSkyId = 'cielo-1';

function setSkyById(regionId){
  let d = (typeof load === 'function') ? load() : null;
  if(!d) return;
  
  currentSkyId = regionId;
  
  let stage = document.getElementById('constellationStage');
  if(stage){
    stage.classList.add('sky-fade');
    setTimeout(() => {
      renderUniverse(d);
      stage.classList.remove('sky-fade');
    }, 150);
  } else {
    renderUniverse(d);
  }
}

function navigateSky(dir){
  let d = (typeof load === 'function') ? load() : null;
  if(!d) return;
  
  let currentIndex = skyRegionsList.findIndex(r => r.id === currentSkyId);
  if(currentIndex === -1) currentIndex = 0;
  let nextIdx = (currentIndex + dir + skyRegionsList.length) % skyRegionsList.length;
  setSkyById(skyRegionsList[nextIdx].id);
}

function renderUniverse(d){
  initSkySwipe();
  let total=Number(d.lifetimeStars||0),wallet=Number(d.wallet||0);
  if(typeof universeWallet!=='undefined'&&universeWallet) universeWallet.textContent=wallet.toFixed(1).replace('.',',');
  if(typeof universeLifetime!=='undefined'&&universeLifetime) universeLifetime.textContent=total.toFixed(1).replace('.',',');
  
  let currentRegion = skyRegionsList.find(r => r.id === currentSkyId) || skyRegionsList[0];
  let isSkyUnlocked = (d.unlockedRegions && d.unlockedRegions.includes(currentRegion.id)) || (currentRegion.id === 'cielo-1');

  // Update top active sky title
  let titleEl = document.getElementById('skyHeaderTitle');
  if(titleEl) {
    titleEl.innerHTML = isSkyUnlocked ? `${esc(currentRegion.name)} · ${esc(currentRegion.roman)}` : `<span style="display:inline-flex; align-items:center; gap:5px;">${esc(currentRegion.name)} · ${esc(currentRegion.roman)} <svg class="icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke:currentColor;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`;
  }

  // Determine overall in-progress constellation across unlocked regions
  let unlockedSkies = skyRegionsList.filter(r => (d.unlockedRegions && d.unlockedRegions.includes(r.id)) || r.id === 'cielo-1');
  let allUnlockedCols = unlockedSkies.map(r => r.col);
  let allAvailable = constellationDefs.filter(c => allUnlockedCols.includes(c.collection));
  allAvailable.sort((a, b) => a.need - b.need);
  let next = allAvailable.find(c => total < c.need);

  // Filter constellations strictly for current region
  let regionConsts = constellationDefs.filter(c => c.collection === currentRegion.col);
  regionConsts.sort((a, b) => a.need - b.need);

  let vw = window.innerWidth || document.documentElement.clientWidth || 360;
  let vh = window.innerHeight || document.documentElement.clientHeight || 640;

  if (typeof constellationStage !== 'undefined' && constellationStage) {
    constellationStage.style.display = 'block';
    constellationStage.style.width = '100%';
    constellationStage.style.height = '100%';
    constellationStage.style.left = '0';
    constellationStage.style.top = '0';
    constellationStage.style.transform = 'none';

    let skyHtml = '';
    regionConsts.forEach((c) => {
      let isClaimed = isSkyUnlocked && !!(d.claimed && d.claimed[c.id]);
      let isNext = isSkyUnlocked && (next && next.id === c.id);
      let isDiscovered = isSkyUnlocked && (!isClaimed && total >= c.need);
      
      let baseSize = c.size || 125;
      let size = Math.round(Math.max(100, Math.min(vw * 0.38, (vh - 140) * 0.28, baseSize, 160)));
      
      let progress = 0;
      let unlocked = false;
      let stateClass = '';

      if (!isSkyUnlocked) {
        unlocked = false;
        progress = 0.0;
        stateClass = 'locked sky-locked-layer';
      } else if (isClaimed) {
        unlocked = true;
        progress = 1.0;
        stateClass = 'claimed illuminated';
      } else if (isDiscovered) {
        unlocked = false;
        progress = 1.0;
        stateClass = 'discovered';
      } else if (isNext) {
        let idx = allAvailable.indexOf(c);
        let prevNeed = idx > 0 ? allAvailable[idx - 1].need : 0;
        progress = Math.max(0, Math.min(1, (total - prevNeed) / (c.need - prevNeed)));
        unlocked = false;
        stateClass = 'in-progress';
      } else {
        unlocked = false;
        progress = 0.0;
        stateClass = 'locked';
      }

      let svgMarkup = constellationSvg(c, unlocked, progress);
      let clickAttr = isSkyUnlocked ? `onclick="verFichaConstelacion('${c.id}')"` : '';
      let statusHint = !isSkyUnlocked ? ' (Bloqueada)' : (isClaimed ? ' (Iluminada)' : (isNext ? ' (En curso)' : (isDiscovered ? ' (Descubierta)' : ' (Por descubrir)')));
      
      skyHtml += `
        <div class="sky-constellation-item ${stateClass}" style="left:${c.x || 50}%; top:${c.y || 35}%;" ${clickAttr} title="${esc(c.name)}${statusHint}">
          <div class="sky-constellation-box" style="width:${size}px; height:${size}px; transform: rotate(${c.rot || 0}deg);">
            ${svgMarkup}
          </div>
          <div class="sky-constellation-name">${esc(c.name)}${isClaimed ? ' ✦' : ''}</div>
        </div>
      `;
    });

    if (!isSkyUnlocked) {
      skyHtml += `
        <div class="sky-locked-overlay">
          <div class="sky-locked-seal">
            <div class="sky-locked-compass">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:32px; height:32px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div class="sky-locked-title">Cielo sellado</div>
            <p class="sky-locked-desc">Esta región del firmamento aún no ha sido cartografiada.<br>Desbloquéala en el <strong>Observatorio Terrestre</strong>.</p>
            <button class="btn btn-soft btn-sm" style="font-size:10px; padding:6px 16px; border-radius:99px; margin-top:4px;" onclick="openObservatoryModal(); setObservatoryTab('regiones');">Ir a Exploración</button>
          </div>
        </div>
      `;
    }

    constellationStage.innerHTML = skyHtml;
  }

  // Modal de progreso y detalles del universo
  let detailsStage = document.getElementById('universeDetailsStage');
  let captionDetails = document.getElementById('constellationDetailsCaption');
  
  if (next) {
    let idx = allAvailable.indexOf(next);
    let prevNeed = idx > 0 ? allAvailable[idx - 1].need : 0;
    let nextProgress = Math.max(0, Math.min(1, (total - prevNeed) / (next.need - prevNeed)));
    
    if (typeof constellationProgressText !== 'undefined' && constellationProgressText) {
      constellationProgressText.textContent = `${total.toFixed(1).replace('.', ',')} / ${next.need} estrellas`;
    }
    if (detailsStage) {
      detailsStage.innerHTML = constellationSvg(next, false, nextProgress);
    }
    if (captionDetails) {
      captionDetails.innerHTML = `<div class="constellation-caption" style="position:static;color:#fff;padding:0;"><strong style="font-size:15px;color:var(--rose2);">${'Dibujando ' + next.name}</strong><br><small style="color:rgba(255,255,255,0.6);font-size:12px;">Faltan ${(next.need - total).toFixed(1).replace('.', ',')} estrellas: ${next.desc}</small></div>`;
    }
  } else {
    if (typeof constellationProgressText !== 'undefined' && constellationProgressText) {
      constellationProgressText.textContent = 'Has cartografiado todo lo accesible en tus regiones desbloqueadas.';
    }
    if (detailsStage) {
      let lastConst = allAvailable.length ? allAvailable[allAvailable.length - 1] : null;
      detailsStage.innerHTML = lastConst ? constellationSvg(lastConst, true, 1.0) : '<div class="empty" style="padding:40px;color:rgba(255,255,255,0.4);text-align:center;font-size:12px;">Todo cartografiado</div>';
    }
    if (captionDetails) {
      captionDetails.innerHTML = `<div class="constellation-caption" style="position:static;color:#fff;padding:0;"><strong style="font-size:14px;color:var(--rose2);">Cielo completado</strong><br><small style="color:rgba(255,255,255,0.5);font-size:11px;">Todas las constelaciones de tus regiones brillan en tu firmamento.</small></div>`;
    }
  }

  // 4 Capítulos celestes del Atlas (unificados con las 4 regiones celestes)
  const bookChapters = [
    { id: 'cielo-1', name: 'Primer cielo', roman: 'I', region: 'cielo-1', col: 'norte', desc: 'El firmamento visible a simple vista.' },
    { id: 'zodiaco', name: 'Zodiaco', roman: 'II', region: 'zodiaco', col: 'zodiaco', desc: 'Las doce constelaciones del cinturón solar.' },
    { id: 'orion', name: 'Cielo de invierno', roman: 'III', region: 'orion', col: 'invierno', desc: 'Estrellas brillantes de las noches frías.' },
    { id: 'profundo', name: 'Espacio profundo', roman: 'IV', region: 'profundo', col: 'profundo', desc: 'Horizontes lejanos más allá de la galaxia.' }
  ];

  let regNames = {
    'cielo-1': 'Primer cielo',
    'zodiaco': 'Zodiaco',
    'orion': 'Cielo de invierno',
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

    indexChipsHtml += `<button class="atlas-chip" onclick="jumpToAtlasChapter('chapter-${ch.id}')" style="display:inline-flex; align-items:center; gap:4px;">${ch.roman} · ${ch.name}${isUnlocked ? '' : '<svg class="icon" viewBox="0 0 24 24" style="width:11px; height:11px; stroke:currentColor;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'}</button>`;

    if (!isUnlocked) {
      // Tipo C: Portadilla de Capítulo Sellado (No genera páginas de constelaciones internas)
      let regName = regNames[ch.region] || ch.region;
      allPagesHtml += `
        <div class="atlas-page atlas-folio atlas-chapter-locked" id="chapter-${ch.id}">
          <div class="atlas-folio-inner atlas-chapter-locked-inner">
            <div class="atlas-folio-header">
              <span class="atlas-folio-chapter">CAPÍTULO ${ch.roman}</span>
              <span class="atlas-folio-num" style="display:inline-flex; align-items:center; gap:4px;">SELLADO <svg class="icon" viewBox="0 0 24 24" style="width:11px; height:11px; stroke:currentColor;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            </div>
            <div class="atlas-chapter-symbol">
              <div class="compass-ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:38px; height:38px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            </div>
            <div class="atlas-folio-body">
              <div class="atlas-chapter-title-tag">CAPÍTULO ${ch.roman}</div>
              <div class="atlas-chapter-name">${esc(ch.name.toUpperCase().split('').join(' '))}</div>
              <p class="atlas-folio-desc">Región aún no cartografiada.<br>Desbloquea la región <strong>${regName}</strong> desde el Observatorio para abrir este capítulo.</p>
            </div>
            <div class="atlas-folio-footer">
              <button class="btn btn-soft" style="font-size:10px; padding:6px 16px;" onclick="closeModal('constellationBookModal'); openObservatoryModal(); setObservatoryTab('regiones');">Ir al Observatorio</button>
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
          svgMarkup = constellationSvg(c, false, 1.0);
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

  let prevCarousel = document.querySelector('.atlas-carousel');
  let prevScrollLeft = (prevCarousel && prevCarousel.scrollLeft > 0) ? prevCarousel.scrollLeft : null;

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
  if (carousel) {
    if (prevScrollLeft !== null) {
      carousel.scrollLeft = prevScrollLeft;
    }
    initAtlasPageTurn(carousel);
  }
 
  // Render Observatory Level, Modular Components & Observable Regions
  const observatoryLevels = [
    { level: 0, name: 'Puesto de Observación', cost: 0, desc: 'Instrumental óptico de campo y cartas celestes básicas.' },
    { level: 1, name: 'Refractor Óptico de Precisión', cost: 5, desc: 'Lentes apocromáticas de alta definición y montura de precisión.' },
    { level: 2, name: 'Estación Astrofotográfica', cost: 10, desc: 'Sensor digital de alta resolución y seguimiento sideral motorizado.' },
    { level: 3, name: 'Observatorio de Alta Montaña', cost: 15, desc: 'Cúpula giratoria automatizada y atmósfera límpida.' },
    { level: 4, name: 'Complejo de Espacio Profundo', cost: 20, desc: 'Óptica reflectora segmentada y cartografía espectral total.' }
  ];

  const observatoryComponents = [
    {
      id: 'telescope',
      icon: '🔭',
      name: 'Telescopio Principal',
      desc: 'Capta la luz tenue de estrellas y constelaciones lejanas.',
      levels: [
        'Refractor básico (70mm)',
        'Refractor apocromático ED (120mm)',
        'Reflector Newtoniano f/4 (200mm)',
        'Ritchey-Chrétien de cuarzo (350mm)',
        'Espejo parabólico segmentado (600mm)'
      ]
    },
    {
      id: 'mount',
      icon: '⚙️',
      name: 'Montura y Seguimiento',
      desc: 'Compensa la rotación de la Tierra para mantener fijas las figuras celestes.',
      levels: [
        'Trípode altacimutal manual',
        'Montura ecuatorial con mandos finos',
        'Sistema GoTo de alineación estelar',
        'Seguimiento sideral automatizado',
        'Tracción directa óptica de precisión absoluta'
      ]
    },
    {
      id: 'sensors',
      icon: '📷',
      name: 'Sensores y Cámara',
      desc: 'Captura y procesa los fotones estelares revelando figuras cósmicas.',
      levels: [
        'Oculares de observación directa',
        'Ocular gran angular iluminado',
        'Sensor CMOS astronómico digital',
        'Cámara espectral refrigerada (-20°C)',
        'Matriz fotométrica cuántica de banda ultra-estrecha'
      ]
    },
    {
      id: 'dome',
      icon: '🏛️',
      name: 'Cúpula y Estación',
      desc: 'Protección ambiental y aislamiento contra turbulencias térmicas terrestres.',
      levels: [
        'Plataforma de campo abierta',
        'Caseta protectora con techo deslizante',
        'Cúpula giratoria con compuerta',
        'Domo automatizado con sellado térmico',
        'Complejo geodésico con climatización pasiva'
      ]
    },
    {
      id: 'cartography',
      icon: '📜',
      name: 'Cartografía Celeste',
      desc: 'Registro astrométrico de posiciones, estrellas guía y aristas del firmamento.',
      levels: [
        'Planisferio astronómico básico',
        'Atlas estelar de constelaciones boreales',
        'Catálogo astrométrico digitalizado',
        'Base de datos fotométrica de cielo profundo',
        'Red de coordenadas cósmicas estandarizada'
      ]
    }
  ];

  const regions = [
    { id: 'cielo-1', name: 'Primer cielo', cost: 0, desc: 'El cielo boreal visible a simple vista.' },
    { id: 'zodiaco', name: 'Zodiaco', cost: 5, desc: 'Las 12 constelaciones del cinturón solar.' },
    { id: 'orion', name: 'Cielo de invierno', cost: 10, desc: 'Estrellas brillantes de las noches frías.' },
    { id: 'profundo', name: 'Espacio profundo', cost: 15, desc: 'Galaxias externas y horizontes lejanos.' }
  ];

  let currentLvl = d.observatoryLevel !== undefined ? d.observatoryLevel : (d.shipLevel || 0);
  let nextLvl = observatoryLevels.find(l => l.level === currentLvl + 1);

  // Escena 3D Hero Protagonista del Observatorio Terrestre
  let observatoryHeroHtml = `
    <div class="observatory-hero-container" id="observatoryHeroScene">
      <div class="observatory-sky-backdrop"></div>
      <div class="observatory-nebula-glow"></div>
      <div class="observatory-mountains"></div>
      
      <!-- Canvas Three.js Real para el Modelo 3D -->
      <canvas id="observatoryCanvas" class="observatory-3d-canvas"></canvas>

      <!-- Mensaje Fallback si WebGL o el modelo 3D no están disponibles -->
      <div id="observatoryFallbackMessage" class="observatory-fallback-msg" style="display:none;">
        <span style="font-size:24px; opacity:0.8;">🔭</span>
        <p style="margin:0; font-size:12px; color:#b8a9c4;">Vista 3D no disponible</p>
      </div>

      <div class="observatory-rotate-hint">↔ Arrastra para explorar en 3D</div>
    </div>
  `;
  let obsLevelEl = document.getElementById('observatoryLevelStatus') || document.getElementById('shipLevelStatus');
  if (obsLevelEl) obsLevelEl.innerHTML = observatoryHeroHtml;

  // Inspector de Componentes Modulares del Observatorio
  let activeMod = window.activeObservatoryModuleId || 'telescope';
  let chipsHtml = `
    <div style="margin-top:12px;">
      <small style="text-transform:uppercase; font-size:9.5px; color:var(--rose2); font-weight:700; letter-spacing:0.08em; display:block; margin-bottom:4px;">
        Componentes de la Estación
      </small>
      <div class="observatory-modules-strip">
        ${observatoryComponents.map(comp => `
          <div class="observatory-module-chip ${comp.id === activeMod ? 'active' : ''}" data-module="${comp.id}" onclick="selectObservatoryModule('${comp.id}')">
            <span>${comp.icon}</span>
            <span>${comp.name}</span>
          </div>
        `).join('')}
      </div>
      <div id="observatoryActiveModuleCard"></div>
    </div>
  `;

  let obsCompEl = document.getElementById('observatoryComponents') || document.getElementById('shipDestinations');
  if (obsCompEl) {
    obsCompEl.innerHTML = chipsHtml;
    renderObservatoryDetailCard(d, activeMod);
  }

  // Inicializar interacción 3D si la página del observatorio está visible
  if (currentActivePage === 'observatory') {
    setTimeout(() => {
      if (typeof window.initObservatory3D === 'function') {
        window.initObservatory3D();
      }
      selectObservatoryModule(activeMod);
    }, 40);
  }

  // Render Regions
  let regHtml = '';
  regions.forEach(reg => {
    let unlocked = d.unlockedRegions && d.unlockedRegions.includes(reg.id);
    regHtml += `
      <div class="card" style="padding:14px; margin-bottom:10px; border: 1px solid ${unlocked ? 'rgba(255,255,255,0.12)' : 'dashed var(--rose2)'}; background: ${unlocked ? 'rgba(255,255,255,0.03)' : 'rgba(252,194,205,0.04)'}; display: flex; flex-direction: column; gap: 4px; border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px; color:#ffffff;">${reg.name}</strong>
          ${unlocked ? `
            <span style="font-size:10px; font-weight:700; color:#95dfb0; display:flex; align-items:center; gap:4px;">✦ Cielo explorado</span>
          ` : `
            <button class="btn btn-main" style="padding: 5px 12px; font-size: 10px; border-radius: 8px;" onclick="unlockRegion('${reg.id}', ${reg.cost})">Desbloquear · ${reg.cost} ★</button>
          `}
        </div>
        <p style="font-size:11px; color:rgba(247,244,235,0.65); margin: 3px 0 0;">${reg.desc}</p>
      </div>
    `;
  });
  let skyRegionsEl = document.getElementById('skyRegions');
  if (skyRegionsEl) skyRegionsEl.innerHTML = regHtml;
}

function playConstellationAcquisitionCeremony(cDef, onComplete){
  let modal = document.getElementById('constellationCeremonyModal');
  let stage = document.getElementById('ceremonyStage');
  let titleEl = document.getElementById('ceremonyTitle');
  let particlesLayer = document.getElementById('ceremonyParticles');
  
  if(!modal || !cDef){
    if(typeof onComplete === 'function') onComplete();
    return;
  }

  // Normalizar constelación para obtener puntos y aristas
  let norm = (typeof ConstellationUtils !== 'undefined' && ConstellationUtils.normalizeConstellation)
    ? ConstellationUtils.normalizeConstellation(cDef)
    : cDef;

  let pts = norm.pts || (norm.stars ? norm.stars.map(s => [s.x, s.y]) : []);
  let edges = norm.edges || [];
  let N = pts.length;

  if(titleEl) titleEl.textContent = norm.name;

  // Fondo de micro-estrellas ambientales
  let ambientStars = [
    [12, 18, 0.8, 0.25], [88, 15, 1.0, 0.3], [10, 75, 0.7, 0.2],
    [90, 80, 0.9, 0.28], [50, 92, 0.8, 0.22], [82, 45, 0.6, 0.18],
    [18, 48, 0.7, 0.2], [65, 10, 0.9, 0.26]
  ].map(([cx, cy, r, op]) => `<circle class="ambient-sky-star" cx="${cx}%" cy="${cy}%" r="${r}" opacity="${op}"/>`).join('');

  // Aristas guía tenues
  let ghostLinesHtml = edges.map(([a, b]) => {
    let p1 = pts[a] || [0, 0];
    let p2 = pts[b] || [0, 0];
    return `<line class="ghost-line" x1="${p1[0]}%" y1="${p1[1]}%" x2="${p2[0]}%" y2="${p2[1]}%" opacity="0.14"/>`;
  }).join('');

  // Aristas activas con stroke-dashoffset animable
  let linesHtml = edges.map(([a, b], idx) => {
    let p1 = pts[a] || [0, 0];
    let p2 = pts[b] || [0, 0];
    let len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    return `<line id="ceremonyEdge${idx}" class="ceremony-edge" x1="${p1[0]}%" y1="${p1[1]}%" x2="${p2[0]}%" y2="${p2[1]}%" style="stroke-dasharray:${len.toFixed(2)}; stroke-dashoffset:${len.toFixed(2)};" />`;
  }).join('');

  // Estrellas guía tenues
  let ghostStarsHtml = pts.map(p => `<circle class="ghost-star" cx="${p[0]}%" cy="${p[1]}%" r="2.0" opacity="0.22"/>`).join('');

  // Nodos de estrellas ceremoniales con núcleo y resplandor
  let starsHtml = pts.map((p, i) => {
    let isMain = (norm.id === 'lyra' && i === 0);
    let r = isMain ? 3.5 : 2.8;
    return `
      <g id="ceremonyStar${i}" class="ceremony-star-node" style="transform-origin:${p[0]}% ${p[1]}%;">
        <circle class="ceremony-star-glow" cx="${p[0]}%" cy="${p[1]}%" r="${r * 2.4}" opacity="0.3" fill="#ffe599" />
        <circle class="ceremony-star-core" cx="${p[0]}%" cy="${p[1]}%" r="${r}" fill="#ffffff" />
      </g>
    `;
  }).join('');

  stage.className = 'ceremony-stage';
  stage.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${ambientStars}${ghostLinesHtml}${ghostStarsHtml}${linesHtml}${starsHtml}</svg>`;

  if(particlesLayer) particlesLayer.innerHTML = '';

  // 1. Mostrar modal (Fase 1: Entrada y centrado)
  modal.style.display = 'flex';
  void modal.offsetWidth;
  modal.classList.add('active');

  let timeouts = [];
  function schedule(fn, delay){
    let t = setTimeout(fn, delay);
    timeouts.push(t);
  }

  // 2. Encendido secuencial estrella por estrella (Fase 2) y trazado de aristas (Fase 3)
  let starInterval = Math.max(180, Math.min(270, Math.floor(1200 / Math.max(1, N))));
  let starIgnitionTimes = [];

  for(let i = 0; i < N; i++){
    let ignTime = 350 + i * starInterval;
    starIgnitionTimes.push(ignTime);

    schedule(() => {
      let starEl = document.getElementById(`ceremonyStar${i}`);
      if(starEl) starEl.classList.add('ignited');

      // Micro destello de partículas en la posición de cada estrella
      if(particlesLayer && pts[i]){
        let px = pts[i][0];
        let py = pts[i][1];
        let pEl = document.createElement('span');
        pEl.className = 'stardust-particle';
        pEl.style.left = px + '%';
        pEl.style.top = py + '%';
        pEl.style.width = '6px';
        pEl.style.height = '6px';
        pEl.style.background = i % 2 === 0 ? '#fff9db' : '#fcc2cd';
        pEl.style.boxShadow = '0 0 10px #ffffff';
        pEl.style.setProperty('--dx', (Math.random() * 26 - 13) + 'px');
        pEl.style.setProperty('--dy', (Math.random() * 26 - 13) + 'px');
        particlesLayer.appendChild(pEl);
      }
    }, ignTime);
  }

  // Trazar aristas progresivamente en cuanto sus estrellas de origen y destino estén encendidas
  edges.forEach(([a, b], idx) => {
    let drawTime = Math.max(starIgnitionTimes[a] || 350, starIgnitionTimes[b] || 350) + 70;
    schedule(() => {
      let edgeEl = document.getElementById(`ceremonyEdge${idx}`);
      if(edgeEl) edgeEl.classList.add('drawn');
    }, drawTime);
  });

  // 3. Climax final (Fase 4): pulso de brillo, estallido de polvo de estrellas y ampliación suave (scale 1.15)
  let finishTime = 350 + N * starInterval + 260;

  schedule(() => {
    stage.classList.add('illuminated', 'complete');
    
    // Partículas estelares de celebración
    if(particlesLayer){
      let count = 18;
      let html = '';
      for(let i = 0; i < count; i++){
        let angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
        let dist = 65 + Math.random() * 80;
        let dx = Math.cos(angle) * dist + 'px';
        let dy = Math.sin(angle) * dist + 'px';
        let size = Math.random() * 3.5 + 2;
        let delay = Math.random() * 0.22;
        let color = i % 2 === 0 ? '#fff5cc' : '#fcc2cd';
        html += `<span class="stardust-particle" style="left:50%; top:48%; width:${size}px; height:${size}px; background:${color}; box-shadow:0 0 10px ${color}; --dx:${dx}; --dy:${dy}; animation-delay:${delay}s;"></span>`;
      }
      particlesLayer.innerHTML += html;
    }
  }, finishTime);

  // 4. Mantener la constelación completa antes de salir suavemente (Fase 5)
  let totalHoldTime = finishTime + 1200;

  schedule(() => {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
      if(particlesLayer) particlesLayer.innerHTML = '';
      stage.className = 'ceremony-stage';
      if(typeof onComplete === 'function') onComplete();
    }, 380);
  }, totalHoldTime);
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

  // Capturar si el usuario estaba en el Atlas/Libro y su posición de scroll
  let bookModal = document.getElementById('constellationBookModal');
  let isBookOpen = bookModal && (bookModal.classList.contains('show') || bookModal.classList.contains('active'));
  let prevCarousel = document.querySelector('.atlas-carousel');
  let prevScrollLeft = (prevCarousel && prevCarousel.scrollLeft > 0) ? prevCarousel.scrollLeft : null;

  playConstellationAcquisitionCeremony(cDef, () => {
    toast(`✦ ${cDef ? cDef.name : 'Constelación'} iluminada en tu universo.`);
    render();

    // Mantener la vista activa y la posición de página exacta del Atlas
    if (isBookOpen) {
      let bModal = document.getElementById('constellationBookModal');
      if (bModal) {
        bModal.classList.add('show', 'active');
      }
      let carousel = document.querySelector('.atlas-carousel');
      if (carousel) {
        if (prevScrollLeft !== null) {
          carousel.scrollLeft = prevScrollLeft;
        }
        if (typeof initAtlasPageTurn === 'function') {
          initAtlasPageTurn(carousel);
        }
      }
    }
  });
}

function verFichaConstelacion(id){
  let c = constellationDefs.find(x => x.id === id);
  if (!c) return;
  detailConstName.textContent = c.name;
  detailConstMeta.textContent = c.collection === 'zodiaco' ? 'Colección: Zodiaco' : (c.collection === 'norte' ? 'Colección: Primer cielo' : (c.collection === 'invierno' ? 'Colección: Cielo de invierno' : 'Colección: Espacio profundo'));
  
  let descHtml = esc(c.desc || '');
  if (c.myth) {
    descHtml += `<div style="margin-top:12px; padding:10px 12px; background:var(--soft); border-radius:10px; border:1px solid var(--line); font-size:12px; color:var(--muted); line-height:1.5;">“${esc(c.myth)}”</div>`;
  }
  detailConstDesc.innerHTML = descHtml;
  document.getElementById('constellationDetailModal').classList.add('show');
}

function setObservatoryTab(tab){
  let secObs = document.getElementById('observatorySecMain') || document.getElementById('shipSecNave');
  let secReg = document.getElementById('observatorySecRegiones') || document.getElementById('shipSecRegiones');
  let btnTabObs = document.getElementById('btnTabObservatorio') || document.getElementById('btnTabNave');
  let btnTabReg = document.getElementById('btnTabRegiones');
  if(secObs) secObs.style.display = (tab === 'observatorio' || tab === 'nave') ? 'block' : 'none';
  if(secReg) secReg.style.display = tab === 'regiones' ? 'block' : 'none';
  if(btnTabObs) btnTabObs.classList.toggle('active', tab === 'observatorio' || tab === 'nave');
  if(btnTabReg) btnTabReg.classList.toggle('active', tab === 'regiones');
}

function upgradeObservatory(level, cost){
  let d = load();
  if (Number(d.wallet || 0) < cost) {
    return toast('No tienes suficientes estrellas en tu cesta.');
  }
  d.wallet = Number(d.wallet || 0) - cost;
  d.bank = d.wallet;
  d.observatoryLevel = level;
  d.shipLevel = level;
  save(d);
  const obsNames = [
    'Puesto de Observación',
    'Refractor Óptico de Precisión',
    'Estación Astrofotográfica',
    'Observatorio de Alta Montaña',
    'Complejo de Espacio Profundo'
  ];
  toast(`✦ Observatorio mejorado a: ${obsNames[level] || level}`);
  render();
}

function renderObservatoryDetailCard(d, moduleId) {
  let cardContainer = document.getElementById('observatoryActiveModuleCard');
  if (!cardContainer) return;
  
  const observatoryLevels = [
    { level: 0, name: 'Puesto de Observación', cost: 0, desc: 'Instrumental óptico de campo y cartas celestes básicas.' },
    { level: 1, name: 'Refractor Óptico de Precisión', cost: 5, desc: 'Lentes apocromáticas de alta definición y montura de precisión.' },
    { level: 2, name: 'Estación Astrofotográfica', cost: 10, desc: 'Sensor digital de alta resolución y seguimiento sideral motorizado.' },
    { level: 3, name: 'Observatorio de Alta Montaña', cost: 15, desc: 'Cúpula giratoria automatizada y atmósfera límpida.' },
    { level: 4, name: 'Complejo de Espacio Profundo', cost: 20, desc: 'Óptica reflectora segmentada y cartografía espectral total.' }
  ];

  const observatoryComponents = [
    {
      id: 'telescope',
      icon: '🔭',
      name: 'Telescopio Principal',
      desc: 'Capta la luz tenue de estrellas y constelaciones lejanas.',
      levels: [
        'Refractor básico (70mm)',
        'Refractor apocromático ED (120mm)',
        'Reflector Newtoniano f/4 (200mm)',
        'Ritchey-Chrétien de cuarzo (350mm)',
        'Espejo parabólico segmentado (600mm)'
      ]
    },
    {
      id: 'mount',
      icon: '⚙️',
      name: 'Montura y Seguimiento',
      desc: 'Compensa la rotación de la Tierra para mantener fijas las figuras celestes.',
      levels: [
        'Trípode altacimutal manual',
        'Montura ecuatorial con mandos finos',
        'Sistema GoTo de alineación estelar',
        'Seguimiento sideral automatizado',
        'Tracción directa óptica de precisión absoluta'
      ]
    },
    {
      id: 'sensors',
      icon: '📷',
      name: 'Sensores y Cámara',
      desc: 'Captura y procesa los fotones estelares revelando figuras cósmicas.',
      levels: [
        'Oculares de observación directa',
        'Ocular gran angular iluminado',
        'Sensor CMOS astronómico digital',
        'Cámara espectral refrigerada (-20°C)',
        'Matriz fotométrica cuántica de banda ultra-estrecha'
      ]
    },
    {
      id: 'dome',
      icon: '🏛️',
      name: 'Cúpula y Estación',
      desc: 'Protección ambiental y aislamiento contra turbulencias térmicas terrestres.',
      levels: [
        'Plataforma de campo abierta',
        'Caseta protectora con techo deslizante',
        'Cúpula giratoria con compuerta',
        'Domo automatizado con sellado térmico',
        'Complejo geodésico con climatización pasiva'
      ]
    },
    {
      id: 'cartography',
      icon: '📜',
      name: 'Cartografía Celeste',
      desc: 'Registro astrométrico de posiciones, estrellas guía y aristas del firmamento.',
      levels: [
        'Planisferio astronómico básico',
        'Atlas estelar de constelaciones boreales',
        'Catálogo astrométrico digitalizado',
        'Base de datos fotométrica de cielo profundo',
        'Red de coordenadas cósmicas estandarizada'
      ]
    }
  ];

  let currentLvl = d.observatoryLevel !== undefined ? d.observatoryLevel : (d.shipLevel || 0);
  let nextLvl = observatoryLevels.find(l => l.level === currentLvl + 1);
  let comp = observatoryComponents.find(c => c.id === moduleId) || observatoryComponents[0];
  let currentCap = comp.levels[Math.min(currentLvl, comp.levels.length - 1)];

  cardContainer.innerHTML = `
    <div class="observatory-detail-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px; filter:drop-shadow(0 0 8px rgba(252,194,205,0.4));">${comp.icon}</span>
          <div>
            <strong style="font-size:14px; color:#ffffff; display:block;">${comp.name}</strong>
            <small style="font-size:9.5px; color:var(--rose2); font-weight:700; text-transform:uppercase; letter-spacing:0.06em;">✦ Módulo Activo · Rango ${currentLvl}</small>
          </div>
        </div>
        <span style="font-size:10px; font-weight:700; color:#fff8e0; background:rgba(252,194,205,0.14); padding:3px 8px; border-radius:6px; border:1px solid rgba(252,194,205,0.3);">
          ${currentCap}
        </span>
      </div>
      <p style="font-size:11.5px; color:rgba(247,244,235,0.8); margin:4px 0 12px; line-height:1.45;">${comp.desc}</p>
      
      <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div>
          <small style="font-size:9.5px; color:rgba(247,244,235,0.55); text-transform:uppercase;">Nivel de la Estación</small>
          <div style="font-size:12px; font-weight:700; color:#ffffff;">${observatoryLevels[currentLvl].name}</div>
        </div>
        ${nextLvl ? `
          <button class="btn btn-main" style="padding:7px 14px; font-size:11px; border-radius:8px;" onclick="upgradeObservatory(${nextLvl.level}, ${nextLvl.cost})">
            Mejorar · ${nextLvl.cost} ★
          </button>
        ` : `
          <span style="font-size:10.5px; color:#95dfb0; font-weight:600;">✦ Nivel Máximo</span>
        `}
      </div>
    </div>
  `;
}

function selectObservatoryModule(moduleId) {
  window.activeObservatoryModuleId = moduleId;
  
  // Actualizar chips de la barra
  document.querySelectorAll('.observatory-module-chip').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-module') === moduleId);
  });
  
  // Re-renderizar tarjeta de detalle
  let d = load();
  renderObservatoryDetailCard(d, moduleId);
}

// Aliases para compatibilidad
function setShipTab(tab){ setObservatoryTab(tab === 'nave' ? 'observatorio' : tab); }
function upgradeShip(level, cost){ upgradeObservatory(level, cost); }
function openShipModal(){ openObservatoryModal(); }

function openObservatoryModal(){
  showPage('observatory');
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

function openReflectionModal(){
  let d = load();
  let idx = getStoredReflectionIndex();
  let p = reflectionPrompts[idx] || reflectionPrompts[0];
  let titleEl = document.getElementById('reflectionModalPromptTitle');
  let subEl = document.getElementById('reflectionModalPromptSub');
  let textEl = document.getElementById('reflectionAnswerText');
  if(titleEl) titleEl.textContent = p[0];
  if(subEl) subEl.textContent = p[1];
  let k = dayKey();
  let saved = (d.reflections && d.reflections[k]) ? d.reflections[k].answer : '';
  if(textEl) textEl.value = saved || '';
  let modal = document.getElementById('reflectionModal');
  if(modal) modal.classList.add('show');
}

function saveReflectionAnswer(){
  let textEl = document.getElementById('reflectionAnswerText');
  let text = textEl ? textEl.value.trim() : '';
  if(!text) return toast('Escribe tu reflexión');
  let d = load();
  let idx = getStoredReflectionIndex();
  let p = reflectionPrompts[idx] || reflectionPrompts[0];
  let k = dayKey();
  if(!d.reflections) d.reflections = {};
  d.reflections[k] = {
    prompt: p[0],
    sub: p[1],
    answer: text,
    ts: Date.now()
  };
  save(d);
  let got = awardDailyAction('journal', 0.1, 0.5, 'Reflexión: ' + p[0], 'reflection-' + k);
  toast(got ? 'Reflexión guardada · +0,1' : 'Reflexión guardada');
  closeModal('reflectionModal');
  render();
}

function renderReflectionPrompt(){
  let tEl = document.getElementById('reflectionPromptTitle');
  let sEl = document.getElementById('reflectionPromptSub');
  let badgeEl = document.getElementById('reflectionAnswerBadge');
  if(!tEl || !sEl) return;
  let idx = getStoredReflectionIndex();
  let p = reflectionPrompts[idx] || reflectionPrompts[0];
  tEl.textContent = p[0];
  sEl.textContent = p[1];
  
  let d = (typeof load === 'function') ? load() : null;
  if(badgeEl && d){
    let k = dayKey();
    let saved = (d.reflections && d.reflections[k]);
    if(saved && saved.answer){
      badgeEl.innerHTML = `<span class="reflection-badge-answered">✦ Respondida hoy</span>`;
    } else {
      badgeEl.innerHTML = `<span class="reflection-badge-pending" style="display:inline-flex; align-items:center; gap:5px;"><svg class="icon" viewBox="0 0 24 24" style="width:12px; height:12px; stroke:currentColor; stroke-width:2;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Toca para reflexionar...</span>`;
    }
  }
}

function renderRewardsList(d){
  let rewardsEl = document.getElementById('rewards');
  if(!rewardsEl) return;
  rewardsEl.innerHTML = (d.rewards||[]).length ? d.rewards.map(r => {
    let canAfford = Number(d.wallet || 0) >= r.cost;
    if(canAfford){
      return `
        <div class="card reward" style="display:flex; flex-direction:column; gap:12px; padding:14px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; padding:0 2px;">
            <strong style="font-size:14px; font-weight:600; color:var(--ink); flex:1 1 160px; min-width:0; word-break:break-word;">${esc(r.name)}</strong>
            <span style="font-size:12px; font-weight:700; color:var(--wine); white-space:nowrap; flex-shrink:0;">${r.cost} ★</span>
          </div>
          <div class="swipe-to-redeem-track" data-reward-id="${r.id}">
            <div class="swipe-thumb">
              <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor; stroke-width:2.5; fill:none; stroke-linecap:round; stroke-linejoin:round;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
            <span class="swipe-label">Desliza para canjear</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="card reward" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; opacity:0.75; padding:14px; margin-bottom:10px;">
          <div style="flex:1 1 160px; min-width:0;">
            <strong style="font-size:13.5px; color:var(--ink); display:block; word-break:break-word;">${esc(r.name)}</strong>
            <small style="display:block; color:var(--muted); font-size:11px; margin-top:3px; word-break:break-word;">${r.cost} ★ · Te faltan ${(r.cost - Number(d.wallet||0)).toFixed(1).replace('.',',')} ★</small>
          </div>
          <span style="font-size:9.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:99px; white-space:nowrap; flex-shrink:0;">Bloqueado</span>
        </div>
      `;
    }
  }).join('') : '<div class="empty" style="padding:14px; text-align:center; font-size:12px; color:var(--muted);">No tienes premios creados todavía.</div>';

  initSwipeToRedeem();
}

function initSwipeToRedeem(){
  let tracks = document.querySelectorAll('.swipe-to-redeem-track:not([data-swipe-bound])');
  tracks.forEach(track => {
    track.setAttribute('data-swipe-bound', 'true');
    let thumb = track.querySelector('.swipe-thumb');
    let label = track.querySelector('.swipe-label');
    let rewardId = track.getAttribute('data-reward-id');
    
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let maxDist = 0;

    function onStart(e){
      isDragging = true;
      startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      maxDist = track.clientWidth - (thumb ? thumb.clientWidth : 34) - 6;
      track.classList.add('swiping');
    }

    function onMove(e){
      if(!isDragging) return;
      let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      let diff = clientX - startX;
      currentX = Math.max(0, Math.min(diff, maxDist));
      if(thumb) thumb.style.transform = `translateX(${currentX}px)`;
      if(label){
        let pct = currentX / (maxDist || 1);
        label.style.opacity = String(Math.max(0, 1 - pct * 1.5));
      }
    }

    function onEnd(){
      if(!isDragging) return;
      isDragging = false;
      track.classList.remove('swiping');
      let pct = currentX / (maxDist || 1);
      if(pct >= 0.75){
        track.classList.add('completed');
        if(thumb) thumb.style.transform = `translateX(${maxDist}px)`;
        if(label) {
          label.textContent = '¡Canjeado! ✦';
          label.style.opacity = '1';
        }
        setTimeout(() => {
          redeem(rewardId);
        }, 220);
      } else {
        if(thumb) thumb.style.transform = 'translateX(0px)';
        if(label) label.style.opacity = '0.88';
      }
      currentX = 0;
    }

    track.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    track.addEventListener('touchstart', onStart, { passive: true });
    track.addEventListener('touchmove', onMove, { passive: true });
    track.addEventListener('touchend', onEnd, { passive: true });
  });
}

let isNotCheckingEditing = false;

function toggleNotCheckingEdit(forceState){
  isNotCheckingEditing = (typeof forceState === 'boolean') ? forceState : !isNotCheckingEditing;
  let btn = document.getElementById('notCheckingEditToggleBtn');
  let actionsDiv = document.getElementById('notCheckingEditActions');
  if(btn){
    if(isNotCheckingEditing){
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="width:15px; height:15px; stroke:var(--wine);"><path d="M20 6L9 17l-5-5"/></svg>`;
      btn.title = "Terminar edición";
      btn.classList.add('active');
    } else {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="width:15px; height:15px;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
      btn.title = "Editar lista";
      btn.classList.remove('active');
    }
  }
  if(actionsDiv){
    actionsDiv.style.display = isNotCheckingEditing ? 'block' : 'none';
  }
  let d = load();
  renderNotCheckingList(d);
}

function openAddNotCheckingModal(){
  let editIdEl = document.getElementById('notCheckingEditId');
  let titleEl = document.getElementById('notCheckingModalTitle');
  let nameEl = document.getElementById('notCheckingName');
  let subEl = document.getElementById('notCheckingSub');
  if(editIdEl) editIdEl.value = '';
  if(titleEl) titleEl.textContent = 'Añadir a la lista';
  if(nameEl) nameEl.value = '';
  if(subEl) subEl.value = '';
  let modal = document.getElementById('notCheckingModal');
  if(modal) modal.classList.add('show');
}

function openEditNotCheckingModal(id){
  let d = load();
  let g = (d.goals||[]).find(x => x && x.id === id);
  if(!g) return;
  let editIdEl = document.getElementById('notCheckingEditId');
  let titleEl = document.getElementById('notCheckingModalTitle');
  let nameEl = document.getElementById('notCheckingName');
  let subEl = document.getElementById('notCheckingSub');
  if(editIdEl) editIdEl.value = g.id;
  if(titleEl) titleEl.textContent = 'Editar elemento';
  if(nameEl) nameEl.value = g.name || '';
  if(subEl) subEl.value = g.sub || '';
  let modal = document.getElementById('notCheckingModal');
  if(modal) modal.classList.add('show');
}

function saveNotCheckingItem(){
  let editIdEl = document.getElementById('notCheckingEditId');
  let nameEl = document.getElementById('notCheckingName');
  let subEl = document.getElementById('notCheckingSub');
  let name = nameEl ? nameEl.value.trim() : '';
  let sub = subEl ? subEl.value.trim() : '';
  if(!name) return toast('Escribe qué eliges no comprobar');
  
  let d = load();
  if(!Array.isArray(d.goals)) d.goals = [];
  let editId = editIdEl ? editIdEl.value : '';
  
  if(editId){
    let g = d.goals.find(x => x && x.id === editId);
    if(g){
      g.name = name;
      g.sub = sub;
      toast('Elemento actualizado');
    }
  } else {
    d.goals.push({
      id: uid(),
      icon: 'search',
      name: name,
      sub: sub,
      since: Date.now()
    });
    toast('Elemento añadido');
  }
  
  save(d);
  closeModal('notCheckingModal');
  render();
}

function removeNotCheckingItem(id){
  let d = load();
  if(!Array.isArray(d.goals)) return;
  d.goals = d.goals.filter(x => x && x.id !== id);
  save(d);
  toast('Elemento eliminado');
  render();
}

function renderNotCheckingList(d){
  let container = document.getElementById('goals');
  let btn = document.getElementById('notCheckingEditToggleBtn');
  let actionsDiv = document.getElementById('notCheckingEditActions');
  if(!container) return;

  if(btn){
    if(isNotCheckingEditing){
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="width:15px; height:15px; stroke:var(--wine);"><path d="M20 6L9 17l-5-5"/></svg>`;
      btn.title = "Terminar edición";
      btn.classList.add('active');
    } else {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="width:15px; height:15px;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
      btn.title = "Editar lista";
      btn.classList.remove('active');
    }
  }
  if(actionsDiv){
    actionsDiv.style.display = isNotCheckingEditing ? 'block' : 'none';
  }

  if(!Array.isArray(d.goals) || !d.goals.length){
    container.innerHTML = `<div class="empty" style="padding:14px; text-align:center; font-size:12px; color:var(--muted);">No hay impulsos en tu lista todavía.</div>`;
    return;
  }
  
  if(isNotCheckingEditing){
    // Modo Edición: tocar para editar, swipe para eliminar
    container.innerHTML = d.goals.map(g => {
      let iconSvg = icons[g.icon] || icons.search || `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>`;
      let contentHtml = `
        <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; min-width:0; width:100%; box-sizing:border-box;">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--soft); display:grid; place-items:center; color:var(--wine); flex-shrink:0; margin-top:1px;">
            ${iconSvg}
          </div>
          <div style="flex:1 1 auto; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <strong style="font-size:13.5px; font-weight:600; color:var(--ink); line-height:1.35; word-break:break-word; min-width:0;">${esc(g.name)}</strong>
              <span style="display:inline-flex; align-items:center; color:var(--wine); opacity:0.8; flex-shrink:0; margin-top:2px;"><svg class="icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke:currentColor;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span>
            </div>
            ${g.sub ? `<small style="display:block; font-size:11px; color:var(--muted); line-height:1.4; margin-top:3px; word-break:break-word;">${esc(g.sub)}</small>` : ''}
          </div>
        </div>
      `;
      return wrapSwipe(contentHtml, `removeNotCheckingItem('${g.id}')`, 'good-card', `openEditNotCheckingModal('${g.id}')`);
    }).join('');
  } else {
    // Modo Normal: cada elemento con sus dos acciones ('Tengo ganas de mirar' y 'Lo he comprobado')
    container.innerHTML = d.goals.map(g => {
      let iconSvg = icons[g.icon] || icons.search || `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>`;
      return `
        <div class="card goal" style="padding:14px; margin-bottom:10px;">
          <div class="goal-top" style="display:grid; grid-template-columns:36px 1fr; gap:10px; align-items:flex-start;">
            <div class="goal-icon" style="margin-top:1px;">${iconSvg}</div>
            <div style="min-width:0;">
              <div class="goal-title" style="word-break:break-word; line-height:1.35;">${esc(g.name)}</div>
              ${g.sub ? `<div class="goal-sub" style="word-break:break-word; margin-top:3px;">${esc(g.sub)}</div>` : ''}
            </div>
          </div>
          <div class="goal-actions" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            <button class="btn btn-soft" onclick="openUrge('${g.id}')" style="flex:1 1 140px; min-width:120px; text-align:center;">Tengo ganas de mirar</button>
            <button class="btn btn-line" onclick="slip('${g.id}')" style="flex:1 1 120px; min-width:110px; text-align:center;">Lo he comprobado</button>
          </div>
        </div>
      `;
    }).join('');
  }
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
   let contentHtml=`<div style="flex:1 1 auto; min-width:0;"><strong style="display:block; word-break:break-word;">${esc(o.name)}</strong><small style="display:block; word-break:break-word; margin-top:2px;">${esc(o.meaning||'')}</small></div>`;
   return wrapSwipe(contentHtml, `removeOrbit('${o.id}')`, 'good-card', `openEditOrbitItem('${o.id}')`);
 }).join(''):'<div class="empty" style="padding:14px; text-align:center; font-size:12px; color:var(--muted);">No tienes pilares guardados todavía.</div>';
 
  let todays=d.goodThings.filter(g=>dayKey(g.ts)===dayKey()).slice().reverse();
  todayGoodThings.innerHTML=todays.length?'<div class="section-head"><h2>Hoy también pasó esto</h2></div>'+todays.map(g=>{
    let p=g.pillarId?(d.orbit||[]).find(o=>o&&o.id===g.pillarId):null;
    let photoHtml=g.photoPath?`<div class="good-photo-thumb-wrap" data-photo-path="${esc(g.photoPath)}" onclick="event.stopPropagation(); previewGoodPhoto('${esc(g.photoPath)}')"><div class="good-photo-loading"></div><img class="good-photo-thumb" style="display:none;" alt="Foto del recuerdo"></div>`:'';
    let contentHtml=`<div class="good-card-row" style="display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; min-width:0;"><div class="good-card-text" style="flex:1 1 auto; min-width:0;"><strong style="display:block; word-break:break-word;">${esc(g.text)}</strong>${p?`<small style="color:var(--wine); font-weight:600; margin-bottom:2px; display:block; word-break:break-word;">✦ ${esc(p.name)}</small>`:''}<small style="display:block; word-break:break-word;">${esc(g.meaning||'')}</small></div>${photoHtml}</div>`;
    return wrapSwipe(contentHtml, `deleteGood('${g.id}')`, 'good-card');
  }).join(''):'';
  loadPhotoThumbnails();
 bank.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');shopWallet.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');shopLifetime.textContent=Number(d.lifetimeStars||0).toFixed(1).replace('.',',');todayPoints.textContent=todayPointsTotal(d).toFixed(1).replace('.',',');bestStreak.textContent=fmt(d.returnToMe?.best||d.best||0);
 renderNotCheckingList(d);
 let sm=sharedMilestoneInfo(d);
 sharedStreak.textContent=fmt(now-d.returnToMe.since);
 sharedNextMilestone.textContent=sm.text;
 sharedProgress.style.width=sm.pct+'%';
  renderRewardsList(d);
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
  let wallet=Number(d.wallet||0);
  if(wallet<2){
    return toast('Necesitas al menos 2 estrellas para activar la Ventana Estelar.');
  }
  d.wallet=wallet-2;
  d.bank=d.wallet;
  d.boosters.active.push({
    id:'stellar-window',
    multiplier:1.5,
    activatedAt:Date.now(),
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
    windowStatus=`<button class="btn btn-line btn-sm" disabled style="font-size:10.5px; opacity:0.9; color:var(--wine); white-space:nowrap; padding:6px 10px;">Activa · ${remStr}</button>`;
  }else{
    windowStatus=`<button class="btn ${wallet>=2?'btn-main':'btn-soft'} btn-sm" ${wallet>=2?'':'disabled'} onclick="buyStellarWindow()" style="font-size:10.5px; white-space:nowrap; padding:6px 12px;">${wallet>=2?'Activar · 2 ★':'2 ★'}</button>`;
  }
  
  html+=`
    <div class="card booster-card" style="padding:12px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border: 1px solid ${activeWindow?'var(--rose2)':'var(--line)'}; background: ${activeWindow?'var(--soft)':'#fffdfb'};">
      <div style="text-align:left; flex:1 1 180px; min-width:0;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <strong style="font-size:13px; color:var(--ink); word-break:break-word;">Ventana Estelar</strong>
          <span class="badge" style="font-size:9.5px; background:rgba(180,120,160,0.15); color:var(--wine); padding:2px 7px; border-radius:6px; font-weight:700; white-space:nowrap;">x1.5 · 2 h</span>
        </div>
        <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0; word-break:break-word;">x1.5 en impulsos y racha. Máx +2 ★ extra.</p>
      </div>
      <div style="flex-shrink:0; margin-left:auto;">${windowStatus}</div>
    </div>
  `;
  
  // 2. Impulso Valiente
  if(braveUrge){
    html+=`
      <div class="card booster-card" style="padding:12px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border: 1px solid var(--rose2); background: var(--soft);">
        <div style="text-align:left; flex:1 1 180px; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:13px; color:var(--wine); word-break:break-word;">✦ Impulso Valiente</strong>
            <span class="badge" style="font-size:9.5px; background:var(--wine); color:#fff; padding:2px 7px; border-radius:6px; font-weight:700; white-space:nowrap;">x2 en próx. impulso</span>
          </div>
          <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0; word-break:break-word;">Disponible en inventario. Se aplicará al próximo temporizador superado.</p>
        </div>
      </div>
    `;
  }else{
    html+=`
      <div class="card booster-card" style="padding:11px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border: 1px dashed var(--line); opacity:0.85;">
        <div style="text-align:left; flex:1 1 180px; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:12px; color:var(--ink); word-break:break-word;">Impulso Valiente (x2)</strong>
            <span style="font-size:9.5px; color:var(--muted); font-weight:600; white-space:nowrap;">${nextBraveProgress} / 3 superados</span>
          </div>
          <p style="font-size:10.5px; color:var(--muted); margin:2px 0 0 0; word-break:break-word;">Se gana cada 3 impulsos con temporizador superados.</p>
        </div>
      </div>
    `;
  }
  
  // 3. Noche de Constancia
  if(activeNight){
    let remMin=Math.max(1,Math.ceil(((activeNight.expiresAt||now)-now)/60000));
    let remStr=remMin>=60?`${Math.floor(remMin/60)}h ${remMin%60}m`:`${remMin} min`;
    html+=`
      <div class="card booster-card" style="padding:12px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border: 1px solid var(--rose2); background: var(--soft);">
        <div style="text-align:left; flex:1 1 180px; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:13px; color:var(--wine); word-break:break-word;">✦ Noche de Constancia</strong>
            <span class="badge" style="font-size:9.5px; background:var(--wine); color:#fff; padding:2px 7px; border-radius:6px; font-weight:700; white-space:nowrap;">x1.5 · ${remStr}</span>
          </div>
          <p style="font-size:10.5px; color:var(--muted); margin:3px 0 0 0; word-break:break-word;">Activo por alcanzar 7 días de racha. Máx +3 ★ extra.</p>
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

let isProfileEditing = false;

function toggleProfileEdit(editing){
  isProfileEditing = (typeof editing === 'boolean') ? editing : !isProfileEditing;
  let d = load();
  renderProfile(d);
}

function renderProfile(d){
  if(!d) d=load();
  let viewCard = document.getElementById('profileViewCard');
  let formCard = document.getElementById('profileFormCard');
  let cancelBtn = document.getElementById('profileCancelEditBtn');
  
  let name = d.profile?.displayName || '';
  let uname = d.profile?.username || '';
  let bdate = d.profile?.birthDate || '';
  let hasData = !!(name || uname || bdate);

  let dn = document.getElementById('profileDisplayName');
  let un = document.getElementById('profileUsername');
  let bd = document.getElementById('profileBirthDate');
  if(dn && document.activeElement !== dn) dn.value = name;
  if(un && document.activeElement !== un) un.value = uname ? uname.replace(/^@/,'') : '';
  if(bd && document.activeElement !== bd) bd.value = bdate;

  let birthInfo = getProfileBirthInfo(d.profile?.birthDate);

  // Recompensa automática de cumpleaños (+25 estrellas una vez por año)
  if(birthInfo && birthInfo.isToday){
    let currentYear = new Date().getFullYear();
    if(d.profile.birthdayStarsClaimedYear !== currentYear){
      d.profile.birthdayStarsClaimedYear = currentYear;
      addPoints(d, 25, 'cumpleanos', 'Regalo de Cumpleaños ★', 'birthday-' + currentYear);
      save(d);
      toast('¡Feliz Cumpleaños! Orbit te regala 25 estrellas ★');
      let bankEl=document.getElementById('bank'), shopWalletEl=document.getElementById('shopWallet');
      if(bankEl) bankEl.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');
      if(shopWalletEl) shopWalletEl.textContent=Number(d.wallet||0).toFixed(1).replace('.',',');
    }
  }

  // Tarjeta de perfil en ajustes: modo lectura vs edición
  if(hasData && !isProfileEditing){
    if(viewCard){
      viewCard.style.display = 'block';
      let initial = (name ? name.charAt(0) : (uname ? uname.replace('@','').charAt(0) : '✦')).toUpperCase();
      let ageText = '';
      if(birthInfo){
        if(birthInfo.isToday){
          ageText = `<div style="font-size:11px; color:var(--wine); font-weight:700; margin-top:4px; display:flex; align-items:center; gap:4px; flex-wrap:wrap; word-break:break-word;"><svg class="icon" viewBox="0 0 24 24" style="width:12px; height:12px; stroke:currentColor; flex-shrink:0;"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg><span>${birthInfo.age} años · ¡Hoy es tu cumpleaños! (+25 ★)</span></div>`;
        } else {
          let bdayLabel = birthInfo.daysUntil === 1 ? 'mañana' : `en ${birthInfo.daysUntil} días`;
          ageText = `<div style="font-size:11px; color:var(--muted); margin-top:4px; display:flex; align-items:center; gap:4px; flex-wrap:wrap; word-break:break-word;"><svg class="icon" viewBox="0 0 24 24" style="width:12px; height:12px; stroke:currentColor; flex-shrink:0;"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg><span>${birthInfo.age} años · Cumple ${bdayLabel}</span></div>`;
        }
      }
      viewCard.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px; flex:1 1 auto; min-width:0;">
            <div style="width:46px; height:46px; border-radius:50%; background:linear-gradient(135deg,#f0cfd4,#aa5966); color:white; display:grid; place-items:center; font-family:Georgia,serif; font-size:20px; font-weight:600; flex-shrink:0; box-shadow:0 4px 12px rgba(141,76,87,0.2);">
              ${esc(initial)}
            </div>
            <div style="flex:1 1 auto; min-width:0;">
              <div style="font-family:Georgia,serif; font-size:17px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${esc(name || 'Mi Perfil Orbit')}
              </div>
              ${uname ? `<div style="font-size:12px; color:var(--wine); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">@${esc(uname.replace(/^@/,''))}</div>` : ''}
              ${ageText}
            </div>
          </div>
          <button class="profile-edit-btn" onclick="toggleProfileEdit(true)" title="Editar datos del perfil" style="flex-shrink:0;">
            <svg class="icon" viewBox="0 0 24 24" style="width:15px; height:15px; stroke:currentColor;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>
      `;
    }
    if(formCard) formCard.style.display = 'none';
  } else {
    if(viewCard) viewCard.style.display = 'none';
    if(formCard) formCard.style.display = 'block';
    if(cancelBtn) cancelBtn.style.display = hasData ? 'inline-block' : 'none';
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
        titleEl.textContent = '¡Feliz cumpleaños, ' + name + '!';
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
        <div style="display:flex; justify-content:center; gap:8px; margin-bottom:6px; color:var(--wine);">
          <svg class="icon" viewBox="0 0 24 24" style="width:22px; height:22px;"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>
        </div>
        <strong style="font-size:14px; color:var(--wine);">¡Feliz Cumpleaños, ${esc(name)}!</strong>
        <p style="font-size:12px; color:var(--ink); margin:6px 0 0; line-height:1.45;">Orbit celebra tu día especial. Tienes un regalo de <strong>+25 estrellas</strong> en tu cesta estelar para iluminar tu universo.</p>
      `;
    } else {
      bdayBanner.style.display='none';
    }
  }

  updateTestToolsVisibility(d);
}

function isTestAccount(d){
  if (!d) d = (typeof load === 'function') ? load() : null;
  let username = d?.profile?.username || '';
  let clean = String(username).trim().toLowerCase().replace(/^@/, '');
  return clean === 'prueba';
}

function updateTestToolsVisibility(d){
  let sec = document.getElementById('settingsTestToolsSection');
  if (sec) {
    sec.style.display = isTestAccount(d) ? 'block' : 'none';
  }
}

function cargarEstadoPrueba(){
  let d = load();
  if (!isTestAccount(d)) {
    return toast('Esta acción solo está disponible para la cuenta @prueba.');
  }
  if (!confirm('¿Cargar estado de prueba con 9.999 estrellas disponibles y todas las regiones celestes desbloqueadas en @prueba?')) {
    return;
  }
  
  d.wallet = 9999;
  d.bank = 9999;
  d.lifetimeStars = Math.max(Number(d.lifetimeStars || 0), 9999);
  d.unlockedRegions = ['cielo-1', 'zodiaco', 'orion', 'profundo'];
  d.observatoryLevel = 4;
  d.shipLevel = 4;
  // Mantener d.claimed intacto sin pre-comprar todas las constelaciones para probar compras y ceremonias
  if (!d.claimed) d.claimed = {};
  
  save(d);
  toast('✦ Estado de prueba cargado: 9.999 ★ y todos los cielos desbloqueados.');
  render();
}

function restablecerEstadoPrueba(){
  let d = load();
  if (!isTestAccount(d)) {
    return toast('Esta acción solo está disponible para la cuenta @prueba.');
  }
  if (!confirm('⚠️ ¿Estás segura de restablecer el estado de Orbit para la cuenta @prueba a valores iniciales limpios?')) {
    return;
  }
  
  let preservedProfile = d.profile ? { ...d.profile } : { username: 'prueba', displayName: 'Prueba' };
  
  let cleanD = defaults();
  cleanD.profile = preservedProfile;
  cleanD.unlockedRegions = ['cielo-1'];
  cleanD.wallet = 0;
  cleanD.bank = 0;
  cleanD.lifetimeStars = 0;
  cleanD.claimed = {};
  cleanD.observatoryLevel = 0;
  cleanD.shipLevel = 0;
  
  save(cleanD);
  toast('✦ Estado de @prueba restablecido a valores limpios.');
  render();
}

async function saveProfile(){
  let d = load();
  let dn = document.getElementById('profileDisplayName');
  let un = document.getElementById('profileUsername');
  let bd = document.getElementById('profileBirthDate');
  if(!d.profile) d.profile = {};

  let newName = dn ? dn.value.trim() : '';
  let rawUname = un ? un.value.trim().replace(/^@/,'').toLowerCase() : '';
  let newBdate = (bd && bd.value) ? bd.value : null;

  // Validación previa de username si se proporciona
  if (rawUname) {
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(rawUname)) {
      return toast('El usuario debe tener entre 3 y 20 caracteres (solo letras, números y _)');
    }
  }

  // 1. Si hay sesión en la nube, actualizar PRIMERO en Supabase (fuente de verdad)
  if (typeof supabaseUpdateProfile === 'function' && typeof currentCloudUser !== 'undefined' && currentCloudUser) {
    const result = await supabaseUpdateProfile({
      username: rawUname || undefined,
      displayName: newName
    });

    if (!result.success) {
      toast(result.error || 'Error al actualizar el perfil');
      // No guardamos localmente el cambio rechazado, recargamos la vista del perfil con los valores previos
      renderProfile(d);
      return;
    }

    if (result.updates?.username) {
      d.profile.username = result.updates.username;
    }
    if (result.updates?.display_name) {
      d.profile.displayName = result.updates.display_name;
    }
  } else {
    if (rawUname) d.profile.username = rawUname;
    if (newName) d.profile.displayName = newName;
  }

  // Guardar fecha de nacimiento y confirmar localmente
  d.profile.birthDate = newBdate;
  save(d);
  isProfileEditing = false;
  toast('Perfil guardado');
  renderProfile(d);
  render();
}

function applySettingsChangePassword(){
  let input = document.getElementById('settingsNewPassword');
  let val = input ? input.value : '';
  if(!val || val.length < 10){
    return toast('La nueva contraseña debe tener al menos 10 caracteres');
  }
  if(typeof supabaseUpdatePassword === 'function'){
    supabaseUpdatePassword(val).then(() => {
      if(input) input.value = '';
    });
  }
}

function applySettingsChangeEmail(){
  let input = document.getElementById('settingsNewEmail');
  let val = input ? input.value.trim() : '';
  if(!val || !val.includes('@')){
    return toast('Introduce un correo electrónico válido');
  }
  if(typeof supabaseUpdateEmail === 'function'){
    supabaseUpdateEmail(val).then(() => {
      if(input) input.value = '';
    });
  }
}

function openDeleteAccountModal() {
  let input = document.getElementById('deleteAccountConfirmInput');
  let btn = document.getElementById('confirmDeleteAccountBtn');
  if (input) input.value = '';
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Eliminar mi cuenta para siempre';
  }
  openModal('deleteAccountModal');
}

function handleDeleteAccountInput(val) {
  let btn = document.getElementById('confirmDeleteAccountBtn');
  if (!btn) return;
  let isExactMatch = (val || '').trim() === 'ELIMINAR';
  btn.disabled = !isExactMatch;
  btn.style.opacity = isExactMatch ? '1' : '0.5';
  btn.style.cursor = isExactMatch ? 'pointer' : 'not-allowed';
}

function executeAccountDeletion() {
  let input = document.getElementById('deleteAccountConfirmInput');
  let val = input ? input.value.trim() : '';
  if (val !== 'ELIMINAR') {
    return toast('Debes escribir ELIMINAR para confirmar');
  }

  const secondConfirm = confirm('¿Estás 100% segura de que deseas eliminar definitivamente tu cuenta?\n\nEsta acción borrará de forma irreversible tu diario, fotos, estrellas, constelaciones y cuenta.');
  if (!secondConfirm) return;

  if (typeof supabaseDeleteAccount === 'function') {
    supabaseDeleteAccount();
  }
}

function openMyDataModal(){
  openModal('myDataModal');
}

function openCloudDetailsModal(){
  if (typeof updateSyncStatus === 'function' && typeof currentSyncState !== 'undefined') {
    updateSyncStatus(currentSyncState);
  }
  let emailEl = document.getElementById('cloudModalEmail');
  if (emailEl && typeof currentCloudUser !== 'undefined' && currentCloudUser) {
    emailEl.textContent = currentCloudUser.email || '';
  }
  openModal('cloudDetailsModal');
}

async function openCloudHistoryModal(){
  openModal('cloudHistoryModal');
  let container = document.getElementById('cloudHistoryList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:20px; font-size:12px; color:var(--muted);">Cargando historial de versiones…</div>';

  if (typeof fetchStateHistory !== 'function') {
    container.innerHTML = '<div style="text-align:center; padding:20px; font-size:12px; color:var(--muted);">Servicio de historial no disponible</div>';
    return;
  }

  const res = await fetchStateHistory(50);
  if (!res.ok || !Array.isArray(res.history)) {
    container.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; color:var(--muted);">${esc(res.error || 'No se pudo cargar el historial')}</div>`;
    return;
  }

  if (res.history.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; font-size:12px; color:var(--muted);">No hay snapshots previos guardados todavía.</div>';
    return;
  }

  renderCloudHistoryList(res.history);
}

function renderCloudHistoryList(historyItems){
  let container = document.getElementById('cloudHistoryList');
  if (!container) return;

  container.innerHTML = historyItems.map(item => {
    let dateStr = 'Fecha desconocida';
    try {
      const dt = new Date(item.created_at || item.source_updated_at);
      dateStr = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch(e){}

    const p = item.data_preview || {};
    const wallet = Number(p.wallet || 0).toFixed(1).replace('.', ',');
    const lifetime = Number(p.lifetimeStars || 0).toFixed(1).replace('.', ',');
    const journal = Number(p.journalCount || 0);
    const goods = Number(p.goodThingsCount || 0);
    const urges = Number(p.urgesCount || 0);
    const regions = Number(p.regionsCount || 1);

    let reasonLabel = 'Copia automática';
    if (item.reason && item.reason.startsWith('manual:')) {
      reasonLabel = 'Copia segura manual';
    }

    const summaryMeta = `${journal} diario, ${goods} recuerdos, ${lifetime} ★`;

    return `
      <div class="cloud-history-item">
        <div class="history-meta-top">
          <span class="history-date">${esc(dateStr)}</span>
          <span class="history-reason-badge">${esc(reasonLabel)}</span>
        </div>
        <div class="history-badges-row">
          <span class="history-badge"><strong>${goods}</strong> recuerdos</span>
          <span class="history-badge"><strong>${journal}</strong> diario</span>
          <span class="history-badge"><strong>${lifetime}</strong> ★ total</span>
          <span class="history-badge"><strong>${wallet}</strong> ★ disponibles</span>
          ${regions > 1 ? `<span class="history-badge"><strong>${regions}</strong> cielos</span>` : ''}
          ${urges > 0 ? `<span class="history-badge"><strong>${urges}</strong> impulsos</span>` : ''}
        </div>
        <button type="button" class="btn btn-line history-restore-btn" onclick="executeRestoreCloudHistory('${esc(item.history_id)}', '${esc(dateStr)} (${esc(summaryMeta)})')">
          <svg class="icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke:currentColor;"><path d="M2.5 2v6h6M21.5 22v-6h-6M22 11.5a10 10 0 0 0-18.8-4.3M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
          <span>Restaurar esta versión</span>
        </button>
      </div>
    `;
  }).join('');
}

async function handleCreateSafeBackupNow(){
  if (typeof createCloudSnapshotNow !== 'function') return;
  toast('Creando copia segura…');
  const res = await createCloudSnapshotNow('manual_settings');
  if (res.ok) {
    if (typeof updateSyncStatus === 'function' && typeof currentSyncState !== 'undefined') {
      updateSyncStatus(currentSyncState);
    }
  }
}

async function executeRestoreCloudHistory(historyId, metaSummary){
  if (!historyId) return;
  const ok = confirm(`¿Estás segura de restaurar la versión de ${metaSummary}?\n\nSe sustituirán los datos actuales por esta copia anterior. Se creará automáticamente un respaldo previo del estado que vas a reemplazar.`);
  if (!ok) return;

  if (typeof restoreFromCloudHistory !== 'function') return;
  toast('Restaurando versión…');
  await restoreFromCloudHistory(historyId);
}

function openCloudConflictModal() {
  openModal('cloudConflictModal');
  renderCloudConflictModal();
}

function renderCloudConflictModal() {
  const container = document.getElementById('cloudConflictComparison');
  if (!container) return;

  const conflict = typeof getCurrentSyncConflict === 'function' ? getCurrentSyncConflict() : null;
  if (!conflict) {
    container.innerHTML = '<div style="text-align:center; padding:16px; font-size:12px; color:var(--muted);">No hay información de diferencias disponible en este momento.</div>';
    return;
  }

  const localM = conflict.localMetrics || {};
  const cloudM = conflict.cloudMetrics || {};

  // Formateo de fechas comprensibles
  let localTimeStr = 'Este dispositivo';
  if (conflict.localUpdatedAt) {
    try {
      const dt = new Date(conflict.localUpdatedAt);
      localTimeStr = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' · ' + dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch(e){}
  }

  let cloudTimeStr = 'Desconocido';
  if (conflict.cloudUpdatedAt) {
    try {
      const dt = new Date(conflict.cloudUpdatedAt);
      cloudTimeStr = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' · ' + dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch(e){}
  }

  // Evaluación no vinculante de volumen / completitud
  const localScore = (localM.goodThingsCount || 0) * 2 + (localM.journalCount || 0) * 2 + (localM.checkinsCount || 0) + (localM.lifetimeStars || 0);
  const cloudScore = (cloudM.goodThingsCount || 0) * 2 + (cloudM.journalCount || 0) * 2 + (cloudM.checkinsCount || 0) + (cloudM.lifetimeStars || 0);

  const localMore = localScore > (cloudScore + 1.5);
  const cloudMore = cloudScore > (localScore + 1.5);

  // Lista de métricas a comparar
  const metricsList = [
    { label: 'Recuerdos', local: localM.goodThingsCount || 0, cloud: cloudM.goodThingsCount || 0 },
    { label: 'Diario', local: localM.journalCount || 0, cloud: cloudM.journalCount || 0 },
    { label: 'Check-ins', local: localM.checkinsCount || 0, cloud: cloudM.checkinsCount || 0 },
    { label: 'Impulsos', local: localM.urgesCount || 0, cloud: cloudM.urgesCount || 0, showIfZero: false },
    { label: 'Tropiezos', local: localM.slipsCount || 0, cloud: cloudM.slipsCount || 0, showIfZero: false },
    { label: 'Estrellas totales', local: Number(localM.lifetimeStars || 0).toFixed(1).replace('.', ','), cloud: Number(cloudM.lifetimeStars || 0).toFixed(1).replace('.', ',') },
    { label: 'Hitos de racha', local: localM.milestonesCount || 0, cloud: cloudM.milestonesCount || 0 },
    { label: 'Regiones desbloqueadas', local: localM.unlockedRegionsCount || 1, cloud: cloudM.unlockedRegionsCount || 1 }
  ];

  const rowsHtml = metricsList
    .filter(m => m.showIfZero !== false || (m.local > 0 || m.cloud > 0))
    .map(m => `
      <tr>
        <td>${esc(m.label)}</td>
        <td><strong>${esc(String(m.local))}</strong></td>
        <td><strong>${esc(String(m.cloud))}</strong></td>
      </tr>
    `).join('');

  container.innerHTML = `
    <div class="conflict-table-card">
      <table class="conflict-comparison-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>
              <div class="conflict-header-label">
                <span>Este dispositivo</span>
                ${localMore ? '<span class="conflict-more-info-tag">✦ Más contenido</span>' : ''}
              </div>
            </th>
            <th>
              <div class="conflict-header-label">
                <span>Nube</span>
                ${cloudMore ? '<span class="conflict-more-info-tag">✦ Más contenido</span>' : ''}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="conflict-timestamps-box">
      <div class="conflict-time-row">
        <span class="conflict-time-label">Último cambio en este dispositivo:</span>
        <span class="conflict-time-val">${esc(localTimeStr)}</span>
      </div>
      <div class="conflict-time-row">
        <span class="conflict-time-label">Último cambio en la nube:</span>
        <span class="conflict-time-val">${esc(cloudTimeStr)}</span>
      </div>
    </div>
  `;
}

async function handleResolveConflictCloud() {
  const ok = confirm('¿Deseas adoptar la versión guardada en la NUBE?\n\nLos datos de este dispositivo se sustituirán por la copia de la nube. Orbit guardará previamente una copia de seguridad en este dispositivo.');
  if (!ok) return;

  if (typeof resolveConflictUsingCloud !== 'function') return;
  toast('Aplicando versión de la nube…');
  await resolveConflictUsingCloud();
}

async function handleResolveConflictLocal() {
  const ok = confirm('⚠️ ¿Deseas conservar la versión de ESTE DISPOSITIVO y actualizar la nube?\n\nEsta acción sobrescribirá la copia en la nube con los datos que ves ahora en pantalla. Se crearán copias de seguridad previas tanto en la nube como en local.');
  if (!ok) return;

  if (typeof resolveConflictUsingLocal !== 'function') return;
  toast('Actualizando nube con este dispositivo…');
  await resolveConflictUsingLocal();
}
function clearActiveFormInputs() {
  const ids = [
    'slipNote', 'needToday', 'forMeToday', 'gratitude1', 'gratitude2', 'gratitude3',
    'quickText', 'goodThing', 'goodMeaning', 'goodPhotoInput',
    'journalText', 'journalTitle', 'notCheckingName', 'notCheckingSub',
    'rewardName', 'rewardCost', 'orbitName', 'orbitMeaning'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'file') el.value = '';
      else el.value = '';
    }
  });
}

setInterval(() => {
  if (typeof getOrbitActiveUserId === 'function' && getOrbitActiveUserId()) {
    render();
  }
}, 60000);

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
