import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fetchProgram,ticketUrl} from './catalog.js';
import {nextPresale,localToDate,pragueParts} from './schedule.js';
import {TicketAssistant} from './ticketportal.js';
const PORT=Number(process.env.PORT||4317), HOST='127.0.0.1';
const token=randomBytes(24).toString('hex');
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
const savedFile=new URL('../data/selection.json',import.meta.url);
let selection=null;
try {selection=JSON.parse(await readFile(savedFile,'utf8'));} catch {}
const state={status:'idle',message:'Vyber představení a naplánuj přípravu dvou lístků.',selection,result:null};
if(selection) state.message='Načten předchozí výběr. Pro tento běh znovu zapni plánování.';
const assistant=new TicketAssistant();
let controller=null, busy=false, armed=false, running=null;
async function save(){await writeFile(savedFile,JSON.stringify(state.selection,null,2));}
function stop(){armed=false;controller?.abort();if(!busy){state.status='idle';state.message='Plánování je vypnuté.';}}
async function run(preview=false) {
  if(busy) throw Error('Nákupní prohlížeč právě pracuje.');
  const s=state.selection;
  if(!s) throw Error('Nejdřív vyber termín.');
  busy=true; armed=false;controller=new AbortController();state.result=null;
  state.status='running';state.message=preview?'Ověřuji dostupnost bez rezervace.':'Připravuji dva lístky.';
  try {
    let url=s.url;
    if(!url){
      const deadline=Date.now()+(preview?0:60000);
      do {
        const program=await fetchProgram(s.month,s.year);
        url=program.events.find(e=>e.id===s.id)?.url;
        if(url || preview || controller.signal.aborted)break;
        state.message='Čekám, až divadlo zveřejní odkaz na vybraný termín.';
        await new Promise(resolve=>setTimeout(resolve,3000));
      } while(Date.now()<deadline);
    }
    if(!url) throw Error('Divadlo zatím nezveřejnilo odkaz na tento termín. Obnov program a vyber ho znovu.');
    if(controller.signal.aborted) throw Error('Příprava byla zastavena.');
    state.result=preview?await assistant.inspect(url,s.maxPrice):await assistant.reserve(url,s.allowSeparate,s.maxPrice,m=>{state.message=m;},controller.signal,{searchMs:(s.searchSeconds??15)*1000,allowRiskySwap:s.allowRiskySwap===true});
    state.status=preview?'preview':'handoff';
    state.message=preview?'Kontrola dokončena. Žádné místo nebylo rezervováno.':'Dva lístky jsou v košíku. V nákupním prohlížeči dokonči údaje a platbu před vypršením rezervace.';
  } catch(e) {state.status='attention';state.message=e.message;}
  finally {busy=false;controller=null;}
}
function startRun(preview){running=run(preview);running.catch(e=>{state.status='attention';state.message=e.message;});}
setInterval(()=>{
  if(!armed || busy || !state.selection) return;
  const target=+localToDate(state.selection.presale);
  const late=Date.now()-target;
  if(late>=0){
    armed=false;
    if(late>60000){state.status='attention';state.message='Termín byl zmeškán, například kvůli uspání počítače. Spusť přípravu ručně.';return;}
    startRun(false);
  }
},250).unref();
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const staticFiles={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'], '/simulation':['simulation.html','text/html'], '/simulation.js':['simulation.js','text/javascript'], '/simulation.css':['simulation.css','text/css'], '/shared/reservation.js':['../src/reservation.js','text/javascript'], '/shared/seats.js':['../src/seats.js','text/javascript'], '/shared/simulation.js':['../src/simulation.js','text/javascript'], '/shared/upgrade.js':['../src/upgrade.js','text/javascript']};
const server=http.createServer(async(req,res)=>{
  try {
    if(req.headers.host!==`${HOST}:${PORT}` && req.headers.host!==`localhost:${PORT}`) return send(res,403,{error:'Neplatná adresa.'});
    const url=new URL(req.url,`http://${HOST}:${PORT}`);
    if(req.method==='GET' && staticFiles[url.pathname]) {
      const [name,type]=staticFiles[url.pathname];res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(await readFile(new URL(`../public/${name}`,import.meta.url)));return;
    }
    if(req.method==='GET' && url.pathname==='/api/state') return send(res,200,{...state,armed,busy,nextPresale:nextPresale(),token});
    if(req.method==='GET' && url.pathname==='/api/program') {
      const month=Number(url.searchParams.get('month')),year=Number(url.searchParams.get('year'));
      if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2026||year>2100) throw Error('Neplatný měsíc.');
      return send(res,200,await fetchProgram(month,year));
    }
    if(req.method!=='POST') return send(res,404,{error:'Nenalezeno.'});
    if(req.headers['x-dd-token']!==token || ![`http://${HOST}:${PORT}`,`http://localhost:${PORT}`].includes(req.headers.origin)) return send(res,403,{error:'Požadavek nebyl ověřen.'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Error('Požadavek je příliš dlouhý.');}
    const body=JSON.parse(raw||'{}');
    if(url.pathname==='/api/select') {
      if(busy)throw Error('Nejdřív dokonči nebo zastav přípravu.');
      stop();
      const {month,year,id,maxPrice,presale}=body;
      if(!Number.isFinite(maxPrice)||maxPrice<=0||maxPrice>100000)throw Error('Zadej cenový strop za jeden lístek.');
      localToDate(presale);
      const program=await fetchProgram(month,year);
      const event=program.events.find(e=>e.id===id);
      if(!event || event.status==='Zadáno')throw Error('Tento termín není k výběru.');
      const now=pragueParts();
      if(event.date<`${now.year}-${now.month}-${now.day}`)throw Error('Tento termín už proběhl.');
      state.selection={...event,month,year,maxPrice,presale,allowSeparate:true,searchSeconds:Number.isInteger(body.searchSeconds)&&body.searchSeconds>=0&&body.searchSeconds<=30?body.searchSeconds:15,allowRiskySwap:body.allowRiskySwap===true};
      state.result=null;state.message='Výběr uložen. Zapni plánování nebo ověř dostupnost.';await save();
    } else if(url.pathname==='/api/clear') {
      if(busy)throw Error('Počkej na dokončení přípravy.');
      stop();state.selection=null;state.result=null;state.message='Vyber představení a naplánuj přípravu dvou lístků.';await save();
    } else if(url.pathname==='/api/arm') {
      if(busy||!state.selection)throw Error('Nejdřív vyber termín.');
      if(+localToDate(state.selection.presale)<=Date.now())throw Error('Čas předprodeje už uplynul. Vyber nový čas.');
      if(+localToDate(state.selection.presale)>=+localToDate(`${state.selection.date}T${state.selection.time}`))throw Error('Předprodej musí nastat před představením. Pro aktuálně dostupné lístky použij přípravu teď.');
      armed=true;state.status='armed';state.message='Čekám na předprodej. Nech aplikaci běžet a počítač vzhůru.';
    } else if(url.pathname==='/api/stop') stop();
    else if(url.pathname==='/api/preview' || url.pathname==='/api/run') {
      if(busy||!state.selection)throw Error('Nejdřív vyber termín, případně počkej na dokončení přípravy.');
      startRun(url.pathname==='/api/preview');
    } else return send(res,404,{error:'Nenalezeno.'});
    send(res,200,{ok:true});
  }catch(e){send(res,400,{error:e.message});}
});
server.listen(PORT,HOST,()=>console.log(`DD bot: http://${HOST}:${PORT}`));
