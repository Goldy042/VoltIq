import { getDb } from '@/lib/db/client';
import { recordAreaCorrection } from '@/server/reports';
import { readJson, withUser } from '@/server/http';

interface Body {
  lat: number;
  lng: number;
  accuracy?: number;
  areaSlug: string;
  guessedSlug?: string;
}

/** "I'm in Hilltop, not Odim Gate." */
export const POST = withUser(async (user, req) => {
  const b = await readJson<Body>(req);
  await recordAreaCorrection(getDb(), user.id, { lat: b.lat, lng: b.lng, accuracy: b.accuracy }, b.areaSlug, b.guessedSlug);
  return Response.json({ ok: true }, { status: 201 });
});
