import { getDb } from '@/lib/db/client';
import { deletePlace, setPrimaryPlace, updatePlace, type PlaceInput } from '@/server/profile';
import { readJson, withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Full update, or `{ primary: true }` alone to make it the default place. */
export const PATCH = withUser<Ctx>(async (user, req, { params }) => {
  const { id } = await params;
  const body = await readJson<Partial<PlaceInput>>(req);
  if (Object.keys(body).length === 1 && body.primary) await setPrimaryPlace(getDb(), user, id);
  else await updatePlace(getDb(), user, id, body as PlaceInput);
  return Response.json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _req, { params }) => {
  await deletePlace(getDb(), user, (await params).id);
  return Response.json({ ok: true });
});
