import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EarthTiles } from '../src/earth-tiles.js';
import { MicrowaveBackground,CMB_RADIUS_KM } from '../src/cmb-scene.js';
import { LY_KM,OBSERVABLE_RADIUS_KM } from '../src/cosmic-data.js';
import { makeEncyclopedia } from '../src/encyclopedia.js';
import { mediaFor } from '../src/encyclopedia-media.js';
import { access,readFile } from 'node:fs/promises';
test('el atlas terrestre rellena una tesela ausente con el recorte de su padre',()=>{
 const calls=[],bitmap={width:256,height:256};
 const atlas={context:{clearRect(){},drawImage(...args){calls.push(args);}},canvas:{width:2304,height:1792},tiles:new Map([['esri/mosaic/3/3/3',{bitmap}]]),texture:{},owner:{earthMaterial:{uniforms:{detailBounds:{value:new THREE.Vector4()}}}}};
 EarthTiles.prototype.compose.call(atlas,'esri','mosaic',4,{x:6,y:6});
 assert.equal(calls.length,4);assert.ok(calls.every(c=>c[3]===128&&c[4]===128&&c[7]===256&&c[8]===256));
 assert.equal(atlas.texture.needsUpdate,true);
 assert.deepEqual(atlas.owner.earthMaterial.uniforms.detailBounds.value.toArray(),[2/16,3/16,9/16,7/16]);
});
test('el CMB conserva radio físico, origen observacional y capa independiente',()=>{
 const owner={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),textureLoader:{load(){return new THREE.Texture();}}};
 const cmb=new MicrowaveBackground(owner);cmb.ready=true;
 assert.ok(CMB_RADIUS_KM<OBSERVABLE_RADIUS_KM);assert.ok(CMB_RADIUS_KM>44e9*LY_KM);
 const origin=new THREE.Vector3(1e6,2e6,3e6);owner.camera.position.set(0,0,100e9*LY_KM);
 cmb.update(origin,100e9*LY_KM,true);assert.equal(cmb.node.visible,true);assert.deepEqual(cmb.node.position.toArray(),origin.clone().negate().toArray());assert.equal(cmb.node.material.side,THREE.FrontSide);
 cmb.update(origin,100e9*LY_KM,false);assert.equal(cmb.node.visible,false);
 owner.camera.position.set(0,0,10000);cmb.update(origin,10000,true);assert.equal(cmb.node.visible,false);
});
test('las ilustraciones de la enciclopedia tienen archivo, descripción y atribución',async()=>{
 for(const entry of makeEncyclopedia())for(const media of mediaFor(entry)){
  assert.ok(media.caption&&media.credit);
  if(media.file.startsWith('textures/'))assert.ok((await readFile('scripts/prepare-assets.mjs','utf8')).includes('public/'+media.file));
  else await access('public/'+media.file);
 }
});
