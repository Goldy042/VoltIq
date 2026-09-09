import type { OutageStatus } from './gridFeed';

export interface CitizenReport {
  id: string;
  location: string;
  startedAt: string;
  submittedAt: string;
  status: 'submitted' | 'confirmed' | 'crew-dispatched' | 'resolved';
  note?: string;
}

export const reportStatusLabels: Record<CitizenReport['status'], string> = {
  submitted: 'Submitted',
  confirmed: 'Confirmed by grid',
  'crew-dispatched': 'Crew dispatched',
  resolved: 'Resolved'
};

export const reportStatusColor: Record<CitizenReport['status'], string> = {
  submitted: 'var(--status-reported)',
  confirmed: 'var(--status-critical)',
  'crew-dispatched': 'var(--status-critical)',
  resolved: 'var(--status-stable)'
};

export const citizenProfile = {
  name: 'Amara Osei',
  email: 'amara@bellhaven.net',
  address: '48 Alder Street, Northfield',
  feeder: 'Feeder 303 · Northfield'
};

export const areaStatus: {
  status: OutageStatus;
  headline: string;
  detail: string;
  updated: string;
} = {
  status: 'predicted',
  headline: 'Watch',
  detail:
  'Northfield feeder 303 is showing the load pattern that preceded the March fault. No outage yet.',
  updated: '2 min ago'
};

export const predictedAlert = {
  window: '6:00 – 9:00 PM today',
  confidence: 78,
  area: 'Northfield · Alder Street and around',
  body: 'Possible outage predicted in your area between 6 and 9pm today, based on recent grid activity and the storm front moving in from the coast.',
  advice: 'Charge phones and medical devices before six. We will send an update at 5:30 PM.'
};

export const pastReports: CitizenReport[] = [
{
  id: 'r-2043',
  location: '48 Alder Street, Northfield',
  startedAt: 'Mar 14, 8:42 PM',
  submittedAt: 'Mar 14, 8:44 PM',
  status: 'resolved',
  note: 'Whole street dark, heard a bang from the pole transformer.'
},
{
  id: 'r-1877',
  location: '48 Alder Street, Northfield',
  startedAt: 'Feb 2, 6:10 AM',
  submittedAt: 'Feb 2, 6:15 AM',
  status: 'resolved',
  note: 'Lights flickering for ten minutes, then out.'
},
{
  id: 'r-1602',
  location: 'Corner of Alder & Kiln Row',
  startedAt: 'Dec 19, 11:02 PM',
  submittedAt: 'Dec 19, 11:09 PM',
  status: 'resolved'
}];