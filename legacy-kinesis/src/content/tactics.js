export const SHIELD_TRAITS=Object.freeze({
  Drifter:Object.freeze({id:'bubble',shelterRadius:1.25,speed:1,heavyDamage:3}),
  Spitter:Object.freeze({id:'current',shelterRadius:1.05,speed:1,heavyDamage:2,slowRadius:92}),
  Warden:Object.freeze({id:'armor',shelterRadius:1,speed:.9,heavyDamage:1}),
  Looper:Object.freeze({id:'swift',shelterRadius:.78,speed:1.35,heavyDamage:2})
});

export function shieldTraitFor(archetype){
  return SHIELD_TRAITS[archetype]??SHIELD_TRAITS.Drifter;
}

export function applyShieldTrait(cover,archetype){
  const base=cover.baseStats??{radius:cover.radius,shelterRadius:cover.shelterRadius,speed:cover.speed,maxHp:cover.maxHp};
  const trait=shieldTraitFor(archetype);
  cover.baseStats={...base};
  Object.assign(cover,{trait:trait.id,capturedArchetype:archetype,radius:base.radius,
    shelterRadius:Math.round(base.shelterRadius*trait.shelterRadius),speed:Math.round(base.speed*trait.speed),maxHp:base.maxHp,
    traitHeavyDamage:trait.heavyDamage,traitSlowRadius:trait.slowRadius??0});
  cover.hp=Math.min(cover.hp??cover.maxHp,cover.maxHp);
  return cover;
}

export function canCaptureGuardedEnemy(enemy,cover){
  return enemy.armor!=='intact';
}

export function armorHitsToBreak(enemy){
  return enemy.archetype==='Warden'?2:1;
}
