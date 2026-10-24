import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertCopy, isQuietHour, prefsOf, shouldPush, wantsEvent } from './alerts';

// Nsukka is UTC+1 all year.
const at = (lagosHour: number) => new Date(Date.UTC(2026, 9, 16, (lagosHour + 23) % 24));

test('quiet hours are 10 PM to 6 AM Lagos time', () => {
  assert.equal(isQuietHour(at(21)), false);
  assert.equal(isQuietHour(at(22)), true);
  assert.equal(isQuietHour(at(3)), true);
  assert.equal(isQuietHour(at(6)), false);
});

test('topics decide who hears what', () => {
  const p = prefsOf({ repairs: false });
  assert.equal(wantsEvent(p, 'confirmed'), false);
  assert.equal(wantsEvent(p, 'crew_dispatched'), false);
  assert.equal(wantsEvent(p, 'restored'), true);
});

test('quiet hours hold back repair news but never light restored', () => {
  const p = prefsOf({});
  assert.equal(shouldPush(p, 'crew_dispatched', at(23)), false);
  assert.equal(shouldPush(p, 'restored', at(23)), true);
  assert.equal(shouldPush(p, 'crew_dispatched', at(12)), true);
  assert.equal(shouldPush({ ...p, quietHours: false }, 'confirmed', at(23)), true);
  assert.equal(shouldPush({ ...p, push: false }, 'restored', at(12)), false);
});

test('copy says who restored it', () => {
  assert.match(alertCopy('restored', 'Odim Gate', { restoredBy: 'community' }).title, /Neighbours say/);
  assert.match(alertCopy('restored', 'Odim Gate', { restoredBy: 'eedc' }).body, /EEDC marked/);
});

test('updates carry the note and the expected time', () => {
  const c = alertCopy('update', 'Odim Gate', { note: 'Replacing the fuse.', etaAt: new Date() });
  assert.match(c.body, /Replacing the fuse\. EEDC expects light back by /);
  assert.equal(wantsEvent(prefsOf({ repairs: false }), 'update'), false);
});
