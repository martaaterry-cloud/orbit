// Persistencia, migraciones de versión, exportación y copias de seguridad.
// Extraído y centralizado para disponibilidad inmediata en todos los módulos.

const HOUR=3600000, STEP=2*HOUR;
function uid(){return Math.random().toString(36).slice(2,10)}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmt(ms){let h=Math.floor(ms/HOUR),m=Math.floor((ms%HOUR)/60000);if(h>=24)return Math.floor(h/24)+'d '+(h%24)+'h';return h+'h '+String(m).padStart(2,'0')+'m'}
function toast(msg){let t=document.getElementById('toast');if(t){t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>t.classList.remove('show'),1900)}}

function dayKey(ts=Date.now()){let d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

let currentOrbitUserId = null;

function setOrbitActiveUser(user) {
  if (user && user.id) {
    currentOrbitUserId = user.id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('orbitActiveUserId', user.id);
      localStorage.setItem('orbitKnownUser', JSON.stringify({
        id: user.id,
        email: user.email || '',
        username: user.user_metadata?.username || ''
      }));
    }
  } else {
    currentOrbitUserId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('orbitActiveUserId');
      localStorage.removeItem('orbitKnownUser');
    }
  }
}

function getOrbitActiveUserId() {
  if (currentOrbitUserId) return currentOrbitUserId;
  if (typeof localStorage !== 'undefined') {
    let stored = localStorage.getItem('orbitActiveUserId');
    if (stored) return stored;
    try {
      let known = JSON.parse(localStorage.getItem('orbitKnownUser') || '{}');
      if (known && known.id) return known.id;
    } catch(e){}
  }
  return null;
}

function getUserStorageKey(baseKey, userId) {
  let uid = userId || getOrbitActiveUserId();
  return uid ? `${baseKey}:${uid}` : null;
}


// Purga total y segura de los datos locales asociados a un usuario eliminado
function purgeLocalUserData(userId) {
  if (!userId || typeof localStorage === 'undefined') return;
  const uid = String(userId);

  // 1. Claves directas con prefijo del usuario
  const directKeys = [
    `orbitV9:${uid}`,
    `orbitTimer:${uid}`,
    `orbitLocalUpdatedAt:${uid}`,
    `orbitLastCloudUpdatedAt:${uid}`,
    `orbitHasUnsyncedChanges:${uid}`,
    `orbitMigrationDone:${uid}`,
    `orbitV9_migrated_${uid}_backup`
  ];

  directKeys.forEach(k => {
    try { localStorage.removeItem(k); } catch(e){}
  });

  // 2. Limpieza de cualquier otra clave residual que contenga el UUID
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(uid)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch(e){}
    });
  } catch(e){}

  // 3. Si era el usuario activo, vaciar estado activo
  if (currentOrbitUserId === uid) {
    setOrbitActiveUser(null);
  }
}

// En v1.3.15+ todo el almacenamiento es estrictamente scoped por user.id.
// Se purgan claves legacy no scoped para prevenir cualquier cruce de datos.
function migrateLegacyStorageIfVerified(user, priorKnownIdentity) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('orbitV9');
      localStorage.removeItem('orbitTimer');
      localStorage.removeItem('orbitLocalUpdatedAt');
      localStorage.removeItem('orbitLastCloudUpdatedAt');
      localStorage.removeItem('orbitHasUnsyncedChanges');
    } catch(e){}
  }
}


