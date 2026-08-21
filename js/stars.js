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
