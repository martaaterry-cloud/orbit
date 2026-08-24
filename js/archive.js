// Archivo, calendario, filtros por fechas, búsqueda y visualización histórica.
// Extraído desde app.js sin romper compatibilidad.

let archiveView='day',archiveMonth=new Date(),selectedDay=(typeof dayKey==='function'?dayKey():new Date().toISOString().split('T')[0]),journalSearchTerm='';
const timeFilters={
 journal:{mode:'all',from:null,to:null},
 good:{mode:'all',from:null,to:null},
 urges:{mode:'all',from:null,to:null}
};
const sortModes={journal:'desc',good:'desc',urges:'desc'};

function boundsFor(filter){
 let now=new Date(),start=null,end=null;
 if(filter.mode==='today'){
   start=new Date();start.setHours(0,0,0,0);end=new Date();end.setHours(23,59,59,999)
 }else if(filter.mode==='7d'){
   end=new Date();end.setHours(23,59,59,999);start=new Date();start.setDate(start.getDate()-6);start.setHours(0,0,0,0)
 }else if(filter.mode==='month'){
   start=new Date(now.getFullYear(),now.getMonth(),1);end=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)
 }else if(filter.mode==='prevmonth'){
   start=new Date(now.getFullYear(),now.getMonth()-1,1);end=new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999)
 }else if(filter.mode==='custom'&&filter.from&&filter.to){
   start=new Date(filter.from+'T00:00:00');end=new Date(filter.to+'T23:59:59')
 }
 return {start:start?start.getTime():null,end:end?end.getTime():null}
}

function inTime(ts,filter){
 let b=boundsFor(filter);
 return (b.start===null||ts>=b.start)&&(b.end===null||ts<=b.end)
}

function setTimeFilterFromSelect(target,select){
 let mode=select.value;
 if(mode==='custom'){openDateRange(target);return}
 timeFilters[target].mode=mode;
 timeFilters[target].from=null;timeFilters[target].to=null;
 if(target==='journal')renderArchiveJournal();
 if(target==='good')renderGoodArchive();
 if(target==='urges')renderUrgeArchive()
}

function openDateRange(target){
 dateRangeTarget.value=target;
 let now=dayKey();dateFrom.value=now;dateTo.value=now;
 dateRangeModal.classList.add('show')
}

function applyDateRange(){
 let target=dateRangeTarget.value;
 if(!dateFrom.value||!dateTo.value)return toast('Elige las dos fechas');
 let a=dateFrom.value,b=dateTo.value;if(a>b){let t=a;a=b;b=t}
 timeFilters[target]={mode:'custom',from:a,to:b};
 let sel=document.getElementById(target==='journal'?'journalPeriod':target==='good'?'goodPeriod':'urgesPeriod');
 if(sel)sel.value='custom';
 closeModal('dateRangeModal');
 if(target==='journal')renderArchiveJournal();
 if(target==='good')renderGoodArchive();
 if(target==='urges')renderUrgeArchive()
}

function toggleSort(target){
 sortModes[target]=sortModes[target]==='desc'?'asc':'desc';
 let el=document.getElementById(target+'SortLabel');if(el)el.textContent=sortModes[target]==='desc'?'recientes':'antiguos';
 if(target==='journal')renderArchiveJournal();
 if(target==='good')renderGoodArchive();
 if(target==='urges')renderUrgeArchive()
}

function setArchiveView(v){archiveView=v;document.querySelectorAll('.archive-panel').forEach(x=>x.classList.remove('active'));document.getElementById('panel-'+v).classList.add('active');document.querySelectorAll('.archive-switch button').forEach(x=>x.classList.remove('active'));document.getElementById('av-'+v).classList.add('active');renderArchive();let d=load();renderUniverse(d)}
function changeMonth(delta){archiveMonth=new Date(archiveMonth.getFullYear(),archiveMonth.getMonth()+delta,1);renderCalendar(load())}

