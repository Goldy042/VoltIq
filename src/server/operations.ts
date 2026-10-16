/**
 * EEDC operations in Postgres: staff roles, teams and their leads, shifts,
 * dispatches, and the per-report log reviewers work through. Every change is
 * checked against the acting staff member's permissions (roleMeta in
 * src/data/operations.ts), so the API can't do what the UI wouldn't allow.
 */

import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { areas, dispatches, distributionCompanies, incidents, outageReports, teams, users } from '@/lib/db/schema';
import { can, type Permission, type ReportRow, type Staff, type StaffRole, type Team } from '@/data/operations';
import type { Crew, IncidentStatus } from '@/data/nsukka';
import { ReportError } from './reports';
import { notifyIncident } from './notifications';
import type { DbUser } from './users';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Conn = Db | Tx;

const DAY = 86_400_000;
/** Where a team with no recorded position is drawn: the EEDC district office by the Enugu Road substation. */
const DISTRICT_OFFICE = { lat: 6.8471, lng: 7.4021 };
const OFFICE_ROLES: StaffRole[] = ['manager', 'dispatcher'];

export interface Org {
  staff: Staff[];
  teams: Team[];
  meId: string;
}

function require(actor: Pick<DbUser, 'role'>, p: Permission) {
  if (actor.role === 'citizen' || !can(actor.role as StaffRole, p)) {
    throw new ReportError('forbidden', 'Your role doesn’t allow that. Ask a manager.');
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Staff and teams in the shapes the operator screens use, with 7-day job stats from dispatches. */
export async function loadOrg(db: Conn, me: DbUser, now = new Date()): Promise<Org> {
  const staffRows = await db.select().from(users).where(ne(users.role, 'citizen')).orderBy(users.name);
  const teamRows = await db.select().from(teams).orderBy(teams.name);
  const done = await db
    .select({ teamId: dispatches.teamId, assignedAt: dispatches.assignedAt, completedAt: dispatches.completedAt })
    .from(dispatches)
    .where(and(eq(dispatches.status, 'completed'), isNotNull(dispatches.completedAt), gte(dispatches.completedAt, new Date(now.getTime() - 7 * DAY))));

  return {
    meId: me.id,
    staff: staffRows.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role as StaffRole,
      phone: u.phone ?? '',
      teamId: u.teamId,
      onShift: u.onShift,
    })),
    teams: teamRows.map((t) => {
      const mins = done.filter((d) => d.teamId === t.id).map((d) => Math.round((d.completedAt!.getTime() - d.assignedAt.getTime()) / 60_000));
      return {
        id: t.id,
        name: t.name,
        leadId: t.leadUserId,
        leadAssignedBy: t.leadAssignedById,
        zone: t.feeders,
        jobsRestored: mins.length,
        restoreMinutes: median(mins),
        within4h: mins.length ? Math.round((mins.filter((m) => m <= 240).length / mins.length) * 100) : 0,
      };
    }),
  };
}

/**
 * Teams as map crews. Residents only see teams that are out on a job (name
 * and lead, as promised in the app); staff see every team.
 */
export async function loadCrews(db: Conn, opts: { staff: boolean }): Promise<Crew[]> {
  const teamRows = await db.select().from(teams);
  if (!teamRows.length) return [];
  const open = await db
    .select({ teamId: dispatches.teamId, incidentId: dispatches.incidentId })
    .from(dispatches)
    .where(ne(dispatches.status, 'completed'));
  const leadIds = teamRows.map((t) => t.leadUserId).filter((x): x is string => Boolean(x));
  const leads = leadIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, leadIds)) : [];
  const leadName = new Map(leads.map((l) => [l.id, l.name]));

  return teamRows
    .map((t): Crew => {
      const job = open.find((d) => d.teamId === t.id);
      return {
        id: t.id,
        name: t.name,
        lead: (t.leadUserId && leadName.get(t.leadUserId)) || 'No lead yet',
        // We don't track vans, so a team on a job is shown at the fault, not "en route".
        status: job ? 'on_site' : 'available',
        lat: t.currentLat ?? DISTRICT_OFFICE.lat,
        lng: t.currentLng ?? DISTRICT_OFFICE.lng,
        incidentId: job?.incidentId ?? undefined,
      };
    })
    .filter((c) => opts.staff || c.incidentId);
}

