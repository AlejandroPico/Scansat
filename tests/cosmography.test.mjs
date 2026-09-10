import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { decodeSDSS, CosmicSurveys, MPC_KM } from '../src/cosmic-surveys.js';
import { OrbitalScene } from '../src/scene.js';
import { galaxyPopulation } from '../src/galaxy-model.js';
import { COSMIC_OBJECTS, LY_KM } from '../src/cosmic-data.js';
const root='public/data/cosmography/';
const unpack=async name=>gunzipSync(await readFile(root+name));

test('el catálogo WWT preserva IDs de 64 bits y convierte Mpc/h sin deformar distancias',async()=>{
 const buffer=await unpack('sdss.bin.gz');
 const data=decodeSDSS(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
 const meta=JSON.parse(await readFile(root+'metadata.json'));
 assert.equal(data.count,meta.sdssCount);assert.equal(data.count,431263);
 assert.equal(data.view.getBigUint64(0,true).toString(),'588017626169999506');
 for(let i=0;i<data.count;i+=101){const r=Math.hypot(...data.positions.subarray(i*3,i*3+3));assert.ok(Math.abs(r/(data.view.getFloat32(i*25+16,true)/.73)-1)<1e-6);}
 assert.throws(()=>decodeSDSS(new ArrayBuffer(26)),/truncado/);
});
test('2MRS excluye redshifts no utilizables y conserva una distancia finita creciente',async()=>{
 const rows=JSON.parse(await unpack('2mrs.json.gz'));
 assert.equal(rows.length,43380);assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);
 const sorted=rows.toSorted((a,b)=>a[5]-b[5]);
 assert.ok(sorted.every((r,i)=>r[5]>600&&r[4]>0&&r[2]>=0&&r[2]<=24&&Math.abs(r[3])<=90&&(!i||r[4]>=sorted[i-1][4])));
});
test('CF4 conserva pares de segmentos finitos, pasos físicos y dos poblaciones de flujo',async()=>{
 const buf=await unpack('flows.bin.gz');const a=new Float32Array(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
 assert.equal(a.length%(8),0);assert.ok(a.every(Number.isFinite));
 const labels=new Set();
 for(let i=0;i<a.length;i+=8){labels.add(a[i+3]);assert.equal(a[i+3],a[i+7]);const step=Math.hypot(a[i+4]-a[i],a[i+5]-a[i+1],a[i+6]-a[i+2]);assert.ok(Math.abs(step-2/.75)<.0002);}
 assert.deepEqual([...labels].sort(),[0,1]);
});
test('densidad dentro del horizonte físico y sin ampliar las correlaciones hasta su diámetro',async()=>{
 for(const name of ['density.bin.gz','outer-density.bin.gz']){
  const buf=await unpack(name);const a=new Float32Array(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
  assert.equal(a.length%4,0);assert.ok(a.every(Number.isFinite));
  for(let i=0;i<a.length;i+=4){assert.ok(Math.hypot(a[i],a[i+1],a[i+2])*MPC_KM<=46.5e9*LY_KM*1.000001);assert.ok(a[i+3]>=0&&a[i+3]<=1);}
 }
});
test('la deselección quita la órbita, libera recursos y notifica una única vez',()=>{
 const selectedOrbit=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());let geometries=0,materials=0,notifications=0;
 selectedOrbit.geometry.addEventListener('dispose',()=>geometries++);selectedOrbit.material.addEventListener('dispose',()=>materials++);
 const scene=new THREE.Scene();scene.add(selectedOrbit);
 const owner={selected:{id:'sat'},selectedOrbit,scene,cosmos:{selectedItem:{},selectedMarker:{visible:true}},drawSelectedOrbit:OrbitalScene.prototype.drawSelectedOrbit,onSelect:item=>{assert.equal(item,null);notifications++;}};
 OrbitalScene.prototype.clearSelection.call(owner);
 OrbitalScene.prototype.clearSelection.call(owner,false);
 assert.equal(owner.selected,null);assert.equal(owner.selectedOrbit,null);assert.equal(scene.children.length,0);
 assert.equal(geometries,1);assert.equal(materials,1);assert.equal(notifications,1);assert.equal(owner.cosmos.selectedItem,null);
});
test('los sondeos pueden seleccionarse a gran distancia y se respetan sus capas',()=>{
 const cosmos={owner:{},layers:{}};const surveys=new CosmicSurveys(cosmos);
 const cat={kind:'twoMrs',count:1,node:{visible:true},positions:new Float32Array([0,0,-100]),rows:[['123','NGC 123',0,0,100,7300,10,'3',.8]]};surveys.catalogs=[cat];
 assert.equal(surveys.pick([0,0,0],[0,0,-1],.001).item.id,'2mrs-123');
 cat.node.visible=false;assert.equal(surveys.pick([0,0,0],[0,0,-1],.001),null);
 assert.equal(surveys.search('NGC 123')[0].id,'2mrs-123');
});
test('la población galáctica es reproducible y ocupa tres dimensiones',()=>{
 const item=COSMIC_OBJECTS.find(x=>x.id==='milky-way');const a=galaxyPopulation(item,30000),b=galaxyPopulation(item,30000);
 assert.deepEqual(a.positions,b.positions);assert.ok(a.positions.every(Number.isFinite));
 // Rotation preserves radius; all 3 scene axes must retain spatial extent.
 for(let axis=0;axis<3;axis++){const values=a.positions.filter((_,i)=>i%3===axis);assert.ok(Math.max(...values)-Math.min(...values)>item.radiusLy);}
});
