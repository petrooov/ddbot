import {choosePair} from './seats.js';
// Observe while retaining two tickets. Do not release anything without explicit strategy consent.
export async function improvePair(transport,result,{maxPrice=640,signal,onProgress=()=>{},searchMs=15000,allowRiskySwap=false,now=()=>Date.now()}={}) {
  if(result.adjacent || searchMs<=0)return result;
  const end=now()+searchMs;const original=result.seats.map(s=>s.id);
  while(now()<end && !signal?.aborted){
    const map=await transport.snapshot();
    if(!map || map.basket.some(b=>b.performance!==map.performance||!Number.isFinite(b.price)||b.price<=0||b.price>maxPrice) || map.basket.length!==2 || !original.every(id=>map.basket.some(b=>b.id===id)))throw Error('Během hledání lepší dvojice se změnil košík. Zkontroluj ho ručně.');
    const own=new Set(original);
    const seats=map.seats.map(s=>({...s,available:own.has(s.id)||s.available}));
    const pair=choosePair(seats,false,maxPrice);
    if(pair){
      const summary=pair.seats.map(({id,row,number,price})=>({id,row,number,price}));
      if(!allowRiskySwap){onProgress('Našel jsem místa vedle sebe. Původní dva lístky držím; výměna by vyžadovala nejdřív některé uvolnit.');return {...result,suggestedPair:summary,upgradeStatus:'suggested'};}
      return await swapPair(transport,result,pair,{maxPrice,signal,onProgress});
    }
    onProgress('Dva lístky jsou potvrzené. Ještě hledám sousední dvojici; původní zatím držím.');
    if(!transport.wait)break;
    await transport.wait(Math.min(1000,Math.max(0,end-now())));
  }
  return {...result,upgradeStatus:signal?.aborted?'stopped':'not-found'};
}
export async function swapPair(transport,result,pair,{maxPrice,signal,onProgress}) {
  if(!transport.release)throw Error('Výměna není v tomto prohlížeči podporovaná.');
  const target=new Set(pair.seats.map(s=>s.id));
  const originalIds=new Set(result.seats.map(s=>s.id));
  let additions=0;
  for(const seat of pair.seats){
    let map=await transport.snapshot();
    if(!map||map.basket.length>2||map.basket.some(b=>!originalIds.has(b.id)&&!target.has(b.id)||b.performance!==map.performance||!Number.isFinite(b.price)||b.price<=0||b.price>maxPrice))throw Error('Košík se během výměny nečekaně změnil. Dál neklikám.');
    if(map.basket.some(b=>b.id===seat.id))continue;
    if(signal?.aborted)throw Error('Výměna byla zastavena. Zkontroluj zbývající lístky.');
    const current=map.seats.find(s=>s.id===seat.id);
    if(!current?.available || !Number.isFinite(current.price) || current.price>maxPrice)throw Error('Sousední dvojice mezitím zmizela. Zkontroluj košík.');
    if(map.basket.length===2){
      const discard=map.basket.find(b=>originalIds.has(b.id)&&!target.has(b.id));
      if(!discard)throw Error('V košíku není očekávané původní místo k výměně.');
      const old=result.seats.find(s=>s.id===discard.id);
      onProgress(`Uvolňuji původní místo ${old.row}/${old.number}, aby se do limitu vešla sousední dvojice.`);
      const outcome=await transport.release(old);
      map=await transport.snapshot();
      if(outcome!=='released'||!map||map.basket.some(b=>b.id===old.id))throw Error('Uvolnění místa nebylo potvrzené. Dál neklikám; zkontroluj košík ručně.');
    }
    if(signal?.aborted)throw Error('Výměna byla zastavena po uvolnění místa. Zkontroluj zbývající lístky.');
    if(map.basket.length>=2)throw Error('Košík je plný. Výměnu zastavuji.');
    additions++;const outcome=await transport.click(current);const after=await transport.snapshot();
    if(outcome!=='held' || !after.basket.some(b=>b.id===seat.id))throw Error('Nové místo se nepodařilo potvrdit. Původní místo už mohlo být uvolněno; zkontroluj košík.');
  }
  const final=await transport.snapshot();
  if(final.basket.length!==2 || final.basket.some(b=>b.performance!==final.performance||!target.has(b.id)||!Number.isFinite(b.price)||b.price>maxPrice||b.price<=0))throw Error('Výměna neskončila očekávanou dvojicí v cenovém limitu. Zkontroluj košík.');
  return {...result,attempts:result.attempts+additions,adjacent:true,seats:pair.seats.map(s=>({id:s.id,row:s.row,number:s.number,price:final.basket.find(b=>b.id===s.id).price})),upgradeStatus:'swapped'};
}
