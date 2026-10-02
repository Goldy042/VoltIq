import { getDb } from '@/lib/db/client';
import { loadProfile, updateProfile, type ProfilePatch } from '@/server/profile';
import { readJson, withUser } from '@/server/http';

export const GET = withUser(async (user) => Response.json(await loadProfile(getDb(), user)));

export const PATCH = withUser(async (user, req) => {
  await updateProfile(getDb(), user, await readJson<ProfilePatch>(req));
  return Response.json({ ok: true });
});
