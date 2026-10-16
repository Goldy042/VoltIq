import { getDb } from '@/lib/db/client';
import { setIncidentStatus } from '@/server/incidents';
import { errorResponse, readJson, withUser } from '@/server/http';
import type { IncidentStatus } from '@/data/nsukka';

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: IncidentStatus[] = ['reported', 'confirmed', 'crew_dispatched', 'restored'];

/** Managers and dispatchers confirm, dispatch, restore or reopen an outage. */
export const POST = withUser<Ctx>(async (user, req, { params }) => {
  if (user.role !== 'manager' && user.role !== 'dispatcher') {
    return errorResponse('forbidden', 'Only managers and dispatchers can change an outage’s status.');
  }
  const { status } = await readJson<{ status: unknown }>(req);
  if (!STATUSES.includes(status as IncidentStatus)) {
    return errorResponse('invalid', 'status must be reported, confirmed, crew_dispatched or restored.', { field: 'status' });
  }
  return Response.json(await setIncidentStatus(getDb(), (await params).id, status as IncidentStatus));
});
