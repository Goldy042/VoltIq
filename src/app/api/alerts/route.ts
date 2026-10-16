import { getDb } from '@/lib/db/client';
import { listAlerts, markAlertsRead } from '@/server/notifications';
import { readJson, withUser } from '@/server/http';

/** The signed-in resident's alerts inbox, newest first. */
export const GET = withUser(async (user) =>
  Response.json(await listAlerts(getDb(), user.id), { headers: { 'Cache-Control': 'no-store' } }),
);

/** Mark alerts read: `{ ids }` for some, `{}` for all. */
export const POST = withUser(async (user, req) => {
  const { ids } = await readJson<{ ids?: unknown }>(req).catch(() => ({ ids: undefined }));
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : undefined;
  await markAlertsRead(getDb(), user.id, list);
  return Response.json({ ok: true });
});
