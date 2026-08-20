// Economía de estrellas: hoy, disponibles, históricas e historial de ganancias.
// Extraído desde app.js sin romper compatibilidad.

function addPoints(d,amount,kind,label){
 amount=Number(amount||0);
 if(amount<=0)return;
 d.wallet=Number(d.wallet||0)+amount;
 d.lifetimeStars=Number(d.lifetimeStars||0)+amount;
 d.bank=d.wallet;
 let k=dayKey();
 if(!d.pointAwards[k])d.pointAwards[k]={limits:{},actions:{},events:[]};
 if(!d.pointAwards[k].events)d.pointAwards[k].events=[];
 d.pointAwards[k].events.push({ts:Date.now(),amount,kind,label});
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

function awardDailyAction(action,points,dailyCap,label){
 let d=load(),k=dayKey();
 if(!d.pointAwards[k])d.pointAwards[k]={limits:{},actions:{},events:[]};
 if(!d.pointAwards[k].actions)d.pointAwards[k].actions={};
 let already=Number(d.pointAwards[k].actions[action]||0);
 let remaining=Math.max(0,Number(dailyCap)-already);
 let grant=Math.min(Number(points),remaining);
 if(grant<=0)return 0;
 d.pointAwards[k].actions[action]=already+grant;
 addPoints(d,grant,'accion',label||action);
 save(d);
 return grant
}
