import {circleSweep} from './geometry.js';
import {captureCover} from './cover.js';
import {captured,damage} from './scoring.js';
const protective=c=>['orbit','held'].includes(c.status);
export function resolveCollisions(state,previous,events) {
  const candidates=[],player=state.player;
  const prior=(list,entity)=>list.find(e=>e.id===entity.id)??entity;
  function add(kind,a,b,t,priority){
    if(t!==null)candidates.push({kind,a,b,t,priority});
  }
  for(const shot of state.projectiles){
    const old=prior(previous.projectiles,shot);
    for(const cover of state.covers.filter(protective))
      add('block',shot,cover,circleSweep(old,shot,shot.radius,prior(previous.covers,cover),cover,cover.radius),0);
    add('projectile-damage',shot,player,circleSweep(old,shot,shot.radius,player,player,16),2);
  }
  for(const enemy of state.enemies){
    const old=prior(previous.enemies,enemy);
    for(const cover of state.covers.filter(c=>c.status==='flight'))
      add('capture',cover,enemy,circleSweep(prior(previous.covers,cover),cover,cover.radius,old,enemy,enemy.radius),1);
    add('body-damage',enemy,player,circleSweep(old,enemy,enemy.radius,player,player,16),2);
  }
  candidates.sort((a,b)=>a.t-b.t||a.priority-b.priority||
    String(a.a.id).localeCompare(String(b.a.id),undefined,{numeric:true})||
    String(a.b.id).localeCompare(String(b.b.id),undefined,{numeric:true}));
  const deadEnemies=new Set(),deadShots=new Set(),usedCovers=new Set();
  for(const event of candidates){
    const {kind,a,b}=event;
    if(kind==='block'){
      if(deadShots.has(a.id))continue;
      deadShots.add(a.id);state.stats.blocks++;state.lastBlockAt=state.tick;
      events.push({type:'block',coverId:b.id,x:b.x,y:b.y});
    } else if(kind==='capture'){
      if(deadEnemies.has(b.id)||usedCovers.has(a.id))continue;
      deadEnemies.add(b.id);usedCovers.add(a.id);
      const old=prior(previous.covers,a);
      const impact={...a,x:old.x+(a.x-old.x)*event.t,y:old.y+(a.y-old.y)*event.t};
      state.covers[state.covers.findIndex(c=>c.id===a.id)]=captureCover(impact,b,state.tick);
      captured(state,events,b,impact);
    } else if(kind==='projectile-damage'){
      if(deadShots.has(a.id))continue;deadShots.add(a.id);damage(state,events,'projectile',{x:b.x,y:b.y});
    } else {
      if(deadEnemies.has(a.id))continue;deadEnemies.add(a.id);damage(state,events,'body',{x:b.x,y:b.y});
    }
  }
  state.enemies=state.enemies.filter(e=>!deadEnemies.has(e.id));
  state.projectiles=state.projectiles.filter(e=>!deadShots.has(e.id)&&e.x>-80&&e.x<1040&&e.y>-100&&e.y<700);
}
