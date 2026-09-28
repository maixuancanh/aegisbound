import {analyzeReplayFailure,createRun,replayFromSnapshot,stepRun} from './engine.js';
import {createClock} from './clock.js';
import {mapPointer,createPointerSession} from './input.js';
import {projectBody,pickCover,unprojectBody} from './projection.js';
import {readProfile,saveProfile,freshProfile,recordResult} from './storage.js';
import {loadMsuAssets} from './msu-assets.js';
import {createRenderer} from './renderer.js';
import {createUI} from './ui.js';
import {createMsuAudio} from './msu-audio.js';
import {tutorialOptions,tutorialHint,tutorialPassed} from './onboarding.js';
import {advanceSimulation} from './simulation.js';

const canvas=document.querySelector('#world'),overlay=document.querySelector('#overlay');
const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
let {profile,warning}=readProfile(storage);
let saveLocked=warning==='corrupt'||warning==='version';
const lab=new URLSearchParams(location.search).get('lab')==='1';
let state=createRun({mode:'practice'}),running=false,screen='title',backScreen='title',generation=0,options={mode:'rescue'},releaseMode='throw',snapshots=[],failureReplay=null,failureAnalysis=null;
let renderer=createRenderer(canvas,{},lab),commands=[];
const clock=createClock(),pointer=createPointerSession();
const audio=createMsuAudio();
const ui=createUI(overlay,action);
function persist(){if(!saveLocked&&!saveProfile(storage,profile))warning='blocked';applySettings();}
function applySettings(){
  document.body.classList.toggle('reduced-motion',profile.settings.reducedMotion);
  document.body.classList.toggle('high-contrast',profile.settings.highContrast);
  document.querySelector('#mute').textContent=profile.settings.mute?'Muted':'Sound';
  audio.update(profile.settings);
}
function clearGesture(){
  pointer.cancel();commands=[];
  state={...state,aim:null,covers:state.covers.map(c=>c.status==='held'?{...c,status:'orbit'}:c)};
}
function stop(){
  running=false;clock.pause();clearGesture();audio.stop();
}
function pause(reason='user'){
  if(!running)return;stop();screen='paused';ui.pause(reason);
}
function start(next=options){
  options={...next};releaseMode='throw';snapshots=[];failureReplay=null;failureAnalysis=null;stop();
  state=createRun({...options,generation:++generation});ui.clear();screen='game';running=true;
  document.querySelector('#hud').hidden=false;document.querySelector('#cue').hidden=false;
  clock.reset(performance.now());
  audio.start(profile.settings);
}
function startReplay(snapshot){
  options={mode:'practice',replay:true};releaseMode='throw';snapshots=[];failureReplay=null;stop();
  state=replayFromSnapshot(snapshot,++generation,failureAnalysis);failureAnalysis=null;ui.clear();screen='game';running=true;
  document.querySelector('#hud').hidden=false;document.querySelector('#cue').hidden=false;
  clock.reset(performance.now());audio.start(profile.settings);
}
function menu(){
  stop();screen='title';document.querySelector('#hud').hidden=true;document.querySelector('#cue').hidden=true;
  ui.title(warning,lab);
}
function action(value){
  void audio.unlock();
  const [kind,index]=value.split(':');
  if(kind==='lab'){location.search='?lab=1';return;}
  if(kind==='load'){boot();return;}
  if(kind==='quick')start({mode:'rescue',seed:seed()});
  else if(kind==='tutorial')start(tutorialOptions());
  else if(kind==='finish-tutorial'){profile.tutorialSeen=true;persist();start({mode:'rescue',seed:seed()});}
  else if(kind==='arena')start({mode:'trial',arena:Number(index),seed:seed()});
  else if(kind==='challenge'){screen='challenge-briefing';ui.challengeBriefing(Number(index));}
  else if(kind==='start-challenge')start({mode:'challenge',challenge:Number(index),seed:seed()});
  else if(kind==='lesson')start({mode:'practice',lesson:Number(index),seed:seed()});
  else if(kind==='replay'&&failureReplay)startReplay(failureReplay);
  else if(kind==='restart')start();
  else if(kind==='resume'){
    ui.clear();screen='game';running=true;clearGesture();clock.reset(performance.now());audio.start(profile.settings,false);
  } else if(kind==='title')menu();
  else if(kind==='arenas'){screen='arenas';ui.arenas(profile);}
  else if(kind==='challenges'){screen='challenges';ui.challenges(profile);}
  else if(kind==='practice'){screen='practice';ui.practice();}
  else if(kind==='start-practice')start({mode:'practice',archetype:document.querySelector('#archetype').value,direction:Number(document.querySelector('#direction').value)*Math.PI/180,
    formation:document.querySelector('#practice-formation').value,coverCount:Number(document.querySelector('#practice-covers').value),coverKind:document.querySelector('#practice-kind').value,
    durability:document.querySelector('#practice-durability').value,civilianCount:Number(document.querySelector('#practice-civilians').value),
    station:document.querySelector('#practice-station').checked,liveDamage:document.querySelector('#practice-damage').checked,autoResources:document.querySelector('#practice-auto').checked,
    speed:Number(document.querySelector('#practice-speed').value),
    startingCharge:Number(document.querySelector('#practice-charge').value)});
  else if(kind==='settings'){
    backScreen=screen;screen='settings';
    ui.settings(profile,(key,value)=>{profile.settings[key]=value;persist();});
  } else if(kind==='back'){
    if(backScreen==='paused'){screen='paused';ui.pause();}else menu();
  } else if(kind==='records'){screen='records';ui.records(profile);}
  else if(kind==='help'){screen='help';ui.help();}
  else if(kind==='credits'){screen='credits';ui.credits();}
  else if(kind==='leave')ui.confirm('leave');
  else if(kind==='reset-confirm')ui.confirm('reset');
  else if(kind==='reset'){profile=freshProfile();saveLocked=false;warning=null;persist();ui.records(profile);}
  else if(kind==='release-mode'){releaseMode=releaseMode==='throw'?'place':'throw';}
  else if(kind==='repair'||kind==='park'){commands.push({type:kind==='park'?'place':kind});}
  else if(kind==='depart'||kind==='stay'){
    commands.push({type:kind});ui.clear();screen='game';running=true;clock.reset(performance.now());
  }
}
function seed(){
  const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]||1;
}
canvas.addEventListener('pointerdown',event=>{
  if(!running||event.button!==0||!event.isPrimary)return;
  const point=mapPointer(event.clientX,event.clientY,canvas.getBoundingClientRect());
  if(!point)return;
  const id=pickCover(state.covers,point,Math.max(28,24*960/canvas.getBoundingClientRect().width));
  if(id===null||!pointer.begin(event.pointerId))return;
  canvas.setPointerCapture(event.pointerId);commands.push({type:'hold',id});event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
  if(!running||!pointer.owns(event.pointerId))return;
  const point=mapPointer(event.clientX,event.clientY,canvas.getBoundingClientRect());
  if(point)commands.push({type:'aim',...unprojectBody(point,54)});
});
canvas.addEventListener('pointerup',event=>{
  if(pointer.end(event.pointerId)==='release'&&running)commands.push({type:state.tactical&&releaseMode==='place'?'place':'release'});
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{
  if(pointer.cancel(event.pointerId)==='cancel')commands.push({type:'cancel'});
});
document.querySelector('#pause').addEventListener('click',()=>pause());
document.querySelector('#mute').addEventListener('click',()=>{profile.settings.mute=!profile.settings.mute;persist();});
document.querySelector('#release-mode').addEventListener('click',()=>action('release-mode'));
document.querySelector('#repair').addEventListener('click',()=>action('repair'));
document.querySelector('#park-cover').addEventListener('click',()=>action('park'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('hidden');});
window.addEventListener('blur',()=>pause('hidden'));
window.addEventListener('resize',()=>{clearGesture();if(innerHeight>innerWidth&&innerWidth<=700)pause('rotate');});
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&running){event.preventDefault();pause();}
  if(!running||event.repeat)return;
  if(event.key===' '){event.preventDefault();commands.push({type:state.tactical?'place':'cancel'});}
  if(state.tactical&&event.key.toLowerCase()==='f')commands.push({type:'repair'});
});
function frame(now){
  if(running){
    const result=clock.advance(now,()=>{
      const simulationSteps=state.simulationSpeed??1;
      const simulation=advanceSimulation(state,commands,simulationSteps,(current,pending)=>{
        if(current.tactical&&current.tick%30===0){
          snapshots.push(structuredClone(current));
          if(snapshots.length>20)snapshots.shift();
        }
        return stepRun(current,pending);
      });
      commands=[];
      for(const next of simulation.steps){
        state=next.state;
        renderer.events(next.events,state);
        audio.play(next.events,profile.settings);
        const notable=next.events.find(e=>['capture','block','miss','damage'].includes(e.type));
        if(notable)document.querySelector('#status').textContent=notable.type;
        if(options.tutorial&&tutorialPassed(state)){
          stop();profile.tutorialSeen=true;persist();screen='tutorial-result';ui.tutorialResult();break;
        }else if(state.tactical&&state.rescue.phase==='choice'&&screen!=='rescue-choice'){
          clearGesture();screen='rescue-choice';ui.rescueChoice(state);break;
        }else if(state.status!=='running'){
          if(state.status==='lost'&&!state.replay){
            failureReplay=[...snapshots].reverse().find(snapshot=>snapshot.tick<=state.tick-180)??snapshots[0]??null;
            failureAnalysis=analyzeReplayFailure(state);
            state={...state,replayAvailable:Boolean(failureReplay),failureAnalysis};
          }
          stop();profile=recordResult(profile,state);persist();screen='result';ui.result(state);break;
        }
      }
    });
    if(result.reason)pause(result.reason);
  }
  renderer.draw(state,profile.settings);ui.hud(state,{active:running,releaseMode,tutorial:Boolean(options.tutorial)});requestAnimationFrame(frame);
  document.querySelector('#cue-text').textContent=options.tutorial?tutorialHint(state):state.tactical?'': 'DRAG TO BLOCK / RELEASE TO THROW';
}
async function boot(){
  if(lab){menu();return;}
  stop();
  ui.loading(0,0);
  let acceptingProgress=true;
  try{
    const assets=await loadMsuAssets((done,total,phase)=>{if(acceptingProgress)ui.loading(done,total,phase);});
    acceptingProgress=false;
    renderer=createRenderer(canvas,assets,false);audio.configure(assets);
    document.querySelector('#lab-mark').hidden=true;
    menu();
  }catch(error){acceptingProgress=false;ui.assetGap([error.message]);}
}
if(lab){
  // The lab query exposes a read-only inspection API for tests. It is not a
  // player-facing debug mode, so it must not reintroduce diagnostic chrome.
  document.querySelector('#lab-mark').hidden=true;
  // Read-only diagnostics for mechanics investigation, never a cheat API in production.
  window.__kinesis=Object.freeze({inspect:()=>structuredClone({...state,covers:state.covers.map(c=>({...c,body:projectBody(c)})),screen,running})});
}
applySettings();boot();requestAnimationFrame(frame);
