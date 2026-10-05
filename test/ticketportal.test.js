import test from 'node:test';
import assert from 'node:assert/strict';
import {TicketAssistant,mapSnapshot} from '../src/ticketportal.js';
function fakeAssistant({existing=false,changedPrice=false,extraSeats=false}={}) {
 const seats=[{id:1,number:'1',row:'8',sector:1,x:20,y:20,price:640,available:true},{id:2,number:'2',row:'8',sector:1,x:40,y:20,price:640,available:true}];
 if(extraSeats)seats.push({id:3,number:'3',row:'8',sector:1,x:60,y:20,price:640,available:true});
 const map={seats,basket:existing?[{id:9,performance:1,price:640}]:[],performance:1,rect:{x:0,y:0,width:100,height:100},zoom:1,px:0,py:0};
 const calls=[];
 const page={evaluate:async()=>structuredClone(map),mouse:{click:async(x,y)=>{calls.push([x,y]);const s=seats.find(s=>s.x===x);s.available=false;map.basket.push({id:s.id,performance:1,price:changedPrice?840:640});}},waitForFunction:async(fn,id)=>{assert.ok(map.basket.some(b=>b.id===id));},locator:()=>({isVisible:async()=>false})};
 const assistant=new TicketAssistant();assistant.open=async()=>page;
 return {assistant,calls,map,page};
}
test('Reserves exactly two seats and hands off without touching payment',async()=>{
 const {assistant,calls}=fakeAssistant();
 const result=await assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,()=>{},new AbortController().signal);
 assert.equal(calls.length,2);assert.equal(result.adjacent,true);assert.equal(result.seats.length,2);
});
test('Existing basket prevents any new reservations',async()=>{
 const {assistant,calls}=fakeAssistant({existing:true});
 await assert.rejects(()=>assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,()=>{},new AbortController().signal),/košík/);
 assert.equal(calls.length,0);
});
test('Changed actual basket price is never reported as a successful handoff',async()=>{
 const {assistant}=fakeAssistant({changedPrice:true});
 await assert.rejects(()=>assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,()=>{},new AbortController().signal),/Košík/);
});
test('Cancelled preparation does not click any seat',async()=>{
 const {assistant,calls}=fakeAssistant();const c=new AbortController();c.abort();
 await assert.rejects(()=>assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,()=>{},c.signal),/zrušeno/);assert.equal(calls.length,0);
});
test('Map adapter normalizes real Ticketportal labels and numeric prices',()=>{
 global.window={g_performance:{ID:1,Resale:{Seats:{}},SpecialSeatsDescription:{}},m_all:[[11,'3 ','8 ',5,20,100,0,1]],m:{11:[11,0]},k_all:{5:['green','Category','640']},zoom:2,poz_x:0,poz_y:0,zobrazene_miesta:true,Basket:{1:[{ID_Miesto_Javisko:11,id_predstavenie:1,Cena:'640'}]}};
 global.document={querySelector:()=>({getBoundingClientRect:()=>({x:0,y:0,width:100,height:100})})};
 try{const map=mapSnapshot();assert.equal(map.seats[0].number,'3');assert.equal(map.seats[0].row,'8');assert.equal(map.seats[0].price,640);assert.equal(map.basket[0].price,640);}finally{delete global.window;delete global.document;}
});

test('Live adapter replaces a seat that disappears between planning and the pre-click check',async()=>{
 const {assistant,calls,map}=fakeAssistant({extraSeats:true});let stolen=false;
 const result=await assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,message=>{if(!stolen&&message.startsWith('Zkouším')){map.seats[0].available=false;stolen=true;}},new AbortController().signal);
 assert.equal(calls.length,2);assert.deepEqual(result.seats.map(s=>s.id),[2,3]);
});
test('Live adapter stops after an unconfirmed click instead of reserving a fresh pair',async()=>{
 const {assistant,calls,map,page}=fakeAssistant({extraSeats:true});page.mouse.click=async(x,y)=>{calls.push([x,y]);map.seats[0].available=false;};page.waitForFunction=async()=>{throw Error('No basket confirmation');};
 await assert.rejects(()=>assistant.reserve('https://www.ticketportal.cz/performance/1',true,640,()=>{},new AbortController().signal),/nejasný požadavek/);assert.equal(calls.length,1);
});
