import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:https';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const profile=await mkdtemp(join(tmpdir(),'ddbot-extension-test-'));
const extension=new URL('../dist/ddbot-chrome/',import.meta.url).pathname;
let context,server;
const errors=[];

try{
 let requests=0,mode='normal';
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},(req,res)=>{
  res.writeHead(200,{'content-type':'text/html'});
  if(req.headers.host.startsWith('www.dejvickedivadlo.cz')){res.end('<div class="program-misto" data-misto="DD"><table><tr><td></td><td>20</td><td>19:00</td><td><a class="nazev">Test představení</a><a href="https://www.ticketportal.cz/performance/123">Lístky</a></td></tr></table></div>');return;}
  requests++;
  res.end(`<!doctype html><canvas id="canvas" width="600" height="400"></canvas><script>
window.g_performance={ID:123};window.m_all=[[1,'1','8',5,100,100,0,1],[2,'2','8',5,140,100,0,1],[3,'3','8',5,180,100,0,1]];window.m={1:[1,0],2:[2,0],3:[3,0]};window.k_all={5:['green','Category',640]};window.zoom=1;window.poz_x=0;window.poz_y=0;window.zobrazene_miesta=true;window.Basket={123:${mode==='existing'?"[{ID_Miesto_Javisko:99,id_predstavenie:123,Cena:640}]":'[]'}};window.clicks=[];
document.querySelector('#canvas').addEventListener('click',e=>{window.clicks.push({trusted:e.isTrusted,x:e.clientX,y:e.clientY});const r=e.target.getBoundingClientRect();const s=window.m_all.find(s=>Math.abs(s[4]-(e.clientX-r.x))<5);if(s){window.Basket[123].push({ID_Miesto_Javisko:s[0],id_predstavenie:123,Cena:640});window.m[s[0]][1]=1;}});
</script>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',ignoreHTTPSErrors:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--ignore-certificate-errors',`--host-resolver-rules=MAP www.ticketportal.cz 127.0.0.1:${port}, MAP www.dejvickedivadlo.cz 127.0.0.1:${port}`]});
 let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
 const base=worker.url().replace('background.js','');
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'index.html');await page.locator('#show-select option').nth(1).waitFor({state:'attached'});await page.locator('#month').fill('2099-10');await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 assert.equal(await page.locator('#error').innerText(),'');
 assert.ok(!(await page.locator('body').innerText()).includes('Obvyklý předprodej:'));
 assert.ok(!(await page.locator('body').innerText()).includes('Nejdřív sousední dvojice od středu řady.')); 
 await page.locator('#show-select').selectOption({label:'Test představení'});await page.locator('#date-select').selectOption({index:1});await page.locator('#presale').fill('2099-10-19T20:00');await page.locator('#search-seconds').fill('0');await page.locator('button[type="submit"]').click();
 await page.waitForFunction(()=>!document.getElementById('run').disabled);
 const request=(type,extra={})=>page.evaluate(async({type,extra})=>chrome.runtime.sendMessage({type,...extra}),{type,extra});
 const state=async()=>(await request('state')).data;
 await page.screenshot({path:'/private/tmp/ddbot-extension.png',fullPage:true});
 await page.locator('#preview').click();await waitDone('preview');
 let sale=context.pages().find(p=>p.url().startsWith('https://www.ticketportal.cz/'));
 assert.equal((await sale.evaluate(()=>window.clicks)).length,0);
 console.log('PASS: UI, program parsing, preview without reservations');
 await request('run');await waitDone('handoff');
 sale=context.pages().filter(p=>p.url().startsWith('https://www.ticketportal.cz/')).at(-1);
 const clicks=await sale.evaluate(()=>window.clicks),basket=await sale.evaluate(()=>window.Basket[123]);
 assert.equal(clicks.length,2);assert.ok(clicks.every(c=>c.trusted));assert.equal(basket.length,2);
 console.log('PASS: two confirmed seats using trusted Chrome clicks');
 mode='existing';await request('run');await waitDone('attention');
 sale=context.pages().filter(p=>p.url().startsWith('https://www.ticketportal.cz/')).at(-1);assert.equal((await sale.evaluate(()=>window.clicks)).length,0);
 console.log('PASS: existing basket prevents clicks');
 mode='normal';
 assert.equal((await request('share')).error,undefined);assert.equal((await request('arm')).error,undefined);assert.equal((await state()).armed,true);await request('import-sync');assert.equal((await state()).armed,false);
 assert.equal((await state()).selection.title,'Test představení');
 console.log('PASS: syncing preferences does not activate a device');
 const settings=(await state()).selection;settings.url=null;await request('select',{selection:settings});await request('preview');await waitDone('preview');
 assert.equal((await worker.evaluate(()=>chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']}))).length,0);
 console.log('PASS: offscreen program resolution and cleanup');
 // A past due alarm after the worker sleeps must run once, with persisted state.
 // Real alarm event and sleeping worker are exercised with a near-future Prague minute.
 const when=Date.now()+1500;
 await worker.evaluate(async({when})=>{const s=(await chrome.storage.local.get('state')).state;const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(when)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));s.selection.presale=`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;s.selection.url='https://www.ticketportal.cz/performance/123';s.armed=true;s.status='armed';await chrome.storage.local.set({state:s});await chrome.alarms.create('dd-presale',{when});},{when});
 const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');
 const restarted=context.waitForEvent('serviceworker',{timeout:10000}).catch(()=>null);await cdp.send('ServiceWorker.stopAllWorkers');
 await waitDone('handoff');worker=(await restarted)||context.serviceWorkers().find(w=>w.url()===base+'background.js');assert.equal((await state()).armed,false);
 console.log('PASS: scheduled run wakes a stopped worker and is consumed once');
 const beforeInvalid=(await state()).selection;
 assert.match((await request('select',{selection:{...beforeInvalid,url:'https://evil.example/performance/123'}})).error,/odkaz/);
 assert.deepEqual((await state()).selection,beforeInvalid);
 console.log('PASS: invalid imports preserve the saved selection');
 const interrupted=await state();interrupted.busy=true;interrupted.status='running';
 await worker.evaluate(s=>chrome.storage.local.set({state:s}),interrupted);
 await cdp.send('ServiceWorker.stopAllWorkers');
 const afterRestart=await state();assert.equal(afterRestart.status,'attention');assert.equal(afterRestart.busy,false);
 console.log('PASS: worker restart preserves basket and does not retry reservations');
 await page.goto(base+'simulation.html');await page.locator('#sim-start').click();await page.locator('#sim-stop').click();
 await page.screenshot({path:'/private/tmp/ddbot-simulation.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.ok(requests>=4);
 console.log('PASS: packaged simulation; no page errors');
 await page.goto(base+'index.html');await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/ddbot-extension-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 console.log('PASS: narrow layout fits without horizontal scrolling');
 async function waitDone(expected){for(let i=0;i<120;i++){const s=await state();if(!s.busy&&s.status===expected)return;if(!s.busy&&s.status==='attention'&&expected!=='attention')throw Error(s.message);await page.waitForTimeout(250);}throw Error('Timed out: '+JSON.stringify(await state()));}
}catch(e){for(const p of context?.pages()||[])console.log('FAIL PAGE',p.url(),await p.evaluate(()=>({text:document.body.innerText,model:!!window.m_all,zoom:window.zoom,shown:window.zobrazene_miesta,basket:window.Basket})).catch(()=>null));throw e;}finally{await context?.close();server?.closeAllConnections();await new Promise(r=>server?server.close(r):r());await rm(profile,{recursive:true,force:true});}
