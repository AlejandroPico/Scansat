import { access, readFile, stat } from 'node:fs/promises';

const required = [
  'index.html', 'favicon.svg', 'manifest.webmanifest', 'README.md', 'LICENSE',
  'src/app.js', 'src/scene.js', 'src/catalog.js', 'src/satellite-core.js', 'src/styles.css',
  'src/solar-data.js', 'public/data/active.json', 'public/data/debris.json', 'public/data/metadata.json', 'public/data/spacecraft.json',
];

await Promise.all(required.map((path) => access(path)));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const html = await readFile('index.html', 'utf8');
const readme = await readFile('README.md', 'utf8');
const metadata = JSON.parse(await readFile('public/data/metadata.json', 'utf8'));
const catalog = JSON.parse(await readFile('public/data/active.json', 'utf8'));
const debris = JSON.parse(await readFile('public/data/debris.json', 'utf8'));
const spacecraft = JSON.parse(await readFile('public/data/spacecraft.json', 'utf8'));

if (pkg.version !== '0.2.0') throw new Error('La versión de package.json no es 0.2.0.');
if (!html.includes('0.2.0')) throw new Error('La versión visible no coincide.');
if (!readme.includes('0.2.0')) throw new Error('README no documenta la versión actual.');
if (!Array.isArray(catalog) || catalog.length < 10) throw new Error('El catálogo orbital de respaldo está incompleto.');
if (!Array.isArray(debris) || debris.length < 500) throw new Error('La instantánea de basura espacial está incompleta.');
if ((metadata.activeCount ?? metadata.recordCount) !== catalog.length) throw new Error('El contador activo de metadata no coincide con el catálogo.');
if (metadata.debrisCount !== debris.length) throw new Error('El contador de basura espacial no coincide con el catálogo.');
if (!Array.isArray(spacecraft.objects) || spacecraft.objects.length < 5) throw new Error('La instantánea de NASA/JPL Horizons está incompleta.');
if ((await stat('public/data/active.json')).size > 15_000_000) throw new Error('La instantánea supera el límite previsto de 15 MB.');

console.log(`Validación correcta: ScanSat ${pkg.version}, ${catalog.length} objetos activos, ${debris.length} fragmentos y ${spacecraft.objects.length} efemérides JPL.`);
