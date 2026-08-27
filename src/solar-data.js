export const AU_KM = 149_597_870.7;
export const J2000_JD = 2_451_545;

const PLANET_ELEMENTS = {
  mercury: {
    base: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  },
  venus: {
    base: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  },
  earth: {
    base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  },
  mars: {
    base: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
  jupiter: {
    base: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  },
  saturn: {
    base: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  },
  uranus: {
    base: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  },
  neptune: {
    base: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  },
};

export const CELESTIAL_BODIES = [
  { id: 'sun', name: 'Sol', parent: null, radiusKm: 696_340, color: '#ffbd65', texture: 'sun.jpg', rotationHours: 609.12, type: 'star' },
  { id: 'mercury', name: 'Mercurio', parent: 'sun', radiusKm: 2_439.7, color: '#a7a39d', texture: 'mercury.jpg', rotationHours: 1407.6, type: 'planet' },
  { id: 'venus', name: 'Venus', parent: 'sun', radiusKm: 6_051.8, color: '#d7aa69', texture: 'venus.jpg', rotationHours: -5832.5, type: 'planet' },
  { id: 'earth', name: 'Tierra', parent: 'sun', radiusKm: 6_378.137, color: '#5ab9e8', texture: 'earth-day.jpg', rotationHours: 23.9344696, type: 'planet' },
  { id: 'moon', name: 'Luna', parent: 'earth', radiusKm: 1_737.4, color: '#c7c6c2', texture: 'moon.jpg', orbitKm: 384_400, periodDays: 27.321661, inclination: 5.145, rotationHours: 655.7199, type: 'moon' },
  { id: 'mars', name: 'Marte', parent: 'sun', radiusKm: 3_389.5, color: '#bf694c', texture: 'mars.jpg', rotationHours: 24.6229, type: 'planet' },
  { id: 'phobos', name: 'Fobos', parent: 'mars', radiusKm: 11.267, color: '#8d8174', orbitKm: 9_376, periodDays: 0.31891, inclination: 1.093, rotationHours: 7.6538, type: 'moon' },
  { id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, color: '#9e9183', orbitKm: 23_463, periodDays: 1.26244, inclination: 0.93, rotationHours: 30.2986, type: 'moon' },
  { id: 'jupiter', name: 'Júpiter', parent: 'sun', radiusKm: 69_911, color: '#d4aa82', texture: 'jupiter.jpg', rotationHours: 9.925, type: 'planet' },
  { id: 'io', name: 'Ío', parent: 'jupiter', radiusKm: 1_821.6, color: '#d7c25a', orbitKm: 421_800, periodDays: 1.769138, inclination: 0.05, type: 'moon' },
  { id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1_560.8, color: '#b9aa8d', orbitKm: 671_100, periodDays: 3.551181, inclination: 0.47, type: 'moon' },
  { id: 'ganymede', name: 'Ganímedes', parent: 'jupiter', radiusKm: 2_634.1, color: '#988879', orbitKm: 1_070_400, periodDays: 7.154553, inclination: 0.2, type: 'moon' },
  { id: 'callisto', name: 'Calisto', parent: 'jupiter', radiusKm: 2_410.3, color: '#786d62', orbitKm: 1_882_700, periodDays: 16.689018, inclination: 0.28, type: 'moon' },
  { id: 'saturn', name: 'Saturno', parent: 'sun', radiusKm: 58_232, color: '#d8c08e', texture: 'saturn.jpg', rotationHours: 10.656, rings: true, type: 'planet' },
  { id: 'enceladus', name: 'Encélado', parent: 'saturn', radiusKm: 252.1, color: '#dededb', orbitKm: 237_948, periodDays: 1.370218, inclination: 0.009, type: 'moon' },
  { id: 'titan', name: 'Titán', parent: 'saturn', radiusKm: 2_574.73, color: '#c58d42', orbitKm: 1_221_870, periodDays: 15.945421, inclination: 0.34854, type: 'moon' },
  { id: 'uranus', name: 'Urano', parent: 'sun', radiusKm: 25_362, color: '#8bd5dd', texture: 'uranus.jpg', rotationHours: -17.24, type: 'planet' },
  { id: 'neptune', name: 'Neptuno', parent: 'sun', radiusKm: 24_622, color: '#4167cb', texture: 'neptune.jpg', rotationHours: 16.11, type: 'planet' },
  { id: 'triton', name: 'Tritón', parent: 'neptune', radiusKm: 1_353.4, color: '#b9b3ac', orbitKm: 354_759, periodDays: -5.876854, inclination: 156.885, type: 'moon' },
];

export const SURFACE_SITES = [
  { id: 'apollo-11', name: 'Apollo 11 · Tranquility Base', body: 'moon', lat: 0.674, lon: 23.473, kind: 'landing', status: 'Histórico', agency: 'NASA', color: '#f4d58d' },
  { id: 'apollo-12', name: 'Apollo 12 · Oceanus Procellarum', body: 'moon', lat: -3.0128, lon: -23.4219, kind: 'landing', status: 'Histórico', agency: 'NASA', color: '#f4d58d' },
  { id: 'apollo-15', name: 'Apollo 15 · Hadley–Apennine', body: 'moon', lat: 26.1322, lon: 3.6339, kind: 'landing', status: 'Histórico', agency: 'NASA', color: '#f4d58d' },
  { id: 'apollo-17', name: 'Apollo 17 · Taurus–Littrow', body: 'moon', lat: 20.1908, lon: 30.7717, kind: 'landing', status: 'Histórico', agency: 'NASA', color: '#f4d58d' },
  { id: 'lunokhod-1', name: 'Lunokhod 1', body: 'moon', lat: 38.237, lon: -35.001, kind: 'rover', status: 'Histórico', agency: 'URSS', color: '#ef767a' },
  { id: 'yutu-2', name: 'Yutu-2 · Chang’e 4', body: 'moon', lat: -45.457, lon: 177.589, kind: 'rover', status: 'Misión lunar', agency: 'CNSA', color: '#ef767a' },
  { id: 'chandrayaan-3', name: 'Vikram / Pragyan · Chandrayaan-3', body: 'moon', lat: -69.373, lon: 32.319, kind: 'rover', status: 'Misión completada', agency: 'ISRO', color: '#ef767a' },
  { id: 'slim', name: 'SLIM', body: 'moon', lat: -13.316, lon: 25.251, kind: 'landing', status: 'Misión completada', agency: 'JAXA', color: '#f4d58d' },
  { id: 'perseverance', name: 'Perseverance', body: 'mars', lat: 18.4447, lon: 77.4508, kind: 'rover', status: 'Activo', agency: 'NASA / JPL', color: '#67e8b5' },
  { id: 'curiosity', name: 'Curiosity', body: 'mars', lat: -4.5895, lon: 137.4417, kind: 'rover', status: 'Activo', agency: 'NASA / JPL', color: '#67e8b5' },
  { id: 'insight', name: 'InSight', body: 'mars', lat: 4.5024, lon: 135.6234, kind: 'landing', status: 'Histórico', agency: 'NASA / JPL', color: '#f4d58d' },
  { id: 'opportunity', name: 'Opportunity', body: 'mars', lat: -1.9462, lon: 354.4734, kind: 'rover', status: 'Histórico', agency: 'NASA / JPL', color: '#ef767a' },
  { id: 'spirit', name: 'Spirit', body: 'mars', lat: -14.5684, lon: 175.4726, kind: 'rover', status: 'Histórico', agency: 'NASA / JPL', color: '#ef767a' },
  { id: 'zhurong', name: 'Zhurong', body: 'mars', lat: 25.066, lon: 109.925, kind: 'rover', status: 'Inactivo', agency: 'CNSA', color: '#ef767a' },
  { id: 'venera-7', name: 'Venera 7', body: 'venus', lat: -5, lon: 351, kind: 'landing', status: 'Histórico · coordenadas aproximadas', agency: 'URSS', color: '#f4d58d' },
  { id: 'venera-9', name: 'Venera 9', body: 'venus', lat: 31.01, lon: 291.64, kind: 'landing', status: 'Histórico', agency: 'URSS', color: '#f4d58d' },
  { id: 'venera-13', name: 'Venera 13', body: 'venus', lat: -7.55, lon: 303.69, kind: 'landing', status: 'Histórico', agency: 'URSS', color: '#f4d58d' },
  { id: 'venera-14', name: 'Venera 14', body: 'venus', lat: -13.25, lon: 310, kind: 'landing', status: 'Histórico', agency: 'URSS', color: '#f4d58d' },
];

export const LOCAL_ORBITERS = [
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter', parent: 'moon', altitudeKm: 50, periodHours: 1.95, inclination: 90, agency: 'NASA', color: '#91d5ff' },
  { id: 'capstone', name: 'CAPSTONE', parent: 'moon', periapsisKm: 1_500, apoapsisKm: 70_000, periodHours: 156, inclination: 90, agency: 'NASA', color: '#d6a6ff' },
  { id: 'danuri', name: 'Danuri · KPLO', parent: 'moon', altitudeKm: 100, periodHours: 2.0, inclination: 90, agency: 'KARI', color: '#7ee6c4' },
  { id: 'queqiao-2', name: 'Queqiao-2', parent: 'moon', periapsisKm: 200, apoapsisKm: 16_000, periodHours: 24, inclination: 55, agency: 'CNSA', color: '#ffb970' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter', parent: 'mars', altitudeKm: 300, periodHours: 1.86, inclination: 93, agency: 'NASA / JPL', color: '#91d5ff' },
  { id: 'maven', name: 'MAVEN', parent: 'mars', periapsisKm: 150, apoapsisKm: 6_200, periodHours: 4.5, inclination: 75, agency: 'NASA', color: '#d6a6ff' },
  { id: 'mars-express', name: 'Mars Express', parent: 'mars', periapsisKm: 300, apoapsisKm: 10_100, periodHours: 7.5, inclination: 86, agency: 'ESA', color: '#7ee6c4' },
  { id: 'tgo', name: 'ExoMars Trace Gas Orbiter', parent: 'mars', altitudeKm: 400, periodHours: 2.0, inclination: 74, agency: 'ESA / Roscosmos', color: '#ffb970' },
];

export const LAGRANGE_OBJECTS = [
  { id: 'sun-earth-l1', name: 'Sol–Tierra L1', point: 'L1', system: 'sun-earth', kind: 'lagrange', color: '#79d9ff' },
  { id: 'sun-earth-l2', name: 'Sol–Tierra L2', point: 'L2', system: 'sun-earth', kind: 'lagrange', color: '#79d9ff' },
  { id: 'sun-earth-l3', name: 'Sol–Tierra L3', point: 'L3', system: 'sun-earth', kind: 'lagrange', color: '#79d9ff' },
  { id: 'sun-earth-l4', name: 'Sol–Tierra L4', point: 'L4', system: 'sun-earth', kind: 'lagrange', color: '#79d9ff' },
  { id: 'sun-earth-l5', name: 'Sol–Tierra L5', point: 'L5', system: 'sun-earth', kind: 'lagrange', color: '#79d9ff' },
];

export const FALLBACK_SPACECRAFT = [
  { id: 'jwst', name: 'James Webb Space Telescope', kind: 'spacecraft', agency: 'NASA / ESA / CSA', anchor: 'L2', color: '#f2a65a', summary: 'Observatorio infrarrojo en una órbita de halo real de aproximadamente seis meses alrededor de Sol–Tierra L2.' },
  { id: 'euclid', name: 'Euclid', kind: 'spacecraft', agency: 'ESA', anchor: 'L2', color: '#c59cff', summary: 'Observatorio cosmológico en torno al punto Sol–Tierra L2.' },
  { id: 'soho', name: 'SOHO', kind: 'spacecraft', agency: 'ESA / NASA', anchor: 'L1', color: '#ffb45f', summary: 'Observatorio solar próximo al punto Sol–Tierra L1.' },
  { id: 'dscovr', name: 'DSCOVR', kind: 'spacecraft', agency: 'NOAA / NASA', anchor: 'L1', color: '#80dcff', summary: 'Observatorio del viento solar y de la Tierra en una órbita de Lissajous alrededor de L1.' },
];

export function julianDate(date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function solveKepler(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let index = 0; index < 12; index += 1) {
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
      / (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return eccentricAnomaly;
}

function elementsAt(id, date) {
  const source = PLANET_ELEMENTS[id];
  if (!source) return null;
  const centuries = (julianDate(date) - J2000_JD) / 36_525;
  return source.base.map((value, index) => value + source.rate[index] * centuries);
}

export function planetPositionAu(id, date, forcedMeanAnomaly = null) {
  if (id === 'sun') return { x: 0, y: 0, z: 0 };
  const values = elementsAt(id, date);
  if (!values) return null;
  const [a, eccentricity, inclinationDeg, meanLongitude, perihelionDeg, nodeDeg] = values;
  const inclination = radians(inclinationDeg);
  const node = radians(nodeDeg);
  const argument = radians(perihelionDeg - nodeDeg);
  const meanAnomaly = forcedMeanAnomaly ?? radians(((meanLongitude - perihelionDeg) % 360 + 360) % 360);
  const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);
  const orbitalX = a * (Math.cos(eccentricAnomaly) - eccentricity);
  const orbitalY = a * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
  const cosArgument = Math.cos(argument);
  const sinArgument = Math.sin(argument);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  return {
    x: (cosArgument * cosNode - sinArgument * sinNode * cosInclination) * orbitalX
      + (-sinArgument * cosNode - cosArgument * sinNode * cosInclination) * orbitalY,
    y: (cosArgument * sinNode + sinArgument * cosNode * cosInclination) * orbitalX
      + (-sinArgument * sinNode + cosArgument * cosNode * cosInclination) * orbitalY,
    z: sinArgument * sinInclination * orbitalX + cosArgument * sinInclination * orbitalY,
  };
}

export function planetOrbitAu(id, date, segments = 256) {
  return Array.from({ length: segments + 1 }, (_, index) => planetPositionAu(id, date, index / segments * Math.PI * 2));
}

export function circularOrbitPosition(distanceKm, periodDays, date, inclinationDeg = 0, phase = 0) {
  const days = (julianDate(date) - J2000_JD);
  const angle = phase + days / Math.abs(periodDays) * Math.PI * 2 * Math.sign(periodDays || 1);
  const inclination = radians(inclinationDeg);
  return {
    x: Math.cos(angle) * distanceKm,
    y: Math.sin(angle) * distanceKm * Math.cos(inclination),
    z: Math.sin(angle) * distanceKm * Math.sin(inclination),
  };
}

export function lagrangePosition(point, earthPositionKm) {
  const radialLength = Math.hypot(earthPositionKm.x, earthPositionKm.y, earthPositionKm.z);
  const radial = {
    x: earthPositionKm.x / radialLength,
    y: earthPositionKm.y / radialLength,
    z: earthPositionKm.z / radialLength,
  };
  if (point === 'L1') return { x: earthPositionKm.x - radial.x * 1_500_000, y: earthPositionKm.y - radial.y * 1_500_000, z: earthPositionKm.z - radial.z * 1_500_000 };
  if (point === 'L2') return { x: earthPositionKm.x + radial.x * 1_500_000, y: earthPositionKm.y + radial.y * 1_500_000, z: earthPositionKm.z + radial.z * 1_500_000 };
  if (point === 'L3') return { x: -earthPositionKm.x, y: -earthPositionKm.y, z: -earthPositionKm.z };
  const angle = point === 'L4' ? Math.PI / 3 : -Math.PI / 3;
  return {
    x: earthPositionKm.x * Math.cos(angle) - earthPositionKm.y * Math.sin(angle),
    y: earthPositionKm.x * Math.sin(angle) + earthPositionKm.y * Math.cos(angle),
    z: earthPositionKm.z,
  };
}

