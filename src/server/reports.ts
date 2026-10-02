/**
 * Reporting backend: turn a resident's report into an outage EEDC can act on,
 * without letting one person (or a bot) distort the map.
 *
 * - Same person, same outage → merged into their existing report.
 * - Sliding-window rate limits per person and per network.
 * - Suspicion flags; flagged reports are kept but weigh nothing until reviewed.
 * - Trust score: reports weigh more as a resident's reports prove right.
 * - "Is your light back?" closes reports, and enough "yes" restores the outage.
 */

import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { areaCorrections, areas, incidents, outageReports, savedPlaces, trustEvents, users } from '@/lib/db/schema';
import { NSUKKA_BOUNDS, type IncidentStatus, type IssueType } from '@/data/nsukka';
import { distanceMeters } from '@/lib/geo';
import { resolveArea, type AreaCorrection } from '@/lib/address';
import type {
  AreaSuggestion,
  IncidentSummary,
  LatLng,
  OpenReport,
  ReportContext,
  ReportErrorCode,
  ReportInput,
  SubmitResult,
} from '@/lib/reporting';
import {
  CORROBORATE_AT,
  LIMITS,
  TRUST,
  assessSuspicion,
  checkRateLimit,
  clampTrust,
  reportWeight,
} from './abuse';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Conn = Db | Tx;

export class ReportError extends Error {
  constructor(
    public code: ReportErrorCode,
    message: string,
    public extra: { retryAfterSec?: number; field?: string } = {},
  ) {
    super(message);
  }
}

const ISSUES: IssueType[] = ['no_power', 'low_voltage', 'fluctuating'];
const OPEN_REPORT: Array<'reported' | 'confirmed' | 'team_dispatched'> = ['reported', 'confirmed', 'team_dispatched'];
const MIN = 60_000;

/* ------------------------------------------------------------------ */
/* Areas                                                               */
/* ------------------------------------------------------------------ */

type AreaRow = typeof areas.$inferSelect;

async function loadAreas(db: Conn) {
  const rows = await db.select().from(areas);
  return { rows, bySlug: new Map(rows.map((a) => [a.slug, a])), byId: new Map(rows.map((a) => [a.id, a])) };
}

/**
 * Corrections that should steer an area guess at this point: the person's
 * own, plus places where at least two other residents agreed.
 */
async function correctionsNear(db: Conn, p: LatLng, userId: string | null, byId: Map<string, AreaRow>): Promise<AreaCorrection[]> {
  const d = 0.002; // ~220 m box, filtered precisely below
  const rows = await db
    .select()
    .from(areaCorrections)
    .where(
      and(
        gte(areaCorrections.latitude, p.lat - d),
        sql`${areaCorrections.latitude} <= ${p.lat + d}`,
        gte(areaCorrections.longitude, p.lng - d),
        sql`${areaCorrections.longitude} <= ${p.lng + d}`,
      ),
    )
    .orderBy(desc(areaCorrections.createdAt))
    .limit(200);

  const toCorrection = (r: (typeof rows)[number]) => ({ lat: r.latitude, lng: r.longitude, areaId: byId.get(r.areaId)?.slug ?? '' });
  const own = rows.filter((r) => userId && r.userId === userId).map(toCorrection);
  const others = rows.filter((r) => r.userId !== userId);
  const agreed = others.filter((r) => {
    const voters = new Set(others.filter((o) => o.areaId === r.areaId && distanceMeters({ lat: o.latitude, lng: o.longitude }, { lat: r.latitude, lng: r.longitude }) < 150).map((o) => o.userId));
    return voters.size >= 2;
  });
  return [...own, ...agreed.map(toCorrection)].filter((c) => c.areaId);
}

export async function suggestAreas(db: Conn, p: LatLng, accuracy: number, userId: string | null) {
  const { byId, bySlug } = await loadAreas(db);
  const match = resolveArea(p, accuracy, await correctionsNear(db, p, userId, byId));
  const list: AreaSuggestion[] = [match.area, ...match.alternatives].map((a) => ({
    slug: a.id,
    name: a.name,
    feeder: bySlug.get(a.id)?.feeder ?? a.feeder,
    distanceM: Math.round(distanceMeters(a, p)),
  }));
  return { areas: list, confident: match.confident };
}

