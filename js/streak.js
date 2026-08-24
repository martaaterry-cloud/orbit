// Racha común de Volver a mí, impulsos, reinicios y récords.
// Extraído desde app.js sin romper compatibilidad.

function accrue(){
 let d=load(),now=Date.now(),added=0;
 const milestones=[
   {ms:2*HOUR,pts:.2,key:'2h',label:'2 h'},
   {ms:4*HOUR,pts:.3,key:'4h',label:'4 h'},
   {ms:8*HOUR,pts:.5,key:'8h',label:'8 h'},
   {ms:12*HOUR,pts:.5,key:'12h',label:'12 h'},
   {ms:24*HOUR,pts:1.0,key:'24h',label:'24 h'},
   {ms:48*HOUR,pts:1.5,key:'48h',label:'48 h'},
   {ms:72*HOUR,pts:2.0,key:'72h',label:'3 días'},
   {ms:96*HOUR,pts:1.0,key:'96h',label:'4 días'},
   {ms:120*HOUR,pts:1.2,key:'120h',label:'5 días'},
   {ms:144*HOUR,pts:1.5,key:'144h',label:'6 días'},
   {ms:168*HOUR,pts:3.0,key:'168h',label:'7 días'}
 ];
 let r=d.returnToMe;
 if(!r.awardedMilestones)r.awardedMilestones=[];
 let elapsed=now-r.since;
 milestones.forEach(x=>{
   if(elapsed>=x.ms&&!r.awardedMilestones.includes(x.key)){
     r.awardedMilestones.push(x.key);
     let milestoneReachedTs=Number(r.since)+x.ms;
     let boostResult=applyStarBoost(d,x.pts,'racha',{eventTs:milestoneReachedTs});
     addPoints(d,boostResult.total,'racha','Volver a mí · '+(x.label||x.key),null,milestoneReachedTs,boostResult.boosterId?boostResult:null);
     added+=boostResult.total;

     // Booster C: Noche de Constancia (al alcanzar 7 días de racha)
     if(x.key==='168h'){
       if(!d.boosters)d.boosters={active:[],inventory:[],progress:{}};
       if(!d.boosters.progress)d.boosters.progress={};
       if(d.boosters.progress.lastNightOfConstancyStreakTs!==r.since){
         d.boosters.progress.lastNightOfConstancyStreakTs=r.since;
         let expiry=milestoneReachedTs+24*HOUR;
         if(expiry>now){
           if(!Array.isArray(d.boosters.active))d.boosters.active=[];
           d.boosters.active.push({
             id:'constancy-night',
             name:'Noche de Constancia',
             multiplier:1.5,
             startedAt:milestoneReachedTs,
             expiresAt:expiry,
             maxExtraStars:3.0,
             extraStarsGenerated:0.0,
             scope:['impulso','racha']
           });
           toast('✦ ¡Noche de Constancia activada! (x1.5 por el tiempo restante)');
         }
       }
     }
   }
 });
 r.best=Math.max(Number(r.best||0),elapsed);
 d.best=Math.max(Number(d.best||0),r.best);
 save(d, added > 0);
 if(added)toast('+'+String(added.toFixed(1)).replace('.',',')+' estrellas por tu racha');
 return d
}

function sharedMilestoneInfo(d){
 const m=[
  {ms:2*HOUR,pts:.2,label:'2 h'},
  {ms:4*HOUR,pts:.3,label:'4 h'},
  {ms:8*HOUR,pts:.5,label:'8 h'},
  {ms:12*HOUR,pts:.5,label:'12 h'},
  {ms:24*HOUR,pts:1.0,label:'24 h'},
  {ms:48*HOUR,pts:1.5,label:'48 h'},
  {ms:72*HOUR,pts:2.0,label:'3 días'},
  {ms:96*HOUR,pts:1.0,label:'4 días'},
  {ms:120*HOUR,pts:1.2,label:'5 días'},
  {ms:144*HOUR,pts:1.5,label:'6 días'},
  {ms:168*HOUR,pts:3.0,label:'7 días'}
 ];
 let elapsed=Date.now()-d.returnToMe.since;
 let n=m.find(x=>elapsed<x.ms);
 let prev=0,next=n?n.ms:168*HOUR;
 let idx=n?m.indexOf(n):m.length;
 if(idx>0)prev=m[idx-1].ms;
 let pct=n?Math.max(0,Math.min(100,(elapsed-prev)/(next-prev)*100)):100;
 return {text:n?`Próximo hito: ${n.label} · +${String(n.pts).replace('.',',')} pts`:'Has superado los 7 días',pct}
}

