import {challengeMedal} from './content/challenges.js';
const KEY='vcs2:kinesis:v1';
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function freshProfile(){
  return {schemaVersion:1,contentVersion:1,unlockedArena:0,medals:[0,0,0],best:[0,0,0],
    rescueBest:{score:0,boarded:0,wins:0,bestChain:0},trialBest:[0,0,0],trialMedals:[0,0,0],
    badges:[false,false,false,false,false,false],challengeMedals:[0,0,0,0,0,0],tutorialSeen:false,
    settings:{mute:false,music:.4,sfx:.65,reducedMotion:false,reducedFlash:false,highContrast:false}};
}
function sanitize(value){
  const p=freshProfile();
  if(!value||typeof value!=='object')return p;
  if(integer(value.unlockedArena,0,2))p.unlockedArena=value.unlockedArena;
  for(let i=0;i<3;i++){
    if(integer(value.medals?.[i],0,3))p.medals[i]=value.medals[i];
    if(integer(value.best?.[i],0,100000000))p.best[i]=value.best[i];
    if(integer(value.trialBest?.[i],0,100000000))p.trialBest[i]=value.trialBest[i];
    if(integer(value.trialMedals?.[i],0,3))p.trialMedals[i]=value.trialMedals[i];
  }
  for(const key of Object.keys(p.rescueBest)){
    if(integer(value.rescueBest?.[key],0,100000000))p.rescueBest[key]=value.rescueBest[key];
  }
  for(let i=0;i<6;i++)if(typeof value.badges?.[i]==='boolean')p.badges[i]=value.badges[i];
  for(let i=0;i<6;i++)if(integer(value.challengeMedals?.[i],0,3))p.challengeMedals[i]=value.challengeMedals[i];
  if(typeof value.tutorialSeen==='boolean')p.tutorialSeen=value.tutorialSeen;
  for(const key of Object.keys(p.settings)){
    const next=value.settings?.[key];
    if(typeof p.settings[key]==='boolean'&&typeof next==='boolean')p.settings[key]=next;
    else if(typeof p.settings[key]==='number'&&Number.isFinite(next)&&next>=0&&next<=1)p.settings[key]=next;
  }
  return p;
}
export function readProfile(storage){
  try{
    const value=storage.getItem(KEY);
    if(value===null)return {profile:freshProfile(),warning:null};
    try{
      const parsed=JSON.parse(value);
      return {profile:sanitize(parsed),warning:parsed?.schemaVersion===1?null:'version'};
    }catch{return {profile:freshProfile(),warning:'corrupt'};}
  }catch{return {profile:freshProfile(),warning:'blocked'};}
}
export function saveProfile(storage,profile){
  try{storage.setItem(KEY,JSON.stringify(sanitize(profile)));return true;}catch{return false;}
}
export function recordResult(profile,state){
  const p=sanitize(profile);
  // A departure choice, pause, abandoned run or departure animation is not a result.
  if(!['won','lost'].includes(state.status))return p;
  if(state.mode==='practice'||state.mode==='fixture'||state.mode==='tutorial')return p;
  const score=integer(state.score,0,100000000)?state.score:0;
  if(state.mode==='rescue'){
    const boarded=integer(state.rescue?.boarded,0,100000000)?state.rescue.boarded:0;
    const chain=integer(state.stats?.bestCounterChain,0,100000000)?state.stats.bestCounterChain:0;
    p.rescueBest.score=Math.max(p.rescueBest.score,score);
    p.rescueBest.boarded=Math.max(p.rescueBest.boarded,boarded);
    p.rescueBest.bestChain=Math.max(p.rescueBest.bestChain,chain);
    if(state.status==='won')p.rescueBest.wins=Math.min(100000000,p.rescueBest.wins+1);
  }else if(state.mode==='trial'&&integer(state.arena,0,2)){
    p.trialBest[state.arena]=Math.max(p.trialBest[state.arena],score);
    if(state.status==='won'){
      const maxHearts=Number.isFinite(state.maxHearts)?state.maxHearts:6;
      const medal=state.hearts===maxHearts&&(state.rescue?.lost??0)===0?3:state.hearts>=Math.ceil(maxHearts/2)?2:1;
      p.trialMedals[state.arena]=Math.max(p.trialMedals[state.arena],medal);
    }
  }else if(state.mode==='arcade'&&integer(state.arena,0,2)){
    p.best[state.arena]=Math.max(p.best[state.arena],score);
    if(state.status==='won'){
      const medal=state.hearts===3&&state.stats.misses===0?3:state.hearts>=2?2:1;
      p.medals[state.arena]=Math.max(p.medals[state.arena],medal);
      p.unlockedArena=Math.max(p.unlockedArena,Math.min(2,state.arena+1));
    }
  }else if(state.mode==='challenge'&&state.status==='won'&&integer(state.challenge,0,5)){
    p.badges[state.challenge]=true;
    p.challengeMedals[state.challenge]=Math.max(p.challengeMedals[state.challenge],challengeMedal(state));
  }
  return p;
}
