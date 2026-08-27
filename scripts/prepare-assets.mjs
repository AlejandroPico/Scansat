import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const assets = [
  ['public/textures/earth-day.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'],
  ['public/textures/earth-night.png', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png'],
  ['public/textures/moon.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'],
];

for (const [relativePath, url] of assets) {
  const target = resolve(relativePath);
  try {
    await access(target);
    if ((await stat(target)).size > 10_000) continue;
  } catch { /* El recurso todavía no existe. */ }

  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`No se pudo descargar ${url} (${response.status}).`);
  const data = new Uint8Array(await response.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  console.log(`Preparado ${relativePath} (${data.length} bytes).`);
}