function openUrge(id){
 let d=load();
 urgeGoal.innerHTML=d.goals.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
 if(id&&d.goals.some(g=>g.id===id))urgeGoal.value=id;
 syncUrgeTimer();
 urgeModal.classList.add('show');
}

let timerInterval=null,activeUrge=null;

function getTimerState(userId){
 let key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', userId) : null;
 if(!key) return null;
 try{return JSON.parse(localStorage.getItem(key))}catch(e){return null}
}

function saveTimerState(state, markChange = true, userId){
 let key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', userId) : null;
 if(!key) return;
 if(!state){localStorage.removeItem(key)}
 else{localStorage.setItem(key,JSON.stringify(state))}
 if(markChange && typeof window !== 'undefined'){
  if(window.isApplyingCloudState) return;
  let localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', userId) : null;
  let unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', userId) : null;
  if(localUpKey) localStorage.setItem(localUpKey, new Date().toISOString());
  if(unsyncKey) localStorage.setItem(unsyncKey, 'true');
  if(typeof scheduleCloudSync === 'function'){
   scheduleCloudSync();
  }
 }
}

function clearTimerState(markChange = true, userId){
 let key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', userId) : null;
 if(key) localStorage.removeItem(key);
 if(markChange && typeof window !== 'undefined'){
  if(window.isApplyingCloudState) return;
  let localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', userId) : null;
  let unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', userId) : null;
  if(localUpKey) localStorage.setItem(localUpKey, new Date().toISOString());
  if(unsyncKey) localStorage.setItem(unsyncKey, 'true');
  if(typeof scheduleCloudSync === 'function'){
   scheduleCloudSync();
  }
 }
}

function clearUrgeTimerMemory(){
 clearInterval(timerInterval);
 timerInterval = null;
 activeUrge = null;
 updateTimerDisplay(0);
 let timerCard = document.getElementById('urgeActiveTimer');
 let pauseBtn = document.getElementById('pauseTimerBtn');
 let resumeBtn = document.getElementById('resumeTimerBtn');
 let cancelBtn = document.getElementById('cancelTimerBtn');
 if(timerCard) timerCard.style.display = 'none';
 if(pauseBtn) pauseBtn.style.display = 'none';
 if(resumeBtn) resumeBtn.style.display = 'none';
 if(cancelBtn) cancelBtn.style.display = 'none';
}


function updateTimerDisplay(totalSeconds){
 let s=Math.max(0,Math.ceil(totalSeconds));
 let el=document.getElementById('timer');
 if(el){
  el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 }
}

function syncUrgeTimer(){
 let state=getTimerState();
 let startBtn=document.getElementById('startTimerBtn');
 let sBtn=document.getElementById('surviveBtn');
 let cancelBtn=document.getElementById('cancelTimerBtn');
 
 if(!state){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null}
  activeUrge=null;
  updateTimerDisplay(600);
  if(startBtn)startBtn.disabled=false;
  if(sBtn)sBtn.disabled=true;
  if(cancelBtn)cancelBtn.style.display='none';
  return;
 }
 
 activeUrge=state.activeUrge||null;
 
 if(state.running){
  let remainingMs=(state.endTime||0)-Date.now();
  if(remainingMs<=0){
   if(timerInterval){clearInterval(timerInterval);timerInterval=null}
   updateTimerDisplay(0);
   if(startBtn)startBtn.disabled=false;
   if(sBtn)sBtn.disabled=false;
   if(cancelBtn)cancelBtn.style.display='none';
   if(!state.completedNotified){
    toast('Ya han pasado 10 minutos');
    saveTimerState({activeUrge:state.activeUrge,running:false,remainingMs:0,completedNotified:true});
   }
  }else{
   let secLeft=remainingMs/1000;
   updateTimerDisplay(secLeft);
   if(startBtn)startBtn.disabled=true;
   if(sBtn)sBtn.disabled=true;
   if(cancelBtn)cancelBtn.style.display='inline-block';
   if(!timerInterval){
    timerInterval=setInterval(syncUrgeTimer,1000);
   }
  }
 }else{
  if(timerInterval){clearInterval(timerInterval);timerInterval=null}
  let secLeft=Math.max(0,Math.ceil((state.remainingMs||0)/1000));
  updateTimerDisplay(secLeft);
  if(startBtn)startBtn.disabled=false;
  if(sBtn)sBtn.disabled=(secLeft>0);
  if(cancelBtn)cancelBtn.style.display=(secLeft>0)?'inline-block':'none';
 }
}

