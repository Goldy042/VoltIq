'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiFailure } from '@/lib/api';

export type PushState =
  /** Checking what this browser supports. */
  | 'loading'
  /** No service worker / Push API, or no server key configured. */
  | 'unsupported'
  /** iPhone/iPad in Safari: only works after "Add to Home Screen". */
  | 'needs_install'
  /** The person blocked notifications in browser settings. */
  | 'blocked'
  | 'off'
  | 'on';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIosBrowser() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !window.matchMedia('(display-mode: standalone)').matches;
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

/**
 * App notifications on this device: registers /sw.js, and turning on asks the
 * browser for permission and saves the subscription on the server.
 */
export function usePush() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) return setState(isIosBrowser() ? 'needs_install' : 'unsupported');
      if (!KEY) return setState('unsupported');
      try {
        const reg = await registerServiceWorker();
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (Notification.permission === 'denied') setState('blocked');
        else setState(sub ? 'on' : 'off');
        // Keep the server's copy current (it may have been pruned or belong to someone else).
        if (sub) void api('/api/push', { body: sub.toJSON() }).catch(() => {});
      } catch {
        if (!cancelled) setState('unsupported');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Resolves to the new state; throws ApiFailure if the server refused. */
  const enable = useCallback(async (): Promise<PushState> => {
    if (!KEY) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      const next = permission === 'denied' ? 'blocked' : 'off';
      setState(next);
      return next;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
    try {
      await api('/api/push', { body: sub.toJSON() });
    } catch (e) {
      await sub.unsubscribe();
      setState('off');
      throw e instanceof ApiFailure ? e : new ApiFailure('server_error', 'Couldn’t turn on notifications. Try again.');
    }
    setState('on');
    return 'on';
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('off');
  }, []);

  return { state, enable, disable };
}
