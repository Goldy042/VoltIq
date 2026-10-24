/**
 * The live map, from the database: every open outage (and recently restored
 * ones), the counted reports behind them as anonymised dots, and the status
 * changes EEDC staff make by hand.
 *
 * Grouping reports into outages happens when a report is submitted
 * (submitReport → refreshIncident in ./reports); this file only reads.
 */

import { and, eq, gte, inArray, ne, or } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { areas, dispatches, incidents, lightChecks, outageReports, teams, users } from '@/lib/db/schema';
import type { Incident, IncidentStatus } from '@/data/nsukka';
import { describeLocation } from '@/lib/address';
import {
  MAX_ETA_HOURS,
  PUBLIC_NOTE_MAX,
  SHOW_RESTORED_HOURS,
  bucketReports,
  isCause,
  canMoveStatus,
  describeIncident,
  estimateHouseholds,
  medianVoltage,
  snapDots,
  type LiveFeed,
  type OutageDetail,
  type OutageEvent,
} from '@/lib/incidents';
import { buildFootprint, footprintHomes } from '@/lib/footprint';
import { ReportError } from './reports';
import { completeDispatches, listReportLog, loadCrews } from './operations';
import { notifyIncident } from './notifications';

const HOUR = 3_600_000;

/**
 * Everything the map needs in one call. Residents see no notes (they can
 * contain names and addresses); EEDC staff see the latest one.
 */
export async function listLiveFeed(db: Db, opts: { staff?: boolean; now?: Date } = {}): Promise<LiveFeed> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select()
    .from(incidents)
    .where(or(ne(incidents.status, 'restored'), gte(incidents.restoredAt, new Date(now.getTime() - SHOW_RESTORED_HOURS * HOUR))));

  const crews = await loadCrews(db, { staff: Boolean(opts.staff) });
  if (!rows.length) return { incidents: [], dots: [], crews, serverTime: now.toISOString() };

  // The team currently sent to each outage.
  const open = await db
    .select({ incidentId: dispatches.incidentId, teamId: dispatches.teamId })
    .from(dispatches)
    .where(and(inArray(dispatches.incidentId, rows.map((r) => r.id)), ne(dispatches.status, 'completed')));
  const teamFor = new Map(open.map((d) => [d.incidentId, d.teamId]));

  const areaRows = await db.select().from(areas);
  const areaById = new Map(areaRows.map((a) => [a.id, a]));

  // Only reports that count: not flagged as suspicious, not marked false by EEDC.
  const reports = await db
    .select({
      incidentId: outageReports.incidentId,
      lat: outageReports.latitude,
      lng: outageReports.longitude,
      createdAt: outageReports.createdAt,
      voltage: outageReports.voltageReading,
      note: outageReports.description,
      updatedAt: outageReports.updatedAt,
    })
    .from(outageReports)
    .where(
      and(
        inArray(outageReports.incidentId, rows.map((r) => r.id)),
        eq(outageReports.flagged, false),
        ne(outageReports.status, 'false_report'),
      ),
    );
  const checks = await loadChecks(db, rows.map((r) => r.id));
  const byIncident = new Map<string, typeof reports>();
  for (const r of reports) {
    if (!r.incidentId) continue;
    const list = byIncident.get(r.incidentId) ?? [];
    list.push(r);
    byIncident.set(r.incidentId, list);
  }

  const out: Incident[] = [];
  const dots: LiveFeed['dots'] = [];
  for (const inc of rows) {
    // Nothing counted yet (only flagged reports): keep it off the public map until reviewed.
    if (inc.reporterCount === 0) continue;
    const list = (byIncident.get(inc.id) ?? []).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    out.push(toView(inc, areaById.get(inc.areaId), list, teamFor.get(inc.id), Boolean(opts.staff), now, checks.get(inc.id)));
    dots.push(...snapDots(inc.id, inc.issueType, list, now));
  }

  return { incidents: out, dots, crews, serverTime: now.toISOString() };
}

type IncidentRow = typeof incidents.$inferSelect;
type AreaRow = typeof areas.$inferSelect;
type CountedReport = { voltage: number | null; note: string | null; createdAt: Date; lat: number; lng: number };
type CheckRow = { lat: number; lng: number; answer: string | null; askedAt: Date | null };

/** Neighbours' "do you have light?" answers (and open asks) for these outages. */
async function loadChecks(db: Db, incidentIds: string[]) {
  const out = new Map<string, CheckRow[]>();
  if (!incidentIds.length) return out;
  const rows = await db
    .select({ incidentId: lightChecks.incidentId, lat: lightChecks.latitude, lng: lightChecks.longitude, answer: lightChecks.answer, askedAt: lightChecks.askedAt })
    .from(lightChecks)
    .where(inArray(lightChecks.incidentId, incidentIds));
  for (const r of rows) out.set(r.incidentId, [...(out.get(r.incidentId) ?? []), r]);
  return out;
}

/**
 * One outage as the map and detail pages show it. `list` is its counted
 * reports, newest first; `checks` are neighbours' answers. Its shape and
 * size come from the blocks people reported from, not the whole area.
 */
