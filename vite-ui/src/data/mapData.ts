import type { OutageStatus } from './gridFeed';

export interface MapIncident {
  id: string;
  label: string;
  district: string;
  status: OutageStatus;
  /** Position as a percentage of the map frame. */
  x: number;
  y: number;
  reports: number;
  note: string;
}

export const mapIncidents: MapIncident[] = [
{
  id: 'i-01',
  label: 'Old Mill substation',
  district: 'Old Mill',
  status: 'critical',
  x: 26,
  y: 34,
  reports: 118,
  note: 'Transformer fault · crew 4 on site'
},
{
  id: 'i-02',
  label: 'Rivergate east',
  district: 'Rivergate',
  status: 'reported',
  x: 58,
  y: 22,
  reports: 9,
  note: 'Clustered reports, fault unconfirmed'
},
{
  id: 'i-03',
  label: 'Northfield ridge',
  district: 'Northfield',
  status: 'predicted',
  x: 71,
  y: 58,
  reports: 0,
  note: '78% chance of failure before 21:00'
},
{
  id: 'i-04',
  label: 'Cedar Flats loop',
  district: 'Cedar Flats',
  status: 'stable',
  x: 39,
  y: 71,
  reports: 0,
  note: 'Nominal'
},
{
  id: 'i-05',
  label: 'Harbour line',
  district: 'Harbour',
  status: 'predicted',
  x: 15,
  y: 62,
  reports: 0,
  note: '41% chance · storm front inbound'
}];


export const weekStats = [
{ value: '146', label: 'Outages reported this week', context: '+12 vs. last week' },
{ value: '3', label: 'Areas currently affected', context: '1 critical, 2 reported' },
{ value: '2,180', label: 'Predicted alerts sent', context: 'Median 6.4 hrs ahead' }];