// The renderer may request a faster Practice simulation, but the simulation
// itself remains the same deterministic 60 Hz step. Commands are consumed by
// the first step only, so a click can never be replayed two or three times.
export function advanceSimulation(state,commands,requestedSteps,step){
  if(typeof step!=='function')throw new TypeError('advanceSimulation needs a deterministic step function');
  const count=Math.max(1,Math.trunc(Number(requestedSteps)||1));
  const steps=[];
  let current=state,pending=commands;
  for(let index=0;index<count&&current.status==='running';index++){
    const result=step(current,pending);
    steps.push(result);
    current=result.state;
    pending=[];
  }
  return {state:current,steps};
}
