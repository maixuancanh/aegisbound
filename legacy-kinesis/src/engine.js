import {CONFIG as C} from './config.js';
import {makeCovers,holdCover,steerCover,throwPower,releaseCover,advanceCover} from './cover.js';
import {moveEnemy,advanceThreats,spawnEnemy} from './enemies.js';
import {admitEnemies,settleWave} from './director.js';
import {resolveCollisions} from './collision.js';
import {settleTerminal} from './scoring.js';
import {ARENAS} from './content/arenas.js';
import {CHALLENGES} from './content/challenges.js';
import {freeLabConfig,PRACTICE_LESSONS} from './content/scenarios.js';
import {makeTacticalCovers,tacticalCommand,advanceTacticalCover,finishTacticalFlight} from './tactics.js';
import {applyShieldTrait} from './content/tactics.js';
import {createRescue,missionCommand,advanceCivilians,advanceRelay,recordLessonEvents,settleMission} from './rescue.js';
import {runDirector,moveTacticalEnemy,tacticalThreats} from './rescue-director.js';
import {resolveTacticalCollisions} from './tactical-collision.js';
import {stageProfileFor} from './stage-layout.js';

export function createRun(options={}) {
  const mode=options.mode??'arcade',arena=options.arena??0,challenge=options.challenge??0;
  const content=mode==='challenge'?CHALLENGES[challenge]:ARENAS[arena];
  const lesson=mode==='practice'&&Number.isInteger(options.lesson)?PRACTICE_LESSONS[options.lesson]??null:null;
  const freeLab=mode==='practice'&&!lesson?freeLabConfig(options):null;
  const practice=[{id:'practice',delay:0,archetype:options.archetype??'Spitter',angle:options.direction??0,distance:260,speed:12}];
  const stageProfile=['rescue','trial','challenge'].includes(mode)?stageProfileFor({mode,arena}):null;
  const player={...(stageProfile?.player??{x:C.playerX,y:C.playerY})};
  const tactical=mode==='rescue'||mode==='trial'||mode==='practice'||mode==='challenge';
  const state={generation:options.generation??1,mode,arena,challenge,tick:0,status:'running',reason:null,player,tactical,
    simulationSpeed:freeLab?.speed??1,
    durationTicks:options.durationTicks??content?.durationTicks??C.arenaTicks,
    covers:makeCovers(player,options.coverCount??(mode==='challenge'?content.covers:3)),enemies:[],projectiles:[],
    waves:structuredClone(options.waves??(mode==='practice'?[practice]:content.waves)),
    goal:mode==='challenge'?{...content.goal}:null,
    wave:0,spawnCursor:0,waveStartedAt:0,nextEnemy:1,nextProjectile:1,
    hearts:3,maxHearts:3,score:0,streak:0,invulnerableUntil:0,lastBlockAt:-10000,aim:null,
    selectedCoverId:0,lastCounterAt:-10000,
    stats:{captures:0,returns:0,blocks:0,misses:0,damage:0,bestStreak:0,windows:0,interrupts:0,armorBreaks:0,counterHits:0,counterChain:0,bestCounterChain:0}};
  if(tactical){
    state.rescue=createRescue({...options,challengeSpec:content,lessonSpec:lesson,freeLab});state.durationTicks=state.rescue.deadline;
    const coverCount=mode==='practice'?(lesson?.covers??options.coverCount??3):mode==='challenge'?content.covers:(mode==='trial'&&arena===2?2:3);
    state.covers=makeTacticalCovers(coverCount,freeLab?.coverKind??'mixed');
    if(mode==='trial'&&arena===2){
      // This authored rescue starts with two complementary tools: a broad
      // Bubble shelter for the exposed short lane and an armored shelter for
      // the heavy-fire bypass. These are starting tools, not captured mobs.
      applyShieldTrait(state.covers[0],'Drifter');
      applyShieldTrait(state.covers[1],'Warden');
    }
    if(freeLab){
      const multiplier={fragile:.65,standard:1,reinforced:1.5}[freeLab.durability];
      for(const cover of state.covers){cover.maxHp=Math.max(1,Math.round(cover.maxHp*multiplier));cover.hp=cover.maxHp;}
    }
    if(mode==='practice')for(const cover of state.covers)cover.charge=Math.max(0,Math.min(3,Math.trunc(options.startingCharge??0)));
    state.hearts=6;state.maxHearts=6;state.waves=[];state.goal=null;
    if(mode==='practice')state.practiceBaseline=structuredClone({
      covers:state.covers,npcs:state.rescue.npcs,relay:state.rescue.relay,
      nextNpc:state.rescue.nextNpc,nextGroupId:state.rescue.nextGroupId,nextRouteIndex:state.rescue.nextRouteIndex
    });
    if(mode==='practice'&&!lesson&&!freeLab){
      const angle=options.direction??0,enemy=spawnEnemy({archetype:options.archetype??'Spitter',angle,distance:260,speed:0},state.tick,'practice-1');
      Object.assign(enemy,{x:player.x+Math.cos(angle)*260,y:player.y+Math.sin(angle)*260,baseX:player.x+Math.cos(angle)*260,baseY:player.y+Math.sin(angle)*260,
        role:'attacker',hp:enemy.archetype==='Warden'?2:1,maxHp:enemy.archetype==='Warden'?2:1,speed:0,flankSign:1,
        stunnedUntil:0,knockVx:0,knockVy:0,armor:'intact',guard:enemy.archetype==='Warden'?'closed':'open',guardUntil:0});
      state.enemies=[enemy];
    }
  }
  return state;
}
export function analyzeReplayFailure(state){
  const lost=state.rescue?.npcs?.find(npc=>npc.status==='lost');
  if(lost){
    const held=state.covers?.find(cover=>cover.status==='held');
    const message=held
      ?'A civilian was hit while you carried a shelter. Place it on their route before throwing again.'
      :'A civilian was hit without a placed shelter covering their route.';
    return {kind:'civilian',targetId:lost.id,message};
  }
  if(state.reason==='relay')return {kind:'relay',targetId:'relay',message:'The active relay was exposed during the enemy firing window.'};
  if(state.reason==='covers')return {kind:'cover',message:'The final shelter was lost after a throw missed or took too much damage.'};
  return {kind:'player',message:'Kinesis was exposed when the threat resolved. Try placing shelter before lifting another.'};
}
export function replayFromSnapshot(snapshot,generation=1,analysis=analyzeReplayFailure(snapshot)){
  const state=structuredClone(snapshot);
  state.generation=generation;state.mode='practice';state.replay=true;state.replayDiagnostics=true;state.replayAnalysis=structuredClone(analysis);state.status='running';state.reason=null;state.aim=null;
  state.covers=state.covers.map(cover=>cover.status==='held'?{...cover,status:'orbit'}:cover);
  if(state.rescue){
    state.rescue.replay=true;state.rescue.lesson=null;state.rescue.notice='Replay loaded. Inputs reset; try a different shelter decision.';
    state.rescue.noticeUntil=state.tick+240;
  }
  return state;
}
function commandsInto(state,commands,events){
  for(const command of commands){
    if(state.tactical&&(missionCommand(state,command,events)||tacticalCommand(state,command,events)))continue;
    const held=state.covers.find(c=>c.status==='held');
    if(command.type==='hold'&&!held){
      const index=state.covers.findIndex(c=>c.id===command.id&&c.status==='orbit');
      if(index>=0){
        state.covers[index]=holdCover(state.covers[index]);state.covers[index].stolenBy=null;
        state.selectedCoverId=command.id;events.push({type:'select'});
      }
    } else if(command.type==='aim'&&Number.isFinite(command.x)&&Number.isFinite(command.y)){
      state.aim={x:command.x,y:command.y};
    } else if(command.type==='cancel'){
      if(held)held.status='orbit';state.aim=null;
    } else if(command.type==='release'&&held){
      state.covers[state.covers.indexOf(held)]=releaseCover(held,state.player,state.tick,throwPower(state.aim,state.player));
      state.aim=null;events.push({type:'throw',coverId:held.id});
    }
  }
}
export function stepRun(previous,commands=[]) {
  if(previous.status!=='running')return {state:previous,events:[]};
  const state=structuredClone(previous),events=[];
  if(state.tactical&&state.rescue.phase==='choice'){
    for(const command of commands)missionCommand(state,command,events);
    return {state,events};
  }
  if(state.tactical&&state.rescue.phase==='departing'){
    settleMission(state,events);state.tick++;return {state,events};
  }
  commandsInto(state,commands,events);
  if(state.tactical){
    if(['choice','departing'].includes(state.rescue.phase))return {state,events};
    state.covers=state.covers.map(c=>{
      const old=c.status;advanceTacticalCover(c,state.tick);
      if(old==='returning'&&c.status==='orbit'){state.stats.returns++;events.push({type:'return',coverId:c.id});}
      return c;
    });
    runDirector(state,events);
    advanceCivilians(state,events);
    advanceRelay(state,events);
    state.enemies=state.enemies.map(e=>moveTacticalEnemy(e,state));
    tacticalThreats(state,events);
    state.projectiles=state.projectiles.map(p=>({...p,x:p.x+p.vx/60,y:p.y+p.vy/60}));
    resolveTacticalCollisions(state,previous,events);
    for(const c of state.covers)finishTacticalFlight(state,c,events);
    recordLessonEvents(state,events);
    settleMission(state,events);state.tick++;
    return {state,events};
  }
  const expires=[];
  state.covers=state.covers.map(c=>{
    if(c.launch)Object.freeze(c.launch);
    if(c.status==='held'&&state.aim)return steerCover(c,state.aim,state.covers,state.player);
    const next=advanceCover(c,state.tick);
    if(c.status==='flight'&&next.status==='spent'){
      expires.push(c.id);
      // Keep this tick's complete sweep active until collisions have resolved.
      return {...next,status:'flight',x:c.launch.x+c.vx*(state.tick-c.launch.tick)/60,
        y:c.launch.y+c.vy*(state.tick-c.launch.tick)/60};
    }
    if(c.status==='returning'&&next.status==='orbit'){state.stats.returns++;events.push({type:'return',coverId:c.id});}
    return next;
  });
  admitEnemies(state,events);
  state.enemies=state.enemies.map(e=>moveEnemy(e,state.tick));
  advanceThreats(state,events);
  state.projectiles=state.projectiles.map(p=>({...p,x:p.x+p.vx/60,y:p.y+p.vy/60}));
  resolveCollisions(state,previous,events);
  for(const id of expires){
    const cover=state.covers.find(c=>c.id===id);
    if(cover.status==='flight'){
      cover.status='spent';state.stats.misses++;state.streak=0;events.push({type:'miss',coverId:id});
    }
  }
  settleWave(state,events);settleTerminal(state,events);state.tick++;
  return {state,events};
}
export function projectView(state) {
  return structuredClone({...state,readyCovers:state.covers.filter(c=>['orbit','held'].includes(c.status)).length,
    remainingTicks:Math.max(0,state.durationTicks-state.tick),
    nextMultiplier:1+Math.min(4,Math.floor(state.streak/3))});
}
