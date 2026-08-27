import test from 'node:test';
import assert from 'node:assert/strict';
import { AU_KM, lagrangePosition, planetPositionAu } from '../src/solar-data.js';

test('mantiene la distancia heliocéntrica terrestre próxima a una unidad astronómica', () => {
  const earth = planetPositionAu('earth', new Date('2026-08-27T00:00:00Z'));
  const distance = Math.hypot(earth.x, earth.y, earth.z);
  assert.ok(distance > 0.98 && distance < 1.02);
});

test('sitúa Marte fuera de la órbita terrestre en la fecha de referencia', () => {
  const date = new Date('2026-08-27T00:00:00Z');
  const earth = planetPositionAu('earth', date);
  const mars = planetPositionAu('mars', date);
  assert.ok(Math.hypot(mars.x, mars.y, mars.z) > Math.hypot(earth.x, earth.y, earth.z));
});

test('coloca L2 aproximadamente a 1,5 millones de kilómetros más allá de la Tierra', () => {
  const earthAu = planetPositionAu('earth', new Date('2026-08-27T00:00:00Z'));
  const earthKm = { x: earthAu.x * AU_KM, y: earthAu.y * AU_KM, z: earthAu.z * AU_KM };
  const l2 = lagrangePosition('L2', earthKm);
  const separation = Math.hypot(l2.x - earthKm.x, l2.y - earthKm.y, l2.z - earthKm.z);
  assert.ok(Math.abs(separation - 1_500_000) < 1);
});