function defaults(){
 const n=Date.now();
 return {v:9,templateId:'ruptura',focusAreas:[{id:'ruptura',status:'active',startedAt:n,archivedAt:null}],profile:{displayName:'',username:'',birthDate:null},wallet:0,lifetimeStars:0,bank:0,claimed:{},best:0,pointAwards:{},returnToMe:{since:n,awardedMilestones:[],best:0},
 goals:[
  {id:'msg',icon:'chat',name:'Su última conexión o si me ha escrito',sub:'Elegir no abrir la conversación solo para buscar una señal',since:n},
  {id:'insta',icon:'insta',name:'Sus historias o seguidos en redes',sub:'Elegir no mirar cambios de perfil para calmar la ansiedad',since:n},
  {id:'photos',icon:'search',name:'Fotos antiguas o conversaciones pasadas',sub:'Elegir no revivir el pasado cuando siento nostalgia',since:n},
  {id:'friends',icon:'chat',name:'Preguntar a amigos comunes sobre cómo está',sub:'Elegir cuidar mi espacio y no buscar información indirecta',since:n}],
 rewards:[
 {id:'r1',name:'Café o bebida que me apetezca',cost:5},
 {id:'r2',name:'Flores para mí',cost:10},
 {id:'r3',name:'Un libro',cost:15},
 {id:'r4',name:'Un pequeño capricho',cost:20},
 {id:'r5',name:'Un plan que me ilusione',cost:40}],
 urges:[],slips:[],journal:[],checkins:{},goodThings:[],
 boosters:{active:[],inventory:[],progress:{survivedUrgesCount:0,awardedBraveThresholds:[],lastNightOfConstancyStreakTs:null}},
 orbit:[
 {id:'o1',name:'Escribir',meaning:'poner palabras a lo que siento'},
 {id:'o2',name:'Movimiento',meaning:'volver a mi cuerpo'},
 {id:'o3',name:'Amistades',meaning:'sentirme acompañada'},
 {id:'o4',name:'Planes sola',meaning:'disfrutar mi propia compañía'},
 {id:'o5',name:'Proyectos',meaning:'algo que también es mío'}]}
}

function isOrbitStateVirginOrEmpty(d) {
  if (!d || typeof d !== 'object') return true;

  // 1. Registros en el diario
  if (Array.isArray(d.journal) && d.journal.length > 0) return false;

  // 2. Recuerdos (lo que sí pasó / goodThings)
  if (Array.isArray(d.goodThings) && d.goodThings.length > 0) return false;

  // 3. Impulsos registrados
  if (Array.isArray(d.urges) && d.urges.length > 0) return false;

  // 4. Tropiezos registrados
  if (Array.isArray(d.slips) && d.slips.length > 0) return false;

  // 5. Check-ins completados
  if (d.checkins && typeof d.checkins === 'object' && Object.keys(d.checkins).length > 0) return false;

  // 6. Eventos de estrellas ganadas en pointAwards
  if (d.pointAwards && typeof d.pointAwards === 'object') {
    const hasEvents = Object.values(d.pointAwards).some(dayObj =>
      dayObj && Array.isArray(dayObj.events) && dayObj.events.length > 0
    );
    if (hasEvents) return false;
  }

  // 7. Hitos otorgados de racha
  if (d.returnToMe && Array.isArray(d.returnToMe.awardedMilestones) && d.returnToMe.awardedMilestones.length > 0) return false;

  // 8. Estrellas acumuladas en cartera o históricas
  if (Number(d.wallet || 0) > 0 || Number(d.lifetimeStars || 0) > 0 || Number(d.bank || 0) > 0) return false;

  // 9. Recompensas reclamadas
  if (d.claimed && typeof d.claimed === 'object' && Object.keys(d.claimed).length > 0) return false;

  // 10. Fecha de cumpleaños personalizada (la existencia de displayName/username de auth no cuenta como progreso)
  if (d.profile && typeof d.profile === 'object' && d.profile.birthDate) return false;


  // 11. Pilares personalizados
  if (Array.isArray(d.orbit)) {
    if (d.orbit.length !== 5) return false;
    const defaultIds = ['o1', 'o2', 'o3', 'o4', 'o5'];
    const hasCustom = d.orbit.some(o => !o || !defaultIds.includes(o.id));
    if (hasCustom) return false;
  }

  // 12. Boosters activos o en inventario
  if (d.boosters) {
    if (Array.isArray(d.boosters.active) && d.boosters.active.length > 0) return false;
    if (Array.isArray(d.boosters.inventory) && d.boosters.inventory.length > 0) return false;
    if (d.boosters.progress && Number(d.boosters.progress.survivedUrgesCount || 0) > 0) return false;
  }

  return true;
}

