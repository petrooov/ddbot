import {localToDate,nextPresale} from './shared/schedule.js';
import {ticketUrl} from './shared/ticket-url.js';
import {choosePair} from './shared/seats.js';
import {reserveTwo} from './shared/reservation.js';
import {improvePair} from './shared/upgrade.js';
import {ChromeTransport} from './transport.js';
const ALARM='dd-presale';
let controller=null,queue=Promise.resolve(),writes=Promise.resolve();
const initial={status:'idle',message:'Vyber představení a ulož nastavení.',selection:null,result:null,armed:false,busy:false};
async function hasOffscreen(){return (await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]})).length>0;}
async function state(){return {...initial,...(await chrome.storage.local.get('state')).state};}
function patch(values){const result=writes.then(async()=>{const s={...await state(),...values};await chrome.storage.local.set({state:s});return s;});writes=result.catch(()=>{});return result;}
export function validateSelection(s){
  if(!s||typeof s.id!=='string'||!s.id||typeof s.title!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!/^\d{2}:\d{2}$/.test(s.time)||!Number.isInteger(s.month)||s.month<1||s.month>12||!Number.isInteger(s.year)||s.year<2026||s.year>2100)throw Error('Neplatný výběr představení.');
  if(!Number.isFinite(s.maxPrice)||s.maxPrice<=0||s.maxPrice>100000)throw Error('Neplatný cenový strop.');
  localToDate(s.presale);localToDate(`${s.date}T${s.time}`);
  if(!Number.isInteger(s.searchSeconds)||s.searchSeconds<0||s.searchSeconds>30)throw Error('Hledání sousední dvojice musí být 0–30 sekund.');
  return {id:s.id,title:s.title.slice(0,300),date:s.date,time:s.time,venue:String(s.venue||'').slice(0,200),url:s.url?ticketUrl(s.url):null,month:s.month,year:s.year,maxPrice:s.maxPrice,presale:s.presale,allowSeparate:true,searchSeconds:s.searchSeconds,allowRiskySwap:s.allowRiskySwap===true};
}
async function stop(){
  controller?.abort();await chrome.alarms.clear(ALARM);await chrome.power.releaseKeepAwake();
  await patch({armed:false,...(!controller?{busy:false,status:'idle',message:'Plánování je vypnuté.'}:{message:'Zastavuji. Zkontroluj případné lístky v košíku.'})});
}
async function execute(s,preview){
  let tabId,attached=false,heartbeat;
  try{
    // Extension API calls keep this operation alive while waiting for a new sale link.
    heartbeat=setInterval(()=>chrome.runtime.getPlatformInfo().catch(()=>{}),20000);
    const signal=controller.signal;
    let url=s.url;
    if(!url){
      await patch({message:'Čekám na zveřejnění prodejního odkazu.'});
      if(!await hasOffscreen())await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['DOM_PARSER'],justification:'Načtení a rozbor programu divadla pro vybraný termín.'});
      const end=Date.now()+(preview?0:60000);
      do{
        const answer=await chrome.runtime.sendMessage({type:'resolve-event',selection:s}).catch(()=>null);
        url=answer?.url;
        if(url||preview||signal.aborted)break;
        await new Promise(r=>setTimeout(r,3000));
      }while(Date.now()<end);
    }
    if(await hasOffscreen())await chrome.offscreen.closeDocument();
    if(!url)throw Error('Odkaz ještě není dostupný. Otevři asistenta, obnov program a spusť přípravu znovu.');
    if(signal.aborted)throw Error('Příprava byla zastavena.');
    const tab=await chrome.tabs.create({url:ticketUrl(url),active:true});tabId=tab.id;
    await patch({tabId,message:'Čekám na mapu sálu. Frontu a ověření vyřeš v otevřené kartě.'});
    const transport=new ChromeTransport(tabId,url,s.maxPrice,signal),deadline=Date.now()+(preview?15000:180000);
    let map;
    do{
      if(signal.aborted)throw Error('Příprava byla zastavena. Zkontroluj košík.');
      try{map=await transport.snapshot();}catch(e){const tab=await chrome.tabs.get(tabId);if(tab.status==='complete'&&tab.url?.startsWith('https://www.ticketportal.cz/performance/'))throw e;}
      if(map)break;await transport.wait(500);
    }while(Date.now()<deadline);
    if(!map)throw Error('Mapa se nenačetla. Pokračuj ručně v nákupní kartě.');
    let result;
    if(preview){const pair=choosePair(map.seats,true,s.maxPrice);result={available:map.seats.filter(s=>s.available).length,pair};}
    else{
      await chrome.debugger.attach({tabId},'1.3');attached=true;
      let progressWrite=Promise.resolve();
      const onProgress=message=>{progressWrite=progressWrite.then(()=>patch({message}));};
      try{const acquired=await reserveTwo(transport,{maxPrice:s.maxPrice,signal,onProgress});result=await improvePair(transport,acquired,{maxPrice:s.maxPrice,signal,onProgress,searchMs:s.searchSeconds*1000,allowRiskySwap:s.allowRiskySwap});}
      finally{await progressWrite;}
    }
    await patch({result,status:preview?'preview':'handoff',message:preview?'Dostupnost ověřena bez rezervace.':'Dva lístky jsou v košíku. V nákupní kartě pokračuj ke svým údajům a platbě.'});
  }catch(e){await patch({status:'attention',message:e.message});}
  finally{clearInterval(heartbeat);if(await hasOffscreen())await chrome.offscreen.closeDocument().catch(()=>{});if(attached)await chrome.debugger.detach({tabId}).catch(()=>{});controller=null;await chrome.power.releaseKeepAwake();await patch({busy:false});}
}
async function start(preview=false){
  const current=await state();if(controller||current.busy)throw Error('Příprava už běží.');
  const s=validateSelection(current.selection);controller=new AbortController();
  await chrome.alarms.clear(ALARM);chrome.power.requestKeepAwake('system');
  await patch({busy:true,armed:false,status:'running',result:null,message:'Připravuji nákupní kartu.'});
  void execute(s,preview);
}
async function handle(message){
  if(message.type==='state')return {...await state(),nextPresale:nextPresale()};
  if(message.type==='stop'){await stop();return {ok:true};}
  const s=await state();
  if(s.busy||controller)throw Error('Nejdřív zastav nebo dokonči přípravu.');
  if(message.type==='select'){
    const selection=validateSelection(message.selection);await stop();
    await patch({selection,result:null,status:'idle',message:'Výběr uložen na tomto zařízení.'});
    return {ok:true};
  }
  if(message.type==='clear'){await stop();await patch({selection:null,result:null});return {ok:true};}
  if(message.type==='share'){if(!s.selection)throw Error('Nejdřív ulož výběr.');await chrome.storage.sync.set({selection:s.selection});return {ok:true};}
  if(message.type==='import-sync'){const saved=await chrome.storage.sync.get('selection');if(!saved.selection)throw Error('Ve sdíleném nastavení zatím nic není.');return handle({type:'select',selection:saved.selection});}
  if(message.type==='arm'){
    const selection=validateSelection(s.selection),when=+localToDate(selection.presale);
    if(when<=Date.now()||when>=+localToDate(`${selection.date}T${selection.time}`))throw Error('Předprodej musí být v budoucnu a před představením.');
    await chrome.alarms.create(ALARM,{when});chrome.power.requestKeepAwake('system');
    await patch({armed:true,status:'armed',message:'Čekám na předprodej na tomto zařízení. Nech Chrome běžet.'});return {ok:true};
  }
  if(message.type==='run'||message.type==='preview'){await start(message.type==='preview');return {ok:true};}
  throw Error('Neznámá akce.');
}
function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL(''))||message.type==='resolve-event')return false;
  serial(()=>handle(message)).then(data=>reply({data}),e=>reply({error:e.message}));return true;
});
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)void serial(async()=>{
  const s=await state();if(!s.armed)return;
  if(Date.now()-+localToDate(s.selection.presale)>60000){await stop();await patch({status:'attention',message:'Předprodej byl zmeškán. Spusť přípravu ručně.'});return;}
  await start();
}).catch(e=>patch({status:'attention',message:e.message}));});
async function recover(startup=false){
  const s=await state();
  if(s.busy){await chrome.power.releaseKeepAwake();if(s.tabId)await chrome.debugger.detach({tabId:s.tabId}).catch(()=>{});await patch({busy:false,status:'attention',message:'Předchozí běh byl přerušen. Zkontroluj košík; rezervace se automaticky neopakují.'});}
  if(s.armed){const when=+localToDate(s.selection.presale);if(when<=Date.now()&&(startup||Date.now()-when>60000)){await stop();await patch({status:'attention',message:'Čekání bylo přerušeno. Zapni nový termín nebo spusť přípravu ručně.'});}else if(when>Date.now()){await chrome.alarms.create(ALARM,{when});chrome.power.requestKeepAwake('system');}}
}
chrome.runtime.onStartup.addListener(()=>void serial(()=>recover(true)));
chrome.runtime.onInstalled.addListener(()=>void serial(()=>recover(true)));
// Also recover after unexpected worker termination, before handling a new command.
queue=recover().catch(()=>{});
chrome.debugger.onDetach.addListener(source=>{void state().then(s=>{if(controller&&source.tabId===s.tabId)controller.abort();});});
