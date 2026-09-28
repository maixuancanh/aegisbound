import {sampleAnimation} from './animator.js';

export const CHARACTER_ACTIONS=Object.freeze({idle:'stand1',hold:'alert',throw:'shoot1',hit:'prone',capture:'heal'});
const COMPONENTS=['kinesis-body','kinesis-head','kinesis-uniform','kinesis-shoes','kinesis-wig'];
// MSU z values are back-to-front in descending order. Human ears are selected explicitly.
const omitted=new Set(['ear','lefEar','highlefEar']);
export function createMsuCharacter(ctx,{records,images}){
  const cache=new Map();
  function compose(action,index,expression,faceIndex){
    const key=[action,index,expression,faceIndex].join(':');if(cache.has(key))return cache.get(key);
    const parts=[];
    for(const component of COMPONENTS){
      const frames=records[component].actions[action];
      const frame=frames[Math.min(index,frames.length-1)];
      for(const [name,part] of Object.entries(frame))if(part?.localPath&&!omitted.has(name))parts.push({name,...part});
    }
    const face=records['kinesis-face'].actions[expression]??records['kinesis-face'].actions.default;
    for(const [name,part] of Object.entries(face[Math.min(faceIndex,face.length-1)]))if(part?.localPath)parts.push({name,...part});
    const body=parts.find(p=>p.name==='body'),anchors=new Map(),resolved=[];
    function place(part,offset){
      resolved.push({...part,offset});
      for(const [name,point] of Object.entries(part.map??{}))if(!anchors.has(name))anchors.set(name,{x:offset.x+point.x,y:offset.y+point.y});
    }
    place(body,{x:0,y:0});
    const pending=parts.filter(p=>p!==body);
    // Connected map points join clothes, limbs, head, face and wig without per-pose nudges.
    for(let pass=0;pending.length&&pass<parts.length;pass++){
      let moved=false;
      for(let i=pending.length-1;i>=0;i--){
        const part=pending[i],connection=Object.entries(part.map??{}).find(([name])=>anchors.has(name));
        if(!connection)continue;
        const [name,point]=connection,anchor=anchors.get(name);
        place(part,{x:anchor.x-point.x,y:anchor.y-point.y});pending.splice(i,1);moved=true;
      }
      if(!moved)break;
    }
    // The lHand track exposes a root-relative handMove marker rather than a skeletal join.
    for(const part of pending)if(part.name==='lHand'&&part.map?.handMove)place(part,{x:0,y:0});
    resolved.sort((a,b)=>(Number(b.z)||0)-(Number(a.z)||0));cache.set(key,resolved);return resolved;
  }
  return {
    draw(x,y,scale,pose,tick,settings){
      const action=CHARACTER_ACTIONS[pose.action],frames=records['kinesis-body'].actions[action];
      const {index}=sampleAnimation(frames,pose.elapsedMs,{loop:pose.action==='idle'||pose.action==='hold'});
      const blink=tick%240>=225;
      const expression=pose.action==='hit'?'hit':pose.action==='capture'?'smile':blink?'blink':'default';
      const faceIndex=expression==='blink'?Math.floor((tick%240-225)/5):0;
      const parts=compose(action,index,expression,faceIndex);
      ctx.save();ctx.translate(x,y);ctx.scale(pose.facing===1?-scale:scale,scale);
      if(pose.action==='hit'&&!settings.reducedFlash)ctx.globalAlpha=.75;
      for(const part of parts){const image=images.get(part.localPath);if(image)ctx.drawImage(image,part.offset.x-part.origin.x,part.offset.y-part.origin.y);}
      ctx.restore();
    }
  };
}
