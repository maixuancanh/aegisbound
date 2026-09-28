import {unprojectGround} from './projection.js';

// Stage blueprints are authored in image-normalized coordinates. Convert them
// once into world space so projected actor feet sit on the painted entrances,
// roads and taxi lane rather than an arbitrary simulation grid.
const at=(u,v)=>Object.freeze(unprojectGround({x:u*960,y:v*540}));
const STAGES=Object.freeze({
  rescue:'quick-rescue',
  'trial:0':'hold-line',
  'trial:1':'counter-chain',
  'trial:2':'last-shelter',
  challenge:'challenges',
  practice:'practice'
});

const PROFILES=Object.freeze({
  'quick-rescue':{
    player:at(.48,.66),
    enemyEntries:[at(.344,.355),at(.655,.315),at(.85,.35)],
    enemyApproaches:[at(.4,.48),at(.62,.48),at(.78,.46)],
    civilianRoutes:[
      [at(.09,.64),at(.26,.67),at(.49,.66),at(.7,.64),at(.79,.64)],
      [at(.1,.27),at(.18,.44),at(.29,.52),at(.48,.58),at(.7,.64),at(.79,.64)]
    ],
    taxi:{in:at(.99,.64),dock:at(.83,.64),clearRadius:150}
  },
  'hold-line':{
    player:at(.49,.64),
    enemyEntries:[at(.18,.36),at(.83,.36),at(.1,.62),at(.9,.64)],
    enemyApproaches:[at(.3,.45),at(.7,.45),at(.27,.65),at(.74,.65)],
    civilianRoutes:[],
    relaySockets:[at(.344,.516),at(.643,.516),at(.5,.701)]
  },
  'counter-chain':{
    player:at(.48,.66),
    enemyEntries:[at(.272,.3),at(.502,.3),at(.725,.3),at(.09,.42),at(.91,.42)],
    enemyApproaches:[at(.32,.44),at(.5,.45),at(.68,.44),at(.23,.52),at(.79,.52)],
    civilianRoutes:[]
  },
  'last-shelter':{
    player:at(.48,.65),
    enemyEntries:[at(.26,.32),at(.4,.305),at(.67,.33)],
    enemyApproaches:[at(.33,.41),at(.48,.42),at(.67,.45)],
    civilianRoutes:[
      [at(.1,.48),at(.29,.47),at(.39,.42),at(.56,.45),at(.72,.57),at(.79,.6)],
      [at(.1,.5),at(.23,.68),at(.4,.79),at(.66,.78),at(.74,.67),at(.79,.6)]
    ],
    taxi:{in:at(.99,.6),dock:at(.83,.6),clearRadius:150}
  },
  challenges:{player:at(.48,.66),enemyEntries:[at(.295,.27),at(.5,.27),at(.687,.27),at(.12,.4),at(.87,.4)],enemyApproaches:[at(.33,.42),at(.5,.43),at(.65,.42),at(.28,.52),at(.74,.52)],civilianRoutes:[]},
  practice:{player:at(.48,.66),enemyEntries:[at(.324,.3),at(.5,.3),at(.68,.3),at(.16,.39),at(.84,.39)],enemyApproaches:[at(.33,.44),at(.5,.44),at(.65,.44),at(.26,.53),at(.74,.53)],civilianRoutes:[]}
});

export function stageKey(state={}){
  if(state.mode==='trial')return STAGES[`trial:${state.arena??0}`]??'hold-line';
  return STAGES[state.mode]??'practice';
}

export function stageProfileFor(state={}){
  const profile=PROFILES[stageKey(state)]??PROFILES.practice;
  return structuredClone(profile);
}

export function drawStage(ctx,image,width=960,height=540){
  if(!image?.naturalWidth||!image.naturalHeight)return false;
  const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  return true;
}
