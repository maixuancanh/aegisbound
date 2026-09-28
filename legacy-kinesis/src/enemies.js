import {CONFIG as C} from './config.js';
const LOOK={Drifter:'slime',Spitter:'mushroom',Looper:'slime',Warden:'mushroom'};
export function spawnEnemy(spec,tick,id) {
  const angle=spec.angle??0,distance=spec.distance??280;
  const x=C.playerX+Math.cos(angle)*distance,y=C.playerY+Math.sin(angle)*distance;
  const speed=spec.speed??(spec.archetype==='Drifter'?24:0);
  return {...spec,id,kind:LOOK[spec.archetype],x,y,baseX:x,baseY:y,spawnedAt:tick,
    vx:-Math.cos(angle)*speed,vy:-Math.sin(angle)*speed,radius:20,
    nextShot:tick+45,shot:0,telegraph:null};
}
export function moveEnemy(enemy,tick) {
  if(enemy.archetype==='Looper'&&Number.isFinite(enemy.spawnedAt)){
    const t=(tick-enemy.spawnedAt)/60,phase=enemy.phase??0;
    return {...enemy,x:enemy.baseX+Math.sin(t*1.3+phase)*35,y:enemy.baseY+Math.cos(t*1.3+phase)*24};
  }
  return {...enemy,x:enemy.x+(enemy.vx??0)/60,y:enemy.y+(enemy.vy??0)/60};
}
export function advanceThreats(state,events) {
  for(const enemy of state.enemies){
    if(enemy.telegraph&&state.tick>=enemy.telegraph.fireAt){
      const {origin,direction}=enemy.telegraph;
      state.projectiles.push({id:'p-'+state.nextProjectile++,x:origin.x,y:origin.y,
        vx:direction.x*200,vy:direction.y*200,radius:6,owner:enemy.id});
      enemy.telegraph=null;
      enemy.shot++;
      enemy.nextShot=state.tick+(enemy.archetype==='Warden'&&enemy.shot%2===1?48:150);
      events.push({type:'enemy-shot',enemyId:enemy.id});
    }
  }
  let busy=state.projectiles.length+state.enemies.filter(e=>e.telegraph).length;
  for(const enemy of state.enemies){
    if(busy>=C.maxThreats)break;
    if(!['Spitter','Warden'].includes(enemy.archetype)||enemy.telegraph||state.tick<enemy.nextShot)continue;
    const dx=state.player.x-enemy.x,dy=state.player.y-enemy.y,length=Math.hypot(dx,dy)||1;
    enemy.telegraph={startedAt:state.tick,fireAt:state.tick+C.telegraphTicks,
      origin:{x:enemy.x,y:enemy.y},direction:{x:dx/length,y:dy/length}};
    busy++;
  }
}
