import * as THREE from 'three';
export const MERCATOR_LIMIT=85.05112878;
export function lonLatTile(lon,lat,z) {
 const n=2**z,l=THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat,-MERCATOR_LIMIT,MERCATOR_LIMIT));
 return {x:((Math.floor((lon+180)/360*n)%n)+n)%n,y:THREE.MathUtils.clamp(Math.floor((1-Math.asinh(Math.tan(l))/Math.PI)/2*n),0,n-1)};
}
export function tileLonLat(x,y,z) {const n=2**z;return [x/n*360-180,THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI*(1-2*y/n))))];}
export function earthVector(lon,lat,r) {const a=THREE.MathUtils.degToRad(lon),b=THREE.MathUtils.degToRad(lat);return new THREE.Vector3(r*Math.cos(b)*Math.cos(a),r*Math.sin(b),-r*Math.cos(b)*Math.sin(a));}
export function earthTileGeometry(x,y,z,radius) {
 const steps=z<4?24:z<9?12:4,positions=[],uv=[],indices=[];
 const [lon,lat]=tileLonLat(x+.5,y+.5,z),center=earthVector(lon,lat,radius);
 for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++){
  const [a,b]=tileLonLat(x+col/steps,y+row/steps,z),p=earthVector(a,b,radius).sub(center);
  positions.push(p.x,p.y,p.z);uv.push(col/steps,1-row/steps);
 }
 for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){const a=row*(steps+1)+col,b=a+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 return {geometry,center};
}
export class EarthTiles {
 constructor(owner){this.owner=owner;this.enabled=true;this.weather=false;this.tiles=new Map();this.pending=0;this.queue=[];this.wanted=new Set();this.failed=new Map();this.last=0;this.level=0;this.status='';this.date='';this.source='';this.group={visible:false};this.canvas=document.createElement('canvas');this.canvas.width=2304;this.canvas.height=1792;this.context=this.canvas.getContext('2d');this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;this.texture.anisotropy=Math.min(8,owner.renderer.capabilities.getMaxAnisotropy());this.dirty=true;
 const u=owner.earthMaterial.uniforms;u.detailMap={value:this.texture};u.detailBounds={value:new THREE.Vector4()};u.detailEnabled={value:0};}
 update() {
  const earth=this.owner.bodyNodes.get('earth'),distance=this.owner.camera.position.length(),radius=earth.definition.radiusKm;
  if(this.owner.clouds)this.owner.clouds.visible=this.owner.showAtmosphere&&!this.weather&&distance>radius+200;
  this.group.visible=this.enabled&&this.owner.layer==='satellite'&&this.owner.focus.id==='earth'&&earth.root.visible&&distance<radius*12;
  this.owner.earthMaterial.uniforms.detailEnabled.value=this.group.visible?1:0;
  if(!this.group.visible){this.queue=[];return;}
  const now=performance.now();if(now-this.last<180)return;this.last=now;
  // Work in the rotating Earth frame, not celestial coordinates.
  const direction=this.owner.camera.position.clone().applyQuaternion(earth.axialTilt.quaternion.clone().invert()).applyQuaternion(earth.spin.quaternion.clone().invert()).normalize();
  const lat=THREE.MathUtils.radToDeg(Math.asin(direction.y)),lon=THREE.MathUtils.radToDeg(Math.atan2(-direction.z,direction.x));
  const altitude=Math.max(.05,distance-radius),height=this.owner.container.clientHeight||900;
  const footprint=2*altitude*Math.tan(THREE.MathUtils.degToRad(this.owner.camera.fov/2));
  const z=THREE.MathUtils.clamp(Math.ceil(Math.log2(2*Math.PI*radius*Math.cos(THREE.MathUtils.degToRad(lat))*height/(256*footprint))),1,this.weather?9:19);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const date=this.weather?yesterday:'mosaic',source=this.weather?'nasa':'esri';
  this.level=z;this.date=date;this.source=source;this.wanted.clear();
  const t=lonLatTile(lon,lat,z),n=2**z,requests=[];
  for(let dy=-3;dy<=3;dy++)for(let dx=-4;dx<=4;dx++){
   const x=(t.x+dx+n)%n,y=t.y+dy;if(y<0||y>=n)continue;
   requests.push({x,y,z,d:dx*dx+dy*dy});
  }
  requests.sort((a,b)=>a.d-b.d);
  const withParents=[...requests];
  for(const r of requests)for(let k=r.z-1;k>=1;k--)withParents.push({x:Math.floor(r.x/2**(r.z-k)),y:Math.floor(r.y/2**(r.z-k)),z:k});
  this.queue=[];
  for(const r of withParents){const key=`${source}/${date}/${r.z}/${r.x}/${r.y}`;if(this.wanted.has(key))continue;this.wanted.add(key);const tile=this.tiles.get(key);if(tile){tile.last=now;}else if(!this.failed.has(key))this.queue.push({...r,key,date,source});}
  for(const [key,tile] of this.tiles)if(!this.wanted.has(key)&&this.tiles.size>200){tile.bitmap.close();this.tiles.delete(key);}
  const atlasKey=`${source}/${date}/${z}/${t.x}/${t.y}`;
  if(this.dirty||this.atlasKey!==atlasKey){this.compose(source,date,z,t);this.atlasKey=atlasKey;this.dirty=false;}
  const segments=altitude<500?1024:altitude<6000?512:160;
  if(this.segments!==segments){earth.surface.geometry.dispose();earth.surface.geometry=new THREE.SphereGeometry(radius,segments,segments/2);this.segments=segments;}
  this.status=this.weather?`NASA GIBS · observación ${date} · máximo ≈250 m/píxel`:`Esri World Imagery · nivel ${z} · resolución variable según cobertura`;
  this.pump();
 }
 compose(source,date,z,t){
  const ctx=this.context,n=2**z;ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  for(let dy=-3;dy<=3;dy++)for(let dx=-4;dx<=4;dx++){
   const x=(t.x+dx+n)%n,y=t.y+dy;if(y<0||y>=n)continue;
   for(let k=z;k>=1;k--){
    const factor=2**(z-k),px=Math.floor(x/factor),py=Math.floor(y/factor),tile=this.tiles.get(`${source}/${date}/${k}/${px}/${py}`);if(!tile)continue;
    const w=tile.bitmap.width/factor,h=tile.bitmap.height/factor;
    ctx.drawImage(tile.bitmap,(x-px*factor)*w,(y-py*factor)*h,w,h,(dx+4)*256,(dy+3)*256,256,256);break;
   }
  }
  this.texture.needsUpdate=true;this.owner.earthMaterial.uniforms.detailBounds.value.set((t.x-4)/n,(t.y-3)/n,9/n,7/n);
 }
 pump(){while(this.pending<6&&this.queue.length){const r=this.queue.shift();if(this.tiles.has(r.key)||this.failed.has(r.key))continue;this.failed.set(r.key,'loading');this.pending++;void this.load(r);}}
 async load(r){
  try {
   const url=r.source==='esri'?`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${r.z}/${r.y}/${r.x}`:`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${r.date}/GoogleMapsCompatible_Level9/${r.z}/${r.y}/${r.x}.jpg`;
   const response=await fetch(url,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const blob=await response.blob();if(!blob.type.startsWith('image/'))throw new Error('Tesela sin imagen');
   const bitmap=await createImageBitmap(blob);
   this.tiles.set(r.key,{bitmap,last:performance.now()});this.failed.delete(r.key);this.dirty=true;

  }catch(error){this.failed.set(r.key,'error');this.status='Algunas teselas no están disponibles; se conserva la imagen de menor resolución.';}
  finally{this.pending--;if(this.group.visible)this.pump();}
 }
}
