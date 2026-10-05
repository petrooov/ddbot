export const SCENARIOS={
 first:'Někdo mě předběhne u prvního místa',
 second:'První lístek mám, druhý mi někdo vezme',
 stale:'Zastaralá mapa: první tři pokusy prohraju',
 chaos:'Průběžný nápor ostatních zájemců',
 timeout:'Kliknutí bez potvrzení od serveru',
 soldout:'Všechna levnější místa zmizí během kliknutí',
 upgrade:'Nejdřív dva oddělené lístky, potom se uvolní soused',
 upgradeLost:'Při výměně souseda zabere někdo jiný',
 releaseFailed:'Server nepotvrdí uvolnění původního místa',
};
export class RaceVenue {
  constructor({scenario='second',latency=700,lag=10000,seed=42,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),onEvent=()=>{},onChange=()=>{}}={}) {
    this.scenario=scenario;this.latency=latency;this.lag=lag;this.seed=seed;this.sleep=sleep;this.now=now;this.onEvent=onEvent;this.onChange=onChange;
    this.clicks=0;this.conflicts=0;this.pending=null;this.taken=0;this.held=[];this.lastSync=now();this.refreshInFlight=null;this.refreshStopped=false;this.releases=0;this.peakHeld=0;this.improvementRevealed=false;
    this.seats=Array.from({length:60},(_,i)=>({id:i+1,number:String(i%12+1),row:String([7,8,9,10,11][Math.floor(i/12)]),sector:1,x:(i%12)*20,y:Math.floor(i/12)*20,price:[840,640,640,590,490][Math.floor(i/12)],available:true,status:'free'}));
    if(['upgrade','upgradeLost','releaseFailed'].includes(scenario))for(const s of this.seats)if(s.price<=640&&![18,30].includes(s.id)){s.status='other';s.available=false;}
    this.visible=structuredClone(this.seats);
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  refresh(force=false){
    if(force){this.visible=structuredClone(this.seats);this.lastSync=this.now();this.onChange();return;}
    if(this.refreshInFlight||this.refreshStopped||this.now()-this.lastSync<this.lag)return;
    const serverView=structuredClone(this.seats);
    this.refreshInFlight=this.sleep(this.latency).then(()=>{
      this.visible=serverView;this.lastSync=this.now();this.onEvent('Server vrátil novou mapu. Další obnovu naplánuji za '+this.lag+' ms.','info');this.onChange();
    }).finally(()=>{this.refreshInFlight=null;});
  }
  async wait(ms){
    if(this.held.length===2&&!this.improvementRevealed&&['upgrade','upgradeLost','releaseFailed'].includes(this.scenario)){
      this.improvementRevealed=true;const s=this.seats.find(s=>s.id===19);s.status='free';s.available=true;this.onEvent('Jiný zájemce pustil místo 8/7. Na mapě se objeví až při další obnově.','rival');this.onChange();
    }
    await this.sleep(ms);this.refresh();
  }
  async snapshot(){this.refresh();return {performance:1,seats:structuredClone(this.visible),basket:this.held.map(s=>({id:s.id,performance:1,price:s.price}))};}
  take(id,announce=true){const s=this.seats.find(s=>s.id===id);if(s?.status==='free'){s.available=false;s.status='other';this.taken++;if(announce)this.onEvent(`Jiný zájemce zabral ${s.row}/${s.number}. Mapa se může aktualizovat až za ${this.lag} ms.`,'rival');this.onChange();}}
  rival(){const free=this.seats.filter(s=>s.status==='free'&&s.price<=640);if(free.length)this.take(free[Math.floor(this.random()*free.length)].id);}
  async click(seat){
    if(this.held.some(s=>s.id===seat.id))return this.release(seat);
    if(this.held.length>=2){this.onEvent('Klient odmítl další kliknutí: maximum jsou dva lístky. Zobrazí chybový dialog.','loss');return 'blocked';}
    this.clicks++;this.pending=seat.id;this.onEvent(`Kliknutí na ${seat.row}/${seat.number}. Čekám ${this.latency} ms na server…`,'request');this.onChange();
    await this.sleep(this.latency);
    if(this.scenario==='first'&&this.clicks===1 || this.scenario==='second'&&this.clicks===2 || this.scenario==='stale'&&this.clicks<=3)this.take(seat.id);
    if(this.scenario==='upgradeLost'&&this.releases>0)this.take(seat.id);
    if(this.scenario==='soldout'&&this.clicks===1)for(const s of this.seats)if(s.price<=640)this.take(s.id,false);
    this.pending=null;
    if(this.scenario==='timeout'&&this.clicks===1){this.onEvent('Server nevrátil potvrzení. Z kliknutí nelze poznat, zda mám místo.','loss');this.onChange();return 'unknown';}
    const actual=this.seats.find(s=>s.id===seat.id);
    if(actual.status!=='free') {const shown=this.visible.find(s=>s.id===seat.id);shown.available=false;shown.status='other';this.conflicts++;this.onEvent(`Server zamítl ${seat.row}/${seat.number}. Kliknuté místo se ihned překreslí a zobrazí se chybový dialog (v simulaci automaticky zavřen).`,'loss');this.onChange();return 'lost';}
    actual.status='mine';actual.available=false;this.held.push(actual);this.peakHeld=Math.max(this.peakHeld,this.held.length);
    this.onEvent(`Server potvrdil ${seat.row}/${seat.number}. Mám ${this.held.length}/2 lístků.`,'success');this.onChange();return 'held';
  }
  async release(seat){
    if(!this.held.some(s=>s.id===seat.id))return 'unknown';
    this.onEvent(`Kliknutí na vlastní místo ${seat.row}/${seat.number} odešle jeho odstranění z košíku.`,'request');
    await this.sleep(this.latency);
    if(this.scenario==='releaseFailed'){this.onEvent('Server nepotvrdil odstranění. Původní dva lístky zůstávají v košíku.','loss');return 'unknown';}
    this.releases++;this.held=this.held.filter(s=>s.id!==seat.id);
    const actual=this.seats.find(s=>s.id===seat.id);actual.status='free';actual.available=true;
    const shown=this.visible.find(s=>s.id===seat.id);shown.status='free';shown.available=true;
    this.onEvent(`Server potvrdil uvolnění ${seat.row}/${seat.number}. Mám ${this.held.length}/2 lístků.`,'info');this.onChange();return 'released';
  }

}
