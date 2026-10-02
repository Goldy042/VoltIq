/**
 * Getting a usable position on a phone.
 *
 * getCurrentPosition() returns the first fix the phone has — often a Wi‑Fi or
 * cell-tower guess hundreds of metres off, which in Nsukka is the difference
 * between Hilltop and Odim Gate. Instead we watch the position for a few
 * seconds while GPS warms up and keep the most accurate fix.
 */

import { NSUKKA_BOUNDS } from '@/data/nsukka';

export interface Fix {
  lat: number;
  lng: number;
  /** 68% confidence radius in metres, as reported by the device. */
  accuracy: number;
}

export type LocateError = 'unsupported' | 'denied' | 'unavailable' | 'outside';

export const locateErrorText: Record<LocateError, string> = {
  unsupported: 'This browser can’t share its location. Search a landmark instead.',
  denied: 'Location is turned off for this site. Allow it in your browser settings, or search a landmark.',
  unavailable: 'Couldn’t get a GPS fix. Step outside or near a window and try again, or search a landmark.',
  outside: 'You seem to be outside Nsukka. Search a landmark near the place instead.',
};

/** Above this the fix is a network guess, not GPS. */
export const ROUGH_FIX_METERS = 100;

interface Options {
  /** Called whenever a more accurate fix arrives. */
  onFix?: (fix: Fix) => void;
  onDone: (best: Fix) => void;
  onError: (error: LocateError) => void;
  /** Stop as soon as a fix is at least this good. */
  goodEnough?: number;
  /** Give up waiting for a better fix after this long. */
  maxWaitMs?: number;
}

const insideNsukka = ({ lat, lng }: Fix) => {
  const [w, s, e, n] = NSUKKA_BOUNDS;
  return lng > w && lng < e && lat > s && lat < n;
};

/** Watch for the best fix within `maxWaitMs`. Returns a cancel function. */
export function locateBest({ onFix, onDone, onError, goodEnough = 25, maxWaitMs = 12000 }: Options) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('unsupported');
    return () => {};
  }

  let best: Fix | null = null;
  let finished = false;
  let watchId: number | null = null;
  let timer: number | undefined;

  const finish = (result: Fix | LocateError) => {
    if (finished) return;
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    window.clearTimeout(timer);
    if (typeof result === 'string') onError(result);
    else if (!insideNsukka(result)) onError('outside');
    else onDone(result);
  };

  watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      const fix = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy };
      if (best && fix.accuracy >= best.accuracy) return;
      best = fix;
      if (insideNsukka(fix)) onFix?.(fix);
      if (fix.accuracy <= goodEnough) finish(fix);
    },
    (err) => {
      // A timeout or flaky fix while we already have something is fine — use it.
      if (best) return finish(best);
      finish(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
    },
    // maximumAge 0: never reuse a cached fix from wherever the phone was earlier.
    { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
  );

  timer = window.setTimeout(() => finish(best ?? 'unavailable'), maxWaitMs);

  return () => {
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    window.clearTimeout(timer);
  };
}
