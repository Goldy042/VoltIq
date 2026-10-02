import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLocation, resolveArea } from './address';
import { nearestArea } from '@/data/nsukka';
import { offsetMeters } from './geo';

// The resident's Google Maps pins (Street View spots).
const gate = { lat: 6.857663, lng: 7.411243 };
const far = { lat: 6.854628, lng: 7.41792 };
const mid = { lat: (gate.lat + far.lat) / 2, lng: (gate.lng + far.lng) / 2 };

test('both pins and everything between them are Hilltop', () => {
  for (const p of [gate, far, mid]) {
    const m = resolveArea(p, 10, []);
    assert.equal(m.area.id, 'hilltop', JSON.stringify(p));
    assert.equal(m.confident, true);
  }
  assert.equal(nearestArea(mid).id, 'hilltop');
  assert.match(describeLocation(mid).summary, /Hilltop/);
});

test('100 m off the line is still Hilltop; 300 m off is not', () => {
  // The line runs roughly north-west → south-east, so offset to the north-east.
  const inStrip = offsetMeters(mid.lat, mid.lng, 70, 70); // ~100 m
  const outside = offsetMeters(mid.lat, mid.lng, 212, 212); // ~300 m
  assert.equal(resolveArea(inStrip, 5, []).area.id, 'hilltop');
  assert.notEqual(resolveArea(outside, 5, []).area.id, 'hilltop');
});

test('the old Hilltop pin by Odim Street is no longer Hilltop', () => {
  assert.equal(resolveArea({ lat: 6.8688, lng: 7.4158 }, 10, []).area.id === 'hilltop', false);
  assert.equal(resolveArea({ lat: 6.8716, lng: 7.4142 }, 10, []).area.id, 'odim');
});

test('a rough fix near the edge asks instead of guessing', () => {
  const edgeish = offsetMeters(mid.lat, mid.lng, 85, 85); // ~120 m from the line, ~30 m inside
  const m = resolveArea(edgeish, 200, []);
  assert.equal(m.area.id, 'hilltop');
  assert.equal(m.confident, false);
  assert.ok(m.alternatives.length > 0);

  // Just outside with a rough fix: Hilltop is offered as an alternative.
  const out = offsetMeters(mid.lat, mid.lng, 140, 140); // ~200 m from the line
  const o = resolveArea(out, 150, []);
  assert.notEqual(o.area.id, 'hilltop');
  assert.ok(o.alternatives.some((a) => a.id === 'hilltop'));
});

test('a correction cannot pull a point out of a drawn boundary', () => {
  const m = resolveArea(mid, 10, [{ ...mid, areaId: 'onuiyi' }]);
  assert.equal(m.area.id, 'hilltop');
});