function getOrbitStateMetrics(d) {
  if (!d || typeof d !== 'object') {
    return {
      isEmpty: true,
      journalCount: 0,
      goodThingsCount: 0,
      checkinsCount: 0,
      urgesCount: 0,
      slipsCount: 0,
      pointAwardsEventsCount: 0,
      pointAwardsDaysCount: 0,
      wallet: 0,
      lifetimeStars: 0,
      milestonesCount: 0,
      customPillarsCount: 0,
      rewardsCount: 0,
      boostersCount: 0,
      unlockedRegionsCount: 0,
      observatoryLevel: 0
    };
  }

  const journalCount = Array.isArray(d.journal) ? d.journal.length : 0;
  const goodThingsCount = Array.isArray(d.goodThings) ? d.goodThings.length : 0;
  const checkinsCount = (d.checkins && typeof d.checkins === 'object') ? Object.keys(d.checkins).length : 0;
  const urgesCount = Array.isArray(d.urges) ? d.urges.length : 0;
  const slipsCount = Array.isArray(d.slips) ? d.slips.length : 0;

  let pointAwardsEventsCount = 0;
  let pointAwardsDaysCount = 0;
  if (d.pointAwards && typeof d.pointAwards === 'object') {
    const days = Object.keys(d.pointAwards);
    pointAwardsDaysCount = days.length;
    days.forEach(k => {
      const dayObj = d.pointAwards[k];
      if (dayObj && Array.isArray(dayObj.events)) {
        pointAwardsEventsCount += dayObj.events.length;
      }
    });
  }

  const wallet = Number(d.wallet || 0);
  const lifetimeStars = Number(d.lifetimeStars || 0);
  const milestonesCount = (d.returnToMe && Array.isArray(d.returnToMe.awardedMilestones)) ? d.returnToMe.awardedMilestones.length : 0;

  let customPillarsCount = 0;
  if (Array.isArray(d.orbit)) {
    const defaultIds = ['o1', 'o2', 'o3', 'o4', 'o5'];
    customPillarsCount = d.orbit.filter(o => o && !defaultIds.includes(o.id)).length;
  }

  const rewardsCount = Array.isArray(d.rewards) ? d.rewards.length : 0;
  let boostersCount = 0;
  if (d.boosters) {
    boostersCount += (Array.isArray(d.boosters.active) ? d.boosters.active.length : 0);
    boostersCount += (Array.isArray(d.boosters.inventory) ? d.boosters.inventory.length : 0);
    if (d.boosters.progress && Array.isArray(d.boosters.progress.awardedBraveThresholds)) {
      boostersCount += d.boosters.progress.awardedBraveThresholds.length;
    }
  }

  const unlockedRegionsCount = Array.isArray(d.unlockedRegions) ? d.unlockedRegions.length : 1;
  const observatoryLevel = Number(d.observatoryLevel || d.shipLevel || 0);

  const isVirgin = isOrbitStateVirginOrEmpty(d);

  return {
    isEmpty: isVirgin,
    journalCount,
    goodThingsCount,
    checkinsCount,
    urgesCount,
    slipsCount,
    pointAwardsEventsCount,
    pointAwardsDaysCount,
    wallet,
    lifetimeStars,
    milestonesCount,
    customPillarsCount,
    rewardsCount,
    boostersCount,
    unlockedRegionsCount,
    observatoryLevel
  };
}

