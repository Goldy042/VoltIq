import { getDb } from '@/lib/db/client';
import { askNeighbours } from '@/server/checks';
import { errorResponse, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Ask residents around this outage "do you have light?" now, without waiting for the next automatic round. */
export const POST = withUser<Ctx>(async (user, _req, { params }) => {
  if (user.role !== 'manager' && user.role !== 'dispatcher') {
    return errorResponse('forbidden', 'Only managers and dispatchers can ask residents.');
  }
  return Response.json({ asked: await askNeighbours(getDb(), (await params).id, { force: true }) });
});
