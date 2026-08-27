// Entrada deliberadamente estrecha: satellite.js 7 también exporta un backend
// WASM opcional. ScanSat usa el propagador JavaScript para mantener un único
// paquete compatible con GitHub Pages y navegadores sin aislamiento de origen.
export { json2satrec } from '../node_modules/satellite.js/dist/io.js';
export { propagate, gstime } from '../node_modules/satellite.js/dist/propagation.js';
export { degreesLat, degreesLong, eciToEcf, eciToGeodetic } from '../node_modules/satellite.js/dist/transforms.js';
