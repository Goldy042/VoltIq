import { getDb } from '@/lib/db/client';
import { answerCheck } from '@/server/checks';
import { ReportError } from '@/server/reports';
import { errorResponse } from '@/server/http';
import type { CheckAnswer } from '@/lib/checks';

/**
 * The Yes / No buttons on a "Do you have light?" notification. The service
 * worker may not have a session, so the per-question token proves who it is.
 * Body `{ id, token, answer }`.
 */
export async function POST(req: Request) {
  try {
    const { id, token, answer } = (await req.json()) as { id?: unknown; token?: unknown; answer?: unknown };
    if (typeof id !== 'string' || typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
      return errorResponse('invalid', 'This question link is broken.');
    }
    return Response.json(await answerCheck(getDb(), { checkId: id, token }, answer as CheckAnswer));
  } catch (e) {
    if (e instanceof ReportError) return errorResponse(e.code, e.message, e.extra);
    if (e instanceof SyntaxError) return errorResponse('invalid', 'Malformed request.');
    console.error(e);
    return errorResponse('server_error', 'Something went wrong. Try again.');
  }
}
