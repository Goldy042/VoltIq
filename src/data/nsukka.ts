import { distanceMeters, offsetMeters, seeded } from '@/lib/geo';

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** What the citizen is experiencing. Mirrors issue_type in the DB schema. */
export type IssueType = 'no_power' | 'low_voltage' | 'fluctuating';

/** Where the fault is in its lifecycle. Mirrors report_status. */
export type IncidentStatus = 'reported' | 'confirmed' | 'crew_dispatched' | 'restored';

export type CrewStatus = 'available' | 'en_route' | 'on_site';

export const issueMeta: Record<
  IssueType,
  { label: string; short: string; description: string; color: string }
> = {
  no_power: {
    label: 'No light',
    short: 'No light',
    description: 'Power is completely off',
    color: 'var(--status-out)',
  },
  low_voltage: {
    label: 'Low voltage',
    short: 'Low',
    description: 'Light is on but too weak — dim bulbs, slow fans',
    color: 'var(--status-low)',
  },
  fluctuating: {
    label: 'Unstable',
    short: 'Unstable',
    description: 'Light keeps going off and coming back',
    color: 'var(--status-low)',
  },
};

export const statusMeta: Record<IncidentStatus, { label: string; color: string; step: number }> = {
  reported: { label: 'Reported', color: 'var(--ink-muted)', step: 0 },
  confirmed: { label: 'Confirmed by EEDC', color: 'var(--ink)', step: 1 },
  crew_dispatched: { label: 'Crew on the way', color: 'var(--status-crew)', step: 2 },
  restored: { label: 'Light restored', color: 'var(--status-restored)', step: 3 },
};

/** Pin colour: restored and dispatched override the issue colour. */
export function incidentColor(i: Pick<Incident, 'issue' | 'status'>) {
  if (i.status === 'restored') return 'var(--status-restored)';
  return issueMeta[i.issue].color;
}

/* ------------------------------------------------------------------ */
/* Network: areas, feeders, substations                                */
/* ------------------------------------------------------------------ */

export const NSUKKA_CENTER = { lat: 6.8585, lng: 7.4035 };
/** Keep panning to Nsukka and its immediate villages. */
/** [west, south, east, north] */
export const NSUKKA_BOUNDS: [number, number, number, number] = [7.33, 6.79, 7.49, 6.93];

export interface Area {
  id: string;
  name: string;
  lat: number;
  lng: number;
  feeder: string;
  /** NERC service band — hours of supply the tariff promises. */
  band: 'A' | 'B' | 'C' | 'D';
  households: number;
  /**
   * Rough extent in metres. A gate or junction is small; a campus or village
   * is large, so a point between them leans toward the larger one.
   */
  radius: number;
  /**
   * True where the centroid is placed by hand rather than taken from
   * OpenStreetMap. Replace with EEDC feeder polygons when available.
   */
  approx: boolean;
}

