// World positions remain on the floor. Lift is only a view-space displacement.
const CAMERA=Object.freeze({x:960*.476,y:540*.665,shear:.12,compress:.64,depth:.00065});
export function projectGround({x,y}) {
  const dy=y-300,scale=1+dy*CAMERA.depth;
  return {x:CAMERA.x+(x-480)*scale+dy*CAMERA.shear,y:CAMERA.y+dy*CAMERA.compress,scale};
}
export function unprojectGround({x,y}) {
  const dy=(y-CAMERA.y)/CAMERA.compress,scale=1+dy*CAMERA.depth;
  return {x:480+(x-CAMERA.x-dy*CAMERA.shear)/scale,y:300+dy};
}
export function projectBody(entity) {
  const floor=projectGround(entity);
  return {...floor,y:floor.y-(entity.lift??0)*floor.scale};
}
export function unprojectBody({x,y},lift=54) {
  const dy=(y-CAMERA.y+lift)/(CAMERA.compress-lift*CAMERA.depth),scale=1+dy*CAMERA.depth;
  return {x:480+(x-CAMERA.x-dy*CAMERA.shear)/scale,y:300+dy};
}
export function depthOrder(entities) {
  return [...entities].sort((a,b)=>a.y-b.y||String(a.id).localeCompare(String(b.id)));
}
export function pickCover(covers,point,tolerance=24) {
  return depthOrder(covers).reverse().find(c=>{
    const p=projectBody(c);
    return ['orbit','held'].includes(c.status)&&Math.hypot(p.x-point.x,p.y-point.y)<=tolerance;
  })?.id??null;
}
