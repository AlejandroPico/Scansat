import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { LY_KM, PC_KM, COSMIC_OBJECTS, renderingUnit, equatorialPosition, galacticPosition, segmentOccluded, SCALE_STOPS } from '../src/cosmic-data.js';
import { CosmicScene } from '../src/cosmic-scene.js';
import { closestPointOnRay } from '../src/picking.js';
import { physicalShader } from '../src/shader-support.js';
import { makeEncyclopedia } from '../src/encyclopedia.js';

test('el cambio de unidad mantiene tamaños angulares y distancias desde kilómetros a Giga años luz',()=>{
 for(const distance of [26000,1e8,LY_KM,1e6*LY_KM,120e9*LY_KM]) {
  const unit=renderingUnit(distance);
  const camera=new THREE.PerspectiveCamera(44,1,.0001,1e9);camera.position.z=distance/unit;camera.updateMatrixWorld();
  const point=new THREE.Vector3(distance*.1/unit,0,0).project(camera);
  assert.ok(Math.abs(point.x-.1/Math.tan(22*Math.PI/180))<1e-12);
  assert.ok(Number.isFinite(point.z));
 }
});
test('las transformaciones astronómicas conservan longitudes y orientan el centro galáctico',()=>{
 const eq=equatorialPosition(0,0,PC_KM);assert.ok(Math.abs(eq[0]-PC_KM)<.01);
 assert.ok(Math.abs(Math.hypot(...equatorialPosition(7,-70,9*LY_KM))/(9*LY_KM)-1)<1e-12);
 const gc=new THREE.Vector3(...galacticPosition(1,0,0)).normalize();
 const actual=new THREE.Vector3(...equatorialPosition(17.7603,-28.936,1)).normalize();
 assert.ok(gc.dot(actual)>.99999);
});
test('la Tierra oculta marcadores y etiquetas tras ella, sin ocultar los delanteros',()=>{
 assert.equal(segmentOccluded([0,0,26000],[0,0,-9000],[0,0,0],6378),true);
 assert.equal(segmentOccluded([0,0,26000],[0,0,9000],[0,0,0],6378),false);
 assert.equal(segmentOccluded([0,0,26000],[12000,0,-9000],[0,0,0],6378),false);
});
test('selección angular a cualquier escala y rechazo de objetos detrás de la cámara',()=>{
 for(const k of [1,LY_KM,1e9*LY_KM]) {
  const objects=[{id:'front',p:[0,0,-k]},{id:'behind',p:[0,0,k]},{id:'aside',p:[k,0,-k]}];
  assert.equal(closestPointOnRay(objects,x=>x.p,[0,0,0],[0,0,-1],.01).item.id,'front');
 }
});
test('materiales personalizados comparten la codificación logarítmica de Three',()=>{
 const m=physicalShader({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main() {gl_FragColor=vec4(1.0);}'});
 assert.ok(m.vertexShader.includes('#include <logdepthbuf_pars_vertex>'));
 assert.ok(m.vertexShader.includes('#include <logdepthbuf_vertex>'));
 assert.ok(m.fragmentShader.includes('#include <logdepthbuf_fragment>'));
 for(const source of [m.vertexShader,m.fragmentShader])for(const [,chunk] of source.matchAll(/#include <([^>]+)>/g))assert.ok(THREE.ShaderChunk[chunk],chunk);
 m.dispose();
});
test('catálogos estelar e histórico no inventan distancias ni lugares desconocidos',async()=>{
 const stars=JSON.parse(await readFile('public/data/stars.json','utf8'));
 assert.equal(stars.count,stars.stars.length);assert.ok(stars.count>100000);
 assert.equal(new Set(stars.stars.map(s=>s[0])).size,stars.count);
 assert.ok(stars.stars.every(s=>s[4]>0&&s[4]<100000&&Number.isFinite(s[2])&&Number.isFinite(s[3])));
 const gcat=JSON.parse(await readFile('public/data/exploration.json','utf8'));
 assert.ok(gcat.missions.length>400);assert.ok(gcat.sites.length>400);
 assert.equal(new Set(gcat.missions.map(s=>s.id)).size,gcat.missions.length);
 assert.ok(gcat.sites.filter(s=>!s.noLocation).every(s=>s.body&&Number.isFinite(s.lat)&&Math.abs(s.lat)<=90&&Number.isFinite(s.lon)));
 const entries=makeEncyclopedia([...gcat.missions,...gcat.sites]);
 assert.equal(new Set(entries.map(s=>s.id)).size,entries.length);
 assert.ok(entries.every(e=>e.body&&e.facts&&e.sourceUrl));
});
test('las capas cósmicas tienen geometría finita y destinos para toda la navegación',()=>{
 const owner={textureLoader:{load(){return new THREE.Texture();}},scene:new THREE.Scene(),dotTexture:null,camera:new THREE.PerspectiveCamera(),renderUnit:1,makeCosmicMarker(item){const sprite=new THREE.Sprite();sprite.userData.item=item;this.scene.add(sprite);return sprite;}};
 const cosmos=new CosmicScene(owner);
 cosmos.atlas.load=async()=>{};
 cosmos.surveys.loadCatalog=async()=>{};cosmos.surveys.loadFlows=async()=>{};cosmos.surveys.loadDensity=async()=>{};
 for(const stop of SCALE_STOPS.filter(s=>!['earth','sun'].includes(s.id)))assert.ok(COSMIC_OBJECTS.some(s=>s.id===stop.id));
 for(const distance of [26000,40*LY_KM,200000*LY_KM,900e6*LY_KM,120e9*LY_KM]) {
  owner.camera.position.set(0,0,distance);cosmos.update(new THREE.Vector3(),distance);
  for(const {node} of cosmos.nodes) {
   assert.ok(node.position.toArray().every(Number.isFinite));
   if(node.geometry?.attributes.position)assert.ok(node.geometry.attributes.position.array.every(Number.isFinite));
  }
 }
 assert.ok(cosmos.nodes.every(x=>!x.boundary));
 assert.equal(cosmos.magnitudeLimit.value,8.5);
});