export const areas: Area[] = [
  { id: 'unn', name: 'UNN Main Campus', lat: 6.8641, lng: 7.4097, feeder: 'UNN Campus 11kV', band: 'A', households: 2400, radius: 1100, approx: false },
  { id: 'hilltop', name: 'Hilltop', lat: 6.8688, lng: 7.4158, feeder: 'UNN Campus 11kV', band: 'A', households: 920, radius: 450, approx: true },
  { id: 'odim', name: 'Odim Gate', lat: 6.8716, lng: 7.4142, feeder: 'UNN Campus 11kV', band: 'B', households: 1100, radius: 250, approx: false },
  { id: 'odenigwe', name: 'Odenigwe', lat: 6.8577, lng: 7.4028, feeder: 'Odenigwe 11kV', band: 'B', households: 1850, radius: 400, approx: true },
  { id: 'beach', name: 'Beach Junction', lat: 6.8553, lng: 7.4052, feeder: 'Odenigwe 11kV', band: 'B', households: 640, radius: 250, approx: true },
  { id: 'onuiyi', name: 'Onuiyi', lat: 6.8508, lng: 7.4128, feeder: 'Onuiyi 11kV', band: 'C', households: 1400, radius: 600, approx: true },
  { id: 'ogige', name: 'Ogige Market', lat: 6.851, lng: 7.3994, feeder: 'Ogige 11kV', band: 'B', households: 760, radius: 350, approx: false },
  { id: 'town', name: 'Nsukka Town', lat: 6.8561, lng: 7.3927, feeder: 'Town 11kV', band: 'B', households: 2100, radius: 800, approx: false },
  { id: 'nru', name: 'Nru', lat: 6.864, lng: 7.385, feeder: 'Nru–Owerre 11kV', band: 'C', households: 1650, radius: 700, approx: true },
  { id: 'ihe', name: 'Ihe', lat: 6.848, lng: 7.3835, feeder: 'Ihe 11kV', band: 'C', households: 1300, radius: 700, approx: true },
  { id: 'edem', name: 'Edem', lat: 6.836, lng: 7.376, feeder: 'Ihe 11kV', band: 'D', households: 900, radius: 700, approx: true },
  { id: 'enugurd', name: 'Enugu Road', lat: 6.8314, lng: 7.4066, feeder: 'Enugu Road 11kV', band: 'C', households: 980, radius: 900, approx: false },
  { id: 'obukpa', name: 'Obukpa', lat: 6.9, lng: 7.415, feeder: 'Obukpa 11kV', band: 'D', households: 1500, radius: 1200, approx: true },
  { id: 'alor', name: 'Alor-Uno', lat: 6.883, lng: 7.433, feeder: 'Obukpa 11kV', band: 'D', households: 870, radius: 900, approx: true },
  { id: 'orba', name: 'Orba', lat: 6.8568, lng: 7.4588, feeder: 'Orba 11kV', band: 'D', households: 1100, radius: 1200, approx: false },
];

export const areaById = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<string, Area>;

/**
 * How far a point is from an area, scaled by the area's size. Plain
 * centroid distance hands the edge of a big area (Hilltop) to a small
 * neighbour whose centre happens to be closer (Odim Gate).
 */
export function areaScore(a: Area, p: { lat: number; lng: number }, meters = distanceMeters(a, p)) {
  return meters / Math.sqrt(a.radius);
}

/** Best-matching area for a point — stands in for a feeder-polygon lookup. */
export function nearestArea(p: { lat: number; lng: number }) {
  return areas.reduce((best, a) => (areaScore(a, p) < areaScore(best, p) ? a : best));
}

export interface Substation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating: string;
  feeders: string[];
}

/** Both positions come from power=substation features in OpenStreetMap. */
export const substations: Substation[] = [
  {
    id: 'ss-enugu-rd',
    name: 'Injection substation · Enugu Rd',
    lat: 6.8463,
    lng: 7.4010,
    rating: '33/11 kV · 2 × 7.5 MVA',
    feeders: ['Town 11kV', 'Ogige 11kV', 'Odenigwe 11kV', 'Ihe 11kV', 'Nru–Owerre 11kV', 'Enugu Road 11kV'],
  },
  {
    id: 'ss-orba-rd',
    name: 'Injection substation · Orba Rd',
    lat: 6.8503,
    lng: 7.4295,
    rating: '33/11 kV · 15 MVA',
    feeders: ['UNN Campus 11kV', 'Onuiyi 11kV', 'Obukpa 11kV', 'Orba 11kV'],
  },
];

/* ------------------------------------------------------------------ */
/* Crews (EEDC Nsukka district)                                        */
/* ------------------------------------------------------------------ */

export interface Crew {
  id: string;
  name: string;
  /** The lead's name comes from the operations roster (useOperations().leadName). */
  status: CrewStatus;
  lat: number;
  lng: number;
  /** Incident the crew is working, if any. */
  incidentId?: string;
  etaMinutes?: number;
}

export const crewStatusLabel: Record<CrewStatus, string> = {
  available: 'Available',
  en_route: 'En route',
  on_site: 'On site',
};

export const crews: Crew[] = [
  { id: 'c-alpha', name: 'Crew Alpha', status: 'available', lat: 6.8471, lng: 7.4021 },
  { id: 'c-bravo', name: 'Crew Bravo', status: 'en_route', lat: 6.8528, lng: 7.4031, incidentId: 'inc-odenigwe', etaMinutes: 6 },
  { id: 'c-charlie', name: 'Crew Charlie', status: 'on_site', lat: 6.8684, lng: 7.4151, incidentId: 'inc-hilltop' },
  { id: 'c-delta', name: 'Crew Delta', status: 'available', lat: 6.8556, lng: 7.3936 },
];

