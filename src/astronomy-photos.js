import * as THREE from 'three';
import { galacticPosition,equatorialPosition,LY_KM,COSMIC_OBJECTS } from './cosmic-data.js';
export class AstronomyPhotos {
 constructor(owner){
  this.owner=owner;this.ready={sky:false,andromeda:false};
  const loader=owner.textureLoader||new THREE.TextureLoader();
  const load=(file,key)=>{const t=loader.load(`${(import.meta.env?.BASE_URL||'/')}textures/${file}`,()=>{this.ready[key]=true;},undefined,error=>console.error('Fotografía astronómica',file,error));t.colorSpace=THREE.SRGBColorSpace;return t;};
  const geometry=new THREE.SphereGeometry(1,96,64),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const a=galacticPosition(p.getX(i),-p.getZ(i),p.getY(i));p.setXYZ(i,...a);}geometry.computeVertexNormals();
  this.sky=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:load('milky-way-eso0932a.jpg','sky'),side:THREE.BackSide,depthWrite:false,depthTest:true,transparent:true,opacity:0,toneMapped:false}));
  this.sky.frustumCulled=false;this.sky.renderOrder=-300;owner.scene.add(this.sky);
  this.item=COSMIC_OBJECTS.find(x=>x.id==='andromeda');
  const material=new THREE.MeshBasicMaterial({map:load('andromeda-full-dss2.jpg','andromeda'),transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
    vec2 q=vMapUv-vec2(.5);float major=dot(q,normalize(vec2(-.55,.84))),minor=dot(q,normalize(vec2(.84,.55)));
    float r=length(vec2(major/.57,minor/.21));
    diffuseColor.a*=(1.0-smoothstep(.48,1.0,r))*smoothstep(.002,.04,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
  `);};
  this.andromeda=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  const center=new THREE.Vector3(...this.item.position),normal=center.clone().normalize().negate();
  const north=new THREE.Vector3(...equatorialPosition(this.item.ra,this.item.dec+.01,1)).sub(center.clone().normalize()).normalize();
  const right=new THREE.Vector3().crossVectors(north,normal).normalize();north.crossVectors(normal,right).normalize();
  this.andromeda.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,north,normal));this.andromeda.rotateZ(THREE.MathUtils.degToRad(1.9));
  const width=2*this.item.distanceLy*LY_KM*Math.tan(THREE.MathUtils.degToRad(362/60)/2);
  this.andromeda.scale.set(width,width*2587/4000,1);this.normal=normal;owner.scene.add(this.andromeda);
 }
 update(origin,distance,layers){
  const observer=this.owner.camera.position.clone().add(origin),s=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
  this.sky.material.opacity=(1-s(100,1000,observer.length()/LY_KM))*.8;
  this.sky.visible=layers.sky&&this.ready.sky&&this.sky.material.opacity>.001;
  this.sky.position.copy(this.owner.camera.position);this.sky.scale.setScalar(Math.max(distance*3,LY_KM*100));
  this.andromeda.position.fromArray(this.item.position).sub(origin);
  const delta=observer.clone().sub(new THREE.Vector3(...this.item.position)),range=delta.length()/LY_KM;
  this.photoOpacity=s(.78,.97,delta.normalize().dot(this.normal))*s(this.item.radiusLy*.7,this.item.radiusLy*2,range)*(1-s(this.item.radiusLy*50,this.item.radiusLy*120,range));
  if(!layers.galaxies||!this.ready.andromeda)this.photoOpacity=0;
  this.andromeda.material.opacity=this.photoOpacity;this.andromeda.visible=this.photoOpacity>.001;
 }
}
