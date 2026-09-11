import * as THREE from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import models from '../public/data/craft-models.json' with {type:'json'};
const byId=new Map(models.flatMap(x=>x.ids.map(id=>[id,x])));
const starlink={id:'starlink-family',extentMeters:11,credit:'Universal · representación esquemática de Starlink de primera generación',sourceUrl:'https://www.starlink.com/technology',note:'Modelo representativo común: cuerpo plano y un ala solar desplegada. No identifica la generación ni reproduce una variante V2/V3 concreta. Dimensiones aproximadas; actitud ilustrativa.'};
export function craftSpec(item){if(!item||item.isDebris)return null;return byId.get(String(item.id))||(/^STARLINK(?:-|\s|$)/i.test(item.name||'')?starlink:null);}
export function craftMinDistance(item){const spec=craftSpec(item);return spec?spec.extentMeters*.00065:null;}
function starlinkModel(){
 const root=new THREE.Group(),bus=new THREE.MeshStandardMaterial({color:'#c3c8ca',metalness:.5,roughness:.45}),solar=new THREE.MeshStandardMaterial({color:'#162b49',metalness:.3,roughness:.55}),antenna=new THREE.MeshStandardMaterial({color:'#eceee6',roughness:.7});
 const box=(w,h,d,x,y,z,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);root.add(m);};
 box(3.2,.22,1.6,0,0,0,bus);box(3.2,.025,8,0,.16,4.9,solar);box(.1,.12,.8,0,.04,1.15,bus);
 for(let i=0;i<8;i++)box(3.2,.028,.012,0,.17,1.4+i,antenna);
 for(const x of [-.85,.85])for(const z of [-.4,.4])box(1.25,.03,.55,x,-.125,z,antenna);
 return root;
}
export class CraftModels {
 constructor(owner){this.owner=owner;this.loader=new GLTFLoader();this.draco=new DRACOLoader().setDecoderPath(`${import.meta.env?.BASE_URL||'/'}models/draco/`);this.loader.setDRACOLoader(this.draco);this.cache=new Map();this.loading=new Set();this.failed=new Map();this.active=null;this.enabled=true;}
 notify(message){const e=typeof document!=='undefined'&&document.getElementById('craft-status');if(e){e.textContent=message;e.hidden=!message;}}
 async load(spec){
  if(this.loading.has(spec.id)||this.cache.has(spec.id)||this.failed.has(spec.id))return;
  this.loading.add(spec.id);
  try{
   const root=spec.id==='starlink-family'?starlinkModel():(await this.loader.loadAsync(`${import.meta.env?.BASE_URL||'/'}${spec.file}`)).scene;
   root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
   if(!Number.isFinite(extent)||extent<=0)throw Error('Geometría sin tamaño');
   const center=box.getCenter(new THREE.Vector3());root.position.sub(center);const group=new THREE.Group();group.add(root);group.scale.setScalar(spec.extentMeters/1000/extent);group.visible=false;
   if(!this.environment){const pmrem=new THREE.PMREMGenerator(this.owner.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();}
   root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.isMeshStandardMaterial){m.envMap=this.environment;m.envMapIntensity=.7;}m.needsUpdate=true;}}});
   this.owner.scene.add(group);this.cache.set(spec.id,{group,spec,halfHeight:size.y/extent*spec.extentMeters/2000});
   while(this.cache.size>3){const [id,entry]=this.cache.entries().next().value;this.owner.scene.remove(entry.group);entry.group.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){for(const v of Object.values(m))if(v?.isTexture&&v!==this.environment)v.dispose();m.dispose();}});this.cache.delete(id);}
  }catch(e){this.failed.set(spec.id,String(e));}finally{this.loading.delete(spec.id);}
 }
 update(){
  const owner=this.owner,item=owner.focus.type==='object'?owner.focus.item:owner.selected,spec=craftSpec(item);
  this.active=null;for(const x of this.cache.values())x.group.visible=false;
  if(!this.enabled||!spec){this.notify('');return;}
  if(item.satrec&&!owner.catalogReliable||item.body&&!owner.showSurface||!item.satrec&&!item.body&&!owner.showMissions){this.notify('');return;}
  if(item.snapshotAt&&Math.abs(owner.simulationDate-Date.parse(item.snapshotAt))>=2*86400000){this.notify('Modelo oculto: fecha fuera de la efeméride disponible.');return;}
  const absolute=owner.currentAbsolutePosition(item,owner.simulationDate);if(!absolute)return;
  const position=absolute.sub(owner.focusOrigin),range=owner.camera.position.distanceTo(position);
  if(range>spec.extentMeters*.15){this.notify('');return;}
  this.load(spec);const entry=this.cache.get(spec.id);
  if(!entry){this.notify(this.failed.has(spec.id)?'No se pudo cargar el modelo. Pulsa Ver modelo 3D para reintentar.':'Cargando modelo 3D…');return;}
  if(range>spec.extentMeters*.05){this.notify('');return;}
  const {group}=entry;group.position.copy(position);group.quaternion.identity();
  if(item.body){const normal=owner.surfaceNormal(item);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);group.position.addScaledVector(normal,entry.halfHeight);}
  group.visible=true;this.active=item;
  for(const x of [...owner.spacecraftNodes,...owner.localOrbiterNodes,...owner.surfaceNodes])if(x.item.id===item.id)x.sprite.visible=false;
  // At inspection range the point cloud is below the object's angular scale.
  if(item.satrec){owner.activePoints.visible=false;owner.debrisPoints.visible=false;if(owner.selectedOrbit)owner.selectedOrbit.visible=false;}
  this.notify(`${spec.credit}. ${spec.note} Iluminación de inspección.`);
 }
 inspect(item){const spec=craftSpec(item);if(!spec)return false;this.failed.delete(spec.id);if(!this.owner.focusItem(item))return false;this.owner.zoomTarget=null;this.owner.camera.position.setLength(spec.extentMeters*.003);this.owner.controls.update();this.load(spec);return true;}
}
