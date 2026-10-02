import { getDb } from '@/lib/db/client';
import { answerLightBack } from '@/server/reports';
import { errorResponse, readJson, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Body `{ back: true }` — light is back; `{ back: false }` — still off. */
export const POST = withUser<Ctx>(async (user, req, { params }) => {
  const { back } = await readJson<{ back: unknown }>(req);
  if (typeof back !== 'boolean') return errorResponse('invalid', '`back` must be true or false.');
  return Response.json(await answerLightBack(getDb(), user.id, (await params).id, back));
});