function startUrgeTimer(){
 let state=getTimerState();
 let isResuming=state&&!state.running&&(state.remainingMs>0);
 let remMs=isResuming?state.remainingMs:600*1000;
 let uId=isResuming?state.activeUrge:null;
 
 if(!uId){
  let d=load(),u={id:uid(),ts:Date.now(),goalId:urgeGoal.value,hope:urgeHope.value.trim(),fear:urgeFear.value.trim(),alternative:urgeAlternative.value.trim(),intensity:+urgeIntensity.value,survived:false};
  d.urges.push(u);
  let boostResult=applyStarBoost(d,0.4,'impulso');
  addPoints(d,boostResult.total,'impulso','Me detuve antes de comprobar',u.id,null,boostResult.boosterId?boostResult:null);
  save(d);
  uId=u.id;
 }
 
 let targetEndTime=Date.now()+remMs;
 saveTimerState({activeUrge:uId,running:true,endTime:targetEndTime,remainingMs:remMs});
 syncUrgeTimer();
 render();
}

function pauseUrgeTimer(){
 let state=getTimerState();
 if(state&&state.running){
  let remMs=Math.max(0,(state.endTime||0)-Date.now());
  saveTimerState({activeUrge:state.activeUrge,running:false,remainingMs:remMs});
  syncUrgeTimer();
 }
}

function resumeUrgeTimer(){
 startUrgeTimer();
}

function deleteUrge(id,askConfirm=true){
 if(!id)return;
 if(askConfirm){
  let ok=confirm('¿Eliminar este registro de impulso?');
  if(!ok)return;
 }
 let d=load(),u=d.urges.find(x=>x.id===id);
 if(!u)return;
  
 let ptsToRevert=0;
 let foundRef=false;
 
 if(d.pointAwards){
  Object.keys(d.pointAwards).forEach(k=>{
   let dayObj=d.pointAwards[k];
   if(dayObj&&Array.isArray(dayObj.events)){
    let keep=[];
    dayObj.events.forEach(e=>{
     if(e&&e.refId===id){
      ptsToRevert+=Number(e.amount||0);
      foundRef=true;
     }else{
      keep.push(e);
     }
    });
    dayObj.events=keep;
   }
  });
 }
 
 if(!foundRef){
  // Fallback legacy seguro: si no hay eventos vinculados por refId (datos de versiones antiguas),
  // se revierten conservadoramente las cantidades históricas conocidas (0.2 o 0.5) sin tocar eventos de terceros.
  ptsToRevert=u.survived?0.5:0.2;
 }
 
 if(ptsToRevert>0){
  d.wallet=Math.max(0,Math.round((Number(d.wallet||0)-ptsToRevert)*100)/100);
  d.lifetimeStars=Math.max(0,Math.round((Number(d.lifetimeStars||0)-ptsToRevert)*100)/100);
  d.bank=d.wallet;
 }
 
 d.urges=d.urges.filter(x=>x.id!==id);
 save(d);
 
 if(askConfirm)toast('Registro eliminado');
 render();
 if(typeof renderArchive==='function')renderArchive();
}

