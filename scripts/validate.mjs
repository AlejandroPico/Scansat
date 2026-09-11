import { access, readFile, stat } from 'node:fs/promises';

const required = [
  'src/atlas-data.js', 'src/atlas-scene.js',
  ...['minor-bodies.json','streams.json','desi.json','voids.json','lensing.json','image-manifest.json','dust-provenance.json','local-bubble-positions.f32','local-bubble-triangles.u32','nearby-dust-points.f32'].map(x=>'public/data/atlas/'+x),
  ...['infrared.jpg','radio.jpg','xray.jpg','gamma.jpg','orion.jpg','crab.jpg','helix.jpg','abell2744-dss2.jpg','abell2744-hst.png','abell2744-chandra.png','abell2744-kappa.png'].map(x=>'public/atlas/'+x),
  'index.html', 'favicon.svg', 'manifest.webmanifest', 'README.md', 'LICENSE',
  'src/app.js', 'src/scene.js', 'src/catalog.js', 'src/satellite-core.js', 'src/styles.css',
  'src/cmb-scene.js','src/encyclopedia-media.js','public/encyclopedia/reference-cosmic-web.png','public/encyclopedia/reference-cluster.png','src/density-volume.js','src/astronomy-photos.js','src/galactic-sectors.js','src/earth-tiles.js','src/navigation.js',
  'src/cosmic-surveys.js', 'src/galaxy-model.js', 'public/data/cosmography/metadata.json', 'public/data/cosmography/density-metadata.json',
  ...['sdss.bin.gz','2mrs.json.gz','flows.bin.gz','laniakea.bin.gz','density.bin.gz','outer-density.bin.gz','local-volume.bin.gz','cosmic-volume.part1.bin.gz','cosmic-volume.part2.bin.gz','volume-metadata.json'].map(x=>'public/data/cosmography/'+x),
  'src/cosmic-data.js', 'src/cosmic-scene.js', 'src/encyclopedia.js', 'src/picking.js', 'src/shader-support.js',
  'public/data/stars.json', 'public/data/exploration.json', 'src/solar-data.js', 'public/data/active.json', 'public/data/metadata.json', 'public/data/spacecraft.json',
  'public/data/debris-1.json', 'public/data/debris-2.json', 'public/data/debris-3.json', 'public/data/debris-4.json',
];

await Promise.all(required.map((path) => access(path)));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const html = await readFile('index.html', 'utf8');
const readme = await readFile('README.md', 'utf8');
const metadata = JSON.parse(await readFile('public/data/metadata.json', 'utf8'));
const catalog = JSON.parse(await readFile('public/data/active.json', 'utf8'));
const debrisPaths = Array.from({ length: 4 }, (_, index) => `public/data/debris-${index + 1}.json`);
const debris = (await Promise.all(debrisPaths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))))).flat();
const spacecraft = JSON.parse(await readFile('public/data/spacecraft.json', 'utf8'));

if (pkg.version !== '0.8.1') throw new Error('La versión de package.json no es 0.8.1.');
if (!html.includes('0.8.1')) throw new Error('La versión visible no coincide.');
if (!readme.includes('0.8.1')) throw new Error('README no documenta la versión actual.');
if (!Array.isArray(catalog) || catalog.length < 10) throw new Error('El catálogo orbital de respaldo está incompleto.');
if (!Array.isArray(debris) || debris.length < 500) throw new Error('La instantánea de basura espacial está incompleta.');
if ((metadata.activeCount ?? metadata.recordCount) !== catalog.length) throw new Error('El contador activo de metadata no coincide con el catálogo.');
if (metadata.debrisCount !== debris.length) throw new Error('El contador de basura espacial no coincide con el catálogo.');
if (!Array.isArray(spacecraft.objects) || spacecraft.objects.length < 5) throw new Error('La instantánea de NASA/JPL Horizons está incompleta.');
if ((await stat('public/data/active.json')).size > 15_000_000) throw new Error('La instantánea supera el límite previsto de 15 MB.');
for (const path of debrisPaths) {
  if ((await stat(path)).size > 700_000) throw new Error(`${path} supera el límite de 700 KB.`);
}

console.log(`Validación correcta: Universal ${pkg.version}, ${catalog.length} objetos activos, ${debris.length} fragmentos y ${spacecraft.objects.length} efemérides JPL.`);