function detectSuspiciousReduction(currentState, incomingState) {
  const currentMetrics = getOrbitStateMetrics(currentState);
  const incomingMetrics = getOrbitStateMetrics(incomingState);

  // Si el estado actual es virgen o vacío, cualquier incoming es válido
  if (currentMetrics.isEmpty) {
    return { isSuspicious: false, reasons: [], currentMetrics, incomingMetrics };
  }

  // Si el nuevo estado está completamente vacío mientras el actual tiene datos reales
  if (incomingMetrics.isEmpty && !currentMetrics.isEmpty) {
    return {
      isSuspicious: true,
      reasons: ['El nuevo estado está vacío mientras el estado actual contiene datos.'],
      currentMetrics,
      incomingMetrics
    };
  }

  const reasons = [];

  // 1. CAMPOS MONOTÓNICOS / IRREVERSIBLES (Caída es altamente sospechosa)
  if (currentMetrics.lifetimeStars > 0 && incomingMetrics.lifetimeStars < (currentMetrics.lifetimeStars - 0.5)) {
    reasons.push(`Caída de estrellas históricas (${currentMetrics.lifetimeStars} ★ → ${incomingMetrics.lifetimeStars} ★).`);
  }

  if (currentMetrics.milestonesCount > 0 && incomingMetrics.milestonesCount < currentMetrics.milestonesCount) {
    reasons.push(`Pérdida de hitos de racha concedidos (${currentMetrics.milestonesCount} → ${incomingMetrics.milestonesCount}).`);
  }

  if (currentMetrics.unlockedRegionsCount > 1 && incomingMetrics.unlockedRegionsCount < currentMetrics.unlockedRegionsCount) {
    reasons.push(`Pérdida de regiones celestes desbloqueadas (${currentMetrics.unlockedRegionsCount} → ${incomingMetrics.unlockedRegionsCount}).`);
  }

  if (currentMetrics.observatoryLevel > 0 && incomingMetrics.observatoryLevel < currentMetrics.observatoryLevel) {
    reasons.push(`Caída de nivel del observatorio (${currentMetrics.observatoryLevel} → ${incomingMetrics.observatoryLevel}).`);
  }

  // 2. COLECCIONES VARIABLES (El usuario puede borrar elementos puntuales de 1 en 1 de forma legítima,
  //    pero una caída masiva o simultánea en varias categorías es sospechosa de mutilación)
  // Diario: caída >= 50% y de al menos 3 entradas
  if (currentMetrics.journalCount >= 4 && (currentMetrics.journalCount - incomingMetrics.journalCount) >= 3) {
    const ratio = incomingMetrics.journalCount / currentMetrics.journalCount;
    if (ratio <= 0.5) {
      reasons.push(`Reducción importante en el diario (${currentMetrics.journalCount} → ${incomingMetrics.journalCount} entradas).`);
    }
  } else if (currentMetrics.journalCount >= 2 && incomingMetrics.journalCount === 0) {
    reasons.push(`Desaparición completa de las entradas de diario (${currentMetrics.journalCount} → 0).`);
  }

  // Recuerdos (goodThings): caída >= 50% y de al menos 3 recuerdos
  if (currentMetrics.goodThingsCount >= 4 && (currentMetrics.goodThingsCount - incomingMetrics.goodThingsCount) >= 3) {
    const ratio = incomingMetrics.goodThingsCount / currentMetrics.goodThingsCount;
    if (ratio <= 0.5) {
      reasons.push(`Reducción importante en recuerdos (${currentMetrics.goodThingsCount} → ${incomingMetrics.goodThingsCount}).`);
    }
  } else if (currentMetrics.goodThingsCount >= 2 && incomingMetrics.goodThingsCount === 0) {
    reasons.push(`Desaparición completa de recuerdos (${currentMetrics.goodThingsCount} → 0).`);
  }

  // Checkins: desaparición completa si había varios
  if (currentMetrics.checkinsCount >= 3 && incomingMetrics.checkinsCount === 0) {
    reasons.push(`Desaparición de registros de check-in (${currentMetrics.checkinsCount} → 0).`);
  }

  // Eventos de estrellas (pointAwards): caída drástica
  if (currentMetrics.pointAwardsEventsCount >= 6 && incomingMetrics.pointAwardsEventsCount <= 1) {
    reasons.push(`Pérdida de eventos de esfuerzo (${currentMetrics.pointAwardsEventsCount} → ${incomingMetrics.pointAwardsEventsCount}).`);
  }

  // NOTA: 'wallet' puede disminuir normalmente por compras, no se evalúa como pérdida.

  const isSuspicious = reasons.length > 0;
  return {
    isSuspicious,
    reasons,
    currentMetrics,
    incomingMetrics
  };
}