function resetUrgeTimer(){
 let state=getTimerState();
 let uId=(state&&state.activeUrge)||activeUrge;
 
 if(uId){
  let d=load(),u=d.urges.find(x=>x.id===uId);
  if(u&&!u.survived){
   deleteUrge(uId,false);
  }
 }
 
 if(timerInterval){clearInterval(timerInterval);timerInterval=null}
 clearTimerState();
 activeUrge=null;
 syncUrgeTimer();
 toast('Pausa cancelada');
 render();
}

function updateTimer(){
 syncUrgeTimer();
}

function surviveUrge(){
 let state=getTimerState();
 let uId=(state&&state.activeUrge)||activeUrge;
 let gainedTotal=0.8;
 if(uId){
  let d=load(),u=d.urges.find(x=>x.id===uId);
  if(u&&!u.survived){
   u.survived=true;
   
   // Calcular cuánto se concedió previamente a este impulso
   let alreadyGranted=0;
   if(d.pointAwards){
     Object.keys(d.pointAwards).forEach(k=>{
       let dayObj=d.pointAwards[k];
       if(dayObj&&Array.isArray(dayObj.events)){
         dayObj.events.forEach(e=>{
           if(e&&e.refId===uId){
             alreadyGranted+=Number(e.amount||0);
           }
         });
       }
     });
   }
   alreadyGranted=Math.round(alreadyGranted*100)/100;
   
   // Evaluar multiplicador sobre la acción completa de base 0.8 respetando No-Stacking
   let boostResult=applyStarBoost(d,0.8,'impulso-timer',{isTimer:true,eventTs:Date.now(),alreadyGranted:alreadyGranted});
   let grantAmt=boostResult.grantAmount;
   if(grantAmt>0){
     addPoints(d,grantAmt,'impulso','Atravesé el impulso con temporizador',uId,null,boostResult.boosterId?boostResult:null);
   }
   gainedTotal=Math.round((alreadyGranted+grantAmt)*100)/100;
   
   // Booster B: Impulso Valiente (cada 3 impulsos superados con temporizador: 3, 6, 9...)
   if(!d.boosters)d.boosters={active:[],inventory:[],progress:{}};
   if(!d.boosters.progress)d.boosters.progress={};
   let count=(d.boosters.progress.survivedUrgesCount||0)+1;
   d.boosters.progress.survivedUrgesCount=count;
   if(!Array.isArray(d.boosters.progress.awardedBraveThresholds)){
     d.boosters.progress.awardedBraveThresholds=[];
   }
   if(count%3===0&&!d.boosters.progress.awardedBraveThresholds.includes(count)){
     d.boosters.progress.awardedBraveThresholds.push(count);
     if(!Array.isArray(d.boosters.inventory))d.boosters.inventory=[];
     d.boosters.inventory.push({
       id:'brave-urge',
       name:'Impulso Valiente',
       multiplier:2.0,
       usesRemaining:1,
       maxExtraStars:0.8,
       scope:['impulso-timer']
     });
     toast('✦ ¡Ganaste un Impulso Valiente! (x2 en tu próximo impulso con timer)');
   }
   save(d);
  }
 }
 if(timerInterval){clearInterval(timerInterval);timerInterval=null}
 clearTimerState();
 activeUrge=null;
 urgeHope.value='';
 urgeFear.value='';
 urgeAlternative.value='';
 closeModal('urgeModal');
 toast(`+${String(gainedTotal).replace('.',',')} ★ en total por superar el impulso`);
 syncUrgeTimer();
 render();
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncUrgeTimer()});
window.addEventListener('pageshow',()=>syncUrgeTimer());
window.addEventListener('focus',()=>syncUrgeTimer());
syncUrgeTimer();

function slip(id){
 slipGoalId.value=id;
 slipNote.value='';
 slipModal.classList.add('show');
}

function confirmSlip(){
 let d=load(),g=d.goals.find(x=>x.id===slipGoalId.value),now=Date.now();
 if(g){
   d.returnToMe.since=now;
   d.returnToMe.awardedMilestones=[];
   d.slips.push({ts:now,goalId:g.id,note:slipNote.value.trim()});
   save(d);
 }
 closeModal('slipModal');
 toast('Racha reiniciada. Tus estrellas y tu récord se conservan.');
 render();
}
