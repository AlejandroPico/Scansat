import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const nasaRoot = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures';
const assets = [
  ['public/textures/earth-day.jpg', `${nasaRoot}/Earth%20(A)/Earth%20(A).jpg`],
  ['public/textures/earth-night.png', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png'],
  ['public/textures/earth-roughness.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_bump_roughness_clouds_4096.jpg'],
  ['public/textures/earth-clouds.png', 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png'],
  ['public/textures/moon-color.jpg', 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'],
  ['public/textures/moon-height.jpg', 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg'],
  ['public/textures/sun-surface.jpg', 'https://svs.gsfc.nasa.gov/vis/a030000/a030300/a030362/euvi_aia304_2012_carrington_print.jpg'],
  ['public/textures/venus.jpg', `${nasaRoot}/Venus/Venus.jpg`],
  ['public/textures/mars.jpg', `${nasaRoot}/Mars/Mars.jpg`],
  ['public/textures/jupiter.jpg', `${nasaRoot}/Jupiter/Jupiter.jpg`],
  ['public/textures/saturn.jpg', `${nasaRoot}/Saturn/Saturn.jpg`],
  ['public/textures/neptune.jpg', `${nasaRoot}/Neptune/Neptune.jpg`],
  ['public/models/mercury.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/m/Mercury_1_4878.glb'],
  ['public/models/uranus.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/u/Uranus_1_51118.glb'],
];

for (const [relativePath, url] of assets) {
  const target = resolve(relativePath);
  try {
    await access(target);
    if ((await stat(target)).size > 10_000) continue;
  } catch { /* El recurso todavía no existe. */ }

  const response = await fetch(url, {
    headers: { 'user-agent': 'ScanSat/0.3.0 (+https://github.com/AlejandroPico/Scansat)' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`No se pudo descargar ${url} (${response.status}).`);
  const data = new Uint8Array(await response.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  console.log(`Preparado ${relativePath} (${data.length} bytes).`);
}
