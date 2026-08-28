import { json2satrec } from './satellite-core.js';
import { prepareRecord } from './catalog.js';

const CATALOG_PATHS = [
  { path: `${import.meta.env.BASE_URL}data/active.json`, kind: 'active', required: true },
  ...Array.from({ length: 4 }, (_, index) => ({
    path: `${import.meta.env.BASE_URL}data/debris-${index + 1}.json`,
    kind: 'debris',
    required: false,
  })),
];
const METADATA_PATH = `${import.meta.env.BASE_URL}data/metadata.json`;
const SPACECRAFT_PATH = `${import.meta.env.BASE_URL}data/spacecraft.json`;

export async function loadOrbitalCatalog(onProgress = () => {}) {
  const catalogs = [];
  for (const source of CATALOG_PATHS) {
    const response = await fetch(source.path, { cache: 'no-cache' });
    if (!response.ok) {
      if (source.required) throw new Error(`No se pudo cargar el catálogo (${response.status})`);
      continue;
    }
    const objects = await response.json();
    if (Array.isArray(objects)) catalogs.push({ ...source, objects });
  }
  const total = catalogs.reduce((sum, catalog) => sum + catalog.objects.length, 0);
  if (total < 100) throw new Error('El catálogo orbital no es válido');

  const records = [];
  const batchSize = 600;
  let processed = 0;
  for (const catalog of catalogs) {
    for (let start = 0; start < catalog.objects.length; start += batchSize) {
      const batch = catalog.objects.slice(start, start + batchSize);
    for (const omm of batch) {
      try {
        const satrec = json2satrec(omm);
        if (!satrec || satrec.error) continue;
          records.push(prepareRecord(omm, satrec, catalog.kind));
      } catch {
        // Un objeto malformado no debe bloquear el resto del catálogo.
      }
    }
      processed += batch.length;
      onProgress(Math.min(1, processed / total), records.length);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  return records;
}

export async function loadSpacecraftEphemerides() {
  try {
    const response = await fetch(SPACECRAFT_PATH, { cache: 'no-cache' });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.objects) ? payload.objects : [];
  } catch {
    return [];
  }
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
