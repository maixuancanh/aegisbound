import {projectBody} from './projection.js';

function frameAt(frames,tick){
  if(!frames?.length)return null;
  const duration=frames.reduce((sum,frame)=>sum+Math.max(30,frame.delay??120),0);
  let time=tick*1000/60%duration;
  for(const frame of frames){time-=Math.max(30,frame.delay??120);if(time<0)return frame;}
  return frames.at(-1);
}
export function createRescueScene(ctx,assets){
  const {records,images}=assets;
  function civilianMarker(entity,state){
    if(!['moving','sheltered','lost'].includes(entity.status))return;
    const p=projectBody(entity),pulse=.74+.26*Math.sin(state.tick*.14+entity.variant);
    const color=entity.status==='lost'?'#ff6b66':entity.stranded?'#ffc55f':entity.status==='sheltered'?'#67eaff':'#5ff0ff';
    ctx.save();ctx.globalAlpha=.72*pulse;ctx.strokeStyle=color;ctx.lineWidth=1.4;
    ctx.beginPath();ctx.ellipse(p.x,p.y-2,15*p.scale,5*p.scale,0,0,Math.PI*2);ctx.stroke();
    if(entity.stranded){
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p.x,p.y-48*p.scale);ctx.lineTo(p.x-4*p.scale,p.y-40*p.scale);ctx.lineTo(p.x+4*p.scale,p.y-40*p.scale);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  function blit(record,action,entity,state,{opacity=1,flip=false,yOffset=0,filter=''}={}){
    const frames=record?.actions?.[action]??record?.actions?.stand;
    const frame=frameAt(frames,state.tick),image=images.get(frame?.localPath);
    if(!frame||!image)return;
    const p=projectBody(entity),height=record.render?.height??62;
    const scale=height/(record.render?.referenceHeight??frame.height)*p.scale;
    ctx.save();ctx.globalAlpha=opacity;if(filter)ctx.filter=filter;ctx.translate(p.x,p.y+yOffset);ctx.scale(flip?-scale:scale,scale);
    ctx.drawImage(image,-(frame.origin?.x??image.width/2),-(frame.origin?.y??image.height));
    ctx.restore();
  }
  return {
    entities(state){
      if(!state.rescue)return [];
      const r=state.rescue,items=[];
      for(const npc of r.npcs)if(!['waiting','boarded'].includes(npc.status)&&
        (npc.status!=='lost'||state.tick-(npc.lostAt??0)<36))
        items.push({...npc,civilian:true,lift:0});
      if(r.relay)items.push({...r.relay,rescueRelay:true,lift:0});
      return items;
    },
    body(entity,state,settings){
      if(entity.civilian){
        const record=records['rescue-civilian-'+(entity.variant%3)];
        civilianMarker(entity,state);
        const boarding=entity.status==='boarding';
        const lost=entity.status==='lost',fade=lost?Math.max(0,1-(state.tick-(entity.lostAt??state.tick))/36):1;
        const hurt=(entity.hurtUntil??0)>state.tick,working=(entity.workUntil??0)>state.tick;
        // Boarding, injury and specialist work are explicitly code motion over
        // verified walk/idle source actions; they are not mislabeled as MSU
        // source animation states that the civilian records do not contain.
        const yOffset=working?Math.sin(state.tick*.8)*2:boarding?Math.sin(state.tick*.5)*1.5:0;
        blit(record,entity.status==='moving'||entity.status==='to-vehicle'?'move':'stand',entity,state,{opacity:lost?fade:boarding?.45:entity.status==='sheltered'?.82:1,flip:entity.facing==='right',yOffset,filter:hurt?'sepia(1) saturate(2.4) hue-rotate(325deg)':working?'drop-shadow(0 0 5px #70eaff)':''});
      }else if(entity.rescueVehicle){
        blit(records['rescue-vehicle'],'stand',entity,state,{flip:entity.facing==='right'});
      }else if(entity.rescueRelay)blit(records['rescue-relay'],'stand',entity,state);
    }
  };
}
