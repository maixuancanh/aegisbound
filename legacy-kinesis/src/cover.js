import {CONFIG as C} from './config.js';
import {angleDelta,clamp} from './geometry.js';
const protective=c=>c.status==='orbit'||c.status==='held';
export function makeCovers(player={x:C.playerX,y:C.playerY},count=3) {
  return ['crate','stone','sign'].slice(0,count).map((kind,id)=>{
    const angle=(-145+id*120)*Math.PI/180;
    return {id,kind,appearance:kind,status:'orbit',angle,
      x:player.x+Math.cos(angle)*C.orbitRadius,y:player.y+Math.sin(angle)*C.orbitRadius,
      lift:54,radius:C.coverRadius};
  });
}
export function holdCover(cover) {
  if(cover.status!=='orbit')throw new Error('cover must be orbit');
  return {...cover,status:'held'};
}
export function steerCover(cover,target,covers,player={x:C.playerX,y:C.playerY}) {
  if(cover.status!=='held')return cover;
  const want=Math.atan2(target.y-player.y,target.x-player.x);
  let turn=clamp(angleDelta(want,cover.angle),-C.holdSpeed/C.hz/C.orbitRadius,C.holdSpeed/C.hz/C.orbitRadius);
  // Constrain the actual swept arc, not only its endpoint, so neighbors cannot be crossed.
  for(const other of covers.filter(o=>o.id!==cover.id&&protective(o))){
    const delta=angleDelta(other.angle,cover.angle);
    if(turn>0&&delta>=0)turn=Math.min(turn,Math.max(0,delta-C.separation));
    if(turn<0&&delta<=0)turn=Math.max(turn,Math.min(0,delta+C.separation));
  }
  const angle=cover.angle+turn;
  return {...cover,angle,x:player.x+Math.cos(angle)*C.orbitRadius,y:player.y+Math.sin(angle)*C.orbitRadius};
}
export function throwPower(aim,player={x:C.playerX,y:C.playerY}) {
  if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return 1;
  return clamp(Math.hypot(aim.x-player.x,aim.y-player.y)/C.maxThrowAim,C.minThrowPower,1);
}
export function releaseCover(cover,player={x:C.playerX,y:C.playerY},tick=0,power=1) {
  if(cover.status!=='held')throw new Error('cover must be held');
  const dx=cover.x-player.x,dy=cover.y-player.y,len=Math.hypot(dx,dy);
  if(len===0)throw new Error('invalid launch anchor');
  const strength=clamp(power,C.minThrowPower,1);
  const launch=Object.freeze({x:cover.x,y:cover.y,angle:cover.angle,tick,power:strength});
  return {...cover,status:'flight',launch,power:strength,vx:dx/len*C.throwSpeed*strength,vy:dy/len*C.throwSpeed*strength};
}
export function advanceCover(cover,tick) {
  if(cover.status==='flight') {
    const age=tick-cover.launch.tick;
    if(age>=C.flightTicks||cover.x<-60||cover.x>C.width+60||cover.y<-100||cover.y>C.height+100)
      return {...cover,status:'spent'};
    return {...cover,x:cover.launch.x+cover.vx*age/C.hz,y:cover.launch.y+cover.vy*age/C.hz};
  }
  if(cover.status==='returning') {
    const t=clamp((tick-cover.capturedAt)/C.returnTicks,0,1);
    const pos={x:cover.returnFrom.x+(cover.launch.x-cover.returnFrom.x)*t,
      y:cover.returnFrom.y+(cover.launch.y-cover.returnFrom.y)*t};
    return {...cover,...pos,status:t===1?'orbit':'returning',angle:cover.launch.angle};
  }
  return cover;
}
export function captureCover(cover,enemy,tick) {
  if(cover.status!=='flight')throw new Error('cover must be flight');
  return {...cover,status:'returning',appearance:enemy.kind,capturedArchetype:enemy.archetype,capturedId:enemy.id,capturedAt:tick,
    returnFrom:{x:cover.x,y:cover.y}};
}
export const canContinue = covers => covers.some(c=>['orbit','held','flight','returning'].includes(c.status));
