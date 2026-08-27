import { json2satrec } from './satellite-core.js';
import { prepareRecord } from './catalog.js';

const CATALOG_PATH = `${import.meta.env.BASE_URL}data/active.json`;
const METADATA_PATH = `${import.meta.env.BASE_URL}data/metadata.json`;

export async function loadOrbitalCatalog(onProgress = () => {}) {
  const response = await fetch(CATALOG_PATH, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`No se pudo cargar el catálogo (${response.status})`);
  const ommRecords = await response.json();
  if (!Array.isArray(ommRecords) || ommRecords.length < 100) throw new Error('El catálogo orbital no es válido');

  const records = [];
  const batchSize = 600;
  for (let start = 0; start < ommRecords.length; start += batchSize) {
    const batch = ommRecords.slice(start, start + batchSize);
    for (const omm of batch) {
      try {
        const satrec = json2satrec(omm);
        if (!satrec || satrec.error) continue;
        records.push(prepareRecord(omm, satrec));
      } catch {
        // Un objeto malformado no debe bloquear el resto del catálogo.
      }
    }
    onProgress(Math.min(1, (start + batchSize) / ommRecords.length), records.length);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return records;
}

export async function loadCatalogMetadata() {
  try {
    const response = await fetch(METADATA_PATH, { cache: 'no-cache' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
