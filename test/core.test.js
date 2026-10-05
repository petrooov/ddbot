import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {choosePair} from '../src/seats.js';
import {nextPresale,localToDate} from '../src/schedule.js';
import {parseProgram,ticketUrl} from '../src/catalog.js';
const seat=(id,number,x,price=640,available=true,row='8')=>({id,number:String(number),x,y:100,row,sector:1,price,available});
test('Prefers adjacent seats within the price limit',()=>{
 const seats=[seat(1,1,0,840),seat(2,2,20,840),seat(3,3,40),seat(4,4,60),seat(5,5,80,590)];
 const p=choosePair(seats,true,640);assert.equal(p.adjacent,true);assert.equal(p.seats.length,2);assert.ok(p.seats.every(s=>s.price<=640));
});
test('Never silently exceeds the cap or selects unknown prices',()=>{
 assert.equal(choosePair([seat(1,1,0,641),seat(2,2,20,undefined)],true,640),null);
 assert.equal(choosePair([seat(1,1,0,NaN),seat(2,2,20,640)],true,640),null);
});
test('Separates seats only when allowed and excludes unavailable seats',()=>{
 const s=[seat(1,1,0),seat(2,2,20,640,false),seat(3,3,40)];
 assert.equal(choosePair(s,false,640),null);assert.equal(choosePair(s,true,640).adjacent,false);
});
test('Consecutive numbers across a large aisle are not adjacent',()=>{
 const s=[seat(1,1,0,640,false),seat(2,2,20),seat(3,3,100),seat(4,4,120,640,false)];
 assert.equal(choosePair(s,false,640),null);
});
test('Schedule uses Prague timezone across daylight saving changes',()=>{
 assert.equal(nextPresale(new Date('2026-10-05T10:00:00Z')),'2026-10-19T20:00');
 assert.equal(localToDate('2026-10-19T20:00').toISOString(),'2026-10-19T18:00:00.000Z');
 assert.equal(localToDate('2026-11-16T20:00').toISOString(),'2026-11-16T19:00:00.000Z');
 assert.equal(nextPresale(new Date('2026-10-19T18:00:00Z')),'2026-11-16T20:00');
 assert.throws(()=>localToDate('2026-03-29T02:30'));
 assert.throws(()=>localToDate('2026-02-30T20:00'));
});
test('Accepts only specific Ticketportal performance links',()=>{
 assert.equal(ticketUrl('http://www.ticketportal.cz/predstavenie_javisko_view.asp?IDPred=460675&IDPartner=91'),'https://www.ticketportal.cz/performance/460675?idpartner=91');
 for(const u of ['https://evil.example/performance/1','https://ticketportal.cz.evil.example/performance/1','https://x:secret@ticketportal.cz/performance/1','https://ticketportal.cz/event/x']) assert.throws(()=>ticketUrl(u));
});
test('Parses events without sale links and retains their identity when links appear',()=>{
 const row=link=>`<div class="program-misto" data-misto="Galaxie"><table><tr><td>Po</td><td><strong>19</strong></td><td>19:30</td><td><a class="nazev">Nitero</a>${link}</td></tr></table></div>`;
 const a=parseProgram(row(''),12,2026).events[0];
 const b=parseProgram(row('<a href="https://www.ticketportal.cz/performance/123">koupit</a>'),12,2026).events[0];
 assert.equal(a.id,b.id);assert.equal(a.url,null);assert.ok(b.url);
});
