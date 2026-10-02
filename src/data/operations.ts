/**
 * EEDC Nsukka district operations: staff, roles, teams and the report log the
 * operator dashboard reads. Mock data until the API exists — shapes mirror the
 * users / teams / outage_reports tables in src/lib/db/schema.ts.
 */

import { areas, incidents, liveReporterNames, type IncidentStatus, type IssueType } from '@/data/nsukka';
import { offsetMeters, seeded } from '@/lib/geo';

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

/** Mirrors staff_role in the DB schema. */
export type StaffRole = 'manager' | 'dispatcher' | 'team_lead' | 'technician';

export type Permission =
  | 'view_dashboard'
  | 'triage_reports'
  | 'dispatch_teams'
  | 'manage_teams'
  | 'assign_leads'
  | 'manage_roles'
  | 'update_own_job';

export const roleMeta: Record<StaffRole, { label: string; description: string; permissions: Permission[] }> = {
  manager: {
    label: 'Manager',
    description: 'Runs the district. Creates teams, assigns each team its lead, and sets everyone’s role.',
    permissions: ['view_dashboard', 'triage_reports', 'dispatch_teams', 'manage_teams', 'assign_leads', 'manage_roles', 'update_own_job'],
  },
  dispatcher: {
    label: 'Dispatcher',
    description: 'Watches the live map, confirms or rejects reports and sends teams out.',
    permissions: ['view_dashboard', 'triage_reports', 'dispatch_teams'],
  },
  team_lead: {
    label: 'Team lead',
    description: 'Leads one field team. Their name is what residents see beside the team.',
    permissions: ['view_dashboard', 'update_own_job'],
  },
  technician: {
    label: 'Field technician',
    description: 'Works on a team in the field. Sees their own jobs only.',
    permissions: ['update_own_job'],
  },
};

export const permissionLabel: Record<Permission, string> = {
  view_dashboard: 'See the operator dashboard',
  triage_reports: 'Confirm or reject reports',
  dispatch_teams: 'Dispatch teams to faults',
  manage_teams: 'Create teams and move members',
  assign_leads: 'Assign team leads',
  manage_roles: 'Change staff roles',
  update_own_job: 'Update their own job status',
};

export const can = (role: StaffRole, p: Permission) => roleMeta[role].permissions.includes(p);

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  /** Team the person works on; managers and dispatchers have none. */
  teamId: string | null;
  /** Set by a manager on the Teams or Staff page — nothing tracks this automatically. */
  onShift: boolean;
}

export const seedStaff: Staff[] = [
  { id: 's-adaobi', name: 'Adaobi Nwosu', role: 'manager', phone: '+234 803 410 2210', teamId: null, onShift: true },
  { id: 's-kingsley', name: 'Kingsley Attah', role: 'dispatcher', phone: '+234 806 118 3021', teamId: null, onShift: true },
  { id: 's-amara', name: 'Amarachi Ezeh', role: 'dispatcher', phone: '+234 816 552 0193', teamId: null, onShift: false },

  { id: 's-chinedu', name: 'Chinedu Eze', role: 'team_lead', phone: '+234 803 221 4410', teamId: 'c-alpha', onShift: true },
  { id: 's-obiora', name: 'Obiora Nweke', role: 'technician', phone: '+234 809 100 2231', teamId: 'c-alpha', onShift: true },
  { id: 's-uzo', name: 'Uzoamaka Ani', role: 'technician', phone: '+234 802 774 1902', teamId: 'c-alpha', onShift: true },

  { id: 's-ifeanyi', name: 'Ifeanyi Ugwu', role: 'team_lead', phone: '+234 806 913 2245', teamId: 'c-bravo', onShift: true },
  { id: 's-tochi', name: 'Tochukwu Odoh', role: 'technician', phone: '+234 813 664 0021', teamId: 'c-bravo', onShift: true },
  { id: 's-ejike', name: 'Ejike Mba', role: 'technician', phone: '+234 705 311 8840', teamId: 'c-bravo', onShift: true },

  { id: 's-ngozi', name: 'Ngozi Okafor', role: 'team_lead', phone: '+234 803 502 7716', teamId: 'c-charlie', onShift: true },
  { id: 's-chidi', name: 'Chidiebere Asogwa', role: 'technician', phone: '+234 810 228 3305', teamId: 'c-charlie', onShift: true },

  { id: 's-emeka', name: 'Emeka Odo', role: 'team_lead', phone: '+234 806 447 9902', teamId: 'c-delta', onShift: true },
  { id: 's-ugo', name: 'Ugochukwu Eze', role: 'technician', phone: '+234 815 990 4410', teamId: 'c-delta', onShift: true },
  { id: 's-ruth', name: 'Ruth Onah', role: 'technician', phone: '+234 703 225 6618', teamId: 'c-delta', onShift: false },
  { id: 's-paul', name: 'Paul Agbo', role: 'technician', phone: '+234 802 551 3390', teamId: null, onShift: false },
];

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

