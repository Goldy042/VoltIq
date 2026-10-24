/**
 * "Do you have light?": asking residents around an outage, so EEDC sees how
 * far it really goes. "Yes" marks a lit block on the map; "no" counts as a
 * report on the outage. Rules and copy live in src/lib/checks.ts.
 */

import { randomBytes } from 'node:crypto';
import { and, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { incidents, lightChecks, notifications, outageReports, savedPlaces, users } from '@/lib/db/schema';
import { describeLocation } from '@/lib/address';
import { prefsOf } from '@/lib/alerts';
import { cellCenter, cellOf, distanceToCells, type Cell } from '@/lib/footprint';
import { ASK_AT, ASK_BATCH, ASK_REPEAT_MS, ASK_RING_M, ASK_ROUND_MS, checkCopy, pushCheck, wantsChecks, type CheckAnswer } from '@/lib/checks';
import { reportWeight } from './abuse';
import { refreshIncident, ReportError } from './reports';
import { sendPush } from './notifications';

const BOX_DEG = 0.03;
const newToken = () => randomBytes(18).toString('base64url');

/** Dark blocks of an outage: where its counted reports came from. */
async function darkCells(db: Db, incidentId: string): Promise<Cell[]> {
  const rows = await db
    .select({ lat: outageReports.latitude, lng: outageReports.longitude })
    .from(outageReports)
    .where(and(eq(outageReports.incidentId, incidentId), eq(outageReports.flagged, false), ne(outageReports.status, 'false_report')));
  const seen = new Map<string, Cell>();
  for (const r of rows) {
    const c = cellOf(r);
    seen.set(c.join(':'), c);
  }
  return [...seen.values()];
}

/**
 * Ask up to ASK_BATCH residents with a saved place near the outage who
 * haven't reported it. Automatic rounds wait ASK_ROUND_MS between them;
 * staff can `force` one sooner. Nobody is asked twice within ASK_REPEAT_MS.
 * Never throws. Returns how many were asked.
 */
export async function askNeighbours(db: Db, incidentId: string, opts: { now?: Date; force?: boolean } = {}) {
  const now = opts.now ?? new Date();
  try {
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!inc || inc.status === 'restored' || inc.issueType !== 'no_power') return 0;
    if (!opts.force && inc.reporterCount < ASK_AT) return 0;

    if (!opts.force) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(lightChecks)
        .where(and(eq(lightChecks.incidentId, incidentId), gte(lightChecks.askedAt, new Date(now.getTime() - ASK_ROUND_MS))));
      if (n > 0) return 0;
    }

    const cells = await darkCells(db, incidentId);
    if (!cells.length) return 0;
    const centre = cellCenter(cells[0]);

    const [places, reporters, already, recent] = await Promise.all([
      db
        .select({ userId: savedPlaces.userId, lat: savedPlaces.latitude, lng: savedPlaces.longitude })
        .from(savedPlaces)
        .where(
          and(
            sql`${savedPlaces.latitude} between ${centre.lat - BOX_DEG} and ${centre.lat + BOX_DEG}`,
            sql`${savedPlaces.longitude} between ${centre.lng - BOX_DEG} and ${centre.lng + BOX_DEG}`,
          ),
        ),
      db.selectDistinct({ userId: outageReports.userId }).from(outageReports).where(eq(outageReports.incidentId, incidentId)),
      db.select({ userId: lightChecks.userId }).from(lightChecks).where(eq(lightChecks.incidentId, incidentId)),
      db
        .select({ userId: lightChecks.userId })
        .from(lightChecks)
        .where(gte(lightChecks.askedAt, new Date(now.getTime() - ASK_REPEAT_MS))),
    ]);
    const skip = new Set([...reporters, ...already, ...recent].map((r) => r.userId));

    // Each person's closest place within reach, closest people first.
    const best = new Map<string, { lat: number; lng: number; d: number }>();
    for (const p of places) {
      if (skip.has(p.userId)) continue;
      const d = distanceToCells(p, cells);
      if (d > ASK_RING_M) continue;
      const cur = best.get(p.userId);
      if (!cur || d < cur.d) best.set(p.userId, { lat: p.lat, lng: p.lng, d });
    }
    if (!best.size) return 0;

    const people = await db
      .select({ id: users.id, prefs: users.alertPrefs })
      .from(users)
      .where(and(inArray(users.id, [...best.keys()]), eq(users.role, 'citizen')));
    const chosen = people
      .map((p) => ({ id: p.id, prefs: prefsOf(p.prefs), ...best.get(p.id)! }))
      .filter((p) => wantsChecks(p.prefs))
      .sort((a, b) => a.d - b.d)
      .slice(0, ASK_BATCH);
    if (!chosen.length) return 0;

    const rows = await db
      .insert(lightChecks)
      .values(chosen.map((p) => ({ incidentId, userId: p.id, latitude: p.lat, longitude: p.lng, token: newToken(), askedAt: now, createdAt: now })))
      .onConflictDoNothing()
      .returning();

    const { title, body } = checkCopy(describeLocation({ lat: inc.centerLat, lng: inc.centerLng }).summary);
    await db.insert(notifications).values(rows.map((r) => ({ userId: r.userId, type: 'light_check' as const, incidentId, title, message: body, sentAt: now })));

    const prefsById = new Map(chosen.map((p) => [p.id, p.prefs]));
    await Promise.all(
      rows
        .filter((r) => pushCheck(prefsById.get(r.userId)!, now))
        .map((r) =>
          sendPush(db, [r.userId], {
            title,
            body,
            url: `/outages/${incidentId}`,
            tag: `check-${incidentId}`,
            check: { id: r.id, token: r.token },
          }),
        ),
    );
    return rows.length;
  } catch (e) {
    console.error('askNeighbours failed', e);
    return 0;
  }
}

