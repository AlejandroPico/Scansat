import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { zoomDistance,interpolateZoom } from '../src/navigation.js';
import { lonLatTile,tileLonLat,earthTileGeometry } from '../src/earth-tiles.js';
import { sectorPopulation } from '../src/galactic-sectors.js';
import { DensityVolume,LOCAL_VOLUME_RADIUS } from '../src/density-volume.js';
import { LY_KM } from '../src/cosmic-data.js';
test('zoom continuo desde horizonte cosmológico a 80 m sin atravesar la Tierra',()=>{
 const radius=6371,min=radius+.08,max=120e9*LY_KM;
 let d=max,previousStep=Infinity;
 for(let i=0;i<500;i++){
  const next=zoomDistance(d,radius,-100,min,max);assert.ok(next>=min&&next<=d);
  if(d-radius<100){assert.ok(d-next<previousStep+1e-6);previousStep=d-next;}
  const intermediate=interpolateZoom(d,next,radius,1/60);assert.ok(intermediate>=next-1e-9&&intermediate<=d+1e-9);d=next;
 }
 assert.equal(d,min);assert.ok(zoomDistance(radius+.1,radius,-100,min,max)>radius+.08);
 assert.ok(Math.abs(zoomDistance(zoomDistance(1e8,0,-40,50,max),0,40,50,max)-1e8)<1e-6);
});
test('teselas Mercator: fecha internacional, polos, continuidad y normales exteriores',()=>{
 assert.deepEqual(lonLatTile(180,90,4),lonLatTile(-180,90,4));
 for(const z of [1,7,19]){
  const n=2**z,x=Math.floor(n*.4),y=Math.floor(n*.35),[lon,lat]=tileLonLat(x+.5,y+.5,z);
  assert.deepEqual(lonLatTile(lon,lat,z),{x,y});
  const a=earthTileGeometry(x,y,z,6371),b=earthTileGeometry(x+1,y,z,6371),p=a.geometry.attributes.position,q=b.geometry.attributes.position;
  const steps=Math.sqrt(p.count)-1;
  for(let row=0;row<=steps;row++){
   const left=new THREE.Vector3().fromBufferAttribute(p,row*(steps+1)+steps).add(a.center),right=new THREE.Vector3().fromBufferAttribute(q,row*(steps+1)).add(b.center);
   assert.ok(left.distanceTo(right)<.0003);
  }
  const normal=new THREE.Vector3().fromBufferAttribute(a.geometry.attributes.normal,0);assert.ok(normal.dot(a.center)>0);
 }
});
test('sectores deterministas, diferenciados y explícitamente modelados',()=>{
 const a=sectorPopulation(10,0,0),b=sectorPopulation(10,0,0),c=sectorPopulation(11,0,0);
 assert.ok(a.length>0);assert.deepEqual(a,b);assert.notDeepEqual(a,c);
 assert.equal(new Set([...a,...c].map(s=>s.id)).size,a.length+c.length);
 assert.ok(a.every(s=>s.modeled&&s.position.every(Number.isFinite)&&s.summary.includes('No corresponde')));
});
test('volúmenes completos, sin cavidad central y con transición de escalas',async()=>{
 const owner={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()};
 for(const [file,n,outer] of [['local-volume.bin.gz',192,false],['cosmic-volume.bin.gz',256,true]]){
  const packed=file==='cosmic-volume.bin.gz'?Buffer.concat(await Promise.all(['cosmic-volume.part1.bin.gz','cosmic-volume.part2.bin.gz'].map(f=>readFile('public/data/cosmography/'+f)))):await readFile('public/data/cosmography/'+file);const data=gunzipSync(packed);assert.equal(data.length,n**3);
  let filled=0;for(const v of data)if(v)filled++;assert.ok(filled/data.length>.8);
  const volume=new DensityVolume(owner,data,n,outer?46.5e9*LY_KM:LOCAL_VOLUME_RADIUS,outer);
  volume.update(new THREE.Vector3(),30e9*LY_KM,true);assert.equal(volume.node.visible,outer);
  volume.update(new THREE.Vector3(),3e9*LY_KM,true);assert.equal(volume.node.visible,!outer);
  volume.update(new THREE.Vector3(),30e9*LY_KM,false);assert.equal(volume.node.visible,false);
 }
});
test('controles reorganizados conservan todos los destinos DOM del código',async()=>{
 const html=await readFile('index.html','utf8'),app=await readFile('src/app.js','utf8');
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const match of app.matchAll(/\$\('#([\w-]+)'\)/g))assert.ok(ids.includes(match[1]),match[1]);
 assert.ok(!html.includes('class="statusbar"'));assert.ok(!ids.includes('utc-clock'));
});
