import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveStatus, describeIncident, estimateHouseholds, medianVoltage, snapDots, MAX_DOTS_PER_INCIDENT } from './incidents';

test('households: a share of the area, at least the reporters, at most the area', () => {
  assert.equal(estimateHouseholds(1000, 500, 250, 3), 250); // (250/500)² = ¼ of 1000
  assert.equal(estimateHouseholds(1000, 500, 900, 3), 1000); // bigger than the area → whole area
  assert.equal(estimateHouseholds(1000, 500, 20, 12), 12); // tiny circle → never below reporters
  assert.equal(estimateHouseholds(null, 500, 250, 4), 4); // unknown area size → reporters
});

test('median voltage ignores blanks', () => {
  assert.equal(medianVoltage([140, null, 160, undefined, 150]), 150);
  assert.equal(medianVoltage([140, 160]), 150);
  assert.equal(medianVoltage([null, undefined]), undefined);
});

test('dots are snapped to a grid and de-duplicated', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const t = new Date('2026-10-16T11:30:00Z');
  const dots = snapDots('i1', 'no_power', [
    { lat: 6.85601, lng: 7.41401, createdAt: t },
    { lat: 6.85604, lng: 7.41404, createdAt: t }, // same ~30 m cell as the first
    { lat: 6.8575, lng: 7.4155, createdAt: t },
  ], now);
  assert.equal(dots.length, 2);
  assert.equal(dots[0].minutesAgo, 30);
  // Snapped, so not the exact coordinates anyone sent.
  assert.notEqual(dots[0].lat, 6.85601);
});

test('dots are capped per outage', () => {
  const now = new Date();
  const pts = Array.from({ length: 200 }, (_, i) => ({ lat: 6.85 + i * 0.001, lng: 7.41, createdAt: now }));
  assert.equal(snapDots('i1', 'no_power', pts, now).length, MAX_DOTS_PER_INCIDENT);
});

test('staff status changes follow the repair flow', () => {
  assert.ok(canMoveStatus('reported', 'confirmed'));
  assert.ok(canMoveStatus('confirmed', 'crew_dispatched'));
  assert.ok(canMoveStatus('crew_dispatched', 'restored'));
  assert.ok(canMoveStatus('restored', 'confirmed')); // reopen
  assert.ok(!canMoveStatus('restored', 'crew_dispatched'));
  assert.ok(!canMoveStatus('reported', 'reported'));
});

test('fallback description', () => {
  assert.equal(describeIncident('no_power', 1), 'One resident reported no light here.');
  assert.equal(describeIncident('low_voltage', 4), '4 residents reported low voltage here.');
});
