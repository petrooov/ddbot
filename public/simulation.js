import {RaceVenue} from '/shared/simulation.js';
import {reserveTwo} from '/shared/reservation.js';
import {improvePair} from '/shared/upgrade.js';
const $=id=>document.getElementById(id);
let venue,controller,running=false,timers=[],startTime=0;
function log(message,type='info'){const li=document.createElement('li');li.className=type;const time=document.createElement('time');time.textContent=`+${((performance.now()-startTime)/1000).toFixed(1)} s`;li.append(time,document.createTextNode(message));$('timeline').append(li);const panel=$('timeline').parentElement;panel.scrollTop=panel.scrollHeight;}
function draw(target,seats){const held=new Set(venue.held.map(s=>s.id));const fragment=document.createDocumentFragment();for(let i=0;i<seats.length;i++){const s=seats[i];if(i%12===0){const row=document.createElement('span');row.className='seat-row';row.textContent=s.row;fragment.append(row);}const seat=document.createElement('span');seat.className='seat';if(s.price>640)seat.classList.add('over');if(s.status==='other')seat.classList.add('other');if(held.has(s.id))seat.classList.add('mine');if(s.id===venue.pending)seat.classList.add('pending');seat.textContent=s.number;seat.title=`Řada ${s.row}, místo ${s.number}, ${s.price} Kč`;fragment.append(seat);}target.replaceChildren(fragment);}
function render(){if(!venue)return;draw($('seat-map'),venue.visible);draw($('server-map'),venue.seats);$('held-count').textContent=`${venue.held.length}/2`;$('conflict-count').textContent=venue.conflicts;$('rival-count').textContent=venue.taken;}
function reset(){venue=new RaceVenue({scenario:$('scenario').value,latency:Number($('latency').value),lag:Number($('lag').value),onEvent:log,onChange:render});render();}
for(const id of ['latency','lag'])$(id).oninput=()=>{$(`${id}-value`).textContent=`${$(id).value} ms`;};
function controls(disabled){for(const id of ['scenario','latency','lag','sim-risky-swap','sim-start'])$(id).disabled=disabled;$('sim-stop').disabled=!disabled;}
$('sim-start').onclick=async()=>{
 if(running)return;running=true;controls(true);controller=new AbortController();startTime=performance.now();$('timeline').replaceChildren();$('sim-result').textContent='';reset();$('sim-status').textContent='Souboj běží';
 log('Mapa se načetla. Za volné místo nepovažuji kliknutí, ale až potvrzený lístek.');
 timers.push(setInterval(()=>{venue.refresh();render();},100));
 if(venue.scenario==='chaos')timers.push(setInterval(()=>venue.rival(),280));
 try {
  const progress=m=>{$('sim-message').textContent=m;log(m);};
  const acquired=await reserveTwo(venue,{allowSeparate:true,maxPrice:640,signal:controller.signal,onProgress:progress});
  const result=await improvePair(venue,acquired,{maxPrice:640,signal:controller.signal,onProgress:progress,searchMs:15000,allowRiskySwap:$('sim-risky-swap').checked});
  $('sim-status').textContent='Dva lístky potvrzeny';$('sim-message').textContent=`${result.adjacent?'Podařila se dvojice vedle sebe.':'Podařila se dvě oddělená místa.'} Pokusy: ${result.attempts}. Prohrané souboje: ${venue.conflicts}.`;
  $('sim-result').textContent=result.seats.map(s=>`řada ${s.row}, místo ${s.number} (${s.price} Kč)`).join(' · ');if(result.suggestedPair)$('sim-result').textContent+=' · Lepší dvojice: '+result.suggestedPair.map(s=>`${s.row}/${s.number}`).join(' a ')+'. Původní dva lístky držím.';log(result.upgradeStatus==='swapped'?'Výměna dokončena a potvrzena. V košíku je jen finální sousední dvojice.':'Hotovo. Mám přesně dva potvrzené lístky.','success');
 }catch(e){$('sim-status').textContent=controller.signal.aborted?'Simulace zastavena':'Výběr se zastavil';$('sim-message').textContent=e.message;log(e.message,'loss');$('sim-result').textContent=venue.held.length?`V košíku zůstává ${venue.held.length}/2 potvrzených lístků. Zkontroluj zbývající místa.`:'Žádný lístek není potvrzený.';}
 finally{timers.forEach(clearInterval);timers=[];render();running=false;controls(false);}
};
$('sim-stop').onclick=()=>{controller?.abort();$('sim-message').textContent='Čekám na výsledek již odeslaného kliknutí, pak zastavím.';};
reset();
