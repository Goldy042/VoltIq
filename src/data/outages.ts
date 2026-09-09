export type OutageState = 'reported' | 'critical' | 'dispatched' | 'resolved';

export interface OutagePoint {
  id: string;
  kind: 'report';
  lat: number;
  lng: number;
  address: string;
  district: string;
  feeder: string;
  state: OutageState;
  /** Number of citizen reports merged into this point. */
  reports: number;
  households: number;
  startedAt: string;
  /** Minutes since the first report — used for recency sorting. */
  ageMinutes: number;
  note: string;
  crew?: string;
}

export interface PredictedZone {
  id: string;
  kind: 'prediction';
  lat: number;
  lng: number;
  /** Zone radius in metres. */
  radius: number;
  district: string;
  feeder: string;
  confidence: number;
  window: string;
  households: number;
  reason: string;
}

/** Bellhaven pilot network — fictional county mapped over real streets. */
export const mapCenter: [number, number] = [51.4571, -2.6021];

export const outagePoints: OutagePoint[] = [
{
  id: 'o-114',
  kind: 'report',
  lat: 51.4623,
  lng: -2.6114,
  address: 'Old Mill Road & Foundry Row',
  district: 'Old Mill',
  feeder: 'Feeder 114',
  state: 'critical',
  reports: 118,
  households: 412,
  startedAt: '20:41',
  ageMinutes: 74,
  note: 'Pole transformer fault confirmed by SCADA. Whole span dark.',
  crew: 'Crew 4'
},
{
  id: 'o-118',
  kind: 'report',
  lat: 51.4631,
  lng: -2.6098,
  address: 'Kiln Row',
  district: 'Old Mill',
  feeder: 'Feeder 114',
  state: 'critical',
  reports: 46,
  households: 96,
  startedAt: '20:44',
  ageMinutes: 71,
  note: 'Same span as Old Mill Road — merged into the 114 fault.',
  crew: 'Crew 4'
},
{
  id: 'o-207',
  kind: 'report',
  lat: 51.4508,
  lng: -2.5834,
  address: 'Rivergate East, Quay Street',
  district: 'Rivergate',
  feeder: 'Feeder 207',
  state: 'reported',
  reports: 9,
  households: 130,
  startedAt: '21:32',
  ageMinutes: 23,
  note: 'Nine reports in twelve minutes. Fault not yet confirmed on telemetry.'
},
{
  id: 'o-209',
  kind: 'report',
  lat: 51.4497,
  lng: -2.5809,
  address: 'Quay Street, north end',
  district: 'Rivergate',
  feeder: 'Feeder 207',
  state: 'reported',
  reports: 4,
  households: 58,
  startedAt: '21:36',
  ageMinutes: 19,
  note: 'Flickering reported before loss of supply.'
},
{
  id: 'o-244',
  kind: 'report',
  lat: 51.4519,
  lng: -2.5851,
  address: 'Mercer Lane',
  district: 'Rivergate',
  feeder: 'Feeder 207',
  state: 'reported',
  reports: 2,
  households: 22,
  startedAt: '21:39',
  ageMinutes: 16,
  note: 'Two reports, same block as Quay Street cluster.'
},
{
  id: 'o-402',
  kind: 'report',
  lat: 51.4465,
  lng: -2.6206,
  address: 'Cedar Flats loop road',
  district: 'Cedar Flats',
  feeder: 'Feeder 418',
  state: 'dispatched',
  reports: 21,
  households: 210,
  startedAt: '19:05',
  ageMinutes: 170,
  note: 'Underground joint failure. Crew 2 on site, supply partially restored.',
  crew: 'Crew 2'
},
{
  id: 'o-377',
  kind: 'report',
  lat: 51.4682,
  lng: -2.5893,
  address: 'Harbour Line, dock gate 3',
  district: 'Harbour',
  feeder: 'Feeder 512',
  state: 'resolved',
  reports: 14,
  households: 74,
  startedAt: '16:20',
  ageMinutes: 335,
  note: 'Fuse replaced at 17:48. Supply normal since.',
  crew: 'Crew 1'
}];


export const predictedZones: PredictedZone[] = [
{
  id: 'p-303',
  kind: 'prediction',
  lat: 51.4601,
  lng: -2.5762,
  radius: 700,
  district: 'Northfield',
  feeder: 'Feeder 303',
  confidence: 78,
  window: '18:00 – 21:00 today',
  households: 412,
  reason:
  'Load pattern matches the 12 March fault, with a storm front due at 17:40.'
},
{
  id: 'p-512',
  kind: 'prediction',
  lat: 51.4444,
  lng: -2.5941,
  radius: 520,
  district: 'Harbour',
  feeder: 'Feeder 512',
  confidence: 41,
  window: 'Tomorrow, 06:00 – 10:00',
  households: 188,
  reason: 'Rising conductor temperature on an ageing span under wind load.'
},
{
  id: 'p-118',
  kind: 'prediction',
  lat: 51.4675,
  lng: -2.6265,
  radius: 430,
  district: 'Westcombe',
  feeder: 'Feeder 118',
  confidence: 33,
  window: 'Tomorrow, 17:00 – 20:00',
  households: 96,
  reason: 'Repeated momentary interruptions over the past nine days.'
}];


export const stateLabels: Record<OutageState, string> = {
  reported: 'Reported',
  critical: 'Critical',
  dispatched: 'Team dispatched',
  resolved: 'Resolved'
};

export const stateColors: Record<OutageState, string> = {
  reported: 'var(--status-reported)',
  critical: 'var(--status-critical)',
  dispatched: 'var(--status-reported)',
  resolved: 'var(--status-stable)'
};

export const severityRank: Record<OutageState, number> = {
  critical: 0,
  reported: 1,
  dispatched: 2,
  resolved: 3
};