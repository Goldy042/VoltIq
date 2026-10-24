import { getDb } from '@/lib/db/client';
import { answerCheck, listMyChecks } from '@/server/checks';
import { errorResponse, readJson, withUser } from '@/server/http';
import type { CheckAnswer } from '@/lib/checks';

/** Outages you've told us about in the last day, so the app doesn't ask twice. */
export const GET = withUser(async (user) => Response.json({ checks: await listMyChecks(getDb(), user.id) }));

/** Body `{ incidentId, answer: "on" | "off" }`: do you have light at your place near this outage? */
export const POST = withUser(async (user, req) => {
  const { incidentId, answer } = await readJson<{ incidentId: unknown; answer: unknown }>(req);
  if (typeof incidentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(incidentId)) return errorResponse('invalid', 'Which outage?');
  return Response.json(await answerCheck(getDb(), { userId: user.id, incidentId }, answer as CheckAnswer));
});