/** Every individual report, newest first, as reviewers see them. Phone numbers are masked. */
export async function listReportLog(db: Db, now = new Date(), limit = 500): Promise<ReportRow[]> {
  const rows = await db
    .select({
      r: outageReports,
      reporter: users.name,
      phone: users.phone,
      incidentStatus: incidents.status,
      areaSlug: areas.slug,
    })
    .from(outageReports)
    .leftJoin(users, eq(users.id, outageReports.userId))
    .leftJoin(incidents, eq(incidents.id, outageReports.incidentId))
    .leftJoin(areas, eq(areas.id, outageReports.areaId))
    .orderBy(desc(outageReports.createdAt))
    .limit(limit);

  return rows.map(({ r, reporter, phone, incidentStatus, areaSlug }) => ({
    id: r.id,
    ref: `VQ-${r.id.slice(0, 6).toUpperCase()}`,
    incidentId: r.incidentId ?? '',
    areaId: areaSlug ?? '',
    place: r.landmark || areaSlug || 'Nsukka',
    reporter: reporter ?? 'Resident',
    phone: phone ? `${phone.slice(0, 7)} ••• ${phone.slice(-4)}` : 'No phone',
    issue: r.issueType,
    status: (incidentStatus ?? 'reported') as IncidentStatus,
    review: r.status === 'false_report' ? 'false_report' : r.reviewedAt ? 'confirmed' : r.flagged || incidentStatus === 'reported' ? 'pending' : 'confirmed',
    minutesAgo: Math.max(0, Math.round((now.getTime() - r.createdAt.getTime()) / 60_000)),
    voltage: r.voltageReading ?? undefined,
    note: r.description ?? undefined,
    lat: r.latitude,
    lng: r.longitude,
    flags: r.flags,
  }));
}

/* ------------------------------------------------------------------ */
/* Changing the roster                                                 */
/* ------------------------------------------------------------------ */

export type OrgAction =
  | { action: 'assignLead'; teamId: string; staffId: string }
  | { action: 'setRole'; staffId: string; role: StaffRole }
  | { action: 'moveToTeam'; staffId: string; teamId: string | null }
  | { action: 'toggleShift'; staffId: string }
  | { action: 'createTeam'; name: string; zone: string[] }
  | { action: 'renameTeam'; teamId: string; name: string };

const ROLES: StaffRole[] = ['manager', 'dispatcher', 'team_lead', 'technician'];

async function staffRow(tx: Tx, id: string) {
  const [u] = await tx.select().from(users).where(eq(users.id, id));
  if (!u || u.role === 'citizen') throw new ReportError('not_found', 'That staff member doesn’t exist.');
  return u;
}

async function teamRow(tx: Tx, id: string) {
  const [t] = await tx.select().from(teams).where(eq(teams.id, id));
  if (!t) throw new ReportError('not_found', 'That team doesn’t exist.');
  return t;
}

