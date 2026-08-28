export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_MU = 398600.4418;
export const CURRENT_GP_WINDOW_DAYS = 14;

export function isCatalogDateReliable(referenceDate, simulationDate, windowDays = CURRENT_GP_WINDOW_DAYS) {
  if (!referenceDate) return true;
  const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const simulation = simulationDate instanceof Date ? simulationDate : new Date(simulationDate);
  if (Number.isNaN(reference.valueOf()) || Number.isNaN(simulation.valueOf())) return false;
  return Math.abs(simulation - reference) <= windowDays * 86_400_000;
}

export const ORBIT_STYLES = {
  LEO: { label: 'Órbita terrestre baja', color: '#5ad7ff' },
  MEO: { label: 'Órbita terrestre media', color: '#c78aff' },
  GEO: { label: 'Órbita geoestacionaria', color: '#ffbe68' },
  HEO: { label: 'Órbita elíptica / otra', color: '#ff6f91' },
};

export const GROUP_STYLES = {
  starlink: { label: 'Starlink', color: '#6ee7ff' },
  oneweb: { label: 'OneWeb', color: '#8ae0c0' },
  amazonleo: { label: 'Amazon Leo', color: '#ffb56a' },
  qianfan: { label: 'Qianfan', color: '#e27cff' },
  guowang: { label: 'Guowang', color: '#e8d06c' },
  gps: { label: 'GPS', color: '#69a7ff' },
  galileo: { label: 'Galileo', color: '#84c7ff' },
  glonass: { label: 'GLONASS', color: '#ff8175' },
  beidou: { label: 'BeiDou', color: '#ffcf62' },
  weather: { label: 'Meteorología', color: '#73dbb1' },
  science: { label: 'Ciencia', color: '#c597ff' },
  earthobs: { label: 'Observación terrestre', color: '#7ce394' },
  stations: { label: 'Estaciones espaciales', color: '#ffffff' },
  communications: { label: 'Comunicaciones', color: '#50b8d8' },
  other: { label: 'Otros activos', color: '#78909c' },
};

