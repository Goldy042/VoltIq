'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import type * as GeoJSON from 'geojson';
import '@/components/map/setup';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CheckIcon, TruckIcon } from 'lucide-react';
import { IssueIcon } from '@/components/ui/Badges';
import { loadBuildings, quickMeters } from '@/components/map/buildings';
import { NSUKKA_BOUNDS, type Incident, type ReportDot } from '@/data/nsukka';

type Glow = 'on' | 'off' | 'low' | 'flicker';
const GLOWS: Glow[] = ['on', 'off', 'low', 'flicker'];

const LOOK: Record<Glow, { heat: number; color: string; opacity: number }> = {
  on: { heat: 0.85, color: '#ffd479', opacity: 0.95 },
  low: { heat: 0.35, color: '#d9822b', opacity: 0.8 },
  flicker: { heat: 0.55, color: '#ffb347', opacity: 0.9 },
  off: { heat: 0, color: '#34353b', opacity: 0.6 },
};

const glowFor = (i: Incident): Glow =>
  i.status === 'restored' ? 'on' : i.issue === 'no_power' ? 'off' : i.issue === 'low_voltage' ? 'low' : 'flicker';

const DOT_COLOR = { no_power: '#ff4d50', low_voltage: '#ff9a3d', fluctuating: '#ff9a3d' };

interface StreetGlowProps {
  home: { lat: number; lng: number };
  incidents: Incident[];
  dots: ReportDot[];
  /** Map space hidden behind overlaid content, in px. */
  padding: { top?: number; bottom?: number; left?: number; right?: number };
  reducedMotion: boolean;
  /** Starting zoom; lower shows more of town. */
  zoom?: number;
  /** Show the white "You" marker at home. */
  showHome?: boolean;
  /** How far from home to light buildings, in metres. */
  reach?: number;
  /** Name tags over affected areas. */
  labels?: boolean;
}

/**
 * The citizen's neighbourhood at night: every real building lit, dark or
 * flickering according to the live incidents around it.
 */
