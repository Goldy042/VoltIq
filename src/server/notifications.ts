/**
 * Telling residents about outage news: an inbox row for everyone who wants
 * it, and a push to their phones when they've allowed app notifications.
 * Email and SMS come later; nothing here costs per message.
 */

import webpush from 'web-push';
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { incidents, notifications, outageReports, pushSubscriptions, savedPlaces, users } from '@/lib/db/schema';
import { describeLocation } from '@/lib/address';
import { distanceMeters } from '@/lib/geo';
import { cellOf, distanceToCells } from '@/lib/footprint';
import {
  ALERT_MARGIN_M,
  ALERT_REPEAT_MS,
  UPDATE_REPEAT_MS,
  alertCopy,
  kindOf,
  prefsOf,
  shouldPush,
  wantsEvent,
  type AlertEvent,
  type AlertItem,
} from '@/lib/alerts';

const TYPE: Record<AlertEvent, 'status_update' | 'resolved'> = {
  update: 'status_update',
  confirmed: 'status_update',
  crew_dispatched: 'status_update',
  restored: 'resolved',
};

/** Degrees that comfortably cover any outage radius, to narrow the saved-places query. */
const BOX_DEG = 0.03;

/**
 * Tell reporters and residents with a saved place inside the outage. Never
 * throws: a failed alert must not undo the status change that caused it.
 */
export async function notifyIncident(db: Db, incidentId: string, event: AlertEvent, now = new Date()) {
  try {
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!inc) return 0;

    const [reporters, nearby] = await Promise.all([
      db
        .select({ userId: outageReports.userId, lat: outageReports.latitude, lng: outageReports.longitude })
        .from(outageReports)
        .where(and(eq(outageReports.incidentId, incidentId), eq(outageReports.flagged, false), ne(outageReports.status, 'false_report'))),
      db
        .select({ userId: savedPlaces.userId, lat: savedPlaces.latitude, lng: savedPlaces.longitude })
        .from(savedPlaces)
        .where(
          and(
            sql`${savedPlaces.latitude} between ${inc.centerLat - BOX_DEG} and ${inc.centerLat + BOX_DEG}`,
            sql`${savedPlaces.longitude} between ${inc.centerLng - BOX_DEG} and ${inc.centerLng + BOX_DEG}`,
          ),
        ),
    ]);
    const centre = { lat: inc.centerLat, lng: inc.centerLng };
    const ids = new Set(reporters.map((r) => r.userId));
    // Homes near the blocks people reported from, not everyone in a circle around the centre.
    const cells = reporters.map((r) => cellOf(r));
    const inside = (p: { lat: number; lng: number }) =>
      cells.length ? distanceToCells(p, cells) <= ALERT_MARGIN_M : distanceMeters(centre, p) <= inc.radiusM + ALERT_MARGIN_M;
    for (const p of nearby) if (inside(p)) ids.add(p.userId);
    if (!ids.size) return 0;

    // Skip anyone already told this news recently.
    const told = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          eq(notifications.incidentId, incidentId),
          eq(notifications.type, TYPE[event]),
          gte(notifications.sentAt, new Date(now.getTime() - (event === 'update' ? UPDATE_REPEAT_MS : ALERT_REPEAT_MS))),
        ),
      );
    for (const t of told) ids.delete(t.userId);
    if (!ids.size) return 0;

    const people = await db.select({ id: users.id, prefs: users.alertPrefs }).from(users).where(inArray(users.id, [...ids]));
    const wanting = people.map((p) => ({ id: p.id, prefs: prefsOf(p.prefs) })).filter((p) => wantsEvent(p.prefs, event));
    if (!wanting.length) return 0;

    const { title, body } = alertCopy(event, describeLocation(centre).summary, { restoredBy: inc.restoredBy, etaAt: inc.etaAt, note: inc.publicNote });
    await db.insert(notifications).values(
      wanting.map((p) => ({ userId: p.id, type: TYPE[event], incidentId, title, message: body, sentAt: now })),
    );

    const pushTo = wanting.filter((p) => shouldPush(p.prefs, event, now)).map((p) => p.id);
    await sendPush(db, pushTo, { title, body, url: `/outages/${incidentId}`, tag: `incident-${incidentId}` });
    return wanting.length;
  } catch (e) {
    console.error('notifyIncident failed', e);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Web Push                                                            */
/* ------------------------------------------------------------------ */

let vapidReady: boolean | null = null;

function pushConfigured() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = Boolean(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:alerts@voltiq.ng', pub!, priv!);
  return vapidReady;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** "Do you have light?" — the service worker shows Yes / No buttons that answer with this token. */
  check?: { id: string; token: string };
}

/** Push to every device these people registered; forget devices the browser has revoked. */
export async function sendPush(db: Db, userIds: string[], payload: PushPayload) {
  if (!userIds.length || !pushConfigured()) return;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: 'high' },
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error('push failed', code ?? e);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
}

export async function savePushSubscription(db: Db, userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
}

export async function removePushSubscription(db: Db, userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export async function listAlerts(db: Db, userId: string, limit = 30): Promise<{ alerts: AlertItem[]; unread: number }> {
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.sentAt)).limit(limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return {
    alerts: rows.map((r) => ({
      id: r.id,
      kind: kindOf(r.type),
      title: r.title || r.message,
      body: r.title ? r.message : '',
      sentAt: r.sentAt.toISOString(),
      unread: !r.readAt,
      incidentId: r.incidentId,
    })),
    unread: n,
  };
}

/** Mark everything (or just these) as read. */
export async function markAlertsRead(db: Db, userId: string, ids?: string[], now = new Date()) {
  const mine = and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(ids?.length ? and(mine, inArray(notifications.id, ids)) : mine);
}
