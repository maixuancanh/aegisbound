export function tutorialOptions(){return {mode:'practice',archetype:'Spitter',direction:0,tutorial:true};}
export function tutorialHint(state){
  if(!state.stats.blocks)return 'DRAG COVER INTO THE WARNING LINE · PRESS SPACE / PARK TO SET IT DOWN · WAIT FOR A BLOCK';
  if(!state.stats.captures)return 'KEEP THE COVER AIMED AT THE ENEMY · RELEASE TO THROW';
  if(!state.stats.returns)return 'THE CAPTURED ENEMY IS RETURNING · IT CANNOT BLOCK YET';
  return 'SET THE RETURNED COVER DOWN TO SHIELD · HELD COVER CANNOT BLOCK';
}
export function tutorialPassed(state){return state.stats.blocks>0&&state.stats.captures>0&&state.stats.returns>0;}
