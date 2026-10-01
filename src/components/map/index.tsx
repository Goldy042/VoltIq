'use client';

import dynamic from 'next/dynamic';
import { MapPinnedIcon } from 'lucide-react';

/** Placeholder while MapLibre and the first tiles load. */
export function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-sunken">
      <span className="flex animate-pulse items-center gap-2 font-body text-sm text-ink-faint">
        <MapPinnedIcon className="h-4 w-4" aria-hidden="true" />
        Loading Nsukka map…
      </span>
    </div>
  );
}

// MapLibre needs the DOM and WebGL, so it never renders on the server.
export const MapCanvas = dynamic(() => import('./MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export const LocationPicker = dynamic(() => import('./LocationPicker').then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export type { MapCanvasProps, FlyTarget } from './MapCanvas';
