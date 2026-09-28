export const TRIALS=Object.freeze([
  {id:'hold-line',name:'Hold the Line',subtitle:'Protect three relay stages',kind:'relay',durationTicks:150*60,goal:1},
  {id:'counter-chain',name:'Counter Chain',subtitle:'Break three authored formations',kind:'counter',durationTicks:120*60,goal:10},
  {id:'last-shelter',name:'Last Shelter',subtitle:'Two covers · rescue 5 civilians',kind:'rescue',durationTicks:150*60,goal:5}
]);
export const COUNTER_FORMATIONS=Object.freeze([
  Object.freeze({id:'guarded-line',need:3,roles:['breaker','hunter']}),
  Object.freeze({id:'feint-crossfire',need:3,roles:['bait','hunter','hunter']}),
  Object.freeze({id:'command-squad',need:4,roles:['commander','breaker','hunter']})
]);
export const ROUTES=Object.freeze([
  [{x:255,y:235},{x:355,y:230},{x:480,y:245},{x:600,y:230},{x:690,y:235}],
  [{x:265,y:420},{x:375,y:380},{x:490,y:350},{x:600,y:315},{x:690,y:235}],
  [{x:250,y:315},{x:360,y:315},{x:480,y:280},{x:590,y:255},{x:690,y:235}]
]);
export const COVER_TYPES=Object.freeze({
  crate:{name:'Bin',maxHp:10,radius:37,shelterRadius:94,speed:580},
  stone:{name:'Barrier',maxHp:14,radius:46,shelterRadius:110,speed:480},
  sign:{name:'Sign',maxHp:7,radius:29,shelterRadius:78,speed:800}
});
export const COVER_HOMES=Object.freeze([{x:360,y:230},{x:475,y:380},{x:605,y:245}]);
// A civilian is not out of danger until boarding has actually finished.
export const activeCivilian=n=>['moving','sheltered','safe','to-vehicle','boarding'].includes(n.status);
export const RESCUE_RESOURCES=Object.freeze({initialKits:2,maxKits:3,kitInterval:40*60,repairCooldown:8*60});
const PRESSURE=Object.freeze([
  {enemyCap:3,shotCap:2,spawnMin:150,spawnMax:180,warning:34,cooldown:90,heavyCooldown:120,speed:420,heavySpeed:360,breakerChance:.18},
  {enemyCap:3,shotCap:2,spawnMin:138,spawnMax:168,warning:33,cooldown:84,heavyCooldown:112,speed:435,heavySpeed:375,breakerChance:.22},
  {enemyCap:4,shotCap:3,spawnMin:126,spawnMax:156,warning:32,cooldown:78,heavyCooldown:104,speed:450,heavySpeed:390,breakerChance:.26},
  {enemyCap:5,shotCap:4,spawnMin:120,spawnMax:144,warning:31,cooldown:72,heavyCooldown:96,speed:465,heavySpeed:405,breakerChance:.30}
].map(Object.freeze));
export function rescuePressure(state){
  const r=state.rescue;
  const extraction=r.optional||r.boarded>=4?3:r.boarded>=3?2:0;
  return PRESSURE[Math.min(3,Math.max(extraction,Math.floor(state.tick/(20*60))))];
}
export function random(rescue){
  rescue.rng=(Math.imul(rescue.rng,1664525)+1013904223)>>>0;
  return rescue.rng/4294967296;
}
