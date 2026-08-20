// Persistencia, migraciones de versión, exportación y futuras copias de seguridad.
// Extraído desde app.js sin romper compatibilidad.

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
   ['bank','claimed','best','pointAwards','goals','rewards','urges','slips','journal','checkins','orbit'].forEach(k=>{if(old[k]!==undefined)d[k]=old[k]});
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
 if(d.shipLevel===undefined)d.shipLevel=0;
 if(!d.unlockedRegions)d.unlockedRegions=['cielo-1'];
 save(d);return d
}

function save(d){localStorage.setItem('orbitV9',JSON.stringify(d))}
