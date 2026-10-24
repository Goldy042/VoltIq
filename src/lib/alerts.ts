/**
 * Alert rules shared by the server and the resident app: who gets told what,
 * in which words, and when a phone should stay quiet.
 */

import { formatEta } from './incidents';
import { defaultAlerts, type AlertPrefs } from './profile-types';

/** Outage news residents can be told about. Forecasts arrive in Phase 4. */
export type AlertEvent = 'confirmed' | 'crew_dispatched' | 'restored' | 'update';

/** `check` is "do you have light?" (see ./checks). */
export type AlertKind = 'prediction' | 'update' | 'restored' | 'check';

/** One entry in the alerts inbox. */
export interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** ISO time it was sent. */
  sentAt: string;
  unread: boolean;
  /** Outage it's about, for linking to the map. */
  incidentId: string | null;
}

/** Residents of the outage zone plus this margin hear about it. */
export const ALERT_MARGIN_M = 150;

/** The same outage news isn't repeated to someone within this window (e.g. a team reassigned). */
export const ALERT_REPEAT_MS = 6 * 3_600_000;
/** EEDC updates (new fix time, new note) can come more often, but not in bursts. */
export const UPDATE_REPEAT_MS = 10 * 60_000;

const LAGOS_OFFSET_H = 1;

/** Quiet hours are 10 PM–6 AM in Nsukka (WAT, no daylight saving). */
export function isQuietHour(now: Date) {
  const h = (now.getUTCHours() + LAGOS_OFFSET_H) % 24;
  return h >= 22 || h < 6;
}

export function prefsOf(raw: Record<string, boolean> | null | undefined): AlertPrefs {
  return { ...defaultAlerts, ...(raw ?? {}) };
}

/** Does this person want news of this kind at all (inbox and push)? */
export function wantsEvent(prefs: AlertPrefs, event: AlertEvent) {
  return event === 'restored' ? prefs.restored : prefs.repairs;
}

/** Should the phone buzz now? Light coming back is always worth a buzz. */
export function shouldPush(prefs: AlertPrefs, event: AlertEvent, now: Date) {
  if (!prefs.push || !wantsEvent(prefs, event)) return false;
  return event === 'restored' || !prefs.quietHours || !isQuietHour(now);
}

export function alertCopy(
  event: AlertEvent,
  place: string,
  extra: { restoredBy?: string | null; etaAt?: Date | null; note?: string | null } = {},
): { title: string; body: string } {
  const eta = extra.etaAt ? `EEDC expects light back ${formatEta(extra.etaAt.toISOString())}.` : '';
  switch (event) {
    case 'update':
      return {
        title: `Update from EEDC near ${place}`,
        body: [extra.note, eta].filter(Boolean).join(' ') || 'EEDC posted an update on this outage.',
      };
    case 'confirmed':
      return {
        title: `EEDC confirmed the fault near ${place}`,
        body: 'They’ve seen the reports and are planning the repair. We’ll tell you when a team is assigned.',
      };
    case 'crew_dispatched':
      return {
        title: `A repair team is assigned near ${place}`,
        body: eta ? `EEDC has sent a team to the fault. ${eta}` : 'EEDC has sent a team to the fault. We’ll tell you when light is back.',
      };
    case 'restored':
      return extra.restoredBy === 'community'
        ? {
            title: `Neighbours say light is back near ${place}`,
            body: 'Still off at your place? Open the map and tell us — it reopens the outage.',
          }
        : {
            title: `Light is back near ${place}`,
            body: 'EEDC marked supply restored. Still off at your place? Open the map and tell us.',
          };
  }
}

export function kindOf(type: string): AlertKind {
  if (type === 'resolved') return 'restored';
  if (type === 'predicted_outage') return 'prediction';
  if (type === 'light_check') return 'check';
  return 'update';
}
