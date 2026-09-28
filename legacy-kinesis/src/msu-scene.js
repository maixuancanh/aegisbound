import {projectGround,projectBody} from './projection.js';
import {createMsuCharacter} from './msu-character.js';
import {enemyVisualProfile,visualFrameTiming} from './content/roster.js';

const MOB={Drifter:'kerning-bubbling',Spitter:'kerning-octopus',Looper:'kerning-stirge',Warden:'kerning-necki',
  slime:'kerning-bubbling',octopus:'kerning-octopus',bat:'kerning-stirge',snail:'kerning-necki'};
function frameAt(frames,tick,loop=true){
  if(!frames?.length)return null;
  const delay=f=>Math.max(16,Math.abs(f.delay??120)),duration=frames.reduce((sum,f)=>sum+delay(f),0);
  let time=tick*1000/60;if(loop)time%=duration;else time=Math.min(time,duration-1);
  for(const frame of frames){time-=delay(frame);if(time<0)return frame;}return frames.at(-1);
}
export function createMsuScene(ctx,assets,animator){
  const {map,records,images}=assets;
  const character=records['kinesis-body']?createMsuCharacter(ctx,assets):null;
  const roof=records['roof-environment']?.layers,observatory=records['observatory-environment']?.layers;
  const named=(layers,group,id)=>layers?.objects.find(o=>o.placement.l1===group&&o.placement.l2===String(id))?.frames[0];
  const bgFrame=(layers,no)=>layers?.backgrounds.find(b=>b.placement.no===no)?.frames[0];
  const object=path=>map.objects.find(o=>o.frames[0]?._path===path)?.frames[0];
  const props={
    // Legacy physics IDs remain stable; rendered props retain their MSU provenance.
    crate:object('Map/Obj/acc2/metroCity/artificiality/10/0.png'),
    stone:object('Map/Obj/acc2/metroCity/artificiality/17/0.png'),
    sign:object('Map/Obj/acc2/metroCity/artificiality/26/0.png'),
  };
  const tileFrames=[...new Map(map.tiles.filter(t=>t.dependency==='Map/Tile/brownBrick.json'&&t.placement.u==='bsc').map(t=>[t.frames[0].localPath,t.frames[0]])).values()];
  function blit(frame,x,y,{scale=1,opacity=1,center=false,flip=false}={}){
    const img=images.get(frame?.localPath);if(!img)return;
    ctx.save();ctx.globalAlpha*=opacity;ctx.translate(x,y);ctx.scale(flip?-scale:scale,scale);
    ctx.drawImage(img,center?-img.width/2:-(frame.origin?.x??img.width/2),center?-img.height/2:-(frame.origin?.y??img.height));ctx.restore();
  }
  function rect(frame,x,y,w,h,opacity=1){const img=images.get(frame?.localPath);if(!img)return;
    ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(img,x,y,w,h);ctx.restore();}
  function triangle(img,points,matrix){ctx.save();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.clip();ctx.transform(...matrix);ctx.drawImage(img,0,0);ctx.restore();}
  function floorTile(frame,x,y){
    const img=images.get(frame?.localPath);if(!img)return;
    const a=projectGround({x,y}),b=projectGround({x:x+90,y}),c=projectGround({x:x+90,y:y+60}),d=projectGround({x,y:y+60});
    triangle(img,[a,b,d],[(b.x-a.x)/img.width,(b.y-a.y)/img.width,(d.x-a.x)/img.height,(d.y-a.y)/img.height,a.x,a.y]);
    triangle(img,[b,c,d],[(c.x-d.x)/img.width,(c.y-d.y)/img.width,(c.x-b.x)/img.height,(c.y-b.y)/img.height,b.x+d.x-c.x,b.y+d.y-c.y]);
  }
  const buildings=['house4','house3','house6','house7'].map(h=>object(`Map/Obj/houseMC/${h}/basic/0/0.png`));
  function skyline(layers){
    rect(bgFrame(layers,72),0,0,960,310);
    for(let i=0;i<3;i++)rect(bgFrame(layers,75),i*400,8,415,255,.85);
    blit(bgFrame(layers,74),790,84,{scale:1.2,center:true});
    for(let i=0;i<2;i++)rect(bgFrame(layers,76),i*520,65,528,138,.85);
    for(let i=0;i<2;i++)rect(bgFrame(layers,77),i*620-80,80,629,165,.9);
  }
  return {
    backdrop(state,settings){
      const bg=n=>map.backgrounds.find(b=>!b.placement.ani&&b.placement.no===n)?.frames[0];
      const arena=state.arena??0;
      if(arena===0){
        rect(bg(0),0,0,960,540);rect(bg(2),0,-35,960,510,.72);
        buildings.forEach((frame,i)=>rect(frame,-95+i*290,-60,350,285));
      }else skyline(arena===1?roof:observatory);
      // The same floor projection used for bodies, picking and throw directions.
      const surface=arena===1?named(roof,'roofTile',0):arena===2?named(observatory,'classTile',1):null;
      for(let row=0;row<12;row++)for(let col=0;col<16;col++)floorTile(surface??tileFrames[(row*3+col)%tileFrames.length],-240+col*90,-40+row*60);
      if(arena===1){
        rect(named(roof,'roofObj',0),-45,-105,240,307);
        rect(named(roof,'roofObj',1),790,-100,250,287);
        for(let i=0;i<8;i++)rect(named(roof,'roofObj',3),i*130-20,147,132,62);
      }else if(arena===2){
        rect(named(observatory,'classWall',0),-35,-120,430,385);
        rect(named(observatory,'classWall',2),585,-120,410,385);
        rect(named(observatory,'science',2),315,122,295,113);
      }
    },
    scenery(state){
      if(state.arena===1)return [
        {id:'roof-left',x:35,y:470,lift:0,scenery:true,frame:named(roof,'roofObj',2),size:90},
        {id:'roof-right',x:985,y:470,lift:0,scenery:true,frame:named(roof,'roofObj',4),size:75},
      ];
      if(state.arena===2)return [
        {id:'lab-left',x:25,y:435,lift:0,scenery:true,frame:named(observatory,'science',0),size:170},
        {id:'lab-right',x:995,y:435,lift:0,scenery:true,frame:named(observatory,'science',4),size:205},
      ];
      return [];
    },
    body(entity,state,settings){
      const p=projectBody(entity),tick=state.tick;
      if(entity.scenery){blit(entity.frame,p.x,p.y,{scale:entity.size/(entity.frame?.height??1)*p.scale});return;}
      if(entity.id==='player'){
        if(character)character.draw(p.x,p.y,1.15*p.scale,animator.pose(state),tick,settings);
        else {const f=records['kinesis-npc'].actions.stand[0];blit(f,p.x,p.y,{scale:90/f.height*p.scale});}
        return;
      }
      if(entity.projectile)return;
      const profile=entity.enemy?enemyVisualProfile(entity):null;
      const key=profile?.key??entity.capturedVisualKey??MOB[entity.archetype??entity.capturedArchetype??entity.appearance??entity.kind],record=records[key];
      if(record){
        const timing=profile?visualFrameTiming(profile,entity,tick):{action:entity.telegraph?'attack1':'move',frameTick:tick,loop:true};
        const action=timing.action;
        // A missing attack action is an explicit code-motion fallback, never a
        // fabricated alias to stand. Source move/fly remains the visual base.
        const frames=(action&&record.actions[action])??record.actions.move??record.actions.fly??record.actions.stand;
        const f=frameAt(frames,settings.reducedMotion?0:timing.frameTick,timing.loop);
        const scale=Math.min(1.5,56/Math.max(f?.width??56,f?.height??56))*p.scale;
        const fallbackLift=profile?.fallback&&entity.telegraph&&!settings.reducedMotion?Math.sin(tick*.55)*3:0;
        blit(f,p.x,p.y+fallbackLift,{scale,center:!entity.enemy,opacity:entity.status==='returning' ? .6 : 1,flip:entity.enemy&&entity.x<480});
      }else{
        const f=props[entity.appearance??entity.kind];
        blit(f,p.x,p.y,{scale:52/Math.max(f?.width??52,f?.height??52)*p.scale,center:true,opacity:entity.status==='returning' ? .6 : 1});
      }
    }
  };
}
