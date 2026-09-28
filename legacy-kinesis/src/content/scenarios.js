const at=seconds=>seconds*60;
const target=(seconds,archetype,role='attacker')=>Object.freeze({at:at(seconds),archetype,role});

export const PRACTICE_LESSONS=Object.freeze([
  Object.freeze({
    id:'aim-power',name:'Aim & power',objective:'Pick up a shelter, choose direction and power, then throw.',
    goal:{kind:'throws',count:1},covers:1,targets:[target(0,'Drifter')]
  }),
  Object.freeze({
    id:'place-shield',name:'Place a shelter',objective:'Move a held shelter and park it before releasing a throw.',
    goal:{kind:'places',count:1},covers:1,targets:[target(0,'Drifter')]
  }),
  Object.freeze({
    id:'block-counter',name:'Block & counter',objective:'Park shelter, block a shot, then capture inside the counter window.',
    goal:{kind:'counter',blocks:1,captures:1},covers:1,liveThreats:true,targets:[target(0,'Spitter','hunter')]
  }),
  Object.freeze({
    id:'borrow-traits',name:'Borrow traits',objective:'Capture each target to cycle Bubble, Current and Swift shelter traits.',
    goal:{kind:'traits',traits:['bubble','current','swift']},covers:1,
    targets:[target(0,'Drifter'),target(6,'Spitter'),target(12,'Looper')]
  }),
  Object.freeze({
    id:'armor-feint',name:'Armor & feint',objective:'Use a charged heavy counter to open armor, then interrupt the commander.',
    goal:{kind:'armor-interrupt',armorBreaks:1,interrupts:1},covers:2,liveThreats:true,targets:[target(0,'Warden','commander')]
  }),
  Object.freeze({
    id:'escort-exit',name:'Escort to exit',objective:'Place shelter along the route and guide the civilian safely to the gate.',
    goal:{kind:'safe-civilians',count:1},covers:2,liveThreats:true,civilianGroups:[{at:0,count:1,routeIndex:0}],
    targets:[target(2,'Spitter','hunter')]
  })
]);

const FORMATIONS=Object.freeze({
  single:[target(0,'Spitter','attacker')],
  crossfire:[target(0,'Spitter','hunter'),target(0,'Spitter','hunter')],
  armored:[target(0,'Warden','breaker'),target(5,'Spitter','hunter')]
});
export function freeLabConfig(options={}){
  const formation=Object.hasOwn(FORMATIONS,options.formation)?options.formation:'single';
  const archetype=['Drifter','Spitter','Looper','Warden'].includes(options.archetype)?options.archetype:'Spitter';
  const direction=Number.isFinite(options.direction)?options.direction:0;
  const targets=formation==='single'?[{at:0,archetype,role:'attacker',angle:direction,distance:260}]:structuredClone(FORMATIONS[formation]);
  return {
    formation,targets,coverKind:['crate','stone','sign'].includes(options.coverKind)?options.coverKind:'mixed',
    durability:['fragile','standard','reinforced'].includes(options.durability)?options.durability:'standard',
    civilianCount:Math.max(0,Math.min(3,Math.trunc(options.civilianCount??0))),station:Boolean(options.station),
    liveDamage:Boolean(options.liveDamage),autoResources:Boolean(options.autoResources),
    speed:[1,2,3].includes(Number(options.speed))?Number(options.speed):1
  };
}

export function lessonGoalReached(state){
  const lesson=state.rescue?.lesson;
  if(!lesson)return false;
  const goal=lesson.goal;
  if(goal.kind==='throws')return lesson.progress.throws>=goal.count;
  if(goal.kind==='places')return lesson.progress.places>=goal.count;
  if(goal.kind==='counter')return state.stats.blocks>=goal.blocks&&state.stats.captures>=goal.captures&&state.stats.windows>=goal.captures;
  if(goal.kind==='traits')return goal.traits.every(trait=>lesson.capturedTraits.includes(trait));
  if(goal.kind==='interrupts')return state.stats.interrupts>=goal.count;
  if(goal.kind==='armor-interrupt')return state.stats.armorBreaks>=goal.armorBreaks&&state.stats.interrupts>=goal.interrupts;
  if(goal.kind==='safe-civilians')return state.rescue.npcs.filter(npc=>npc.status==='safe').length>=goal.count;
  return false;
}
