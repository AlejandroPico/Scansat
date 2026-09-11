const LY_KM=9.4607304725808e12;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Zoom is exponential in altitude near a body, and in distance in deep space.
// This preserves gradual approach without modifying the physical scene scale.
export function zoomDistance(distance,radius,delta,min,max) {
 const clearance=Math.max(.00001,distance-radius),step=Math.max(-1,Math.min(1,delta/100));
 // Preserve the familiar Solar System response; progressively require more
 // wheel travel across interstellar, galactic and cosmological distances.
 const scale=Math.log10(Math.max(1e-12,clearance/LY_KM));
 const speed=.32-.17*smooth(-1,1,scale)-.06*smooth(2,4,scale)-.035*smooth(5,7,scale);
 const result=radius+clearance*Math.exp(step*(radius && clearance < radius ? .18 : speed));
 return Math.max(min,Math.min(max,result));
}
export function interpolateZoom(current,target,radius,dt) {
 const a=Math.max(.00001,current-radius),b=Math.max(.00001,target-radius);
 return radius+Math.exp(Math.log(a)+(Math.log(b)-Math.log(a))*(1-Math.exp(-dt*15)));
}
