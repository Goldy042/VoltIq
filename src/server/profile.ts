/**
 * Profile, saved places and alert preferences for a signed-in resident —
 * the server side of src/lib/profile.tsx.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { areaCorrections, areas, savedPlaces, users } from '@/lib/db/schema';
import { NSUKKA_BOUNDS } from '@/data/nsukka';
import { shortPlusCode } from '@/lib/pluscode';
import { defaultAlerts, type AlertPrefs, type PlaceLabel, type Profile, type SavedPlace } from '@/lib/profile-types';
import { ReportError, suggestAreas } from './reports';

const LABELS: PlaceLabel[] = ['home', 'hostel', 'shop', 'work', 'other'];
const ALERT_KEYS: Array<keyof AlertPrefs> = ['email', 'sms', 'push', 'whatsapp', 'forecasts', 'repairs', 'restored', 'quietHours'];

type UserRow = typeof users.$inferSelect;

export async function loadProfile(db: Db, user: UserRow): Promise<Profile & { role: string; trustScore: number }> {
  const [places, own, areaRows] = await Promise.all([
    db.select().from(savedPlaces).where(eq(savedPlaces.userId, user.id)).orderBy(desc(savedPlaces.isPrimary), asc(savedPlaces.createdAt)),
    db.select().from(areaCorrections).where(eq(areaCorrections.userId, user.id)).orderBy(desc(areaCorrections.createdAt)).limit(50),
    db.select({ id: areas.id, slug: areas.slug }).from(areas),
  ]);
  const slug = new Map(areaRows.map((a) => [a.id, a.slug]));
  const mapped: SavedPlace[] = places.map((p) => ({
    id: p.id,
    label: p.label,
    customName: p.customName ?? undefined,
    lat: p.latitude,
    lng: p.longitude,
    areaId: (p.areaId && slug.get(p.areaId)) || '',
    directions: p.directions,
    plusCode: p.plusCode,
    meterNumber: p.meterNumber ?? undefined,
  }));
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    onboarded: Boolean(user.onboardedAt),
    places: mapped,
    primaryPlaceId: places.find((p) => p.isPrimary)?.id ?? places[0]?.id ?? null,
    alerts: { ...defaultAlerts, ...((user.alertPrefs as Partial<AlertPrefs> | null) ?? {}) },
    areaCorrections: own.map((c) => ({ lat: c.latitude, lng: c.longitude, areaId: slug.get(c.areaId) ?? '' })).filter((c) => c.areaId),
    role: user.role,
    trustScore: user.trustScore,
  };
}

export interface ProfilePatch {
  name?: string;
  phone?: string;
  alerts?: Partial<AlertPrefs>;
  onboarded?: boolean;
}

export async function updateProfile(db: Db, user: UserRow, patch: ProfilePatch) {
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2 || name.length > 120) throw new ReportError('invalid', 'Enter your name as people know you.', { field: 'name' });
    set.name = name;
  }
  if (patch.phone !== undefined) set.phone = patch.phone.trim().slice(0, 20) || null;
  if (patch.alerts) {
    const current = (user.alertPrefs as Record<string, boolean> | null) ?? {};
    const next = { ...current };
    for (const k of ALERT_KEYS) if (typeof patch.alerts[k] === 'boolean') next[k] = patch.alerts[k]!;
    set.alertPrefs = next;
  }
  if (patch.onboarded) {
    const [place] = await db.select({ id: savedPlaces.id }).from(savedPlaces).where(eq(savedPlaces.userId, user.id)).limit(1);
    if (!place) throw new ReportError('invalid', 'Save at least one place first.', { field: 'places' });
    set.onboardedAt = user.onboardedAt ?? new Date();
  }
  await db.update(users).set(set).where(eq(users.id, user.id));
}

export interface PlaceInput {
  label: PlaceLabel;
  customName?: string;
  lat: number;
  lng: number;
  /** GPS error in metres when the pin came from the phone. */
  accuracy?: number;
  /** Area the resident confirmed; otherwise we work it out. */
  areaSlug?: string;
  directions?: string;
  meterNumber?: string;
  primary?: boolean;
}