// Comparación precisa de contenido basada en identificadores reales
function compareOrbitStateContent(localState, cloudState) {
  const localM = getOrbitStateMetrics(localState);
  const cloudM = getOrbitStateMetrics(cloudState);

  const isLocalEmpty = localM.isEmpty;
  const isCloudEmpty = cloudM.isEmpty;

  if (isLocalEmpty && isCloudEmpty) {
    return {
      status: 'identical',
      localIsSubsetOfCloud: true,
      cloudIsSubsetOfLocal: true,
      localExclusiveCount: 0,
      cloudExclusiveCount: 0,
      localExclusiveDetails: [],
      cloudExclusiveDetails: [],
      localM,
      cloudM
    };
  }

  if (isLocalEmpty && !isCloudEmpty) {
    return {
      status: 'local_is_subset_of_cloud',
      localIsSubsetOfCloud: true,
      cloudIsSubsetOfLocal: false,
      localExclusiveCount: 0,
      cloudExclusiveCount: 1,
      localExclusiveDetails: [],
      cloudExclusiveDetails: ['La nube contiene datos mientras el local está vacío.'],
      localM,
      cloudM
    };
  }

  if (!isLocalEmpty && isCloudEmpty) {
    return {
      status: 'cloud_is_subset_of_local',
      localIsSubsetOfCloud: false,
      cloudIsSubsetOfLocal: true,
      localExclusiveCount: 1,
      cloudExclusiveCount: 0,
      localExclusiveDetails: ['El local contiene datos mientras la nube está vacía.'],
      cloudExclusiveDetails: [],
      localM,
      cloudM
    };
  }

  const localExclusiveDetails = [];
  const cloudExclusiveDetails = [];

  // Helper para comparar arrays de objetos con id
  function compareIdArray(name, localArr, cloudArr) {
    const lArr = Array.isArray(localArr) ? localArr : [];
    const cArr = Array.isArray(cloudArr) ? cloudArr : [];

    const lMap = new Map();
    lArr.forEach((item, idx) => {
      const id = item?.id || `idx_${idx}_${JSON.stringify(item)}`;
      lMap.set(id, item);
    });

    const cMap = new Map();
    cArr.forEach((item, idx) => {
      const id = item?.id || `idx_${idx}_${JSON.stringify(item)}`;
      cMap.set(id, item);
    });

    lMap.forEach((_, id) => {
      if (!cMap.has(id)) {
        localExclusiveDetails.push(`Elemento exclusivo en ${name} local (id: ${id})`);
      }
    });

    cMap.forEach((_, id) => {
      if (!lMap.has(id)) {
        cloudExclusiveDetails.push(`Elemento exclusivo en ${name} nube (id: ${id})`);
      }
    });
  }

  // 1. Recuerdos (goodThings)
  compareIdArray('recuerdos', localState?.goodThings, cloudState?.goodThings);

  // 2. Diario (journal)
  compareIdArray('diario', localState?.journal, cloudState?.journal);

  // 3. Impulsos (urges)
  compareIdArray('impulsos', localState?.urges, cloudState?.urges);

  // 4. Tropiezos (slips)
  compareIdArray('tropiezos', localState?.slips, cloudState?.slips);

  // 5. Check-ins por fecha
  const lCheckins = localState?.checkins && typeof localState.checkins === 'object' ? Object.keys(localState.checkins) : [];
  const cCheckins = cloudState?.checkins && typeof cloudState.checkins === 'object' ? Object.keys(cloudState.checkins) : [];
  const lCheckinsSet = new Set(lCheckins);
  const cCheckinsSet = new Set(cCheckins);

  lCheckinsSet.forEach(day => {
    if (!cCheckinsSet.has(day)) localExclusiveDetails.push(`Check-in exclusivo local (${day})`);
  });
  cCheckinsSet.forEach(day => {
    if (!lCheckinsSet.has(day)) cloudExclusiveDetails.push(`Check-in exclusivo nube (${day})`);
  });

  // 6. PointAwards (Eventos de estrellas)
  function extractPointAwardIds(pointAwardsObj) {
    const ids = new Set();
    if (pointAwardsObj && typeof pointAwardsObj === 'object') {
      Object.entries(pointAwardsObj).forEach(([day, dayObj]) => {
        if (dayObj && Array.isArray(dayObj.events)) {
          dayObj.events.forEach((ev, idx) => {
            const id = ev?.id || `${day}_${ev?.type || 'pt'}_${ev?.points || 0}_${idx}`;
            ids.add(id);
          });
        }
      });
    }
    return ids;
  }
  const lPts = extractPointAwardIds(localState?.pointAwards);
  const cPts = extractPointAwardIds(cloudState?.pointAwards);
  lPts.forEach(id => {
    if (!cPts.has(id)) localExclusiveDetails.push(`Evento de estrella exclusivo local (${id})`);
  });
  cPts.forEach(id => {
    if (!lPts.has(id)) cloudExclusiveDetails.push(`Evento de estrella exclusivo nube (${id})`);
  });

  // 7. Hitos de racha (awardedMilestones)
  const lMilestones = new Set(Array.isArray(localState?.returnToMe?.awardedMilestones) ? localState.returnToMe.awardedMilestones : []);
  const cMilestones = new Set(Array.isArray(cloudState?.returnToMe?.awardedMilestones) ? cloudState.returnToMe.awardedMilestones : []);
  lMilestones.forEach(m => {
    if (!cMilestones.has(m)) localExclusiveDetails.push(`Hito de racha exclusivo local (${m})`);
  });
  cMilestones.forEach(m => {
    if (!lMilestones.has(m)) cloudExclusiveDetails.push(`Hito de racha exclusivo nube (${m})`);
  });

  // 8. Regiones celestes (unlockedRegions)
  const lRegions = new Set(Array.isArray(localState?.unlockedRegions) ? localState.unlockedRegions : ['cielo-1']);
  const cRegions = new Set(Array.isArray(cloudState?.unlockedRegions) ? cloudState.unlockedRegions : ['cielo-1']);
  lRegions.forEach(r => {
    if (!cRegions.has(r)) localExclusiveDetails.push(`Región celeste exclusiva local (${r})`);
  });
  cRegions.forEach(r => {
    if (!lRegions.has(r)) cloudExclusiveDetails.push(`Región celeste exclusiva nube (${r})`);
  });

  // Evaluación de métricas monotónicas
  const localLifetime = Number(localState?.lifetimeStars || 0);
  const cloudLifetime = Number(cloudState?.lifetimeStars || 0);
  const localObservatory = Number(localState?.observatoryLevel || 0);
  const cloudObservatory = Number(cloudState?.observatoryLevel || 0);
  const localShip = Number(localState?.shipLevel || 0);
  const cloudShip = Number(cloudState?.shipLevel || 0);

  const localHasStrictlyHigherMonotonic = (localLifetime > cloudLifetime + 0.1) ||
                                         (localObservatory > cloudObservatory) ||
                                         (localShip > cloudShip);
  const cloudHasStrictlyHigherMonotonic = (cloudLifetime > localLifetime + 0.1) ||
                                         (cloudObservatory > localObservatory) ||
                                         (cloudShip > localShip);

  const localExclusiveCount = localExclusiveDetails.length;
  const cloudExclusiveCount = cloudExclusiveDetails.length;

  let status = 'diverged';
  let localIsSubsetOfCloud = false;
  let cloudIsSubsetOfLocal = false;

  if (localExclusiveCount === 0 && cloudExclusiveCount === 0) {
    if (!localHasStrictlyHigherMonotonic && !cloudHasStrictlyHigherMonotonic) {
      status = 'identical';
      localIsSubsetOfCloud = true;
      cloudIsSubsetOfLocal = true;
    } else if (cloudHasStrictlyHigherMonotonic && !localHasStrictlyHigherMonotonic) {
      status = 'local_is_subset_of_cloud';
      localIsSubsetOfCloud = true;
      cloudIsSubsetOfLocal = false;
    } else if (localHasStrictlyHigherMonotonic && !cloudHasStrictlyHigherMonotonic) {
      status = 'cloud_is_subset_of_local';
      localIsSubsetOfCloud = false;
      cloudIsSubsetOfLocal = true;
    } else {
      status = 'diverged';
    }
  } else if (localExclusiveCount === 0 && cloudExclusiveCount > 0) {
    // Todo lo local está en la nube, y la nube tiene contenido adicional
    if (!localHasStrictlyHigherMonotonic) {
      status = 'local_is_subset_of_cloud';
      localIsSubsetOfCloud = true;
      cloudIsSubsetOfLocal = false;
    } else {
      // Conflicto: local tiene menos ítems pero más estrellas históricas
      status = 'diverged';
    }
  } else if (cloudExclusiveCount === 0 && localExclusiveCount > 0) {
    // Todo lo de la nube está en local, y local tiene contenido adicional
    if (!cloudHasStrictlyHigherMonotonic) {
      status = 'cloud_is_subset_of_local';
      localIsSubsetOfCloud = false;
      cloudIsSubsetOfLocal = true;
    } else {
      // Conflicto: nube tiene menos ítems pero más estrellas históricas
      status = 'diverged';
    }
  } else {
    // Ambos lados tienen contenido exclusivo
    status = 'diverged';
  }

  return {
    status,
    localIsSubsetOfCloud,
    cloudIsSubsetOfLocal,
    localExclusiveCount,
    cloudExclusiveCount,
    localExclusiveDetails,
    cloudExclusiveDetails,
    localHasStrictlyHigherMonotonic,
    cloudHasStrictlyHigherMonotonic,
    localM,
    cloudM
  };
}

