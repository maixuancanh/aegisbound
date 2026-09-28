export const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
export const angleDelta = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function segmentCircleTime(a,b,c,r) {
  const x=a.x-c.x,y=a.y-c.y,dx=b.x-a.x,dy=b.y-a.y;
  const cc=x*x+y*y-r*r;
  if(cc<=0)return 0;
  const aa=dx*dx+dy*dy;
  if(aa<1e-16)return null;
  const bb=2*(x*dx+y*dy),disc=bb*bb-4*aa*cc;
  if(disc<0)return null;
  const t=(-bb-Math.sqrt(disc))/(2*aa);
  return t>=0&&t<=1?t:null;
}
export function circleSweep(a0,a1,ar,b0,b1,br) {
  return segmentCircleTime({x:a0.x-b0.x,y:a0.y-b0.y},
    {x:a1.x-b1.x,y:a1.y-b1.y},{x:0,y:0},ar+br);
}
