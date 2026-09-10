const asset=(file,caption,credit,url)=>({file,caption,credit,url});
const sky=asset('textures/milky-way-eso0932a.jpg','La Vía Láctea desde nuestra vecindad: fotografía panorámica de larga exposición.','ESO/S. Brunier · CC BY 4.0','https://www.eso.org/public/images/eso0932a/');
const m31=asset('textures/andromeda-full-dss2.jpg','Andrómeda: fotografía óptica del Digitized Sky Survey 2.','NASA, ESA, DSS2 · Davide De Martin · CC BY 4.0','https://esahubble.org/images/heic1502b/');
const web=asset('encyclopedia/reference-cosmic-web.png','Densidad de la red cósmica en falso color. Referencia visual aportada para el proyecto; no es una fotografía del universo.','Imagen de referencia aportada por el usuario; autor y simulación no identificados.',null);
const node=asset('encyclopedia/reference-cluster.png','Detalle de un nodo y sus filamentos: la densidad aumenta gradualmente hacia las regiones doradas.','Imagen de referencia aportada por el usuario; autor y simulación no identificados.',null);
const cmb=asset('textures/cmb-wmap-equirectangular.png','Mapa WMAP de cinco años en proyección equirectangular galáctica. Los colores representan diferencias de temperatura, ±200 μK.','NASA / WMAP Science Team','https://lambda.gsfc.nasa.gov/product/wmap/dr4/sos/5year/');
export function mediaFor(entry){
 if(['cmb','last-scattering'].includes(entry.id))return[cmb];
 if(['cosmic-web','observable-universe','observable-distance'].includes(entry.id))return[web,node];
 if(['andromeda'].includes(entry.id))return[m31];
 if(['milky-way','photographic-sky','galactic-flight','hyg-catalog','atlas-guide'].includes(entry.id))return[sky,...(entry.id==='atlas-guide'?[m31,web,cmb]:[])];
 if(['laniakea','cosmic-flows','virgo','virgo-supercluster'].includes(entry.id))return[asset('encyclopedia/reference-cosmic-web.png','Contexto: red de densidad cósmica. Esta referencia NO es el mapa observado de Laniakea ni representa sus líneas de velocidad.','Referencia visual aportada por el usuario.',null)];
 const maps={earth:'earth-natural.png',moon:'moon-color.jpg',mars:'mars.jpg',jupiter:'jupiter.jpg',saturn:'saturn.jpg',neptune:'neptune.jpg',venus:'venus.jpg',sun:'sun-surface.jpg',io:'io.jpg',europa:'europa.jpg',ganymede:'ganymede.jpg',callisto:'callisto.jpg',titan:'titan.jpg',triton:'triton.jpg'};
 if(maps[entry.id])return[asset('textures/'+maps[entry.id],entry.id==='sun'?'Observación solar en ultravioleta y falso color.':'Mapa de superficie o cubierta visible empleado por el visor; proyección plana, no fotografía de un globo.','NASA / GSFC / JPL y autores originales','https://science.nasa.gov/solar-system/')];
 if(entry.id==='earth-detail')return[asset('textures/earth-natural.png','Mosaico global NASA Blue Marble; el visor añade teselas al acercarse.','NASA / GSFC','https://svs.gsfc.nasa.gov/2915/')];
 return[];
}
export function evidenceFor(entry){
 if(entry.target?.modeled)return 'Modelo';
 if(entry.category==='methods')return 'Guía';
 if(entry.target?.satrec||entry.target?.positionKm)return 'Cálculo';
 if(entry.target?.catalogGalaxy||entry.target?.kind==='star'||entry.id==='cmb')return 'Catálogo';
 if(entry.target?.cosmic)return 'Referencia';
 return 'Ficha';
}