const GROUP_RULES = [
  ['stations', /^(ISS \(ZARYA\)|TIANHE|CSS |CSS\(|SOYUZ-MS|PROGRESS-MS|CYGNUS|DRAGON|CREW DRAGON|SHENZHOU|TIANZHOU)/i],
  ['starlink', /^STARLINK/i],
  ['oneweb', /^(ONEWEB|EUTELSAT ONEWEB)/i],
  ['amazonleo', /^(KUIPER|AMAZON LEO)/i],
  ['qianfan', /^(QIANFAN|G60 STARLINK|SPACE SAIL)/i],
  ['guowang', /^(GUOWANG|HULIANWANG|GW[- ])/i],
  ['gps', /^(GPS |NAVSTAR)/i],
  ['galileo', /^(GALILEO|GSAT0)/i],
  ['glonass', /^(COSMOS .+\(GLONASS\)|GLONASS)/i],
  ['beidou', /^(BEIDOU|BD[- ]|COMPASS)/i],
  ['weather', /^(GOES|METEOSAT|METEOR-M|NOAA |HIMAWARI|FENGYUN|FY-|ELEKTRO|GEO-KOMPSAT|SUOMI NPP|JPSS|METOP|INSAT|OCEANSAT)/i],
  ['science', /^(HST|HUBBLE|JWST|TESS|CHEOPS|GAIA|IXPE|NUSTAR|SWIFT|CHANDRA|XMM|FERMI|SPEKTR|SOLAR ORBITER|PARKER SOLAR|ASTROSAT)/i],
  ['earthobs', /^(LANDSAT|SENTINEL|TERRA|AQUA|ICESAT|SWOT|NISAR|RADARSAT|WORLDVIEW|PLEIADES|CARTOSAT|RESURS|GAOFEN|YAOGAN|ICEYE|CAPELLA|SKYSAT|PLANET|FLOCK|LEMUR)/i],
  ['communications', /^(IRIDIUM|GLOBALSTAR|ORBCOMM|INTELSAT|EUTELSAT|SES |O3B|INMARSAT|TDRS|TELSTAR|TURKSAT|ARABSAT|NUSANTARA|VIASAT)/i],
];

export function orbitalMetrics(omm) {
  const meanMotion = Number(omm.MEAN_MOTION) || 1;
  const eccentricity = Number(omm.ECCENTRICITY) || 0;
  const angularRate = meanMotion * Math.PI * 2 / 86400;
  const semiMajorAxis = Math.cbrt(EARTH_MU / (angularRate * angularRate));
  const perigee = Math.max(0, semiMajorAxis * (1 - eccentricity) - EARTH_RADIUS_KM);
  const apogee = Math.max(0, semiMajorAxis * (1 + eccentricity) - EARTH_RADIUS_KM);
  const meanAltitude = Math.max(0, semiMajorAxis - EARTH_RADIUS_KM);
  const periodMinutes = 1440 / meanMotion;

  let orbit = 'HEO';
  if (apogee < 2000) orbit = 'LEO';
  else if (Math.abs(meanMotion - 1.0027) < 0.12 && eccentricity < 0.12) orbit = 'GEO';
  else if (eccentricity < 0.2 && meanAltitude < 30000) orbit = 'MEO';

  return { meanMotion, eccentricity, semiMajorAxis, perigee, apogee, meanAltitude, periodMinutes, orbit };
}

export function classifyObject(name = '') {
  for (const [key, matcher] of GROUP_RULES) {
    if (matcher.test(name)) return key;
  }
  return 'other';
}

export function prepareRecord(omm, satrec, catalogKind = 'active') {
  const name = String(omm.OBJECT_NAME || `NORAD ${omm.NORAD_CAT_ID || '—'}`).trim();
  const metrics = orbitalMetrics(omm);
  const group = classifyObject(name);
  return {
    name,
    id: String(omm.NORAD_CAT_ID || ''),
    internationalId: omm.OBJECT_ID || 'Sin designador',
    epoch: omm.EPOCH,
    inclination: Number(omm.INCLINATION) || 0,
    group,
    groupLabel: GROUP_STYLES[group].label,
    color: GROUP_STYLES[group].color,
    ...metrics,
    satrec,
    omm,
    catalogKind,
    isDebris: catalogKind === 'debris',
    position: null,
  };
}

export function describeRecord(record) {
  const libraryMatch = LIBRARY_ENTRIES.find((entry) => entry.keywords.some((word) => record.name.toUpperCase().includes(word)));
  if (libraryMatch) return libraryMatch.short;
  const orbitLabel = ORBIT_STYLES[record.orbit]?.label.toLowerCase() || 'órbita terrestre';
  const type = record.isDebris ? 'fragmento de basura espacial rastreado' : 'objeto del catálogo público';
  return `${record.name} es un ${type}, clasificado en ${orbitLabel}. Sus coordenadas se calculan para el instante mostrado mediante propagación SGP4.`;
}

export const LIBRARY_CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'constellation', label: 'Constelaciones' },
  { id: 'navigation', label: 'Navegación' },
  { id: 'science', label: 'Ciencia' },
  { id: 'weather', label: 'Clima y Tierra' },
  { id: 'station', label: 'Estaciones' },
  { id: 'deep-space', label: 'Espacio profundo' },
];

