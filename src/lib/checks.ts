/**
 * "Do you have light?" — asking neighbours around an outage, so its edge
 * comes from people who know rather than a guess. Rules shared by the server
 * and the app; tested in footprint.test.ts.
 */

import type { Incident } from '@/data/nsukka';
import { isQuietHour } from './alerts';
import { distanceToCells } from './footprint';
import { distanceMeters } from './geo';
import type { AlertPrefs } from './profile-types';

export type CheckAnswer = 'on' | 'off';

/** Start asking once this many people reported the outage. */
export const ASK_AT = 2;
/** Ask people whose saved place is within this distance of a dark block. */
export const ASK_RING_M = 400;
/** Most people asked per round, so one outage doesn't buzz the whole town. */
export const ASK_BATCH = 15;
/** At most one automatic round per outage in this window. */
export const ASK_ROUND_MS = 30 * 60_000;
/** Nobody is asked again (about any outage) within this window. */
export const ASK_REPEAT_MS = 6 * 3_600_000;

/** Is this person willing to be asked at all? */
export function wantsChecks(prefs: AlertPrefs) {
  return prefs.checks !== false;
}

/** Asks are never pushed at night; they wait in the inbox and the app. */
export function pushCheck(prefs: AlertPrefs, now: Date) {
  return prefs.push && wantsChecks(prefs) && !isQuietHour(now);
}

/** A place this close to a dark block is treated as on that block. */
export const SAME_BLOCK_M = 60;

type Point = { lat: number; lng: number };

/**
 * Where a place sits relative to an outage: on its dark blocks, close enough
 * to be asked, or not involved. Outages without blocks (demo data) fall back
 * to their rough radius.
 */
export function placeVsOutage(p: Point, i: Pick<Incident, 'lat' | 'lng' | 'radius' | 'cells'>): 'inside' | 'near' | null {
  const d = i.cells?.off.length ? distanceToCells(p, i.cells.off) : Math.max(0, distanceMeters(p, i) - i.radius);
  if (d <= SAME_BLOCK_M) return 'inside';
  if (d <= ASK_RING_M) return 'near';
  return null;
}

export function checkCopy(place: string) {
  return {
    title: `Do you have light near ${place}?`,
    body: 'Some neighbours reported no light. One tap helps EEDC see how far the outage goes.',
  };
}