/** A resident's answers from the last day, so the app doesn't ask again. */
export async function listMyChecks(db: Db, userId: string, now = new Date()) {
  const rows = await db
    .select({ incidentId: lightChecks.incidentId, answer: lightChecks.answer })
    .from(lightChecks)
    .where(and(eq(lightChecks.userId, userId), isNotNull(lightChecks.answer), gte(lightChecks.answeredAt, new Date(now.getTime() - 24 * 3_600_000))));
  return rows.map((r) => ({ incidentId: r.incidentId, answer: r.answer as CheckAnswer }));
}

type Who = { token: string; checkId: string } | { userId: string; incidentId: string };

/**
 * Record an answer. From a notification button the token proves who it is;
 * from the app the signed-in user answers for their closest saved place.
 */
export async function answerCheck(db: Db, who: Who, answer: CheckAnswer, now = new Date()) {
  if (answer !== 'on' && answer !== 'off') throw new ReportError('invalid', 'Answer "on" or "off".');

  let check: typeof lightChecks.$inferSelect | undefined;
  if ('token' in who) {
    [check] = await db.select().from(lightChecks).where(and(eq(lightChecks.id, who.checkId), eq(lightChecks.token, who.token)));
    if (!check) throw new ReportError('not_found', 'This question has expired.');
  } else {
    [check] = await db.select().from(lightChecks).where(and(eq(lightChecks.incidentId, who.incidentId), eq(lightChecks.userId, who.userId)));
    if (!check) {
      // Answering from a card in the app: use the saved place nearest the outage.
      const cells = await darkCells(db, who.incidentId);
      const places = await db.select().from(savedPlaces).where(eq(savedPlaces.userId, who.userId));
      const near = places
        .map((p) => ({ p, d: distanceToCells({ lat: p.latitude, lng: p.longitude }, cells) }))
        .filter((x) => x.d <= ASK_RING_M + 100)
        .sort((a, b) => a.d - b.d)[0];
      if (!near) throw new ReportError('invalid', 'None of your saved places is near this outage.');
      [check] = await db
        .insert(lightChecks)
        .values({ incidentId: who.incidentId, userId: who.userId, latitude: near.p.latitude, longitude: near.p.longitude, token: newToken(), createdAt: now })
        .onConflictDoNothing()
        .returning();
      if (!check) [check] = await db.select().from(lightChecks).where(and(eq(lightChecks.incidentId, who.incidentId), eq(lightChecks.userId, who.userId)));
    }
  }

  const [inc] = await db.select().from(incidents).where(eq(incidents.id, check.incidentId));
  if (!inc) throw new ReportError('not_found', 'That outage no longer exists.');
  if (inc.status === 'restored') return { answer, closed: true };

  await db
    .update(lightChecks)
    .set({ answer, answeredAt: now, via: 'token' in who ? 'push' : 'app' })
    .where(eq(lightChecks.id, check.id));

  // "No light" is a report on this outage, unless they already have one.
  if (answer === 'off') {
    await db.transaction(async (tx) => {
      const [mine] = await tx
        .select({ id: outageReports.id })
        .from(outageReports)
        .where(and(eq(outageReports.incidentId, inc.id), eq(outageReports.userId, check.userId), ne(outageReports.status, 'false_report')));
      if (mine) return;
      const [user] = await tx.select({ trust: users.trustScore }).from(users).where(eq(users.id, check.userId));
      await tx.insert(outageReports).values({
        userId: check.userId,
        areaId: inc.areaId,
        incidentId: inc.id,
        latitude: check.latitude,
        longitude: check.longitude,
        issueType: inc.issueType,
        outageStartedAt: inc.startedAt,
        weight: reportWeight(user?.trust ?? 50, false),
        lastConfirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await refreshIncident(tx, inc.id, now);
    });
  }
  return { answer, closed: false };
}
