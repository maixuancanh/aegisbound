const ticks=seconds=>seconds*60;
const medal=(bronze,silver,gold)=>Object.freeze({bronze,silver,gold});
const threat=(at,archetype,role='attacker',extra={})=>Object.freeze({at:ticks(at),archetype,role,...extra});

// These are authored tactical situations, deliberately not random arcade waves.
// Every goal maps to a visible simulation state so retrying has the same answer.
export const CHALLENGES=Object.freeze([
  Object.freeze({
    id:'borrow-once',name:'Borrow Once',durationTicks:ticks(45),covers:2,
    description:'Build the right borrowed shelters with room to recover each throw.',
    objective:'Capture a Drifter and a Spitter to return with Bubble + Current shelter traits.',
    goal:{kind:'traits',captures:2,traits:['bubble','current']},
    medals:medal('Capture both traits','Clear with 4 hearts','Clear with 6 hearts'),
    schedule:[threat(0,'Drifter'),threat(10,'Spitter')]
  }),
  Object.freeze({
    id:'open-window',name:'Open Window',durationTicks:ticks(40),covers:3,
    description:'Block, then counter while the armor window is open.',
    objective:'Land two captures within a live counter window.',
    goal:{kind:'counter-windows',captures:2,windows:2},
    medals:medal('2 counter windows','2 windows, no broken shelter','2 windows, no damage'),
    schedule:[threat(0,'Spitter','hunter'),threat(12,'Spitter','hunter')]
  }),
  Object.freeze({
    id:'long-throw',name:'Long Throw',durationTicks:ticks(50),covers:3,
    description:'Read distance, angle and the enemy action before it resolves.',
    objective:'Interrupt two marked long-range attacks before they fire.',
    goal:{kind:'interrupts',interrupts:2},
    medals:medal('2 interrupts','2 interrupts, no miss','2 interrupts, no damage'),
    schedule:[threat(0,'Spitter','commander',{orderAt:ticks(8)}),threat(16,'Spitter','commander',{orderAt:ticks(24)})]
  }),
  Object.freeze({
    id:'crossfire',name:'Crossfire',durationTicks:ticks(45),covers:3,
    description:'Move shelter between two routes before the firing lanes cross.',
    objective:'Bring two civilian routes to the gate without a casualty.',
    goal:{kind:'safe-civilians',safe:2,noCivilianHit:true},
    medals:medal('2 civilians safe','2 safe, no broken shelter','2 safe, no civilian hit'),
    civilianGroups:[{at:0,count:1,routeIndex:0},{at:0,count:1,routeIndex:1}],
    schedule:[threat(3,'Spitter','hunter'),threat(15,'Spitter','hunter'),threat(30,'Warden','breaker')]
  }),
  Object.freeze({
    id:'last-cover',name:'Last Cover',durationTicks:ticks(45),covers:1,
    description:'One shelter changes trait after every capture.',
    objective:'Use one shelter to capture three different enemy traits.',
    goal:{kind:'trait-sequence',captures:3,traits:['bubble','current','swift']},
    medals:medal('3 trait captures','3 traits, no miss','3 traits, no damage'),
    schedule:[threat(0,'Drifter'),threat(10,'Spitter'),threat(20,'Looper')]
  }),
  Object.freeze({
    id:'clean-shelter',name:'Clean Shelter',durationTicks:ticks(55),covers:3,
    description:'Escort the group through the courtyard without letting a shot connect.',
    objective:'Escort all three civilians to the gate. Any hit fails the run.',
    goal:{kind:'safe-civilians',safe:3,noCivilianHit:true},
    medals:medal('3 civilians safe','3 safe, no broken shelter','3 safe, no civilian hit'),
    civilianGroups:[{at:0,count:3,routeIndex:2}],
    schedule:[threat(3,'Spitter','hunter'),threat(16,'Spitter','hunter'),threat(30,'Warden','breaker')]
  })
]);

export function challengeGoalReached(state){
  const challenge=state.rescue?.challenge;
  if(!challenge)return false;
  const goal=challenge.goal;
  if(goal.kind==='counter-windows')return state.stats.captures>=goal.captures&&state.stats.windows>=goal.windows;
  if(goal.kind==='interrupts')return state.stats.interrupts>=goal.interrupts;
  if(goal.kind==='safe-civilians')return state.rescue.npcs.filter(npc=>npc.status==='safe').length>=goal.safe&&state.rescue.lost===0;
  const traits=new Set(challenge.capturedTraits);
  return state.stats.captures>=goal.captures&&goal.traits.every(trait=>traits.has(trait));
}
export function challengeMedal(state){
  if(state.status!=='won')return 0;
  const index=state.challenge??0,id=CHALLENGES[index]?.id;
  const stats=state.stats??{},covers=state.covers??[],fullHearts=state.hearts===(state.maxHearts??6);
  const broken=covers.some(cover=>cover.status==='spent');
  if(id==='borrow-once')return fullHearts?3:state.hearts>=4?2:1;
  if(id==='open-window'||id==='crossfire'||id==='clean-shelter')return !broken&&stats.damage===0?3:!broken?2:1;
  if(id==='long-throw'||id==='last-cover')return stats.damage===0?3:stats.misses===0?2:1;
  return 1;
}
