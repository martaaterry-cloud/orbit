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
 urgeModal.classList.add('show');
}

let timer=null,left=600,activeUrge=null;

function startUrgeTimer(){
 let d=load(),u={id:uid(),ts:Date.now(),goalId:urgeGoal.value,hope:urgeHope.value.trim(),fear:urgeFear.value.trim(),alternative:urgeAlternative.value.trim(),intensity:+urgeIntensity.value,survived:false};
 d.urges.push(u);
 addPoints(d,.2,'impulso','Me detuve antes de comprobar');
 save(d);
 activeUrge=u.id;
 left=600;
 updateTimer();
 clearInterval(timer);
 startTimerBtn.disabled=true;
 surviveBtn.disabled=true;
 timer=setInterval(()=>{
  left--;
  updateTimer();
  if(left<=0){
   clearInterval(timer);
   timer=null;
   surviveBtn.disabled=false;
   startTimerBtn.disabled=false;
   toast('Ya han pasado 10 minutos');
  }
 },1000);
 render();
}

function updateTimer(){
 document.getElementById('timer').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
}

function surviveUrge(){
 if(!activeUrge)return;
 let d=load(),u=d.urges.find(x=>x.id===activeUrge);
 if(u&&!u.survived){
  u.survived=true;
  addPoints(d,.3,'impulso','Atravesé el impulso sin comprobar');
  save(d);
 }
 activeUrge=null;
 urgeHope.value='';
 urgeFear.value='';
 urgeAlternative.value='';
 closeModal('urgeModal');
 toast('+0,2 por detenerte · +0,3 por atravesarlo');
 render();
}

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
