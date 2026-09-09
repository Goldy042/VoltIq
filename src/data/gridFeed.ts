export type OutageStatus = 'stable' | 'reported' | 'critical' | 'predicted';

export interface FeederReading {
  id: string;
  feeder: string;
  district: string;
  status: OutageStatus;
  detail: string;
  /** 0–1 load index used to size the sparkline column */
  load: number;
}

export const statusLabels: Record<OutageStatus, string> = {
  stable: 'Stable',
  reported: 'Reported',
  critical: 'Critical',
  predicted: 'Predicted'
};

export const statusVars: Record<OutageStatus, string> = {
  stable: 'var(--status-stable)',
  reported: 'var(--status-reported)',
  critical: 'var(--status-critical)',
  predicted: 'var(--status-predicted)'
};

export const feederReadings: FeederReading[] = [
{
  id: 'f-114',
  feeder: 'Feeder 114',
  district: 'Old Mill',
  status: 'critical',
  detail: '412 homes dark · crew en route',
  load: 0.18
},
{
  id: 'f-207',
  feeder: 'Feeder 207',
  district: 'Rivergate',
  status: 'reported',
  detail: '9 citizen reports in 12 min',
  load: 0.46
},
{
  id: 'f-303',
  feeder: 'Feeder 303',
  district: 'Northfield',
  status: 'predicted',
  detail: 'Failure likely in 6–9 hrs · 78%',
  load: 0.71
},
{
  id: 'f-418',
  feeder: 'Feeder 418',
  district: 'Cedar Flats',
  status: 'stable',
  detail: 'Nominal load, no anomalies',
  load: 0.93
}];