function renderCalendar(d){
  let y=archiveMonth.getFullYear(),m=archiveMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),offset=(first.getDay()+6)%7;
  let titleEl = document.getElementById('calendarTitle');
  if(titleEl) titleEl.textContent=archiveMonth.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  
  let active=new Set();
  if(d && d.checkins) Object.keys(d.checkins).forEach(k=>active.add(k));
  if(d && Array.isArray(d.journal)) d.journal.forEach(e=>{if(e&&e.ts) active.add(dayKey(e.ts))});
  if(d && Array.isArray(d.urges)) d.urges.forEach(e=>{if(e&&e.ts) active.add(dayKey(e.ts))});
  if(d && Array.isArray(d.goodThings)) d.goodThings.forEach(e=>{if(e&&e.ts) active.add(dayKey(e.ts))});

  let html='';
  for(let i=0;i<offset;i++)html+='<div></div>';
  for(let day=1;day<=last.getDate();day++){
    let dt=new Date(y,m,day),k=dayKey(dt.getTime()),cls='day'+(active.has(k)?' has':'')+(k===dayKey()?' today':'')+(k===selectedDay?' selected':'');
    html+=`<button class="${cls}" onclick="selectDay('${k}')">${day}</button>`
  }
  let calEl = document.getElementById('calendar');
  if(calEl) calEl.innerHTML=html;
}
function selectDay(k){selectedDay=k;renderCalendar(load());renderDayDetail(load())}

function renderDayDetail(d){
  let dt=new Date(selectedDay+'T12:00:00');
  selectedDayTitle.textContent=dt.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  let html='';
  if (d) {
    let pa=d.pointAwards?.[selectedDay];
    if(pa){
      let pts=0;
      if(Array.isArray(pa.events))pts=pa.events.reduce((s,e)=>s+Number(e.amount||0),0);
      else{
        if(pa.actions)Object.values(pa.actions).forEach(v=>pts+=Number(v||0));
        if(pa.limits)Object.values(pa.limits).forEach(v=>pts+=Number(v||0))
      }
      html+=`<div class="card stat" onclick="openTodayPointsModal('${selectedDay}')" style="cursor:pointer;" title="Ver detalle de estrellas de este día"><div class="label" style="display:flex; align-items:center; justify-content:center; gap:3px;"><span>estrellas ganadas este día</span><svg class="icon" viewBox="0 0 24 24" style="width:11px; height:11px; stroke:var(--wine); opacity:0.75;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div><strong>${pts.toFixed(1).replace('.',',')}</strong></div>`;
    }
    let c=d.checkins?.[selectedDay];
    if(c){
      let parts = [];
      if(c.mood !== undefined && c.mood !== null && c.mood !== '') parts.push(`Estado: ${c.mood}/10`);
      if(c.need) parts.push(`Una cosa que necesitaba hoy: ${esc(c.need)}`);
      if(c.forMe) parts.push(`Una cosa que quería hacer por mí: ${esc(c.forMe)}`);
      let checkinContent=`<div class="entry-meta"><span class="entry-type">check-in</span><span>${c.ts?new Date(c.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
      <p>${parts.join('<br>')}</p>`;
      html+=wrapSwipe(checkinContent, `deleteCheckin('${selectedDay}')`, 'entry-card');
    }
    let ref = d.reflections?.[selectedDay];
    if(ref && ref.answer){
      let refContent = `<div class="entry-meta"><span class="entry-type">reflexión del día</span><span>${ref.ts?new Date(ref.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
      <h3 style="font-family:Georgia,serif; font-size:15px; margin:6px 0 4px; color:var(--ink);">${esc(ref.prompt || 'Pregunta del día')}</h3>
      <p style="font-size:12px; line-height:1.48; margin:0; white-space:pre-wrap;">${esc(ref.answer)}</p>`;
      html += `<div class="card entry-card">${refContent}</div>`;
    }
    if(Array.isArray(d.journal)) d.journal.filter(e=>e && e.ts && dayKey(e.ts)===selectedDay).forEach(e=>html+=entryHTML(e));
    if(Array.isArray(d.goodThings)) d.goodThings.filter(g=>g && g.ts && dayKey(g.ts)===selectedDay).forEach(g=>html+=goodHTML(g, d));
    if(Array.isArray(d.urges)) d.urges.filter(u=>u && u.ts && dayKey(u.ts)===selectedDay).forEach(u=>html+=urgeHTML(u,d));
  }
  let addBtnHtml = `<button class="btn btn-dashed btn-wide" style="margin-top:12px; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="openAddMemoryPastDay('${selectedDay}')"><svg class="icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><path d="M12 5v14M5 12h14"/></svg><span>Añadir recuerdo a este día</span></button>`;
  dayDetail.innerHTML=(html||'<div class="empty">No guardaste nada este día.</div>') + addBtnHtml;
  if(typeof loadPhotoThumbnails==='function')loadPhotoThumbnails();
}

