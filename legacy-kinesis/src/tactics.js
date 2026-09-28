import {CONFIG as C} from './config.js';
import {angleDelta,clamp} from './geometry.js';
import {COVER_TYPES,COVER_HOMES,RESCUE_RESOURCES} from './content/rescue.js';
import {applyShieldTrait} from './content/tactics.js';
import {enemyVisualProfile} from './content/roster.js';

export const isShield=c=>c.status==='orbit'&&(c.hp===undefined||c.hp>0);
export function makeTacticalCovers(count=3,forcedKind='mixed'){
  const entries=Object.entries(COVER_TYPES);
  const selected=forcedKind==='mixed'?entries.slice(0,count):Array.from({length:count},()=>[forcedKind,COVER_TYPES[forcedKind]]);
  return selected.map(([kind,type],id)=>({
    id,kind,appearance:kind,...type,...COVER_HOMES[id],home:{...COVER_HOMES[id]},
    status:'orbit',hp:type.maxHp,charge:0,heavy:false,lastBlockAt:-10000,
    lift:54,angle:0,hitIds:[],tactical:true,
    baseStats:{radius:type.radius,shelterRadius:type.shelterRadius,speed:type.speed,maxHp:type.maxHp}
  }));
}
export function placementPoint(aim,cover,covers=[]){
  const p={x:clamp(aim?.x??cover.x,235,730),y:clamp(aim?.y??cover.y,145,440)};
  // Separate physical props; no overlapping invulnerable pile.
  for(let pass=0;pass<3;pass++)for(const other of covers.filter(c=>c.id!==cover.id&&isShield(c))){
    const dx=p.x-other.x,dy=p.y-other.y,d=Math.hypot(dx,dy),min=cover.radius+other.radius+8;
    if(d<min){p.x=clamp(other.x+(d?dx/d:1)*min,235,730);p.y=clamp(other.y+(d?dy/d:0)*min,145,440);}
  }
  return p;
}
export function tacticalThrowAim(player,cover,aim){
  const target=aim??{x:player.x+C.maxThrowAim,y:player.y};
  const dx=cover.x-player.x,dy=cover.y-player.y,dist=Math.hypot(target.x-player.x,target.y-player.y);
  const safeDirection=Math.max(1,Math.hypot(dx,dy));
  const power=clamp(dist/C.maxThrowAim,C.minThrowPower,1);
  return {target,distance:dist,power,guideDistance:44+power*296,
    direction:{x:dx/safeDirection,y:dy/safeDirection}};
}
export function beginReturn(cover,tick){
  cover.status='returning';cover.returnFrom={x:cover.x,y:cover.y};cover.returnAt=tick;
  cover.returnTicks=cover.hitIds.length?16:36;cover.stolenBy=null;
}
export function captureTacticalCover(cover,enemy,tick){
  const capturedVisualKey=enemyVisualProfile(enemy).key;
  Object.assign(cover,{
    status:'returning',appearance:enemy.kind,capturedArchetype:enemy.archetype,capturedId:enemy.id,
    capturedVisualKey,x:enemy.x,y:enemy.y,returnFrom:{x:enemy.x,y:enemy.y},returnAt:tick,returnTicks:4,
    hitIds:[],charge:0,heavy:false,stolenBy:null,expiring:false
  });
  applyShieldTrait(cover,enemy.archetype);
}
export function steerTacticalCover(player,cover,aim){
  const dx=aim.x-player.x,dy=aim.y-player.y;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1)return;
  const wanted=Math.atan2(dy,dx);
  const current=Math.atan2(cover.y-player.y,cover.x-player.x);
  const step=C.holdSpeed/C.hz/C.orbitRadius;
  const angle=current+clamp(angleDelta(wanted,current),-step,step);
  Object.assign(cover,{angle,x:player.x+Math.cos(angle)*C.orbitRadius,y:player.y+Math.sin(angle)*C.orbitRadius});
}
export function tacticalCommand(state,command,events){
  const held=state.covers.find(c=>c.status==='held');
  if(command.type==='aim'&&Number.isFinite(command.x)&&Number.isFinite(command.y)){
    state.aim={x:command.x,y:command.y};
    if(held)steerTacticalCover(state.player,held,state.aim);
    return true;
  }
  if(command.type==='place'&&held){
    const p=placementPoint(state.aim,held,state.covers);
    Object.assign(held,p,{home:{...p},status:'orbit',stolenBy:null});
    state.aim=null;events.push({type:'place',coverId:held.id,x:p.x,y:p.y});return true;
  }
  if(command.type==='release'&&held){
    const shot=tacticalThrowAim(state.player,held,state.aim);
    const power=shot.power,charged=held.charge;
    const counter=state.tick-held.lastBlockAt<=72&&charged>0;
    Object.assign(held,{status:'flight',power,angle:Math.atan2(shot.direction.y,shot.direction.x),
      launch:{x:held.x,y:held.y,tick:state.tick},vx:shot.direction.x*held.speed*power,vy:shot.direction.y*held.speed*power,
      piercing:1+Math.min(2,charged),shotCharge:charged,shotHeavy:held.heavy,counter,
      hitIds:[],charge:0,heavy:false,stolenBy:null});
    state.aim=null;events.push({type:'throw',coverId:held.id,counter});return true;
  }
  if(command.type==='repair'){
    const r=state.rescue;
    if(r.kits<=0||state.tick<r.repairReadyAt)return true;
    const choices=state.covers.filter(c=>['orbit','spent'].includes(c.status)&&c.hp<c.maxHp);
    const cover=choices.find(c=>c.id===state.selectedCoverId)??choices.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(!cover)return true;
    Object.assign(cover,{...cover.home,hp:cover.maxHp,status:'orbit',charge:0,heavy:false,stolenBy:null});
    r.kits--;r.repairReadyAt=state.tick+RESCUE_RESOURCES.repairCooldown;
    events.push({type:'repair',coverId:cover.id,x:cover.x,y:cover.y});return true;
  }
  return false;
}
export function advanceTacticalCover(cover,tick){
  if(cover.status==='flight'){
    const age=tick-cover.launch.tick;
    cover.x=cover.launch.x+cover.vx*age/60;cover.y=cover.launch.y+cover.vy*age/60;
    // Expiration is settled after the final swept hit in collision.
    cover.expiring=age>=84||cover.x<80||cover.x>930||cover.y<30||cover.y>550;
  }else if(cover.status==='returning'){
    const t=clamp((tick-cover.returnAt)/cover.returnTicks,0,1);
    cover.x=cover.returnFrom.x+(cover.home.x-cover.returnFrom.x)*t;
    cover.y=cover.returnFrom.y+(cover.home.y-cover.returnFrom.y)*t;
    if(t===1){cover.status='orbit';cover.expiring=false;}
  }
  return cover;
}
export function chargeCover(state,cover,shot,events){
  const damage=shot.heavy?(cover.traitHeavyDamage??2):1;
  cover.hp=Math.max(0,cover.hp-damage);
  cover.charge=Math.min(3,cover.charge+(shot.heavy?2:1));
  cover.heavy ||= Boolean(shot.heavy);cover.lastBlockAt=state.tick;
  events.push({type:'cover-hit',coverId:cover.id,x:cover.x,y:cover.y,hp:cover.hp,maxHp:cover.maxHp,heavy:Boolean(shot.heavy)});
  if(cover.hp===0){
    cover.status='spent';cover.charge=0;cover.stolenBy=null;
    events.push({type:'cover-broken',coverId:cover.id,x:cover.x,y:cover.y});
  }
}
export function finishTacticalFlight(state,cover,events){
  if(cover.status!=='flight'||!cover.expiring)return;
  cover.status='spent';cover.hp=0;cover.charge=0;
  state.stats.misses++;state.streak=0;state.stats.counterChain=0;
  events.push({type:'miss',coverId:cover.id});
}
