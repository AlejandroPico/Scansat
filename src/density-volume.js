import * as THREE from 'three';
import { physicalShader } from './shader-support.js';
import { LY_KM,PC_KM } from './cosmic-data.js';
// Density is a false-colour statistical field. Integrate through its interior,
// rather than projecting a spherical shell of additive point sprites.
export class DensityVolume {
 constructor(owner,buffer,size,radiusKm,outer) {
  if(buffer.byteLength!==size**3)throw new Error('Volumen de densidad truncado');
  this.owner=owner;this.radius=radiusKm;this.outer=outer;
  const texture=new THREE.Data3DTexture(new Uint8Array(buffer),size,size,size);
  texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  this.uniforms={field:{value:texture},eye:{value:new THREE.Vector3()},strength:{value:0}};
  const material=physicalShader({uniforms:this.uniforms,side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
   vertexShader:`varying vec3 localPoint; void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`precision highp sampler3D; uniform sampler3D field; uniform vec3 eye; uniform float strength; varying vec3 localPoint;
    void main(){
     vec3 ray=normalize(localPoint-eye), inv=1.0/(ray+vec3(1e-8));
     vec3 a=(-vec3(1.0)-eye)*inv,b=(vec3(1.0)-eye)*inv;
     vec3 lo=min(a,b),hi=max(a,b);float begin=max(0.0,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
     if(end<=begin)discard;
     float stepLength=(end-begin)/192.0;
     float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
     vec4 sum=vec4(0.0);
     for(int i=0;i<192;i++){
      vec3 p=eye+ray*(begin+(float(i)+jitter)*stepLength);
      float window=1.0-smoothstep(.57,1.0,length(p));
      float density=texture(field,p*.5+.5).r;
      float emission=pow(max(0.0,density-.035),1.7);
      vec3 color=mix(vec3(.23,.055,.46),vec3(.69,.30,.70),smoothstep(.10,.42,density));
      color=mix(color,vec3(1.0,.72,.24),smoothstep(.40,.78,density));
      float alpha=1.0-exp(-emission*window*stepLength*12.0*strength);
      sum.rgb+=(1.0-sum.a)*alpha*color;sum.a+=(1.0-sum.a)*alpha;
      if(sum.a>.98)break;
     }
     if(sum.a<.001)discard;
     gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
    }`});
  this.node=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);this.node.scale.setScalar(radiusKm);this.node.frustumCulled=false;this.node.renderOrder=-100;owner.scene.add(this.node);
 }
 update(origin,distance,enabled){
  const ly=distance/LY_KM,s=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
  const opacity=this.outer?s(3e9,12e9,ly):s(6e8,2.5e9,ly)*(1-s(5e9,14e9,ly));
  this.uniforms.strength.value=opacity*1.9;this.node.visible=enabled&&opacity>.001;
  this.node.position.copy(origin).negate();this.uniforms.eye.value.copy(this.owner.camera.position).add(origin).divideScalar(this.radius);
 }
}
export const LOCAL_VOLUME_RADIUS=1000e6*PC_KM;
