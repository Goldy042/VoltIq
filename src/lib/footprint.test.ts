import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFootprint, cellCenter, cellOf, cellRing, distanceToCells, footprintHomes } from './footprint';
import { ASK_RING_M, placeVsOutage, pushCheck, wantsChecks } from './checks';
import { offsetMeters } from './geo';
import { defaultAlerts } from './profile-types';

// The middle of one block near the UNN gate, so small offsets stay in it.
const base = cellCenter(cellOf({ lat: 6.858, lng: 7.403 }));
const at = (north: number, east: number) => offsetMeters(base.lat, base.lng, north, east);

test('a block is a closed square around its centre', () => {
  const ring = cellRing(cellOf(base));
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring[4]);
  const [w, s] = ring[0];
  const [e, n] = ring[2];
  assert.ok(base.lng > w && base.lng < e && base.lat > s && base.lat < n);
});

test('five homes on one street are a pocket, not the whole area', () => {
  const fp = buildFootprint([at(0, 0), at(10, 15), at(-20, 5), at(30, -25), at(5, 40)], []);
  assert.equal(fp.off.length, 1);
  assert.equal(fp.scope, 'pocket');
  assert.equal(fp.spanM, 100);
});

test('reports along a few hundred metres are one street', () => {
  const fp = buildFootprint([0, 100, 200, 300, 400].map((n) => at(n, 0)), []);
  assert.equal(fp.scope, 'street');
  assert.ok(fp.spanM >= 450 && fp.spanM <= 550, `span ${fp.spanM}`);
});

test('reports across the neighbourhood are area-wide', () => {
  assert.equal(buildFootprint([at(0, 0), at(400, 300), at(-300, 600)], []).scope, 'area');
});

test('lit homes between the dark ones make it scattered', () => {
  const off = [at(0, 0), at(300, 0), at(0, 300)];
  const on = [at(100, 0), at(200, 0), at(0, 100), at(0, 200), at(150, 150)];
  const fp = buildFootprint(off, on);
  assert.equal(fp.scope, 'scattered');
  // Without the "yes" answers the same reports look like a street.
  assert.equal(buildFootprint(off, []).scope, 'street');
});

test('a block with a report is never shown as lit', () => {
  const fp = buildFootprint([at(0, 0)], [at(5, 5), at(150, 0)]);
  assert.equal(fp.on.length, 1);
});

test('homes come from the dark blocks, not the whole area', () => {
  // 3000 homes over a 600 m radius ≈ 26 per block.
  assert.equal(footprintHomes({ off: [cellOf(base)], scope: 'pocket' }, 5, 3000, 600), 26);
  assert.equal(footprintHomes({ off: [cellOf(base)], scope: 'pocket' }, 40, 3000, 600), 40); // never below reporters
  assert.equal(footprintHomes({ off: Array(500).fill(cellOf(base)), scope: 'area' }, 5, 3000, 600), 3000); // never above the area
  assert.equal(footprintHomes({ off: [cellOf(base), cellOf(at(300, 0))], scope: 'scattered' }, 4, 3000, 600), 4);
  assert.equal(footprintHomes({ off: [cellOf(base)], scope: 'pocket' }, 5, null, 600), 5);
});

test('distance to the dark blocks', () => {
  const cells = [cellOf(base)];
  assert.equal(distanceToCells(at(10, 10), cells), 0);
  const d = distanceToCells(at(300, 0), cells);
  assert.ok(d > 230 && d < 270, `distance ${d}`);
});

test('a place is on, near or away from an outage', () => {
  const outage = { ...base, radius: 200, cells: { off: [cellOf(base)], on: [] } };
  assert.equal(placeVsOutage(at(20, 0), outage), 'inside');
  assert.equal(placeVsOutage(at(250, 0), outage), 'near');
  assert.equal(placeVsOutage(at(ASK_RING_M + 200, 0), outage), null);
  // Same area isn't enough: 800 m away is not your outage.
  assert.equal(placeVsOutage(at(800, 0), outage), null);
  // No blocks (demo data): the rough radius.
  assert.equal(placeVsOutage(at(150, 0), { ...base, radius: 200 }), 'inside');
});

test('asks wait for morning and respect the switch', () => {
  const evening = new Date('2026-10-24T18:00:00Z'); // 7 PM in Nsukka
  const night = new Date('2026-10-24T22:30:00Z'); // 11:30 PM
  assert.equal(pushCheck(defaultAlerts, evening), true);
  assert.equal(pushCheck(defaultAlerts, night), false);
  assert.equal(pushCheck({ ...defaultAlerts, checks: false }, evening), false);
  assert.equal(pushCheck({ ...defaultAlerts, push: false }, evening), false);
  assert.equal(wantsChecks({ ...defaultAlerts, checks: undefined as unknown as boolean }), true);
});
