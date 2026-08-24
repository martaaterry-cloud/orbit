// Diario, Lo que no envié, cartas para mi yo futuro y de autocuidado.
// Extraído desde app.js sin romper compatibilidad.

let mood=5;
for(let i=1;i<=10;i++){let b=document.createElement('button');b.textContent=i;b.onclick=()=>{mood=i;document.querySelectorAll('#moodScale button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel')};if(i===5)b.classList.add('sel');moodScale.appendChild(b)}

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

function openOrbitItem(){
 let titleEl=document.getElementById('orbitModalTitle');
 let btnEl=document.getElementById('orbitSubmitBtn');
 let idInput=document.getElementById('orbitEditId');
 if(titleEl)titleEl.textContent='Añadir un pilar';
 if(btnEl)btnEl.textContent='Añadir';
 if(idInput)idInput.value='';
 orbitName.value='';
 orbitMeaning.value='';
 orbitModal.classList.add('show');
}

function openEditOrbitItem(id){
 if(!id)return;
 let d=load();
 let p=(d.orbit||[]).find(x=>x.id===id);
 if(!p)return;
 let titleEl=document.getElementById('orbitModalTitle');
 let btnEl=document.getElementById('orbitSubmitBtn');
 let idInput=document.getElementById('orbitEditId');
 if(titleEl)titleEl.textContent='Editar pilar';
 if(btnEl)btnEl.textContent='Guardar cambios';
 if(idInput)idInput.value=id;
 orbitName.value=p.name||'';
 orbitMeaning.value=p.meaning||'';
 orbitModal.classList.add('show');
}

function saveOrbitItem(){
 let n=orbitName.value.trim();
 if(!n)return toast('Ponle un nombre al pilar');
 let m=orbitMeaning.value.trim();
 let d=load();
 if(!d.orbit)d.orbit=[];
 let idInput=document.getElementById('orbitEditId');
 let editId=idInput?idInput.value:'';

 if(editId){
  let p=d.orbit.find(x=>x.id===editId);
  if(p){
   p.name=n;
   p.meaning=m;
  }
  toast('Pilar actualizado');
 }else{
  d.orbit.push({id:'o_'+uid(),name:n,meaning:m});
  toast('Pilar añadido a tu órbita');
 }
 save(d);
 orbitName.value='';
 orbitMeaning.value='';
 if(idInput)idInput.value='';
 closeModal('orbitModal');
 render();
}

function removeOrbit(id){
 if(!id)return;
 let d=load();
 let p=(d.orbit||[]).find(x=>x.id===id);
 if(!p)return;
 let linked=(d.goodThings||[]).filter(g=>g&&g.pillarId===id);
 let msg=`¿Eliminar el pilar "${p.name}"?`;
 if(linked.length>0){
  msg+=`\n\nEste pilar tiene ${linked.length} recuerdo(s) asociado(s). Los recuerdos NO se borrarán, sino que pasarán a quedar "Sin asociar".`;
 }
 let ok=confirm(msg);
 if(!ok)return;

 if(Array.isArray(d.goodThings)){
  d.goodThings.forEach(g=>{
   if(g&&g.pillarId===id){
    g.pillarId=null;
   }
  });
 }
 d.orbit=(d.orbit||[]).filter(x=>x.id!==id);
 save(d);
 toast(`Pilar "${p.name}" eliminado`);
 render();
}

// ==========================================================================
// FOTOS EN RECUERDOS (SUPABASE STORAGE)
// ==========================================================================
let selectedGoodPhotoBlob = null;

function triggerGoodPhotoSelect(){
  if(typeof navigator !== 'undefined' && !navigator.onLine){
    return toast('Necesitas conexión para añadir una foto. Puedes guardar el recuerdo sin ella.');
  }
  let input = document.getElementById('goodPhotoInput');
  if(input) input.click();
}

