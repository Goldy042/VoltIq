import { getDb } from '@/lib/db/client';
import { reviewReport } from '@/server/reports';
import { errorResponse, readJson, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Managers and dispatchers accept a report or mark it false; the reporter's trust moves accordingly. */
export const POST = withUser<Ctx>(async (user, req, { params }) => {
  if (user.role !== 'manager' && user.role !== 'dispatcher') return errorResponse('forbidden', 'Only managers and dispatchers review reports.');
  const { decision } = await readJson<{ decision: unknown }>(req);
  if (decision !== 'accepted' && decision !== 'false_report') return errorResponse('invalid', 'decision must be accepted or false_report.');
  return Response.json(await reviewReport(getDb(), user.id, (await params).id, decision));
});
