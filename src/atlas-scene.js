import * as THREE from 'three';
import { ATLAS_LAYERS, ATLAS_TARGETS, seeded, equatorialBasis } from './atlas-data.js';
import { LY_KM, PC_KM, equatorialPosition, galacticPosition } from './cosmic-data.js';
import { AU_KM } from './solar-data.js';
import { closestPointOnRay } from './picking.js';
import imageManifest from '../public/data/atlas/image-manifest.json' with {type:'json'};
import {nebulaItems,nebulaImageUrl} from './nebula-catalog.js';

const base=()=>import.meta.env?.BASE_URL||'/';
const vector=a=>new THREE.Vector3(...a);
const gal=a=>galacticPosition(...a);
const clamp=THREE.MathUtils.clamp;
export class LayerAtlas {
 constructor(cosmos){
  this.cosmos=cosmos;this.owner=cosmos.owner;
  this.enabled=Object.fromEntries(ATLAS_LAYERS.map(x=>[x.id,x.defaultEnabled!==false]));
  this.states=Object.fromEntries(ATLAS_LAYERS.map(x=>[x.id,'pending']));
  this.errors={};this.nodes=[];this.targets=ATLAS_TARGETS.map(x=>({...x,position:[...x.position]}));
  this.cosmos.targets.push(...this.targets);this.opacity=.7;this.wavelength='optical';this.skyMaps={};this.massMode='overlay';this.massBackground='optical';this.massMix=.6;this.desiItems=[];
  this.createClusters();this.createFermi();this.createSolarRegions();
  this.states.minor='ready';
  for(const item of this.targets)this.addMarker(item);
  this.nebulaItems=[];this.nebulaImages=new Map();this.nebulaImagePending=new Set();this.nebulaImageErrors=new Set();
  if(typeof window!=='undefined')this.loadNebulaCatalog().catch(error=>{this.errors.nebulaCatalog=String(error);this.changed();});
 }
 changed(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('atlas-change'));}
 target(id){return this.targets.find(x=>x.id===id);}
 enable(id){if(!(id in this.enabled))return;this.enabled[id]=true;this.load(id);this.changed();}
 register(item){
  const old=this.target(item.id);
  if(old){Object.assign(old,item);return old;}
  this.targets.push(item);this.cosmos.targets.push(item);this.addMarker(item);return item;
 }
 addMarker(item){const node=this.owner.makeCosmicMarker(item);this.nodes.push({node,item,layer:item.atlasLayer,marker:true});}
 add(node,layer,item,opacity=1){this.owner.scene.add(node);this.nodes.push({node,layer,item,opacity});return node;}
 points(positions,colors,size=2,physicalSize=0){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const m=new THREE.PointsMaterial({size,sizeAttenuation:false,vertexColors:!!colors,color:colors?'#ffffff':'#9ccbdc',map:this.owner.dotTexture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
  if(physicalSize)m.onBeforeCompile=s=>{
   s.uniforms.atlasFocal={value:Math.min(1600,this.owner.container?.clientHeight||800)};
   s.vertexShader='uniform float atlasFocal;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('gl_PointSize = size;',`float range=length(mvPosition.xyz)/max(1e-20,length(modelMatrix[0].xyz));gl_PointSize=clamp(${physicalSize.toFixed(5)}*projectionMatrix[1][1]*atlasFocal/max(.001,range),1.0,64.0);`);
  };
  const node=new THREE.Points(g,m);node.frustumCulled=false;return node;
 }
 async fetch(name,binary=false){const r=await fetch(`${base()}data/atlas/${name}`);if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);return binary?r.arrayBuffer():r.json();}
 async load(id){
  if(this.states[id]==='ready'||this.states[id]==='loading')return;
  this.states[id]='loading';delete this.errors[id];this.changed();
  try{
   if(id==='bubble')await this.loadBubble();
   else if(id==='dust')await this.loadDust();
   else if(id==='streams')await this.loadStreams();
   else if(id==='voids')await this.loadVoids();
   else if(id==='desi')await this.loadDesi();
   else if(id==='nebulae')await this.loadNebulae();
   else if(id==='mass')await this.loadMass();
   this.states[id]='ready';
  }catch(error){this.states[id]='error';this.errors[id]=error.message;console.error('Capa astronómica',id,error);}
  this.changed();
 }
 async loadBubble(){
  const [a,b]=await Promise.all([this.fetch('local-bubble-positions.f32',true),this.fetch('local-bubble-triangles.u32',true)]);
  const raw=new Float32Array(a),p=new Float32Array(raw.length),indices=new Uint32Array(b);
  if(raw.length%3||indices.some(i=>i>=raw.length/3))throw new Error('Superficie de la Burbuja Local inválida');
  for(let i=0;i<raw.length;i+=3)p.set(gal(raw.subarray(i,i+3)),i);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(new THREE.BufferAttribute(indices,1));g.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({color:'#8bbfc0',transparent:true,opacity:.04,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const node=new THREE.Mesh(g,material);node.scale.setScalar(PC_KM);this.add(node,'bubble',this.target('local-bubble'),.07);
  // Soft silhouette on the measured surface, without a dotted mesh overlay.
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 bubbleNormal; varying vec3 bubbleView;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nbubbleNormal=normalize(normalMatrix*normal);bubbleView=-mvPosition.xyz;');
   shader.fragmentShader='varying vec3 bubbleNormal; varying vec3 bubbleView;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat rim=1.0-abs(dot(normalize(bubbleNormal),normalize(bubbleView)));diffuseColor.a*=0.12+0.88*pow(rim,2.2);');
  };
 }
 async loadDust(){
  const raw=new Float32Array(await this.fetch('nearby-dust-points.f32',true));if(raw.length%4)throw new Error('Polvo truncado');
  const p=[],c=[];
  for(let i=0;i<raw.length;i+=4){p.push(...gal(raw.subarray(i,i+3)));const v=clamp(Math.log1p(raw[i+3])/3,0,1);const col=new THREE.Color().setRGB(.20+.32*v,.085+.20*v,.025+.075*v);c.push(col.r,col.g,col.b);}
  const node=this.points(p,c,2,26);
  node.material.blending=THREE.NormalBlending;
  const compile=node.material.onBeforeCompile;
  node.material.onBeforeCompile=shader=>{
   compile(shader);
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>','vec2 q=gl_PointCoord*2.0-1.0;float r=dot(q,q);diffuseColor.a*=exp(-r*4.5)*(1.0-smoothstep(.55,1.0,r));');
  };
  node.scale.setScalar(PC_KM);this.add(node,'dust',this.target('local-dust'),.12);
 }
 async loadStreams(){
  const data=await this.fetch('streams.json');
  for(const stream of data){
   const p=stream.points.map(([ra,dec,kpc])=>equatorialPosition(ra/15,dec,kpc*1000));
   if(p.length<2)throw new Error('Corriente sin distancias');
   const center=p[Math.floor(p.length/2)].map(x=>x*PC_KM),radius=Math.max(...p.map(x=>Math.hypot(...x.map((v,i)=>v*PC_KM-center[i]))))/LY_KM;
   const item=this.register({id:stream.id,name:'Corriente '+stream.name,atlasLayer:'streams',kind:'stellar-stream',cosmic:true,position:center,distanceLy:Math.hypot(...center)/LY_KM,radiusLy:radius,viewDistanceKm:radius*LY_KM*2.5,color:'#d4b6ff',source:stream.source,sourceUrl:stream.sourceUrl,evidence:'Catálogo',summary:stream.note+' Marco ICRS; distancias heliocéntricas en kpc. No evoluciona con el reloj.'});
   // Do not bridge gaps or wrap-around breaks in the published track.
   const segments=[];
   for(let i=1;i<p.length;i++)if(vector(p[i]).distanceTo(vector(p[i-1]))<1500)segments.push(...p[i-1],...p[i]);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
   const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:item.color,transparent:true,depthWrite:false,opacity:.8}));line.scale.setScalar(PC_KM);line.userData.relative=false;this.add(line,'streams',null,.8);
   const dots=this.points(p.flat(),null,2);dots.material.color.set(item.color);dots.scale.setScalar(PC_KM);this.add(dots,'streams',null,.5);
  }
 }
 createClusters(){
  const rng=seeded(311),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-8,rng())))*Math.cos(2*Math.PI*rng());
  for(const item of this.targets.filter(x=>x.atlasLayer==='clusters')){
   const p=[],c=[],count=item.profile==='globular'?8000:450;
   for(let i=0;i<count;i++){
    let x,y,z,r;
    do{x=normal();y=normal();z=normal();r=Math.hypot(x,y,z);}while(r<1e-8);
    const a=item.profile==='globular'?Math.min(.98,.07/Math.sqrt(Math.pow(Math.max(.001,rng()),-2/3)-1)):Math.cbrt(rng());
    p.push(x/r*a*item.radiusLy,y/r*a*item.radiusLy,z/r*a*item.radiusLy);
    const col=new THREE.Color(item.profile==='open'?(rng()<.8?'#a6c6ff':'#ffdaa9'):(rng()<.7?'#ffe0aa':'#c4d5ff'));const b=.45+rng()*.55;c.push(col.r*b,col.g*b,col.b*b);
   }
   const node=this.points(p,c,2.5);node.scale.setScalar(LY_KM);this.add(node,'clusters',item,.85);
  }
  this.states.clusters='ready';
 }
 createFermi(){
  const basis=new THREE.Matrix4().makeBasis(vector(gal([1,0,0])),vector(gal([0,1,0])),vector(gal([0,0,1])));
  for(const sign of [-1,1]){
   const g=new THREE.SphereGeometry(1,64,40);const node=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:sign>0?'#ba8fdf':'#8e9fde',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
   node.quaternion.setFromRotationMatrix(basis);node.scale.set(3000*PC_KM,3000*PC_KM,5000*PC_KM);
   const center=galacticPosition(8178*PC_KM,0,sign*5000*PC_KM);
   this.add(node,'fermi',{...this.target('fermi-bubbles'),position:center},.11);
  }
  this.states.fermi='ready';
 }
 createSolarRegions(){
  const rng=seeded(723),p=[],c=[];
  const ring=(count,min,max,height,color,scatter=false)=>{
   const pos=[],col=[],tint=new THREE.Color(color);
   for(let i=0;i<count;i++){
    const angle=rng()*Math.PI*2;let r=min+(max-min)*rng();
    if(scatter){const e=.35+rng()*.45,a=55+rng()*75;r=a*(1-e*e)/(1+e*Math.cos(angle));}
    pos.push(r*Math.cos(angle),(rng()-.5)*height*(scatter?r/60:1),-r*Math.sin(angle));col.push(tint.r,tint.g,tint.b);
   }
   const node=this.points(pos,col,1.6);node.scale.setScalar(AU_KM);return node;
  };
  this.add(ring(3500,2.1,3.3,.35,'#bda995'),'belts',this.target('asteroid-belt'),.65);
  this.add(ring(4500,30,50,9,'#8baabf'),'belts',this.target('kuiper-belt'),.55);
  this.add(ring(2600,35,200,18,'#b896c1',true),'belts',this.target('scattered-disc'),.42);
  for(let i=0;i<11000;i++){
   const z=2*rng()-1,phi=2*Math.PI*rng(),s=Math.sqrt(1-z*z),inner=i<3500;
   const r=inner?2000*Math.pow(10,rng()):20000*Math.pow(5,rng());
   p.push(r*s*Math.cos(phi),r*z*(inner?.25:1),r*s*Math.sin(phi));c.push(.37,.48,.65);
  }
  const oort=this.points(p,c,1.6);oort.scale.setScalar(AU_KM);this.add(oort,'oort',this.target('oort-cloud'),.6);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,64,40),new THREE.MeshBasicMaterial({color:'#59c3d1',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  const inflow=vector(equatorialPosition(255/15,-5,1));shell.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),inflow);shell.scale.set(120*AU_KM,120*AU_KM,155*AU_KM);this.add(shell,'heliosphere',this.target('heliosphere'),.12);
  this.states.belts=this.states.oort=this.states.heliosphere='ready';
 }
 async texture(file){return new Promise((resolve,reject)=>{const t=this.owner.textureLoader.load(file.startsWith('https://')?file:`${base()}${file}`,()=>resolve(t),undefined,reject);t.colorSpace=THREE.SRGBColorSpace;});}
 async imagePlane(item,file,opacity=1,order=0){
  const map=await this.texture(file);
  const node=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  const b=equatorialBasis(item.position);node.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vector(b.right),vector(b.up),vector(b.normal)));node.rotateZ(THREE.MathUtils.degToRad(item.northAngle||0));
  const width=2*item.distanceLy*LY_KM*Math.tan(item.fovDeg*Math.PI/360);node.scale.set(width,width,1);node.renderOrder=order;
  if(item.dssImage||item.catalogNebula){
   node.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec2 edge=abs(vMapUv-0.5)*2.0;float border=1.0-smoothstep(0.72,1.0,max(edge.x,edge.y));float signal=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));diffuseColor.a*=border*smoothstep(0.015,0.18,signal);');};
  }
  this.add(node,item.atlasLayer,item,opacity);return node;
 }
 async loadNebulaCatalog(){
  if(this.nebulaItems.length)return;
  if(this.nebulaCatalogPromise)return this.nebulaCatalogPromise;
  this.nebulaCatalogPromise=(async()=>{
   const buffer=await this.fetch('nebula-catalog.json.gz',true);
   const data=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
   this.nebulaItems=nebulaItems(data);this.nebulaLocated=this.nebulaItems.filter(x=>!x.noLocation&&x.confirmed);
   for(const item of this.nebulaItems.filter(x=>x.image&&!x.noLocation))this.register(item);
   const p=this.nebulaLocated.flatMap(x=>x.position.map(v=>v/PC_KM));
   const colors=this.nebulaLocated.flatMap(x=>{const c=new THREE.Color(x.color);return[c.r,c.g,c.b];});
   const node=this.points(p,colors,3);node.scale.setScalar(PC_KM);this.nebulaNode=this.add(node,'nebulae',null,.65);
   delete this.errors.nebulaCatalog;this.changed();
  })();
  try{await this.nebulaCatalogPromise;}finally{this.nebulaCatalogPromise=null;}
 }
 async loadNebulaImage(item){
  if(this.nebulaImages.has(item.id)||this.nebulaImagePending.has(item.id)||this.nebulaImageErrors.has(item.id))return;
  this.nebulaImagePending.add(item.id);
  try{
   const node=await this.imagePlane(item,nebulaImageUrl(item),.9);this.nebulaImages.set(item.id,node);
   while(this.nebulaImages.size>4){const [id,old]=this.nebulaImages.entries().next().value;this.rollback([old]);this.nebulaImages.delete(id);}
  }catch(error){this.nebulaImageErrors.add(item.id);}
  finally{this.nebulaImagePending.delete(item.id);this.changed();}
 }
 async loadNebulae(){
  await this.loadNebulaCatalog();
  // Stage together: a failed request cannot leave duplicate partial planes on retry.
  const staged=[];
   try{for(const item of this.targets.filter(x=>x.kind==='nebula'&&x.image))staged.push(await this.imagePlane(item,item.image,1));}
  catch(error){this.rollback(staged);throw error;}
 }
 rollback(nodes){const removed=this.nodes.filter(x=>nodes.includes(x.node));this.nodes=this.nodes.filter(x=>!nodes.includes(x.node));for(const x of removed){this.owner.scene.remove(x.node);x.node.geometry?.dispose();x.node.material?.map?.dispose();x.node.material?.dispose();}}
 async loadMass(){
  const item=this.target('abell2744-mass'),staged=[];
  try{
   this.massOptical=await this.imagePlane(item,'atlas/abell2744-dss2.jpg',1,1);staged.push(this.massOptical);
   this.massHubble=await this.imagePlane(item,'atlas/abell2744-hst.png',1,2);staged.push(this.massHubble);
   this.massXray=await this.imagePlane(item,'atlas/abell2744-chandra.png',1,2);staged.push(this.massXray);
   this.massKappa=await this.imagePlane(item,'atlas/abell2744-kappa.png',1,3);staged.push(this.massKappa);
  }catch(error){this.rollback(staged);throw error;}
 }
 async loadVoids(){
  const data=await this.fetch('voids.json');
  for(const row of data.rows){
   const [id,ra,dec,mpc,radiusMpc]=row;
   const position=equatorialPosition(ra/15,dec,mpc*1e6*PC_KM),radiusLy=radiusMpc*1e6*PC_KM/LY_KM;
   const item=this.register({id:'void-'+id,name:'Vacío '+id,atlasLayer:'voids',kind:'void',cosmic:true,position,distanceLy:Math.hypot(...position)/LY_KM,radiusLy,viewDistanceKm:radiusLy*LY_KM*3,color:'#64c8c9',source:data.credit,sourceUrl:data.sourceUrl,evidence:'Catálogo',summary:data.description});
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshBasicMaterial({color:item.color,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));mesh.scale.setScalar(radiusLy*LY_KM);this.add(mesh,'voids',item,.065);
   // Three great circles delimit an effective radius without implying an exact surface.
   const coordinates=[];
   for(let axis=0;axis<3;axis++)for(let i=0;i<96;i++)for(const j of [i,i+1]){const v=[Math.cos(j/96*Math.PI*2),Math.sin(j/96*Math.PI*2),0];coordinates.push(v[(0+axis)%3],v[(1+axis)%3],v[(2+axis)%3]);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#64b1b8',transparent:true,depthWrite:false}));line.scale.copy(mesh.scale);this.add(line,'voids',item,.3);
  }
  if(data.rows.length){const first=this.target('void-'+data.rows[0][0]);Object.assign(this.target('void-survey'),{position:[...first.position],distanceLy:first.distanceLy,viewDistanceKm:500e6*LY_KM,source:data.credit,sourceUrl:data.sourceUrl,summary:data.description});}
 }
 async loadDesi(){
  const data=await this.fetch('desi.json'),p=[],c=[];
  this.desiItems=data.rows.map(([id,ra,dec,z,mpc])=>{
   const position=equatorialPosition(ra/15,dec,mpc*1e6*PC_KM);p.push(...position.map(x=>x/(1e6*PC_KM)));
   const color=new THREE.Color().setHSL(.57-clamp(z/2,0,1)*.45,.6,.68);c.push(color.r,color.g,color.b);
   return {id:'desi-'+id,name:'DESI '+id,atlasLayer:'desi',cosmic:true,catalogGalaxy:true,kind:'galaxy',position,distanceLy:mpc*1e6*PC_KM/LY_KM,viewDistanceKm:1e6*LY_KM,color:'#e8c37f',redshift:z,source:'DESI DR1 · iron',sourceUrl:data.sourceUrl,evidence:'Catálogo',summary:`Espectro de galaxia DESI TARGETID ${id}; z=${z}. Distancia comóvil calculada con H₀=70 y Ωm=0,3. Selección main/dark con ZWARN=0 y DELTACHI2>25. No se conoce su morfología ni diámetro a partir de este punto.`};
  });
  const node=this.points(p,c,2.3);node.scale.setScalar(1e6*PC_KM);this.desiNode=this.add(node,'desi',null,.9);this.countDesi=this.desiItems.length;
  this.target('desi-survey').summary+=` Instantánea: ${this.countDesi.toLocaleString('es-ES')} galaxias en 32 píxeles HEALPix.`;
 }
 async setWavelength(id){
  const map=id==='microwave'?{id,title:'WMAP · microondas',file:'textures/cmb-wmap-equirectangular.png'}:imageManifest.maps.find(x=>x.id===id);
  if(id==='optical'){this.wavelength=id;this.changed();return;}
  if(!map)return;
  this.wavelength=id;this.skyState='loading';this.changed();
  try{
   if(!this.skyMaps[id]){
    const texture=await this.texture(map.file),g=new THREE.SphereGeometry(1,96,48),p=g.attributes.position;
    // CDS CAR has longitude decreasing left-to-right; native sphere UV has the opposite parity.
    if(id!=='microwave'){texture.repeat.x=-1;texture.offset.x=1;}
    for(let i=0;i<p.count;i++)p.setXYZ(i,...galacticPosition(p.getX(i),-p.getZ(i),p.getY(i)));
    const node=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,depthTest:false,depthWrite:false,toneMapped:false}));node.frustumCulled=false;node.renderOrder=-500;this.owner.scene.add(node);this.skyMaps[id]=node;
   }
   if(this.wavelength===id)this.skyState='ready';
  }catch(error){if(this.wavelength===id){this.skyState='error';this.errors.sky=String(error);}}
  this.changed();
 }
 update(origin,distance){
  const observer=this.owner.camera.position.clone().add(origin),focus=this.owner.focus?.item,ly=distance/LY_KM;
  if(focus?.catalogNebula&&!focus.image&&!focus.noLocation&&this.enabled.nebulae)this.loadNebulaImage(focus);
  for(const spec of ATLAS_LAYERS){
   if(this.enabled[spec.id]&&this.states[spec.id]==='pending'&&(focus?.atlasLayer===spec.id||ly>spec.minLy&&ly<spec.maxLy))this.load(spec.id);
  }
  for(const entry of this.nodes){
   const {node,item,layer,marker}=entry;
   node.position.copy(item?vector(item.position):new THREE.Vector3()).sub(origin);
   const spec=ATLAS_LAYERS.find(x=>x.id===layer);let visible=this.enabled[layer]&&(focus?.atlasLayer===layer || ly>=spec.minLy&&ly<spec.maxLy);
   if(layer==='desi'&&focus?.catalogGalaxy)visible=this.enabled[layer];
   if(item){const r=Math.max((item.radiusLy??item.distanceLy*Math.tan((item.fovDeg||.01)*Math.PI/360))*LY_KM,1),range=observer.distanceTo(vector(item.position));visible=visible&&range<r*120;
    if(marker)visible=visible&&this.owner.showLabels&&(focus?.id===item.id||distance>r*.2&&distance<r*25);
    else if(!item.solarRegion)visible=visible&&(focus?.atlasLayer===layer||ly<spec.maxLy);
   }else visible=visible&&ly<spec.maxLy&&(ly>spec.minLy||focus?.atlasLayer===layer||focus?.catalogGalaxy);
   node.visible=visible;
   if(!marker&&node.material){
    const fade=['bubble','dust'].includes(layer)&&focus?.atlasLayer!==layer
      ? THREE.MathUtils.smoothstep(ly,spec.minLy,spec.minLy*3)*(1-THREE.MathUtils.smoothstep(ly,8000,50000)) : 1;
    node.material.opacity=entry.opacity*this.opacity*fade;
   }
   if(layer==='mass'&&!marker){
    const background=node!==this.massKappa, matchingBackground=this.massBackground==='xray'?node===this.massXray:node!==this.massXray;node.visible=visible&&(background?this.massMode!=='mass'&&matchingBackground:this.massMode!=='optical');node.material.opacity=background?1:(this.massMode==='mass'?1:this.massMix);
   }
  }
  const inSolarVicinity=observer.length()<LY_KM;
  for(const [id,node] of Object.entries(this.skyMaps)){node.visible=id===this.wavelength&&inSolarVicinity;node.position.copy(this.owner.camera.position);node.scale.setScalar(Math.max(distance*3,LY_KM*100));}
  if(this.wavelength!=='optical'&&inSolarVicinity&&this.skyMaps[this.wavelength])this.cosmos.photos.sky.visible=false;
 }
 pick(camera,direction,angle){const items=[...(this.nebulaNode?.visible?this.nebulaLocated:[]),...(this.desiNode?.visible?this.desiItems:[])];return closestPointOnRay(items,x=>x.position,camera,direction,angle);}
 search(query,limit=12){if(!query)return[];const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f\s-]/g,'').toUpperCase();const q=norm(query),d=query.replace(/^DESI[ -]?/,'');return [...this.nebulaItems.filter(x=>norm(`${x.name} ${x.aliases} ${x.id}`).includes(q)).slice(0,limit),...this.desiItems.filter(x=>x.id.includes(d)).slice(0,limit)].slice(0,limit);}
}
