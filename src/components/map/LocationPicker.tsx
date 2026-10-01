'use client';

import React, { useEffect, useRef, useState } from 'react';
import Map, { AttributionControl, type MapRef } from 'react-map-gl/maplibre';
import { motion } from 'framer-motion';
import './setup';
import 'maplibre-gl/dist/maplibre-gl.css';
import { NSUKKA_BOUNDS } from '@/data/nsukka';

interface LocationPickerProps {
  value: { lat: number; lng: number };
  onChange: (pos: { lat: number; lng: number }) => void;
  /** Bump to recentre the map on `value` (e.g. after "use my location"). */
  recenterKey?: number;
  color?: string;
}

/** Drag the map under a fixed centre pin — easier than dragging a tiny marker on a phone. */
export function LocationPicker({ value, onChange, recenterKey, color = 'var(--ink)' }: LocationPickerProps) {
  const mapRef = useRef<MapRef>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!recenterKey) return;
    mapRef.current?.flyTo({ center: [value.lng, value.lat], zoom: 17, duration: 1000 });
    // only re-fly on explicit recentre requests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        initialViewState={{ longitude: value.lng, latitude: value.lat, zoom: 16.5 }}
        maxBounds={NSUKKA_BOUNDS}
        minZoom={13}
        maxZoom={19}
        attributionControl={false}
        dragRotate={false}
        onMoveStart={() => setMoving(true)}
        onMoveEnd={(e) => {
          setMoving(false);
          const c = e.target.getCenter();
          onChange({ lat: c.lat, lng: c.lng });
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-left" />
      </Map>

      {/* Fixed centre pin lifts while the map moves */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <motion.div
          animate={{ y: moving ? -10 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
          className="flex flex-col items-center"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white shadow-pin"
            style={{ backgroundColor: color }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="h-4 w-[3px] rounded-b-full" style={{ backgroundColor: color }} />
        </motion.div>
        <motion.span
          animate={{ scale: moving ? 0.6 : 1, opacity: moving ? 0.25 : 0.4 }}
          className="mx-auto -mt-1 block h-1.5 w-4 rounded-full bg-black"
        />
      </div>
    </div>
  );
}