export const LIBRARY_ENTRIES = [
  {
    id: 'starlink', title: 'Starlink', subtitle: 'Constelación de internet · SpaceX', category: 'constellation', accent: '#6ee7ff',
    keywords: ['STARLINK'], searchName: 'STARLINK',
    short: 'Constelación comercial de comunicaciones en órbita baja, desplegada en múltiples planos, generaciones e inclinaciones.',
    body: 'Starlink es una megaconstelación de satélites de comunicaciones en LEO. ScanSat identifica cada unidad por su número NORAD y conserva sus diferencias reales de altitud, inclinación, época orbital y plano visible.',
    facts: [['Régimen', 'LEO'], ['Función', 'Internet de banda ancha'], ['Operador', 'SpaceX'], ['Estado', 'Despliegue continuo']],
  },
  {
    id: 'oneweb', title: 'OneWeb', subtitle: 'Constelación de internet · Eutelsat', category: 'constellation', accent: '#8ae0c0',
    keywords: ['ONEWEB'], searchName: 'ONEWEB',
    short: 'Red de comunicaciones en órbita polar baja diseñada para cobertura global.',
    body: 'La constelación OneWeb utiliza planos casi polares y una altitud superior a Starlink. Su geometría regular resulta especialmente visible en la vista tridimensional.',
    facts: [['Régimen', 'LEO polar'], ['Función', 'Conectividad global'], ['Operador', 'Eutelsat OneWeb'], ['Cobertura', 'Global']],
  },
  {
    id: 'amazon-leo', title: 'Amazon Leo', subtitle: 'Antes Project Kuiper', category: 'constellation', accent: '#ffb56a',
    keywords: ['KUIPER', 'AMAZON LEO'], searchName: 'KUIPER',
    short: 'Constelación de banda ancha de Amazon, conocida durante su desarrollo como Project Kuiper.',
    body: 'Amazon Leo amplía el ecosistema de constelaciones comerciales LEO. Sus unidades catalogadas aparecen automáticamente cuando están presentes en el conjunto activo de CelesTrak.',
    facts: [['Régimen', 'LEO'], ['Función', 'Banda ancha'], ['Operador', 'Amazon'], ['Nombre anterior', 'Project Kuiper']],
  },
  {
    id: 'qianfan', title: 'Qianfan', subtitle: 'Constelación china de banda ancha', category: 'constellation', accent: '#e27cff',
    keywords: ['QIANFAN', 'G60 STARLINK'], searchName: 'QIANFAN',
    short: 'Megaconstelación china de comunicaciones también conocida como Thousand Sails.',
    body: 'Qianfan forma parte de la nueva generación de redes de comunicaciones LEO. El catálogo se actualiza sin fijar de antemano el número de unidades desplegadas.',
    facts: [['Régimen', 'LEO'], ['Función', 'Comunicaciones'], ['País', 'China'], ['Alias', 'Thousand Sails']],
  },
  {
    id: 'guowang', title: 'Guowang', subtitle: 'Red satelital nacional china', category: 'constellation', accent: '#e8d06c',
    keywords: ['GUOWANG', 'HULIANWANG'], searchName: 'GUOWANG',
    short: 'Arquitectura china de comunicaciones de gran escala, catalogada por sus identificadores públicos.',
    body: 'ScanSat agrupa bajo Guowang los nombres públicos asociados a esta red. Las unidades sin denominación estable permanecen visibles como otros objetos activos.',
    facts: [['Régimen', 'LEO'], ['Función', 'Comunicaciones'], ['País', 'China'], ['Fuente', 'Catálogo público']],
  },
  {
    id: 'gps', title: 'GPS', subtitle: 'Global Positioning System', category: 'navigation', accent: '#69a7ff',
    keywords: ['GPS ', 'NAVSTAR'], searchName: 'GPS',
    short: 'Constelación estadounidense de navegación y sincronización en órbita terrestre media.',
    body: 'Los satélites GPS se distribuyen en varios planos MEO para ofrecer geometría de posicionamiento global. La vista de órbita permite distinguir claramente su cinturón orbital.',
    facts: [['Régimen', 'MEO'], ['Función', 'Navegación'], ['País', 'Estados Unidos'], ['Familia', 'NAVSTAR']],
  },
  {
    id: 'galileo', title: 'Galileo', subtitle: 'Sistema global europeo', category: 'navigation', accent: '#84c7ff',
    keywords: ['GALILEO', 'GSAT0'], searchName: 'GALILEO',
    short: 'Sistema civil europeo de navegación por satélite en órbita media.',
    body: 'Galileo aporta posicionamiento, navegación y tiempo desde una constelación MEO. Sus satélites aparecen con sus nombres GSAT o Galileo cuando así constan en el catálogo.',
    facts: [['Régimen', 'MEO'], ['Función', 'Navegación'], ['Entidad', 'Unión Europea / ESA'], ['Cobertura', 'Global']],
  },
  {
    id: 'glonass', title: 'GLONASS', subtitle: 'Sistema global ruso', category: 'navigation', accent: '#ff8175',
    keywords: ['GLONASS'], searchName: 'GLONASS',
    short: 'Constelación rusa de navegación global desplegada en órbita media.',
    body: 'GLONASS utiliza tres planos orbitales y satélites de varias generaciones. ScanSat conserva el nombre COSMOS cuando forma parte de la designación pública.',
    facts: [['Régimen', 'MEO'], ['Función', 'Navegación'], ['País', 'Rusia'], ['Cobertura', 'Global']],
  },
  {
    id: 'beidou', title: 'BeiDou', subtitle: 'Sistema de navegación chino', category: 'navigation', accent: '#ffcf62',
    keywords: ['BEIDOU', 'COMPASS'], searchName: 'BEIDOU',
    short: 'Arquitectura de navegación que combina satélites MEO, GEO e inclinados geosíncronos.',
    body: 'BeiDou destaca por mezclar regímenes orbitales. En ScanSat sus unidades pueden aparecer simultáneamente en los filtros MEO, GEO y HEO según sus elementos orbitales.',
    facts: [['Régimen', 'MEO / GEO / IGSO'], ['Función', 'Navegación'], ['País', 'China'], ['Cobertura', 'Global']],
  },
  {
    id: 'iss', title: 'Estación Espacial Internacional', subtitle: 'Laboratorio orbital tripulado', category: 'station', accent: '#ffffff',
    keywords: ['ISS (ZARYA)'], searchName: 'ISS (ZARYA)',
    short: 'La mayor infraestructura humana en órbita terrestre y principal laboratorio espacial tripulado internacional.',
    body: 'La ISS completa una vuelta a la Tierra aproximadamente cada hora y media. Su ficha muestra la posición calculada para el segundo actual, la altitud y la inclinación de su órbita.',
    facts: [['Régimen', 'LEO'], ['Función', 'Estación tripulada'], ['Inclinación', '≈ 51,6°'], ['Operación', 'Internacional']],
  },
  {
    id: 'tiangong', title: 'Tiangong', subtitle: 'Estación Espacial China', category: 'station', accent: '#f5d88a',
    keywords: ['TIANHE', 'CSS '], searchName: 'TIANHE',
    short: 'Estación orbital modular china, identificada en los catálogos por su módulo central Tianhe.',
    body: 'Tiangong está compuesta por varios módulos acoplados; el elemento orbital suele corresponder al conjunto o a Tianhe. Las naves Shenzhou y Tianzhou se muestran por separado cuando vuelan libres.',
    facts: [['Régimen', 'LEO'], ['Función', 'Estación tripulada'], ['País', 'China'], ['Módulo central', 'Tianhe']],
  },
  {
    id: 'hubble', title: 'Hubble', subtitle: 'Observatorio espacial', category: 'science', accent: '#c597ff',
    keywords: ['HST', 'HUBBLE'], searchName: 'HST',
    short: 'Telescopio espacial en órbita baja que ha transformado la astronomía desde 1990.',
    body: 'El Hubble orbita la Tierra y puede propagarse con el mismo modelo SGP4 que el resto de objetos del catálogo. Su órbita inclinada contrasta con las constelaciones polares modernas.',
    facts: [['Régimen', 'LEO'], ['Función', 'Astronomía'], ['Agencias', 'NASA / ESA'], ['Lanzamiento', '1990']],
  },
  {
    id: 'jwst', title: 'James Webb', subtitle: 'Observatorio en torno a L2', category: 'science', accent: '#f2a65a',
    keywords: ['JWST'], searchName: 'JWST',
    short: 'Observatorio infrarrojo que opera en una órbita de halo alrededor del punto Sol–Tierra L2.',
    body: 'JWST no es un satélite terrestre convencional: acompaña a la Tierra alrededor del Sol mientras recorre una órbita de halo en torno a L2. Por ello se contextualiza también en la vista del sistema solar.',
    facts: [['Régimen', 'Halo alrededor de L2'], ['Función', 'Astronomía infrarroja'], ['Agencias', 'NASA / ESA / CSA'], ['Lanzamiento', '2021']],
  },
  {
    id: 'sentinel', title: 'Copernicus Sentinel', subtitle: 'Observación terrestre europea', category: 'weather', accent: '#7ce394',
    keywords: ['SENTINEL'], searchName: 'SENTINEL',
    short: 'Familia europea de misiones para observar océanos, atmósfera, hielo y superficie terrestre.',
    body: 'Las misiones Sentinel combinan instrumentos ópticos, radar y altimetría. Cada nave se conserva como objeto independiente para poder comparar sus órbitas y planos.',
    facts: [['Régimen', 'Principalmente LEO polar'], ['Función', 'Observación terrestre'], ['Programa', 'Copernicus'], ['Entidades', 'UE / ESA']],
  },
  {
    id: 'landsat', title: 'Landsat', subtitle: 'Archivo terrestre de larga duración', category: 'weather', accent: '#9ee7ac',
    keywords: ['LANDSAT'], searchName: 'LANDSAT',
    short: 'Programa de observación de la superficie terrestre con continuidad histórica desde 1972.',
    body: 'Los Landsat activos recorren órbitas heliosíncronas para obtener iluminación comparable. ScanSat permite ver su geometría casi polar y distinguirlos del tráfico de comunicaciones.',
    facts: [['Régimen', 'LEO heliosíncrona'], ['Función', 'Observación terrestre'], ['Entidades', 'NASA / USGS'], ['Inicio del programa', '1972']],
  },
  {
    id: 'goes', title: 'GOES', subtitle: 'Meteorología geoestacionaria', category: 'weather', accent: '#73dbb1',
    keywords: ['GOES'], searchName: 'GOES',
    short: 'Familia estadounidense de satélites meteorológicos que vigilan continuamente el hemisferio occidental.',
    body: 'Desde GEO, los GOES mantienen una posición aparente casi fija sobre el ecuador. La vista completa permite comparar este anillo distante con el tráfico LEO.',
    facts: [['Régimen', 'GEO'], ['Función', 'Meteorología'], ['Entidades', 'NOAA / NASA'], ['Cobertura', 'Hemisferio occidental']],
  },
  {
    id: 'meteosat', title: 'Meteosat', subtitle: 'Meteorología europea', category: 'weather', accent: '#77e0ca',
    keywords: ['METEOSAT'], searchName: 'METEOSAT',
    short: 'Satélites geoestacionarios europeos para predicción meteorológica y vigilancia climática.',
    body: 'Meteosat mantiene observación continua desde el cinturón geoestacionario. Las distintas generaciones permanecen individualizadas en el catálogo.',
    facts: [['Régimen', 'GEO'], ['Función', 'Meteorología'], ['Operador', 'EUMETSAT'], ['Cobertura', 'Europa y África']],
  },
  {
    id: 'iridium', title: 'Iridium NEXT', subtitle: 'Comunicaciones globales', category: 'constellation', accent: '#50b8d8',
    keywords: ['IRIDIUM'], searchName: 'IRIDIUM',
    short: 'Constelación polar de comunicaciones móviles con cobertura global.',
    body: 'Iridium NEXT utiliza planos polares enlazados entre sí. Su patrón compacto permite reconocer una constelación operacional sin el volumen de una megaconstelación.',
    facts: [['Régimen', 'LEO polar'], ['Función', 'Comunicaciones móviles'], ['Operador', 'Iridium'], ['Cobertura', 'Global']],
  },
  {
    id: 'voyager-1', title: 'Voyager 1', subtitle: 'Misión interestelar', category: 'deep-space', accent: '#ffd47d',
    keywords: ['VOYAGER 1'], searchName: null,
    short: 'Sonda de 1977 que continúa alejándose del Sol más allá de la heliosfera.',
    body: 'Voyager 1 no se representa con SGP4. ScanSat obtiene su vector heliocéntrico de NASA/JPL Horizons y conserva su enorme distancia en kilómetros físicos mediante un origen flotante alrededor del foco.',
    facts: [['Destino', 'Medio interestelar'], ['Agencia', 'NASA / JPL'], ['Lanzamiento', '1977'], ['Efeméride', 'JPL Horizons']],
  },
  {
    id: 'voyager-2', title: 'Voyager 2', subtitle: 'Misión interestelar', category: 'deep-space', accent: '#ffb667',
    keywords: ['VOYAGER 2'], searchName: null,
    short: 'Única sonda que visitó Urano y Neptuno; continúa su trayectoria interestelar.',
    body: 'La trayectoria real de Voyager 2 exige efemérides de espacio profundo. ScanSat utiliza un vector J2000 de NASA/JPL Horizons y la separa claramente del catálogo SGP4 terrestre.',
    facts: [['Destino', 'Medio interestelar'], ['Agencia', 'NASA / JPL'], ['Lanzamiento', '1977'], ['Efeméride', 'JPL Horizons']],
  },
  {
    id: 'new-horizons', title: 'New Horizons', subtitle: 'Exploración del cinturón de Kuiper', category: 'deep-space', accent: '#9ac8ff',
    keywords: ['NEW HORIZONS'], searchName: null,
    short: 'Sonda que sobrevoló Plutón y Arrokoth y prosigue hacia el exterior del sistema solar.',
    body: 'New Horizons se incluye mediante su vector heliocéntrico J2000 de NASA/JPL Horizons. La escena mantiene su distancia física aunque utiliza un icono para conservar la legibilidad.',
    facts: [['Región', 'Cinturón de Kuiper'], ['Agencia', 'NASA'], ['Lanzamiento', '2006'], ['Efeméride', 'JPL Horizons']],
  },
  {
    id: 'parker', title: 'Parker Solar Probe', subtitle: 'Observatorio solar', category: 'deep-space', accent: '#ff8c45',
    keywords: ['PARKER SOLAR'], searchName: null,
    short: 'Sonda solar en una órbita muy excéntrica que realiza aproximaciones extremas al Sol.',
    body: 'Parker estudia la corona y el viento solar. Su posición procede de NASA/JPL Horizons y se muestra con un icono propio sobre una escena heliocéntrica de escala física.',
    facts: [['Centro orbital', 'Sol'], ['Agencia', 'NASA'], ['Lanzamiento', '2018'], ['Efeméride', 'JPL Horizons']],
  },
  {
    id: 'juice', title: 'JUICE', subtitle: 'Explorador de lunas de Júpiter', category: 'deep-space', accent: '#d9bc8d',
    keywords: ['JUICE'], searchName: null,
    short: 'Misión europea en ruta al sistema joviano para estudiar Ganímedes, Calisto y Europa.',
    body: 'JUICE aparece como misión interplanetaria en tránsito mediante una efeméride heliocéntrica de NASA/JPL Horizons. La biblioteca diferencia estas trayectorias de las órbitas terrestres OMM.',
    facts: [['Destino', 'Júpiter'], ['Agencia', 'ESA'], ['Lanzamiento', '2023'], ['Efeméride', 'JPL Horizons']],
  },
  {
    id: 'roadster', title: 'Tesla Roadster', subtitle: 'Carga de demostración Falcon Heavy', category: 'deep-space', accent: '#ef6b6b',
    keywords: ['ROADSTER'], searchName: null,
    short: 'Carga de demostración situada en una órbita heliocéntrica que cruza aproximadamente la región orbital de Marte.',
    body: 'El Roadster no orbita entre la Tierra y Marte como un satélite de ambos cuerpos: sigue su propia órbita alrededor del Sol. ScanSat usa la efeméride del objetivo SpaceX Roadster de JPL Horizons.',
    facts: [['Centro orbital', 'Sol'], ['Lanzamiento', '2018'], ['Vehículo', 'Falcon Heavy'], ['Efeméride', 'JPL Horizons']],
  },
];

