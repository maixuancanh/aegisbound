import {TRIALS,ROUTES,COUNTER_FORMATIONS,random,activeCivilian,RESCUE_RESOURCES} from './content/rescue.js';
import {challengeGoalReached} from './content/challenges.js';
import {lessonGoalReached} from './content/scenarios.js';
import {isShield} from './tactics.js';
import {stageProfileFor} from './stage-layout.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function nextCivilianGroupDelay(rescue){
  return (12+Math.floor(random(rescue)*11))*60;
}
export function addCivilianGroup(rescue,tick,count=2,optional=false,forcedRouteIndex=null){
  const routes=rescue.routes?.length?rescue.routes:ROUTES;
  const groupId=rescue.nextGroupId??1;
  rescue.nextGroupId=groupId+1;
  const routeIndex=forcedRouteIndex===null?(rescue.nextRouteIndex??0)%routes.length:forcedRouteIndex%routes.length;
  if(forcedRouteIndex===null)rescue.nextRouteIndex=routeIndex+1;
  for(let i=0;i<count;i++){
    const path=routes[routeIndex].map(p=>({...p}));
    const specialist=groupId===1?['electrician','mechanic','guide'][i]??null:null;
    const speed=(31+i*2)*(rescue.guideActive?1.2:1);
    // Both selected civilian records contain an authored move sequence. Jin
    // remains catalogued for provenance, but is not used as a walking actor
    // because its source has only a stand frame.
    rescue.npcs.push({id:'civilian-'+rescue.nextNpc++,variant:Math.floor(random(rescue)*2),
      ...path[0],path,routeIndex,groupId,specialist,specialistUsed:false,guided:Boolean(rescue.guideActive),waypoint:1,status:'waiting',spawnAt:tick+i*90,hp:2,maxHp:2,
      protectedBy:null,invulnerableUntil:0,optional,stranded:false,facing:'right',speed,vx:0,vy:0});
  }
}
export function createRescue(options={}){
  const trial=options.mode==='trial'?TRIALS[options.arena??0]:null;
  const practice=options.mode==='practice';
  const challenge=options.mode==='challenge'?options.challengeSpec:null;
  const lesson=practice?options.lessonSpec:null;
  const freeLab=practice?options.freeLab:null;
  const profile=stageProfileFor(options);
  const taxi=profile.taxi;
  const duration=options.durationTicks??trial?.durationTicks??18000;
  const r={rng:(options.seed??1)>>>0,seed:(options.seed??1)>>>0,kind:practice?'practice':challenge?'challenge':trial?.kind??'rescue',
    phase:'escort',npcs:[],nextNpc:1,nextGroupId:1,nextRouteIndex:0,boarded:0,safe:0,lost:0,goal:trial?.goal??5,
    nextGroupAt:0,groups:1,maxGroups:trial?4:8,
    routes:profile.civilianRoutes?.length?profile.civilianRoutes.map(route=>route.map(point=>({...point}))):ROUTES.map(route=>route.map(point=>({...point}))),
    obstacles:[],
    nextSpawnAt:2*60,openingThreatsPending:options.mode==='rescue',nextIncidentAt:22*60,incident:null,lastIncident:null,
    kits:RESCUE_RESOURCES.initialKits,repairReadyAt:0,nextKitAt:RESCUE_RESOURCES.kitInterval,
    deadline:duration,arrivalAt:10*60,optional:false,decisionTaken:false,
    exit:{x:taxi?taxi.dock.x-100:690,y:taxi?.dock.y??235},van:taxi?{x:taxi.in.x,y:taxi.in.y,visible:false,phase:'hidden',facing:'left',
      dock:{...taxi.dock},door:{x:taxi.dock.x+24,y:taxi.dock.y},capacity:5,turnAt:0,departed:false}:null,
    relay:trial?.kind==='relay'?{id:'relay',...(profile.relaySockets?.[0]??{x:480,y:215}),hp:12,maxHp:12,invulnerableUntil:0}:null,
    relayPhase:trial?.kind==='relay'?0:null,relayPhaseDuration:50*60,relayInterruptedUntil:0,
    counterFormation:trial?.kind==='counter'?0:null,counterTarget:trial?.kind==='counter'?COUNTER_FORMATIONS[0].need:null,formationActive:false,
    phaseEndsAt:trial?.kind==='relay'?50*60:null,relaySockets:profile.relaySockets??[],
    nextBoardAt:0,nextTacticAt:18*60,respiteUntil:0,nextCommanderAt:0,commanderSpawned:false,guideActive:false,
    specialistEffects:{electrician:false,mechanic:false,guide:false},lesson:null,freeLab:null,objective:'',notice:'',noticeUntil:0};
  if(challenge){
    r.challenge={id:challenge.id,goal:structuredClone(challenge.goal),medals:structuredClone(challenge.medals),objective:challenge.objective,
      schedule:structuredClone(challenge.schedule),spawnCursor:0,capturedTraits:[],civilianHit:false};
    r.maxGroups=0;r.nextSpawnAt=Infinity;r.nextIncidentAt=Infinity;r.nextKitAt=Infinity;
    for(const group of challenge.civilianGroups??[])addCivilianGroup(r,ticksToRun(group.at),group.count,false,group.routeIndex);
  }
  if(lesson){
    r.lesson={id:lesson.id,name:lesson.name,objective:lesson.objective,goal:structuredClone(lesson.goal),targets:structuredClone(lesson.targets),
      targetCursor:0,round:1,roundResetAt:null,liveThreats:Boolean(lesson.liveThreats),capturedTraits:[],progress:{throws:0,places:0}};
    r.nextSpawnAt=Infinity;r.nextIncidentAt=Infinity;r.nextKitAt=Infinity;
    for(const group of lesson.civilianGroups??[])addCivilianGroup(r,ticksToRun(group.at),group.count,false,group.routeIndex);
  }
  if(freeLab){
    r.freeLab={...structuredClone(freeLab),targetCursor:0,round:1,roundResetAt:null};
    r.nextSpawnAt=Infinity;r.nextIncidentAt=Infinity;r.nextKitAt=Infinity;
    for(let index=0;index<freeLab.civilianCount;index++)addCivilianGroup(r,0,1,false,index);
    if(freeLab.station)r.relay={id:'lab-station',x:620,y:300,hp:12,maxHp:12,invulnerableUntil:0};
  }
  if(r.kind==='rescue'){
    // The opening specialists take the upper side-gate lane; later groups
    // alternate through the lower open road once that shortcut is available.
    addCivilianGroup(r,90,3,false,1);
    r.nextGroupAt=nextCivilianGroupDelay(r);
  }
  if(options.mode==='trial'&&(options.arena??0)===2){r.maxGroups=2;r.nextGroupAt=4*60;}
  return r;
}

