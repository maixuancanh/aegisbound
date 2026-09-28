import {circleSweep} from './geometry.js';
import {captured,damage} from './scoring.js';
import {isShield,chargeCover,captureTacticalCover,beginReturn} from './tactics.js';
import {hurtCivilian} from './rescue.js';
import {activeCivilian} from './content/rescue.js';
import {armorHitsToBreak,canCaptureGuardedEnemy} from './content/tactics.js';

export function canCaptureTacticalEnemy(enemy,cover){
  return canCaptureGuardedEnemy(enemy,cover);
}

export function resolveTacticalCollisions(state,previous,events){
  const candidates=[],deadShots=new Set(),deadEnemies=new Set(),stoppedBodies=new Set();
  const prior=(list,entity)=>list.find(e=>e.id===entity.id)??entity;
  const add=(kind,a,b,t,priority=1)=>{if(t!==null)candidates.push({kind,a,b,t,priority});};
  const player={...state.player,id:'player'};
  const civilians=state.rescue.npcs.filter(activeCivilian);
  const victims=[player,...civilians,...(state.rescue.relay?[state.rescue.relay]:[])];
  for(const shot of state.projectiles){
    const old=prior(previous.projectiles,shot);
    for(const cover of state.covers.filter(isShield))
      // Placement is instantaneous; teleporting a shield cannot sweep-clear a whole lane.
      add('block',shot,cover,circleSweep(old,shot,shot.radius,cover,cover,cover.radius),0);
    for(const victim of victims){
      const oldVictim=prior(previous.rescue.npcs,victim);
      add('shot-hit',shot,victim,circleSweep(old,shot,shot.radius,oldVictim,victim,victim.id==='relay'?25:14),2);
    }
  }
  for(const enemy of state.enemies){
    const old=prior(previous.enemies,enemy);
    for(const cover of state.covers.filter(c=>c.status==='flight'&&!c.hitIds.includes(enemy.id)))
      add('throw-hit',cover,enemy,circleSweep(prior(previous.covers,cover),cover,cover.radius*.65,old,enemy,enemy.radius),1);
    if(state.tick<(enemy.nextBodyAt??0)||state.tick<(enemy.stunnedUntil??0))continue;
    for(const cover of state.covers.filter(isShield))
      if(enemy.role!=='raider')add('body-block',enemy,cover,circleSweep(old,enemy,enemy.radius,cover,cover,cover.radius),0);
    for(const victim of victims)add('body-hit',enemy,victim,circleSweep(old,enemy,enemy.radius,prior(previous.rescue.npcs,victim),victim,16),2);
  }
  // A heavy counter can knock an enemy into a neighbor for one chain impact.
  for(const enemy of state.enemies.filter(e=>e.knockedBy!==undefined&&state.tick<e.stunnedUntil&&!e.chainSpent)){
    for(const other of state.enemies.filter(e=>e.id!==enemy.id))
      add('chain-hit',enemy,other,circleSweep(prior(previous.enemies,enemy),enemy,enemy.radius,prior(previous.enemies,other),other,other.radius),1);
  }
  candidates.sort((a,b)=>a.t-b.t||a.priority-b.priority||String(a.a.id).localeCompare(String(b.a.id))||String(a.b.id).localeCompare(String(b.b.id)));
  function hurt(target){
    if(target.id==='player'){damage(state,events,'projectile',target);return;}
    if(target.id==='relay'){
      const relay=state.rescue.relay;
      if(state.tick>=relay.invulnerableUntil){
        relay.hp=Math.max(0,relay.hp-1);relay.invulnerableUntil=state.tick+60;
        state.rescue.relayInterruptedUntil=Math.max(state.rescue.relayInterruptedUntil??0,state.tick+90);
        state.rescue.phaseEndsAt+=90;
        events.push({type:'relay-hit',x:relay.x,y:relay.y});
      }
    }else hurtCivilian(state,target,events);
  }
  function kill(enemy,cover){
    if(deadEnemies.has(enemy.id))return;
    deadEnemies.add(enemy.id);captureTacticalCover(cover,enemy,state.tick);captured(state,events,enemy,cover);
    if(state.rescue.challenge)state.rescue.challenge.capturedTraits.push(cover.trait);
    if(cover.trait==='current'&&cover.shotCharge>0){
      for(const nearby of state.enemies)if(nearby.id!==enemy.id&&Math.hypot(nearby.x-enemy.x,nearby.y-enemy.y)<=cover.traitSlowRadius){
        nearby.stunnedUntil=Math.max(nearby.stunnedUntil??0,state.tick+48);
      }
      events.push({type:'slow',x:enemy.x,y:enemy.y,radius:cover.traitSlowRadius});
    }
    if(state.stats.captures%8===0)state.hearts=Math.min(state.maxHearts,state.hearts+1);
  }
  for(const event of candidates){
    const {kind,a,b}=event;
    if(kind==='block'){
      if(deadShots.has(a.id)||!isShield(b))continue;
      deadShots.add(a.id);state.stats.blocks++;state.lastBlockAt=state.tick;
      chargeCover(state,b,a,events);
      events.push({type:'block',coverId:b.id,x:b.x,y:b.y});
    }else if(kind==='shot-hit'){
      if(deadShots.has(a.id))continue;deadShots.add(a.id);hurt(b);
    }else if(kind==='body-block'){
      if(deadEnemies.has(a.id)||stoppedBodies.has(a.id)||!isShield(b))continue;
      stoppedBodies.add(a.id);a.nextBodyAt=state.tick+90;a.stunnedUntil=state.tick+24;a.hitAt=state.tick;a.hitUntil=state.tick+24;
      const length=Math.hypot(a.x-b.x,a.y-b.y)||1;
      a.knockVx=(a.x-b.x)/length*100;a.knockVy=(a.y-b.y)/length*100;
      b.hp=Math.max(0,b.hp-1);
      if(!b.hp){b.status='spent';b.charge=0;events.push({type:'cover-broken',coverId:b.id,x:b.x,y:b.y});}
      events.push({type:'block',coverId:b.id,x:b.x,y:b.y});
    }else if(kind==='body-hit'){
      if(deadEnemies.has(a.id)||stoppedBodies.has(a.id))continue;
      stoppedBodies.add(a.id);a.nextBodyAt=state.tick+100;hurt(b);
    }else if(kind==='chain-hit'){
      if(deadEnemies.has(a.id)||deadEnemies.has(b.id)||a.chainSpent)continue;
      a.chainSpent=true;b.hp--;b.hitAt=state.tick;b.hitUntil=state.tick+24;
      events.push({type:'enemy-hit',x:b.x,y:b.y});
      if(b.hp<=0)kill(b,state.covers.find(c=>c.id===a.knockedBy)??a);
    }else{
      if(deadEnemies.has(b.id)||a.status!=='flight'||a.hitIds.includes(b.id))continue;
      if(b.armor==='intact'){
        a.hitIds.push(b.id);
        b.armorHits=(b.armorHits??0)+1;b.hitAt=state.tick;b.hitUntil=state.tick+24;beginReturn(a,state.tick);
        if(b.armorHits>=armorHitsToBreak(b)){
          b.armor='broken';b.guard='broken';state.stats.armorBreaks++;
          events.push({type:'armor-break',enemyId:b.id,x:b.x,y:b.y});
        }else events.push({type:'armor-hit',enemyId:b.id,x:b.x,y:b.y,remaining:armorHitsToBreak(b)-b.armorHits});
        continue;
      }
      if(b.role==='commander'&&b.order&&a.counter){
        b.order=null;b.stunnedUntil=state.tick+90;b.hitAt=state.tick;b.hitUntil=state.tick+36;
        state.stats.interrupts++;
        events.push({type:'command-interrupt',enemyId:b.id,x:b.x,y:b.y});
      }
      const charged=a.shotCharge>0;
      if(charged){
        state.stats.counterHits++;
        state.stats.counterChain=state.tick-state.lastCounterAt<=480?state.stats.counterChain+1:1;
        state.lastCounterAt=state.tick;
        state.stats.bestCounterChain=Math.max(state.stats.bestCounterChain,state.stats.counterChain);
        state.score+=a.counter?150:75;
        events.push({type:'counter',coverId:a.id,x:b.x,y:b.y,chain:state.stats.counterChain});
      }
      kill(b,a);
    }
  }
  state.enemies=state.enemies.filter(e=>!deadEnemies.has(e.id));
  state.projectiles=state.projectiles.filter(p=>!deadShots.has(p.id)&&p.x>100&&p.x<950&&p.y>0&&p.y<600);
}
