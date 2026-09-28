// Source-action contract. Roles are authored game AI labels, never claims about
// the canonical behavior of the MSU source mobs.
const PROFILES=Object.freeze({
  hunter:Object.freeze({key:'roster-lupin',idleAction:'stand',moveAction:'move',attackAction:'attack1',hitAction:'hit1'}),
  attacker:Object.freeze({key:'roster-lupin',idleAction:'stand',moveAction:'move',attackAction:'attack1',hitAction:'hit1'}),
  breaker:Object.freeze({key:'roster-iron-boar-raider',idleAction:'stand',moveAction:'move',attackAction:'attack1',hitAction:'hit1'}),
  commander:Object.freeze({key:'roster-king-clang',idleAction:'stand',moveAction:'move',attackAction:'attack1',skillAction:'skill1',hitAction:'hit1'}),
  bait:Object.freeze({key:'roster-jr-boogie',idleAction:'stand',moveAction:'move',attackAction:'skill1',hitAction:'hit1'}),
  raider:Object.freeze({key:'roster-block-golem',idleAction:'stand',moveAction:'move',hitAction:'hit1',fallback:'body-charge'}),
  // No verified work/build action exists for the candidate source. This uses an
  // explicit code motion until a compatible authored source is acquired.
  engineer:Object.freeze({key:'kerning-bubbling',idleAction:'stand',moveAction:'move',hitAction:'hit1',fallback:'build-sway'}),
  default:Object.freeze({key:'roster-lupin',idleAction:'stand',moveAction:'move',attackAction:'attack1',hitAction:'hit1'})
});

export function enemyVisualProfile(entity){return PROFILES[entity.role]??PROFILES.default;}
export function visualAction(profile,entity){
  if(entity.telegraph)return entity.order&&profile.skillAction?profile.skillAction:profile.attackAction??null;
  if(entity.hitUntil&&entity.tick<entity.hitUntil)return profile.hitAction??null;
  if(entity.stunnedUntil&&entity.tick<entity.stunnedUntil)return profile.hitAction??null;
  if(entity.speed===0||(entity.vx===0&&entity.vy===0))return profile.idleAction??profile.moveAction??null;
  return profile.moveAction??null;
}

export function visualFrameTiming(profile,entity,tick){
  const action=visualAction(profile,{...entity,tick});
  const startedAt=entity.telegraph?.startedAt??((entity.hitUntil??-Infinity)>tick?entity.hitAt:undefined);
  if(Number.isFinite(startedAt))return {action,frameTick:Math.max(0,tick-startedAt),loop:false};
  return {action,frameTick:tick+(entity.animationPhase??0),loop:true};
}
