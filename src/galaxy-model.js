import * as THREE from 'three';
import { galacticPosition } from './cosmic-data.js';
export function seededRandom(seed=7319) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
const TAU=Math.PI*2;
// Population model, not a fabricated star catalogue. Exponential interarm disk,
// thick disk, bar/bulge, irregular young arms and a sparse old stellar halo.
export function galaxyPopulation(item, count) {
 const rng=seededRandom(7319+Math.round(item.ra*1901));
 const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,rng())))*Math.cos(TAU*rng());
 const p=new Float32Array(count*3),c=new Float32Array(count*3);
 const elliptical=['m87','centaurus-a'].includes(item.id),irregular=['lmc','smc','m82'].includes(item.id);
 const rotation=new THREE.Euler(.6+item.dec*.02,item.ra,1),vector=new THREE.Vector3();
 const warm=new THREE.Color('#ffe0b0'),old=new THREE.Color('#e1c6a1'),young=new THREE.Color('#b7d5f5');
 for(let i=0;i<count;i++) {
  const population=rng();let x,y,z,color,brightness;
  if(elliptical || population<.19) {
   const radius=(-Math.log(Math.max(1e-9,rng()))*(elliptical?.21:.065))*item.radiusLy;
   const az=rng()*TAU,cos=rng()*2-1,sin=Math.sqrt(1-cos*cos);
   x=radius*sin*Math.cos(az)*(elliptical?1:2.7);y=radius*sin*Math.sin(az);z=radius*cos*(elliptical?.78:.7);
   if(!elliptical){const angle=.48,a=x;x=a*Math.cos(angle)-y*Math.sin(angle);y=a*Math.sin(angle)+y*Math.cos(angle);}
   color=warm;brightness=.25+rng()*.3;
  } else if(population>.988) {
   const radius=item.radiusLy*(.2+Math.pow(rng(),.7)*1.4),az=rng()*TAU,cos=rng()*2-1;
   x=radius*Math.sqrt(1-cos*cos)*Math.cos(az);y=radius*Math.sqrt(1-cos*cos)*Math.sin(az);z=radius*cos;
   color=old;brightness=.045;
  } else {
   const r=-Math.log(Math.max(1e-9,rng()*rng()))*.22;
   let theta=rng()*TAU;
   const youngArm=population>.77&&!irregular;
   if(youngArm) {
    const arm=Math.floor(rng()*4);
    theta=arm*Math.PI/2+Math.log(Math.max(.055,r))*3.5+normal()*(.20+.20*r)+.16*Math.sin(r*27+arm*2);
   }
   x=r*item.radiusLy*Math.cos(theta);y=r*item.radiusLy*Math.sin(theta);
   const thick=population>.64&&population<.77;
   z=normal()*item.radiusLy*(thick?.026:.0065)+Math.sin(theta-.3)*Math.max(0,r-.55)**2*item.radiusLy*.10;
   if(irregular){x+=Math.sin(y/item.radiusLy*12)*item.radiusLy*.10;z*=3;}
   // Attenuation follows irregular narrow dust lanes within the luminous disk;
   // it never removes the entire interarm stellar population.
   const phase=4*(theta-Math.log(Math.max(.055,r))*3.5-.15*Math.sin(r*27));
   const dust=Math.exp(-Math.pow(Math.sin(phase*.5)/.23,2))*.55;
   brightness=(youngArm?.23:.15)*(1-dust)*( .65+rng()*.7);
   brightness*=Math.exp(-Math.max(0,r-.55)*1.7);
   color=youngArm?young:old;
  }
  vector.set(x,y,z);
  if(item.id==='milky-way')vector.fromArray(galacticPosition(x,y,z));else vector.applyEuler(rotation);
  vector.toArray(p,i*3);c[i*3]=color.r*brightness;c[i*3+1]=color.g*brightness;c[i*3+2]=color.b*brightness;
 }
 return {positions:p,colors:c};
}
