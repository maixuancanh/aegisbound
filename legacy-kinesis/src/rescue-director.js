import {spawnEnemy} from './enemies.js';
import {random,activeCivilian,rescuePressure,RESCUE_RESOURCES,COUNTER_FORMATIONS} from './content/rescue.js';
import {addCivilianGroup,nextCivilianGroupDelay,notice} from './rescue.js';
import {isShield} from './tactics.js';
import {stageProfileFor} from './stage-layout.js';

const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const TAXI_CLEAR_RADIUS=150;
const PLAYER_THROW_STANDOFF=120;
const SHELTER_CONTACT_GAP=12;
const MELEE_ARCHETYPES=new Set(['Drifter','Looper']);
const MELEE_COOLDOWN={Drifter:72,Looper:60};
const PRACTICE_RESET_TICKS=42;
function taxiSafePoint(state,point){
  const taxi=state.rescue?.van;
  if(!taxi?.visible)return point;
  const dx=point.x-taxi.x,dy=point.y-taxi.y,distance=Math.hypot(dx,dy);
  if(distance>=TAXI_CLEAR_RADIUS)return point;
  const length=distance||1;
  return {x:taxi.x+dx/length*TAXI_CLEAR_RADIUS,y:taxi.y+dy/length*TAXI_CLEAR_RADIUS};
}
export function targetFor(state,enemy){
  const r=state.rescue;
  const civilians=r.npcs.filter(activeCivilian).sort((a,b)=>
    Number(a.protectedBy!=null)-Number(b.protectedBy!=null)||a.hp-b.hp||d(a,enemy)-d(b,enemy));
  const covers=state.covers.filter(isShield);
  // Civilians are always the primary firing target during an evacuation.
  // Role-specific cover behavior only begins once no civilian is still outside.
  if(civilians.length)return civilians[0];
  if(enemy.role==='raider'){
    const cover=covers.find(c=>c.id===enemy.stealCoverId);
    if(cover)return cover;
  }
  if(enemy.role==='breaker'||r.kind==='counter')return covers.sort((a,b)=>d(a,enemy)-d(b,enemy))[0]??state.player;
  if(r.relay)return r.relay;
  return state.player;
}
export function approachTargetFor(state,enemy){
  const shelter=state.covers.filter(isShield).sort((a,b)=>d(a,enemy)-d(b,enemy))[0];
  const anchor=shelter??state.player;
  const dx=enemy.x-anchor.x,dy=enemy.y-anchor.y,length=Math.hypot(dx,dy)||1;
  const distance=shelter?shelter.radius+(enemy.radius??20)+SHELTER_CONTACT_GAP:PLAYER_THROW_STANDOFF;
  let x=anchor.x+dx/length*distance,y=anchor.y+dy/length*distance;
  const playerDx=x-state.player.x,playerDy=y-state.player.y,playerDistance=Math.hypot(playerDx,playerDy);
  if(playerDistance<PLAYER_THROW_STANDOFF){
    const safeLength=playerDistance||1;
    x=state.player.x+playerDx/safeLength*PLAYER_THROW_STANDOFF;
    y=state.player.y+playerDy/safeLength*PLAYER_THROW_STANDOFF;
  }
  return {x,y,coverId:shelter?.id??null};
}
function spawn(state,role,authored={}){
  const r=state.rescue;
  const archetype=authored.archetype??(role==='raider'?'Looper':role==='breaker'||role==='commander'?'Warden':role==='hunter'?'Spitter':role==='bait'||role==='engineer'?'Drifter':random(r)<.7?'Spitter':'Drifter');
  const profile=stageProfileFor(state);
  const candidates=profile.enemyEntries?.length?profile.enemyEntries:[
    {x:190,y:155},{x:190,y:325},{x:880,y:105},{x:500,y:90}
  ];
  const aimed=Number.isFinite(authored.angle)?{x:state.player.x+Math.cos(authored.angle)*(authored.distance??260),y:state.player.y+Math.sin(authored.angle)*(authored.distance??260)}:null;
  const candidateIndex=Math.floor(random(r)*candidates.length);
  const entryTarget=!authored.point&&!aimed?profile.enemyApproaches?.[candidateIndex]??null:null;
  const point=taxiSafePoint(state,authored.point??aimed??candidates[candidateIndex]);
  const enemy=spawnEnemy({archetype,angle:0,distance:0,speed:0},state.tick,'e-'+state.nextEnemy++);
  Object.assign(enemy,point,{baseX:point.x,baseY:point.y,role,nextShot:state.tick+32,hp:archetype==='Warden'?2:1,
    maxHp:archetype==='Warden'?2:1,speed:authored.speed??(archetype==='Drifter'?56:role==='raider'?48:30),flankSign:random(r)<.5?-1:1,
    nextBodyAt:0,stunnedUntil:0,knockVx:0,knockVy:0,animationPhase:Math.floor(random(r)*120),armor:'intact',guard:archetype==='Warden'?'closed':'open',guardUntil:0,
    entryTarget:entryTarget?taxiSafePoint(state,entryTarget):null});
  if(role==='commander')enemy.order={kind:'volley',fireAt:authored.orderAt??state.tick+54,interruptible:true};
  state.enemies.push(enemy);
  return enemy;
}
function resetPracticeRound(state,drill,events){
  const baseline=state.practiceBaseline,r=state.rescue;
  if(!baseline)return;
  const capturedById=new Map(state.covers
    .filter(cover=>cover.status!=='spent'&&cover.capturedId)
    .map(cover=>[cover.id,cover]));
  state.covers=structuredClone(baseline.covers).map(cover=>{
    const captured=capturedById.get(cover.id);
    if(!captured)return cover;
    return {...cover,
      appearance:captured.appearance,
      capturedArchetype:captured.capturedArchetype,
      capturedId:captured.capturedId,
      capturedVisualKey:captured.capturedVisualKey,
      trait:captured.trait,
      shelterRadius:captured.shelterRadius,
      speed:captured.speed,
      traitHeavyDamage:captured.traitHeavyDamage,
      traitSlowRadius:captured.traitSlowRadius,
      status:'orbit',hp:cover.maxHp
    };
  });
  state.enemies=[];state.projectiles=[];state.aim=null;state.selectedCoverId=0;
  state.hearts=state.maxHearts;
  state.stats={captures:0,returns:0,blocks:0,misses:0,damage:0,bestStreak:0,windows:0,interrupts:0,armorBreaks:0,counterHits:0,counterChain:0,bestCounterChain:0};
  r.npcs=structuredClone(baseline.npcs);r.relay=structuredClone(baseline.relay);
  r.nextNpc=baseline.nextNpc;r.nextGroupId=baseline.nextGroupId;r.nextRouteIndex=baseline.nextRouteIndex;
  r.boarded=0;r.safe=0;r.lost=0;r.kits=RESCUE_RESOURCES.initialKits;r.repairReadyAt=0;
  drill.targetCursor=0;drill.round++;drill.roundResetAt=null;
  if(r.lesson){drill.capturedTraits=[];drill.progress={throws:0,places:0};}
  events.push({type:'practice-round',lessonId:r.lesson?.id??null,round:drill.round});
  notice(state,'PRACTICE ROUND '+drill.round+' · Ready.',events);
}
export function runDirector(state,events){
  const r=state.rescue;
  if(r.kind==='practice'){
    const drill=r.lesson??r.freeLab;
    if(!drill)return;
    if(drill.roundResetAt!==null&&state.tick>=drill.roundResetAt)resetPracticeRound(state,drill,events);
    while(drill.targetCursor<drill.targets.length&&state.tick>=drill.targets[drill.targetCursor].at){
      const authored=drill.targets[drill.targetCursor++];
      spawn(state,authored.role,authored);
      events.push({type:r.lesson?'lesson-spawn':'lab-spawn',lessonId:r.lesson?.id??null,archetype:authored.archetype});
    }
    if(r.freeLab&&drill.roundResetAt===null&&drill.targetCursor>=drill.targets.length&&state.enemies.length===0&&state.projectiles.length===0){
      drill.roundResetAt=state.tick+PRACTICE_RESET_TICKS;
      notice(state,'ROUND CLEAR · Resetting the selected formation.',events);
    }
    if(r.freeLab?.autoResources){
      for(const cover of state.covers)if(cover.status==='spent')Object.assign(cover,{...cover.home,status:'orbit',hp:cover.maxHp,charge:0,heavy:false,stolenBy:null});
      r.kits=RESCUE_RESOURCES.maxKits;r.repairReadyAt=0;
    }
    advanceCommanderOrders(state,events);
    return;
  }
  if(r.phase==='departing'||r.phase==='choice')return;
  if(r.kind==='challenge'){
    const schedule=r.challenge.schedule;
    while(r.challenge.spawnCursor<schedule.length&&state.tick>=schedule[r.challenge.spawnCursor].at){
      const authored=schedule[r.challenge.spawnCursor++];
      spawn(state,authored.role,authored);
      events.push({type:'challenge-spawn',challengeId:r.challenge.id,role:authored.role,archetype:authored.archetype});
    }
    advanceCommanderOrders(state,events);
    return;
  }
  const pressure=rescuePressure(state);
  const activeGroups=new Set(r.npcs.filter(npc=>!['lost','boarded'].includes(npc.status)).map(npc=>npc.groupId)).size;
  if(r.kind==='rescue'&&!r.optional&&r.groups<r.maxGroups&&activeGroups<2&&state.tick>=r.nextGroupAt){
    addCivilianGroup(r,state.tick);r.groups++;r.nextGroupAt=state.tick+nextCivilianGroupDelay(r);
  }else if(r.kind==='rescue'&&activeGroups>=2&&state.tick>=r.nextGroupAt){
    r.nextGroupAt=state.tick+60;
  }
  if(state.tick>=r.nextKitAt){
    r.kits=Math.min(RESCUE_RESOURCES.maxKits,r.kits+1);r.nextKitAt=state.tick+RESCUE_RESOURCES.kitInterval;
  }
  if(r.kind==='counter'&&!r.formationActive){
    const formation=COUNTER_FORMATIONS[r.counterFormation];
    for(const role of formation.roles){
      const enemy=spawn(state,role);
      if(role==='commander')enemy.order={kind:'volley',fireAt:state.tick+54,interruptible:true};
    }
    r.formationActive=true;
    events.push({type:'formation',id:formation.id,index:r.counterFormation});
    notice(state,'FORMATION '+(r.counterFormation+1)+' · '+formation.id.replace('-', ' ').toUpperCase(),events);
  }
  if(r.kind==='rescue'&&state.tick>=r.nextTacticAt&&state.tick>=r.respiteUntil&&state.enemies.length<=pressure.enemyCap-2){
    spawn(state,'bait');spawn(state,'hunter');
    r.nextTacticAt=state.tick+30*60;r.respiteUntil=state.tick+7*60;
    events.push({type:'tactic',kind:'bait-strike'});notice(state,'FEINT · One threat is drawing your shelter. Another is lining up the evacuation route.',events);
  }
  if(r.kind==='rescue'&&r.boarded>=3&&!r.commanderSpawned&&state.tick>=r.nextCommanderAt&&state.enemies.length<pressure.enemyCap){
    const commander=spawn(state,'commander');
    commander.order={kind:'volley',fireAt:state.tick+54,interruptible:true};
    r.commanderSpawned=true;r.nextCommanderAt=Infinity;
    events.push({type:'commander-order',enemyId:commander.id,kind:commander.order.kind});
    notice(state,'COMMANDER · Counter a charged throw to interrupt the coming volley.',events);
  }
  advanceCommanderOrders(state,events);
  if(r.kind==='rescue'&&r.openingThreatsPending&&state.tick>=r.nextSpawnAt&&state.enemies.length<=pressure.enemyCap-2){
    spawn(state,'breaker',{archetype:'Warden'});
    spawn(state,'hunter',{archetype:'Spitter'});
    r.openingThreatsPending=false;
    r.nextSpawnAt=state.tick+pressure.spawnMin+Math.floor(random(r)*(pressure.spawnMax-pressure.spawnMin+1));
    events.push({type:'opening-spawn',archetypes:['Warden','Spitter']});
  }else if(r.kind!=='counter'&&state.tick>=r.nextSpawnAt&&state.tick>=r.respiteUntil&&state.enemies.length<pressure.enemyCap){
    const live=r.npcs.some(activeCivilian);
    const roll=random(r);
    const role=r.kind==='counter'||roll<pressure.breakerChance?'breaker':live&&roll<.85?'hunter':'attacker';
    spawn(state,role);r.nextSpawnAt=state.tick+pressure.spawnMin+Math.floor(random(r)*(pressure.spawnMax-pressure.spawnMin+1));
    events.push({type:'spawn'});
  }
  updateIncident(state,events);
  if(r.incident||state.tick<r.nextIncidentAt||r.phase==='departing')return;
  const broken=state.covers.find(c=>c.status==='spent');
  const stranded=r.npcs.find(n=>activeCivilian(n)&&n.stranded);
  const stealable=state.covers.filter(isShield);
  if(stranded){
    r.incident={kind:'stranded',targetId:stranded.id,label:'STRANDED · Place shelter beside the injured civilian',endsAt:state.tick+20*60};
  }else if(broken||r.kits<=1){
    r.incident={kind:'supplies',startCaptures:state.stats.captures,label:'SUPPLIES · Capture 2 enemies for repair kits',endsAt:state.tick+18*60};
  }else if(stealable.length&&state.enemies.length<5&&r.kind!=='counter'){
    const cover=stealable[Math.floor(random(r)*stealable.length)];
    const raider=spawn(state,'raider');raider.stealCoverId=cover.id;
    r.incident={kind:'theft',enemyId:raider.id,coverId:cover.id,label:'COVER THIEF · Stop the raider or pick up its target',endsAt:state.tick+18*60};
  }else{
    r.incident={kind:'supplies',startCaptures:state.stats.captures,label:'COUNTER WINDOW · Capture 2 enemies for repair kits',endsAt:state.tick+18*60};
  }
  r.nextIncidentAt=state.tick+38*60;
  notice(state,r.incident.label,events);
}
function advanceCommanderOrders(state,events){
  for(const commander of state.enemies.filter(enemy=>enemy.role==='commander'&&enemy.order)){
    if(state.tick<commander.order.fireAt)continue;
    for(const ally of state.enemies)if(ally.id!==commander.id&&['Spitter','Warden'].includes(ally.archetype))ally.nextShot=Math.min(ally.nextShot,state.tick);
    events.push({type:'commander-volley',enemyId:commander.id});
    commander.order={kind:'volley',fireAt:state.tick+18*60,interruptible:true};
  }
}
function updateIncident(state,events){
  const r=state.rescue,i=r.incident;
  if(!i)return;
  let complete=false,failed=false;
  if(i.kind==='stranded'){
    const npc=r.npcs.find(n=>n.id===i.targetId);
    complete=!!npc&&!npc.stranded&&npc.status!=='lost';failed=!npc||npc.status==='lost';
  }else if(i.kind==='supplies')complete=state.stats.captures-i.startCaptures>=2;
  else{
    const thief=state.enemies.find(e=>e.id===i.enemyId),cover=state.covers.find(c=>c.id===i.coverId);
    complete=!thief||['held','flight','returning'].includes(cover?.status);
    failed=cover?.status==='spent';
    if(complete&&thief){thief.role='hunter';thief.stealCoverId=null;}
  }
  if(!complete&&!failed&&state.tick<i.endsAt)return;
  if(complete){
    r.kits=Math.min(RESCUE_RESOURCES.maxKits,r.kits+1);state.score+=250;
    notice(state,'Rescue opportunity secured. +1 repair kit.',events);
  }else{
    notice(state,'Opportunity passed. Focus on the rescue route.',events);
    const thief=state.enemies.find(e=>e.id===i.enemyId);
    if(thief){thief.role='hunter';thief.stealCoverId=null;}
  }
  for(const c of state.covers)if(c.stolenBy===i.enemyId)c.stolenBy=null;
  r.lastIncident=i.kind;r.incident=null;r.nextIncidentAt=Math.max(r.nextIncidentAt,state.tick+12*60);
}
export function moveTacticalEnemy(enemy,state){
  const e={...enemy};
  if(state.tick<e.stunnedUntil){
    e.x+=e.knockVx/60;e.y+=e.knockVy/60;e.knockVx*=.9;e.knockVy*=.9;
    e.x=Math.max(170,Math.min(850,e.x));e.y=Math.max(85,Math.min(490,e.y));return e;
  }
  // A committed shot has a stable origin and direction; it cannot track a dodge.
  if(e.telegraph)return e;
  if(e.entryTarget){
    const entryDistance=d(e,e.entryTarget);
    if(entryDistance>12){
      // Entrance travel is a short readable arrival beat, not the creature's
      // in-combat strafe speed. It keeps new threats visible without leaving
      // the opening lane empty for several seconds.
      const step=Math.min(entryDistance,Math.max(100,e.speed*3)/60);
      e.x+=(e.entryTarget.x-e.x)/entryDistance*step;e.y+=(e.entryTarget.y-e.y)/entryDistance*step;
      return e;
    }
    e.entryTarget=null;
  }
  const target=approachTargetFor(state,e);
  if(e.role==='raider'){
    const cover=state.covers.find(c=>c.id===e.stealCoverId&&isShield(c));
    if(cover&&d(e,cover)<50){
      cover.stolenBy=e.id;
      const dx=e.x<480?-1:1;e.x+=dx*.45;cover.x+=dx*.45;cover.home={x:cover.x,y:cover.y};
      if(cover.x<210||cover.x>800){cover.status='spent';cover.hp=0;cover.stolenBy=null;}
      return e;
    }
  }
  const length=d(e,target);
  if(length>0){
    const step=Math.min(length,e.speed/60);
    e.x+=(target.x-e.x)/length*step;e.y+=(target.y-e.y)/length*step;
  }
  const taxi=state.rescue?.van;
  if(taxi?.visible){
    const dx=e.x-taxi.x,dy=e.y-taxi.y,dist=Math.hypot(dx,dy);
    if(dist<TAXI_CLEAR_RADIUS){
      const safe=taxiSafePoint(state,{x:e.x,y:e.y});e.x=safe.x;e.y=safe.y;
    }
  }
  return e;
}
function attackNearbyShelter(state,enemy,events){
  if(!MELEE_ARCHETYPES.has(enemy.archetype)||state.tick<(enemy.nextMeleeAt??0))return;
  const cover=state.covers.filter(isShield).sort((a,b)=>d(a,enemy)-d(b,enemy))[0];
  const contactDistance=(cover?.radius??0)+(enemy.radius??20)+SHELTER_CONTACT_GAP+2;
  if(!cover||d(enemy,cover)>contactDistance)return;
  enemy.nextMeleeAt=state.tick+MELEE_COOLDOWN[enemy.archetype];
  enemy.hitAt=state.tick;enemy.hitUntil=state.tick+18;
  cover.hp=Math.max(0,cover.hp-1);
  events.push({type:'melee-hit',enemyId:enemy.id,coverId:cover.id,x:cover.x,y:cover.y,hp:cover.hp,maxHp:cover.maxHp});
  events.push({type:'cover-hit',coverId:cover.id,x:cover.x,y:cover.y,hp:cover.hp,maxHp:cover.maxHp,heavy:false,source:'melee'});
  if(!cover.hp){
    cover.status='spent';cover.charge=0;cover.heavy=false;cover.stolenBy=null;
    events.push({type:'cover-broken',coverId:cover.id,x:cover.x,y:cover.y});
  }
}
export function tacticalThreats(state,events){
  if(state.rescue?.kind==='practice'&&!state.rescue.lesson?.liveThreats&&!state.rescue.freeLab?.liveDamage)return;
  const pressure=rescuePressure(state);
  for(const e of state.enemies){
    if(e.guard==='open'&&state.tick>=e.guardUntil)e.guard='closed';
    if(state.tick<e.stunnedUntil){e.telegraph=null;continue;}
    if(e.telegraph&&state.tick>=e.telegraph.fireAt){
      const {direction,origin,speed}=e.telegraph;
      const shotSpeed=speed??(e.archetype==='Warden'?pressure.heavySpeed:pressure.speed);
      state.projectiles.push({id:'p-'+state.nextProjectile++,x:origin.x,y:origin.y,vx:direction.x*shotSpeed,vy:direction.y*shotSpeed,
        radius:5,owner:e.id,heavy:e.archetype==='Warden'});
      e.telegraph=null;e.nextShot=state.tick+(e.archetype==='Warden'?pressure.heavyCooldown:pressure.cooldown);events.push({type:'enemy-shot',enemyId:e.id});
    }
    attackNearbyShelter(state,e,events);
  }
  let busy=state.projectiles.length+state.enemies.filter(e=>e.telegraph).length;
  for(const e of state.enemies){
    if(busy>=pressure.shotCap)break;
    if(!['Spitter','Warden'].includes(e.archetype)||e.entryTarget||e.telegraph||state.tick<e.nextShot||state.tick<e.stunnedUntil)continue;
    const target=targetFor(state,e),speed=e.archetype==='Warden'?pressure.heavySpeed:pressure.speed;
    const horizon=Math.min(.6,pressure.warning/60+d(e,target)/speed);
    const vx=(target.vx??0)*horizon,vy=(target.vy??0)*horizon;
    const scale=Math.min(1,30/(Math.hypot(vx,vy)||1));
    const aim={x:target.x+vx*scale,y:target.y+vy*scale},length=d(e,aim)||1;
    e.telegraph={startedAt:state.tick,fireAt:state.tick+pressure.warning,origin:{x:e.x,y:e.y},targetId:target.id??'player',target:aim,speed,
      direction:{x:(aim.x-e.x)/length,y:(aim.y-e.y)/length}};
    if(e.archetype==='Warden'){e.guard='open';e.guardUntil=e.telegraph.fireAt+24;}
    busy++;
  }
}