export const SOLAR_BODIES = [
  { id: 'mercury', name: 'Mercurio', distance: 1.6, radius: 0.045, color: '#a9a29b', period: 87.97 },
  { id: 'venus', name: 'Venus', distance: 2.1, radius: 0.075, color: '#d2a866', period: 224.7 },
  { id: 'earth', name: 'Tierra', distance: 2.8, radius: 0.08, color: '#4aa8da', period: 365.26 },
  { id: 'mars', name: 'Marte', distance: 3.45, radius: 0.06, color: '#c66a47', period: 686.98 },
  { id: 'jupiter', name: 'Júpiter', distance: 4.6, radius: 0.19, color: '#d7b28b', period: 4332.6 },
  { id: 'saturn', name: 'Saturno', distance: 5.7, radius: 0.16, color: '#d7c58f', period: 10759 },
  { id: 'uranus', name: 'Urano', distance: 6.7, radius: 0.11, color: '#92d5df', period: 30687 },
  { id: 'neptune', name: 'Neptuno', distance: 7.6, radius: 0.105, color: '#4e79d8', period: 60190 },
];

export const DEEP_SPACE_MARKERS = [
  { id: 'parker', name: 'Parker Solar Probe', distance: 1.15, angle: 1.9, color: '#ff8c45' },
  { id: 'roadster', name: 'Tesla Roadster', distance: 3.1, angle: 5.0, color: '#ef6b6b' },
  { id: 'juice', name: 'JUICE', distance: 4.05, angle: 3.8, color: '#d9bc8d' },
  { id: 'new-horizons', name: 'New Horizons', distance: 9.2, angle: 0.45, color: '#9ac8ff' },
  { id: 'voyager-1', name: 'Voyager 1', distance: 10.8, angle: 2.7, color: '#ffd47d' },
  { id: 'voyager-2', name: 'Voyager 2', distance: 9.9, angle: 4.65, color: '#ffb667' },
];

export const LUNAR_OBJECTS = [
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter', agency: 'NASA', altitude: 50, color: '#d6efff' },
  { id: 'capstone', name: 'CAPSTONE', agency: 'NASA', altitude: 3200, color: '#7cd6ff' },
  { id: 'danuri', name: 'Danuri / KPLO', agency: 'KARI', altitude: 100, color: '#f0ca75' },
  { id: 'queqiao2', name: 'Queqiao-2', agency: 'CNSA', altitude: 8600, color: '#ff887b' },
];
