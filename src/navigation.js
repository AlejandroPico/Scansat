// Zoom is exponential in altitude near a body, and in distance in deep space.
// This preserves gradual approach without modifying the physical scene scale.
export function zoomDistance(distance,radius,delta,min,max) {
 const clearance=Math.max(.00001,distance-radius),step=Math.max(-1,Math.min(1,delta/100));
 const result=radius+clearance*Math.exp(step*(radius && clearance < radius ? .18 : .32));
 return Math.max(min,Math.min(max,result));
}
export function interpolateZoom(current,target,radius,dt) {
 const a=Math.max(.00001,current-radius),b=Math.max(.00001,target-radius);
 return radius+Math.exp(Math.log(a)+(Math.log(b)-Math.log(a))*(1-Math.exp(-dt*15)));
}
