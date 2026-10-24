import { getDb } from '@/lib/db/client';
import { getOutageDetail } from '@/server/incidents';
import { errorResponse } from '@/server/http';
import { canUseOperator, getCurrentUser } from '@/server/users';

type Ctx = { params: Promise<{ id: string }> };

/**
 * One outage's page data. Public like the map; `?view=staff` adds every report
 * and all teams for signed-in operators.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const wantsStaff = new URL(req.url).searchParams.get('view') === 'staff';
    const user = wantsStaff ? await getCurrentUser().catch(() => null) : null;
    if (wantsStaff && !(user && canUseOperator(user))) return errorResponse('forbidden', 'Only EEDC staff can see this view.');
    const detail = await getOutageDetail(getDb(), (await params).id, { staff: wantsStaff });
    if (!detail) return errorResponse('not_found', 'That outage isn’t on the map.');
    return Response.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return errorResponse('server_error', 'Couldn’t load this outage. Try again.');
  }
}
