import { LY_KM, PC_KM, galacticPosition, equatorialPosition } from './cosmic-data.js';
import { AU_KM } from './solar-data.js';

export const ATLAS_LAYERS = [
 {id:'minor',name:'Planetas enanos y cuerpos menores',group:'Sistema solar',focus:'pluto',minLy:0,maxLy:.1},
 {id:'bubble',name:'Burbuja Local',group:'Vecindad y galaxia',focus:'local-bubble',file:'local-bubble-positions.f32',minLy:20,maxLy:2e5},
 {id:'dust',name:'Polvo interestelar 3D',group:'Vecindad y galaxia',focus:'local-dust',file:'nearby-dust-points.f32',minLy:20,maxLy:2e5},
 {id:'fermi',defaultEnabled:false,name:'Burbujas de Fermi',group:'Vecindad y galaxia',focus:'fermi-bubbles',minLy:1000,maxLy:2e6},
 {id:'streams',defaultEnabled:false,name:'Corrientes estelares',group:'Vecindad y galaxia',focus:'stream-gd-1',file:'streams.json',minLy:1000,maxLy:2e6},
 {id:'clusters',name:'Cúmulos estelares',group:'Vecindad y galaxia',focus:'pleiades',minLy:2,maxLy:2e5},
 {id:'nebulae',name:'Nebulosas y supernovas',group:'Vecindad y galaxia',focus:'carina',minLy:1,maxLy:1e5},
 {id:'voids',defaultEnabled:false,name:'Vacíos y paredes de galaxias',group:'Universo profundo',focus:'void-survey',file:'voids.json',minLy:1e7,maxLy:5e9},
 {id:'desi',name:'Galaxias · DESI DR1',group:'Universo profundo',focus:'desi-survey',file:'desi.json',minLy:1e7,maxLy:3e10},
 {id:'mass',name:'Masa por lentes · Abell 2744',group:'Universo profundo',focus:'abell2744-mass',minLy:1e4,maxLy:1e10},
 {id:'belts',name:'Cinturones y disco disperso',group:'Sistema solar',focus:'asteroid-belt',minLy:.00001,maxLy:.2},
 {id:'heliosphere',defaultEnabled:false,name:'Heliosfera',group:'Sistema solar',focus:'heliosphere',minLy:.0003,maxLy:.5},
 {id:'oort',name:'Nube de Oort',group:'Sistema solar',focus:'oort-cloud',minLy:.001,maxLy:50},
];
const common=(id,name,layer,position,radiusLy,summary,source,sourceUrl,extra={})=>({id,name,atlasLayer:layer,cosmic:true,kind:'region',position,radiusLy,distanceLy:Math.hypot(...position)/LY_KM,viewDistanceKm:radiusLy*LY_KM*3,color:'#92bfcb',summary,source,sourceUrl,...extra});
const gal=(x,y,z)=>galacticPosition(x*PC_KM,y*PC_KM,z*PC_KM);
const eq=(ra,dec,ly)=>equatorialPosition(ra/15,dec,ly*LY_KM);
export const ATLAS_TARGETS = [
 common('carina','Nebulosa de Carina · NGC 3372','nebulae',eq(161.2855417,-59.8666944,7500),7500*Math.tan(Math.PI/180),
  'Gran región de formación estelar. Distancia de referencia NASA: unos 7.500 años luz. Centro J2000 de NGC 3372 (OpenNGC); imagen óptica DSS2 remuestreada con proyección TAN de 2,4°, norte arriba y este a la izquierda. La imagen es un plano observado desde el Sol, no un volumen tridimensional.',
  'NASA · distancia; OpenNGC · coordenadas; DSS2 / STScI / CDS · imagen','https://science.nasa.gov/asset/hubble/carina-nebula/',
  {kind:'nebula',aliases:'Carina Nebula; eta Carinae; NGC3372; Quilla',raDeg:161.2855417,decDeg:-59.8666944,fovDeg:2.4,dssImage:true,image:'atlas/carina.jpg',evidence:'Observación'}),
 common('local-bubble','Burbuja Local','bubble',[0,0,0],1100,'Superficie irregular reconstruida por O’Neill et al. (2024) a partir del mapa de polvo de Edenhofer et al. La abertura hacia el halo es parte de la reconstrucción. La envolvente no es una pared sólida. El muestreo se reduce para el navegador y no evoluciona con el reloj.','O’Neill et al. 2024 · reconstrucción','https://arxiv.org/abs/2403.04961',{evidence:'Reconstrucción'}),
 common('local-dust','Polvo de la vecindad solar','dust',[0,0,0],1600,'Distribución tridimensional de polvo inferida de la extinción estelar. El color representa densidad relativa del mapa, no emisión óptica. Se muestran celdas promediadas de unos 15 pc, entre 69 y 650 pc del Sol: el interior de 69 pc no está medido por este mapa. Las cavidades, nubes y filamentos conservan sus coordenadas galácticas; el recorte y la reducción de resolución se documentan con el conjunto de datos.','Edenhofer et al. · mapa de polvo 3D','https://arxiv.org/abs/2308.01295',{evidence:'Reconstrucción'}),
 common('fermi-bubbles','Burbujas de Fermi','fermi',gal(8178,0,0),36000,'Dos lóbulos de emisión gamma sobre y bajo el centro galáctico. Aquí se usa una envolvente elipsoidal ilustrativa (profundidad no medida directamente), no una reconstrucción tomográfica. El mapa observado Fermi puede consultarse en Cielo por longitud de onda desde el entorno solar. Su origen y edad siguen siendo objeto de investigación.','Su, Slatyer y Finkbeiner 2010 · modelo de geometría','https://arxiv.org/abs/1005.5480',{evidence:'Modelo',modeled:true}),
 common('stream-gd-1','Corriente GD-1','streams',eq(170,40,28000),30000,'Trayectoria media observada publicada en galstreams; las muestras no representan estrellas individuales. Incluye distancia heliocéntrica. Al cargar aparecen también Palomar 5 y Sagitario.','galstreams · Mateu 2023','https://github.com/cmateu/galstreams',{evidence:'Catálogo'}),
 common('void-survey','Vacíos y paredes · SDSS','voids',eq(180,30,700e6),500e6,'Catálogo publicado de vacíos de SDSS. Las envolventes muestran radios de catálogo, no paredes materiales ni contornos exactos. Los puntos de galaxias de SDSS y 2MRS aportan el contexto de las paredes; no se rellenan las zonas no observadas.','Douglass, Veyrat y BenZvi 2023 · VAST','https://doi.org/10.5281/zenodo.7406035',{evidence:'Catálogo'}),
 common('desi-survey','Muestra de galaxias · DESI DR1','desi',[0,0,0],4e9,'Muestra espacial reproducible de espectros main/dark del primer año de DESI DR1. Sólo galaxias con ajuste válido y redshift positivo; distancias comóviles en ΛCDM plano, H₀=70 km/s/Mpc, Ωm=0,3. Es una selección de píxeles del sondeo, no su cobertura completa ni un muestreo homogéneo de todo el universo. Los puntos son localizadores, no tamaños físicos de galaxias.','DESI DR1 · iron · selección pública','https://data.desi.lbl.gov/doc/releases/dr1/',{evidence:'Catálogo'}),
 common('abell2744-mass','Abell 2744 · masa por lentes','mass',eq(3.586259,-30.400174,4e9),8e6,'Mapa de convergencia κ CATS v4.1 / LENSTOOL del cúmulo Abell 2744. Representa masa total proyectada inferida mediante lentes gravitacionales, dominada por materia oscura: no mide materia oscura pura ni su profundidad 3D. El plano respeta el WCS del FITS y el color usa escala logarítmica relativa. Distancia de colocación comóvil aproximada: 4.000 millones de años luz. La imagen óptica o la emisión X observada por Chandra se pueden comparar y superponer con la masa. La emisión X incluye plasma caliente, fuentes puntuales y fondo, no es densidad de gas pura.','CATS / Jauzac et al. · Hubble Frontier Fields','https://archive.stsci.edu/prepds/frontier/lensmodels/',{evidence:'Reconstrucción',kind:'mass-map',fovDeg:.1667500416875104}),
 ...[
 ['asteroid-belt','Cinturón principal', 'belts',3.5,'Distribución ilustrativa entre aproximadamente 2,1 y 3,3 UA. Los puntos trazan la región, no un catálogo de asteroides identificados. Ceres, Vesta y Palas sí usan elementos JPL.','https://science.nasa.gov/solar-system/asteroids/'],
 ['kuiper-belt','Cinturón de Kuiper','belts',55,'Distribución ilustrativa aplanada entre 30 y 50 UA. Plutón, Haumea y Makemake se calculan aparte con elementos JPL. Los trazadores no son objetos catalogados.','https://science.nasa.gov/solar-system/kuiper-belt/'],
 ['scattered-disc','Disco disperso','belts',150,'Distribución pedagógica de órbitas excéntricas e inclinadas más allá de Neptuno. Los límites no son fronteras precisas. Eris y Sedna se muestran aparte como cuerpos individuales; Sedna pertenece a la población de objetos separados.','https://science.nasa.gov/solar-system/kuiper-belt/'],
 ['heliosphere','Heliosfera','heliosphere',180,'Envolvente esquemática del dominio del viento solar. Se usa una geometría axisimétrica ilustrativa, con escala de referencia de unas 120 UA; su orientación y elongación no representan una medición completa. La forma real y el límite cambian y siguen bajo estudio; no es una superficie medida completa.','https://science.nasa.gov/heliophysics/focus-areas/heliosphere/'],
 ['oort-cloud','Nube de Oort','oort',100000,'Población hipotética de cuerpos helados: componente interior aplanada entre 2.000 y 20.000 UA y envolvente exterior entre 20.000 y 100.000 UA. Distribución estadística ilustrativa, no objetos observados ni un límite exacto.','https://science.nasa.gov/solar-system/oort-cloud/'],
 ].map(([id,name,layer,au,summary,url])=>common(id,name,layer,[0,0,0],au*AU_KM/LY_KM,summary,'NASA · modelo ilustrativo de región',url,{solarRegion:true,evidence:'Modelo',modeled:true,kind:'solar-region',viewDistanceKm:au*AU_KM*3})),
 ...[
 ['pleiades','Pléyades · M45',56.75,24.117,444,18,'open'],
 ['hyades','Híades',66.75,15.87,153,20,'open'],
 ['omega-centauri','Omega Centauri · NGC 5139',201.697,-47.479,17000,85,'globular'],
 ['hercules-cluster','Hércules · M13',250.423,36.461,23000,75,'globular'],
 ['47-tucanae','47 Tucanae',6.024,-72.081,14700,65,'globular'],
 ].map(([id,name,ra,dec,ly,radius,profile])=>common(id,name,'clusters',eq(ra,dec,ly),radius,`${name}: centro, distancia y extensión de referencia aproximados. La distribución interna de estrellas es un modelo ${profile==='open'?'disperso de cúmulo abierto':'concentrado de cúmulo globular'}; no identifica miembros individuales ni reproduce sus posiciones medidas. El número de trazadores es una elección visual.`,profile==='open'?'SIMBAD / referencias de cúmulos · población modelada':'Harris 2010 / referencias de cúmulos · población modelada',profile==='open'?'https://simbad.cds.unistra.fr/':'https://physics.mcmaster.ca/~harris/mwgc.dat',{kind:'stellar-cluster',profile,evidence:'Modelo',modeled:true,color:profile==='open'?'#a5caff':'#ffe0a3'})),
 ...[
 ['orion','Nebulosa de Orión · M42',83.79054167,-5.41397778,1350,30.03,'Región de formación estelar; mosaico observado Hubble.'],
 ['crab','Nebulosa del Cangrejo · M1',83.63554167,22.01524167,6500,6.41,'Remanente de supernova; mosaico observado Hubble.'],
 ['helix','Nebulosa de la Hélice',337.41591667,-20.83883611,650,26.64,'Nebulosa planetaria; imagen observada Hubble y telescopios terrestres.'],
 ].map(([id,name,ra,dec,ly,fov,text])=>common(id,name,'nebulae',eq(ra,dec,ly),ly*Math.tan(fov/60*Math.PI/360),`${text} Se sitúa una fotografía plana con su campo angular y orientación observada, no un volumen inventado. Distancia de referencia aproximada. Al girar se aprecia el plano de imagen; consulta los créditos completos en la enciclopedia.`, 'NASA / ESA / Hubble · fotografía observada',`https://esahubble.org/images/${({orion:'heic0601a',crab:'heic0515a',helix:'heic0307a'})[id]}/`,{kind:'nebula',fovDeg:fov/60,evidence:'Observación',image:'atlas/'+id+'.jpg',northAngle:id==='helix'?.4:0})),
];
export function seeded(seed=42){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function equatorialBasis(position){
 // Arrays in the scene's ecliptic frame. Up is the north celestial pole projected onto the image plane.
 const length=Math.hypot(...position),normal=position.map(x=>-x/length),north=equatorialPosition(0,90,1);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 let right=cross(north,normal);const r=Math.hypot(...right);right=right.map(x=>x/r);
 return {right,up:cross(normal,right),normal};
}
