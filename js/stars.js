// Economía de estrellas: hoy, disponibles, históricas e historial de ganancias.
// Extraído desde app.js sin romper compatibilidad.

function addPoints(d,amount,kind,label,refId=null){
 amount=Number(amount||0);
 if(amount<=0)return;
 d.wallet=Number(d.wallet||0)+amount;
 d.lifetimeStars=Number(d.lifetimeStars||0)+amount;
 d.bank=d.wallet;
 let k=dayKey();
 if(!d.pointAwards[k])d.pointAwards[k]={limits:{},actions:{},events:[]};
 if(!d.pointAwards[k].events)d.pointAwards[k].events=[];
 d.pointAwards[k].events.push({ts:Date.now(),amount,kind,label,refId:refId||null});
}

function todayPointsTotal(d){
 let p=d.pointAwards?.[dayKey()];
 if(!p)return 0;
 if(Array.isArray(p.events))return p.events.reduce((s,e)=>s+Number(e.amount||0),0);
 let total=0;
 if(p.actions)Object.values(p.actions).forEach(v=>total+=Number(v||0));
 if(p.limits)Object.values(p.limits).forEach(v=>total+=Number(v||0));
 return total
}

function awardDailyAction(action,points,dailyCap,label,refId=null){
 let d=load(),k=dayKey();
 if(!d.pointAwards[k])d.pointAwards[k]={limits:{},actions:{},events:[]};
 if(!d.pointAwards[k].actions)d.pointAwards[k].actions={};
 let already=Number(d.pointAwards[k].actions[action]||0);
 let remaining=Math.max(0,Number(dailyCap)-already);
 let grant=Math.min(Number(points),remaining);
 if(grant<=0)return 0;
 d.pointAwards[k].actions[action]=already+grant;
 addPoints(d,grant,'accion',label||action,refId);
 save(d);
 return grant
}

function revertPointsForRef(d,refId,actionType=null,day=null){
 if(!refId||!d)return 0;
 let ptsToRevert=0;
 let foundRef=false;

 if(d.pointAwards){
  Object.keys(d.pointAwards).forEach(k=>{
   let dayObj=d.pointAwards[k];
   if(dayObj&&Array.isArray(dayObj.events)){
    let keep=[];
    dayObj.events.forEach(e=>{
     if(e&&e.refId===refId){
      let amt=Number(e.amount||0);
      ptsToRevert+=amt;
      foundRef=true;
      if(actionType&&dayObj.actions&&dayObj.actions[actionType]!==undefined){
       dayObj.actions[actionType]=Math.max(0,Number(dayObj.actions[actionType])-amt);
      }
     }else{
      keep.push(e);
     }
    });
    dayObj.events=keep;
   }
  });
 }

 if(!foundRef&&actionType==='checkin'&&day){
  let dayObj=d.pointAwards?.[day];
  if(dayObj){
   let already=Number(dayObj.actions?.['checkin']||0);
   if(already>0){
    ptsToRevert+=already;
    dayObj.actions['checkin']=0;
    if(Array.isArray(dayObj.events)){
     let idx=dayObj.events.findIndex(e=>e.kind==='accion'&&(e.label==='Check-in'||e.label==='checkin'));
     if(idx!==-1)dayObj.events.splice(idx,1);
    }
   }
  }
 }

 if(ptsToRevert>0){
  d.wallet=Math.max(0,Number(d.wallet||0)-ptsToRevert);
  d.lifetimeStars=Math.max(0,Number(d.lifetimeStars||0)-ptsToRevert);
  d.bank=d.wallet;
 }

 return ptsToRevert;
}

function openTodayPointsModal(forDayKey=null){
 let d=load();
 let k=forDayKey||dayKey();
 let pa=d.pointAwards?.[k];
 let events=(pa&&Array.isArray(pa.events))?[...pa.events]:[];
 
 let listEl=document.getElementById('todayPointsList');
 let totalEl=document.getElementById('todayPointsModalTotal');
 let titleEl=document.getElementById('todayPointsModalTitle');
 let subEl=document.getElementById('todayPointsSubtitle');
 if(!listEl||!totalEl)return;

 let isToday=(k===dayKey());
 if(titleEl)titleEl.textContent=isToday?'Cómo ganaste tus estrellas hoy':'Estrellas ganadas el '+new Date(k+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'});
 if(subEl)subEl.textContent=isToday?'Desglose de tus logros y pausas de hoy.':'Desglose de eventos registrados este día.';

 if(!events.length&&pa&&pa.actions){
  Object.keys(pa.actions).forEach(act=>{
   let amt=Number(pa.actions[act]||0);
   if(amt>0){
    let labelMap={checkin:'Check-in',journal:'Escribir en Diario',goodThing:'Algo bueno'};
    events.push({ts:Date.now(),amount:amt,kind:'accion',label:labelMap[act]||act});
   }
  });
 }

 events.sort((a,b)=>(a.ts||0)-(b.ts||0));

 let total=0;
 if(!events.length){
  listEl.innerHTML=`<div class="empty" style="padding:24px 10px; text-align:center; font-size:12px; color:var(--muted);">${isToday?'Todavía no has ganado estrellas hoy.':'No hay eventos de estrellas registrados en este día.'}</div>`;
  totalEl.textContent='0,0 ★';
 }else{
  let html=events.map(e=>{
   let amt=Number(e.amount||0);
   total+=amt;
   let timeStr=e.ts?new Date(e.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'';
   
   let kindBadge='';
   if(e.kind==='racha')kindBadge='Racha';
   else if(e.kind==='impulso')kindBadge='Pausa';
   else if(e.kind==='accion')kindBadge='Diario';
   else kindBadge=e.kind||'Orbit';

   let title=e.label||'Estrella ganada';

   return `<div class="card entry-card" style="padding:10px 12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
    <div style="text-align:left;">
      <div class="entry-meta" style="margin-bottom:2px; font-size:9px;">
        <span class="entry-type">${esc(kindBadge)}</span>
        <span>${timeStr}</span>
      </div>
      <div style="font-size:12px; font-weight:500; color:var(--ink);">${esc(title)}</div>
    </div>
    <div style="font-size:13px; font-weight:700; color:var(--wine); white-space:nowrap; margin-left:10px;">
      +${amt.toFixed(1).replace('.',',')} ★
    </div>
   </div>`;
  }).join('');

  listEl.innerHTML=html;
  totalEl.textContent=total.toFixed(1).replace('.',',')+' ★';
 }

 let modal=document.getElementById('todayPointsModal');
 if(modal)modal.classList.add('show');
}
