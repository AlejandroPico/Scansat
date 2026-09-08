// All distances share one physical metric. Rendering units never change ratios.
export const LY_KM = 9.4607304725808e12;
export const PC_KM = 3.0856775814913673e13;
export const OBSERVABLE_RADIUS_KM = 46.5e9 * LY_KM;
const DEG = Math.PI / 180;
export function equatorialPosition(raHours, decDegrees, distanceKm) {
  const a = raHours * Math.PI / 12, d = decDegrees * DEG, e = 23.43928 * DEG;
  const x = distanceKm * Math.cos(d) * Math.cos(a);
  const y = distanceKm * Math.cos(d) * Math.sin(a);
  const z = distanceKm * Math.sin(d);
  return [x, z * Math.cos(e) - y * Math.sin(e), -y * Math.cos(e) - z * Math.sin(e)];
}
// IAU J2000 Galactic -> equatorial rotation (transpose of the standard matrix).
export function galacticPosition(x, y, z) {
  const eq = [-.0548755604*x+.4941094279*y-.867666149*z, -.8734370902*x-.44482963*y-.1980763734*z, -.4838350155*x+.7469822445*y+.4559837762*z];
  const e = 23.43928 * DEG;
  return [eq[0], eq[2]*Math.cos(e)-eq[1]*Math.sin(e), -eq[1]*Math.cos(e)-eq[2]*Math.sin(e)];
}
export function renderingUnit(distanceKm) { return Math.max(1, distanceKm / 10000); }
export function scaleLevel(km) {
  const ly = km / LY_KM;
  if (km < 2e6) return {name:'Entorno orbital', evidence:'OMM / SGP4 · posiciones calculadas'};
  if (ly < .03) return {name:'Sistema solar', evidence:'JPL · órbitas y radios físicos'};
  if (ly < 10) return {name:'Vecindad solar', evidence:'HYG · estrellas catalogadas en 3D'};
  if (ly < 8000) return {name:'Vecindad estelar', evidence:'HYG · distancias de catálogo; cobertura incompleta'};
  if (ly < 8e5) return {name:'Vía Láctea', evidence:'Estructura galáctica reconstruida + catálogo HYG'};
  if (ly < 2e7) return {name:'Grupo Local', evidence:'Galaxias de referencia · distancias aproximadas'};
  if (ly < 1e9) return {name:'Laniakea y supercúmulos', evidence:'Referencias observadas + filamentos ilustrativos'};
  return {name:'Universo observable', evidence:'Reconstrucción ilustrativa · distancias comóviles actuales'};
}
const nasa = 'https://science.nasa.gov/universe/galaxies/';
const objects = [
  ['milky-way','Vía Láctea',17.7603,-28.936,26670,52000,'galaxy','Galaxia espiral barrada. El Sol está a unos 26.700 años luz del centro. El disco y los brazos son una reconstrucción de su estructura, no un catálogo de cada estrella.'],
  ['lmc','Gran Nube de Magallanes',5.391,-69.756,163000,7000,'galaxy','Galaxia satélite irregular de la Vía Láctea, con regiones de formación estelar como la nebulosa de la Tarántula.'],
  ['smc','Pequeña Nube de Magallanes',.879,-72.828,200000,3500,'galaxy','Galaxia enana irregular del Grupo Local. Su forma refleja interacciones gravitatorias con la Gran Nube y la Vía Láctea.'],
  ['andromeda','Andrómeda · M31',.7123,41.269,2.537e6,110000,'galaxy','Gran galaxia espiral del Grupo Local. La distancia y dirección sitúan su centro; los brazos mostrados son una reconstrucción morfológica.'],
  ['triangulum','Triángulo · M33',1.564,30.66,2.73e6,30000,'galaxy','Galaxia espiral del Grupo Local, menor que Andrómeda y la Vía Láctea.'],
  ['m81','Bode · M81',9.926,69.065,11.74e6,45000,'galaxy','Galaxia espiral dominante del grupo M81; interactúa con la cercana M82.'],
  ['m82','Cigarro · M82',9.931,69.679,11.5e6,18500,'galaxy','Galaxia con intensa formación estelar y un viento galáctico que expulsa gas fuera de su disco.'],
  ['centaurus-a','Centaurus A · NGC 5128',13.425,-43.019,12e6,60000,'galaxy','Galaxia activa con una banda de polvo y chorros alimentados por un agujero negro supermasivo.'],
  ['sculptor','Escultor · NGC 253',.793,-25.288,11.4e6,45000,'galaxy','Galaxia espiral cercana vista de canto, con intensa formación de estrellas en su región central.'],
  ['m87','Virgo A · M87',12.514,12.391,53.5e6,60000,'galaxy','Galaxia elíptica gigante del cúmulo de Virgo. Alberga M87*, el agujero negro cuya sombra obtuvo el Event Horizon Telescope.'],
  ['virgo','Cúmulo de Virgo',12.45,12.7,54e6,7.5e6,'cluster','Cúmulo de galaxias cercano dominado por galaxias gigantes como M87. No debe confundirse con una constelación de estrellas.'],
  ['fornax','Cúmulo de Fornax',3.635,-35.45,62e6,3e6,'cluster','Cúmulo cercano de galaxias, más compacto y menos masivo que Virgo.'],
  ['coma','Cúmulo de Coma',12.99,27.98,321e6,10e6,'cluster','Rico cúmulo de galaxias usado para estudiar la materia oscura y la evolución galáctica.'],
  ['perseus','Cúmulo de Perseo',3.33,41.5,240e6,6e6,'cluster','Cúmulo masivo con gas caliente emisor de rayos X y actividad del agujero negro central de NGC 1275.'],
  ['great-attractor','Gran Atractor',16.25,-60.9,200e6,30e6,'structure','Región de concentración de masa asociada a Norma y a los flujos de galaxias locales. No es un objeto puntual ni un agujero negro que absorba el universo. Su distancia es aproximada.'],
  ['laniakea','Laniakea',10.5,-46,160e6,260e6,'structure','Cuenca de atracción definida a partir de velocidades peculiares de galaxias, de unos 160 Mpc de extensión. No es un cúmulo virializado. El marcador es una referencia regional, no un centro físico exacto; la envolvente y filamentos son ilustrativos.'],
  ['shapley','Concentración de Shapley',13.5,-30,650e6,80e6,'structure','Concentración masiva de cúmulos que contribuye al campo gravitatorio a gran escala.'],
  ['observable-universe','Universo observable',0,0,0,46.5e9,'universe','Volumen del que la luz ha podido alcanzarnos. Su radio comóvil actual es aproximadamente 46.500 millones de años luz. El borde no es una pared ni el límite de todo el universo. La red representa estadísticamente filamentos, nodos y vacíos; no reproduce las posiciones de todas las galaxias.'],
];
export const COSMIC_OBJECTS = objects.map(([id,name,ra,dec,distanceLy,radiusLy,kind,summary])=>({
  id,name,ra,dec,distanceLy,radiusLy,kind,summary,cosmic:true,
  position:equatorialPosition(ra,dec,distanceLy*LY_KM),
  viewDistanceKm:radiusLy*LY_KM*4,
  color:kind==='galaxy'?'#cadbff':kind==='cluster'?'#ffd39a':'#ba9bff',
  source:'Referencia astronómica · geometría aproximada',
  sourceUrl:['laniakea','great-attractor','shapley'].includes(id)?'https://arxiv.org/abs/1409.0880':nasa,
}));
export const SCALE_STOPS = [
  {name:'Tierra',id:'earth',km:26000}, {name:'Luna',id:'earth',km:1.2e6},
  {name:'Sistema solar',id:'sun',km:1.5e10}, {name:'Estrellas',id:'sun',km:40*LY_KM},
  {name:'Vía Láctea',id:'milky-way',km:200000*LY_KM},
  {name:'Grupo Local',id:'milky-way',km:8e6*LY_KM},
  {name:'Laniakea',id:'laniakea',km:900e6*LY_KM},
  {name:'Universo',id:'observable-universe',km:120e9*LY_KM},
];
export function segmentOccluded(camera, point, center, radius) {
  const d=point.map((v,i)=>v-camera[i]), c=center.map((v,i)=>v-camera[i]);
  const len2=d.reduce((s,v)=>s+v*v,0);
  const t=d.reduce((s,v,i)=>s+v*c[i],0)/len2;
  if (!(t>0 && t<1)) return false;
  return c.reduce((s,v,i)=>s+(v-t*d[i])**2,0)<radius*radius*.999;
}
