import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Incident } from '@/data/nsukka';
import { buildQueue, shortDuration, waitLevel } from './dispatch';

const inc = (id: string, over: Partial<Incident>): Incident => ({
  id,
  kind: 'incident',
  areaId: 'odim',
  area: 'Odim',
  place: id,
  lat: 6.86,
  lng: 7.41,
  issue: 'no_power',
  status: 'reported',
  reports: 3,
  households: 100,
  minutesAgo: 10,
  note: '',
  radius: 200,
  ...over,
});

test('each outage lands in the tab for its next step', () => {
  const q = buildQueue([
    inc('a', {}),
    inc('b', { status: 'confirmed' }),
    inc('c', { status: 'crew_dispatched' }),
    inc('d', { status: 'restored' }),
  ]);
  assert.deepEqual([q.confirm, q.assign, q.active, q.fixed].map((l) => l.map((i) => i.id)), [['a'], ['b'], ['c'], ['d']]);
});

test('bigger, older, darker outages come first', () => {
  const q = buildQueue([
    inc('small', { reports: 2 }),
    inc('big', { reports: 20 }),
    inc('old', { reports: 2, minutesAgo: 600 }),
    inc('dim', { reports: 20, issue: 'low_voltage' }),
  ]);
  assert.equal(q.confirm[0].id, 'big');
  assert.ok(q.confirm.findIndex((i) => i.id === 'old') < q.confirm.findIndex((i) => i.id === 'small'));
});

test('wait levels and compact durations', () => {
  assert.deepEqual([30, 90, 300].map(waitLevel), ['ok', 'slow', 'late']);
  assert.deepEqual([45, 130, 120, 3000].map(shortDuration), ['45m', '2h 10m', '2h', '2d']);
});