/**
 * Team record. Ids match the crews in useOutageFeed so the map and the roster agree.
 *
 * Only holds what the dashboard itself records: who is on the team, who leads
 * it, and what came out of the jobs dispatchers sent it on (dispatches.
 * assigned_at → completed_at). Nothing here needs a tracker in the van.
 */
export interface Team {
  id: string;
  name: string;
  /** Staff id of the lead — the name residents see beside the team. */
  leadId: string | null;
  /** Manager who assigned the current lead. */
  leadAssignedBy: string | null;
  /** Feeders this team covers first. */
  zone: string[];
  /** Jobs marked restored in the last 7 days. */
  jobsRestored: number;
  /** Median minutes from dispatch until the job was marked restored, last 7 days. */
  restoreMinutes: number;
  /** Share of those jobs restored within 4 hours of dispatch, 0–100. */
  within4h: number;
}

export const seedTeams: Team[] = [
  { id: 'c-alpha', name: 'Crew Alpha', leadId: 's-chinedu', leadAssignedBy: 's-adaobi', zone: ['Town 11kV', 'Ogige 11kV'], jobsRestored: 14, restoreMinutes: 86, within4h: 93 },
  { id: 'c-bravo', name: 'Crew Bravo', leadId: 's-ifeanyi', leadAssignedBy: 's-adaobi', zone: ['Odenigwe 11kV', 'Enugu Road 11kV'], jobsRestored: 17, restoreMinutes: 119, within4h: 82 },
  { id: 'c-charlie', name: 'Crew Charlie', leadId: 's-ngozi', leadAssignedBy: 's-adaobi', zone: ['UNN Campus 11kV', 'Onuiyi 11kV'], jobsRestored: 12, restoreMinutes: 139, within4h: 71 },
  { id: 'c-delta', name: 'Crew Delta', leadId: 's-emeka', leadAssignedBy: 's-adaobi', zone: ['Nru–Owerre 11kV', 'Ihe 11kV', 'Obukpa 11kV'], jobsRestored: 9, restoreMinutes: 108, within4h: 89 },
];

export type HealthLevel = 'good' | 'watch' | 'at_risk';

export const healthMeta: Record<HealthLevel, { label: string; color: string }> = {
  good: { label: 'Healthy', color: 'var(--status-restored)' },
  watch: { label: 'Watch', color: 'var(--status-low)' },
  at_risk: { label: 'At risk', color: 'var(--status-out)' },
};

export interface TeamHealth {
  level: HealthLevel;
  /** 0–100, higher is better. */
  score: number;
  /** Plain-language reasons the score is not 100, worst first. */
  issues: string[];
  onShift: number;
  size: number;
}

/** Staffing and restoration record rolled into one readable score. */
export function teamHealth(team: Team, members: Staff[]): TeamHealth {
  const onShift = members.filter((m) => m.onShift).length;
  const issues: Array<{ text: string; cost: number }> = [];

  if (!team.leadId) issues.push({ text: 'No lead assigned', cost: 30 });
  if (members.length === 0) issues.push({ text: 'No members', cost: 40 });
  else if (onShift === 0) issues.push({ text: 'Nobody marked on shift', cost: 25 });
  else if (onShift === 1) issues.push({ text: 'Only one person on shift', cost: 15 });
  if (team.jobsRestored) {
    if (team.within4h < 75) issues.push({ text: `Only ${team.within4h}% of jobs restored within 4 hr`, cost: 20 });
    else if (team.within4h < 85) issues.push({ text: `${team.within4h}% of jobs restored within 4 hr`, cost: 8 });
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.cost, 0));
  return {
    level: score >= 80 ? 'good' : score >= 60 ? 'watch' : 'at_risk',
    score,
    issues: issues.sort((a, b) => b.cost - a.cost).map((i) => i.text),
    onShift,
    size: members.length,
  };
}

