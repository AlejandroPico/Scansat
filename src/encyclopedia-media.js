import atlasImages from '../public/data/atlas/image-manifest.json' with {type:'json'};
const asset=(file,caption,credit,url)=>({file,caption,credit,url});
const sky=asset('textures/milky-way-eso0932a.jpg','La Vía Láctea desde nuestra vecindad: fotografía panorámica de larga exposición.','ESO/S. Brunier · CC BY 4.0','https://www.eso.org/public/images/eso0932a/');
const m31=asset('textures/andromeda-full-dss2.jpg','Andrómeda: fotografía óptica del Digitized Sky Survey 2.','NASA, ESA, DSS2 · Davide De Martin · CC BY 4.0','https://esahubble.org/images/heic1502b/');
const web=asset('encyclopedia/reference-cosmic-web.png','Densidad de la red cósmica en falso color. Referencia visual aportada para el proyecto; no es una fotografía del universo.','Imagen de referencia aportada por el usuario; autor y simulación no identificados.',null);
const node=asset('encyclopedia/reference-cluster.png','Detalle de un nodo y sus filamentos: la densidad aumenta gradualmente hacia las regiones doradas.','Imagen de referencia aportada por el usuario; autor y simulación no identificados.',null);
const cmb=asset('textures/cmb-wmap-equirectangular.png','Mapa WMAP de cinco años en proyección equirectangular galáctica. Los colores representan diferencias de temperatura, ±200 μK.','NASA / WMAP Science Team','https://lambda.gsfc.nasa.gov/product/wmap/dr4/sos/5year/');
export function mediaFor(entry){
 const nebula=atlasImages.nebulae.find(x=>x.id===entry.id);
 if(nebula)return[asset(nebula.file,'Fotografía observada; plano de imagen, no reconstrucción volumétrica.',nebula.credit,nebula.sourceUrl)];
 if(entry.id==='abell2744-mass')return[asset('atlas/abell2744-hst.png','Imagen observada Hubble; huecos y mosaico conservados.','NASA/ESA Hubble Space Telescope; STScI archive; CDS HiPS2FITS','https://alasky.cds.unistra.fr/HST-hips/color/properties'),asset('atlas/abell2744-chandra.png','Emisión X observada: plasma caliente, fuentes puntuales y fondo. No es una densidad de gas pura.','Chandra / CXC; CDS HiPS2FITS','https://alasky.cds.unistra.fr/Chandra/'),asset('atlas/abell2744-kappa.png','Convergencia κ: masa total proyectada inferida por lentes; no materia oscura pura. Escala logarítmica relativa.','CATS / Jauzac et al. / LENSTOOL / Hubble Frontier Fields','https://archive.stsci.edu/prepds/frontier/lensmodels/')];
 if(entry.id==='fermi-bubbles')return[asset('atlas/gamma.jpg','Mapa observado del cielo gamma desde el entorno solar. Los lóbulos 3D del visor son un modelo de geometría.','NASA/HEASARC; SkyView; CDS; HiPS2FITS','https://alasky.cds.unistra.fr/Fermi/Color/properties')];
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
 if(entry.target?.evidence)return entry.target.evidence;
 if(entry.target?.modeled)return 'Modelo';
 if(entry.category==='methods')return 'Guía';
 if(entry.target?.satrec||entry.target?.positionKm)return 'Cálculo';
 if(entry.target?.catalogGalaxy||entry.target?.kind==='star'||entry.id==='cmb')return 'Catálogo';
 if(entry.target?.cosmic)return 'Referencia';
 return 'Ficha';
}
