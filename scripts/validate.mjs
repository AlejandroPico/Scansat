import { access, readFile, stat } from 'node:fs/promises';

const required = [
  'index.html', 'favicon.svg', 'manifest.webmanifest', 'README.md',
  'src/app.js', 'src/scene.js', 'src/catalog.js', 'src/satellite-core.js', 'src/styles.css',
  'public/data/active.json', 'public/data/metadata.json',
];

await Promise.all(required.map((path) => access(path)));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const html = await readFile('index.html', 'utf8');
const readme = await readFile('README.md', 'utf8');
const metadata = JSON.parse(await readFile('public/data/metadata.json', 'utf8'));
const catalog = JSON.parse(await readFile('public/data/active.json', 'utf8'));

if (pkg.version !== '0.1.0') throw new Error('La versión de package.json no es 0.1.0.');
if (!html.includes('0.1.0')) throw new Error('La versión visible no coincide.');
if (!readme.includes('0.1.0')) throw new Error('README no documenta la versión actual.');
if (!Array.isArray(catalog) || catalog.length < 10) throw new Error('El catálogo orbital de respaldo está incompleto.');
if (metadata.recordCount !== catalog.length) throw new Error('El contador de metadata no coincide con el catálogo.');
if ((await stat('public/data/active.json')).size > 15_000_000) throw new Error('La instantánea supera el límite previsto de 15 MB.');

console.log(`Validación correcta: ScanSat ${pkg.version}, ${catalog.length} objetos activos.`);
