const $=id=>document.getElementById(id);
let token,selected=null,state=null,program=null,lastError='';
async function api(path,body){const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-DD-Token':token},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
function error(e){$('error').textContent=e.message;}
function localMonth(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit'}).format(date);}
async function refreshState(){try{state=await api('/api/state');token=state.token;$('status').textContent=({idle:'Připraveno k výběru',armed:'Čekám na předprodej',running:'Příprava běží',preview:'Dostupnost ověřena',handoff:'Dokonči nákup',attention:'Je potřeba tvoje pozornost'})[state.status]||state.status;$('detail').textContent=state.message;const r=state.result,pair=r?.pair||r;$('result').textContent=pair?.seats?`${pair.adjacent?'Místa vedle sebe':'Oddělená místa'}: ${pair.seats.map(s=>`řada ${s.row}, místo ${s.number} (${s.price} Kč)`).join(' · ')}`:r?.available!==undefined?`${r.available} volných míst; vhodná dvojice v cenovém stropu nebyla nalezena.`:'';for(const id of ['arm','preview','run'])$(id).disabled=!state.selection||state.busy||state.armed;if(r?.suggestedPair)$('result').textContent+=' · Nabídka sousední dvojice: '+r.suggestedPair.map(s=>`${s.row}/${s.number}`).join(' a ')+'. Původní lístky držím.';$('stop').disabled=!state.armed&&!state.busy;}catch(e){error(e);}}
function option(value,text){const el=document.createElement('option');el.value=value;el.textContent=text;return el;}
function eventLabel(e){return `${new Date(e.date+'T12:00:00Z').toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'})} · ${e.time} · ${e.venue}`;}
function chooseEvent(){
 const e=program?.events.find(e=>e.id===$('date-select').value);
 const [year,month]=$('month').value.split('-').map(Number);
 selected=e?{...e,month,year}:null;
 $('chosen').textContent=e?`${e.title} · ${eventLabel(e)}`:'Zatím nemáš vybraný termín.';
}
function showDates(preserveId=''){
 const title=$('show-select').value;
 $('date-select').replaceChildren(option('',title?'Vyber termín a čas':'Nejdřív vyber představení'));
 for(const e of program?.events.filter(e=>e.title===title)||[]){const item=option(e.id,`${eventLabel(e)} · ${e.status==='Odkaz na prodej'?'Vstupenky k dispozici':e.status}`);item.disabled=e.status==='Zadáno';$('date-select').append(item);}
 $('date-select').disabled=!title;
 if(preserveId&&[...$('date-select').options].some(o=>o.value===preserveId&&!o.disabled))$('date-select').value=preserveId;
 chooseEvent();
}
$('show-select').onchange=()=>showDates();
$('date-select').onchange=chooseEvent;
async function loadProgram(){
 try{
  $('error').textContent='';$('refresh').disabled=true;$('show-select').disabled=true;$('date-select').disabled=true;
  const [year,month]=$('month').value.split('-').map(Number);
  const loaded=await api(`/api/program?month=${month}&year=${year}`);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  program={...loaded,events:loaded.events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))};
  $('programNotice').textContent=program.notices.join(' ');
  const previous=selected;
  $('show-select').replaceChildren(option('',program.events.length?'Vyber představení':'Program pro tento měsíc ještě není zveřejněný'));
  for(const title of [...new Set(program.events.map(e=>e.title))].sort((a,b)=>a.localeCompare(b,'cs')))$('show-select').append(option(title,title));
  $('show-select').disabled=!program.events.length;
  if(previous&&program.events.some(e=>e.id===previous.id))$('show-select').value=previous.title;
  showDates(previous?.id);
 }catch(e){program=null;selected=null;$('show-select').replaceChildren(option('','Program se nepodařilo načíst'));$('date-select').replaceChildren(option('','Nejdřív načti program'));$('chosen').textContent='Zatím nemáš vybraný termín.';error(e);}
 finally{$('refresh').disabled=false;}
}
$('refresh').onclick=loadProgram;
$('clear').onclick=async()=>{try{await api('/api/clear',{});selected=null;$('chosen').textContent='Zatím nemáš vybraný termín.';$('show-select').value='';showDates();await refreshState();}catch(e){error(e);}};
$('settings').onsubmit=async e=>{e.preventDefault();try{if(!selected)throw Error('Vyber konkrétní termín v programu.');await api('/api/select',{...selected,maxPrice:Number($('price').value),presale:$('presale').value,allowSeparate:true,searchSeconds:Number($('search-seconds').value),allowRiskySwap:$('risky-swap').checked});$('error').textContent='';await refreshState();}catch(e){error(e);}};
for(const action of ['arm','preview','run','stop'])$(action).onclick=async()=>{try{await api(`/api/${action}`,{});$('error').textContent='';await refreshState();}catch(e){error(e);}};
await refreshState();$('month').value=state?.selection?`${state.selection.year}-${String(state.selection.month).padStart(2,'0')}`:localMonth();$('presale').value=state?.selection?.presale||state?.nextPresale||'';
if(state?.selection){selected=state.selection;$('chosen').textContent=`${selected.title} · ${selected.date} · ${selected.time}`;$('price').value=selected.maxPrice;$('search-seconds').value=selected.searchSeconds??15;$('risky-swap').checked=selected.allowRiskySwap===true;}
await loadProgram();setInterval(refreshState,2000);
