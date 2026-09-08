// Physical-space picking independent of Three.Points local scale assumptions.
export function closestPointOnRay(items, positionOf, camera, direction, angularRadius, accept=()=>true) {
  let best=null,score=Infinity;
  for(let i=0;i<items.length;i++) {
    const position=positionOf(items[i]);if(!position)continue;
    const dx=position[0]-camera[0],dy=position[1]-camera[1],dz=position[2]-camera[2];
    const along=dx*direction[0]+dy*direction[1]+dz*direction[2];
    if(along<=0)continue;
    const distance2=dx*dx+dy*dy+dz*dz;
    const perpendicular2=Math.max(0,distance2-along*along);
    const angular2=perpendicular2/(along*along);
    if(angular2>angularRadius*angularRadius || angular2>=score || !accept(items[i],Math.sqrt(distance2)))continue;
    score=angular2;best={item:items[i],distance:Math.sqrt(distance2)};
  }
  return best;
}
