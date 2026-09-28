export function createClock(){
  let last=null,accumulator=0,paused=true;
  return {
    reset(now){last=now;accumulator=0;paused=false;},
    pause(){paused=true;last=null;accumulator=0;},
    advance(now,step){
      if(paused)return {steps:0};
      if(last===null){last=now;return {steps:0};}
      accumulator+=Math.max(0,now-last);last=now;
      if(accumulator>250){this.pause();return {steps:0,reason:'lag'};}
      let steps=0;
      while(accumulator+1e-7>=1000/60&&steps<6){
        accumulator-=1000/60;step();steps++;
        if(paused)break;
      }
      return {steps,alpha:Math.max(0,accumulator/(1000/60))};
    }
  };
}
