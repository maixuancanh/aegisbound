import {spawnEnemy} from './enemies.js';
export function admitEnemies(state,events) {
  if(state.mode==='fixture')return;
  const queue=state.waves[state.wave]??[];
  while(state.spawnCursor<queue.length&&state.enemies.length<3){
    const spec=queue[state.spawnCursor];
    if(state.tick-state.waveStartedAt<spec.delay)break;
    state.enemies.push(spawnEnemy(spec,state.tick,'e-'+state.nextEnemy++));
    state.spawnCursor++;
    events.push({type:'spawn'});
  }
  if(state.mode==='practice'&&state.enemies.length===0){
    state.spawnCursor=0;state.waveStartedAt=state.tick+30;
  }
}
export function settleWave(state,events) {
  if(state.mode!=='arcade')return;
  const quota=state.waves[state.wave]?.length??0;
  if(state.spawnCursor>=quota&&state.enemies.length===0){
    if(state.wave===state.waves.length-1){state.arcadeCleared=true;return;}
    state.wave++;state.spawnCursor=0;state.waveStartedAt=state.tick+60;
    events.push({type:'wave',wave:state.wave});
  }
}
