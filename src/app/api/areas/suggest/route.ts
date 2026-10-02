import { getDb } from '@/lib/db/client';
import { suggestAreas } from '@/server/reports';
import { errorResponse, withUser } from '@/server/http';

/** GET ?lat=&lng=&accuracy= → best area first, plus others the person could be in. */
export const GET = withUser(async (user, req) => {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse('invalid', 'lat and lng are required.');
  return Response.json(await suggestAreas(getDb(), { lat, lng }, Number(q.get('accuracy')) || 0, user.id));
});
