'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AlertItem } from '@/lib/alerts';
import { alerts as demoAlerts } from '@/data/nsukka';
import { api } from '@/lib/api';

const POLL_MS = 60_000;

const demo: AlertItem[] = demoAlerts.map((a, i) => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  body: a.body,
  sentAt: new Date(Date.now() - [12, 60, 60 * 24 * 30][i % 3] * 60_000).toISOString(),
  unread: a.unread,
  incidentId: null,
}));

/**
 * The alerts inbox. Signed in: from /api/alerts, refreshed every minute while
 * the tab is visible. Visitors see the demo inbox.
 */
export function useAlerts(signedIn: boolean) {
  const [alerts, setAlerts] = useState<AlertItem[]>(signedIn ? [] : demo);
  const [unread, setUnread] = useState(signedIn ? 0 : demo.filter((a) => a.unread).length);
  const [loaded, setLoaded] = useState(!signedIn);

  const load = useCallback(async () => {
    try {
      const data = await api<{ alerts: AlertItem[]; unread: number }>('/api/alerts');
      setAlerts(data.alerts);
      setUnread(data.unread);
    } catch {
      /* keep what we have; try again next tick */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let timer = 0;
    const tick = async () => {
      if (!document.hidden) await load();
      timer = window.setTimeout(tick, POLL_MS);
    };
    tick();
    const onShow = () => !document.hidden && void load();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [signedIn, load]);

  /** Opening the inbox reads everything in it. */
  const markAllRead = useCallback(() => {
    if (!unread) return;
    setUnread(0);
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })));
    if (signedIn) void api('/api/alerts', { body: {} }).catch(() => load());
  }, [unread, signedIn, load]);

  return { alerts, unread, loaded, markAllRead, refresh: load };
}
