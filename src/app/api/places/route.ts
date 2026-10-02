import { getDb } from '@/lib/db/client';
import { createPlace, type PlaceInput } from '@/server/profile';
import { readJson, withUser } from '@/server/http';

export const POST = withUser(async (user, req) => {
  const id = await createPlace(getDb(), user, await readJson<PlaceInput>(req));
  return Response.json({ id }, { status: 201 });
});