function load(userId){
 let d;
 let isVirgin = false;
 let key = getUserStorageKey('orbitV9', userId);
 if(key){
  try{d=JSON.parse(localStorage.getItem(key))}catch{}
 }
 if(!d){
  d=defaults();
  isVirgin = true;
 }
 const insta=d.goals?.find(g=>g.id==='insta');if(insta){insta.name='No comprobar cambios en Instagram';insta.sub='No mirar seguidores, seguidos o cambios para calmar la ansiedad'}
 if(!d.goodThings)d.goodThings=[];
 if(!d.pointAwards)d.pointAwards={};
 if(d.wallet===undefined||d.wallet===null)d.wallet=Number(d.bank||0);
 if(d.lifetimeStars===undefined||d.lifetimeStars===null)d.lifetimeStars=Number(d.wallet||0);
 d.bank=d.wallet;
 if(!d.templateId)d.templateId='ruptura';
 if(!d.focusAreas||!Array.isArray(d.focusAreas)){
   let safeStartedAt=Number(d.returnToMe?.since||Date.now());
   d.focusAreas=[{id:d.templateId||'ruptura',status:'active',startedAt:safeStartedAt,archivedAt:null}];
 }else{
   d.focusAreas.forEach(area=>{
     if(area){
       if(!area.status)area.status='active';
       if(area.archivedAt===undefined)area.archivedAt=null;
       if(typeof area.startedAt!=='number')area.startedAt=Number(d.returnToMe?.since||Date.now());
     }
   });
 }
 if(!d.profile)d.profile={};
 if(d.profile.displayName===undefined)d.profile.displayName='';
 if(d.profile.username===undefined)d.profile.username='';
 if(d.profile.birthDate===undefined)d.profile.birthDate=null;
 if(d.profile.birthdayStarsClaimedYear===undefined)d.profile.birthdayStarsClaimedYear=null;
 if(!d.returnToMe){
   let starts=(d.goals||[]).map(g=>Number(g.since||Date.now()));
   let sharedSince=starts.length?Math.max(...starts):Date.now();
   d.returnToMe={since:sharedSince,awardedMilestones:[],best:Number(d.best||0)}
 }
 if(!d.boosters){
   d.boosters={active:[],inventory:[],progress:{survivedUrgesCount:0,awardedBraveThresholds:[],lastNightOfConstancyStreakTs:null}};
 }else{
   if(!Array.isArray(d.boosters.active)) d.boosters.active=[];
   if(!Array.isArray(d.boosters.inventory)) d.boosters.inventory=[];
   if(!d.boosters.progress) d.boosters.progress={};
   if(typeof d.boosters.progress.survivedUrgesCount !== 'number') d.boosters.progress.survivedUrgesCount=0;
   if(!Array.isArray(d.boosters.progress.awardedBraveThresholds)) d.boosters.progress.awardedBraveThresholds=[];
 }
  if(d.observatoryLevel===undefined) d.observatoryLevel = (d.shipLevel !== undefined ? d.shipLevel : 0);
  if(d.shipLevel===undefined) d.shipLevel = d.observatoryLevel;
  if(!d.unlockedRegions) d.unlockedRegions=['cielo-1'];
 if(Array.isArray(d.journal)){d.journal.forEach(e=>{if(e&&!e.id)e.id=uid()})}
 if(Array.isArray(d.goodThings)){d.goodThings.forEach(g=>{if(g&&!g.id)g.id=uid()})}
 if(Array.isArray(d.urges)){d.urges.forEach(u=>{if(u&&!u.id)u.id=uid()})}

 if(key){
  save(d, false, userId);
  let localUpKey = getUserStorageKey('orbitLocalUpdatedAt', userId);
  if(localUpKey && !localStorage.getItem(localUpKey) && !isVirgin){
    localStorage.setItem(localUpKey, new Date().toISOString());
  }
 }
 return d;
}

