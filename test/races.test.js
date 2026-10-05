import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveTwo} from '../src/reservation.js';
import {RaceVenue} from '../src/simulation.js';
const make=scenario=>new RaceVenue({scenario,lag:5000,now:()=>0,sleep:async()=>{}});
test('A rejected seat is immediately repainted while the rest of the map can remain stale',async()=>{
 const venue=make('first');const result=await reserveTwo(venue);
 assert.equal(result.seats.length,2);assert.equal(venue.conflicts,1);assert.ok(!result.seats.some(s=>s.id===18));assert.equal(venue.visible.find(s=>s.id===18).available,false);assert.equal(venue.held.length,2);
});
test('A lost second seat preserves the first and fills only its companion',async()=>{
 const venue=make('second');const result=await reserveTwo(venue);
 assert.equal(result.seats.length,2);assert.equal(venue.held[0].id,18);assert.equal(venue.held.length,2);assert.equal(venue.clicks,3);assert.equal(result.adjacent,true);
});
test('Strict adjacency stops with one held ticket rather than silently separating or restarting',async()=>{
 const venue=make('second');venue.take(17,false);venue.visible.find(s=>s.id===17).available=false;
 await assert.rejects(()=>reserveTwo(venue,{allowSeparate:false}),e=>e.held.length===1&&/vhodné druhé/.test(e.message));
 assert.equal(venue.held[0].id,18);assert.equal(venue.clicks,2);
});
test('Three known losses do not cause repeated clicks on the stale rejected seats',async()=>{
 const venue=make('stale');const result=await reserveTwo(venue);
 assert.equal(venue.conflicts,3);assert.equal(result.attempts,5);assert.equal(venue.held.length,2);assert.ok(result.seats.every(s=>s.price<=640));
});
test('Unconfirmed click stops instead of blindly retrying',async()=>{
 const venue=make('timeout');
 await assert.rejects(()=>reserveTwo(venue),/nejasný požadavek/);assert.equal(venue.clicks,1);assert.equal(venue.held.length,0);
});
test('Sellout cannot result in a success or selection above the price cap',async()=>{
 const venue=make('soldout');
 await assert.rejects(()=>reserveTwo(venue),/několika konfliktech|nepodařilo najít/);assert.equal(venue.held.length,0);assert.ok(venue.clicks<=12);
});
test('Cancellation after the first acknowledgement preserves one ticket and does not send a second click',async()=>{
 const c=new AbortController(),venue=make('first');venue.scenario='none';venue.onEvent=message=>{if(message.includes('Server potvrdil'))c.abort();};
 await assert.rejects(()=>reserveTwo(venue,{signal:c.signal}),/zastaven/);assert.equal(venue.clicks,1);assert.equal(venue.held.length,1);
});
test('A success claimed without a basket confirmation is never counted as a ticket',async()=>{
 const venue=make('first');venue.click=async()=> 'held';
 await assert.rejects(()=>reserveTwo(venue),/nebyla potvrzena v košíku/);
});
test('Out-of-band or unexpected third tickets stop the algorithm',async()=>{
 const venue=make('first');venue.click=async seat=>{venue.held.push(venue.seats.find(s=>s.id===seat.id),venue.seats[0],venue.seats[1]);return 'held';};
 await assert.rejects(()=>reserveTwo(venue),/Košík/);assert.equal(venue.held.length,3);
});
test('An already confirmed basket acknowledges a delayed click safely',async()=>{
 const venue=make('first');venue.scenario='none';const click=venue.click.bind(venue);venue.click=async seat=>{await click(seat);return 'unknown';};
 const result=await reserveTwo(venue);assert.equal(result.seats.length,2);assert.equal(venue.clicks,2);
});
