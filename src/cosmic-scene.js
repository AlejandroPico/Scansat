import { LayerAtlas } from './atlas-scene.js';
import * as THREE from 'three';
import { MicrowaveBackground } from './cmb-scene.js';
import { GalacticSectors } from './galactic-sectors.js';
import { AstronomyPhotos } from './astronomy-photos.js';
import { galaxyPopulation } from './galaxy-model.js';
import { CosmicSurveys } from './cosmic-surveys.js';
import { closestPointOnRay } from './picking.js';
import { COSMIC_OBJECTS, LY_KM, PC_KM, equatorialPosition } from './cosmic-data.js';

function cloud(positions,colors,size,texture) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return new THREE.Points(geometry,new THREE.PointsMaterial({size,sizeAttenuation:false,vertexColors:true,map:texture,transparent:true,depthTest:true,depthWrite:false,opacity:.8,blending:THREE.AdditiveBlending,toneMapped:false}));
}
export class CosmicScene {
  constructor(owner) {
    this.owner=owner; this.stars=[]; this.layers={stars:true,galaxies:true,structure:true,labels:true,sdss:true,twoMrs:true,flows:true,sky:true,population:true,cmb:true};
    this.nodes=[]; this.targets=[...COSMIC_OBJECTS]; this.starState='pending'; this.magnitudeLimit={value:8.5}; this.unitPc={value:1/PC_KM};
    this.surveys=new CosmicSurveys(this);
    this.cmb=new MicrowaveBackground(owner);this.photos=new AstronomyPhotos(owner);this.sectors=new GalacticSectors(owner);
    this.atlas=new LayerAtlas(this);
    for(const item of COSMIC_OBJECTS.filter(x=>x.kind==='galaxy')) {
      const count=item.id==='milky-way'?900000:item.id==='andromeda'?80000:18000;
      const {positions,colors}=galaxyPopulation(item,count);
      if(item.id==='milky-way')for(let i=0;i<colors.length;i++)colors[i]*=.62;
      const node=cloud(positions,colors,item.id==='milky-way'?1.9:2.2,owner.dotTexture);
      node.scale.setScalar(LY_KM); owner.scene.add(node); this.nodes.push({node,item,layer:'galaxies'});
      const hazePositions=[],hazeColors=[];
      for(let i=0;i<positions.length;i+=(item.id==='milky-way'?54:18)){hazePositions.push(...positions.subarray(i,i+3));hazeColors.push(...colors.subarray(i,i+3));}
      const haze=cloud(hazePositions,hazeColors,1,owner.dotTexture);
      haze.material.onBeforeCompile=shader=>{
        shader.uniforms.galaxyUnit={value:LY_KM};
        shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;',`gl_PointSize=clamp(${(item.radiusLy*.022).toFixed(3)}*projectionMatrix[1][1]*600.0/max(.0001,length(mvPosition.xyz)/length(modelMatrix[0].xyz)),1.0,90.0);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>',`vec2 q=gl_PointCoord*2.0-1.0;float r=dot(q,q);diffuseColor.a*=exp(-r*6.0)*(1.0-smoothstep(.65,1.0,r))*.028;`);
      };
      haze.scale.setScalar(LY_KM);owner.scene.add(haze);this.nodes.push({node:haze,item,layer:'galaxies'});
    }
    for(const item of COSMIC_OBJECTS.filter(x=>x.kind!=='cmb')) {
      const marker=owner.makeCosmicMarker(item);
      this.nodes.push({node:marker,item,layer:item.kind==='galaxy'?'galaxies':'structure',marker:true});
    }
  }
  selectStar(item) {
    this.selectedItem=item;
    if(!this.selectedMarker) {
      this.selectedMarker=this.owner.makeCosmicMarker(item);
      this.selectedLabel=this.owner.labels[this.owner.labels.length-1];
    }
    this.selectedMarker.userData.item=item;
    this.selectedMarker.material.color.set(item.color);
    this.selectedLabel.element.querySelector('strong').textContent=item.name;
    this.selectedLabel.element.querySelector('span').textContent=item.kind==='star'?(item.modeled?'ESTRELLA MODELADA':'ESTRELLA HYG'):'GALAXIA CATALOGADA';
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
    this.surveys.update(origin,distance);
    this.photos.update(origin,distance,this.layers);
    this.cmb.update(origin,distance,this.layers.cmb);
    this.sectors.update(origin,distance,this.layers.population&&this.layers.stars);
    this.atlas.update(origin,distance);
    if(this.selectedMarker) {
      this.selectedMarker.position.fromArray(this.selectedMarker.userData.item.position).sub(origin);
      this.selectedMarker.visible=!!this.selectedItem && (!this.selectedItem.atlasLayer || this.atlas.enabled[this.selectedItem.atlasLayer]) && this.layers.labels && this.layers[this.selectedItem.kind==='star'?'stars':'galaxies'];
    }
    if(this.starPoints) {
      this.starPoints.position.copy(origin).negate();
      this.starPoints.visible=this.layers.stars&&distance<12000*LY_KM;
      this.starPoints.material.opacity=.85*(1-THREE.MathUtils.smoothstep(distance/LY_KM,500,12000));
    }
    for(const entry of this.nodes) {
      const {node,item,layer,marker}=entry;
      node.position.fromArray(item.position).sub(origin);
      const observer=this.owner.camera.position.clone().add(origin);
      const range=observer.distanceTo(new THREE.Vector3(...item.position));
      const region=item.radiusLy*LY_KM;
      node.visible=this.layers[layer] && (marker ? distance>region*.1 && distance<region*150 && this.layers.labels : range<region*100);
      if(!marker) {
        node.material.opacity=THREE.MathUtils.smoothstep(range/region,.003,.20)*(1-THREE.MathUtils.smoothstep(range/region,12,100))*.8;
        if(item.id==='andromeda')node.material.opacity*=1-this.photos.photoOpacity;
        if(item.id==='milky-way'&&this.photos.sky.visible)node.material.opacity*=1-this.photos.sky.material.opacity;
      }

    }
  }
  pickPhysical(camera,direction,angle) {
    const hits=[];
    const atlasHit=this.atlas.pick(camera,direction,angle);if(atlasHit)hits.push(atlasHit);
    const modeled=this.sectors.pick(camera,direction,angle);if(modeled)hits.push(modeled);
    const galaxy=this.surveys.pick(camera,direction,angle);
    if(galaxy)hits.push(galaxy);
    if(this.starPoints?.visible) {
      const star=closestPointOnRay(this.stars,x=>x.position,camera,direction,angle,(star,distance)=>{
        const apparent=star.mag+5*Math.log10(Math.max(1e-12,distance/(star.distanceLy*LY_KM)));
        return apparent < this.magnitudeLimit.value+.5;
      });
      if(star)hits.push(star);
    }
    return hits.sort((a,b)=>a.distance-b.distance)[0]||null;
  }
}
