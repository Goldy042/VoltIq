/**
 * End-to-end reporting rules against a real Postgres.
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

// Middle of Hilltop, between the resident-pinned gate and far end.
const hilltop = { lat: 6.85615, lng: 7.41458 };
const near = (m: number) => ({ lat: hilltop.lat + m / 111_320, lng: hilltop.lng });
const t0 = new Date('2026-10-02T16:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const iso = (d: Date) => d.toISOString();

// Loaded lazily so the file can be skipped without a database.
let db: import('@/lib/db/client').Db;
let S: typeof import('@/lib/db/schema');
let R: typeof import('./reports');

before(async () => {
  if (skip) return;
  db = (await import('@/lib/db/client')).getDb();
  S = await import('@/lib/db/schema');
  R = await import('./reports');
});

after(async () => {
  if (!skip) await (db.$client as import('pg').Pool).end();
});

beforeEach(async () => {
  if (skip) return;
  await db.execute(sql`truncate trust_events, outage_reports, incidents, saved_places, area_corrections, users restart identity cascade`);
});

let n = 0;
async function makeUser(opts: { trust?: number; createdAt?: Date } = {}) {
  const [u] = await db
    .insert(S.users)
    .values({ name: `Resident ${++n}`, email: `r${n}@example.com`, trustScore: opts.trust ?? 50, createdAt: opts.createdAt ?? at(-60 * 24 * 30) })
    .returning();
  await db.insert(S.savedPlaces).values({ userId: u.id, label: 'home', latitude: hilltop.lat, longitude: hilltop.lng, plusCode: 'X', isPrimary: true });
  return u;
}

const report = (p = hilltop, extra: Partial<import('@/lib/reporting').ReportInput> = {}) => ({
  issue: 'no_power' as const,
  lat: p.lat,
  lng: p.lng,
  device: { ...p, accuracy: 15 },
  startedAt: iso(at(-20)),
  ...extra,
});

test('a first report creates an outage in the right area', { skip }, async () => {
  const u = await makeUser();
  const r = await R.submitReport(db, u.id, report(), { now: t0 });
  assert.equal(r.outcome, 'created');
  assert.equal(r.incident?.areaSlug, 'hilltop');
  assert.equal(r.incident?.reporterCount, 1);
});

test('neighbours join the same outage', { skip }, async () => {
  const a = await makeUser();
  const b = await makeUser();
  const r1 = await R.submitReport(db, a.id, report(), { now: t0 });
  const r2 = await R.submitReport(db, b.id, report(near(120)), { now: at(2) });
  assert.equal(r2.outcome, 'created');
  assert.equal(r2.incident?.id, r1.incident?.id);
  assert.equal(r2.incident?.reporterCount, 2);
});

test('the same person reporting again is merged, not counted twice', { skip }, async () => {
  const u = await makeUser();
  const first = await R.submitReport(db, u.id, report(), { now: t0 });
  const soon = await R.submitReport(db, u.id, report(near(50)), { now: at(3) });
  assert.equal(soon.outcome, 'already_counted');
  const later = await R.submitReport(db, u.id, report(near(80), { note: 'Still dark' }), { now: at(25) });
  assert.equal(later.outcome, 'merged');
  assert.equal(later.reportId, first.reportId);
  assert.equal(later.outcome === 'merged' && later.repeatCount, 1);
  const rows = await db.select().from(S.outageReports);
  assert.equal(rows.length, 1);
  const [inc] = await db.select().from(S.incidents);
  assert.equal(inc.reporterCount, 1);
});

test('rate limit: a 4th new outage within an hour is refused with a wait time', { skip }, async () => {
  const u = await makeUser();
  // Different areas so they are new reports, not merges.
  await R.submitReport(db, u.id, report(hilltop), { now: t0 });
  await R.submitReport(db, u.id, report({ lat: 6.8577, lng: 7.4028 }, { device: undefined }), { now: at(5) });
  await R.submitReport(db, u.id, report({ lat: 6.851, lng: 7.3994 }, { device: undefined }), { now: at(10) });
  await assert.rejects(
    R.submitReport(db, u.id, report({ lat: 6.8561, lng: 7.3927 }, { device: undefined }), { now: at(15) }),
    (e: InstanceType<typeof R.ReportError>) => e.code === 'rate_limited' && e.extra.retryAfterSec === 45 * 60,
  );
});

test('suspicious reports are kept but carry no weight', { skip }, async () => {
  const honest = await makeUser();
  const fresh = await makeUser({ trust: 10, createdAt: at(-2) });
  await R.submitReport(db, honest.id, report(), { now: t0 });
  // New, low-trust account, phone across town from the pin.
  const r = await R.submitReport(db, fresh.id, report(near(60), { device: { lat: 6.83, lng: 7.37, accuracy: 10 } }), { now: at(1) });
  assert.equal(r.outcome === 'created' && r.flagged, true);
  const [row] = await db.select().from(S.outageReports).where(eq(S.outageReports.userId, fresh.id));
  assert.deepEqual([...row.flags].sort(), ['device_far_from_pin', 'low_trust', 'new_account']);
  assert.equal(row.weight, 0);
  const [inc] = await db.select().from(S.incidents);
  assert.equal(inc.reporterCount, 1, 'flagged reporter not counted');
});

test('trust: corroborated at 5 reporters, accepted +3, false −15', { skip }, async () => {
  const people = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
  const results = [];
  for (const [i, p] of people.entries()) results.push(await R.submitReport(db, p.id, report(near(i * 40)), { now: at(i) }));
  const trusts = (await db.select().from(S.users)).map((u) => u.trustScore);
  assert.deepEqual(trusts, [51, 51, 51, 51, 51]);

  const staff = await makeUser();
  const accepted = await R.reviewReport(db, staff.id, results[0].reportId, 'accepted', at(10));
  assert.equal(accepted.reporterTrust, 54);
  const rejected = await R.reviewReport(db, staff.id, results[1].reportId, 'false_report', at(11));
  assert.equal(rejected.reporterTrust, 36);
  // Reviewing twice doesn't double-count.
  assert.equal((await R.reviewReport(db, staff.id, results[1].reportId, 'false_report', at(12))).reporterTrust, 36);
});

test('light back: prompts after 30 min, 3 yeses restore the outage, 2 "still off" reopen it', { skip }, async () => {
  const people = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
  const ids = [];
  for (const [i, p] of people.entries()) ids.push((await R.submitReport(db, p.id, report(near(i * 30)), { now: at(i) })).reportId);

  assert.equal((await R.listLightBackPrompts(db, people[0].id, at(10))).length, 0, 'too soon to ask');
  assert.equal((await R.listLightBackPrompts(db, people[0].id, at(40))).length, 1);

  assert.equal((await R.answerLightBack(db, people[0].id, ids[0], true, at(60))).status, 'closed');
  assert.equal((await R.answerLightBack(db, people[1].id, ids[1], true, at(61))).status, 'closed');
  assert.equal((await R.answerLightBack(db, people[2].id, ids[2], true, at(62))).status, 'restored');
  let [inc] = await db.select().from(S.incidents);
  assert.equal(inc.status, 'restored');
  assert.equal(inc.restoredBy, 'community');

  // Once it's restored, the others are asked straight away.
  assert.equal((await R.listLightBackPrompts(db, people[3].id, at(63))).length, 1);
  // Someone can only answer for their own report.
  await assert.rejects(R.answerLightBack(db, people[0].id, ids[3], false, at(64)), /isn’t yours/);

  // One "still off" isn't enough to reopen; a second resident is.
  assert.equal((await R.answerLightBack(db, people[3].id, ids[3], false, at(70))).status, 'still_off');
  assert.equal((await R.answerLightBack(db, people[4].id, ids[4], false, at(71))).status, 'reopened');
  [inc] = await db.select().from(S.incidents);
  assert.equal(inc.status, 'reported');
});

test('area suggestions use residents’ corrections', { skip }, async () => {
  const a = await makeUser();
  const b = await makeUser();
  const c = await makeUser();
  const spot = { lat: 6.8705, lng: 7.4147 }; // near Odim Street, between Odim Gate and the campus
  const before = await R.suggestAreas(db, spot, 0, c.id);
  const guess = before.areas[0].slug;
  const other = guess === 'unn' ? 'odim' : 'unn';
  // Two residents say this spot is the other area.
  await R.recordAreaCorrection(db, a.id, spot, other, guess);
  await R.recordAreaCorrection(db, b.id, { lat: spot.lat + 0.0002, lng: spot.lng }, other, guess);
  assert.equal((await R.suggestAreas(db, spot, 0, c.id)).areas[0].slug, other);
  // Your own correction beats the community's.
  await R.recordAreaCorrection(db, c.id, spot, guess, other);
  assert.equal((await R.suggestAreas(db, spot, 0, c.id)).areas[0].slug, guess);
});

test('a drawn boundary beats corrections (Hilltop)', { skip }, async () => {
  const a = await makeUser();
  const b = await makeUser();
  await R.recordAreaCorrection(db, a.id, hilltop, 'beach', 'hilltop');
  await R.recordAreaCorrection(db, b.id, hilltop, 'beach', 'hilltop');
  assert.equal((await R.suggestAreas(db, hilltop, 0, a.id)).areas[0].slug, 'hilltop');
});

test('validation: outside Nsukka and future start times are refused', { skip }, async () => {
  const u = await makeUser();
  await assert.rejects(R.submitReport(db, u.id, report({ lat: 6.45, lng: 7.5 }), { now: t0 }), (e: { code: string }) => e.code === 'outside_area');
  await assert.rejects(R.submitReport(db, u.id, report(hilltop, { startedAt: iso(at(30)) }), { now: t0 }), (e: { code: string }) => e.code === 'invalid');
});