/* ------------------------------------------------------------------ */
/* Live incidents (citizen reports merged per street/area)             */
/* ------------------------------------------------------------------ */

export interface Incident {
  id: string;
  kind: 'incident';
  areaId: string;
  area: string;
  place: string;
  lat: number;
  lng: number;
  issue: IssueType;
  status: IncidentStatus;
  reports: number;
  households: number;
  /** Minutes since the first report. */
  minutesAgo: number;
  /** Median voltage residents reported from stabiliser/meter displays. */
  voltage?: number;
  note: string;
  crewId?: string;
  /** Radius of the affected area in metres. */
  radius: number;
}

export const incidents: Incident[] = [
  {
    id: 'inc-odenigwe', kind: 'incident', areaId: 'odenigwe', area: 'Odenigwe', place: 'Odenigwe, by the UNN main gate',
    lat: 6.8579, lng: 7.4031, issue: 'no_power', status: 'crew_dispatched', reports: 47, households: 610, minutesAgo: 52,
    note: 'Residents heard a loud bang from the transformer before the whole area went dark.', crewId: 'c-bravo', radius: 260,
  },
  {
    id: 'inc-hilltop', kind: 'incident', areaId: 'hilltop', area: 'Hilltop', place: 'Hilltop hostels',
    lat: 6.8686, lng: 7.4155, issue: 'no_power', status: 'crew_dispatched', reports: 26, households: 340, minutesAgo: 96,
    note: 'Fuse blown on the hostel transformer. Crew is replacing it now.', crewId: 'c-charlie', radius: 200,
  },
  {
    id: 'inc-onuiyi', kind: 'incident', areaId: 'onuiyi', area: 'Onuiyi', place: 'Onuiyi, upper road',
    lat: 6.851, lng: 7.4126, issue: 'low_voltage', status: 'confirmed', reports: 31, households: 520, minutesAgo: 140, voltage: 142,
    note: 'Bulbs are dim, fans barely turn, fridges will not start. Stabilisers reading about 140 V against 230 V expected.', radius: 300,
  },
  {
    id: 'inc-ogige', kind: 'incident', areaId: 'ogige', area: 'Ogige Market', place: 'Ogige Market, Enugu Road side',
    lat: 6.8512, lng: 7.3998, issue: 'fluctuating', status: 'reported', reports: 22, households: 310, minutesAgo: 34,
    note: 'Light going off and coming back every few minutes. Traders have switched to generators.', radius: 220,
  },
  {
    id: 'inc-beach', kind: 'incident', areaId: 'beach', area: 'Beach Junction', place: 'Beach Junction shops',
    lat: 6.8552, lng: 7.4055, issue: 'no_power', status: 'reported', reports: 14, households: 180, minutesAgo: 18,
    note: 'Shops around the junction say there has been no light since the evening.', radius: 160,
  },
  {
    id: 'inc-odim', kind: 'incident', areaId: 'odim', area: 'Odim Gate', place: 'Odim Street',
    lat: 6.8714, lng: 7.4139, issue: 'fluctuating', status: 'reported', reports: 11, households: 260, minutesAgo: 22,
    note: 'Light dropping out for a few seconds at a time. Same feeder as the Hilltop fault.', radius: 180,
  },
  {
    id: 'inc-nru', kind: 'incident', areaId: 'nru', area: 'Nru', place: 'Nru, near the village square',
    lat: 6.8642, lng: 7.3853, issue: 'low_voltage', status: 'reported', reports: 9, households: 230, minutesAgo: 47, voltage: 165,
    note: 'Low current since afternoon. Pumping machines cannot run.', radius: 200,
  },
  {
    id: 'inc-enugurd', kind: 'incident', areaId: 'enugurd', area: 'Enugu Road', place: 'Enugu Road, Opi side',
    lat: 6.8318, lng: 7.4063, issue: 'no_power', status: 'reported', reports: 6, households: 120, minutesAgo: 11,
    note: 'Six homes reported no light in the last few minutes.', radius: 150,
  },
  {
    id: 'inc-obukpa', kind: 'incident', areaId: 'obukpa', area: 'Obukpa', place: 'Obukpa road',
    lat: 6.8996, lng: 7.4146, issue: 'low_voltage', status: 'reported', reports: 5, households: 190, minutesAgo: 75, voltage: 158,
    note: 'Weak light along the road since morning.', radius: 220,
  },
  {
    id: 'inc-town', kind: 'incident', areaId: 'town', area: 'Nsukka Town', place: 'Post Office Road',
    lat: 6.8563, lng: 7.3931, issue: 'no_power', status: 'restored', reports: 38, households: 640, minutesAgo: 260,
    note: 'Fuse replaced on the Town feeder. Light has been back for 1 hr 20 min.', radius: 240,
  },
];