function entryHTML(e){
 if(!e)return '';
 let future=e.type==='futuro'&&e.futureDate;
 let isLocked=false;
 if(future){
  let openTs=new Date(e.futureDate+'T00:00:00').getTime();
  isLocked=Date.now()<openTs;
 }
 let contentHtml='';
 if(isLocked){
  contentHtml=`<div class="entry-meta"><span class="entry-type">carta para mi yo futuro</span><span class="future-badge">guardada</span></div><h3>${e.title?esc(e.title):'Carta cerrada'}</h3><p>Podrás volver a abrirla el ${new Date(e.futureDate+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}.</p>`;
 }else{
  contentHtml=`<div class="entry-meta"><span class="entry-type">${esc((e.type||'diario').replaceAll('-',' '))}</span><span>${new Date(e.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</span></div>${e.title?`<h3>${esc(e.title)}</h3>`:''}<p>${esc(e.text)}</p>`;
 }

 return wrapSwipe(contentHtml, `deleteJournalEntry('${e.id}')`, `entry-card ${isLocked?'future-sealed':''}`);
}

function goodHTML(g, d = null){
 let pillarName = '';
 if(g && g.pillarId){
  let state = d || (typeof load === 'function' ? load() : null);
  if(state && Array.isArray(state.orbit)){
   let p = state.orbit.find(o => o && o.id === g.pillarId);
   if(p) pillarName = p.name;
  }
 }
 let photoHtml=g.photoPath?`<div class="good-photo-thumb-wrap" data-photo-path="${esc(g.photoPath)}" onclick="event.stopPropagation(); previewGoodPhoto('${esc(g.photoPath)}')"><div class="good-photo-loading"></div><img class="good-photo-thumb" style="display:none;" alt="Foto del recuerdo"></div>`:'';
 let contentHtml=`<div class="good-card-row">
   <div class="good-card-text">
     <div class="entry-meta">
       <span class="entry-type">lo que sí pasó${pillarName ? ` · ${esc(pillarName)}` : ''}</span>
       <span>${new Date(g.ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span>
     </div>
     <h3>${esc(g.text)}</h3>
     ${g.meaning?`<p>${esc(g.meaning)}</p>`:''}
   </div>
   ${photoHtml}
 </div>`;

 return wrapSwipe(contentHtml, `deleteGood('${g.id}')`, 'entry-card');
}

function urgeHTML(u, d){
 let g=d.goals.find(x=>x.id===u.goalId);
 let contentHtml=`<div class="entry-meta">
   <span class="entry-type">${g?esc(g.name):'impulso'}</span>
   <span>${u.survived?'atravesado':'registrado'} · ${new Date(u.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</span>
 </div>
 <p>Ansiedad: ${u.intensity}/10${u.hope?'<br>Esperaba: '+esc(u.hope):''}${u.fear?'<br>Temía: '+esc(u.fear):''}</p>`;

 return wrapSwipe(contentHtml, `deleteUrge('${u.id}')`, 'entry-card');
}

