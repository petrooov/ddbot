const zone = 'Europe/Prague';
export function pragueParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
export function localToDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Neplatné datum předprodeje.');
  const utc = new Date(value+'Z');
  if (!Number.isFinite(+utc)) throw Error('Neplatné datum předprodeje.');
  const p = pragueParts(utc);
  const offset = +new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`) - +utc;
  const result = new Date(+utc-offset);
  const r = pragueParts(result);
  if (`${r.year}-${r.month}-${r.day}T${r.hour}:${r.minute}` !== value) throw Error('Tento místní čas neexistuje.');
  return result;
}
export function nextPresale(now = new Date()) {
  const p = pragueParts(now);
  for (let n=0;n<13;n++) {
    const first = new Date(Date.UTC(Number(p.year),Number(p.month)-1+n,1));
    const day = 1+(8-first.getUTCDay())%7+14;
    const local = `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${day}T20:00`;
    if (+localToDate(local)>+now) return local;
  }
}
