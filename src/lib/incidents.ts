/**
 * The live map's read model: what the API sends for each outage, and the pure
 * rules that turn database rows into it. Shared by the server and the screens,
 * and unit-tested without a database (incidents.test.ts).
 */

import type { Crew, Incident, IncidentStatus, IssueType, ReportDot } from '@/data/nsukka';
import type { ReportRow } from '@/data/operations';

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

/** Causes EEDC can give residents. Plain words, no engineering jargon. */
export const CAUSES = {
  checking: 'Still finding the cause',
  transformer: 'Transformer fault',
  line: 'Fallen or broken line',
  feeder: 'Feeder tripped at the substation',
  load_shedding: 'Not enough supply (load shedding)',
  maintenance: 'Planned maintenance',
  weather: 'Storm or rain damage',
  vandalism: 'Vandalism or theft',
} as const;
export type Cause = keyof typeof CAUSES;
export const isCause = (x: unknown): x is Cause => typeof x === 'string' && x in CAUSES;

/** Longest a public update can be. */
export const PUBLIC_NOTE_MAX = 280;
/** Expected-fix times further out than this are almost certainly typos. */
export const MAX_ETA_HOURS = 72;

/** "by 6:30 PM" today, "by Sat 9:00 AM" otherwise, in Nsukka time. */
export function formatEta(etaIso: string, now = new Date()) {
  const eta = new Date(etaIso);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' };
  const day = (d: Date) => d.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' });
  const time = eta.toLocaleTimeString('en-NG', opts);
  if (day(eta) === day(now)) return `by ${time}`;
  return `by ${eta.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'Africa/Lagos' })} ${time}`;
}

/** What residents see for their own reports. */
export interface MyReport {
  id: string;
  /** Short reference, e.g. VQ-3F2A9C. */
  ref: string;
  issue: IssueType;
  place: string;
  createdAt: string;
  note?: string;
  incidentId: string | null;
  /** The outage's progress, or what happened to the report itself. */
  status: IncidentStatus | 'withdrawn' | 'not_accepted';
  lightBack: boolean;
  /** Only open reports can be taken back. */
  canWithdraw: boolean;
}

export interface OutageEvent {
  at: string;
  kind: 'first_report' | 'confirmed' | 'team' | 'team_done' | 'update' | 'restored';
  text: string;
  /** Staff only: who did it. */
  by?: string;
}

/** One outage's own page (/outages/[id], /operator/outages/[id]). */
export interface OutageDetail {
  incident: Incident;
  startedAt: string;
  confirmedAt?: string;
  restoredAt?: string;
  restoredBy?: string;
  /** Residents who said their light is back. */
  lightBack: number;
  timeline: OutageEvent[];
  reportsOverTime: ReportBuckets;
  dots: ReportDot[];
  crew?: Crew;
  /** Staff only. */
  teams?: Crew[];
  reports?: ReportRow[];
  serverTime: string;
}

export interface ReportBuckets {
  /** Reports per bucket, oldest first. */
  counts: number[];
  /** Bucket length in minutes. */
  minutes: number;
}

/** Most bars in the "reports over time" chart. */
export const MAX_BUCKETS = 24;

/**
 * Reports per time bucket from `start` to `end`: 15-minute bars for short
 * outages, growing so the chart never has more than MAX_BUCKETS bars.
 */
export function bucketReports(times: Date[], start: Date, end: Date): ReportBuckets {
  const span = Math.max(1, (end.getTime() - start.getTime()) / 60_000);
  const steps = [15, 30, 60, 120, 240, 480, 1440];
  const minutes = steps.find((m) => span / m <= MAX_BUCKETS) ?? Math.ceil(span / MAX_BUCKETS);
  const counts = new Array<number>(Math.max(1, Math.ceil(span / minutes))).fill(0);
  for (const t of times) {
    const i = Math.floor((t.getTime() - start.getTime()) / 60_000 / minutes);
    counts[Math.min(counts.length - 1, Math.max(0, i))]++;
  }
  return { counts, minutes };
}