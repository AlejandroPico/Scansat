import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {nebulaItems,nebulaImageUrl} from '../src/nebula-catalog.js';
import {craftSpec} from '../src/craft-models.js';
import {PC_KM} from '../src/cosmic-data.js';
import {entryFor} from '../src/encyclopedia.js';
const data=JSON.parse(gunzipSync(await readFile('public/data/atlas/nebula-catalog.json.gz')));
const items=nebulaItems(data);
test('catálogos conservan coordenadas, selección y ausencia de distancia',()=>{
 assert.equal(items.length,10704);assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 assert.equal(items.filter(x=>!x.noLocation&&x.confirmed).length,1972);
 for(const item of items){
  assert.ok(item.raDeg>=0&&item.raDeg<360&&Math.abs(item.decDeg)<=90);
  if(item.noLocation){assert.equal(item.position,undefined);assert.equal(entryFor(item).noLocation,true);}
  else{assert.ok(Math.abs(Math.hypot(...item.position)/PC_KM-item.distancePc)<1e-8);if(item.reliability!=null)assert.ok(item.reliability>.8);}
 }
});
test('distancias de Gaia son parsecs y el campo DSS mantiene el centro del catálogo',()=>{
 const ring=items.find(x=>x.name.includes('NGC 6720'));
 assert.ok(ring.distancePc>789&&ring.distancePc<791);assert.ok(ring.lowerPc<ring.distancePc&&ring.upperPc>ring.distancePc);
 const q=new URL(nebulaImageUrl(ring)).searchParams;
 assert.equal(Number(q.get('ra')),ring.raDeg);assert.equal(Number(q.get('dec')),ring.decDeg);assert.equal(q.get('projection'),'TAN');assert.equal(q.get('rotation_angle'),'0');
 assert.ok(ring.radiusLy>0&&ring.radiusLy<1);
});
test('fotografías destacadas existen y las candidatas no se confunden con confirmadas',async()=>{
 for(const item of items.filter(x=>x.image)){const b=await readFile('public/'+item.image);assert.equal(b[0],255);assert.equal(b[1],216);assert.ok(b.length>10000);assert.equal(item.noLocation,false);}
 assert.ok(items.some(x=>!x.confirmed&&!x.noLocation));assert.ok(items.some(x=>x.noLocation&&x.publishedDistancePc));
});
test('modelos de superficie enlazan los vehículos GCAT reales, no sus componentes',async()=>{
 const data=JSON.parse(await readFile('public/data/exploration.json'));
 const expected={D00807:'mer',D00815:'mer',D00911:'curiosity',D01038:'perseverance',D00997:'insight'};
 for(const [id,model] of Object.entries(expected)){
  const item=data.sites.find(x=>x.id.startsWith('gcat-landing-'+id+'-'));
  assert.ok(item);assert.equal(craftSpec(item).id,model);assert.equal(craftSpec({...item,component:true}),null);assert.equal(craftSpec({...item,noLocation:true}),null);
 }
 assert.equal(craftSpec({id:'gcat-landing-D01000-345',name:'InSight cruise stage',body:'mars',component:true}),null);
});
