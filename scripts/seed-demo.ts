/**
 * Fills a development database with realistic outages by filing real reports
 * through submitReport — the same path the app uses — so grouping, trust and
 * abuse checks all run. Demo residents use @demo.voltiq.local emails.
 *
 *   pnpm db:seed-demo           add demo reports
 *   pnpm db:seed-demo --clear   remove everything the demo added
 *
 * Never run against production.
 */
import 'dotenv/config';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { dispatches, distributionCompanies, incidents as incidentTable, notifications, outageReports, pushSubscriptions, savedPlaces, teams, trustEvents, users } from '@/lib/db/schema';
import { seedStaff, seedTeams } from '@/data/operations';
import { incidents as demoIncidents } from '@/data/nsukka';
import { offsetMeters, seeded } from '@/lib/geo';
import { submitReport } from '@/server/reports';
import { setIncidentStatus } from '@/server/incidents';

const DOMAIN = '@demo.voltiq.local';
const PER_INCIDENT = 8;

async function clear() {
  const db = getDb();
  const demo = await db.select({ id: users.id }).from(users).where(like(users.email, `%${DOMAIN}`));
  const ids = demo.map((u) => u.id);
  if (!ids.length) return console.log('No demo data to clear.');
  const reports = await db.select({ incidentId: outageReports.incidentId }).from(outageReports).where(inArray(outageReports.userId, ids));
  await db.delete(trustEvents).where(inArray(trustEvents.userId, ids));
  await db.delete(notifications).where(inArray(notifications.userId, ids));
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids));
  await db.delete(outageReports).where(inArray(outageReports.userId, ids));
  // Outages left with no reports at all came only from the demo.
  const touched = [...new Set(reports.map((r) => r.incidentId).filter((x): x is string => Boolean(x)))];
  for (const id of touched) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(outageReports).where(eq(outageReports.incidentId, id));
    if (n > 0) continue;
    await db.delete(notifications).where(eq(notifications.incidentId, id));
    await db.delete(dispatches).where(eq(dispatches.incidentId, id));
    await db.delete(incidentTable).where(eq(incidentTable.id, id));
  }
  const demoTeams = await db.select({ id: teams.id }).from(teams).where(inArray(teams.name, seedTeams.map((t) => t.name)));
  const teamIds = demoTeams.map((t) => t.id);
  if (teamIds.length) {
    await db.delete(dispatches).where(inArray(dispatches.teamId, teamIds));
    await db.update(users).set({ teamId: null }).where(inArray(users.teamId, teamIds));
    await db.delete(teams).where(inArray(teams.id, teamIds));
  }
  await db.delete(savedPlaces).where(inArray(savedPlaces.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`Removed ${ids.length} demo residents and their reports.`);
}

/** Demo EEDC staff and teams (they can't sign in; real staff link by email on first sign-in). */
async function seedRoster(now: Date) {
  const db = getDb();
  const [company] = await db.select({ id: distributionCompanies.id }).from(distributionCompanies).limit(1);
  if (!company) throw new Error('Run pnpm db:seed first (no distribution company).');
  const teamId = new Map<string, string>();
  for (const t of seedTeams) {
    const [existing] = await db.select().from(teams).where(eq(teams.name, t.name));
    const row = existing ?? (await db.insert(teams).values({ name: t.name, feeders: t.zone, distributionCompanyId: company.id }).returning())[0];
    teamId.set(t.id, row.id);
  }
  const staffId = new Map<string, string>();
  for (const p of seedStaff) {
    const [row] = await db
      .insert(users)
      .values({ name: p.name, email: `${p.id}${DOMAIN}`, phone: p.phone, role: p.role, onShift: p.onShift, teamId: p.teamId ? teamId.get(p.teamId) ?? null : null, createdAt: now })
      .onConflictDoUpdate({ target: users.email, set: { role: p.role, onShift: p.onShift, teamId: p.teamId ? teamId.get(p.teamId) ?? null : null } })
      .returning();
    staffId.set(p.id, row.id);
  }
  for (const t of seedTeams) {
    if (!t.leadId) continue;
    await db
      .update(teams)
      .set({ leadUserId: staffId.get(t.leadId), leadAssignedById: t.leadAssignedBy ? staffId.get(t.leadAssignedBy) : null, leadAssignedAt: now })
      .where(eq(teams.id, teamId.get(t.id)!));
  }
  console.log(`Seeded ${seedTeams.length} teams and ${seedStaff.length} staff.`);
}

async function seed() {
  const db = getDb();
  const now = new Date();
  await seedRoster(now);
  let made = 0;
  for (const inc of demoIncidents) {
    const rand = seeded(`demo-${inc.id}`);
    const count = Math.min(inc.reports, PER_INCIDENT);
    let incidentId: string | undefined;
    for (let i = 0; i < count; i++) {
      // A long-standing resident living inside the outage, reporting from home.
      const r = Math.sqrt(rand()) * inc.radius * 0.7;
      const t = rand() * Math.PI * 2;
      const p = offsetMeters(inc.lat, inc.lng, Math.sin(t) * r, Math.cos(t) * r);
      const email = `${inc.id}-${i}${DOMAIN}`;
      const [user] = await db
        .insert(users)
        .values({ name: `Demo resident ${inc.area} ${i + 1}`, email, createdAt: new Date(now.getTime() - 60 * 86_400_000), onboardedAt: now })
        .onConflictDoUpdate({ target: users.email, set: { updatedAt: now } })
        .returning();
      await db.insert(savedPlaces).values({ userId: user.id, label: 'home', latitude: p.lat, longitude: p.lng, plusCode: 'DEMO', isPrimary: true });

      const result = await submitReport(
        db,
        user.id,
        {
          issue: inc.issue,
          lat: p.lat,
          lng: p.lng,
          device: { ...p, accuracy: 12 },
          areaSlug: inc.areaId,
          startedAt: new Date(now.getTime() - inc.minutesAgo * 60_000).toISOString(),
          voltage: inc.voltage ? Math.round(inc.voltage + (rand() - 0.5) * 20) : undefined,
          note: i === 0 ? inc.note : undefined,
        },
        { now },
      );
      if (result.outcome === 'created') made++;
      incidentId ??= result.incident?.id;
    }
    // Mirror the demo's repair progress so every status shows on the map.
    if (incidentId && inc.status !== 'reported') {
      if (inc.status === 'restored') await setIncidentStatus(db, incidentId, 'confirmed', now);
      await setIncidentStatus(db, incidentId, inc.status, now);
    }
    console.log(`${inc.area}: ${count} reports → ${inc.status}`);
  }
  console.log(`Filed ${made} demo reports.`);
}

const run = process.argv.includes('--clear') ? clear : seed;
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
