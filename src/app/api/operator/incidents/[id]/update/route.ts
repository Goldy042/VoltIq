import { getDb } from '@/lib/db/client';
import { updateIncidentInfo, type IncidentUpdate } from '@/server/incidents';
import { errorResponse, readJson, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Managers and dispatchers tell residents the expected fix time, the cause, and a public update. */
export const POST = withUser<Ctx>(async (user, req, { params }) => {
  if (user.role !== 'manager' && user.role !== 'dispatcher') {
    return errorResponse('forbidden', 'Only managers and dispatchers can post outage updates.');
  }
  const body = await readJson<IncidentUpdate>(req);
  const input: IncidentUpdate = {};
  if (body.etaAt === null || typeof body.etaAt === 'string') input.etaAt = body.etaAt;
  if (body.cause === null || typeof body.cause === 'string') input.cause = body.cause;
  if (typeof body.publicNote === 'string') input.publicNote = body.publicNote;
  return Response.json(await updateIncidentInfo(getDb(), (await params).id, input));
});