function setJournalFilter(f,btn){journalFilter=f;document.querySelectorAll('#archiveJournalTabs button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderArchiveJournal()}

function renderArchiveJournal(){
 let d=load(),q=(journalSearch.value||'').toLowerCase();
 let arr=d.journal.filter(e=>(journalFilter==='all'||e.type===journalFilter)&&inTime(e.ts,timeFilters.journal)&&(!q||(e.text+' '+(e.title||'')).toLowerCase().includes(q)));
 arr.sort((a,b)=>sortModes.journal==='desc'?b.ts-a.ts:a.ts-b.ts);
 journalResultsCount.textContent=arr.length+' resultado'+(arr.length===1?'':'s');
 archiveJournalList.innerHTML=arr.length?arr.map(entryHTML).join(''):'<div class="empty">No hay entradas que coincidan.</div>'
}

function renderGoodArchive(){
 let d=load(),q=(goodSearch.value||'').toLowerCase();
 let arr=d.goodThings.filter(g=>inTime(g.ts,timeFilters.good)&&(!q||(g.text+' '+(g.meaning||'')).toLowerCase().includes(q)));
 arr.sort((a,b)=>sortModes.good==='desc'?b.ts-a.ts:a.ts-b.ts);
 goodResultsCount.textContent=arr.length+' resultado'+(arr.length===1?'':'s');
 goodArchiveList.innerHTML=arr.length?arr.map(g=>goodHTML(g, d)).join(''):'<div class="empty">Todavía no hay nada aquí.</div>';
 if(typeof loadPhotoThumbnails==='function')loadPhotoThumbnails();
}

function renderUrgeArchive(){
 let d=load(),f=urgeFilter.value||'all',out=urgeOutcomeFilter.value||'all';
 let arr=d.urges.filter(u=>(f==='all'||u.goalId===f)&&inTime(u.ts,timeFilters.urges)&&(out==='all'||(out==='survived'&&u.survived)||(out==='registered'&&!u.survived)));
 arr.sort((a,b)=>sortModes.urges==='desc'?b.ts-a.ts:a.ts-b.ts);
 urgeResultsCount.textContent=arr.length+' resultado'+(arr.length===1?'':'s');
 urgeArchiveList.innerHTML=arr.length?arr.map(u=>urgeHTML(u,d)).join(''):'<div class="empty">No hay impulsos que coincidan.</div>'
}

function renderArchive(){let d=load();renderCalendar(d);renderDayDetail(d);renderArchiveJournal();renderGoodArchive();if(document.getElementById('urgeFilter'))document.getElementById('urgeFilter').innerHTML='<option value="all">Todos los impulsos</option>'+(d.goals||[]).map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');renderUrgeArchive()}

let selectedPastMemoryDay = null;
let selectedPastMemoryPhotoBlob = null;

function openAddMemoryPastDay(dayStr){
  selectedPastMemoryDay = dayStr || selectedDay || (typeof dayKey === 'function' ? dayKey() : new Date().toISOString().split('T')[0]);
  let dt = new Date(selectedPastMemoryDay + 'T12:00:00');
  let titleEl = document.getElementById('addPastMemoryModalTitle');
  if(titleEl) titleEl.textContent = `Añadir recuerdo (${dt.toLocaleDateString('es-ES', {day:'numeric', month:'short'})})`;
  
  let textInput = document.getElementById('pastMemoryText');
  let meaningInput = document.getElementById('pastMemoryMeaning');
  if(textInput) textInput.value = '';
  if(meaningInput) meaningInput.value = '';
  
  let sel = document.getElementById('pastMemoryPillarSelect');
  if(sel){
    let d = (typeof load === 'function') ? load() : null;
    let pillars = (d && Array.isArray(d.orbit)) ? d.orbit : [];
    sel.innerHTML = '<option value="">Sin asociar</option>' + pillars.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  }
  
  clearPastMemoryPhotoSelect();
  let modal = document.getElementById('addPastMemoryModal');
  if(modal) modal.classList.add('show');
}

function triggerPastMemoryPhotoSelect(){
  let input = document.getElementById('pastMemoryPhotoInput');
  if(input) input.click();
}

async function handlePastMemoryPhotoSelect(event){
  let file = event.target.files && event.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){
    return toast('Por favor, selecciona un archivo de imagen.');
  }
  if(typeof navigator !== 'undefined' && !navigator.onLine){
    clearPastMemoryPhotoSelect();
    return toast('Necesitas conexión para adjuntar fotos.');
  }
  try {
    toast('Procesando foto…');
    let compressedBlob = (typeof compressImageFile === 'function')
      ? await compressImageFile(file, 1600, 0.8)
      : file;
    selectedPastMemoryPhotoBlob = compressedBlob;
    let objUrl = URL.createObjectURL(compressedBlob);
    let previewWrap = document.getElementById('pastMemoryPhotoPreviewWrap');
    let previewImg = document.getElementById('pastMemoryPhotoPreviewImg');
    let fileNameEl = document.getElementById('pastMemoryPhotoFileName');
    if(previewImg) previewImg.src = objUrl;
    if(fileNameEl) fileNameEl.textContent = file.name || 'Foto lista';
    if(previewWrap) previewWrap.style.display = 'flex';
  } catch (err) {
    console.error('Error al procesar foto:', err);
    clearPastMemoryPhotoSelect();
    toast('No se pudo procesar la foto.');
  }
}

function clearPastMemoryPhotoSelect(){
  selectedPastMemoryPhotoBlob = null;
  let input = document.getElementById('pastMemoryPhotoInput');
  if(input) input.value = '';
  let previewWrap = document.getElementById('pastMemoryPhotoPreviewWrap');
  let previewImg = document.getElementById('pastMemoryPhotoPreviewImg');
  if(previewImg) previewImg.src = '';
  if(previewWrap) previewWrap.style.display = 'none';
}

async function savePastMemory(){
  let textInput = document.getElementById('pastMemoryText');
  let meaningInput = document.getElementById('pastMemoryMeaning');
  let t = textInput ? textInput.value.trim() : '';
  if(!t) return toast('Escribe algo que quieras guardar');
  
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if(selectedPastMemoryPhotoBlob && isOffline){
    return toast('Necesitas conexión para subir una foto.');
  }
  
  let targetDay = selectedPastMemoryDay || selectedDay || (typeof dayKey === 'function' ? dayKey() : new Date().toISOString().split('T')[0]);
  let d = (typeof load === 'function') ? load() : null;
  if(!d) return;
  if(!Array.isArray(d.goodThings)) d.goodThings = [];
  
  let gId = (typeof uid === 'function') ? uid() : ('good-' + Date.now());
  let sel = document.getElementById('pastMemoryPillarSelect');
  let pId = sel ? sel.value.trim() : '';
  let itemTs = new Date(targetDay + 'T12:00:00').getTime();
  let item = { id: gId, ts: itemTs, text: t, meaning: meaningInput ? meaningInput.value.trim() : '' };
  if(pId) item.pillarId = pId;
  
  let submitBtn = document.getElementById('savePastMemoryBtn');
  if(selectedPastMemoryPhotoBlob){
    let sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if(!sb) return toast('Servicio en la nube no disponible para fotos.');
    const { data: { session } } = await sb.auth.getSession();
    if(!session || !session.user){
      return toast('Inicia sesión en la nube para adjuntar fotos.');
    }
    if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Subiendo foto…'; }
    const photoPath = `${session.user.id}/good-things/${gId}.jpg`;
    try {
      const { error: uploadError } = await sb.storage
        .from('orbit-media')
        .upload(photoPath, selectedPastMemoryPhotoBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });
      if(uploadError){
        console.error('Error al subir foto:', uploadError);
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Guardar recuerdo'; }
        return toast('Error al subir la foto.');
      }
      item.photoPath = photoPath;
    } catch(err){
      console.error('Error al subir foto:', err);
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Guardar recuerdo'; }
      return toast('Error de red al subir la foto.');
    }
  }
  
  d.goodThings.push(item);
  save(d);
  if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Guardar recuerdo'; }
  closeModal('addPastMemoryModal');
  
  let isToday = (typeof dayKey === 'function' && targetDay === dayKey());
  if(isToday){
    let got = (typeof awardDailyAction === 'function') ? awardDailyAction('goodThing', 0.1, 0.5, 'Algo bueno', gId) : false;
    toast(got ? 'Recuerdo guardado · +0,1' : 'Recuerdo guardado');
  } else {
    toast('Recuerdo guardado en el archivo (0 estrellas)');
  }
  
  renderArchive();
  if(typeof render === 'function') render();
}
