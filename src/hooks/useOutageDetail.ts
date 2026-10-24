'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { OutageDetail } from '@/lib/incidents';

const POLL_MS = 15_000;

/**
 * One outage, starting from what the server rendered and refreshed every 15 s
 * while the tab is visible (same pace as the map).
 */
export function useOutageDetail(initial: OutageDetail, opts: { staff?: boolean } = {}) {
  const [detail, setDetail] = useState(initial);
  const [offline, setOffline] = useState(false);
  const id = initial.incident.id;

  const refresh = useCallback(async () => {
    try {
      setDetail(await api<OutageDetail>(`/api/incidents/${id}${opts.staff ? '?view=staff' : ''}`));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [id, opts.staff]);

  useEffect(() => {
    let timer = 0;
    const tick = async () => {
      if (!document.hidden) await refresh();
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    const wake = () => !document.hidden && void refresh();
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [refresh]);

  return { detail, offline, refresh };
}
