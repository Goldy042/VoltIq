import { getDb } from '@/lib/db/client';
import { listLiveFeed } from '@/server/incidents';
import { errorResponse } from '@/server/http';
import { getCurrentUser, isStaff } from '@/server/users';

/**
 * The live outage map. Public, like the /map page: anyone can see where the
 * light is out. Signed-in EEDC staff also get residents' notes.
 */
export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    const feed = await listLiveFeed(getDb(), { staff: Boolean(user && isStaff(user)) });
    return Response.json(feed, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return errorResponse('server_error', 'Couldn’t load the live map. Try again.');
  }
}
