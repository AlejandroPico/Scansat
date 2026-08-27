import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const feeds = [
  { kind: 'active', group: 'active', minimum: 5_000 },
  { kind: 'debris', group: 'fengyun-1c-debris', minimum: 500 },
  { kind: 'debris', group: 'iridium-33-debris', minimum: 25 },
  { kind: 'debris', group: 'cosmos-2251-debris', minimum: 100 },
];

async function download(group) {
  const source = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=JSON`;
  const response = await fetch(source, {
    headers: { 'user-agent': 'ScanSat/0.2.0 (+https://github.com/AlejandroPico/Scansat)' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`CelesTrak respondió ${response.status} para ${group}.`);
  const records = await response.json();
  const definition = feeds.find((feed) => feed.group === group);
  if (!Array.isArray(records) || records.length < definition.minimum) {
    throw new Error(`Instantánea ${group} rechazada: ${Array.isArray(records) ? records.length : 0} registros.`);
  }
  return records;
}

const downloaded = [];
for (const feed of feeds) {
  try { downloaded.push({ ...feed, records: await download(feed.group) }); }
  catch (error) { console.warn(`${error.message} Se conserva esa instantánea anterior.`); }
}

let active = downloaded.find((feed) => feed.kind === 'active')?.records;
if (!active) {
  try { active = JSON.parse(await readFile(resolve('public/data/active.json'), 'utf8')); }
  catch { active = []; }
}
if (active.length < 5_000) throw new Error('No existe una instantánea activa válida para conservar.');
const debrisById = new Map();
const downloadedDebris = downloaded.filter((item) => item.kind === 'debris');
for (const feed of downloadedDebris) {
  for (const record of feed.records) debrisById.set(String(record.NORAD_CAT_ID), record);
}
let debris = [...debrisById.values()];
if (downloadedDebris.length !== 3) {
  try { debris = JSON.parse(await readFile(resolve('public/data/debris.json'), 'utf8')); }
  catch { debris = []; }
}

async function writeWhenChanged(path, value) {
  const target = resolve(path);
  const normalized = JSON.stringify(value);
  let previous = '';
  try { previous = await readFile(target, 'utf8'); } catch { /* Primera descarga. */ }
  if (previous === normalized) return false;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, normalized);
  return true;
}

const changedActive = await writeWhenChanged('public/data/active.json', active);
const changedDebris = debris.length > 100 ? await writeWhenChanged('public/data/debris.json', debris) : false;
if (changedActive || changedDebris) {
  await writeFile(resolve('public/data/metadata.json'), `${JSON.stringify({
    updatedAt: new Date().toISOString(),
    activeCount: active.length,
    debrisCount: debris.length,
    recordCount: active.length + debris.length,
    source: 'CelesTrak NORAD GP active + three principal debris clouds',
    debrisGroups: feeds.filter((feed) => feed.kind === 'debris').map((feed) => feed.group),
    format: 'CCSDS OMM JSON',
    propagator: 'SGP4',
  }, null, 2)}\n`);
}

console.log(`Catálogo preparado: ${active.length} objetos activos + ${debris.length} fragmentos de las principales nubes de colisión.`);
