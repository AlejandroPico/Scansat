import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {ATLAS_LAYERS,ATLAS_TARGETS,equatorialBasis} from '../src/atlas-data.js';
import {LayerAtlas} from '../src/atlas-scene.js';
import {CELESTIAL_BODIES,planetPositionAu} from '../src/solar-data.js';
import {LY_KM,PC_KM,galacticPosition} from '../src/cosmic-data.js';
import {entryFor} from '../src/encyclopedia.js';
import {mediaFor} from '../src/encyclopedia-media.js';
const json=async name=>JSON.parse(await readFile('public/data/atlas/'+name,'utf8'));

function fixture(){
 const owner={focus:{type:'body',id:'earth'},showLabels:true,container:{clientHeight:900},textureLoader:{load(url,onLoad){const texture=new THREE.Texture();queueMicrotask(()=>onLoad?.(texture));return texture;}},scene:new THREE.Scene(),dotTexture:null,camera:new THREE.PerspectiveCamera(),renderUnit:1,makeCosmicMarker(item){const sprite=new THREE.Sprite();sprite.userData.item=item;this.scene.add(sprite);return sprite;}};
 const cosmos={owner,targets:[],photos:{sky:new THREE.Object3D()}};const atlas=new LayerAtlas(cosmos);
 atlas.fetch=async(name,binary)=>{const b=await readFile('public/data/atlas/'+name);return binary?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):JSON.parse(b);};
 return {owner,cosmos,atlas};
}
test('las once propuestas tienen destinos, archivos de observación y controles coherentes',async()=>{
 const ids=new Set(ATLAS_TARGETS.map(x=>x.id));assert.equal(ids.size,ATLAS_TARGETS.length);
 for(const layer of ATLAS_LAYERS)assert.ok(ids.has(layer.focus)||CELESTIAL_BODIES.some(b=>b.id===layer.focus));
 for(const item of ATLAS_TARGETS){assert.ok(item.position.every(Number.isFinite));assert.ok(item.radiusLy>0);assert.ok(item.sourceUrl.startsWith('https://'));assert.ok(entryFor(item).body.length>80);}
 const images=await json('image-manifest.json');
 for(const item of [...images.maps,...images.nebulae]){assert.ok((await readFile('public/'+item.file)).length>10000);assert.ok(item.credit.length>15);}
 for(const id of ['orion','crab','helix','abell2744-mass'])assert.ok(mediaFor(entryFor(ATLAS_TARGETS.find(x=>x.id===id))).length);
});
test('los cuerpos menores recorren órbitas elípticas finitas que respetan perihelio y afelio',()=>{
 const bodies=CELESTIAL_BODIES.filter(b=>b.elements);assert.equal(bodies.length,8);
 assert.deepEqual(bodies.filter(b=>b.type==='dwarf').map(b=>b.id).sort(),['ceres','eris','haumea','makemake','pluto']);
 for(const body of bodies){
  for(const year of [1957,2000,2026,2050]){
   const p=planetPositionAu(body.id,new Date(`${year}-06-01T00:00:00Z`)),r=Math.hypot(p.x,p.y,p.z),e=body.elements;
   assert.ok(Number.isFinite(r));assert.ok(r>=e.a*(1-e.e)-1e-6&&r<=e.a*(1+e.e)+1e-6);
  }
 }
});
test('los datos científicos conservan unidades, forma y selección sin fabricar regiones',async()=>{
 const d=await json('desi.json');assert.ok(d.count>10000);assert.equal(d.sources.length,32);assert.equal(d.count,d.rows.length);assert.equal(new Set(d.rows.map(x=>x[0])).size,d.count);
 for(const [id,ra,dec,z,mpc] of d.rows){assert.match(id,/^\d+$/);assert.ok(ra>=0&&ra<360&&Math.abs(dec)<=90&&z>.005&&z<2&&mpc>0);}
 const v=await json('voids.json');assert.equal(v.rows.length,48);assert.ok(v.selection.includes('edge=0'));assert.ok(v.rows.every(x=>x[3]>x[4]&&x[4]>0));
 const streams=await json('streams.json');assert.equal(streams.length,3);assert.ok(streams.every(x=>x.points.length>100&&x.points.every(p=>p.every(Number.isFinite)&&p[2]>0)));
});
test('todas las capas cargan, respetan origen/escala, se apagan y permiten localizar galaxias',async()=>{
 const {owner,atlas}=fixture();
 for(const layer of ATLAS_LAYERS){await atlas.load(layer.id);assert.equal(atlas.states[layer.id],'ready',layer.id+': '+atlas.errors[layer.id]);}
 for(const item of atlas.targets){owner.focus={type:'object',item};owner.camera.position.set(0,0,item.viewDistanceKm);atlas.update(new THREE.Vector3(...item.position),item.viewDistanceKm);
  for(const {node} of atlas.nodes){assert.ok(node.position.toArray().every(Number.isFinite));if(node.geometry?.attributes.position)assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));}
 }
 // Binary loaded through LayerAtlas is transformed from Galactic pc without changing distance.
 const bubble=atlas.nodes.find(x=>x.layer==='bubble'&&!x.marker);assert.equal(bubble.node.scale.x,PC_KM);
 const pos=bubble.node.geometry.attributes.position;assert.ok(Math.hypot(pos.getX(0),pos.getY(0),pos.getZ(0))>69);
 const galaxy=atlas.desiItems[300];owner.focus={item:galaxy};owner.camera.position.set(0,0,1e6*LY_KM);atlas.update(new THREE.Vector3(...galaxy.position),1e6*LY_KM);
 const observer=new THREE.Vector3(...galaxy.position).add(owner.camera.position);const direction=new THREE.Vector3(...galaxy.position).sub(observer).normalize();assert.ok(atlas.pick(observer.toArray(),direction.toArray(),.000001));
 for(const spec of ATLAS_LAYERS)atlas.enabled[spec.id]=false;atlas.update(new THREE.Vector3(),LY_KM);assert.ok(atlas.nodes.every(x=>!x.node.visible));
});
test('el plano observado mira al Sol y el cielo multibanda no viaja a otra galaxia',async()=>{
 const p=ATLAS_TARGETS.find(x=>x.id==='orion').position,b=equatorialBasis(p);
 const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...b.right),new THREE.Vector3(...b.up),new THREE.Vector3(...b.normal));assert.ok(Math.abs(basis.determinant()-1)<1e-10);assert.ok(new THREE.Vector3(...b.normal).dot(new THREE.Vector3(...p).normalize())<-.99999);
 const {owner,atlas}=fixture();atlas.load=async()=>{};
 await atlas.setWavelength('radio');assert.equal(atlas.skyMaps.radio.material.map.repeat.x,-1);owner.camera.position.set(0,0,26000);atlas.update(new THREE.Vector3(),26000);assert.equal(atlas.skyMaps.radio.visible,true);
 atlas.update(new THREE.Vector3(5*LY_KM,0,0),26000);assert.equal(atlas.skyMaps.radio.visible,false);
 await atlas.setWavelength('microwave');assert.ok(atlas.skyMaps.microwave);await atlas.setWavelength('optical');atlas.update(new THREE.Vector3(),26000);assert.ok(Object.values(atlas.skyMaps).every(x=>!x.visible));
});
test('un fallo de imagen conserva otras capas y un reintento no duplica planos',async()=>{
 const {atlas}=fixture();let calls=0;const texture=atlas.texture.bind(atlas);
 atlas.texture=async(file)=>{if(++calls===2)throw new Error('missing image');return texture(file);};
 await atlas.load('nebulae');assert.equal(atlas.states.nebulae,'error');assert.equal(atlas.nodes.filter(x=>x.layer==='nebulae'&&!x.marker).length,0);assert.ok(atlas.nodes.some(x=>x.layer==='clusters'&&!x.marker));
 atlas.texture=texture;await atlas.load('nebulae');assert.equal(atlas.states.nebulae,'ready');assert.equal(atlas.nodes.filter(x=>x.layer==='nebulae'&&!x.marker).length,3);
});
