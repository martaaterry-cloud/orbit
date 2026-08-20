// Archivo, calendario, filtros por fechas, búsqueda y visualización histórica.
// Extraído desde app.js sin romper compatibilidad.

let archiveView='day',archiveMonth=new Date(),selectedDay=dayKey(),journalSearchTerm='';
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
  let active=new Set([...Object.keys(d.checkins),...d.journal.map(e=>dayKey(e.ts)),...d.urges.map(e=>dayKey(e.ts)),...d.goodThings.map(e=>dayKey(e.ts))]);
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

function renderDayDetail(d){let dt=new Date(selectedDay+'T12:00:00');selectedDayTitle.textContent=dt.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});let html='';let pa=d.pointAwards?.[selectedDay];if(pa){let pts=0;if(Array.isArray(pa.events))pts=pa.events.reduce((s,e)=>s+Number(e.amount||0),0);else{if(pa.actions)Object.values(pa.actions).forEach(v=>pts+=Number(v||0));if(pa.limits)Object.values(pa.limits).forEach(v=>pts+=Number(v||0))}html+=`<div class="card stat"><div class="label">estrellas ganados este día</div><strong>${pts.toFixed(1).replace('.',',')}</strong></div>`;}let c=d.checkins[selectedDay];if(c)html+=`<div class="card entry-card"><div class="entry-meta"><span class="entry-type">check-in</span></div><p>Estado: ${c.mood}/5${c.need?'<br>Necesitaba: '+esc(c.need):''}${c.forMe?'<br>Por mí: '+esc(c.forMe):''}</p></div>`;d.journal.filter(e=>dayKey(e.ts)===selectedDay).forEach(e=>html+=entryHTML(e));d.goodThings.filter(e=>dayKey(e.ts)===selectedDay).forEach(g=>html+=goodHTML(g));d.urges.filter(e=>dayKey(e.ts)===selectedDay).forEach(u=>html+=urgeHTML(u,d));dayDetail.innerHTML=html||'<div class="empty">No guardaste nada este día.</div>'}

function entryHTML(e){
 let future=e.type==='futuro'&&e.futureDate;
 if(future){
   let openTs=new Date(e.futureDate+'T00:00:00').getTime();
   let locked=Date.now()<openTs;
   if(locked){
     return `<div class="card entry-card future-sealed">
       <div class="entry-meta"><span class="entry-type">carta para mi yo futuro</span><span class="future-badge">guardada</span></div>
       <h3>${e.title?esc(e.title):'Carta cerrada'}</h3>
       <p>Podrás volver a abrirla el ${new Date(e.futureDate+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}.</p>
     </div>`
   }
 }
 return `<div class="card entry-card"><div class="entry-meta"><span class="entry-type">${esc(e.type.replaceAll('-',' '))}</span><span>${new Date(e.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</span></div>${e.title?`<h3>${esc(e.title)}</h3>`:''}<p>${esc(e.text)}</p></div>`
}

function goodHTML(g){return `<div class="card entry-card"><div class="entry-meta"><span class="entry-type">lo que sí pasó</span><span>${new Date(g.ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span></div><h3>${esc(g.text)}</h3>${g.meaning?`<p>${esc(g.meaning)}</p>`:''}</div>`}
function urgeHTML(u,d){let g=d.goals.find(x=>x.id===u.goalId);return `<div class="card entry-card"><div class="entry-meta"><span class="entry-type">${g?esc(g.name):'impulso'}</span><span>${u.survived?'atravesado':'registrado'}</span></div><p>Ansiedad: ${u.intensity}/10${u.hope?'<br>Esperaba: '+esc(u.hope):''}${u.fear?'<br>Temía: '+esc(u.fear):''}</p></div>`}

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
 goodArchiveList.innerHTML=arr.length?arr.map(goodHTML).join(''):'<div class="empty">Todavía no hay nada aquí.</div>'
}

function renderUrgeArchive(){
 let d=load(),f=urgeFilter.value||'all',out=urgeOutcomeFilter.value||'all';
 let arr=d.urges.filter(u=>(f==='all'||u.goalId===f)&&inTime(u.ts,timeFilters.urges)&&(out==='all'||(out==='survived'&&u.survived)||(out==='registered'&&!u.survived)));
 arr.sort((a,b)=>sortModes.urges==='desc'?b.ts-a.ts:a.ts-b.ts);
 urgeResultsCount.textContent=arr.length+' resultado'+(arr.length===1?'':'s');
 urgeArchiveList.innerHTML=arr.length?arr.map(u=>urgeHTML(u,d)).join(''):'<div class="empty">No hay impulsos que coincidan.</div>'
}

function renderArchive(){let d=load();renderCalendar(d);renderDayDetail(d);renderArchiveJournal();renderGoodArchive();urgeFilter.innerHTML='<option value="all">Todos los impulsos</option>'+d.goals.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');renderUrgeArchive()}
