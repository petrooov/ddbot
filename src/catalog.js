import * as cheerio from 'cheerio';
import {pragueParts} from './schedule.js';
export const PROGRAM = 'https://www.dejvickedivadlo.cz/program';
export {ticketUrl} from './ticket-url.js';
import {ticketUrl} from './ticket-url.js';
export function parseProgram(html, month, year) {
  const $ = cheerio.load(html), events=[];
  $('.program-misto').each((_,section)=> {
    const venue = $(section).attr('data-misto');
    $(section).find('tr').each((_,row)=> {
      const cells = $(row).children('td');
      const title = $(row).find('a.nazev').text().trim();
      const day = Number(cells.eq(1).text());
      const time = cells.eq(2).text().trim();
      if (!title || !day || !/^\d{2}:\d{2}$/.test(time)) return;
      let url=null;
      $(row).find('a[href]').each((_,a)=> { try { url = ticketUrl($(a).attr('href')); } catch {} });
      const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const text = cells.eq(3).text();
      events.push({id:`${date}|${time}|${venue}|${title}`, title, date, time, venue, url, status:url?'Odkaz na prodej':/vyprodáno/i.test(text)?'Vyprodáno':/zadáno/i.test(text)?'Zadáno':'Prodej zatím není otevřený'});
    });
  });
  return {events, notices:$('.program-misto-popis').map((_,e)=>$(e).text().trim()).get()};
}
export async function fetchProgram(month,year) {
  if (!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2026||year>2100) throw Error('Neplatný měsíc programu.');
  const now=pragueParts();
  const source=Number(now.month)===month && Number(now.year)===year ? PROGRAM : `${PROGRAM}?m=${month}&r=${year}`;
  const response=await fetch(source, {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error(`Program se nepodařilo načíst (${response.status}).`);
  const result=parseProgram(await response.text(),month,year);
  return {...result,source,month,year};
}
