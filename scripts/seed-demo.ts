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
import { incidents as incidentTable, outageReports, savedPlaces, trustEvents, users } from '@/lib/db/schema';
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
  await db.delete(outageReports).where(inArray(outageReports.userId, ids));
  // Outages left with no reports at all came only from the demo.
  const touched = [...new Set(reports.map((r) => r.incidentId).filter((x): x is string => Boolean(x)))];
  for (const id of touched) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(outageReports).where(eq(outageReports.incidentId, id));
    if (n === 0) await db.delete(incidentTable).where(eq(incidentTable.id, id));
  }
  await db.delete(savedPlaces).where(inArray(savedPlaces.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`Removed ${ids.length} demo residents and their reports.`);
}

async function seed() {
  const db = getDb();
  const now = new Date();
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
