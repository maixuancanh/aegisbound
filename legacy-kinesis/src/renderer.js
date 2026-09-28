import {projectGround,projectBody,depthOrder} from './projection.js';
import {createMsuScene} from './msu-scene.js';
import {createActorAnimator} from './animator.js';
import {createVfx} from './vfx.js';
import {createRescueScene} from './rescue-scene.js';
import {throwPower} from './cover.js';
import {tacticalThrowAim} from './tactics.js';
import {drawStage,stageKey} from './stage-layout.js';
import {assetUrl} from './msu-assets.js';
const CYAN='#69edff',RED='#ff655f';
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(ctx,a,b,color,width=1,dash=[]){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
}
export function createRenderer(canvas,assets={},lab=false){
  const ctx=canvas.getContext('2d');
  const animator=createActorAnimator();
  const msu=assets.records?createMsuScene(ctx,assets,animator):null;
  const effects=msu?createVfx(ctx,assets):null;
  const rescueScene=assets.records?createRescueScene(ctx,assets):null;
  // This is a perspective-painted arena plate. Keep it separate from the
  // pixel-art sprite pass so browser/canvas scaling cannot make the ground
  // look like a flat, low-resolution texture.
  const artBackdrop=new Image();artBackdrop.src=assetUrl('assets/artgen/kinesis-arena-v2.png');
  const stageImages=assets.stageImages??{};
  let damageTick=-1000,generation=null;
  function labFloor(){
    ctx.fillStyle='#162132';ctx.fillRect(0,0,960,540);
    // Calibration grid only: not production environment artwork.
    for(let y=-60;y<=660;y+=40)line(ctx,projectGround({x:-100,y}),projectGround({x:1060,y}),'#2b4057');
    for(let x=-100;x<=1060;x+=40)line(ctx,projectGround({x,y:-60}),projectGround({x,y:660}),'#2b4057');
    ctx.fillStyle='#0c1320';ctx.fillRect(0,0,960,118);
    ctx.fillStyle='#a3b3c5';ctx.font='12px monospace';ctx.fillText('2.5D PROJECTION / GROUND-DEPTH CALIBRATION',22,108);
  }
  function body(entity){
    const p=projectBody(entity),size=entity.id==='player'?72:48*p.scale;
    const image=assets[entity.appearance??entity.kind??'kinesis'];
    if(image){ctx.drawImage(image,p.x-size/2,p.y-size,size,size);return;}
    if(!lab)return;
    ctx.strokeStyle=entity.id==='player'?'#eee8dd':entity.enemy?'#ecbd81':CYAN;
    ctx.lineWidth=2;
    if(entity.enemy){
      ctx.strokeRect(p.x-size/2,p.y-size,size,size);
      ctx.fillStyle='#c4d7df';ctx.font='11px monospace';
      ctx.textAlign='center';ctx.fillText(entity.archetype,p.x,p.y-size-6);ctx.textAlign='left';
    }else if(entity.id==='player'){
      ctx.strokeRect(p.x-16,p.y-48,32,48);ctx.beginPath();ctx.arc(p.x,p.y-61,12,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.globalAlpha=entity.status==='returning'?.6:1;
      ctx.strokeRect(p.x-22,p.y-22,44,44);
      line(ctx,{x:p.x-22,y:p.y-22},{x:p.x-10,y:p.y-34},CYAN);
      line(ctx,{x:p.x-10,y:p.y-34},{x:p.x+34,y:p.y-34},CYAN);
      line(ctx,{x:p.x+34,y:p.y-34},{x:p.x+22,y:p.y-22},CYAN);
      line(ctx,{x:p.x+34,y:p.y-34},{x:p.x+34,y:p.y+10},CYAN);
      line(ctx,{x:p.x+34,y:p.y+10},{x:p.x+22,y:p.y+22},CYAN);
      ctx.fillStyle=CYAN;ctx.font='10px monospace';ctx.textAlign='center';
      ctx.fillText(entity.appearance,p.x,p.y+4);ctx.textAlign='left';ctx.globalAlpha=1;
    }
  }
  return {
    events(events,state){
      if(generation!==state.generation){generation=state.generation;damageTick=-1000;}
      animator.accept(events,state);effects?.accept(events,state);
      if(events.some(e=>e.type==='damage'))damageTick=state.tick;
    },
    draw(state,settings={}){
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
      const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      ctx.setTransform(width/960,0,0,height/540,0,0);ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,960,540);
      ctx.save();
      const hurtAge=state.tick-damageTick;
      if(generation===state.generation&&!settings.reducedMotion&&hurtAge>=0&&hurtAge<12){
        const amplitude=2*(1-hurtAge/12);ctx.translate(Math.sin(hurtAge*2.4)*amplitude,Math.cos(hurtAge*1.7)*amplitude);
      }
      const stageImage=stageImages[stageKey(state)];
      if(stageImage&&drawStage(ctx,stageImage,960,540)){
        ctx.imageSmoothingEnabled=false;
      } else if(artBackdrop.complete&&artBackdrop.naturalWidth){
        ctx.imageSmoothingEnabled=true;
        ctx.drawImage(artBackdrop,0,0,960,540);
        ctx.imageSmoothingEnabled=false;
      }
      else if(msu)msu.backdrop(state,settings);
      else if(assets.environment)ctx.drawImage(assets.environment,0,0,960,540);
      else if(lab)labFloor();else{ctx.fillStyle='#111720';ctx.fillRect(0,0,960,540);}
      // The cab is scene infrastructure, not combat cover: paint it before the
      // enemy pass so neither taxi nor its passengers can conceal a threat.
      if(state.rescue?.van?.visible)rescueScene?.body({...state.rescue.van,id:'rescue-vehicle',rescueVehicle:true,lift:0},state,settings);
      const player={...state.player,id:'player',lift:0,kind:'kinesis'};
      for(const enemy of state.enemies.filter(e=>e.telegraph)){
        const tele=enemy.telegraph,start=projectBody({...tele.origin,lift:54});
        const progress=Math.min(1,(state.tick-tele.startedAt)/(tele.fireAt-tele.startedAt));
        ctx.strokeStyle=settings.highContrast?'#fff':RED;ctx.lineWidth=3;ctx.beginPath();ctx.arc(start.x,start.y,11,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();
        if(tele.target){
          const target=projectBody({...tele.target,lift:10}),radius=11+3*Math.sin(state.tick*.4);
          ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(target.x,target.y-5,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        }
      }
      const covers=state.covers.filter(c=>c.status!=='spent');
      const entities=[...state.enemies.map(e=>({...e,enemy:true,lift:26})),player,...covers,
        ...state.projectiles.map(p=>({...p,id:'shot-'+p.id,lift:54,projectile:true})),...(msu?.scenery(state)??[]),...(rescueScene?.entities(state)??[])];
          for(const entity of entities){
            if(entity.projectile||entity.scenery)continue;
            const floor=projectGround(entity);
            ellipse(ctx,floor.x,floor.y,entity.id==='player'?23:22*floor.scale,7*floor.scale,'#02081388');
          }
      for(const cover of covers.filter(c=>c.status==='held')){
          const tacticalAim=state.tactical?tacticalThrowAim(player,cover,state.aim):null;
          const dx=tacticalAim?.direction.x??((cover.x-player.x)/(Math.hypot(cover.x-player.x,cover.y-player.y)||1));
          const dy=tacticalAim?.direction.y??((cover.y-player.y)/(Math.hypot(cover.x-player.x,cover.y-player.y)||1));
          const power=tacticalAim?.power??throwPower(state.aim,player);
          const start=projectBody(cover);
          const travel=tacticalAim?.guideDistance??44+power*296;
          const throwGuideTip=projectBody({x:cover.x+dx*travel,y:cover.y+dy*travel,lift:54});
          line(ctx,start,throwGuideTip,CYAN,1,[3,6]);
          const angle=Math.atan2(throwGuideTip.y-start.y,throwGuideTip.x-start.x);
          for(const side of [-1,1])line(ctx,throwGuideTip,{x:throwGuideTip.x-5*Math.cos(angle+side*.55),y:throwGuideTip.y-5*Math.sin(angle+side*.55)},CYAN,1);
      }
      for(const entity of depthOrder(entities)){
        if(entity.civilian||entity.rescueRelay)rescueScene?.body(entity,state,settings);
        else if(msu)msu.body(entity,state,settings);
        else if(entity.projectile){const q=projectBody(entity);ellipse(ctx,q.x,q.y,7,7,RED);ellipse(ctx,q.x,q.y,3,3,'#fff3d1');}
        else body(entity);
      }
      if(state.replayDiagnostics){
        ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#ffd56a';ctx.lineWidth=1;ctx.setLineDash([3,4]);
        for(const shot of state.projectiles){const from=projectBody(shot),to=projectBody({x:shot.x+shot.vx*.45,y:shot.y+shot.vy*.45,lift:54});line(ctx,from,to,'#ffd56a',1,[3,4]);}
        ctx.restore();
      }
      effects?.draw(state,settings);
      if(assets.foreground)ctx.drawImage(assets.foreground,0,0,960,540);
      else if(lab){
        // Explicit calibration occluders. Replaced by art when final layers exist.
        ctx.fillStyle='#172c3f';ctx.fillRect(0,452,95,88);ctx.fillRect(875,452,85,88);
        ctx.strokeStyle='#548499';ctx.strokeRect(0,452,95,88);ctx.strokeRect(875,452,85,88);
      }
      ctx.restore();
    }
  };
}
