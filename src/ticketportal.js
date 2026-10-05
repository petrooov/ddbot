import { chromium } from 'playwright';
import { choosePair } from './seats.js';
import { ticketUrl } from './catalog.js';
import {reserveTwo} from './reservation.js';
import {improvePair} from './upgrade.js';

// Reads the same seat model used by Ticketportal's public canvas renderer.
// All reservations are made by ordinary mouse clicks, never direct basket requests.
export {mapSnapshot} from './map-snapshot.js';
import {mapSnapshot} from './map-snapshot.js';
export class TicketAssistant {
  context=null; page=null;
  async open(url) {
    if (!this.context) {
      this.context=await chromium.launchPersistentContext(new URL('../data/browser/',import.meta.url).pathname,{headless:false,viewport:{width:1200,height:850}});
      this.context.on('close',()=>{this.context=null;this.page=null;});
    }
    if (!this.page || this.page.isClosed()) this.page=await this.context.newPage();
    await this.page.goto(ticketUrl(url),{waitUntil:'domcontentloaded',timeout:30000});
    return this.page;
  }
  async inspect(url,maxPrice) {
    const page=await this.open(url);
    await page.waitForFunction(()=>document.querySelector('#canvas') && window.m_all && window.zobrazene_miesta,{},{timeout:15000});
    const map=await page.evaluate(mapSnapshot);
    if (!map) throw Error('Mapu sálu nelze bezpečně přečíst. Dokonči výběr v otevřeném prohlížeči.');
    const pair=choosePair(map.seats,true,maxPrice);
    return {available:map.seats.filter(s=>s.available).length,pair:pair?{adjacent:pair.adjacent,seats:pair.seats.map(({row,number,price})=>({row,number,price}))}:null};
  }
  async reserve(url,allowSeparate,maxPrice,onProgress,signal,options={}) {
    const page=await this.open(url);
    onProgress('Čekám na mapu sálu. Pokud se objeví fronta nebo CAPTCHA, pokračuj v nákupním prohlížeči.');
    const deadline=Date.now()+180000;
    let map;
    while(Date.now()<deadline && !signal.aborted) {
      try { map=await page.evaluate(mapSnapshot); } catch { map=null; }
      if (map) break;
      // Ticketportal updates its map itself. Do not reload a queue or bypass it.
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if (signal.aborted) throw Error('Čekání bylo zrušeno.');
    if (!map) throw Error('Mapa sálu se nenačetla. Pokračuj ručně v otevřeném prohlížeči.');
    const transport={
      snapshot:()=>page.evaluate(mapSnapshot),
      click:async seat=>{
        if(signal.aborted)return 'unknown';
        const current=await page.evaluate(mapSnapshot);
        const s=current?.seats.find(s=>s.id===seat.id);
        if(!current || !s) return 'unknown';
        if(!s.available) return 'lost';
        if(!Number.isFinite(s.price) || s.price<=0 || s.price>maxPrice) return 'lost';
        const x=current.rect.x+(s.x-current.px)/current.zoom;
        const y=current.rect.y+(s.y-current.py)/current.zoom;
        if(x<current.rect.x || x>current.rect.x+current.rect.width || y<current.rect.y || y>current.rect.y+current.rect.height)throw Error('Místo je mimo viditelnou mapu. Vyber ho ručně.');
        await page.mouse.click(x,y);
        try {
          await page.waitForFunction(id=>Object.values(window.Basket||{}).flat().some(s=>s.ID_Miesto_Javisko===id),seat.id,{timeout:10000});
          return 'held';
        } catch {return 'unknown';}
      }
    };
    transport.wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    transport.release=async seat=>{
      if(signal.aborted)return 'unknown';
      const current=await transport.snapshot();
      if(!current?.basket.some(b=>b.id===seat.id))return 'unknown';
      const s=current.seats.find(s=>s.id===seat.id);if(!s)return 'unknown';
      const x=current.rect.x+(s.x-current.px)/current.zoom,y=current.rect.y+(s.y-current.py)/current.zoom;
      if(x<current.rect.x||x>current.rect.x+current.rect.width||y<current.rect.y||y>current.rect.y+current.rect.height)return 'unknown';
      await page.mouse.click(x,y);
      try{await page.waitForFunction(id=>!Object.values(window.Basket||{}).flat().some(s=>s.ID_Miesto_Javisko===id),seat.id,{timeout:10000});return 'released';}catch{return 'unknown';}
    };
    const acquired=await reserveTwo(transport,{allowSeparate,maxPrice,onProgress,signal});
    const result=await improvePair(transport,acquired,{maxPrice,signal,onProgress,searchMs:options.searchMs??15000,allowRiskySwap:options.allowRiskySwap===true});
    const button=page.locator('#hladisko-basket-btn');
    if(!signal.aborted && await button.isVisible() && await button.isEnabled()) await button.click();
    // Payment, contact details, terms and purchase confirmation are completed by the user.
    return result;
  }
}
