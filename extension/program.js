import {ticketUrl} from './shared/ticket-url.js';
export function parseProgram(html,month,year) {
  const doc=new DOMParser().parseFromString(html,'text/html'),events=[];
  for(const section of doc.querySelectorAll('.program-misto'))for(const row of section.querySelectorAll('tr')) {
    const cells=row.querySelectorAll(':scope > td'),title=row.querySelector('a.nazev')?.textContent.trim();
    const day=Number(cells[1]?.textContent),time=cells[2]?.textContent.trim(),venue=section.getAttribute('data-misto');
    if(!title||!day||!/^\d{2}:\d{2}$/.test(time))continue;
    let url=null;for(const a of row.querySelectorAll('a[href]'))try{url=ticketUrl(a.getAttribute('href'));}catch{}
    const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,text=cells[3]?.textContent||'';
    events.push({id:`${date}|${time}|${venue}|${title}`,title,date,time,venue,url,status:url?'Odkaz na prodej':/vyprodáno/i.test(text)?'Vyprodáno':/zadáno/i.test(text)?'Zadáno':'Prodej zatím není otevřený'});
  }
  return {events,notices:[...doc.querySelectorAll('.program-misto-popis')].map(e=>e.textContent.trim())};
}
export async function loadProgram(month,year) {
  if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2026||year>2100)throw Error('Neplatný měsíc programu.');
  const response=await fetch(`https://www.dejvickedivadlo.cz/program?m=${month}&r=${year}`,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Program se nepodařilo načíst (${response.status}).`);
  return parseProgram(await response.text(),month,year);
}
