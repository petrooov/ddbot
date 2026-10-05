import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceVenue} from '../src/simulation.js';
import {reserveTwo} from '../src/reservation.js';
import {improvePair,swapPair} from '../src/upgrade.js';
import {choosePair} from '../src/seats.js';
function clocked(scenario,lag=1000){let time=0;const now=()=>time;const venue=new RaceVenue({scenario,lag,latency:100,now,sleep:async ms=>{time+=ms;}});return {venue,now};}
test('Best eligible adjacent pair is in the middle of the row, not at its edge',()=>{
 const {venue}=clocked('none');const pair=choosePair(venue.seats,true,640);
 assert.deepEqual(pair.seats.map(s=>s.number),['6','7']);assert.ok(pair.seats.every(s=>s.row==='8'));
});
test('An isolated initial pair is secured before searching for the later released neighbor',async()=>{
 const {venue,now}=clocked('upgrade');const acquired=await reserveTwo(venue);
 assert.equal(acquired.adjacent,false);assert.equal(venue.held.length,2);
 const result=await improvePair(venue,acquired,{maxPrice:640,searchMs:5000,allowRiskySwap:true,now});
 assert.equal(result.upgradeStatus,'swapped');assert.deepEqual(result.seats.map(s=>s.id),[18,19]);assert.equal(venue.peakHeld,2);assert.equal(venue.releases,1);assert.ok(!venue.held.some(s=>s.id===30));
});
test('A safer strategy offers the upgrade without releasing either held ticket',async()=>{
 const {venue,now}=clocked('upgrade');const acquired=await reserveTwo(venue);
 const result=await improvePair(venue,acquired,{maxPrice:640,searchMs:5000,allowRiskySwap:false,now});
 assert.equal(result.upgradeStatus,'suggested');assert.equal(venue.releases,0);assert.deepEqual(venue.held.map(s=>s.id).sort((a,b)=>a-b),[18,30]);
});
test('Loss during an approved swap stops with the remaining ticket and never claims completion',async()=>{
 const {venue,now}=clocked('upgradeLost');const acquired=await reserveTwo(venue);
 await assert.rejects(()=>improvePair(venue,acquired,{maxPrice:640,searchMs:5000,allowRiskySwap:true,now}),/nepodařilo potvrdit/);
 assert.equal(venue.held.length,1);assert.equal(venue.held[0].id,18);assert.equal(venue.peakHeld,2);
});
test('Unconfirmed removal stops before sending a new reservation',async()=>{
 const {venue,now}=clocked('releaseFailed');const acquired=await reserveTwo(venue);const clicks=venue.clicks;
 await assert.rejects(()=>improvePair(venue,acquired,{maxPrice:640,searchMs:5000,allowRiskySwap:true,now}),/Uvolnění/);
 assert.equal(venue.clicks,clicks);assert.equal(venue.held.length,2);
});
test('Simulation enforces the two-ticket client limit',async()=>{
 const {venue}=clocked('none');await reserveTwo(venue);const third=venue.seats.find(s=>s.available);
 assert.equal(await venue.click(third),'blocked');assert.equal(venue.held.length,2);
});
test('Search deadline retains the original tickets when no adjacent pair appears',async()=>{
 const {venue,now}=clocked('upgrade');const acquired=await reserveTwo(venue);venue.scenario='none';
 const result=await improvePair(venue,acquired,{maxPrice:640,searchMs:1500,allowRiskySwap:true,now});
 assert.equal(result.upgradeStatus,'not-found');assert.equal(venue.held.length,2);assert.equal(venue.releases,0);
});
test('Map polling completes after its latency and schedules the next poll from completion',async()=>{
 let time=0,resolve;const venue=new RaceVenue({scenario:'none',lag:10000,now:()=>time,sleep:()=>new Promise(r=>{resolve=r;})});
 venue.take(18,false);time=10000;venue.refresh();assert.equal(venue.visible.find(s=>s.id===18).available,true);
 time=10700;resolve();await venue.refreshInFlight;assert.equal(venue.lastSync,10700);assert.equal(venue.visible.find(s=>s.id===18).available,false);
 time=20000;venue.refresh();assert.equal(venue.refreshInFlight,null);
});

test('Replacing both original tickets never exceeds capacity and removes all obsolete holds',async()=>{
 const {venue}=clocked('upgrade');const acquired=await reserveTwo(venue);
 const target=venue.seats.filter(s=>[42,43].includes(s.id));for(const s of target){s.status='free';s.available=true;}venue.refresh(true);
 const final=await swapPair(venue,acquired,{seats:target,adjacent:true},{maxPrice:640,onProgress:()=>{}});
 assert.deepEqual(final.seats.map(s=>s.id),[42,43]);assert.equal(venue.held.length,2);assert.equal(venue.releases,2);assert.equal(venue.peakHeld,2);assert.ok(venue.held.every(s=>[42,43].includes(s.id)));
});
test('Unexpected basket price during the improvement search prevents releases',async()=>{
 const {venue,now}=clocked('upgrade');const acquired=await reserveTwo(venue);venue.held[0].price=840;
 await assert.rejects(()=>improvePair(venue,acquired,{maxPrice:640,searchMs:5000,allowRiskySwap:true,now}),/změnil košík/);assert.equal(venue.releases,0);
});

test('Clicking an already selected seat removes it even when the two-ticket limit is reached',async()=>{
 const {venue}=clocked('none');await reserveTwo(venue);const selected=venue.held[0];
 assert.equal(await venue.click(selected),'released');assert.equal(venue.held.length,1);assert.ok(!venue.held.some(s=>s.id===selected.id));
});
