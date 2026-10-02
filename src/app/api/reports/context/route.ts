import { getDb } from '@/lib/db/client';
import { getReportContext } from '@/server/reports';
import { errorResponse, withUser } from '@/server/http';

/** GET ?lat=&lng=&accuracy= → area suggestions, outages nearby, and your own open report here. */
export const GET = withUser(async (user, req) => {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse('invalid', 'lat and lng are required.');
  return Response.json(await getReportContext(getDb(), user.id, { lat, lng }, Number(q.get('accuracy')) || 0));
});