/* ------------------------------------------------------------------ */
/* Report log — individual citizen reports behind each incident        */
/* ------------------------------------------------------------------ */

export type ReportReview = 'pending' | 'confirmed' | 'false_report';

export interface ReportRow {
  id: string;
  incidentId: string;
  areaId: string;
  place: string;
  reporter: string;
  phone: string;
  issue: IssueType;
  /** Status of the incident this report was merged into. */
  status: IncidentStatus;
  /** Operator review of this single report. */
  review: ReportReview;
  minutesAgo: number;
  voltage?: number;
  note?: string;
  lat: number;
  lng: number;
}

const notes: Record<IssueType, string[]> = {
  no_power: ['Whole street is dark.', 'Heard a bang from the transformer.', 'No light since evening.', 'Neighbours also have nothing.'],
  low_voltage: ['Bulbs very dim.', 'Fan barely turning.', 'Fridge will not start.', 'Stabiliser keeps beeping.'],
  fluctuating: ['Light keeps going and coming.', 'On and off every few minutes.', 'Blinking since afternoon.'],
};

const surnames = ['Okeke', 'Eze', 'Nnaji', 'Ugwu', 'Odo', 'Asogwa', 'Onah', 'Agu', 'Ani', 'Okonkwo'];

/** Deterministic per-report rows behind every incident (capped per incident). */
export function buildReportLog(): ReportRow[] {
  const rows: ReportRow[] = [];
  let n = 4100;
  for (const inc of incidents) {
    const rand = seeded(`log-${inc.id}`);
    const count = Math.min(inc.reports, 24);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rand()) * inc.radius * 0.9;
      const t = rand() * Math.PI * 2;
      const p = offsetMeters(inc.lat, inc.lng, Math.sin(t) * r, Math.cos(t) * r);
      const first = liveReporterNames[Math.floor(rand() * liveReporterNames.length)];
      const last = surnames[Math.floor(rand() * surnames.length)];
      const flagged = rand() < 0.06;
      rows.push({
        id: `VQ-${n++}`,
        incidentId: inc.id,
        areaId: inc.areaId,
        place: inc.place,
        reporter: `${first} ${last}`,
        phone: `+234 80${Math.floor(rand() * 10)} ••• ${String(Math.floor(rand() * 9000) + 1000)}`,
        issue: inc.issue,
        status: inc.status,
        review: flagged ? 'false_report' : inc.status === 'reported' ? 'pending' : 'confirmed',
        minutesAgo: Math.round(rand() * inc.minutesAgo),
        voltage: inc.voltage ? Math.round(inc.voltage + (rand() - 0.5) * 30) : undefined,
        note: rand() < 0.55 ? notes[inc.issue][Math.floor(rand() * notes[inc.issue].length)] : undefined,
        lat: p.lat,
        lng: p.lng,
      });
    }
  }
  return rows.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/** Reports received per hour over the last 24 hours (oldest first). */
export const reportsByHour: Array<{ hour: string; reports: number; restored: number }> = (() => {
  const rand = seeded('reports-by-hour');
  // Demo "now" is 4 PM, so the window runs 5 PM yesterday → 4 PM today. Evenings are busiest.
  const shape = [14, 22, 34, 41, 38, 26, 15, 9, 5, 3, 2, 2, 3, 6, 9, 11, 10, 9, 8, 9, 10, 12, 15, 18];
  return shape.map((base, i) => {
    const h = (17 + i) % 24;
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    return { hour: label, reports: Math.round(base * (0.85 + rand() * 0.3)), restored: Math.round(base * 0.4 * rand()) };
  });
})();

export { areas };
