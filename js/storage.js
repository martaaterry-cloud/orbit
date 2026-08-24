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

  // 10. Perfil personalizado
  if (d.profile && typeof d.profile === 'object') {
    if (d.profile.displayName && String(d.profile.displayName).trim() !== '') return false;
    if (d.profile.birthDate) return false;
  }

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