/** Apply one roster change. Mirrors the rules the screens show (src/lib/operations.tsx). */
export async function applyOrgAction(db: Db, actor: DbUser, a: OrgAction, now = new Date()) {
  await db.transaction(async (tx) => {
    switch (a.action) {
      case 'assignLead': {
        require(actor, 'assign_leads');
        const team = await teamRow(tx, a.teamId);
        const person = await staffRow(tx, a.staffId);
        if (person.teamId !== team.id) throw new ReportError('invalid', `${person.name} must be on ${team.name} before leading it.`);
        await tx.update(teams).set({ leadUserId: person.id, leadAssignedById: actor.id, leadAssignedAt: now }).where(eq(teams.id, team.id));
        await tx.update(users).set({ role: 'team_lead', updatedAt: now }).where(eq(users.id, person.id));
        if (team.leadUserId && team.leadUserId !== person.id) {
          await tx.update(users).set({ role: 'technician', updatedAt: now }).where(eq(users.id, team.leadUserId));
        }
        return;
      }
      case 'setRole': {
        require(actor, 'manage_roles');
        if (!ROLES.includes(a.role)) throw new ReportError('invalid', 'Unknown role.', { field: 'role' });
        const person = await staffRow(tx, a.staffId);
        if (person.role === 'manager' && a.role !== 'manager') {
          const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'manager'));
          if (n <= 1) throw new ReportError('invalid', 'The district needs at least one manager.');
        }
        const office = OFFICE_ROLES.includes(a.role);
        await tx.update(users).set({ role: a.role, teamId: office ? null : person.teamId, updatedAt: now }).where(eq(users.id, person.id));
        // Someone who stops being a lead stops leading their team.
        if (a.role !== 'team_lead') await tx.update(teams).set({ leadUserId: null, leadAssignedById: null, leadAssignedAt: null }).where(eq(teams.leadUserId, person.id));
        return;
      }
      case 'moveToTeam': {
        require(actor, 'manage_teams');
        const person = await staffRow(tx, a.staffId);
        if (a.teamId) await teamRow(tx, a.teamId);
        const role = OFFICE_ROLES.includes(person.role as StaffRole) ? 'technician' : person.role;
        await tx.update(users).set({ teamId: a.teamId, role, updatedAt: now }).where(eq(users.id, person.id));
        // A lead who moves leaves their old team leaderless.
        await tx
          .update(teams)
          .set({ leadUserId: null, leadAssignedById: null, leadAssignedAt: null })
          .where(and(eq(teams.leadUserId, person.id), a.teamId ? ne(teams.id, a.teamId) : sql`true`));
        return;
      }
      case 'toggleShift': {
        require(actor, 'manage_teams');
        const person = await staffRow(tx, a.staffId);
        await tx.update(users).set({ onShift: !person.onShift, updatedAt: now }).where(eq(users.id, person.id));
        return;
      }
      case 'createTeam': {
        require(actor, 'manage_teams');
        const name = a.name?.trim();
        if (!name || name.length > 100) throw new ReportError('invalid', 'Give the team a name.', { field: 'name' });
        const [company] = actor.distributionCompanyId
          ? [{ id: actor.distributionCompanyId }]
          : await tx.select({ id: distributionCompanies.id }).from(distributionCompanies).limit(1);
        if (!company) throw new ReportError('invalid', 'No distribution company set up. Run the seed script.');
        await tx.insert(teams).values({ name, feeders: (a.zone ?? []).slice(0, 12), distributionCompanyId: company.id });
        return;
      }
      case 'renameTeam': {
        require(actor, 'manage_teams');
        const name = a.name?.trim();
        if (!name) throw new ReportError('invalid', 'Give the team a name.', { field: 'name' });
        await tx.update(teams).set({ name }).where(eq(teams.id, a.teamId));
        return;
      }
      default:
        throw new ReportError('invalid', 'Unknown action.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

/**
 * Send a team to an outage. One open dispatch per outage: sending a
 * different team reassigns it. The outage becomes "team on the way".
 */
export async function dispatchTeam(db: Db, actor: DbUser, incidentId: string, teamId: string, now = new Date()) {
  require(actor, 'dispatch_teams');
  const result = await db.transaction(async (tx) => {
    const [inc] = await tx.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!inc) throw new ReportError('not_found', 'That outage no longer exists.');
    if (inc.status === 'restored') throw new ReportError('invalid', 'That outage is already restored.');
    await teamRow(tx, teamId);

    const [open] = await tx
      .select()
      .from(dispatches)
      .where(and(eq(dispatches.incidentId, incidentId), ne(dispatches.status, 'completed')));
    if (open) {
      await tx.update(dispatches).set({ teamId, assignedById: actor.id, assignedAt: now }).where(eq(dispatches.id, open.id));
    } else {
      await tx.insert(dispatches).values({ teamId, incidentId, areaId: inc.areaId, assignedById: actor.id, assignedAt: now });
    }
    await tx
      .update(incidents)
      .set({ status: 'crew_dispatched', confirmedAt: inc.confirmedAt ?? now })
      .where(eq(incidents.id, incidentId));
    return { status: 'crew_dispatched' as const, teamId };
  });
  // Reassigning a team inside the repeat window doesn't alert people twice.
  await notifyIncident(db, incidentId, 'crew_dispatched', now);
  return result;
}

/** Close the open dispatch on an outage when it's restored — that's what job stats count. */
export async function completeDispatches(tx: Conn, incidentId: string, now: Date) {
  await tx
    .update(dispatches)
    .set({ status: 'completed', completedAt: now })
    .where(and(eq(dispatches.incidentId, incidentId), ne(dispatches.status, 'completed')));
}
