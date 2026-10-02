/**
 * Upserts the reference data the app needs: EEDC and the Nsukka areas
 * (by slug, from src/data/nsukka.ts). Safe to run repeatedly.
 *
 *   DATABASE_URL=… pnpm db:seed
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { areas as areaTable, distributionCompanies, savedPlaces } from '@/lib/db/schema';
import { areaById, areaContaining, areas } from '@/data/nsukka';
import { pointInRing } from '@/lib/geo';
import { resolveArea } from '@/lib/address';

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

  // Areas that turned out to be another name for an existing one. Everything
  // filed under the old area moves to the new one, then the old row goes.
  const retired: Record<string, string> = { onuiyi: 'hilltop' };
  for (const [from, to] of Object.entries(retired)) {
    const [old] = await db.select({ id: areaTable.id }).from(areaTable).where(eq(areaTable.slug, from));
    const [target] = await db.select({ id: areaTable.id }).from(areaTable).where(eq(areaTable.slug, to));
    if (!old || !target) continue;
    await db.transaction(async (tx) => {
      for (const [table, column] of [
        ['users', 'area_id'],
        ['saved_places', 'area_id'],
        ['incidents', 'area_id'],
        ['outage_reports', 'area_id'],
        ['dispatches', 'area_id'],
        ['predictions', 'area_id'],
        ['area_corrections', 'area_id'],
        ['area_corrections', 'guessed_area_id'],
      ]) {
        await tx.execute(sql`update ${sql.identifier(table)} set ${sql.identifier(column)} = ${target.id} where ${sql.identifier(column)} = ${old.id}`);
      }
      await tx.delete(areaTable).where(eq(areaTable.id, old.id));
    });
    console.log(`Merged area "${from}" into "${to}".`);
  }

  // Areas with a drawn boundary are authoritative: re-file saved places that
  // sit inside one, or that were filed under one they're actually outside.
  const rows = await db.select({ id: areaTable.id, slug: areaTable.slug }).from(areaTable);
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const slugById = new Map(rows.map((r) => [r.id, r.slug]));
  let moved = 0;
  for (const place of await db.select().from(savedPlaces)) {
    const p = { lat: place.latitude, lng: place.longitude };
    const current = place.areaId ? slugById.get(place.areaId) : undefined;
    const inside = areaContaining(p);
    const wrongBoundary = current && areaById[current]?.boundary && !pointInRing(p, areaById[current].boundary!);
    const next = inside ? inside.id : wrongBoundary ? resolveArea(p, 0, []).area.id : current;
    if (next && next !== current && idBySlug.has(next)) {
      await db.update(savedPlaces).set({ areaId: idBySlug.get(next)!, updatedAt: new Date() }).where(eq(savedPlaces.id, place.id));
      moved++;
    }
  }
  console.log(`Re-filed ${moved} saved place${moved === 1 ? '' : 's'} by drawn boundaries.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
