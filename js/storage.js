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
  return uid ? `${baseKey}:${uid}` : baseKey;
}

// Migración segura de claves legacy al usuario autenticado (idempotente y con verificación estricta)
function migrateLegacyStorageIfVerified(user) {
  if (!user || !user.id || typeof localStorage === 'undefined') return;
  
  let migrationKey = 'orbitMigrationDone:' + user.id;
  if (localStorage.getItem(migrationKey)) return;

  let scopedKey = 'orbitV9:' + user.id;
  let hasScopedData = !!localStorage.getItem(scopedKey);
  
  if (hasScopedData) {
    localStorage.setItem(migrationKey, 'true');
    return;
  }

  let legacyV9 = localStorage.getItem('orbitV9');
  if (!legacyV9) {
    localStorage.setItem(migrationKey, 'true');
    return;
  }

  let rawKnown = localStorage.getItem('orbitKnownUser');
  let isVerified = false;
  
  if (rawKnown) {
    if (rawKnown === user.email) {
      isVerified = true;
    } else {
      try {
        let parsed = JSON.parse(rawKnown);
        if (parsed && (parsed.email === user.email || parsed.id === user.id)) {
          isVerified = true;
        }
      } catch(e){}
    }
  }

  if (isVerified) {
    try {
      localStorage.setItem('orbitV9:' + user.id, legacyV9);
      
      let legTimer = localStorage.getItem('orbitTimer');
      if (legTimer) localStorage.setItem('orbitTimer:' + user.id, legTimer);
      
      let legLocalUp = localStorage.getItem('orbitLocalUpdatedAt');
      if (legLocalUp) localStorage.setItem('orbitLocalUpdatedAt:' + user.id, legLocalUp);
      
      let legCloudUp = localStorage.getItem('orbitLastCloudUpdatedAt');
      if (legCloudUp) localStorage.setItem('orbitLastCloudUpdatedAt:' + user.id, legCloudUp);
      
      let legUnsync = localStorage.getItem('orbitHasUnsyncedChanges');
      if (legUnsync) localStorage.setItem('orbitHasUnsyncedChanges:' + user.id, legUnsync);

      localStorage.setItem('orbitV9_migrated_' + user.id + '_backup', legacyV9);
      localStorage.removeItem('orbitV9');
      localStorage.removeItem('orbitTimer');
      localStorage.removeItem('orbitLocalUpdatedAt');
      localStorage.removeItem('orbitLastCloudUpdatedAt');
      localStorage.removeItem('orbitHasUnsyncedChanges');
      
      localStorage.setItem(migrationKey, 'true');
    } catch(err) {
      console.warn('Error durante la migración legacy:', err);
    }
  } else {
    // Si no puede verificarse, se preserva en backup no reclamado
    try {
      localStorage.setItem('orbitV9_unclaimed_backup', legacyV9);
      localStorage.removeItem('orbitV9');
      localStorage.removeItem('orbitTimer');
      localStorage.removeItem('orbitLocalUpdatedAt');
      localStorage.removeItem('orbitLastCloudUpdatedAt');
      localStorage.removeItem('orbitHasUnsyncedChanges');
      localStorage.setItem(migrationKey, 'true');
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

function load(userId){
 let d;
 let key = getUserStorageKey('orbitV9', userId);
 try{d=JSON.parse(localStorage.getItem(key))}catch{}
 if(!d){
  d=defaults();
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
 if(d.shipLevel===undefined)d.shipLevel=0;
 if(!d.unlockedRegions)d.unlockedRegions=['cielo-1'];
 if(Array.isArray(d.journal)){d.journal.forEach(e=>{if(e&&!e.id)e.id=uid()})}
 if(Array.isArray(d.goodThings)){d.goodThings.forEach(g=>{if(g&&!g.id)g.id=uid()})}
 if(Array.isArray(d.urges)){d.urges.forEach(u=>{if(u&&!u.id)u.id=uid()})}

 save(d, false, userId);
 let localUpKey = getUserStorageKey('orbitLocalUpdatedAt', userId);
 if(!localStorage.getItem(localUpKey)){
   localStorage.setItem(localUpKey, new Date().toISOString());
 }
 return d;
}

function save(d, markChange = true, userId){
 let key = getUserStorageKey('orbitV9', userId);
 localStorage.setItem(key, JSON.stringify(d));
 if(markChange && typeof window !== 'undefined'){
  if(window.isApplyingCloudState) return;
  let localUpKey = getUserStorageKey('orbitLocalUpdatedAt', userId);
  let unsyncKey = getUserStorageKey('orbitHasUnsyncedChanges', userId);
  localStorage.setItem(localUpKey, new Date().toISOString());
  localStorage.setItem(unsyncKey, 'true');
  if(typeof scheduleCloudSync === 'function'){
   scheduleCloudSync();
  }
 }
}

function exportBackup(){
 let mainData=null;
 let key = getUserStorageKey('orbitV9');
 let timerKey = getUserStorageKey('orbitTimer');
 try{mainData=JSON.parse(localStorage.getItem(key))}catch(e){mainData=load()}
 if(!mainData)mainData=load();
 let timerData=null;
 try{timerData=JSON.parse(localStorage.getItem(timerKey))}catch(e){}
 let backupPayload={
  app:'orbit',
  version:1,
  schemaVersion:mainData.v||9,
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
   let ok=confirm(`¿Restaurar copia de seguridad de ${dateInfo}?\n\nSe reemplazarán los datos actuales de Orbit.`);
   if(!ok)return;
   localStorage.setItem('orbitV9',JSON.stringify(orbitData));
   if(parsed.orbitTimer){
    localStorage.setItem('orbitTimer',JSON.stringify(parsed.orbitTimer));
   }else{
    localStorage.removeItem('orbitTimer');
   }
   toast('Copia restaurada correctamente');
   setTimeout(()=>{location.reload()},400);
  }catch(err){
   toast('Error al leer el archivo de copia');
  }
 };
 reader.readAsText(file);
}