function checkPlace(p: PlaceInput) {
  const bad = (field: string, message: string) => new ReportError('invalid', message, { field });
  if (!LABELS.includes(p.label)) throw bad('label', 'Choose what kind of place this is.');
  if (p.label === 'other' && !p.customName?.trim()) throw bad('customName', 'Give this place a name.');
  const [w, s, e, n] = NSUKKA_BOUNDS;
  if (![p.lat, p.lng].every(Number.isFinite) || p.lng < w || p.lng > e || p.lat < s || p.lat > n) {
    throw new ReportError('outside_area', 'VoltIq only covers Nsukka for now.', { field: 'location' });
  }
  const meter = p.meterNumber?.replace(/\D/g, '');
  if (meter && (meter.length < 11 || meter.length > 13)) throw bad('meterNumber', 'Meter numbers are usually 11 or 13 digits.');
  if ((p.directions?.length ?? 0) > 300) throw bad('directions', 'Keep directions under 300 characters.');
  return meter || null;
}

async function areaIdFor(db: Db, p: PlaceInput, userId: string) {
  const slug = p.areaSlug || (await suggestAreas(db, p, p.accuracy ?? 0, userId)).areas[0]?.slug;
  const [row] = slug ? await db.select({ id: areas.id }).from(areas).where(eq(areas.slug, slug)) : [];
  return row?.id ?? null;
}

export async function createPlace(db: Db, user: UserRow, input: PlaceInput) {
  const meter = checkPlace(input);
  const count = await db.$count(savedPlaces, eq(savedPlaces.userId, user.id));
  if (count >= 10) throw new ReportError('invalid', 'You can save up to 10 places.');
  const primary = input.primary || count === 0;
  return db.transaction(async (tx) => {
    if (primary) await tx.update(savedPlaces).set({ isPrimary: false }).where(eq(savedPlaces.userId, user.id));
    const [row] = await tx
      .insert(savedPlaces)
      .values({
        userId: user.id,
        label: input.label,
        customName: input.label === 'other' ? input.customName!.trim().slice(0, 60) : null,
        latitude: input.lat,
        longitude: input.lng,
        accuracyM: input.accuracy ?? null,
        areaId: await areaIdFor(db, input, user.id),
        directions: input.directions?.trim() ?? '',
        plusCode: shortPlusCode(input.lat, input.lng),
        meterNumber: meter,
        isPrimary: primary,
      })
      .returning();
    return row.id;
  });
}

export async function updatePlace(db: Db, user: UserRow, id: string, input: PlaceInput) {
  const meter = checkPlace(input);
  return db.transaction(async (tx) => {
    if (input.primary) {
      await tx.update(savedPlaces).set({ isPrimary: false }).where(and(eq(savedPlaces.userId, user.id), ne(savedPlaces.id, id)));
    }
    const [row] = await tx
      .update(savedPlaces)
      .set({
        label: input.label,
        customName: input.label === 'other' ? input.customName!.trim().slice(0, 60) : null,
        latitude: input.lat,
        longitude: input.lng,
        accuracyM: input.accuracy ?? null,
        areaId: await areaIdFor(db, input, user.id),
        directions: input.directions?.trim() ?? '',
        plusCode: shortPlusCode(input.lat, input.lng),
        meterNumber: meter,
        ...(input.primary ? { isPrimary: true } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, user.id)))
      .returning({ id: savedPlaces.id });
    if (!row) throw new ReportError('not_found', 'Place not found.');
  });
}

export async function setPrimaryPlace(db: Db, user: UserRow, id: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: savedPlaces.id }).from(savedPlaces).where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, user.id)));
    if (!row) throw new ReportError('not_found', 'Place not found.');
    await tx.update(savedPlaces).set({ isPrimary: false }).where(eq(savedPlaces.userId, user.id));
    await tx.update(savedPlaces).set({ isPrimary: true }).where(eq(savedPlaces.id, id));
  });
}

export async function deletePlace(db: Db, user: UserRow, id: string) {
  await db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(savedPlaces)
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, user.id)))
      .returning({ isPrimary: savedPlaces.isPrimary });
    if (!gone) throw new ReportError('not_found', 'Place not found.');
    if (gone.isPrimary) {
      const [next] = await tx.select({ id: savedPlaces.id }).from(savedPlaces).where(eq(savedPlaces.userId, user.id)).orderBy(asc(savedPlaces.createdAt)).limit(1);
      if (next) await tx.update(savedPlaces).set({ isPrimary: true }).where(eq(savedPlaces.id, next.id));
    }
  });
}
