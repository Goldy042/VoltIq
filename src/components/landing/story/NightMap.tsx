'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, SparklesIcon, TruckIcon, ZapIcon, ZapOffIcon } from 'lucide-react';
import '@/components/map/setup';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as GeoJSON from 'geojson';
import { NSUKKA_BOUNDS, incidents, reportDotsFor, substations } from '@/data/nsukka';
import { circleRing } from '@/lib/geo';
import { loadBuildings, quickMeters } from '@/components/map/buildings';
import { crewRoute, steps, storyAreas, type LightState } from './steps';

type Group = 'rest' | keyof typeof storyAreas;
const GROUPS: Group[] = ['rest', 'odenigwe', 'onuiyi', 'odim'];

const LIGHT = {
  on: { heat: 0.9, color: '#ffd479', opacity: 0.95 },
  low: { heat: 0.38, color: '#d9822b', opacity: 0.8 },
  off: { heat: 0, color: '#34353b', opacity: 0.6 },
} satisfies Record<LightState, { heat: number; color: string; opacity: number }>;

const SUBSTATION = substations[0];

interface NightMapProps {
  step: number;
  /** How many Odenigwe reports are on the map (animated by the story). */
  reportCount: number;
  /** Area picked in the hero search. */
  focus: { lng: number; lat: number; name: string } | null;
  compact: boolean;
  reducedMotion: boolean;
}

const meters = quickMeters;

function routeLengths() {
  const cum = [0];
  for (let i = 1; i < crewRoute.length; i++) {
    const [a, b] = [crewRoute[i - 1], crewRoute[i]];
    cum.push(cum[i - 1] + meters(b[0], b[1], a[0], a[1]));
  }
  return cum;
}