function save(d, markChange = true, userId){
 let key = getUserStorageKey('orbitV9', userId);
 if(!key) return; // Sin usuario autenticado activo: no persistir a claves globales
 localStorage.setItem(key, JSON.stringify(d));
 if(markChange && typeof window !== 'undefined'){
  if(window.isApplyingCloudState) return;
  let localUpKey = getUserStorageKey('orbitLocalUpdatedAt', userId);
  let unsyncKey = getUserStorageKey('orbitHasUnsyncedChanges', userId);
  if(localUpKey) localStorage.setItem(localUpKey, new Date().toISOString());
  if(unsyncKey) localStorage.setItem(unsyncKey, 'true');
  if(typeof scheduleCloudSync === 'function'){
   scheduleCloudSync();
  }
 }
}

function exportBackup(){
 let activeUid = typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null;
 if(!activeUid){
  if(typeof toast === 'function') toast('Inicia sesión para exportar tu copia de seguridad');
  return;
 }
 let key = getUserStorageKey('orbitV9', activeUid);
 let timerKey = getUserStorageKey('orbitTimer', activeUid);
 let mainData=null;
 try{mainData=JSON.parse(localStorage.getItem(key))}catch(e){}
 if(!mainData) mainData=load(activeUid);
 let timerData=null;
 try{timerData=JSON.parse(localStorage.getItem(timerKey))}catch(e){}
 let backupPayload={
  app:'orbit',
  version:1,
  schemaVersion:mainData.v||9,
  userId:activeUid,
  exportedAt:Date.now(),
  dateString:new Date().toISOString(),
  orbitData:mainData,
  orbitTimer:timerData||null
 };
 let jsonStr=JSON.stringify(backupPayload,null,2);
 let blob=new Blob([jsonStr],{type:'application/json'});
 let url=URL.createObjectURL(blob);
 let a=document.createElement('a');
 let d=new Date();
 let dateStr=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 a.href=url;
 a.download=`orbit-backup-${dateStr}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 toast('Copia de seguridad descargada');
}

function triggerImportBackup(){
 let input=document.getElementById('backupFileInput');
 if(input){input.value='';input.click()}
}

function handleBackupFile(e){
 let file=e.target.files&&e.target.files[0];
 if(!file)return;
 let activeUid = typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null;
 if(!activeUid){
  if(typeof toast === 'function') toast('Inicia sesión para restaurar una copia');
  return;
 }
 let reader=new FileReader();
 reader.onload=function(evt){
  try{
   let content=evt.target.result;
   let parsed=JSON.parse(content);
   let orbitData=parsed.orbitData||(parsed.v&&parsed.goals?parsed:null);
   if(!orbitData||typeof orbitData!=='object'||!Array.isArray(orbitData.goals)){
    toast('El archivo no tiene un formato válido de Orbit');
    return;
   }
   let dateInfo=parsed.exportedAt?new Date(parsed.exportedAt).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'reciente';
   let ok=confirm(`¿Restaurar copia de seguridad de ${dateInfo}?\n\nSe reemplazarán los datos de tu cuenta en Orbit.`);
   if(!ok)return;
   save(orbitData, true, activeUid);
   if(parsed.orbitTimer && typeof saveTimerState === 'function'){
    saveTimerState(parsed.orbitTimer, true, activeUid);
   }else if(typeof clearTimerState === 'function'){
    clearTimerState(true, activeUid);
   }
   toast('Copia restaurada correctamente');
   setTimeout(()=>{location.reload()},400);
  }catch(err){
   toast('Error al leer el archivo de copia');
  }
 };
 reader.readAsText(file);
}

// Purga inmediata de claves legacy globales no scoped al cargar el módulo
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('orbitV9');
    localStorage.removeItem('orbitTimer');
    localStorage.removeItem('orbitLocalUpdatedAt');
    localStorage.removeItem('orbitLastCloudUpdatedAt');
    localStorage.removeItem('orbitHasUnsyncedChanges');
  } catch(e){}
}

