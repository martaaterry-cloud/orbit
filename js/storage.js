// Persistencia, migraciones de versión, exportación y copias de seguridad.
// Extraído y centralizado para disponibilidad inmediata en todos los módulos.

const HOUR=3600000, STEP=2*HOUR;
function uid(){return Math.random().toString(36).slice(2,10)}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmt(ms){let h=Math.floor(ms/HOUR),m=Math.floor((ms%HOUR)/60000);if(h>=24)return Math.floor(h/24)+'d '+(h%24)+'h';return h+'h '+String(m).padStart(2,'0')+'m'}
function toast(msg){let t=document.getElementById('toast');if(t){t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>t.classList.remove('show'),1900)}}

function dayKey(ts=Date.now()){let d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

function defaults(){
 const n=Date.now();
 return {v:9,wallet:0,lifetimeStars:0,bank:0,claimed:{},best:0,pointAwards:{},returnToMe:{since:n,awardedMilestones:[],best:0},
 goals:[
 {id:'msg',icon:'chat',name:'No comprobar si me ha escrito',sub:'No abrir el chat solo para buscar una señal',since:n},
 {id:'insta',icon:'insta',name:'No comprobar cambios en Instagram',sub:'No mirar seguidores, seguidos o cambios para calmar la ansiedad',since:n},
 {id:'hevy',icon:'activity',name:'No entrar a Hevy a comprobar actividad',sub:'No usar el entrenamiento como información indirecta',since:n},
 {id:'signals',icon:'search',name:'No buscar señales indirectas',sub:'Historias, actividad o pistas para saber de él',since:n}],
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

function load(){
 let d;
 try{d=JSON.parse(localStorage.getItem('orbitV9'))}catch{}
 if(!d){
  let old;try{old=JSON.parse(localStorage.getItem('orbitV8'))}catch{}
  d=defaults();
  if(old){
   ['bank','claimed','best','pointAwards','goals','rewards','urges','slips','journal','checkins','orbit','boosters'].forEach(k=>{if(old[k]!==undefined)d[k]=old[k]});
   if(old.goodThings)d.goodThings=old.goodThings
  }else{
   try{old=JSON.parse(localStorage.getItem('orbitV3'))}catch{}
   if(old){
    d.bank=old.bank||0;d.claimed=old.claimed||{};d.best=old.best||0;d.urges=old.urges||[];d.slips=old.slips||[];d.rewards=old.rewards||d.rewards;
    if(old.goals)old.goals.forEach(og=>{let g=d.goals.find(x=>x.id===og.id);if(g&&og.since)g.since=og.since})
   }
  }
 }
 const insta=d.goals?.find(g=>g.id==='insta');if(insta){insta.name='No comprobar cambios en Instagram';insta.sub='No mirar seguidores, seguidos o cambios para calmar la ansiedad'}
 if(!d.goodThings)d.goodThings=[];
 if(!d.pointAwards)d.pointAwards={};
 if(d.wallet===undefined||d.wallet===null)d.wallet=Number(d.bank||0);
 if(d.lifetimeStars===undefined||d.lifetimeStars===null)d.lifetimeStars=Number(d.wallet||0);
 d.bank=d.wallet;
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

  // Migración quirúrgica única: eventos de racha actual y limpieza del huérfano 2026-08-21
  if(!d._streakMilestonesAndOrphanFixed_20260821){
    let dayObj21 = d.pointAwards?.['2026-08-21'];
    if(dayObj21 && Array.isArray(dayObj21.events)){
      let idxOrphan = dayObj21.events.findIndex(e =>
        e && e.kind === 'accion' && e.label === 'Escribir' && !e.refId && Number(e.amount) === 0.1
      );
      if(idxOrphan !== -1){
        dayObj21.events.splice(idxOrphan, 1);
        if(dayObj21.actions && dayObj21.actions.journal){
          dayObj21.actions.journal = Math.max(0, Number(dayObj21.actions.journal) - 0.1);
        }
        d.wallet = Math.max(0, Number(d.wallet || 0) - 0.1);
        d.lifetimeStars = Math.max(0, Number(d.lifetimeStars || 0) - 0.1);
        d.bank = d.wallet;
      }
    }

    let since = Number(d.returnToMe?.since || 0);
    if(since > 0){
      let day20Key = dayKey(since);
      let day21Key = dayKey(since + 24 * 3600 * 1000);

      if(!d.pointAwards[day20Key]) d.pointAwards[day20Key] = { limits: {}, actions: {}, events: [] };
      if(!d.pointAwards[day20Key].events) d.pointAwards[day20Key].events = [];

      let events21 = d.pointAwards[day21Key]?.events || [];

      let idx4 = events21.findIndex(e => e.kind === 'racha' && e.label === 'Volver a mí · 4h');
      if(idx4 !== -1){
        let [ev4] = events21.splice(idx4, 1);
        ev4.ts = since + (4 * 3600 * 1000);
        d.pointAwards[day20Key].events.push(ev4);
      }

      let idx8 = events21.findIndex(e => e.kind === 'racha' && e.label === 'Volver a mí · 8h');
      if(idx8 !== -1){
        let [ev8] = events21.splice(idx8, 1);
        ev8.ts = since + (8 * 3600 * 1000);
        d.pointAwards[day20Key].events.push(ev8);
      }

      let ev12 = events21.find(e => e.kind === 'racha' && e.label === 'Volver a mí · 12h');
      if(ev12){
        ev12.ts = since + (12 * 3600 * 1000);
      }

      let ev2 = d.pointAwards[day20Key].events.find(e => e.kind === 'racha' && e.label === 'Volver a mí · 2h');
      if(ev2){
        ev2.ts = since + (2 * 3600 * 1000);
      }

      if(Array.isArray(d.pointAwards[day20Key].events)){
        d.pointAwards[day20Key].events.sort((a,b) => (a.ts||0) - (b.ts||0));
      }
      if(Array.isArray(events21)){
        events21.sort((a,b) => (a.ts||0) - (b.ts||0));
      }
    }

    d._streakMilestonesAndOrphanFixed_20260821 = true;
  }

 save(d, false);
 if(!localStorage.getItem('orbitLocalUpdatedAt')){
   localStorage.setItem('orbitLocalUpdatedAt', new Date().toISOString());
 }
 return d
}

function save(d, markChange = true){
 localStorage.setItem('orbitV9', JSON.stringify(d));
 if(markChange && typeof window !== 'undefined'){
  if(window.isApplyingCloudState) return;
  localStorage.setItem('orbitLocalUpdatedAt', new Date().toISOString());
  localStorage.setItem('orbitHasUnsyncedChanges', 'true');
  if(typeof scheduleCloudSync === 'function'){
   scheduleCloudSync();
  }
 }
}

function exportBackup(){
 let mainData=null;
 try{mainData=JSON.parse(localStorage.getItem('orbitV9'))}catch(e){mainData=load()}
 if(!mainData)mainData=load();
 let timerData=null;
 try{timerData=JSON.parse(localStorage.getItem('orbitTimer'))}catch(e){}
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
