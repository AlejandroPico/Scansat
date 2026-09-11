import {equatorialPosition, PC_KM, LY_KM} from './cosmic-data.js';
import featured from '../public/data/atlas/nebula-featured.json' with {type:'json'};
export function nebulaItems(data){
 if(data.schema!==1)throw Error('Versión de catálogo de nebulosas no compatible');
 return data.rows.map(r=>{
  const [id,name,aliases,raDeg,decDeg,radiusArcsec,distancePc,type,status,sourceIndex,method,author,errorPc,lowerPc,upperPc,reliability,publishedDistancePc]=r;
  const source=data.sources[sourceIndex],located=Number.isFinite(distancePc)&&distancePc>0;
  const confirmed=['K','T'].includes(status),classification=({K:'Región H II confirmada',C:'Candidata H II',Q:'Candidata sin emisión radio detectada',G:'Asociación con grupo H II',T:'Nebulosa planetaria confirmada',L:'Nebulosa planetaria probable',P:'Nebulosa planetaria posible'})[status]||status;
  const distanceLy=located?distancePc*PC_KM/LY_KM:undefined;
  const radiusLy=located&&radiusArcsec>0?distanceLy*Math.tan(radiusArcsec*Math.PI/648000):undefined;
  const photo=featured.find(x=>x.id===id);
  return {id,name:photo?`${photo.aliases} · ${name}`:name,aliases:`${aliases}; ${name.replace(/\s/g,'')}`,raDeg,decDeg,radiusArcsec,distancePc,distanceLy,radiusLy,
   image:photo?.file,dssImage:!!photo,
   position:located?equatorialPosition(raDeg/15,decDeg,distancePc*PC_KM):undefined,
   viewDistanceKm:located?Math.max(radiusLy||.1,.01)*LY_KM*5:undefined,
   kind:'nebula',atlasLayer:'nebulae',cosmic:true,catalogNebula:true,noLocation:!located,
   confirmed,classification,nebulaType:type,color:type==='PN'?'#8bc3c5':'#b68b72',
   source:source.name,sourceUrl:source.url,evidence:confirmed?'Catálogo':'Candidata',
   method,author,errorPc,lowerPc,upperPc,reliability,publishedDistancePc,
   fovDeg:Math.max(.01,Math.min(12,(radiusArcsec||30)*2.6/3600)),
   summary:`${classification}. ${located?'Distancia publicada: '+method+'; '+author+'.':'Sin distancia aceptada para el atlas 3D; se conserva su dirección celeste.'} El punto es un localizador, no una fotografía ni una medida de brillo. Al localizar se solicita una imagen óptica DSS2 del campo: puede mostrar poca emisión, estrellas de fondo o límites de resolución. La fotografía es plana y conserva la perspectiva terrestre; no conocemos el volumen de la nebulosa.`};
 });
}
export function nebulaImageUrl(item){
 const q=new URLSearchParams({hips:'CDS/P/DSS2/color',width:'768',height:'768',fov:String(item.fovDeg),projection:'TAN',coordsys:'icrs',ra:String(item.raDeg),dec:String(item.decDeg),rotation_angle:'0',format:'jpg'});
 return 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?'+q;
}
