import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyObject, isCatalogDateReliable, orbitalMetrics } from '../src/catalog.js';

test('clasifica las constelaciones principales', () => {
  assert.equal(classifyObject('STARLINK-12345'), 'starlink');
  assert.equal(classifyObject('ONEWEB-0912'), 'oneweb');
  assert.equal(classifyObject('GALILEO 31'), 'galileo');
  assert.equal(classifyObject('BEIDOU-3 G4'), 'beidou');
  assert.equal(classifyObject('ISS (ZARYA)'), 'stations');
});

test('distingue los regímenes orbitales a partir del movimiento medio', () => {
  assert.equal(orbitalMetrics({ MEAN_MOTION: 15.5, ECCENTRICITY: 0.0005 }).orbit, 'LEO');
  assert.equal(orbitalMetrics({ MEAN_MOTION: 2.0, ECCENTRICITY: 0.01 }).orbit, 'MEO');
  assert.equal(orbitalMetrics({ MEAN_MOTION: 1.0027, ECCENTRICITY: 0.0002 }).orbit, 'GEO');
  assert.equal(orbitalMetrics({ MEAN_MOTION: 1.8, ECCENTRICITY: 0.7 }).orbit, 'HEO');
});

test('calcula un periodo orbital coherente', () => {
  const metrics = orbitalMetrics({ MEAN_MOTION: 16, ECCENTRICITY: 0 });
  assert.equal(metrics.periodMinutes, 90);
  assert.ok(metrics.meanAltitude > 200 && metrics.meanAltitude < 400);
});

test('oculta elementos GP actuales fuera de su ventana fiable', () => {
  const epoch = new Date('2026-08-28T00:00:00Z');
  assert.equal(isCatalogDateReliable(epoch, new Date('2026-09-10T23:59:59Z')), true);
  assert.equal(isCatalogDateReliable(epoch, new Date('2026-09-12T00:00:01Z')), false);
  assert.equal(isCatalogDateReliable(epoch, new Date('1957-10-04T00:00:00Z')), false);
});
