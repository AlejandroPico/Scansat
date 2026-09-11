import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('public/models/draco',{recursive:true});
for(const file of ['draco_decoder.js','draco_decoder.wasm','draco_wasm_wrapper.js'])await copyFile('node_modules/three/examples/jsm/libs/draco/gltf/'+file,'public/models/draco/'+file);
const models=JSON.parse(await readFile('public/data/craft-models.json','utf8'));
await mkdir('public/models/craft',{recursive:true});
const valid=(data,spec)=>data.length>10000&&data.toString('ascii',0,4)==='glTF'&&(!spec.gitBlobSha||createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')===spec.gitBlobSha);
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<models.length){const spec=models[cursor++],file='public/'+spec.file;
  try{if(valid(await readFile(file),spec))continue;}catch{}
  let error;
  for(let attempt=0;attempt<3;attempt++)try{
   const response=await fetch(spec.url,{signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const data=Buffer.from(await response.arrayBuffer());if(!valid(data,spec))throw Error('GLB inválido o cambió su contenido');
   await writeFile(file,data);console.log(`Modelo preparado: ${spec.id}`);error=null;break;
  }catch(e){error=e;}
  if(error)throw Error(`${spec.id}: ${error.message}`);
 }
}));
