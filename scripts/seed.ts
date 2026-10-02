/**
 * Upserts the reference data the app needs: EEDC and the Nsukka areas
 * (by slug, from src/data/nsukka.ts). Safe to run repeatedly.
 *
 *   DATABASE_URL=… pnpm db:seed
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { areas as areaTable, distributionCompanies } from '@/lib/db/schema';
import { areas } from '@/data/nsukka';

async function main() {
  const db = getDb();

  let [eedc] = await db.select().from(distributionCompanies).where(sql`${distributionCompanies.name} = 'EEDC'`);
  if (!eedc) {
    [eedc] = await db
      .insert(distributionCompanies)
      .values({ name: 'EEDC', serviceRegion: 'Nsukka district', contactEmail: 'info@enugudisco.com' })
      .returning();
  }

  for (const a of areas) {
    await db
      .insert(areaTable)
      .values({
        slug: a.id,
        name: a.name,
        city: 'Nsukka',
        state: 'Enugu',
        centerLat: a.lat,
        centerLng: a.lng,
        radiusMeters: a.radius,
        feeder: a.feeder,
        band: a.band,
        households: a.households,
        distributionCompanyId: eedc.id,
      })
      .onConflictDoUpdate({
        target: areaTable.slug,
        set: {
          name: a.name,
          centerLat: a.lat,
          centerLng: a.lng,
          radiusMeters: a.radius,
          feeder: a.feeder,
          band: a.band,
          households: a.households,
        },
      });
  }
  console.log(`Seeded EEDC and ${areas.length} areas.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
