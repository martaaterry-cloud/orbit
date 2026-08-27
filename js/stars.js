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

function formatRewardToast(actionName, boostResult){
  if(!boostResult||!boostResult.grantAmount)return `${actionName} guardado`;
  const baseFmt=parseFloat(Number(boostResult.base||0).toFixed(2)).toString().replace('.',',');
  const totalFmt=parseFloat(Number(boostResult.total||0).toFixed(2)).toString().replace('.',',');
  const multFmt=parseFloat(Number(boostResult.multiplier||1).toFixed(2)).toString().replace('.',',');
  
  if(boostResult.multiplier>1&&boostResult.extra>0){
    return `${actionName} · +${baseFmt} ★ ×${multFmt} = +${totalFmt} ★`;
  }
  return `${actionName} · +${totalFmt} ★`;
}

function applyStarBoost(d,baseAmount,kind,context={}){
  baseAmount=Number(baseAmount||0);
  if(baseAmount<=0){
    return {base:0,multiplier:1,extra:0,total:0,grantAmount:0,boosterId:null,boosterName:null,kind:kind||'star'};
  }
  
  // Exclusiones justificadas: compras, gastos, canjes, ajustes administrativos o flag noBoost
  const nonBoostable=['purchase','spend','redeem','refund','revert','admin','sync','cumpleanos'];
  if(nonBoostable.includes(kind)||context.noBoost){
    let already=Number(context.alreadyGranted||0);
    let grantAmt=Math.max(0,Math.round((baseAmount-already)*100)/100);
    return {base:baseAmount,multiplier:1,extra:0,total:baseAmount,grantAmount:grantAmt,boosterId:null,boosterName:null,kind:kind||'star'};
  }
  
  if(!d.boosters){
    d.boosters={active:[],inventory:[],progress:{survivedUrgesCount:0,awardedBraveThresholds:[],lastNightOfConstancyStreakTs:null}};
  }
  cleanExpiredBoosters(d);
  
  let eventTs=Number(context.eventTs||Date.now());
  let candidates=[];
  
  // 1. Boosters activos temporales (ej. Noche de Constancia x1.5, Ventana Estelar x1.5)
  if(Array.isArray(d.boosters.active)){
    d.boosters.active.forEach(b=>{
      if(!b)return;
      let start=Number(b.startedAt||b.activatedAt||0);
      let isTimeEligible=(start<=eventTs&&(!b.expiresAt||eventTs<b.expiresAt));
      if(!isTimeEligible)return;
      
      let bScope=Array.isArray(b.scope)?b.scope:[];
      let matchScope=bScope.includes(kind)||(kind.startsWith('impulso')&&bScope.includes('impulso'));
      
      if(matchScope){
        candidates.push({booster:b,isInventory:false});
      }
    });
  }
  
  // 2. Boosters de inventario aplicables (ej. Impulso Valiente x2 en próximo timer superado)
  if(Array.isArray(d.boosters.inventory)){
    d.boosters.inventory.forEach(b=>{
      if(!b||b.usesRemaining<=0)return;
      let bScope=Array.isArray(b.scope)?b.scope:[];
      let matchScope=false;
      if(kind==='impulso-timer'||context.isTimer){
        matchScope=bScope.includes('impulso-timer')||bScope.includes('impulso');
      }else if(bScope.includes(kind)){
        matchScope=true;
      }
      if(matchScope){
        candidates.push({booster:b,isInventory:true});
      }
    });
  }
  
  let alreadyGranted=Number(context.alreadyGranted||0);
  
  if(!candidates.length){
    let grantAmt=Math.max(0,Math.round((baseAmount-alreadyGranted)*100)/100);
    return {base:baseAmount,multiplier:1,extra:0,total:baseAmount,grantAmount:grantAmt,boosterId:null,boosterName:null,kind:kind||'star'};
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
  let grantAmount=Math.max(0,Math.round((totalAmount-alreadyGranted)*100)/100);
  
  // Actualizar consumo del booster elegido
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
    grantAmount:grantAmount,
    boosterId:b.id,
    boosterName:b.name,
    kind:kind||'star'
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
 let grantBase=Math.min(Number(points),remaining);
 if(grantBase<=0){
   return {base:0,multiplier:1,extra:0,total:0,grantAmount:0,boosterId:null,boosterName:null,kind:action};
 }
 d.pointAwards[k].actions[action]=Math.round((already+grantBase)*100)/100;
 let boostResult=applyStarBoost(d,grantBase,action,{refId});
 addPoints(d,boostResult.total,'accion',label||action,refId,null,boostResult.boosterId?boostResult:null);
 save(d,true);
 return boostResult;
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
