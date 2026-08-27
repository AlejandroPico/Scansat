import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON';
const target = resolve('public/data/active.json');
const metadataTarget = resolve('public/data/metadata.json');

const response = await fetch(source, {
  headers: { 'user-agent': 'ScanSat/0.1.0 (+https://github.com/AlejandroPico/Scansat)' },
  signal: AbortSignal.timeout(120_000),
});

if (!response.ok) {
  console.log(`CelesTrak respondió ${response.status}; se conserva la última instantánea válida.`);
  process.exit(0);
}

const text = await response.text();
let records;
try {
  records = JSON.parse(text);
} catch {
  throw new Error('CelesTrak no devolvió JSON válido. No se modifica la instantánea.');
}

if (!Array.isArray(records) || records.length < 5000) {
  throw new Error(`Instantánea rechazada: solo contiene ${Array.isArray(records) ? records.length : 0} registros.`);
}

const normalized = JSON.stringify(records);
let previous = '';
try { previous = await readFile(target, 'utf8'); } catch { /* Primera descarga */ }
if (previous === normalized) {
  console.log(`Sin cambios en los ${records.length} objetos del catálogo.`);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, normalized);
await writeFile(metadataTarget, `${JSON.stringify({
  updatedAt: new Date().toISOString(),
  recordCount: records.length,
  source: 'CelesTrak NORAD GP active',
  format: 'CCSDS OMM JSON',
  propagator: 'SGP4',
}, null, 2)}\n`);
console.log(`Catálogo actualizado: ${records.length} objetos activos.`);
