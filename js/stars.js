// Economía de estrellas: hoy, disponibles, históricas, boosters e historial de ganancias.
// Extraído desde app.js sin romper compatibilidad.

function cleanExpiredBoosters(d){
  if(!d||!d.boosters)return false;
  let changed=false;
  let now=Date.now();
  if(Array.isArray(d.boosters.active)){
    let beforeLen=d.boosters.active.length;
    d.boosters.active=d.boosters.active.filter(b=>{
      if(!b)return false;
      if(b.expiresAt&&now>=b.expiresAt)return false;
      if(typeof b.maxExtraStars==='number'&&Number(b.extraStarsGenerated||0)>=b.maxExtraStars)return false;
      return true;
    });
    if(d.boosters.active.length!==beforeLen)changed=true;
  }
  if(Array.isArray(d.boosters.inventory)){
    let beforeLen=d.boosters.inventory.length;
    d.boosters.inventory=d.boosters.inventory.filter(b=>b&&b.usesRemaining>0);
    if(d.boosters.inventory.length!==beforeLen)changed=true;
  }
  return changed;
}

function applyStarBoost(d,baseAmount,kind,context={}){
  baseAmount=Number(baseAmount||0);
  if(baseAmount<=0)return {base:0,multiplier:1,extra:0,total:0,boosterId:null,boosterName:null};
  
  // Acciones rutinarias NUNCA se multiplican
  const nonBoostable=['journal','goodThing','checkin','accion'];
  if(nonBoostable.includes(kind)||context.noBoost){
    return {base:baseAmount,multiplier:1,extra:0,total:baseAmount,boosterId:null,boosterName:null};
  }
  
  if(!d.boosters){
    d.boosters={active:[],inventory:[],progress:{survivedUrgesCount:0,awardedBraveThresholds:[],lastNightOfConstancyStreakTs:null}};
  }
  cleanExpiredBoosters(d);
  
  let candidates=[];
  
  // 1. Boosters activos (ej. Ventana Estelar x1.5, Noche de Constancia x1.5)
  if(Array.isArray(d.boosters.active)){
    d.boosters.active.forEach(b=>{
      if(!b)return;
      let matchScope=!b.scope||b.scope.includes(kind)||(kind.startsWith('impulso')&&b.scope.includes('impulso'));
      if(matchScope){
        candidates.push({booster:b,isInventory:false});
      }
    });
  }
  
  // 2. Boosters de inventario aplicables (ej. Impulso Valiente x2 en próximo timer superado)
  if(Array.isArray(d.boosters.inventory)){
    d.boosters.inventory.forEach(b=>{
      if(!b)return;
      let matchScope=false;
      if(kind==='impulso-timer'||context.isTimer){
        matchScope=!b.scope||b.scope.includes('impulso-timer')||b.scope.includes('impulso');
      }else if(b.scope&&b.scope.includes(kind)){
        matchScope=true;
      }
      if(matchScope&&b.usesRemaining>0){
        candidates.push({booster:b,isInventory:true});
      }
    });
  }
  
  if(!candidates.length){
    return {base:baseAmount,multiplier:1,extra:0,total:baseAmount,boosterId:null,boosterName:null};
  }
  
  // Criterio No-Stacking: Elegir el de MAYOR multiplicador; si empatan, el que expire antes o el más antiguo
  candidates.sort((a,b)=>{
    let multDiff=(b.booster.multiplier||1)-(a.booster.multiplier||1);
    if(Math.abs(multDiff)>0.001)return multDiff;
    let expA=a.booster.expiresAt||Infinity;
    let expB=b.booster.expiresAt||Infinity;
    if(expA!==expB)return expA-expB;
    return (a.booster.startedAt||0)-(b.booster.startedAt||0);
  });
  
  let chosen=candidates[0];
  let b=chosen.booster;
  let mult=Number(b.multiplier||1);
  let rawExtra=baseAmount*(mult-1);
  let actualExtra=rawExtra;
  
  if(typeof b.maxExtraStars==='number'){
    let remainingCap=Math.max(0,b.maxExtraStars-Number(b.extraStarsGenerated||0));
    actualExtra=Math.min(rawExtra,remainingCap);
  }
  
  actualExtra=Math.max(0,Math.round(actualExtra*100)/100);
  let totalAmount=Math.round((baseAmount+actualExtra)*100)/100;
  
  // Actualizar consumo del booster
  b.extraStarsGenerated=Math.round((Number(b.extraStarsGenerated||0)+actualExtra)*100)/100;
  if(chosen.isInventory){
    b.usesRemaining=Math.max(0,Number(b.usesRemaining||1)-1);
  }
  
  cleanExpiredBoosters(d);
  
  return {
    base:baseAmount,
    multiplier:mult,
    extra:actualExtra,
    total:totalAmount,
    boosterId:b.id,
    boosterName:b.name
  };
}

function addPoints(d,amount,kind,label,refId=null,eventTs=null,boostMeta=null){
 amount=Number(amount||0);
 if(amount<=0)return;
 d.wallet=Math.round((Number(d.wallet||0)+amount)*100)/100;
 d.lifetimeStars=Math.round((Number(d.lifetimeStars||0)+amount)*100)/100;
 d.bank=d.wallet;
 let ts=eventTs||Date.now();
 let k=dayKey(ts);
 if(!d.pointAwards[k])d.pointAwards[k]={limits:{},actions:{},events:[]};
 if(!d.pointAwards[k].events)d.pointAwards[k].events=[];
 let evObj={ts,amount,kind,label,refId:refId||null};
 if(boostMeta&&boostMeta.boosterId){
   evObj.boost={
     boosterId:boostMeta.boosterId,
     name:boostMeta.boosterName,
     multiplier:boostMeta.multiplier,
     baseAmount:boostMeta.base,
     extraAmount:boostMeta.extra
   };
 }
 d.pointAwards[k].events.push(evObj);
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
   let title=e.label||'Estrella ganada';

   if(e.kind==='racha'){
    kindBadge='Racha';
   }else if(e.kind==='impulso'){
    kindBadge='Pausa';
   }else if(e.kind==='accion'){
    if(e.label==='Check-in'||(e.refId&&String(e.refId).startsWith('checkin-'))){
     kindBadge='Check-in';
     title='Check-in diario';
    }else if(e.label==='Algo bueno'||(Array.isArray(d.goodThings)&&d.goodThings.some(g=>g&&g.id===e.refId))){
     kindBadge='Lo que sí pasó';
     title='Algo bueno';
    }else{
     kindBadge='Diario';
     let jItem=Array.isArray(d.journal)?d.journal.find(j=>j&&j.id===e.refId):null;
     if(jItem&&jItem.title){
      title=jItem.title;
     }else if(e.label&&e.label!=='journal'){
      title=e.label;
     }else{
      title='Escribir en el diario';
     }
    }
   }else{
    kindBadge=e.kind||'Orbit';
   }

   let boostBadge='';
   if(e.boost&&e.boost.name){
     boostBadge=`<div style="font-size:9.5px; color:var(--wine); opacity:0.85; margin-top:2px; font-weight:600;">✦ x${e.boost.multiplier} · ${esc(e.boost.name)}</div>`;
   }

   return `<div class="card entry-card" style="padding:10px 12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
    <div style="text-align:left;">
      <div class="entry-meta" style="margin-bottom:2px; font-size:9px;">
        <span class="entry-type">${esc(kindBadge)}</span>
        <span>${timeStr}</span>
      </div>
      <div style="font-size:12px; font-weight:500; color:var(--ink);">${esc(title)}</div>
      ${boostBadge}
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
