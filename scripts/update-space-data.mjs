import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const targets = [
  { id: 'voyager-1', name: 'Voyager 1', command: '-31', agency: 'NASA / JPL', color: '#ffd47d' },
  { id: 'voyager-2', name: 'Voyager 2', command: '-32', agency: 'NASA / JPL', color: '#ffb667' },
  { id: 'new-horizons', name: 'New Horizons', command: '-98', agency: 'NASA / APL', color: '#9ac8ff' },
  { id: 'parker', name: 'Parker Solar Probe', command: '-96', agency: 'NASA / APL', color: '#ff8c45' },
  { id: 'solar-orbiter', name: 'Solar Orbiter', command: '-144', agency: 'ESA / NASA', color: '#ffbd73' },
  { id: 'jwst', name: 'James Webb Space Telescope', command: '-170', agency: 'NASA / ESA / CSA', color: '#f2a65a' },
  { id: 'euclid', name: 'Euclid', command: '-680', agency: 'ESA', color: '#c59cff' },
  { id: 'bepicolombo', name: 'BepiColombo', command: '-121', agency: 'ESA / JAXA', color: '#d0b08c' },
  { id: 'europa-clipper', name: 'Europa Clipper', command: '-159', agency: 'NASA / JPL', color: '#9dd7ff' },
  { id: 'juice', name: 'JUICE', command: '-28', agency: 'ESA', color: '#d9bc8d' },
  { id: 'lucy', name: 'Lucy', command: '-49', agency: 'NASA / SwRI', color: '#d8c08e' },
  { id: 'psyche', name: 'Psyche', command: '-255', agency: 'NASA / JPL', color: '#e4a6d7' },
  { id: 'roadster', name: 'SpaceX Roadster', command: '-143205', agency: 'SpaceX', color: '#ef6b6b' },
];

const start = new Date();
const stop = new Date(start.getTime() + 86_400_000);
const isoDay = (date) => date.toISOString().slice(0, 10);
const snapshotAt = `${isoDay(start)}T00:00:00.000Z`;

async function fetchVector(target) {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const params = {
    format: 'json', COMMAND: target.command, EPHEM_TYPE: 'VECTORS', CENTER: '500@10',
    START_TIME: `"${isoDay(start)}"`, STOP_TIME: `"${isoDay(stop)}"`, STEP_SIZE: '"1 d"',
    VEC_TABLE: '2', CSV_FORMAT: 'YES', OUT_UNITS: 'KM-S', REF_PLANE: 'ECLIPTIC',
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      headers: { 'user-agent': 'ScanSat/0.3.0 (+https://github.com/AlejandroPico/Scansat)' },
      signal: AbortSignal.timeout(90_000),
    });
    if (response.ok && response.headers.get('content-type')?.includes('json')) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * (attempt + 1)));
  }
  if (!response?.ok) throw new Error(`Horizons no respondió para ${target.name}.`);
  const payload = await response.json();
  const row = (payload.result || '').match(/\$\$SOE\s*\n([^\n]+)/)?.[1]?.split(',').map((value) => value.trim());
  if (!row || row.length < 8) throw new Error(`Horizons no devolvió un vector para ${target.name}.`);
  const values = row.slice(2, 8).map(Number);
  if (!values.every(Number.isFinite)) throw new Error(`Vector no válido para ${target.name}.`);
  return {
    ...target,
    kind: 'spacecraft',
    snapshotAt,
    epoch: row[1],
    positionKm: { x: values[0], y: values[1], z: values[2] },
    velocityKmS: { x: values[3], y: values[4], z: values[5] },
    source: 'NASA/JPL Horizons',
  };
}

const objects = [];
for (const target of targets) {
  try { objects.push(await fetchVector(target)); }
  catch (error) { console.warn(error.message); }
}

if (objects.length < 5) {
  console.log(`Solo se recibieron ${objects.length} efemérides; se conserva la instantánea anterior.`);
  process.exit(0);
}

const target = resolve('public/data/spacecraft.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify({
  updatedAt: snapshotAt, center: 'Sun (500@10)', frame: 'J2000 ecliptic',
  units: 'km and km/s', source: 'NASA/JPL Horizons API', objects,
}, null, 2)}\n`);
console.log(`Efemérides JPL actualizadas: ${objects.length} sondas y observatorios.`);