const ticksToRun=value=>Math.max(0,Math.trunc(value??0));

export function advanceRelay(state,events){
  const r=state.rescue;
  if(r.kind!=='relay'||r.relayPhase===null||r.relayPhase>=2||state.tick<r.phaseEndsAt)return;
  r.relayPhase++;
  const socket=r.relaySockets[r.relayPhase];
  if(socket)Object.assign(r.relay,socket,{hp:r.relay.maxHp,invulnerableUntil:state.tick+30});
  r.phaseEndsAt+=r.relayPhaseDuration;
  events.push({type:'relay-phase',phase:r.relayPhase,x:r.relay.x,y:r.relay.y});
  notice(state,`Relay moved to position ${r.relayPhase+1}/3.`,events);
}
export function notice(state,text,events=[]){
  state.rescue.notice=text;state.rescue.noticeUntil=state.tick+210;
  events.push({type:'mission',text});
}
export function protectionFor(state,npc){
  return state.covers.filter(isShield).filter(c=>distance(c,npc)<=c.shelterRadius)
    .sort((a,b)=>distance(a,npc)-distance(b,npc))[0]??null;
}
export function hurtCivilian(state,npc,events){
  if(!activeCivilian(npc)||state.tick<npc.invulnerableUntil)return;
  if(state.rescue.challenge?.goal.noCivilianHit)state.rescue.challenge.civilianHit=true;
  npc.hp--;npc.invulnerableUntil=state.tick+36;npc.hurtUntil=state.tick+18;npc.stranded=npc.hp===1;
  events.push({type:'civilian-hit',x:npc.x,y:npc.y,civilianId:npc.id});
  if(npc.hp<=0){
    npc.status='lost';npc.lostAt=state.tick;npc.protectedBy=null;state.rescue.lost++;
    events.push({type:'civilian-lost',x:npc.x,y:npc.y,civilianId:npc.id});
    notice(state,'A civilian was lost. Keep the next route covered.',events);
  }
}
function setResult(state,status,reason,events){
  state.status=status;state.reason=reason;events.push({type:status==='won'?'clear':'fail',reason});
}
export function startDeparture(state,events){
  const r=state.rescue;
  if(r.phase==='departing')return;
  r.phase='departing';r.departAt=state.tick;
  r.van.visible=true;r.van.phase='turning';r.van.turnAt=state.tick;
  for(const n of r.npcs)if(!['lost','boarded'].includes(n.status)){
    n.status='lost';n.protectedBy=null;r.lost++;
  }
  r.safe=0;r.incident=null;state.projectiles=[];
  for(const e of state.enemies)e.telegraph=null;
  notice(state,'Auto Taxi is turning out with its passengers.',events);
}
function syncTaxiDoor(van){
  van.door.x=van.x+(van.facing==='left'?24:-24);
  van.door.y=van.y;
}
function walkCivilian(npc,target,step){
  const dx=target.x-npc.x,dy=target.y-npc.y,d=Math.hypot(dx,dy);
  const travel=d?Math.min(step,d)/d:0;
  npc.vx=dx*travel*60;npc.vy=dy*travel*60;
  if(Math.abs(dx)>.01)npc.facing=dx>0?'right':'left';
  if(d<=step){Object.assign(npc,target);return true;}
  npc.x+=dx/d*step;npc.y+=dy/d*step;return false;
}
function activateSpecialist(state,npc,events){
  const r=state.rescue;
  if(!npc.specialist||npc.specialistUsed)return;
  npc.specialistUsed=true;npc.workUntil=state.tick+24;r.specialistEffects[npc.specialist]=true;
  if(npc.specialist==='electrician'){
    events.push({type:'specialist-electrician',civilianId:npc.id,x:npc.x,y:npc.y});
    notice(state,'Electrician secured the evacuation route.',events);
  }else if(npc.specialist==='mechanic'){
    const cover=state.covers.filter(isShield).filter(item=>item.hp<item.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(cover){cover.hp=Math.min(cover.maxHp,cover.hp+3);events.push({type:'specialist-mechanic',civilianId:npc.id,coverId:cover.id,x:cover.x,y:cover.y});notice(state,'Mechanic restored a damaged shelter.',events);}
  }else if(npc.specialist==='guide'){
    r.guideActive=true;
    for(const other of r.npcs)if(other.id!==npc.id&&!other.guided&&!['lost','boarded'].includes(other.status)){
      other.guided=true;other.speed*=1.2;
    }
    events.push({type:'specialist-guide',civilianId:npc.id,x:npc.x,y:npc.y});notice(state,'Guide marked the faster outer route for the next group.',events);
  }
}
function advanceTaxi(state,events){
  const r=state.rescue,van=r.van;
  if(r.kind!=='rescue')return;
  if(van.phase==='hidden'&&state.tick>=r.arrivalAt){
    van.visible=true;van.phase='approaching';van.x=1035;van.y=235;van.facing='left';syncTaxiDoor(van);
    notice(state,'Auto Taxi inbound. Guide civilians to its door.',events);
  }
  if(van.phase==='approaching'){
    van.x=Math.max(van.dock.x,van.x-2.8);syncTaxiDoor(van);
    if(van.x===van.dock.x){van.phase='docked';r.phase='boarding';notice(state,'Auto Taxi docked. Civilians are heading for the door.',events);}
  }else if(van.phase==='turning'&&state.tick-van.turnAt>=18){
    van.phase='departing';van.facing='right';syncTaxiDoor(van);
  }else if(van.phase==='departing'){
    van.x+=3.2;syncTaxiDoor(van);
    if(van.x>=1035){van.x=1035;van.phase='departed';van.departed=true;}
  }
}
export function missionCommand(state,command,events){
  const r=state.rescue;
  if(command.type==='decide'&&r.phase==='boarding'&&state.mode==='rescue'){
    r.phase='choice';return true;
  }
  if(command.type==='depart'&&['choice','boarding','last-call'].includes(r.phase)&&r.van.visible){
    startDeparture(state,events);return true;
  }
  if(command.type==='stay'&&r.phase==='choice'&&!r.optional){
    r.phase='last-call';r.optional=true;r.decisionTaken=true;
    r.deadline=state.tick+60*60;state.durationTicks=r.deadline;
    addCivilianGroup(r,state.tick+30,2,true);r.nextIncidentAt=state.tick+600;
    const expendable=state.covers.filter(isShield).sort((a,b)=>a.hp-b.hp);
    if(expendable.length>=3){expendable[0].status='spent';expendable[0].hp=0;}
    notice(state,'Final group! 60 seconds. A cover was used to brace the exit.',events);return true;
  }
  return false;
}
export function advanceCivilians(state,events){
  const r=state.rescue;
  advanceTaxi(state,events);
  for(const npc of r.npcs){
    npc.vx=0;npc.vy=0;
    if(npc.workUntil>state.tick)continue;
    if(npc.status==='waiting'&&state.tick>=npc.spawnAt){
      npc.status='moving';notice(state,'Civilians entering. Cover their path to the gate.',events);
    }
    const cover=activeCivilian(npc)?protectionFor(state,npc):null;
    npc.protectedBy=cover?.id??null;
    if(npc.status==='safe')activateSpecialist(state,npc,events);
    if(npc.stranded&&cover){npc.stranded=false;notice(state,'Shelter reached. The injured civilian can move again.',events);}
    if(npc.status==='to-vehicle'){
      const target=r.van.door,step=(npc.speed??34)/60*(npc.stranded&&!cover?0.42:1);
      if(walkCivilian(npc,target,step)){npc.status='boarding';npc.boardAt=state.tick+24;}
      continue;
    }
    if(npc.status==='boarding'){
      if(state.tick>=npc.boardAt){
        npc.status='boarded';r.boarded++;state.score+=500;
        if(r.boarded%2===0)r.kits=Math.min(RESCUE_RESOURCES.maxKits,r.kits+1);
        events.push({type:'boarded',civilianId:npc.id,x:r.van.door.x,y:r.van.door.y});
        if(r.boarded>=r.van.capacity)startDeparture(state,events);
      }
      continue;
    }
    if(!['moving','sheltered'].includes(npc.status))continue;
    const danger=state.enemies.some(e=>distance(e,npc)<125);
    npc.status='moving';
    const target=npc.path[npc.waypoint],d=distance(npc,target);
    const urgency=(npc.stranded&&!cover) ? 0.42 : (danger&&!cover) ? 0.68 : 1;
    const step=npc.speed/60*urgency;
    if(walkCivilian(npc,target,step)){
      npc.waypoint++;
      if(npc.waypoint>=npc.path.length){
        npc.status='safe';npc.protectedBy=null;
        activateSpecialist(state,npc,events);
        notice(state,'Civilian reached the pickup lane. Guide them to the Auto Taxi.',events);
      }
    }
  }
  if(r.van?.phase==='docked'&&state.tick>=r.nextBoardAt&&r.boarded<r.van.capacity){
    const next=r.npcs.find(n=>n.status==='safe');
    if(next){
      next.status='to-vehicle';r.nextBoardAt=state.tick+18;
    }
  }
  r.safe=r.npcs.filter(n=>n.status==='safe').length;
}

export function recordLessonEvents(state,events){
  const lesson=state.rescue.lesson;
  if(!lesson)return;
  for(const event of events){
    if(event.type==='throw')lesson.progress.throws++;
    if(event.type==='place')lesson.progress.places++;
    if(event.type==='capture'){
      const cover=state.covers.find(item=>item.id===event.coverId);
      if(cover?.trait&&!lesson.capturedTraits.includes(cover.trait))lesson.capturedTraits.push(cover.trait);
    }
  }
}
export function settleMission(state,events){
  const r=state.rescue;
  if(r.kind==='practice'){
    if(r.lesson&&lessonGoalReached(state)&&r.lesson.roundResetAt===null){
      r.lesson.roundResetAt=state.tick+60;
      notice(state,'ROUND CLEAR · Preparing the next practice run.',events);
      events.push({type:'lesson-round-clear',lessonId:r.lesson.id,round:r.lesson.round});
    }
    return;
  }
  if(r.kind==='challenge'){
    if(r.challenge.goal.noCivilianHit&&r.challenge.civilianHit){setResult(state,'lost','challenge-civilian-hit',events);return;}
    if(state.hearts<=0){setResult(state,'lost','hearts',events);return;}
    if(challengeGoalReached(state)){setResult(state,'won','challenge-clear',events);return;}
    if(state.tick>=r.deadline)setResult(state,'lost','time',events);
    return;
  }
  if(r.phase==='departing'){
    advanceTaxi(state,events);
    if(r.van.phase==='departed')setResult(state,r.boarded>=r.goal?'won':'lost',r.boarded>=r.goal?'evacuated':'too-few-rescued',events);
    return;
  }
  if(state.hearts<=0){setResult(state,'lost','hearts',events);return;}
  if(r.relay?.hp<=0){setResult(state,'lost','relay',events);return;}
  if(state.mode==='trial'&&r.kind==='rescue'&&r.maxGroups===2&&r.lost>0){setResult(state,'lost','evacuation-impossible',events);return;}
  if(r.kind==='counter'&&state.stats.counterHits>=r.counterTarget){
    if(r.counterFormation>=COUNTER_FORMATIONS.length-1){setResult(state,'won','counter-goal',events);return;}
    r.counterFormation++;r.counterTarget+=COUNTER_FORMATIONS[r.counterFormation].need;r.formationActive=false;
    state.enemies=[];state.projectiles=[];
    notice(state,'Formation broken. Prepare for the next squad.',events);return;
  }
  if(state.mode==='trial'&&r.kind==='rescue'&&r.boarded>=r.goal){startDeparture(state,events);return;}
  if(r.phase==='last-call'){
    const pending=r.npcs.some(n=>n.optional&&!['boarded','lost'].includes(n.status));
    if(!pending||state.tick>=r.deadline)startDeparture(state,events);
    return;
  }
  if(state.tick<r.deadline)return;
  if(state.mode==='trial'){
    if(r.kind==='relay')setResult(state,'won','relay-held',events);
    else if(r.kind==='rescue')startDeparture(state,events);
    else setResult(state,'lost','counter-time',events);
  }else{r.phase='choice';notice(state,'Departure window. Leave now or risk the final rescue.',events);}
}
export function rescueHud(state){
  const r=state.rescue;
  if(!r)return {label:'',objective:'',incident:'',progress:'',detail:''};
  if(r.kind==='practice')return r.lesson?{label:'LESSON · '+r.lesson.name.toUpperCase(),objective:r.lesson.objective,
    progress:r.lesson.goal.kind==='safe-civilians'?'SAFE '+r.npcs.filter(npc=>npc.status==='safe').length+' / '+r.lesson.goal.count:
      r.lesson.goal.kind==='armor-interrupt'?'ARMOR '+state.stats.armorBreaks+' / '+r.lesson.goal.armorBreaks+' · INTERRUPTS '+state.stats.interrupts+' / '+r.lesson.goal.interrupts:
      r.lesson.goal.kind==='interrupts'?'INTERRUPTS '+state.stats.interrupts+' / '+r.lesson.goal.count:
      r.lesson.goal.kind==='counter'?'BLOCK '+state.stats.blocks+' · CAPTURE '+state.stats.captures:
      r.lesson.goal.kind==='traits'?'TRAITS '+r.lesson.capturedTraits.length+' / '+r.lesson.goal.traits.length:
      r.lesson.goal.kind==='places'?'PLACED '+r.lesson.progress.places+' / '+r.lesson.goal.count:
      'THROWS '+r.lesson.progress.throws+' / '+r.lesson.goal.count,
    incident:'',detail:'The lesson uses the same shelter rules as rescue.'}:{label:'PRACTICE',objective:'Move a held shelter, place it to block, then throw it to capture the target.',
    progress:'TACTICAL SANDBOX',incident:'',detail:'No score or records are saved from practice.'};
  if(r.kind==='challenge')return {label:'CHALLENGE',objective:r.challenge.objective,
    progress:r.challenge.goal.kind==='safe-civilians'?'SAFE '+r.npcs.filter(npc=>npc.status==='safe').length+' / '+r.challenge.goal.safe:
      r.challenge.goal.kind==='interrupts'?'INTERRUPTS '+state.stats.interrupts+' / '+r.challenge.goal.interrupts:
      r.challenge.goal.kind==='counter-windows'?'COUNTER WINDOWS '+state.stats.windows+' / '+r.challenge.goal.windows:
      'CAPTURES '+state.stats.captures+' / '+r.challenge.goal.captures,
    incident:'',detail:'Retry keeps this authored situation unchanged.'};
  let objective,progress,label;
  if(r.kind==='relay'){
    label='HOLD THE LINE';objective='Protect the active relay. Reposition cover before lifting your shield.';
    progress='RELAY '+(r.relayPhase+1)+' / 3 · '+r.relay.hp+' / '+r.relay.maxHp;
  }else if(r.kind==='counter'){
    label='COUNTER CHAIN';objective='Break the guarded line, then the feint, then the commander squad.';
    const formation=COUNTER_FORMATIONS[r.counterFormation];
    progress='FORMATION '+(r.counterFormation+1)+' / '+COUNTER_FORMATIONS.length+' · '+formation.id.replace('-', ' ').toUpperCase()+' · COUNTERS '+state.stats.counterHits+' / '+r.counterTarget;
  }else{
    label=r.phase==='last-call'?'FINAL RESCUE':r.van.visible?'EXTRACTION':'RESCUE';
    objective=r.npcs.some(n=>activeCivilian(n)&&n.stranded)?'Place a shield next to the stranded civilian.':
      r.van.phase==='approaching'?'Auto Taxi is entering from the right. Keep its pickup lane clear.':
      r.van.phase==='docked'?'Civilians must walk to the Auto Taxi door to board.':
      r.phase==='departing'?'Auto Taxi is turning out.':
      r.npcs.some(n=>['moving','sheltered'].includes(n.status))?'Escort civilians to the gate. Lifting cover exposes them.':
      'Hold the courtyard. The next group is on its way.';
    progress='BOARDED '+r.boarded+' / '+r.goal+' · GATE '+r.safe+' · LOST '+r.lost;
  }
  return {label,objective,progress,incident:r.incident?.label??'',
    detail:state.tick<r.noticeUntil?r.notice:'KITS '+r.kits+' · BEST CHAIN '+state.stats.bestCounterChain};
}
