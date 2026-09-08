import * as THREE from 'three';
import { closestPointOnRay } from './picking.js';
import { COSMIC_OBJECTS, LY_KM, PC_KM, OBSERVABLE_RADIUS_KM, galacticPosition, equatorialPosition } from './cosmic-data.js';

function random(seed=7319) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
function cloud(positions,colors,size,texture) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return new THREE.Points(geometry,new THREE.PointsMaterial({size,sizeAttenuation:false,vertexColors:true,map:texture,transparent:true,depthTest:true,depthWrite:false,opacity:.8,blending:THREE.AdditiveBlending,toneMapped:false}));
}
export class CosmicScene {
  constructor(owner) {
    this.owner=owner; this.stars=[]; this.layers={stars:true,galaxies:true,structure:true,labels:true};
    this.nodes=[]; this.targets=[...COSMIC_OBJECTS]; this.starState='pending'; this.magnitudeLimit={value:7}; this.unitPc={value:1/PC_KM};
    const rng=random();
    for(const item of COSMIC_OBJECTS.filter(x=>x.kind==='galaxy')) {
      const p=[],c=[]; const count=item.id==='milky-way'?48000:2200;
      for(let i=0;i<count;i++) {
        const bulge=rng()<.20; const r=Math.pow(rng(),bulge?1.8:.62)*item.radiusLy;
        const arm=i%4; const theta=bulge?rng()*Math.PI*2:arm*Math.PI/2+Math.log(Math.max(.008,r/item.radiusLy))*3.7+(rng()-.5)*.65;
        const thickness=(rng()+rng()+rng()-1.5)*(bulge?item.radiusLy*.24:item.radiusLy*.025)*Math.exp(-r/item.radiusLy);
        let v=[r*Math.cos(theta),r*Math.sin(theta),thickness];
        if(item.id==='milky-way') v=galacticPosition(...v);
        else { const q=new THREE.Vector3(...v).applyEuler(new THREE.Euler(.6+item.dec*.02,item.ra,1)); v=q.toArray(); }
        p.push(...v);
        const warm=bulge||r<item.radiusLy*.2;
        const color=new THREE.Color(warm?'#ffd5a0':i%7===0?'#d1a3ef':'#92bfee');
        color.multiplyScalar(.45+rng()*.7); c.push(color.r,color.g,color.b);
      }
      const node=cloud(p,c,item.id==='milky-way'?2.3:2.1,owner.dotTexture);
      node.scale.setScalar(LY_KM); owner.scene.add(node); this.nodes.push({node,item,layer:'galaxies'});
    }
    // Multiresolution illustrative cosmic web. Every shell is fixed in physical
    // space, deterministic, and labelled as a model rather than measured galaxies.
    for(const [outerLy,innerLy,count] of [[1e9,5e6,35000],[8e9,7e8,26000],[46.5e9,6e9,34000]]) {
      const centers=Array.from({length:170},()=>{
        const r=Math.cbrt(rng())*outerLy, az=rng()*Math.PI*2, z=rng()*2-1;
        return new THREE.Vector3(Math.sqrt(1-z*z)*Math.cos(az)*r,z*r,Math.sqrt(1-z*z)*Math.sin(az)*r);
      });
      if(outerLy===1e9) for(const object of COSMIC_OBJECTS.filter(x=>['cluster','structure'].includes(x.kind)))centers.push(new THREE.Vector3(...object.position).divideScalar(LY_KM));
      const edges=[];
      centers.forEach((a,i)=>centers.map((b,j)=>({b,j,d:a.distanceToSquared(b)})).filter(x=>x.j!==i).sort((a,b)=>a.d-b.d).slice(0,3).forEach(x=>{if(x.j>i)edges.push([a,x.b]);}));
      const p=[],c=[];
      for(let i=0;i<count;i++) {
        const [a,b]=edges[i%edges.length],t=rng();
        const v=a.clone().lerp(b,t); const spread=outerLy*.008;
        v.add(new THREE.Vector3((rng()+rng()-1)*spread,(rng()+rng()-1)*spread,(rng()+rng()-1)*spread));
        if(v.length()<innerLy||v.length()>outerLy)continue;
        p.push(...v.toArray());
        const color=new THREE.Color(t<.12||t>.88?'#ffdc9b':i%3===0?'#8b73db':'#bc96d7');
        color.multiplyScalar(.4+rng()*.6); c.push(color.r,color.g,color.b);
      }
      const node=cloud(p,c,2.4,owner.dotTexture);node.scale.setScalar(LY_KM);owner.scene.add(node);
      this.nodes.push({node,item:{position:[0,0,0],radiusLy:outerLy},layer:'structure',innerLy});
    }
    const boundary=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1,3)),new THREE.LineBasicMaterial({color:'#9a82bf',transparent:true,opacity:.085,depthWrite:false}));
    boundary.scale.setScalar(OBSERVABLE_RADIUS_KM);owner.scene.add(boundary);
    this.nodes.push({node:boundary,item:{position:[0,0,0],radiusLy:46.5e9},layer:'structure',boundary:true});
    for(const item of COSMIC_OBJECTS) {
      const marker=owner.makeCosmicMarker(item);
      this.nodes.push({node:marker,item,layer:item.kind==='galaxy'?'galaxies':'structure',marker:true});
    }
  }
  selectStar(item) {
    if(!this.selectedMarker) {
      this.selectedMarker=this.owner.makeCosmicMarker(item);
      this.selectedLabel=this.owner.labels[this.owner.labels.length-1];
    }
    this.selectedMarker.userData.item=item;
    this.selectedMarker.material.color.set(item.color);
    this.selectedLabel.element.querySelector('strong').textContent=item.name;
    this.selectedLabel.element.querySelector('span').textContent='ESTRELLA HYG';
    this.selectedLabel.id=item.id;
  }
  async loadStars() {
    this.starState='loading';
    try {
      const response=await fetch(`${import.meta.env.BASE_URL}data/stars.json`);
      if(!response.ok)throw new Error('Catálogo HYG no disponible');
      const data=await response.json();
      if(!Array.isArray(data.stars)||data.stars.length<100)throw new Error('Catálogo HYG incompleto');
      const p=[],c=[],absoluteMagnitudes=[];
      this.stars=data.stars.map(row=>{
        const [id,name,ra,dec,pc,mag,spect,ci,lum,hip,hd]=row;
        const position=equatorialPosition(ra,dec,pc*PC_KM);
        p.push(...position.map(v=>v/PC_KM));
        absoluteMagnitudes.push(mag-5*Math.log10(pc)+5);
        const color=new THREE.Color(ci===null?'#d4e5ff':ci<.0?'#91b4ff':ci<.5?'#dce8ff':ci<1?'#fff1d0':ci<1.5?'#ffc080':'#ff9165');
        c.push(color.r,color.g,color.b);
        return {id:`hyg-${id}`,name,aliases:`${hip?'HIP '+hip:''} ${hd?'HD '+hd:''}`,cosmic:true,kind:'star',position,distanceLy:pc*PC_KM/LY_KM,mag,spect,lum,ci,color:'#'+color.getHexString(),viewDistanceKm:Math.max(3e8,.005*LY_KM),source:'HYG v4.1 · época J2000',sourceUrl:'https://github.com/astronexus/HYG-Database',summary:`Estrella del catálogo HYG (Hipparcos, Yale y Gliese). Tipo espectral ${spect||'sin clasificar'}. Distancia de catálogo: ${(pc*PC_KM/LY_KM).toLocaleString('es-ES',{maximumFractionDigits:2})} años luz. El punto es un localizador; no representa el diámetro de la estrella. Las distancias tienen incertidumbre y no se extrapolan con el reloj.`};
      });
      this.starPoints=cloud(p,c,2.0,this.owner.dotTexture);this.starPoints.scale.setScalar(PC_KM);
      this.starPoints.geometry.setAttribute('absoluteMagnitude',new THREE.Float32BufferAttribute(absoluteMagnitudes,1));
      this.starPoints.material.onBeforeCompile=shader=>{
        shader.uniforms.unitPc=this.unitPc;shader.uniforms.magnitudeLimit=this.magnitudeLimit;
        shader.vertexShader='attribute float absoluteMagnitude; uniform float unitPc; uniform float magnitudeLimit; varying float starVisibility;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;',`float pc = max(0.00001,length(mvPosition.xyz)*unitPc);
          float apparent = absoluteMagnitude + 5.0*log(pc)/log(10.0)-5.0;
          starVisibility = 1.0-smoothstep(magnitudeLimit-1.0,magnitudeLimit+0.5,apparent);
          gl_PointSize = clamp((magnitudeLimit-apparent)*0.65+1.0,1.0,6.0);`);
        shader.fragmentShader='varying float starVisibility;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= starVisibility; if (diffuseColor.a < 0.005) discard;');
      };
      this.owner.scene.add(this.starPoints);this.stars.sort((a,b)=>a.distanceLy-b.distanceLy);this.targets.push(...this.stars);this.starState='ready';
    } catch(error) {this.starState='error';console.error(error);}
    return this.stars.length;
  }
  update(origin,distance) {
    this.unitPc.value=this.owner.renderUnit/PC_KM;
    if(this.selectedMarker) {
      this.selectedMarker.position.fromArray(this.selectedMarker.userData.item.position).sub(origin);
      this.selectedMarker.visible=this.layers.stars && this.layers.labels;
    }
    if(this.starPoints) {
      this.starPoints.position.copy(origin).negate();
      this.starPoints.visible=this.layers.stars&&distance<3e5*LY_KM;
      this.starPoints.material.opacity=THREE.MathUtils.clamp(1-distance/(3e5*LY_KM),0,.85);
    }
    for(const entry of this.nodes) {
      const {node,item,layer,marker,boundary,innerLy}=entry;
      node.position.fromArray(item.position).sub(origin);
      const observer=this.owner.camera.position.clone().add(origin);
      const range=observer.distanceTo(new THREE.Vector3(...item.position));
      const region=item.radiusLy*LY_KM;
      node.visible=this.layers[layer] && (marker ? distance>region*.1 && distance<region*150 && this.layers.labels : boundary?distance>OBSERVABLE_RADIUS_KM*.6 : layer==='galaxies'? range>region*.02&&range<region*200 : distance>innerLy*LY_KM*2);
      if(!marker&&!boundary) node.material.opacity=layer==='galaxies'?THREE.MathUtils.clamp(range/region*.75,.03,.85):THREE.MathUtils.clamp(distance/(item.radiusLy*LY_KM)*1.3,0,.75);
    }
  }
  pickPhysical(camera,direction,angle) {
    if(!this.starPoints?.visible)return null;
    return closestPointOnRay(this.stars,x=>x.position,camera,direction,angle,(star,distance)=>{
      const apparent=star.mag+5*Math.log10(Math.max(1e-12,distance/(star.distanceLy*LY_KM)));
      return apparent < this.magnitudeLimit.value+.5;
    });
  }
}
