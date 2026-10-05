import {choosePair} from './seats.js';
export class ReservationError extends Error {
  constructor(message, held=[]) {super(message);this.name='ReservationError';this.held=held;}
}
// An available seat is only an offer. The basket is the authority for ownership.
// Retry explicit losses; stop on an ambiguous response, preserving confirmed seats.
export async function reserveTwo(transport,{allowSeparate=true,maxPrice=640,signal,onProgress=()=>{},maxAttempts=12}={}) {
  const attempted=new Set(),rejected=new Set();
  const initial=await transport.snapshot();
  if(!initial)throw new ReservationError('Mapu sálu nelze přečíst.');
  if(initial.basket.length)throw new ReservationError('V nákupním prohlížeči už je košík. Nejprve ho zkontroluj ručně.',initial.basket);
  const performance=initial.performance;
  let attempts=0;
  while(true) {
    const map=await transport.snapshot();
    const held=map?.basket||[];
    if(signal?.aborted)throw new ReservationError('Výběr byl zastaven. Zkontroluj košík v prohlížeči.',held);
    if(!map || map.performance!==performance)throw new ReservationError('Mapa představení se změnila. Zkontroluj košík ručně.',held);
    if(held.length>2 || held.some(b=>!attempted.has(b.id) || b.performance!==performance || !Number.isFinite(b.price) || b.price<=0 || b.price>maxPrice))throw new ReservationError('Košík neobsahuje očekávané dva lístky v cenovém stropu. Zkontroluj ho ručně.',held);
    const own=new Set(held.map(b=>b.id));
    const seats=map.seats.map(s=>({...s,available:own.has(s.id)||(held.length<2 && s.available&&!rejected.has(s.id))}));
    if(held.some(b=>!seats.some(s=>s.id===b.id)))throw new ReservationError('Držené místo chybí v mapě. Zkontroluj košík ručně.',held);
    const pair=choosePair(seats,allowSeparate,maxPrice,held[0]?.id);
    if(held.length===2) {
      if(!pair || !pair.seats.every(s=>own.has(s.id)))throw new ReservationError('Držená dvojice neodpovídá požadovaným místům. Zkontroluj ji ručně.',held);
      return {adjacent:pair.adjacent,seats:pair.seats.map(s=>({id:s.id,row:s.row,number:s.number,price:held.find(b=>b.id===s.id).price})),attempts};
    }
    if(!pair)throw new ReservationError(held.length?'Jedno místo je v košíku, ale vhodné druhé už není dostupné. Dokonči výběr ručně.':allowSeparate?'Dvě volná místa v cenovém stropu se nepodařilo najít.':'Dvě místa vedle sebe v cenovém stropu se nepodařilo najít.',held);
    if(attempts>=maxAttempts)throw new ReservationError('Po několika konfliktech jsem přípravu zastavil. Zkontroluj košík ručně.',held);
    const candidate=pair.seats.find(s=>!own.has(s.id));
    onProgress(`Zkouším řadu ${candidate.row}, místo ${candidate.number}. V košíku je ${held.length} z 2 lístků.`);
    attempted.add(candidate.id);attempts++;
    const result=await transport.click(candidate);
    if(result==='lost') {
      rejected.add(candidate.id);
      onProgress(`Místo ${candidate.row}/${candidate.number} mezitím zabral někdo jiný. Hledám náhradu${held.length?' k již drženému lístku':''}.`);
    } else if(result!=='held') {
      const current=await transport.snapshot();
      // A slow acknowledgement may have arrived after the transport's timeout.
      if(!current?.basket.some(b=>b.id===candidate.id))throw new ReservationError('Rezervace místa nebyla potvrzena. Neopakuji nejasný požadavek; zkontroluj košík ručně.',current?.basket||held);
    }
    // Read a fresh basket even after a claimed success. Never trust the click alone.
    const after=await transport.snapshot();
    if(result==='held' && !after?.basket.some(b=>b.id===candidate.id))throw new ReservationError('Rezervace místa nebyla potvrzena v košíku. Zkontroluj ho ručně.',after?.basket||held);
  }
}
