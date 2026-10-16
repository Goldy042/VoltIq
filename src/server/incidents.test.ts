/**
 * Live map read model and staff status changes against a real Postgres.
 * Runs only when TEST_DATABASE_URL points at a migrated, seeded database:
 *
 *   TEST_DATABASE_URL=postgres://…/voltiq_test pnpm test
 */
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';
if (url) process.env.DATABASE_URL = url;

const hilltop = { lat: 6.85615, lng: 7.41458 };
const t0 = new Date('2026-10-16T16:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

let db: import('@/lib/db/client').Db;
let S: typeof import('@/lib/db/schema');
let R: typeof import('./reports');
let I: typeof import('./incidents');

before(async () => {
  if (skip) return;
  db = (await import('@/lib/db/client')).getDb();
  S = await import('@/lib/db/schema');
  R = await import('./reports');
  I = await import('./incidents');
});

after(async () => {
  if (!skip) await (db.$client as import('pg').Pool).end();
});

beforeEach(async () => {
  if (skip) return;
  await db.execute(sql`truncate trust_events, outage_reports, incidents, saved_places, area_corrections, users restart identity cascade`);
});

let n = 0;
async function resident(note?: string) {
  const [u] = await db
    .insert(S.users)
    .values({ name: `Resident ${++n}`, email: `live${n}@example.com`, createdAt: at(-60 * 24 * 30) })
    .returning();
  await db.insert(S.savedPlaces).values({ userId: u.id, label: 'home', latitude: hilltop.lat, longitude: hilltop.lng, plusCode: 'X', isPrimary: true });
  const p = { lat: hilltop.lat + n * 0.0002, lng: hilltop.lng };
  return R.submitReport(db, u.id, { issue: 'no_power', lat: p.lat, lng: p.lng, device: { ...p, accuracy: 10 }, startedAt: at(-30).toISOString(), note }, { now: t0 });
}

test('reports show up on the live map as one outage', { skip }, async () => {
  await resident('My neighbour Ada’s gate, number 4');
  await resident();
  const feed = await I.listLiveFeed(db, { now: at(5) });
  assert.equal(feed.incidents.length, 1);
  const inc = feed.incidents[0];
  assert.equal(inc.reports, 2);
  assert.equal(inc.areaId, 'hilltop');
  assert.equal(inc.minutesAgo, 35);
  assert.ok(inc.households >= 2);
  assert.ok(feed.dots.length >= 1);
});

test('residents never see notes; staff do', { skip }, async () => {
  await resident('My neighbour Ada’s gate, number 4');
  const pub = await I.listLiveFeed(db, { now: at(1) });
  assert.doesNotMatch(pub.incidents[0].note, /Ada/);
  const staff = await I.listLiveFeed(db, { now: at(1), staff: true });
  assert.match(staff.incidents[0].note, /Ada/);
});

test('staff move an outage through the repair flow', { skip }, async () => {
  const r = await resident();
  const id = r.incident!.id;
  await I.setIncidentStatus(db, id, 'confirmed', at(1));
  await I.setIncidentStatus(db, id, 'crew_dispatched', at(2));
  await I.setIncidentStatus(db, id, 'restored', at(3));
  const [row] = await db.select().from(S.incidents).where(eq(S.incidents.id, id));
  assert.equal(row.status, 'restored');
  assert.equal(row.restoredBy, 'eedc');
  assert.ok(row.confirmedAt);
  await assert.rejects(I.setIncidentStatus(db, id, 'crew_dispatched', at(4)), /can’t be moved/);
});

test('restored outages leave the map after six hours', { skip }, async () => {
  const r = await resident();
  await I.setIncidentStatus(db, r.incident!.id, 'restored', at(1));
  assert.equal((await I.listLiveFeed(db, { now: at(60) })).incidents.length, 1);
  assert.equal((await I.listLiveFeed(db, { now: at(7 * 60) })).incidents.length, 0);
});