/** Remember "I'm in Hilltop, not Odim Gate" so the next guess here is right. */
export async function recordAreaCorrection(db: Conn, userId: string, p: LatLng & { accuracy?: number }, areaSlug: string, guessedSlug?: string) {
  const { bySlug } = await loadAreas(db);
  const area = bySlug.get(areaSlug);
  if (!area) throw new ReportError('invalid', 'Unknown area.', { field: 'areaSlug' });
  await db.insert(areaCorrections).values({
    userId,
    latitude: p.lat,
    longitude: p.lng,
    accuracyM: p.accuracy ?? null,
    areaId: area.id,
    guessedAreaId: guessedSlug ? (bySlug.get(guessedSlug)?.id ?? null) : null,
  });
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

type IncidentRow = typeof incidents.$inferSelect;

function summarize(i: IncidentRow, area: AreaRow | undefined, from?: LatLng): IncidentSummary {
  return {
    id: i.id,
    areaSlug: area?.slug ?? '',
    areaName: area?.name ?? 'Nsukka',
    issue: i.issueType,
    status: i.status as IncidentStatus,
    reporterCount: i.reporterCount,
    lat: i.centerLat,
    lng: i.centerLng,
    radiusM: i.radiusM,
    startedAt: i.startedAt.toISOString(),
    distanceM: from ? Math.round(distanceMeters({ lat: i.centerLat, lng: i.centerLng }, from)) : undefined,
  };
}

/** Everything the report screen needs for a pin: area suggestions, outages nearby, and your own open report. */
export async function getReportContext(db: Db, userId: string, p: LatLng, accuracy = 0, now = new Date()): Promise<ReportContext> {
  const { byId } = await loadAreas(db);
  const suggestion = await suggestAreas(db, p, accuracy, userId);

  const open = await db.select().from(incidents).where(ne(incidents.status, 'restored'));
  const nearby = open
    .map((i) => ({ i, d: distanceMeters({ lat: i.centerLat, lng: i.centerLng }, p) }))
    .filter(({ i, d }) => d <= i.radiusM + 1000)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map(({ i }) => summarize(i, byId.get(i.areaId), p));

  const mine = await findMergeTarget(db, userId, p, now);
  return { ...suggestion, nearby, myOpen: mine ? await toOpenReport(db, mine, byId) : null };
}

async function toOpenReport(db: Conn, r: typeof outageReports.$inferSelect, byId: Map<string, AreaRow>): Promise<OpenReport> {
  const [inc] = r.incidentId ? await db.select().from(incidents).where(eq(incidents.id, r.incidentId)) : [];
  return {
    id: r.id,
    issue: r.issueType,
    areaName: (r.areaId && byId.get(r.areaId)?.name) || 'Nsukka',
    createdAt: r.createdAt.toISOString(),
    lastConfirmedAt: r.lastConfirmedAt.toISOString(),
    incident: inc ? summarize(inc, byId.get(inc.areaId)) : null,
  };
}

/**
 * Reports to ask "is your light back?" about: still open, not answered, and
 * either 30+ minutes since the person last said it was off or EEDC/neighbours
 * already say it's restored.
 */
export async function listLightBackPrompts(db: Db, userId: string, now = new Date()): Promise<OpenReport[]> {
  const { byId } = await loadAreas(db);
  const rows = await db
    .select()
    .from(outageReports)
    .where(
      and(
        eq(outageReports.userId, userId),
        isNull(outageReports.lightBackAt),
        inArray(outageReports.status, OPEN_REPORT),
        gte(outageReports.createdAt, new Date(now.getTime() - 48 * 60 * MIN)),
      ),
    )
    .orderBy(desc(outageReports.createdAt));
  const out: OpenReport[] = [];
  for (const r of rows) {
    const o = await toOpenReport(db, r, byId);
    const quiet = now.getTime() - r.lastConfirmedAt.getTime() >= 30 * MIN;
    if (quiet || o.incident?.status === 'restored') out.push(o);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Submitting                                                          */
/* ------------------------------------------------------------------ */

function validate(input: ReportInput, now: Date) {
  const bad = (field: string, message: string) => new ReportError('invalid', message, { field });
  if (!ISSUES.includes(input.issue)) throw bad('issue', 'Choose what you’re experiencing.');
  if (![input.lat, input.lng].every(Number.isFinite)) throw bad('location', 'Place the pin on the map.');
  const [w, s, e, n] = NSUKKA_BOUNDS;
  if (input.lng < w || input.lng > e || input.lat < s || input.lat > n) {
    throw new ReportError('outside_area', 'VoltIq only covers Nsukka for now. Move the pin to where the outage is.', { field: 'location' });
  }
  if (input.device && ![input.device.lat, input.device.lng, input.device.accuracy].every(Number.isFinite)) {
    throw bad('device', 'Invalid device location.');
  }
  const started = new Date(input.startedAt);
  if (Number.isNaN(started.getTime())) throw bad('startedAt', 'Tell us roughly when it started.');
  if (started.getTime() > now.getTime() + 5 * MIN) throw bad('startedAt', 'The start time is in the future.');
  if (started.getTime() < now.getTime() - 72 * 60 * MIN) throw bad('startedAt', 'Report outages from the last 3 days.');
  if (input.voltage !== undefined && (!Number.isInteger(input.voltage) || input.voltage < 0 || input.voltage > 300)) {
    throw bad('voltage', 'Enter a reading between 0 and 300 volts.');
  }
  if (input.note && input.note.length > 500) throw bad('note', 'Keep the note under 500 characters.');
  if (input.landmark && input.landmark.length > 160) throw bad('landmark', 'Keep the landmark under 160 characters.');
  return started;
}

/** This person's open report for the same outage: close by, recent, not answered "light back". */
async function findMergeTarget(db: Conn, userId: string, p: LatLng, now: Date) {
  const rows = await db
    .select()
    .from(outageReports)
    .where(
      and(
        eq(outageReports.userId, userId),
        isNull(outageReports.lightBackAt),
        inArray(outageReports.status, OPEN_REPORT),
        gte(outageReports.lastConfirmedAt, new Date(now.getTime() - LIMITS.mergeWindowHours * 60 * MIN)),
      ),
    )
    .orderBy(desc(outageReports.lastConfirmedAt));
  return rows.find((r) => distanceMeters({ lat: r.latitude, lng: r.longitude }, p) <= LIMITS.mergeRadiusM) ?? null;
}

const severity: Record<IssueType, number> = { no_power: 2, fluctuating: 1, low_voltage: 0 };

export async function submitReport(
  db: Db,
  userId: string,
  input: ReportInput,
  ctx: { ipHash?: string | null; now?: Date } = {},
): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  const startedAt = validate(input, now);
  const point = { lat: input.lat, lng: input.lng };

  return db.transaction(async (tx) => {
    // One report at a time per person, so two quick taps can't both pass the limits.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new ReportError('forbidden', 'Sign in again to report.');
    const { bySlug, byId } = await loadAreas(tx);

    // 1. Same outage, same person → count it again on their existing report.
    const existing = await findMergeTarget(tx, userId, point, now);
    if (existing) {
      const [inc] = existing.incidentId ? await tx.select().from(incidents).where(eq(incidents.id, existing.incidentId)) : [];
      const summary = inc ? summarize(inc, byId.get(inc.areaId)) : null;
      const since = now.getTime() - existing.lastConfirmedAt.getTime();
      if (since < LIMITS.reconfirmCooldownMin * MIN) {
        return {
          outcome: 'already_counted',
          reportId: existing.id,
          incident: summary,
          nextAllowedAt: new Date(existing.lastConfirmedAt.getTime() + LIMITS.reconfirmCooldownMin * MIN).toISOString(),
        };
      }
      const [updated] = await tx
        .update(outageReports)
        .set({
          repeatCount: existing.repeatCount + 1,
          lastConfirmedAt: now,
          updatedAt: now,
          // Things got worse (dim → off): keep the more serious issue.
          issueType: severity[input.issue] > severity[existing.issueType] ? input.issue : existing.issueType,
          description: input.note?.trim() || existing.description,
          voltageReading: input.voltage ?? existing.voltageReading,
          landmark: input.landmark?.trim() || existing.landmark,
        })
        .where(eq(outageReports.id, existing.id))
        .returning();
      if (inc) await tx.update(incidents).set({ lastReportAt: now }).where(eq(incidents.id, inc.id));
      return { outcome: 'merged', reportId: updated.id, incident: summary, repeatCount: updated.repeatCount };
    }

    // 2. Rate limits for genuinely new reports.
    const dayAgo = new Date(now.getTime() - 24 * 60 * MIN);
    const recent = await tx
      .select({ lat: outageReports.latitude, lng: outageReports.longitude, createdAt: outageReports.createdAt, areaId: outageReports.areaId })
      .from(outageReports)
      .where(and(eq(outageReports.userId, userId), gte(outageReports.createdAt, dayAgo)));
    const ipRecent = ctx.ipHash
      ? await tx
          .select({ createdAt: outageReports.createdAt })
          .from(outageReports)
          .where(and(eq(outageReports.ipHash, ctx.ipHash), gte(outageReports.createdAt, new Date(now.getTime() - 60 * MIN))))
      : [];
    const limit = checkRateLimit({
      userReports: recent.map((r) => r.createdAt),
      ipReports: ipRecent.map((r) => r.createdAt),
      trust: user.trustScore,
      now,
    });
    if (!limit.ok) throw new ReportError('rate_limited', limit.message, { retryAfterSec: limit.retryAfterSec });

    // 3. Area: what they picked if it exists, otherwise our best guess.
    const guess = await suggestAreas(tx, point, input.device?.accuracy ?? 0, userId);
    const area = (input.areaSlug && bySlug.get(input.areaSlug)) || bySlug.get(guess.areas[0].slug);
    if (!area) throw new ReportError('invalid', 'Areas are not set up yet. Run the seed script.');

    // 4. Find the outage this belongs to: same area and problem, close to its centre.
    const open = await tx
      .select()
      .from(incidents)
      .where(and(eq(incidents.areaId, area.id), eq(incidents.issueType, input.issue), ne(incidents.status, 'restored')));
    let incident = open
      .map((i) => ({ i, d: distanceMeters({ lat: i.centerLat, lng: i.centerLng }, point) }))
      .filter(({ i, d }) => d <= i.radiusM + 300)
      .sort((a, b) => a.d - b.d)[0]?.i;

    // 5. Suspicion.
    const places = await tx.select({ lat: savedPlaces.latitude, lng: savedPlaces.longitude }).from(savedPlaces).where(eq(savedPlaces.userId, userId));
    const recentLightBack = incident
      ? (
          await tx
            .select({ n: sql<number>`count(distinct ${outageReports.userId})::int` })
            .from(outageReports)
            .where(and(eq(outageReports.incidentId, incident.id), gte(outageReports.lightBackAt, new Date(now.getTime() - 30 * MIN))))
        )[0].n
      : 0;
    const suspicion = assessSuspicion({
      point,
      device: input.device,
      savedPlaces: places,
      accountAgeMinutes: (now.getTime() - user.createdAt.getTime()) / MIN,
      trust: user.trustScore,
      recent: recent.map((r) => ({ lat: r.lat, lng: r.lng, createdAt: r.createdAt, areaSlug: (r.areaId && byId.get(r.areaId)?.slug) || null })),
      areaSlug: area.slug,
      chosenArea: { distanceM: distanceMeters({ lat: area.centerLat, lng: area.centerLng }, point), radiusM: area.radiusMeters ?? 1000 },
      issue: input.issue,
      voltage: input.voltage,
      recentLightBack,
      now,
    });

    if (!incident) {
      [incident] = await tx
        .insert(incidents)
        .values({ areaId: area.id, issueType: input.issue, centerLat: point.lat, centerLng: point.lng, startedAt, lastReportAt: now })
        .returning();
    }

    const [report] = await tx
      .insert(outageReports)
      .values({
        userId,
        areaId: area.id,
        incidentId: incident.id,
        latitude: point.lat,
        longitude: point.lng,
        locationAccuracyM: input.device && distanceMeters(input.device, point) < 50 ? input.device.accuracy : null,
        deviceLat: input.device?.lat ?? null,
        deviceLng: input.device?.lng ?? null,
        deviceAccuracyM: input.device?.accuracy ?? null,
        issueType: input.issue,
        voltageReading: input.voltage ?? null,
        description: input.note?.trim() || null,
        landmark: input.landmark?.trim() || null,
        outageStartedAt: startedAt,
        flags: suspicion.flags,
        suspicionScore: suspicion.score,
        flagged: suspicion.flagged,
        weight: reportWeight(user.trustScore, suspicion.flagged),
        ipHash: ctx.ipHash ?? null,
        lastConfirmedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const refreshed = await refreshIncident(tx, incident.id, now);
    return { outcome: 'created', reportId: report.id, incident: summarize(refreshed, area), flagged: suspicion.flagged };
  });
}

/**
 * Recompute an outage from its reports: weight, reporters, centre and size,
 * and reward reporters once enough neighbours back them up.
 */
async function refreshIncident(tx: Tx, incidentId: string, now: Date) {
  const [inc] = await tx.select().from(incidents).where(eq(incidents.id, incidentId));
  const rows = await tx
    .select()
    .from(outageReports)
    .where(and(eq(outageReports.incidentId, incidentId), ne(outageReports.status, 'false_report')));
  const counted = rows.filter((r) => !r.flagged);
  const reporters = new Set(counted.map((r) => r.userId));
  const lightBack = new Set(counted.filter((r) => r.lightBackAt).map((r) => r.userId));

  // Centre on the counted reports; grow to cover them (200–800 m).
  const pts = counted.length ? counted : rows;
  const center = pts.length
    ? { lat: pts.reduce((s, r) => s + r.latitude, 0) / pts.length, lng: pts.reduce((s, r) => s + r.longitude, 0) / pts.length }
    : { lat: inc.centerLat, lng: inc.centerLng };
  const spread = Math.max(0, ...pts.map((r) => distanceMeters(center, { lat: r.latitude, lng: r.longitude })));

  const [updated] = await tx
    .update(incidents)
    .set({
      weightedReports: counted.reduce((s, r) => s + r.weight, 0),
      reporterCount: reporters.size,
      lightBackCount: lightBack.size,
      centerLat: center.lat,
      centerLng: center.lng,
      radiusM: Math.round(Math.min(800, Math.max(200, spread + 60))),
      lastReportAt: rows.length ? new Date(Math.max(...rows.map((r) => r.lastConfirmedAt.getTime()))) : inc.lastReportAt,
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  if (reporters.size >= CORROBORATE_AT) {
    for (const r of counted) await adjustTrust(tx, r.userId, TRUST.corroborated, 'corroborated', r.id, now);
  }
  return updated;
}

/** Move a trust score once per (report, reason); retries and re-runs are no-ops. */
async function adjustTrust(tx: Conn, userId: string, delta: number, reason: string, reportId: string | null, now: Date) {
  const inserted = await tx
    .insert(trustEvents)
    .values({ userId, delta, reason, reportId, createdAt: now })
    .onConflictDoNothing()
    .returning({ id: trustEvents.id });
  if (!inserted.length) return;
  const [u] = await tx.select({ trust: users.trustScore }).from(users).where(eq(users.id, userId));
  await tx.update(users).set({ trustScore: clampTrust(u.trust + delta) }).where(eq(users.id, userId));
}

/* ------------------------------------------------------------------ */
/* "Is your light back?"                                               */
/* ------------------------------------------------------------------ */

/** Residents saying yes, before the outage counts as restored by the community. */
export const RESTORE_AT = 3;

export async function answerLightBack(db: Db, userId: string, reportId: string, back: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(outageReports).where(and(eq(outageReports.id, reportId), eq(outageReports.userId, userId)));
    if (!r) throw new ReportError('not_found', 'That report isn’t yours or no longer exists.');
    if (r.lightBackAt) return { status: 'already_answered' as const };

    if (back) {
      await tx.update(outageReports).set({ lightBackAt: now, updatedAt: now }).where(eq(outageReports.id, r.id));
    } else {
      await tx
        .update(outageReports)
        .set({ lastConfirmedAt: now, repeatCount: r.repeatCount + 1, updatedAt: now })
        .where(eq(outageReports.id, r.id));
    }
    if (!r.incidentId) return { status: back ? ('closed' as const) : ('still_off' as const) };

    const inc = await refreshIncident(tx, r.incidentId, now);

    if (back) {
      if (inc.status === 'restored' && inc.restoredBy === 'eedc') {
        await adjustTrust(tx, userId, TRUST.lightBackAgreed, 'light_back_agreed', r.id, now);
      }
      // Enough neighbours agree: mark it restored so EEDC and the map know.
      if (inc.status !== 'restored' && inc.lightBackCount >= RESTORE_AT && inc.lightBackCount >= inc.reporterCount / 2) {
        await tx.update(incidents).set({ status: 'restored', restoredAt: now, restoredBy: 'community' }).where(eq(incidents.id, inc.id));
        return { status: 'restored' as const };
      }
      return { status: 'closed' as const };
    }

    // Still off after it was marked restored: two different residents reopen it.
    if (inc.status === 'restored' && inc.restoredAt) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(distinct ${outageReports.userId})::int` })
        .from(outageReports)
        .where(
          and(
            eq(outageReports.incidentId, inc.id),
            eq(outageReports.flagged, false),
            isNull(outageReports.lightBackAt),
            gte(outageReports.lastConfirmedAt, inc.restoredAt),
          ),
        );
      if (n >= 2) {
        await tx
          .update(incidents)
          .set({ status: inc.confirmedAt ? 'confirmed' : 'reported', restoredAt: null, restoredBy: null })
          .where(eq(incidents.id, inc.id));
        return { status: 'reopened' as const };
      }
    }
    return { status: 'still_off' as const };
  });
}

/* ------------------------------------------------------------------ */
/* EEDC review                                                         */
/* ------------------------------------------------------------------ */

export async function reviewReport(db: Db, staffId: string, reportId: string, decision: 'accepted' | 'false_report', now = new Date()) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(outageReports).where(eq(outageReports.id, reportId));
    if (!r) throw new ReportError('not_found', 'Report not found.');
    const [reporter] = await tx.select().from(users).where(eq(users.id, r.userId));

    if (decision === 'accepted') {
      await tx
        .update(outageReports)
        .set({
          status: r.status === 'reported' || r.status === 'false_report' ? 'confirmed' : r.status,
          flagged: false,
          weight: reportWeight(reporter.trustScore, false),
          reviewedAt: now,
          reviewedById: staffId,
          updatedAt: now,
        })
        .where(eq(outageReports.id, r.id));
      await adjustTrust(tx, r.userId, TRUST.accepted, 'accepted', r.id, now);
    } else {
      await tx
        .update(outageReports)
        .set({ status: 'false_report', weight: 0, reviewedAt: now, reviewedById: staffId, updatedAt: now })
        .where(eq(outageReports.id, r.id));
      await adjustTrust(tx, r.userId, TRUST.falseReport, 'false_report', r.id, now);
    }
    if (r.incidentId) await refreshIncident(tx, r.incidentId, now);
    const [after] = await tx.select({ trust: users.trustScore }).from(users).where(eq(users.id, r.userId));
    return { reporterTrust: after.trust };
  });
}