/* ------------------------------------------------------------------ */
/* Individual reports — the dots that show "it's not just me"          */
/* ------------------------------------------------------------------ */

export interface ReportDot {
  id: string;
  incidentId: string;
  lat: number;
  lng: number;
  issue: IssueType;
  minutesAgo: number;
}

/** Scatter a deterministic dot per report (capped) inside the affected radius. */
export function reportDotsFor(incident: Incident, count = incident.reports): ReportDot[] {
  const rand = seeded(incident.id);
  const n = Math.min(count, 60);
  return Array.from({ length: n }, (_, i) => {
    const r = Math.sqrt(rand()) * incident.radius * 0.9;
    const t = rand() * Math.PI * 2;
    const p = offsetMeters(incident.lat, incident.lng, Math.sin(t) * r, Math.cos(t) * r);
    return {
      id: `${incident.id}-d${i}`,
      incidentId: incident.id,
      lat: p.lat,
      lng: p.lng,
      issue: incident.issue,
      minutesAgo: Math.round(rand() * incident.minutesAgo),
    };
  });
}

/* ------------------------------------------------------------------ */
/* AI predictions                                                      */
/* ------------------------------------------------------------------ */

export interface Prediction {
  id: string;
  kind: 'prediction';
  areaId: string;
  area: string;
  lat: number;
  lng: number;
  radius: number;
  issue: IssueType;
  /** 0–100 */
  confidence: number;
  window: string;
  startsInHours: number;
  households: number;
  reasons: string[];
}

export const predictions: Prediction[] = [
  {
    id: 'pred-odim', kind: 'prediction', areaId: 'odim', area: 'Odim Gate & Hilltop', lat: 6.8703, lng: 7.4152, radius: 620,
    issue: 'no_power', confidence: 78, window: 'Tonight, 7 – 10 PM', startsInHours: 3, households: 2020,
    reasons: [
      'Evening load on UNN Campus 11kV has passed 95% of capacity three nights running',
      'The same pattern came before the outage on 14 September',
      'Rain is forecast from 6 PM',
    ],
  },
  {
    id: 'pred-alor', kind: 'prediction', areaId: 'alor', area: 'Alor-Uno & Obukpa', lat: 6.8905, lng: 7.4245, radius: 900,
    issue: 'low_voltage', confidence: 61, window: 'Tomorrow, 6 – 11 AM', startsInHours: 14, households: 2370,
    reasons: [
      'Low-voltage reports on Obukpa road have doubled this week',
      'Morning pumping load peaks on this line',
    ],
  },
  {
    id: 'pred-ihe', kind: 'prediction', areaId: 'ihe', area: 'Ihe & Edem', lat: 6.843, lng: 7.38, radius: 700,
    issue: 'no_power', confidence: 44, window: 'Tomorrow, 6 – 9 PM', startsInHours: 26, households: 2200,
    reasons: ['Repeated short trips on Ihe 11kV over the past nine days'],
  },
];

/* ------------------------------------------------------------------ */
/* Citizen                                                             */
/* ------------------------------------------------------------------ */

export const citizenProfile = {
  name: 'Chiamaka Nnaji',
  email: 'chiamaka@example.com',
  phone: '+234 803 000 0000',
  address: 'Mary Slessor Hall, UNN Main Campus',
  areaId: 'unn',
  lat: 6.8712,
  lng: 7.4136,
};

