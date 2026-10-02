/**
 * Shared vocabulary for reporting: what the API accepts and returns, and the
 * human wording for abuse flags. Imported by both the server and the screens.
 */

import type { IncidentStatus, IssueType } from '@/data/nsukka';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ReportInput {
  issue: IssueType;
  /** Where the pin is — the house or street the report is about. */
  lat: number;
  lng: number;
  /** Where the phone was when the report was sent, if the browser shared it. */
  device?: LatLng & { accuracy: number };
  /** Area the resident confirmed or picked; the server checks it is plausible. */
  areaSlug?: string;
  /** ISO time the outage started. */
  startedAt: string;
  voltage?: number;
  note?: string;
  landmark?: string;
}

export interface IncidentSummary {
  id: string;
  areaSlug: string;
  areaName: string;
  issue: IssueType;
  status: IncidentStatus;
  reporterCount: number;
  lat: number;
  lng: number;
  radiusM: number;
  startedAt: string;
  /** Metres from the point asked about. */
  distanceM?: number;
}

export interface OpenReport {
  id: string;
  issue: IssueType;
  areaName: string;
  createdAt: string;
  lastConfirmedAt: string;
  incident: IncidentSummary | null;
}

export type SubmitResult =
  | { outcome: 'created'; reportId: string; incident: IncidentSummary; flagged: boolean }
  /** Same person, same outage: we counted it again on the existing report. */
  | { outcome: 'merged'; reportId: string; incident: IncidentSummary | null; repeatCount: number }
  /** Same person reported this outage a few minutes ago — nothing to add yet. */
  | { outcome: 'already_counted'; reportId: string; incident: IncidentSummary | null; nextAllowedAt: string };

export interface AreaSuggestion {
  slug: string;
  name: string;
  feeder: string | null;
  distanceM: number;
}

export interface ReportContext {
  /** Best guess first, then other areas the resident could be in. */
  areas: AreaSuggestion[];
  /** False when GPS error or a near-tie means the screen should ask. */
  confident: boolean;
  /** Open outages near the point, nearest first. */
  nearby: IncidentSummary[];
  /** This person's own open report close to here, if any — offered as "still off?". */
  myOpen: OpenReport | null;
}

export type ReportErrorCode = 'invalid' | 'outside_area' | 'rate_limited' | 'not_found' | 'forbidden';

export interface ApiError {
  error: { code: ReportErrorCode | 'unauthenticated' | 'server_error'; message: string; retryAfterSec?: number; field?: string };
}

/** Plain wording for each abuse flag, shown to EEDC reviewers. */
export const flagLabel: Record<string, string> = {
  device_far_from_pin: 'Phone was far from the pin when sent',
  far_from_saved_places: 'Far from all of this person’s saved places, without GPS',
  impossible_travel: 'Reported from places too far apart to travel between',
  many_areas: 'Reported in 3+ different areas today',
  new_account: 'Account created minutes ago',
  low_trust: 'Reporter has a low trust score',
  area_far_from_pin: 'Chosen area is far from the pin',
  voltage_implausible: 'Voltage reading doesn’t match the problem',
  contradicts_light_back: 'Neighbours just said the light is back here',
};
