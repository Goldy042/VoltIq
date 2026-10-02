/**
 * Abuse protection rules, kept free of the database so they are easy to test
 * and tune. src/server/reports.ts feeds them what it loads.
 *
 * Nothing here punishes anyone automatically: suspicious reports are kept but
 * carry no weight until EEDC reviews them, and trust only drops when staff
 * mark a report false.
 */

import { distanceMeters } from '@/lib/geo';
import type { IssueType } from '@/data/nsukka';
import type { LatLng } from '@/lib/reporting';

/* ------------------------------------------------------------------ */
/* Rate limits                                                         */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  /** New reports (merges into an existing report don't count). */
  perHour: 3,
  perDay: 8,
  /** Below LOW_TRUST, one new report an hour. */
  lowTrustPerHour: 1,
  /** Shared Wi‑Fi (a hostel, a café) can carry many honest residents. */
  ipPerHour: 20,
  /** A new report within this distance and time of your open one is the same outage. */
  mergeRadiusM: 600,
  mergeWindowHours: 12,
  /** "Still off" more often than this adds nothing. */
  reconfirmCooldownMin: 10,
} as const;

export const LOW_TRUST = 25;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface RateWindow {
  /** createdAt of this person's new reports in the last 24 hours. */
  userReports: Date[];
  /** createdAt of reports from the same IP hash in the last hour. */
  ipReports: Date[];
  trust: number;
  now: Date;
}

export type RateDecision = { ok: true } | { ok: false; retryAfterSec: number; message: string };

/** Sliding-window limits: the answer says exactly when the next report is allowed. */
export function checkRateLimit({ userReports, ipReports, trust, now }: RateWindow): RateDecision {
  const t = now.getTime();
  const inHour = userReports.filter((d) => t - d.getTime() < HOUR).sort((a, b) => a.getTime() - b.getTime());
  const inDay = userReports.filter((d) => t - d.getTime() < DAY).sort((a, b) => a.getTime() - b.getTime());
  const ipHour = ipReports.filter((d) => t - d.getTime() < HOUR).sort((a, b) => a.getTime() - b.getTime());

  const wait = (oldest: Date, windowMs: number) => Math.max(1, Math.ceil((oldest.getTime() + windowMs - t) / 1000));
  const hourly = trust < LOW_TRUST ? LIMITS.lowTrustPerHour : LIMITS.perHour;

  if (inDay.length >= LIMITS.perDay) {
    return { ok: false, retryAfterSec: wait(inDay[inDay.length - LIMITS.perDay], DAY), message: `You’ve sent ${LIMITS.perDay} reports today, the daily limit.` };
  }
  if (inHour.length >= hourly) {
    return {
      ok: false,
      retryAfterSec: wait(inHour[inHour.length - hourly], HOUR),
      message: hourly === 1 ? 'You can send one new report an hour for now.' : `You can send ${hourly} new reports an hour.`,
    };
  }
  if (ipHour.length >= LIMITS.ipPerHour) {
    return { ok: false, retryAfterSec: wait(ipHour[ipHour.length - LIMITS.ipPerHour], HOUR), message: 'Too many reports from this network. Try again shortly.' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Suspicion                                                           */
/* ------------------------------------------------------------------ */

/** At or above this score a report is flagged for EEDC review. */
export const FLAG_THRESHOLD = 40;

export interface SuspicionInput {
  /** The pin. */
  point: LatLng;
  device?: LatLng & { accuracy: number };
  savedPlaces: LatLng[];
  accountAgeMinutes: number;
  trust: number;
  /** This person's reports in the last 24 hours (excluding the new one). */
  recent: Array<LatLng & { createdAt: Date; areaSlug: string | null }>;
  areaSlug: string;
  /** Distance from the pin to the chosen area's centre, and that area's size. */
  chosenArea: { distanceM: number; radiusM: number };
  issue: IssueType;
  voltage?: number;
  /** Neighbours on the same outage who said "light is back" in the last 30 minutes. */
  recentLightBack: number;
  now: Date;
}

export interface Suspicion {
  flags: string[];
  score: number;
  flagged: boolean;
}

/** Score how unlikely a report is to be genuine. Each signal alone is weak; together they add up. */
export function assessSuspicion(i: SuspicionInput): Suspicion {
  const hits: Array<[string, number]> = [];
  const goodGps = i.device && i.device.accuracy <= 500;

  // The phone was somewhere else entirely. Reporting for a relative is legitimate,
  // so this alone stays under the threshold.
  if (goodGps && distanceMeters(i.device!, i.point) > 3000) hits.push(['device_far_from_pin', 30]);

  // No usable GPS and nowhere near any place they saved.
  if (!goodGps && i.savedPlaces.length && i.savedPlaces.every((p) => distanceMeters(p, i.point) > 2500)) {
    hits.push(['far_from_saved_places', 20]);
  }

  // Faster than a car could get between two reports.
  const travel = i.recent.some((r) => {
    const hours = Math.max((i.now.getTime() - r.createdAt.getTime()) / HOUR, 1 / 60);
    return distanceMeters(r, i.point) > 2000 && distanceMeters(r, i.point) / 1000 / hours > 60;
  });
  if (travel) hits.push(['impossible_travel', 35]);

  const areasToday = new Set([...i.recent.map((r) => r.areaSlug).filter(Boolean), i.areaSlug]);
  if (areasToday.size >= 3) hits.push(['many_areas', 25]);

  if (i.accountAgeMinutes < 10) hits.push(['new_account', 10]);
  if (i.trust < LOW_TRUST) hits.push(['low_trust', 20]);

  if (i.chosenArea.distanceM > i.chosenArea.radiusM + 1500) hits.push(['area_far_from_pin', 20]);

  if (i.voltage !== undefined) {
    // Low voltage at a normal reading, or a reading no household meter shows.
    if ((i.issue === 'low_voltage' && i.voltage >= 210) || i.voltage > 280) hits.push(['voltage_implausible', 15]);
  }

  if (i.recentLightBack >= 3) hits.push(['contradicts_light_back', 15]);

  const score = hits.reduce((s, [, n]) => s + n, 0);
  return { flags: hits.map(([f]) => f), score, flagged: score >= FLAG_THRESHOLD };
}

/* ------------------------------------------------------------------ */
/* Trust                                                               */
/* ------------------------------------------------------------------ */

export const TRUST = {
  start: 50,
  /** Enough neighbours reported the same outage. */
  corroborated: 1,
  /** EEDC accepted the report. */
  accepted: 3,
  /** EEDC said the light was back and the resident agreed. */
  lightBackAgreed: 1,
  /** EEDC marked the report false. */
  falseReport: -15,
} as const;

/** Distinct reporters on an outage before each of them earns `corroborated`. */
export const CORROBORATE_AT = 5;

export const clampTrust = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** How much one report moves an outage: 0.5 at trust 0, 1.5 at trust 100, nothing while flagged. */
export const reportWeight = (trust: number, flagged: boolean) => (flagged ? 0 : 0.5 + clampTrust(trust) / 100);