function toView(
  inc: IncidentRow,
  area: AreaRow | undefined,
  list: CountedReport[],
  teamId: string | undefined,
  staff: boolean,
  now: Date,
  checks: CheckRow[] = [],
): Incident {
  const latestNote = list.find((r) => r.note?.trim())?.note?.trim();
  const where = describeLocation({ lat: inc.centerLat, lng: inc.centerLng });
  const lit = checks.filter((c) => c.answer === 'on');
  const fp = list.length ? buildFootprint(list, lit) : null;
  return {
    id: inc.id,
    kind: 'incident',
    areaId: area?.slug ?? '',
    area: area?.name ?? where.area.name,
    // Only name the whole area when reports really come from across it.
    place: fp?.scope === 'area' && area ? `Across ${area.name}` : where.summary,
    lat: inc.centerLat,
    lng: inc.centerLng,
    issue: inc.issueType,
    status: inc.status as IncidentStatus,
    reports: inc.reporterCount,
    households: fp
      ? footprintHomes(fp, inc.reporterCount, area?.households ?? null, area?.radiusMeters ?? null)
      : estimateHouseholds(area?.households ?? null, area?.radiusMeters ?? null, inc.radiusM, inc.reporterCount),
    minutesAgo: Math.max(0, Math.round((now.getTime() - inc.startedAt.getTime()) / 60_000)),
    voltage: inc.issueType === 'no_power' ? undefined : medianVoltage(list.map((r) => r.voltage)),
    note: staff && latestNote ? latestNote : describeIncident(inc.issueType, inc.reporterCount),
    radius: inc.radiusM,
    cells: fp ? { off: fp.off, on: inc.status === 'restored' ? [] : fp.on } : undefined,
    scope: fp?.scope,
    lightOn: lit.length,
    asked: staff ? checks.filter((c) => c.askedAt && !c.answer).length : undefined,
    crewId: inc.status === 'restored' ? undefined : teamId,
    etaAt: inc.status === 'restored' ? undefined : inc.etaAt?.toISOString(),
    cause: inc.cause ?? undefined,
    publicNote: inc.publicNote ?? undefined,
    publicNoteAt: inc.publicNoteAt?.toISOString(),
  };
}

/**
 * Everything about one outage for its own page: the map view, a timeline of
 * what happened, reports over time and the team on it. Staff also get every
 * report (with abuse flags) and all teams. Residents can't open outages that
 * have no counted reports yet, same as the map.
 */
