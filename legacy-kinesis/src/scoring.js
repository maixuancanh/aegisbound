export function captured(state,events,enemy,cover) {
  // Multiplier uses the streak BEFORE this capture, matching the displayed next-hit value.
  const points=100*(1+Math.min(4,Math.floor(state.streak/3)));
  state.score+=points;state.streak++;state.stats.captures++;
  state.stats.bestStreak=Math.max(state.stats.bestStreak,state.streak);
  if(state.tick-state.lastBlockAt<=72)state.stats.windows++;
  events.push({type:'capture',enemyId:enemy.id,coverId:cover.id,x:enemy.x,y:enemy.y,points});
}
export function damage(state,events,source,impact) {
  if(state.tick<state.invulnerableUntil)return;
  state.hearts--;state.stats.damage++;state.streak=0;
  state.invulnerableUntil=state.tick+(state.tactical?90:27);state.lastDamage=source;
  events.push({type:'damage',source,...impact});
}
export function goalReached(state) {
  const goal=state.goal;
  if(!goal)return false;
  const n=goal.type==='returns'?state.stats.returns:state.stats.captures;
  return n>=goal.count&&state.stats.windows>=(goal.windows??0)&&
    (!goal.noDamage||state.stats.damage===0)&&(!goal.noMiss||state.stats.misses===0);
}
export function settleTerminal(state,events) {
  let reason=null,status=null;
  if(state.hearts<=0){status='lost';reason='hearts';}
  else if(state.goal?.noDamage&&state.stats.damage){status='lost';reason='challenge-damage';}
  else if(state.goal?.noMiss&&state.stats.misses){status='lost';reason='challenge-miss';}
  else if(state.covers.every(c=>c.status==='spent')){status='lost';reason='covers';}
  else if(state.arcadeCleared||(goalReached(state)&&state.goal.type!=='survive')){
    status='won';reason='clear';
  } else if(state.mode!=='practice'&&state.tick>=state.durationTicks){
    status=goalReached(state)?'won':'lost';reason=status==='won'?'clear':'time';
  }
  if(status){state.status=status;state.reason=reason;events.push({type:status==='won'?'clear':'fail',reason});}
}
