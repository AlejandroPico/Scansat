import * as THREE from 'three';
import { equatorialPosition, PC_KM, LY_KM } from './cosmic-data.js';
export const MPC_KM=PC_KM*1e6;
export async function fetchPacked(name,json=false) {
 const response=await fetch(`${import.meta.env.BASE_URL}data/cosmography/${name}`);
 if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
 const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
 const result=new Response(stream);
 return json?result.json():result.arrayBuffer();
}
export function decodeSDSS(buffer) {
 if(buffer.byteLength%25 || buffer.byteLength<25)throw new Error('Catálogo SDSS truncado');
 const view=new DataView(buffer),count=buffer.byteLength/25,p=new Float32Array(count*3);
 for(let i=0;i<count;i++) {
  const o=i*25,ra=view.getFloat32(o+8,true),dec=view.getFloat32(o+12,true),mpc=view.getFloat32(o+16,true)/.73;
  if(!(ra>=0&&ra<=24&&dec>=-90&&dec<=90&&mpc>0&&mpc<20000))throw new Error('Coordenada SDSS inválida');
  p.set(equatorialPosition(ra,dec,mpc),i*3);
 }
 return {view,count,positions:p};
}
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
export class CosmicSurveys {
 constructor(cosmos) {this.cosmos=cosmos;this.owner=cosmos.owner;this.catalogs=[];this.states={sdss:'pending',twoMrs:'pending',flows:'pending',density:'pending'};this.unitMpc={value:1/MPC_KM};this.focal={value:1000};this.dataNodes=[];}
 async loadCatalog(kind) {
  if(this.states[kind]!=='pending')return;
  this.states[kind]='loading';
  try {
   let catalog;
   if(kind==='sdss')catalog={...decodeSDSS(await fetchPacked('sdss.bin.gz')),kind};
   else {
    const rows=await fetchPacked('2mrs.json.gz',true),p=new Float32Array(rows.length*3);
    for(let i=0;i<rows.length;i++)p.set(equatorialPosition(rows[i][2],rows[i][3],rows[i][4]),i*3);
    catalog={rows,positions:p,count:rows.length,kind};
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(catalog.positions,3));
   const colors=new Float32Array(catalog.count*3),shape=new Float32Array(catalog.count*2);
   const warm=new THREE.Color('#efd4ac'),blue=new THREE.Color('#c7d7e5');
   for(let i=0;i<catalog.count;i++) {
    const r=((Math.imul(i+17,1664525)>>>0)%65536)/65536;
    const color=r>.6?blue:warm,brightness=.40+r*.40;
    colors.set([color.r*brightness,color.g*brightness,color.b*brightness],i*3);
    shape.set([r*6.283185, .35+((i*71)%100)/155],i*2);
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('galaxyShape',new THREE.BufferAttribute(shape,2));
   const material=new THREE.PointsMaterial({size:2,vertexColors:true,sizeAttenuation:false,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
   material.onBeforeCompile=shader=>{
    shader.uniforms.unitMpc=this.unitMpc;shader.uniforms.surveyFocal=this.focal;
    shader.vertexShader='uniform float unitMpc; uniform float surveyFocal; attribute vec2 galaxyShape; varying vec2 glyphShape;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;',`glyphShape=galaxyShape; float mpc=max(.001,length(mvPosition.xyz)*unitMpc); gl_PointSize=clamp(.035/mpc*surveyFocal,1.4,28.0);`);
    shader.fragmentShader='varying vec2 glyphShape;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>',`vec2 p=(gl_PointCoord-.5)*2.0; float a=glyphShape.x; p=mat2(cos(a),-sin(a),sin(a),cos(a))*p; p.y/=glyphShape.y; float r=length(p); float halo=exp(-r*4.5); float core=exp(-r*r*65.0); diffuseColor.a*= (halo*.55+core*.45)*(1.0-smoothstep(.65,1.0,r)); if(diffuseColor.a<.005)discard;`);
   };
   catalog.node=new THREE.Points(geometry,material);catalog.node.scale.setScalar(MPC_KM);catalog.node.visible=false;
   this.owner.scene.add(catalog.node);this.catalogs.push(catalog);this.states[kind]='ready';
  } catch(error){this.states[kind]='error';console.error('Cosmografía',error);}
 }
 async loadFlows() {
  if(this.states.flows!=='pending')return;this.states.flows='loading';
  try {
   const [flow,edge]=await Promise.all([fetchPacked('flows.bin.gz'),fetchPacked('laniakea.bin.gz')]);
   const a=new Float32Array(flow),p=new Float32Array(a.length/4*3),c=new Float32Array(p.length);
   for(let i=0;i<a.length/4;i++){p.set(a.subarray(i*4,i*4+3),i*3);c.set(a[i*4+3]>.5?[.8,.55,.2]:[.18,.38,.60],i*3);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('color',new THREE.BufferAttribute(c,3));
   const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending}));
   const shellGeo=new THREE.BufferGeometry();shellGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(edge),3));
   const shell=new THREE.Points(shellGeo,new THREE.PointsMaterial({color:'#d6ac63',size:2,sizeAttenuation:false,map:this.owner.dotTexture,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending}));
   for(const node of [lines,shell]){node.scale.setScalar(MPC_KM);node.visible=false;this.owner.scene.add(node);this.dataNodes.push({node,kind:'flows',shell:node===shell});}
   this.states.flows='ready';
  }catch(error){this.states.flows='error';console.error('Cosmicflows',error);}
 }
 async loadDensity() {
  if(this.states.density!=='pending')return;this.states.density='loading';
  try {
   const results=await Promise.all(['density.bin.gz','outer-density.bin.gz'].map(x=>fetchPacked(x)));
   for(let j=0;j<results.length;j++) {
    const a=new Float32Array(results[j]),p=new Float32Array(a.length/4*3),c=new Float32Array(p.length);
    const violet=new THREE.Color('#826eac'),gold=new THREE.Color('#edc58b'),color=new THREE.Color();
    for(let i=0;i<a.length/4;i++){p.set(a.subarray(i*4,i*4+3),i*3);color.copy(violet).lerp(gold,smooth(.28,.85,a[i*4+3])).multiplyScalar(.25+a[i*4+3]*.6);color.toArray(c,i*3);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('color',new THREE.BufferAttribute(c,3));
    const node=new THREE.Points(geo,new THREE.PointsMaterial({size:j?1.5:2.2,map:this.owner.dotTexture,vertexColors:true,sizeAttenuation:false,transparent:true,opacity:0,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    node.scale.setScalar(MPC_KM);node.visible=false;this.owner.scene.add(node);this.dataNodes.push({node,kind:'density',outer:j===1});
   }
   this.states.density='ready';
  }catch(error){this.states.density='error';console.error('Densidad cósmica',error);}
 }
 update(origin,distance) {
  const ly=distance/LY_KM,layers=this.cosmos.layers;
  this.unitMpc.value=this.owner.renderUnit/MPC_KM;
  this.focal.value=(this.owner.container?.clientHeight||900)/(2*Math.tan(THREE.MathUtils.degToRad(this.owner.camera.fov/2)));
  // Load only the data needed for the approaching scale. Each dataset is cached.
  if(ly>1e6&&layers.galaxies){if(layers.twoMrs)void this.loadCatalog('twoMrs');if(ly>3e7&&layers.sdss)void this.loadCatalog('sdss');}
  if(ly>5e7&&layers.flows)void this.loadFlows();
  if(ly>2e9&&layers.structure)void this.loadDensity();
  for(const cat of this.catalogs) {
   cat.node.position.copy(origin).negate();
   cat.node.material.opacity=smooth(2e5,3e6,ly)*(1-smooth(8e9,25e9,ly))*(cat.kind==='sdss'?.8:.95);
   cat.node.visible=layers.galaxies&&layers[cat.kind]&&cat.node.material.opacity>.001;
  }
  for(const e of this.dataNodes) {
   e.node.position.copy(origin).negate();
   if(e.kind==='flows')e.node.material.opacity=smooth(6e7,2e8,ly)*(1-smooth(1.5e9,4e9,ly))*(e.shell?.07:.13);
   else e.node.material.opacity=smooth(e.outer?5e9:3e9,e.outer?15e9:8e9,ly)*(e.outer?.45:.5);
   e.node.visible=(e.kind==='flows'?layers.flows:layers.structure)&&e.node.material.opacity>.001;
  }
 }
 item(cat,index) {
  const position=Array.from(cat.positions.subarray(index*3,index*3+3),v=>v*MPC_KM),distanceLy=Math.hypot(...position)/LY_KM;
  const common={cosmic:true,kind:'galaxy',catalogGalaxy:true,position,distanceLy,viewDistanceKm:.35*MPC_KM,color:'#eed6b2',sourceUrl:'https://classic.sdss.org/dr7/'};
  if(cat.kind==='sdss') {
   const id=cat.view.getBigUint64(index*25,true).toString();
   return {...common,id:`sdss-${id}`,name:`SDSS ${id}`,source:'SDSS · catálogo 3D servido por WorldWide Telescope',summary:'Galaxia del sondeo SDSS, situada con las coordenadas y distancia publicadas en el catálogo de WorldWide Telescope (h = 0,73). La cobertura angular conserva las regiones observadas: los huecos del sondeo no son necesariamente vacíos cósmicos. El pequeño perfil luminoso es una ayuda de localización, no una fotografía, un diámetro medido o una orientación medida.'};
  }
  const [id,name,ra,dec,mpc,cz,mag,type]=cat.rows[index];
  return {...common,id:`2mrs-${id}`,name:name||`2MASX J${id}`,aliases:`2MASX J${id}`,source:'2MRS · Huchra et al. 2012 / CDS VizieR',sourceUrl:'https://heasarc.gsfc.nasa.gov/w3browse/all/twomassrsc.html',summary:`Galaxia 2MRS con posición J2000 y velocidad radial baricéntrica cz = ${cz} km/s. Distancia comóvil inferida del corrimiento al rojo con H₀ = 73 km/s/Mpc, Ωm = 0,3 y ΩΛ = 0,7; sin corrección de velocidad peculiar, especialmente incierta en galaxias cercanas. Magnitud Ks: ${mag}; morfología ZCAT: ${type||'no clasificada'}. El perfil luminoso es un localizador, no una imagen o diámetro medidos.`};
 }
 search(query,limit=60) {
  if(!query)return[];const q=query.toUpperCase(),out=[];
  for(const cat of this.catalogs) {
   if(cat.kind==='twoMrs')for(let i=0;i<cat.count&&out.length<limit;i++){const row=cat.rows[i];if(`${row[0]} ${row[1]}`.toUpperCase().includes(q.replace(/^2MASX J?/,'')))out.push(this.item(cat,i));}
   if(cat.kind==='sdss'&&/\d{15,}/.test(q)){const id=q.match(/\d{15,}/)[0];for(let i=0;i<cat.count;i++)if(cat.view.getBigUint64(i*25,true).toString()===id){out.push(this.item(cat,i));break;}}
  }return out;
 }
 pick(camera,direction,angle) {
  let best=null,nearest=Infinity;const cam=camera.map(v=>v/MPC_KM),limit=angle*angle;
  for(const cat of this.catalogs) {
   if(!cat.node.visible)continue;const p=cat.positions;
   for(let i=0;i<cat.count;i++){
    const x=p[i*3]-cam[0],y=p[i*3+1]-cam[1],z=p[i*3+2]-cam[2],d2=x*x+y*y+z*z;
    const t=x*direction[0]+y*direction[1]+z*direction[2];
    if(t<=0||t>=nearest||Math.max(0,d2-t*t)>d2*limit)continue;
    nearest=t;best={cat,i};
   }
  }return best?{item:this.item(best.cat,best.i),distance:nearest*MPC_KM}:null;
 }
}
