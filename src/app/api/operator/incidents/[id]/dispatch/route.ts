import { getDb } from '@/lib/db/client';
import { dispatchTeam } from '@/server/operations';
import { errorResponse, readJson, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Send a team to an outage (managers and dispatchers). */
export const POST = withUser<Ctx>(
  async (user, req, { params }) => {
    const { teamId } = await readJson<{ teamId: unknown }>(req);
    if (typeof teamId !== 'string' || !teamId) return errorResponse('invalid', 'Choose a team.', { field: 'teamId' });
    return Response.json(await dispatchTeam(getDb(), user, (await params).id, teamId));
  },
  { staff: true },
);
