import * as THREE from 'three';
import { galacticPosition,LY_KM,COSMIC_OBJECTS } from './cosmic-data.js';
import { seededRandom } from './galaxy-model.js';
import { closestPointOnRay } from './picking.js';
const CELL=60,SPAN=3;
const axes=[galacticPosition(1,0,0),galacticPosition(0,1,0),galacticPosition(0,0,1)];
const center=COSMIC_OBJECTS.find(x=>x.id==='milky-way').position.map(v=>v/LY_KM);
export function sectorPopulation(x,y,z){
 const random=seededRandom(Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791));
 const absolute=[(x+.5)*CELL,(y+.5)*CELL,(z+.5)*CELL],delta=absolute.map((v,i)=>v-center[i]);
 const g=axes.map(axis=>axis.reduce((sum,v,i)=>sum+v*delta[i],0));
 const density=Math.exp(-Math.hypot(g[0],g[1])/22000)*Math.exp(-Math.abs(g[2])/1100);
 const count=Math.floor(720*density),stars=[];
 for(let i=0;i<count;i++){
  const position=[(x+random())*CELL,(y+random())*CELL,(z+random())*CELL].map(v=>v*LY_KM);
  const temperature=random(),color=temperature<.65?'#ffbc87':temperature<.91?'#fff0d4':'#b7d3ff';
  stars.push({id:`model-${x}-${y}-${z}-${i}`,name:`Estrella modelada ${x}:${y}:${z}/${i}`,cosmic:true,modeled:true,kind:'star',position,color,viewDistanceKm:.005*LY_KM,source:'Población estadística por sectores',summary:'Punto de exploración generado de forma determinista para representar la inmensidad y el gradiente de densidad de la Vía Láctea. No corresponde a una estrella identificada, una distancia medida o un sistema planetario conocido.'});
 }return stars;
}
export class GalacticSectors {
 constructor(owner){this.owner=owner;this.key='';this.stars=[];this.cache=new Map();this.node=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,map:owner.dotTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));this.node.frustumCulled=false;this.node.scale.setScalar(LY_KM);owner.scene.add(this.node);}
 update(origin,distance,enabled){
  const observer=this.owner.camera.position.clone().add(origin).divideScalar(LY_KM),solDistance=observer.length();
  this.node.visible=enabled&&distance<8000*LY_KM&&solDistance>120&&solDistance<150000;
  if(!this.node.visible)return;
  const cell=observer.toArray().map(v=>Math.floor(v/CELL)),key=cell.join(':');
  if(key!==this.key){
   this.key=key;const stars=[],keep=new Set();
   for(let z=-SPAN;z<=SPAN;z++)for(let y=-SPAN;y<=SPAN;y++)for(let x=-SPAN;x<=SPAN;x++){
    const a=cell[0]+x,b=cell[1]+y,c=cell[2]+z,k=`${a}:${b}:${c}`;keep.add(k);if(!this.cache.has(k))this.cache.set(k,sectorPopulation(a,b,c));stars.push(...this.cache.get(k));
   }
   for(const k of this.cache.keys())if(!keep.has(k))this.cache.delete(k);
   this.stars=stars;const p=[],colors=[];
   this.anchor=new THREE.Vector3(...cell.map(v=>v*CELL));
   for(const star of stars){p.push(...star.position.map((v,i)=>v/LY_KM-this.anchor.getComponent(i)));const c=new THREE.Color(star.color);colors.push(c.r,c.g,c.b);}
   this.node.geometry.dispose();this.node.geometry=new THREE.BufferGeometry();this.node.geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));this.node.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  }
  this.node.position.copy(this.anchor).multiplyScalar(LY_KM).sub(origin);
  this.node.material.opacity=THREE.MathUtils.smoothstep(solDistance,120,350)*(1-THREE.MathUtils.smoothstep(distance/LY_KM,1200,8000))*.65;
  // Spherical fade is observer-relative and smaller than the loaded cube, so
  // cell boundaries never become visible as stars enter/leave the cache.
  this.node.material.onBeforeCompile=shader=>{
   shader.uniforms.sectorUnit={value:this.owner.renderUnit/LY_KM};this.shader=shader;
   shader.vertexShader='uniform float sectorUnit; varying float sectorAlpha;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;',`float d=length(mvPosition.xyz)*sectorUnit;sectorAlpha=1.0-smoothstep(100.0,170.0,d);gl_PointSize=clamp(5.0/pow(max(1.0,d),.24),1.0,4.0);`);
   shader.fragmentShader='varying float sectorAlpha;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=sectorAlpha;');
  };
  if(this.shader)this.shader.uniforms.sectorUnit.value=this.owner.renderUnit/LY_KM;
 }
 pick(camera,direction,angle){return this.node.visible?closestPointOnRay(this.stars,x=>x.position,camera,direction,angle,(_,distance)=>distance<170*LY_KM):null;}
}
