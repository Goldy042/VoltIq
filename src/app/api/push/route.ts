import { getDb } from '@/lib/db/client';
import { removePushSubscription, savePushSubscription } from '@/server/notifications';
import { errorResponse, readJson, withUser } from '@/server/http';

interface Body {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/** Register this browser for app notifications (a PushSubscription as JSON). */
export const POST = withUser(async (user, req) => {
  const { endpoint, keys } = await readJson<Body>(req);
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
    return errorResponse('invalid', 'That notification subscription isn’t valid. Try turning notifications on again.');
  }
  await savePushSubscription(getDb(), user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
  return Response.json({ ok: true });
});

/** Stop app notifications on this browser. */
export const DELETE = withUser(async (user, req) => {
  const { endpoint } = await readJson<Body>(req);
  if (typeof endpoint === 'string') await removePushSubscription(getDb(), user.id, endpoint);
  return Response.json({ ok: true });
});
