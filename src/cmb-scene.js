import * as THREE from 'three';
import { galacticPosition,LY_KM } from './cosmic-data.js';
export const CMB_RADIUS_KM=45.5e9*LY_KM;
export class MicrowaveBackground {
 constructor(owner){
  this.owner=owner;this.ready=false;this.opacity=.85;
  const loader=owner.textureLoader||new THREE.TextureLoader();
  const map=loader.load(`${import.meta.env?.BASE_URL||'/'}textures/cmb-wmap-equirectangular.png`,()=>{this.ready=true;},undefined,error=>{this.error=true;console.error('WMAP',error);});map.colorSpace=THREE.SRGBColorSpace;
  const geo=new THREE.SphereGeometry(1,192,96),p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,...galacticPosition(p.getX(i),-p.getZ(i),p.getY(i)));
  this.node=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.FrontSide}));
  this.node.scale.setScalar(CMB_RADIUS_KM);this.node.renderOrder=-80;this.node.visible=false;owner.scene.add(this.node);
 }
 update(origin,distance,enabled){
  const observer=this.owner.camera.position.clone().add(origin),outside=observer.length()>CMB_RADIUS_KM;
  this.node.position.copy(origin).negate();
  this.node.material.side=outside?THREE.FrontSide:THREE.BackSide;
  this.node.material.opacity=this.opacity*THREE.MathUtils.smoothstep(distance/LY_KM,28e9,65e9);
  this.node.visible=enabled&&this.ready&&this.node.material.opacity>.001;
 }
}
