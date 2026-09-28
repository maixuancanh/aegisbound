import {sampleAnimation,animationDuration} from './animator.js';
import {projectBody} from './projection.js';
export const VFX_RECIPES=Object.freeze({
  carry:['speed-infusion','affected',.62],
  capture:['speed-infusion','effect',.46],
  heavyArmor:['blitz-shield','repeat',.82],
  lightArmor:['shield-mastery','mob',.68],
  enemyFlight:['hunter-bowgun','effect',.34],
  enemyHit:['hunter-bowgun','hit',.42]
});
export const CARRY_VFX_PLACEMENT=Object.freeze({lift:54,center:true});
export function armorVfxFor(enemy){
  if(enemy.armor!=='intact')return null;
  if(enemy.archetype==='Warden')return VFX_RECIPES.heavyArmor;
  return VFX_RECIPES.lightArmor;
}
export function armorVfxPlacement(enemy){
  if(enemy.archetype==='Warden')return {lift:0,center:false};
  return {lift:78,center:true};
}
const EFFECTS={
  block:VFX_RECIPES.enemyHit,
  'melee-hit':VFX_RECIPES.enemyHit,
  'cover-hit':VFX_RECIPES.enemyHit,
  'cover-broken':VFX_RECIPES.capture,
  capture:VFX_RECIPES.capture,
  'civilian-hit':VFX_RECIPES.enemyHit,
  'civilian-lost':VFX_RECIPES.capture,
  damage:VFX_RECIPES.enemyHit,
  'enemy-hit':VFX_RECIPES.enemyHit
};
export function projectileRotation({vx=0,vy=0}){return Math.atan2(vy,vx);}
export function isCarryVfxActive(cover){return cover.status==='orbit';}
export function createVfx(ctx,assets){
  let generation=null,active=[];
  function drawFrame({recipe,x,y,lift=35,rotation=0,elapsed=0,loop=false,center=false},state,settings){
    const [record,action,scale]=recipe,frames=assets.records[record]?.actions[action];
    if(!frames?.length)return;
    const {frame}=sampleAnimation(frames,settings.reducedMotion?0:elapsed,{loop});
    const img=assets.images.get(frame?.localPath);if(!img)return;
    const p=projectBody({x,y,lift});ctx.save();ctx.globalAlpha=settings.reducedFlash?.35:.8;
    ctx.translate(p.x,p.y);ctx.rotate(rotation);ctx.scale(scale*p.scale,scale*p.scale);
    const anchor=center?{x:img.width/2,y:img.height/2}:{x:frame.origin?.x??img.width/2,y:frame.origin?.y??img.height/2};
    ctx.drawImage(img,-anchor.x,-anchor.y);ctx.restore();
  }
  return {
    accept(events,state){
      if(generation!==state.generation){generation=state.generation;active=[];}
      for(const event of events){
        const recipe=EFFECTS[event.type];if(!recipe)continue;
        const cover=state.covers.find(c=>c.id===event.coverId);
        const position=Number.isFinite(event.x)?event:cover??state.player;
        active.push({type:event.type,recipe,startedAt:state.tick,x:position.x,y:position.y,lift:cover?54:35});
      }
      if(active.length>24)active=active.slice(-24);
    },
    draw(state,settings){
      if(generation!==state.generation){generation=state.generation;active=[];}
      active=active.filter(e=>(state.tick-e.startedAt)*1000/60<animationDuration(assets.records[e.recipe[0]]?.actions[e.recipe[1]]));
      for(const cover of state.covers.filter(isCarryVfxActive))drawFrame({
        recipe:VFX_RECIPES.carry,x:cover.x,y:cover.y,...CARRY_VFX_PLACEMENT,elapsed:state.tick*1000/60,loop:true
      },state,settings);
      for(const enemy of state.enemies){
        const recipe=armorVfxFor(enemy);
        if(recipe)drawFrame({recipe,x:enemy.x,y:enemy.y,...armorVfxPlacement(enemy),elapsed:state.tick*1000/60,loop:true},state,settings);
      }
      for(const projectile of state.projectiles)drawFrame({
        recipe:VFX_RECIPES.enemyFlight,x:projectile.x,y:projectile.y,lift:54,
        rotation:projectileRotation(projectile),elapsed:state.tick*1000/60,loop:true
      },state,settings);
      for(const event of active){
        const elapsed=(state.tick-event.startedAt)*1000/60;
        drawFrame({...event,elapsed},state,settings);
      }
    }
  };
}
