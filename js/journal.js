// Diario, Lo que no envié, cartas para mi yo futuro y de autocuidado.
// Extraído desde app.js sin romper compatibilidad.

let mood=3;
for(let i=1;i<=5;i++){let b=document.createElement('button');b.textContent=i;b.onclick=()=>{mood=i;document.querySelectorAll('#moodScale button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel')};if(i===3)b.classList.add('sel');moodScale.appendChild(b)}

function saveCheckin(){
 let d=load(),k=dayKey(),cId='checkin-'+k;
 d.checkins[k]={id:cId,ts:Date.now(),mood,need:needToday.value.trim(),forMe:forMeToday.value.trim()};
 save(d);
 let got=awardDailyAction('checkin',.2,.2,'Check-in',cId);
 toast(got?'Día guardado · +0,2':'Día actualizado');
 render();
}

const prompts=[['Lo que pesa hoy','Una frase basta.'],['Algo que hoy sí fue mío','Puede ser pequeño o cotidiano.'],['Lo que no necesito resolver esta noche','Déjalo aquí.'],['Una cosa que me sorprendió de mí','Sin juzgarla.'],['Qué sigue orbitando','Algo que todavía está, aunque haya cambiado.']];

function saveQuickEntry(){
 let t=quickText.value.trim();
 if(!t)return toast('Escribe aunque sea una línea');
 let d=load(),p=prompts[new Date().getDate()%prompts.length];
 let eId=uid();
 d.journal.push({id:eId,ts:Date.now(),type:'rapida',title:p[0],text:t});
 save(d);
 quickText.value='';
 let got=awardDailyAction('journal',.1,.5,p[0]||'Escribir',eId);
 toast(got?'Guardado · +0,1':'Guardado');
 render();
}

let journalType='libre',journalFilter='all';
const journalCopy={libre:['¿Qué quieres dejar aquí?','No hace falta que tenga principio ni final.'],'no-enviado':['Lo que no envié','Puedes escribir exactamente lo que te saldría mandar.'],'futuro':['Para mi yo futuro','Desde quien eres hoy hacia una versión de ti que todavía no conoces.'],aprendi:['Lo que aprendí','Sobre lo que ahora sabes.'],invisible:['Cómo se ve lo invisible','Aquello que no puede tocarse, pero sigue teniendo peso.']};

function setJournalType(type,btn){
 journalType=type;
 document.querySelectorAll('#journalTabs button').forEach(b=>b.classList.remove('active'));
 btn.classList.add('active');
 journalPrompt.textContent=journalCopy[type][0];
 journalHint.textContent=journalCopy[type][1];
 futureDateWrap.style.display=type==='futuro'?'block':'none'
}

function saveJournalEntry(){
 let text=entryText.value.trim();
 if(!text)return toast('No hay nada que guardar todavía');
 let d=load();
 let eId=uid();
 d.journal.push({id:eId,ts:Date.now(),type:journalType,title:entryTitle.value.trim(),text,futureDate:journalType==='futuro'?(futureDate.value||null):null});
 save(d);
 entryTitle.value='';
 entryText.value='';
 futureDate.value='';
 let got=awardDailyAction('journal',.1,.5,'Escribir',eId);
 toast(got?'Entrada guardada · +0,1':'Entrada guardada');
 render();
}

function openOrbitItem(){orbitModal.classList.add('show')}
function addOrbitItem(){let n=orbitName.value.trim();if(!n)return toast('Ponle un nombre');let d=load();d.orbit.push({id:uid(),name:n,meaning:orbitMeaning.value.trim()});save(d);orbitName.value='';orbitMeaning.value='';closeModal('orbitModal');render()}
function removeOrbit(id){let d=load();d.orbit=d.orbit.filter(x=>x.id!==id);save(d);render()}

function addGoodThing(){
 let t=goodThing.value.trim();
 if(!t)return toast('Escribe algo que quieras guardar');
 let d=load();
 let gId=uid();
 let sel=document.getElementById('goodPillarSelect');
 let pId=sel?sel.value.trim():'';
 let item={id:gId,ts:Date.now(),text:t,meaning:goodMeaning.value.trim()};
 if(pId)item.pillarId=pId;
 d.goodThings.push(item);
 save(d);
 goodThing.value='';
 goodMeaning.value='';
 if(sel)sel.value='';
 let got=awardDailyAction('goodThing',.1,.5,'Algo bueno',gId);
 toast(got?'Guardado · +0,1':'Guardado en tu órbita de hoy');
 render();
}

function deleteGood(id){
 if(!id)return;
 let ok=confirm('¿Eliminar este recuerdo?');
 if(!ok)return;
 let d=load();
 if(!Array.isArray(d.goodThings))return;
 let item=d.goodThings.find(x=>x.id===id);
 if(!item)return;
 revertPointsForRef(d,id,'goodThing',item.ts?dayKey(item.ts):null);
 d.goodThings=d.goodThings.filter(x=>x.id!==id);
 save(d);
 toast('Recuerdo eliminado');
 render();
 if(typeof renderArchive==='function')renderArchive();
}

function deleteJournalEntry(id){
 if(!id)return;
 let ok=confirm('¿Eliminar esta entrada del diario?');
 if(!ok)return;
 let d=load();
 if(!Array.isArray(d.journal))return;
 let item=d.journal.find(x=>x.id===id);
 if(!item)return;
 revertPointsForRef(d,id,'journal',item.ts?dayKey(item.ts):null);
 d.journal=d.journal.filter(x=>x.id!==id);
 save(d);
 toast('Entrada eliminada');
 render();
 if(typeof renderArchive==='function')renderArchive();
}

function deleteCheckin(day){
 if(!day)return;
 let ok=confirm('¿Eliminar el check-in de este día?');
 if(!ok)return;
 let d=load();
 if(!d.checkins||!d.checkins[day])return;
 revertPointsForRef(d,'checkin-'+day,'checkin',day);
 delete d.checkins[day];
 save(d);
 toast('Check-in eliminado');
 render();
 if(typeof renderArchive==='function')renderArchive();
}
