export const frameDelay=frame=>Math.max(16,Math.abs(Number(frame?.delay)||120));
export const animationDuration=frames=>(frames??[]).reduce((sum,frame)=>sum+frameDelay(frame),0);
export function sampleAnimation(frames,elapsedMs,{loop=true}={}){
  if(!frames?.length)return {frame:null,index:0,finished:true};
  const duration=animationDuration(frames),finished=elapsedMs>=duration;
  let time=loop?Math.max(0,elapsedMs)%duration:Math.min(Math.max(0,elapsedMs),duration-1);
  for(let index=0;index<frames.length;index++){
    time-=frameDelay(frames[index]);if(time<0)return {frame:frames[index],index,finished};
  }
  return {frame:frames.at(-1),index:frames.length-1,finished};
}

// Presentation state only; fixed simulation time freezes every action during pause.
export function createActorAnimator(){
  let generation=null,action='idle',startedAt=0,until=0,facing=-1;
  const priorities={capture:1,throw:2,hit:3};
  return {
    reset(next){generation=next;action='idle';startedAt=0;until=0;facing=-1;},
    accept(events,state){
      if(generation!==state.generation)this.reset(state.generation);
      const event=events.filter(e=>['throw','damage','capture'].includes(e.type))
        .sort((a,b)=>(priorities[b.type==='damage'?'hit':b.type]??0)-(priorities[a.type==='damage'?'hit':a.type]??0))[0];
      if(event){
        const next=event.type==='damage'?'hit':event.type;
        if(state.tick>=until||(priorities[next]??0)>=(priorities[action]??0)){
          action=next;startedAt=state.tick;until=state.tick+({hit:27,throw:36,capture:32}[action]);
        }
        const cover=state.covers.find(c=>c.id===event.coverId);
        if(cover)facing=cover.x>=state.player.x?1:-1;
      }
    },
    pose(state){
      if(generation!==state.generation)this.reset(state.generation);
      const held=state.covers.find(c=>c.status==='held');
      if(state.tick>=until){
        const next=held?'hold':'idle';if(next!==action){action=next;startedAt=state.tick;}
        if(held)facing=held.x>=state.player.x?1:-1;
      }
      return {action,elapsedMs:(state.tick-startedAt)*1000/60,facing};
    }
  };
}