async function compressImageFile(file, maxDimension = 1600, quality = 0.8){
  return new Promise((resolve, reject) => {
    let img = new Image();
    let reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if(width > height){
        if(width > maxDimension){
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if(height > maxDimension){
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      let canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if(blob) resolve(blob);
          else reject(new Error('Error al procesar la imagen'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function handleGoodPhotoSelect(e){
  let file = e.target.files?.[0];
  if(!file) return;

  if(typeof navigator !== 'undefined' && !navigator.onLine){
    clearGoodPhotoSelect();
    return toast('Necesitas conexión para añadir una foto. Puedes guardar el recuerdo sin ella.');
  }

  let previewWrap = document.getElementById('goodPhotoPreviewWrap');
  let previewImg = document.getElementById('goodPhotoPreviewImg');
  let fileNameEl = document.getElementById('goodPhotoFileName');

  try {
    toast('Procesando foto…');
    let compressedBlob = await compressImageFile(file, 1600, 0.8);
    selectedGoodPhotoBlob = compressedBlob;

    if(previewImg){
      let objUrl = URL.createObjectURL(compressedBlob);
      previewImg.src = objUrl;
    }
    if(fileNameEl) fileNameEl.textContent = file.name || 'Foto lista';
    if(previewWrap) previewWrap.style.display = 'flex';
  } catch (err) {
    console.error('Error al procesar foto:', err);
    clearGoodPhotoSelect();
    toast('No se pudo procesar la foto. Puedes guardar el recuerdo sin ella.');
  }
}

function clearGoodPhotoSelect(){
  selectedGoodPhotoBlob = null;
  let input = document.getElementById('goodPhotoInput');
  if(input) input.value = '';
  let previewWrap = document.getElementById('goodPhotoPreviewWrap');
  let previewImg = document.getElementById('goodPhotoPreviewImg');
  if(previewImg) previewImg.src = '';
  if(previewWrap) previewWrap.style.display = 'none';
}

async function addGoodThing(){
  let t=goodThing.value.trim();
  if(!t)return toast('Escribe algo que quieras guardar');

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if(selectedGoodPhotoBlob && isOffline){
    return toast('Necesitas conexión para añadir una foto. Puedes guardar el recuerdo sin ella.');
  }

  let d=load();
  let gId=uid();
  let sel=document.getElementById('goodPillarSelect');
  let pId=sel?sel.value.trim():'';
  let item={id:gId,ts:Date.now(),text:t,meaning:goodMeaning.value.trim()};
  if(pId)item.pillarId=pId;

  let submitBtn=document.getElementById('addGoodSubmitBtn');

  if(selectedGoodPhotoBlob){
    let sb=typeof getSupabase==='function'?getSupabase():null;
    if(!sb){
      return toast('Servicio en la nube no disponible. Puedes guardar el recuerdo sin foto.');
    }
    const { data: { session } } = await sb.auth.getSession();
    if(!session || !session.user){
      return toast('Inicia sesión en la nube para adjuntar fotos.');
    }

    if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent='Subiendo foto…'; }
    const photoPath=`${session.user.id}/good-things/${gId}.jpg`;

    try {
      const { error: uploadError } = await sb.storage
        .from('orbit-media')
        .upload(photoPath, selectedGoodPhotoBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if(uploadError){
        console.error('Error al subir foto a Supabase Storage:', uploadError);
        if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Guardar en mi órbita de hoy'; }
        return toast('Error al subir la foto. Puedes intentarlo de nuevo o guardarlo sin foto.');
      }

      item.photoPath=photoPath;
    } catch (err) {
      console.error('Excepción al subir foto:', err);
      if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Guardar en mi órbita de hoy'; }
      return toast('Error de red al subir la foto.');
    }
  }

  d.goodThings.push(item);
  save(d);
  goodThing.value='';
  goodMeaning.value='';
  if(sel)sel.value='';
  clearGoodPhotoSelect();
  if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Guardar en mi órbita de hoy'; }

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

  let photoPathToDelete = item.photoPath || null;

  revertPointsForRef(d,id,'goodThing',item.ts?dayKey(item.ts):null);
  d.goodThings=d.goodThings.filter(x=>x.id!==id);
  save(d);
  toast('Recuerdo eliminado');
  render();
  if(typeof renderArchive==='function')renderArchive();

  // Intentar eliminar foto en Storage de forma asíncrona y segura
  if(photoPathToDelete){
    let sb=typeof getSupabase==='function'?getSupabase():null;
    if(sb){
      sb.storage.from('orbit-media').remove([photoPathToDelete]).then(({error})=>{
        if(error){
          console.warn('Advertencia: no se pudo eliminar la foto de Storage:', photoPathToDelete, error);
        }
      }).catch(err=>{
        console.warn('Advertencia: excepción al eliminar foto de Storage:', photoPathToDelete, err);
      });
    }
  }
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
