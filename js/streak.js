// Racha común de Volver a mí, impulsos, reinicios y récords.
// Extraído desde app.js sin romper compatibilidad.

function accrue(){
 let d=load(),now=Date.now(),added=0;
 const milestones=[
   {ms:2*HOUR,pts:.2,key:'2h'},
   {ms:4*HOUR,pts:.3,key:'4h'},
   {ms:8*HOUR,pts:.5,key:'8h'},
   {ms:12*HOUR,pts:.5,key:'12h'},
   {ms:24*HOUR,pts:1,key:'24h'},
   {ms:48*HOUR,pts:1.5,key:'48h'},
   {ms:72*HOUR,pts:2,key:'72h'},
   {ms:168*HOUR,pts:3,key:'168h'}
 ];
 let r=d.returnToMe;
 if(!r.awardedMilestones)r.awardedMilestones=[];
 let elapsed=now-r.since;
 milestones.forEach(x=>{
   if(elapsed>=x.ms&&!r.awardedMilestones.includes(x.key)){
     r.awardedMilestones.push(x.key);
     addPoints(d,x.pts,'racha','Volver a mí · '+x.key);
     added+=x.pts
   }
 });
 r.best=Math.max(Number(r.best||0),elapsed);
 d.best=Math.max(Number(d.best||0),r.best);
 save(d);
 if(added)toast('+'+String(added).replace('.',',')+' estrellas por tu racha');
 return d
}

function sharedMilestoneInfo(d){
 const m=[
  {ms:2*HOUR,pts:.2,label:'2 h'},
  {ms:4*HOUR,pts:.3,label:'4 h'},
  {ms:8*HOUR,pts:.5,label:'8 h'},
  {ms:12*HOUR,pts:.5,label:'12 h'},
  {ms:24*HOUR,pts:1,label:'24 h'},
  {ms:48*HOUR,pts:1.5,label:'48 h'},
  {ms:72*HOUR,pts:2,label:'3 días'},
  {ms:168*HOUR,pts:3,label:'7 días'}
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

function getTimerState(){
 try{return JSON.parse(localStorage.getItem('orbitTimer'))}catch(e){return null}
}

function saveTimerState(state){
 if(!state){localStorage.removeItem('orbitTimer')}
 else{localStorage.setItem('orbitTimer',JSON.stringify(state))}
}

function clearTimerState(){
 localStorage.removeItem('orbitTimer');
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
  addPoints(d,.2,'impulso','Me detuve antes de comprobar');
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

function resetUrgeTimer(){
 if(timerInterval){clearInterval(timerInterval);timerInterval=null}
 clearTimerState();
 activeUrge=null;
 syncUrgeTimer();
 toast('Pausa cancelada');
}

function updateTimer(){
 syncUrgeTimer();
}

function surviveUrge(){
 let state=getTimerState();
 let uId=(state&&state.activeUrge)||activeUrge;
 if(uId){
  let d=load(),u=d.urges.find(x=>x.id===uId);
  if(u&&!u.survived){
   u.survived=true;
   addPoints(d,.3,'impulso','Atravesé el impulso sin comprobar');
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
 toast('+0,2 por detenerte · +0,3 por atravesarlo');
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