/** Position and the travelled part of the route at progress t (0–1). */
function alongRoute(t: number, cum: number[]) {
  const target = t * cum[cum.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const [a, b] = [crewRoute[i - 1], crewRoute[i]];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = Math.min(1, Math.max(0, (target - cum[i - 1]) / seg));
  const pos: [number, number] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return { pos, travelled: [...crewRoute.slice(0, i), pos] };
}

export function NightMap({ step, reportCount, focus, compact, reducedMotion }: NightMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [beforeId, setBeforeId] = useState<string | undefined>();
  const [buildings, setBuildings] = useState<GeoJSON.FeatureCollection | null>(null);
  const [truckT, setTruckT] = useState(0);
  const scene = steps[step];
  const cum = useMemo(routeLengths, []);

  // Real building centroids from OpenStreetMap, tagged by which story area they sit in.
  useEffect(() => {
    let cancelled = false;
    loadBuildings()
      .then((flat) => {
        if (cancelled) return;
        const features: GeoJSON.Feature[] = [];
        for (let i = 0; i < flat.length; i += 2) {
          const [lng, lat] = [flat[i], flat[i + 1]];
          let g: Group = 'rest';
          for (const key of ['odenigwe', 'onuiyi', 'odim'] as const) {
            const a = storyAreas[key];
            if (meters(lng, lat, a.lng, a.lat) < a.radius) {
              g = key;
              break;
            }
          }
          features.push({ type: 'Feature', properties: { g }, geometry: { type: 'Point', coordinates: [lng, lat] } });
        }
        setBuildings({ type: 'FeatureCollection', features });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const reportDots = useMemo<GeoJSON.FeatureCollection>(() => {
    const odenigwe = incidents.find((i) => i.id === 'inc-odenigwe')!;
    const onuiyi = incidents.find((i) => i.id === 'inc-onuiyi')!;
    const toFeatures = (dots: ReturnType<typeof reportDotsFor>, kind: string) =>
      dots.map((d, i) => ({
        type: 'Feature' as const,
        properties: { i, kind },
        geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
      }));
    return {
      type: 'FeatureCollection',
      features: [...toFeatures(reportDotsFor(odenigwe, 47), 'out'), ...toFeatures(reportDotsFor(onuiyi, 31), 'low')],
    };
  }, []);

  const forecastZone = useMemo<GeoJSON.Feature>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [circleRing(storyAreas.odim.lat, storyAreas.odim.lng, 640)] },
    }),
    [],
  );

  // Camera follows the story (or the hero search).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const target = focus && step === 0 ? { lng: focus.lng, lat: focus.lat, zoom: 15.2, pitch: 55, bearing: 0 } : scene.camera;
    const { innerWidth: w, innerHeight: h } = window;
    const padding = compact
      ? { top: step === 0 ? h * 0.42 : 70, bottom: step === 0 ? 0 : h * 0.4, left: 0, right: 0 }
      : { top: 0, bottom: 0, left: step === 0 ? w * 0.42 : 460, right: 0 };
    const options = {
      center: [target.lng, target.lat] as [number, number],
      zoom: target.zoom - (compact ? 0.6 : 0),
      pitch: target.pitch,
      bearing: target.bearing,
      padding,
    };
    if (reducedMotion) map.jumpTo(options);
    else map.flyTo({ ...options, duration: 2200, curve: 1.3, essential: true });
  }, [step, focus, loaded, compact, reducedMotion, scene.camera]);

  // Hero idle: the town slowly turns, so the page never feels frozen.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded || step !== 0 || focus || reducedMotion) return;
    let raf = 0;
    let last = 0;
    const startDelay = window.setTimeout(() => {
      const spin = (t: number) => {
        if (last && !map.isMoving()) map.setBearing(map.getBearing() + (t - last) * 0.0012);
        last = t;
        raf = requestAnimationFrame(spin);
      };
      raf = requestAnimationFrame(spin);
    }, 2400);
    return () => {
      window.clearTimeout(startDelay);
      cancelAnimationFrame(raf);
    };
  }, [step, focus, loaded, reducedMotion]);

  // Onuiyi flickers while the voltage is low.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded || scene.lights.onuiyi !== 'low' || reducedMotion) return;
    let timer = 0;
    const flick = () => {
      const level = Math.random();
      if (map.getLayer('glow-onuiyi')) {
        map.setPaintProperty('glow-onuiyi', 'heatmap-opacity', 0.12 + level * 0.4);
        map.setPaintProperty('win-onuiyi', 'circle-opacity', 0.35 + level * 0.55);
      }
      timer = window.setTimeout(flick, 70 + Math.random() * 380);
    };
    flick();
    return () => window.clearTimeout(timer);
  }, [scene.lights.onuiyi, loaded, reducedMotion]);

  // The crew drives the real road from the substation.
  useEffect(() => {
    if (scene.crew === 'hidden') return setTruckT(0);
    if (scene.crew === 'arrived' || reducedMotion) return setTruckT(1);
    let raf = 0;
    const start = performance.now();
    const duration = 7000;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setTruckT(p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene.crew, reducedMotion]);

  const truck = alongRoute(truckT, cum);
  const routeData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { part: 'all' }, geometry: { type: 'LineString', coordinates: crewRoute } },
        { type: 'Feature', properties: { part: 'done' }, geometry: { type: 'LineString', coordinates: truck.travelled } },
      ],
    }),
    [truck.travelled],
  );

  const fade = (ms: number) => ({ duration: reducedMotion ? 0 : ms, delay: 0 });
  const stateOf = (g: Group): LightState => (g === 'rest' ? 'on' : scene.lights[g]);
  const showCrew = scene.crew !== 'hidden';

  return (
    <Map
      ref={mapRef}
      mapStyle="https://tiles.openfreemap.org/styles/dark"
      initialViewState={{ ...steps[0].camera, longitude: steps[0].camera.lng, latitude: steps[0].camera.lat }}
      maxBounds={NSUKKA_BOUNDS}
      interactive={false}
      attributionControl={false}
      onLoad={(e) => {
        const firstSymbol = e.target.getStyle().layers.find((l) => l.type === 'symbol');
        setBeforeId(firstSymbol?.id);
        setLoaded(true);
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <AttributionControl compact position="bottom-right" />

      {buildings && loaded && (
        <Source id="homes" type="geojson" data={buildings}>
          {GROUPS.map((g) => {
            const s = LIGHT[stateOf(g)];
            const quick = g === 'onuiyi';
            return (
              <Layer
                key={`glow-${g}`}
                id={`glow-${g}`}
                type="heatmap"
                beforeId={beforeId}
                filter={['==', ['get', 'g'], g]}
                paint={{
                  'heatmap-weight': 1,
                  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.35, 16, 1.4],
                  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 14, 11, 17, 26],
                  'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.15, 'rgba(255,140,30,0.22)',
                    0.4, 'rgba(255,175,60,0.5)',
                    0.7, 'rgba(255,208,120,0.78)',
                    1, 'rgba(255,240,205,0.95)',
                  ],
                  'heatmap-opacity': s.heat,
                  'heatmap-opacity-transition': fade(quick ? 150 : 1400),
                }}
              />
            );
          })}
          {GROUPS.map((g) => {
            const s = LIGHT[stateOf(g)];
            const quick = g === 'onuiyi';
            return (
              <Layer
                key={`win-${g}`}
                id={`win-${g}`}
                type="circle"
                beforeId={beforeId}
                filter={['==', ['get', 'g'], g]}
                minzoom={13.5}
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.5, 0.8, 15, 1.6, 17, 3.2],
                  'circle-color': s.color,
                  'circle-color-transition': fade(1200),
                  'circle-opacity': s.opacity,
                  'circle-opacity-transition': fade(quick ? 150 : 1200),
                  'circle-blur': 0.4,
                }}
              />
            );
          })}
        </Source>
      )}

      {loaded && (
        <Source id="forecast" type="geojson" data={forecastZone}>
          <Layer
            id="forecast-fill"
            type="fill"
            paint={{
              'fill-color': '#7457ea',
              'fill-opacity': scene.forecast ? 0.22 : 0,
              'fill-opacity-transition': fade(1200),
            }}
          />
          <Layer
            id="forecast-line"
            type="line"
            paint={{
              'line-color': '#a08bff',
              'line-width': 2,
              'line-dasharray': [2, 2],
              'line-opacity': scene.forecast ? 1 : 0,
              'line-opacity-transition': fade(1200),
            }}
          />
        </Source>
      )}

      {loaded && (
        <Source id="route" type="geojson" data={routeData}>
          <Layer
            id="route-all"
            type="line"
            filter={['==', ['get', 'part'], 'all']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': '#ffffff',
              'line-width': 3,
              'line-dasharray': [0.5, 2],
              'line-opacity': showCrew && scene.crew === 'driving' ? 0.45 : 0,
              'line-opacity-transition': fade(600),
            }}
          />
          <Layer
            id="route-done"
            type="line"
            filter={['==', ['get', 'part'], 'done']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': '#5b8cff',
              'line-width': 4,
              'line-opacity': showCrew ? 0.95 : 0,
              'line-opacity-transition': fade(600),
            }}
          />
        </Source>
      )}

      {loaded && (
        <Source id="reports" type="geojson" data={reportDots}>
          <Layer
            id="reports-out"
            type="circle"
            filter={['all', ['==', ['get', 'kind'], 'out'], ['<', ['get', 'i'], reportCount]]}
            paint={{
              'circle-color': '#ff4d50',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 6],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
              'circle-opacity': scene.reports ? 1 : 0,
              'circle-stroke-opacity': scene.reports ? 1 : 0,
              'circle-opacity-transition': fade(800),
              'circle-stroke-opacity-transition': fade(800),
            }}
          />
          <Layer
            id="reports-low"
            type="circle"
            filter={['==', ['get', 'kind'], 'low']}
            paint={{
              'circle-color': '#ff9a3d',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 6],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
              'circle-opacity': scene.lowReports ? 1 : 0,
              'circle-stroke-opacity': scene.lowReports ? 1 : 0,
              'circle-opacity-transition': fade(800),
              'circle-stroke-opacity-transition': fade(800),
            }}
          />
        </Source>
      )}

      {/* Substation + crew truck */}
      {showCrew && (
        <Marker longitude={SUBSTATION.lng} latitude={SUBSTATION.lat} anchor="center">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border-2 border-white bg-[#111113]">
            <ZapIcon className="h-4 w-4 fill-volt text-volt" aria-hidden="true" />
          </span>
        </Marker>
      )}
      {showCrew && (
        <Marker longitude={truck.pos[0]} latitude={truck.pos[1]} anchor="bottom">
          <span className="flex flex-col items-center">
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-[#2457f5] px-3 font-body text-[13px] font-semibold text-white ring-2 ring-white">
              <TruckIcon className="h-4 w-4" aria-hidden="true" />
              Crew Bravo
            </span>
            <span className="-mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[#2457f5]" aria-hidden="true" />
          </span>
        </Marker>
      )}

      {/* Area callouts */}
      <AreaCallout
        show={scene.id === 'dark' || scene.id === 'reports' || scene.id === 'crew'}
        at={storyAreas.odenigwe}
        color="#ff4d50"
        icon={<ZapOffIcon className="h-3.5 w-3.5" />}
        label="Odenigwe · No light"
      />
      <AreaCallout
        show={scene.id === 'low' || scene.id === 'crew'}
        at={storyAreas.onuiyi}
        color="#e0700a"
        icon={<span className="font-display text-[11px] font-bold">V</span>}
        label="Onuiyi · 142 V"
      />
      <AreaCallout
        show={scene.restored}
        at={storyAreas.odenigwe}
        color="#12945a"
        icon={<CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
        label="Odenigwe · Light restored"
        ripple
      />
      <AreaCallout
        show={scene.forecast}
        at={storyAreas.odim}
        color="#7457ea"
        icon={<SparklesIcon className="h-3.5 w-3.5" />}
        label="Odim Gate · 78% · 7–10 PM"
      />
      {focus && step === 0 && (
        <AreaCallout show at={focus} color="#ffffff" dark icon={<span className="h-2 w-2 rounded-full bg-[#111113]" />} label={focus.name} ripple />
      )}
    </Map>
  );
}

function AreaCallout({
  show,
  at,
  color,
  icon,
  label,
  ripple = false,
  dark = false,
}: {
  show: boolean;
  at: { lng: number; lat: number };
  color: string;
  icon: React.ReactNode;
  label: string;
  ripple?: boolean;
  dark?: boolean;
}) {
  return (
    <AnimatePresence>
      {show && (
        <Marker longitude={at.lng} latitude={at.lat} anchor="bottom" style={{ zIndex: 5 }}>
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.5 }}
            className="relative flex origin-bottom flex-col items-center"
          >
            {ripple && (
              <span
                className="animate-pulse-ring absolute left-1/2 top-full h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            )}
            <span
              className="relative flex h-9 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1.5 pr-3.5 font-body text-[13px] font-semibold"
              style={{ backgroundColor: color, color: dark ? '#111113' : '#ffffff' }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: dark ? '#eceae5' : 'rgba(255,255,255,0.22)' }}
              >
                {icon}
              </span>
              {label}
            </span>
            <span className="-mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden="true" />
          </motion.span>
        </Marker>
      )}
    </AnimatePresence>
  );
}