export function StreetGlow({ home, incidents, dots, padding, reducedMotion, zoom = 14.9, showHome = true, reach = 2800, labels = true }: StreetGlowProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [beforeId, setBeforeId] = useState<string>();
  const [flat, setFlat] = useState<number[] | null>(null);

  useEffect(() => {
    loadBuildings().then(setFlat).catch(() => {});
  }, []);

  // Only the incidents near home shape the glow; their state is live.
  const nearby = useMemo(
    () => incidents.filter((i) => quickMeters(i.lng, i.lat, home.lng, home.lat) < reach - 200),
    [incidents, home, reach],
  );
  const glowKey = nearby.map((i) => `${i.id}:${glowFor(i)}`).join('|');

  const buildings = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!flat) return null;
    const features: GeoJSON.Feature[] = [];
    for (let k = 0; k < flat.length; k += 2) {
      const [lng, lat] = [flat[k], flat[k + 1]];
      if (quickMeters(lng, lat, home.lng, home.lat) > reach) continue;
      let g: Glow = 'on';
      for (const i of nearby) {
        if (quickMeters(lng, lat, i.lng, i.lat) < i.radius * 1.5) {
          g = glowFor(i);
          break;
        }
      }
      features.push({ type: 'Feature', properties: { g }, geometry: { type: 'Point', coordinates: [lng, lat] } });
    }
    return { type: 'FeatureCollection', features };
    // glowKey captures every change that matters in `nearby`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, glowKey, home, reach]);

  const dotData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: dots
        .filter((d) => nearby.some((i) => i.id === d.incidentId && i.status !== 'restored'))
        .map((d) => ({
          type: 'Feature' as const,
          properties: { color: DOT_COLOR[d.issue] },
          geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
        })),
    }),
    [dots, nearby],
  );

  // Frame home once the map knows its real size.
  useEffect(() => {
    if (!loaded) return;
    mapRef.current?.jumpTo({ center: [home.lng, home.lat], padding: { top: 0, bottom: 0, left: 0, right: 0, ...padding } });
  }, [loaded, home, padding]);

  // The town turns slowly so the hero never looks frozen.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded || reducedMotion) return;
    let raf = 0;
    let last = 0;
    const spin = (t: number) => {
      if (last) map.setBearing(map.getBearing() + (t - last) * 0.0015);
      last = t;
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, [loaded, reducedMotion]);

  // Unstable supply flickers, irregularly, like the real thing.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded || !buildings || reducedMotion) return;
    let timer = 0;
    const flick = () => {
      const level = Math.random();
      if (map.getLayer('glow-flicker')) {
        map.setPaintProperty('glow-flicker', 'heatmap-opacity', 0.1 + level * 0.55);
        map.setPaintProperty('win-flicker', 'circle-opacity', 0.3 + level * 0.65);
      }
      timer = window.setTimeout(flick, 80 + Math.random() * 420);
    };
    flick();
    return () => window.clearTimeout(timer);
  }, [loaded, buildings, reducedMotion]);

  const callouts = !labels ? [] : nearby.filter((i) => i.status !== 'restored' || quickMeters(i.lng, i.lat, home.lng, home.lat) < 1200);

  return (
    <Map
      ref={mapRef}
      mapStyle="https://tiles.openfreemap.org/styles/dark"
      initialViewState={{ longitude: home.lng, latitude: home.lat, zoom, pitch: 52, bearing: -18 }}
      maxBounds={NSUKKA_BOUNDS}
      interactive={false}
      attributionControl={false}
      onLoad={(e) => {
        setBeforeId(e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id);
        setLoaded(true);
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <AttributionControl compact position="top-right" />

      {loaded && buildings && (
        <Source id="homes" type="geojson" data={buildings}>
          {GLOWS.map((g) => (
            <Layer
              key={`glow-${g}`}
              id={`glow-${g}`}
              type="heatmap"
              beforeId={beforeId}
              filter={['==', ['get', 'g'], g]}
              paint={{
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 1.4],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 15, 14, 17, 26],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,0,0)',
                  0.15, 'rgba(255,140,30,0.22)',
                  0.4, 'rgba(255,175,60,0.5)',
                  0.7, 'rgba(255,208,120,0.78)',
                  1, 'rgba(255,240,205,0.95)',
                ],
                'heatmap-opacity': LOOK[g].heat,
                'heatmap-opacity-transition': { duration: g === 'flicker' ? 120 : 1200, delay: 0 },
              }}
            />
          ))}
          {GLOWS.map((g) => (
            <Layer
              key={`win-${g}`}
              id={`win-${g}`}
              type="circle"
              beforeId={beforeId}
              filter={['==', ['get', 'g'], g]}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.5, 0.8, 15, 1.6, 17, 3.2],
                'circle-color': LOOK[g].color,
                'circle-opacity': LOOK[g].opacity,
                'circle-opacity-transition': { duration: g === 'flicker' ? 120 : 1200, delay: 0 },
                'circle-blur': 0.4,
              }}
            />
          ))}
        </Source>
      )}

      {loaded && (
        <Source id="reports" type="geojson" data={dotData}>
          <Layer
            id="report-dots"
            type="circle"
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3, 16, 5],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.25,
            }}
          />
        </Source>
      )}

      {callouts.map((i) => (
        <Marker key={i.id} longitude={i.lng} latitude={i.lat} anchor="bottom">
          <span className="flex flex-col items-center">
            <span
              className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-body text-xs font-semibold text-white"
              style={{ backgroundColor: i.status === 'restored' ? '#12945a' : DOT_COLOR[i.issue] }}
            >
              {i.status === 'restored' ? (
                <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              ) : (
                <IssueIcon issue={i.issue} className="h-3.5 w-3.5" />
              )}
              {i.area}
              {i.status === 'crew_dispatched' && <TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>
            <span
              className="-mt-1 h-2 w-2 rotate-45 rounded-[2px]"
              style={{ backgroundColor: i.status === 'restored' ? '#12945a' : DOT_COLOR[i.issue] }}
              aria-hidden="true"
            />
          </span>
        </Marker>
      ))}

      {showHome && (
      <Marker longitude={home.lng} latitude={home.lat} anchor="center" style={{ zIndex: 10 }}>
        <span className="relative flex items-center gap-2">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-white" aria-hidden="true" />
            <span className="relative h-3.5 w-3.5 rounded-full border-[3px] border-[#0b0b0d] bg-white" />
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[11px] font-bold text-[#111113]">You</span>
        </span>
      </Marker>
      )}
    </Map>
  );
}
