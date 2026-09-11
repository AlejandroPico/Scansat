import test from 'node:test';
import assert from 'node:assert/strict';
import {craftSpec,craftMinDistance} from '../src/craft-models.js';
import {prepareRecord} from '../src/catalog.js';
import {readFile} from 'node:fs/promises';
test('Hubble se identifica por NORAD, sin atribuir su modelo a Hubble 6/7',()=>{
 const h=prepareRecord({OBJECT_NAME:'HST',NORAD_CAT_ID:20580},{});
 assert.match(h.name,/Hubble/);assert.match(h.aliases,/HST/);assert.equal(craftSpec(h).id,'hubble');
 assert.equal(craftSpec({id:'999999',name:'HUBBLE 6'}),null);
 assert.equal(craftSpec({name:'STARLINK-1234',id:'1'}).id,'starlink-family');
 assert.equal(craftSpec({name:'STARLINK-1234',id:'1',isDebris:true}),null);
});
test('modelos reutilizados, escala cercana y referencias exactas',async()=>{
 const models=JSON.parse(await readFile('public/data/craft-models.json'));
 assert.equal(new Set(models.flatMap(x=>x.ids)).size,models.flatMap(x=>x.ids).length);
 assert.equal(craftSpec({id:'voyager-1'}),craftSpec({id:'voyager-2'}));
 for(const m of models){assert.ok(m.url.startsWith('https://'));assert.ok(m.sourceUrl.startsWith('https://'));assert.ok(m.extentMeters>0);assert.ok(craftMinDistance({id:m.ids[0]})<1);}
});