export interface CitizenReport {
  id: string;
  place: string;
  issue: IssueType;
  status: IncidentStatus;
  when: string;
  note?: string;
}

export const myReports: CitizenReport[] = [
  { id: 'VQ-2418', place: 'Odim Street', issue: 'fluctuating', status: 'reported', when: 'Today, 4:52 PM', note: 'Light going off every few minutes.' },
  { id: 'VQ-2276', place: 'Odim Street', issue: 'no_power', status: 'restored', when: 'Sep 14, 8:10 PM', note: 'Whole street dark after rain.' },
  { id: 'VQ-2031', place: 'Hilltop', issue: 'low_voltage', status: 'restored', when: 'Sep 2, 7:45 AM' },
];

export interface Alert {
  id: string;
  kind: 'prediction' | 'update' | 'restored';
  title: string;
  body: string;
  when: string;
  unread: boolean;
}

export const alerts: Alert[] = [
  { id: 'al-1', kind: 'prediction', title: 'Possible outage tonight', body: 'Odim Gate may lose light between 7 and 10 PM. Charge your phones and power banks.', when: '12 min ago', unread: true },
  { id: 'al-2', kind: 'update', title: 'Your report was received', body: '10 neighbours on Odim Street reported the same thing.', when: '1 hr ago', unread: true },
  { id: 'al-3', kind: 'restored', title: 'Light is back on Odim Street', body: 'Supply restored after 2 hr 40 min.', when: 'Sep 14', unread: false },
];

/** Live feed copy for the simulated new-report ticker. */
export const liveReporterNames = ['Obinna', 'Adaeze', 'Kelechi', 'Uche', 'Nneka', 'Somto', 'Ebuka', 'Chioma', 'Tobenna', 'Ifeoma'];

/* ------------------------------------------------------------------ */
/* Dashboard: next-24-hours outlook and last week's supply              */
/* ------------------------------------------------------------------ */

/** Demo "now" is 4 PM, three hours before the Odim Gate forecast window. */
export interface HourOutlook {
  label: string;
  /** Chance of losing light that hour, 0–100. Null for "now" (we know). */
  risk: number | null;
}

export const hourlyOutlook: HourOutlook[] = [
  { label: 'Now', risk: null },
  { label: '5 PM', risk: 12 }, { label: '6 PM', risk: 28 }, { label: '7 PM', risk: 78 },
  { label: '8 PM', risk: 84 }, { label: '9 PM', risk: 76 }, { label: '10 PM', risk: 48 },
  { label: '11 PM', risk: 22 }, { label: '12 AM', risk: 10 }, { label: '1 AM', risk: 6 },
  { label: '2 AM', risk: 5 }, { label: '3 AM', risk: 5 }, { label: '4 AM', risk: 6 },
  { label: '5 AM', risk: 9 }, { label: '6 AM', risk: 18 }, { label: '7 AM', risk: 24 },
  { label: '8 AM', risk: 15 }, { label: '9 AM', risk: 9 }, { label: '10 AM', risk: 7 },
  { label: '11 AM', risk: 6 }, { label: '12 PM', risk: 8 }, { label: '1 PM', risk: 9 },
  { label: '2 PM', risk: 11 }, { label: '3 PM', risk: 14 },
];

/** Minimum daily hours of supply promised per NERC service band. */
export const bandHours: Record<Area['band'], number> = { A: 20, B: 16, C: 12, D: 8 };

/** Hours of light per day at the citizen's address over the last 7 days. */
export const supplyWeek: Array<{ day: string; hours: number }> = [
  { day: 'Thu', hours: 17.5 },
  { day: 'Fri', hours: 12 },
  { day: 'Sat', hours: 19.5 },
  { day: 'Sun', hours: 9.5 },
  { day: 'Mon', hours: 16.5 },
  { day: 'Tue', hours: 11 },
  { day: 'Wed', hours: 14 },
];

/** Roughly how many reports it takes before EEDC confirms a fault. */
export const CONFIRM_AT_REPORTS = 15;