export async function getOutageDetail(db: Db, incidentId: string, opts: { staff?: boolean; now?: Date } = {}): Promise<OutageDetail | null> {
  const now = opts.now ?? new Date();
  const staff = Boolean(opts.staff);
  if (!/^[0-9a-f-]{36}$/i.test(incidentId)) return null;
  const [inc] = await db.select().from(incidents).where(eq(incidents.id, incidentId));
  if (!inc || (!staff && inc.reporterCount === 0)) return null;

  const [[area], reportRows, jobRows, crews, checks] = await Promise.all([
    db.select().from(areas).where(eq(areas.id, inc.areaId)),
    db.select().from(outageReports).where(eq(outageReports.incidentId, incidentId)),
    db
      .select({ d: dispatches, team: teams.name, by: users.name })
      .from(dispatches)
      .leftJoin(teams, eq(teams.id, dispatches.teamId))
      .leftJoin(users, eq(users.id, dispatches.assignedById))
      .where(eq(dispatches.incidentId, incidentId)),
    loadCrews(db, { staff }),
    loadChecks(db, [incidentId]),
  ]);
  const counted = reportRows
    .filter((r) => !r.flagged && r.status !== 'false_report')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const open = jobRows.find((j) => j.d.status !== 'completed');
  const view = toView(
    inc,
    area,
    counted.map((r) => ({ voltage: r.voltageReading, note: r.description, createdAt: r.createdAt, lat: r.latitude, lng: r.longitude })),
    open?.d.teamId,
    staff,
    now,
    checks.get(incidentId),
  );

  const timeline: OutageEvent[] = [{ at: inc.startedAt.toISOString(), kind: 'first_report', text: 'First report from a resident' }];
  if (inc.confirmedAt) timeline.push({ at: inc.confirmedAt.toISOString(), kind: 'confirmed', text: 'EEDC confirmed the fault' });
  for (const j of jobRows) {
    timeline.push({ at: j.d.assignedAt.toISOString(), kind: 'team', text: `${j.team ?? 'A team'} assigned`, by: staff ? (j.by ?? undefined) : undefined });
    if (j.d.completedAt) timeline.push({ at: j.d.completedAt.toISOString(), kind: 'team_done', text: `${j.team ?? 'The team'} finished the job` });
  }
  if (inc.publicNoteAt && inc.publicNote) timeline.push({ at: inc.publicNoteAt.toISOString(), kind: 'update', text: inc.publicNote });
  if (inc.restoredAt) {
    timeline.push({
      at: inc.restoredAt.toISOString(),
      kind: 'restored',
      text: inc.restoredBy === 'community' ? 'Neighbours said light is back' : 'EEDC marked light restored',
    });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const end = inc.restoredAt ?? now;
  return {
    incident: view,
    startedAt: inc.startedAt.toISOString(),
    confirmedAt: inc.confirmedAt?.toISOString(),
    restoredAt: inc.restoredAt?.toISOString(),
    restoredBy: inc.restoredBy ?? undefined,
    lightBack: inc.lightBackCount,
    timeline,
    reportsOverTime: bucketReports(counted.map((r) => r.createdAt), inc.startedAt, end),
    dots: snapDots(inc.id, inc.issueType, counted.map((r) => ({ lat: r.latitude, lng: r.longitude, createdAt: r.createdAt })), now),
    crew: view.crewId ? crews.find((c) => c.id === view.crewId) : undefined,
    teams: staff ? crews : undefined,
    reports: staff ? await listReportLog(db, now, 500, incidentId) : undefined,
    serverTime: now.toISOString(),
  };
}

/**
 * Staff move an outage along the repair flow by hand. Confirming stamps
 * confirmed_at; restoring records that EEDC (not the community) closed it,
 * which is what rewards residents who later agree their light is back.
 */
export async function setIncidentStatus(db: Db, incidentId: string, to: IncidentStatus, now = new Date()) {
  const result = await db.transaction(async (tx) => {
    const [inc] = await tx.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!inc) throw new ReportError('not_found', 'That outage no longer exists.');
    const from = inc.status as IncidentStatus;
    if (from === to) return { status: to, changed: false };
    if (!canMoveStatus(from, to)) {
      throw new ReportError('invalid', `An outage that is ${from.replace('_', ' ')} can’t be moved to ${to.replace('_', ' ')}.`, { field: 'status' });
    }

    const patch: Partial<typeof incidents.$inferInsert> = { status: to };
    if ((to === 'confirmed' || to === 'crew_dispatched') && !inc.confirmedAt) patch.confirmedAt = now;
    if (to === 'restored') {
      patch.restoredAt = now;
      patch.restoredBy = 'eedc';
      patch.etaAt = null;
      await completeDispatches(tx, incidentId, now);
    }
    if (from === 'restored') {
      patch.restoredAt = null;
      patch.restoredBy = null;
    }
    await tx.update(incidents).set(patch).where(eq(incidents.id, incidentId));
    return { status: to, changed: true };
  });
  if (result.changed && to !== 'reported') await notifyIncident(db, incidentId, to, now);
  return { status: result.status };
}

export interface IncidentUpdate {
  /** ISO time, or null to clear. */
  etaAt?: string | null;
  cause?: string | null;
  /** A new public update; empty string clears it. */
  publicNote?: string;
}

/**
 * EEDC tells residents what's going on: expected fix time, cause, and a short
 * public update. A new update or fix time alerts everyone affected.
 */
export async function updateIncidentInfo(db: Db, incidentId: string, input: IncidentUpdate, now = new Date()) {
  const bad = (field: string, message: string) => new ReportError('invalid', message, { field });
  const [inc] = await db.select().from(incidents).where(eq(incidents.id, incidentId));
  if (!inc) throw new ReportError('not_found', 'That outage no longer exists.');
  if (inc.status === 'restored') throw bad('status', 'This outage is already restored.');

  const patch: Partial<typeof incidents.$inferInsert> = {};
  if (input.etaAt !== undefined) {
    if (input.etaAt === null) patch.etaAt = null;
    else {
      const eta = new Date(input.etaAt);
      if (Number.isNaN(eta.getTime())) throw bad('etaAt', 'Pick when you expect light back.');
      if (eta.getTime() < now.getTime() - 5 * 60_000) throw bad('etaAt', 'The expected time has already passed.');
      if (eta.getTime() > now.getTime() + MAX_ETA_HOURS * HOUR) throw bad('etaAt', `Keep it within ${MAX_ETA_HOURS} hours.`);
      patch.etaAt = eta;
    }
  }
  if (input.cause !== undefined) {
    if (input.cause !== null && !isCause(input.cause)) throw bad('cause', 'Choose a cause from the list.');
    patch.cause = input.cause;
  }
  if (input.publicNote !== undefined) {
    const note = input.publicNote.trim();
    if (note.length > PUBLIC_NOTE_MAX) throw bad('publicNote', `Keep the update under ${PUBLIC_NOTE_MAX} characters.`);
    patch.publicNote = note || null;
    patch.publicNoteAt = note ? now : null;
  }
  if (!Object.keys(patch).length) return { ok: true };
  await db.update(incidents).set(patch).where(eq(incidents.id, incidentId));

  const etaChanged = patch.etaAt && patch.etaAt.getTime() !== inc.etaAt?.getTime();
  const noteChanged = patch.publicNote && patch.publicNote !== inc.publicNote;
  if (etaChanged || noteChanged) await notifyIncident(db, incidentId, 'update', now);
  return { ok: true };
}