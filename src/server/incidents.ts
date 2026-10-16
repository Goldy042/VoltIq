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
import { areas, incidents, outageReports } from '@/lib/db/schema';
import type { Incident, IncidentStatus } from '@/data/nsukka';
import { describeLocation } from '@/lib/address';
import {
  SHOW_RESTORED_HOURS,
  canMoveStatus,
  describeIncident,
  estimateHouseholds,
  medianVoltage,
  snapDots,
  type LiveFeed,
} from '@/lib/incidents';
import { ReportError } from './reports';

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

  if (!rows.length) return { incidents: [], dots: [], serverTime: now.toISOString() };

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
    const area = areaById.get(inc.areaId);
    const list = (byIncident.get(inc.id) ?? []).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latestNote = list.find((r) => r.note?.trim())?.note?.trim();
    const where = describeLocation({ lat: inc.centerLat, lng: inc.centerLng });

    out.push({
      id: inc.id,
      kind: 'incident',
      areaId: area?.slug ?? '',
      area: area?.name ?? where.area.name,
      place: where.summary,
      lat: inc.centerLat,
      lng: inc.centerLng,
      issue: inc.issueType,
      status: inc.status as IncidentStatus,
      reports: inc.reporterCount,
      households: estimateHouseholds(area?.households ?? null, area?.radiusMeters ?? null, inc.radiusM, inc.reporterCount),
      minutesAgo: Math.max(0, Math.round((now.getTime() - inc.startedAt.getTime()) / 60_000)),
      voltage: inc.issueType === 'no_power' ? undefined : medianVoltage(list.map((r) => r.voltage)),
      note: opts.staff && latestNote ? latestNote : describeIncident(inc.issueType, inc.reporterCount),
      radius: inc.radiusM,
    });
    dots.push(...snapDots(inc.id, inc.issueType, list, now));
  }

  return { incidents: out, dots, serverTime: now.toISOString() };
}

/**
 * Staff move an outage along the repair flow by hand. Confirming stamps
 * confirmed_at; restoring records that EEDC (not the community) closed it,
 * which is what rewards residents who later agree their light is back.
 */
export async function setIncidentStatus(db: Db, incidentId: string, to: IncidentStatus, now = new Date()) {
  return db.transaction(async (tx) => {
    const [inc] = await tx.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!inc) throw new ReportError('not_found', 'That outage no longer exists.');
    const from = inc.status as IncidentStatus;
    if (from === to) return { status: to };
    if (!canMoveStatus(from, to)) {
      throw new ReportError('invalid', `An outage that is ${from.replace('_', ' ')} can’t be moved to ${to.replace('_', ' ')}.`, { field: 'status' });
    }

    const patch: Partial<typeof incidents.$inferInsert> = { status: to };
    if ((to === 'confirmed' || to === 'crew_dispatched') && !inc.confirmedAt) patch.confirmedAt = now;
    if (to === 'restored') {
      patch.restoredAt = now;
      patch.restoredBy = 'eedc';
    }
    if (from === 'restored') {
      patch.restoredAt = null;
      patch.restoredBy = null;
    }
    await tx.update(incidents).set(patch).where(eq(incidents.id, incidentId));
    return { status: to };
  });
}
