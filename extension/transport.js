import {mapSnapshot} from './shared/map-snapshot.js';
import {ticketUrl} from './shared/ticket-url.js';
export function seatPoint(map,seat) {
  const x=map.rect.x+(seat.x-map.px)/map.zoom,y=map.rect.y+(seat.y-map.py)/map.zoom;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<map.rect.x||x>map.rect.x+map.rect.width||y<map.rect.y||y>map.rect.y+map.rect.height)throw Error('Místo je mimo viditelnou mapu. Vyber ho ručně.');
  return {x,y};
}
export class ChromeTransport {
  constructor(tabId,url,maxPrice,signal){Object.assign(this,{tabId,url:ticketUrl(url),maxPrice,signal});}
  wait(ms){return new Promise(r=>setTimeout(r,ms));}
  async snapshot(){
    const tab=await chrome.tabs.get(this.tabId);
    if(ticketUrl(tab.url)!==this.url)throw Error('Nákupní stránka se změnila. Zkontroluj košík ručně.');
    const results=await chrome.scripting.executeScript({target:{tabId:this.tabId},world:'MAIN',func:mapSnapshot});
    const map=results[0]?.result;
    const expected=Number(new URL(this.url).pathname.split('/').at(-1));
    if(map&&Number(map.performance)!==expected)throw Error('Mapa patří jinému představení.');
    return map;
  }
  async mouse(point){
    if(this.signal.aborted)throw Error('Příprava byla zastavena.');
    const target={tabId:this.tabId};
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  async change(seat,release=false){
    if(this.signal.aborted)return 'unknown';
    const map=await this.snapshot(),s=map?.seats.find(s=>s.id===seat.id);
    if(!map||!s)return 'unknown';
    if(release?!map.basket.some(b=>b.id===s.id):!s.available||s.price<=0||!Number.isFinite(s.price)||s.price>this.maxPrice)return release?'unknown':'lost';
    if(!release&&map.basket.length>=2)throw Error('Košík už obsahuje dva lístky.');
    await this.mouse(seatPoint(map,s));
    const end=Date.now()+10000;
    do{
      await this.wait(200);const after=await this.snapshot();
      if(after&&(release?!after.basket.some(b=>b.id===s.id):after.basket.some(b=>b.id===s.id)))return release?'released':'held';
    }while(Date.now()<end&&!this.signal.aborted);
    return 'unknown';
  }
  click(seat){return this.change(seat);}
  release(seat){return this.change(seat,true);}
}
