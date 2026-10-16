/**
 * The live map's read model: what the API sends for each outage, and the pure
 * rules that turn database rows into it. Shared by the server and the screens,
 * and unit-tested without a database (incidents.test.ts).
 */

import type { Crew, Incident, IncidentStatus, IssueType, ReportDot } from '@/data/nsukka';

export interface LiveFeed {
  incidents: Incident[];
  /** One dot per counted report, snapped to a ~30 m grid so no house is pinpointed. */
  dots: ReportDot[];
  /** Teams: all of them for staff, only those out on a job for residents. */
  crews: Crew[];
  /** Server clock, so the client can tell how fresh the feed is. */
  serverTime: string;
}

/** Restored outages stay on the map this long, so people see the fix. */
export const SHOW_RESTORED_HOURS = 6;
/** Most dots drawn per outage; the count on the pin still says how many. */
export const MAX_DOTS_PER_INCIDENT = 60;
/** Grid for public report dots: 0.0003° ≈ 33 m in Nsukka. */
export const DOT_GRID_DEG = 0.0003;

/**
 * Homes affected, estimated from how much of the area the outage covers.
 * Never fewer than the people who reported it, never more than the area has.
 */
export function estimateHouseholds(areaHouseholds: number | null, areaRadiusM: number | null, incidentRadiusM: number, reporters: number) {
  if (!areaHouseholds || !areaRadiusM) return reporters;
  const share = Math.min(1, (incidentRadiusM * incidentRadiusM) / (areaRadiusM * areaRadiusM));
  return Math.max(reporters, Math.round(areaHouseholds * share));
}

/** Median of the readings people gave, ignoring blanks. Undefined when nobody gave one. */
export function medianVoltage(readings: Array<number | null | undefined>) {
  const v = readings.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return undefined;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

/** Snap a point to the public grid and drop duplicates, so dots show a street, not a door. */
export function snapDots(
  incidentId: string,
  issue: IssueType,
  points: Array<{ lat: number; lng: number; createdAt: Date }>,
  now: Date,
): ReportDot[] {
  const seen = new Set<string>();
  const out: ReportDot[] = [];
  for (const p of points) {
    const lat = Math.round(p.lat / DOT_GRID_DEG) * DOT_GRID_DEG;
    const lng = Math.round(p.lng / DOT_GRID_DEG) * DOT_GRID_DEG;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${incidentId}-${out.length}`,
      incidentId,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      issue,
      minutesAgo: Math.max(0, Math.round((now.getTime() - p.createdAt.getTime()) / 60_000)),
    });
    if (out.length >= MAX_DOTS_PER_INCIDENT) break;
  }
  return out;
}

/**
 * Which status changes EEDC staff may make by hand. Residents restore and
 * reopen outages through "is your light back?"; staff can do it directly.
 */
const ALLOWED: Record<IncidentStatus, IncidentStatus[]> = {
  reported: ['confirmed', 'crew_dispatched', 'restored'],
  confirmed: ['crew_dispatched', 'restored', 'reported'],
  crew_dispatched: ['restored', 'confirmed'],
  // Reopen: the light went off again after being marked restored.
  restored: ['confirmed'],
};

export function canMoveStatus(from: IncidentStatus, to: IncidentStatus) {
  return ALLOWED[from].includes(to);
}

/** Plain sentence for the outage pin's detail when we have nothing better to show. */
export function describeIncident(issue: IssueType, reporters: number) {
  const who = reporters === 1 ? 'One resident' : `${reporters} residents`;
  const what = issue === 'no_power' ? 'no light' : issue === 'low_voltage' ? 'low voltage' : 'light going off and on';
  return `${who} reported ${what} here.`;
}
