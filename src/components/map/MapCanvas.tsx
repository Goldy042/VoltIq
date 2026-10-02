'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { AnimatePresence } from 'framer-motion';
import './setup';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  NSUKKA_BOUNDS,
  NSUKKA_CENTER,
  substations,
  type Crew,
  type Incident,
  type Prediction,
  type ReportDot,
} from '@/data/nsukka';
import { circleRing } from '@/lib/geo';
import { groupIncidents, type PinGroup } from './cluster';
import { CrewPin, GroupPin, IncidentPin, PredictionPin, SubstationPin, UserDot } from './markers';

/** MapLibre paints can't read CSS variables, so the status scale is mirrored here. */
const MAP_COLORS = {
  no_power: '#e5383b',
  low_voltage: '#e0700a',
  fluctuating: '#e0700a',
  restored: '#12945a',
  predicted: '#7457ea',
};

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

/** Zoom levels at which detail appears — the map reveals more as you get closer. */
const ZOOM = {
  names: 14.6,
  restored: 14,
  dots: 15,
  poi: 16.2,
};

/** Pins closer than this on screen merge into a group. */
const GROUP_RADIUS_PX = 64;

export interface FlyTarget {
  lat: number;
  lng: number;
  zoom?: number;
  key: number;
}

export interface MapCanvasProps {
  incidents?: Incident[];
  predictions?: Prediction[];
  dots?: ReportDot[];
  crews?: Crew[];
  showSubstations?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  flyTo?: FlyTarget | null;
  user?: { lat: number; lng: number } | null;
  /** GPS error radius around `user`, in metres. Drawn as a soft circle. */
  userAccuracy?: number | null;
  /** Bumps a pin when a fresh report lands on it. */
  bump?: { incidentId: string; key: number } | null;
  /** Extra space reserved by overlays (bottom sheet, side panel), in px. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  interactive?: boolean;
  initialZoom?: number;
  initialCenter?: { lat: number; lng: number };
  className?: string;
}

/** Push the base map's shop/place icons to street level so they don't compete with outages. */
function quietBaseMap(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith('poi') || layer.id.startsWith('highway-shield') || layer.id.startsWith('road_shield')) {
      map.setLayerZoomRange(layer.id, ZOOM.poi, 24);
    }
  }
  // Some style icons are missing from the sprite; a blank stand-in keeps the console clean.
  map.on('styleimagemissing', (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}

export function MapCanvas({
  incidents = [],
  predictions = [],
  dots = [],
  crews = [],
  showSubstations = false,
  selectedId = null,
  onSelect,
  flyTo,
  user,
  userAccuracy,
  bump,
  padding,
  interactive = true,
  initialZoom = 13.6,
  initialCenter = NSUKKA_CENTER,
  className,
}: MapCanvasProps) {
  const mapRef = useRef<MapRef>(null);
  const [cursor, setCursor] = useState<string>('grab');
  const [styleUrl, setStyleUrl] = useState(STYLE_LIGHT);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(initialZoom);
  const [groups, setGroups] = useState<PinGroup[]>([]);

  useEffect(() => {
    if (document.documentElement.dataset.theme === 'dark') setStyleUrl(STYLE_DARK);
  }, []);

  useEffect(() => {
    if (!flyTo) return;
    mapRef.current?.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 15.5,
      pitch: (flyTo.zoom ?? 15.5) >= 15 ? 40 : 0,
      duration: 1400,
      essential: true,
      padding: { top: 0, left: 0, right: 0, bottom: 0, ...padding },
    });
    // padding is read at flight time; re-running on padding changes would re-fly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  // Restored areas are history — only show them up close, or when they're all there is.
  const pinned = useMemo(() => {
    const allRestored = incidents.length > 0 && incidents.every((i) => i.status === 'restored');
    return incidents.filter((i) => i.status !== 'restored' || allRestored || zoom >= ZOOM.restored || i.id === selectedId);
  }, [incidents, zoom, selectedId]);

  const regroup = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setZoom(map.getZoom());
    setGroups(
      groupIncidents(
        pinned,
        (lng, lat) => map.project([lng, lat]),
        GROUP_RADIUS_PX,
        (i) => i.id === selectedId,
      ),
    );
  }, [pinned, selectedId]);

  useEffect(() => {
    if (loaded) regroup();
  }, [loaded, regroup]);

  const zoomInto = (g: PinGroup) => {
    const lngs = g.members.map((m) => m.lng);
    const lats = g.members.map((m) => m.lat);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: { top: 120 + (padding?.top ?? 0), bottom: 80 + (padding?.bottom ?? 0), left: 60 + (padding?.left ?? 0), right: 60 + (padding?.right ?? 0) },
        maxZoom: 16,
        duration: 900,
      },
    );
  };

  const selected = incidents.find((i) => i.id === selectedId);

  // Shade the affected area of the selected incident only.
  const areaGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: selected
        ? [
            {
              type: 'Feature' as const,
              properties: {
                id: selected.id,
                color: selected.status === 'restored' ? MAP_COLORS.restored : MAP_COLORS[selected.issue],
              },
              geometry: { type: 'Polygon' as const, coordinates: [circleRing(selected.lat, selected.lng, selected.radius)] },
            },
          ]
        : [],
    }),
    [selected],
  );

  const predictionGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: predictions.map((p) => ({
        type: 'Feature' as const,
        properties: { id: p.id, selected: p.id === selectedId ? 1 : 0 },
        geometry: { type: 'Polygon' as const, coordinates: [circleRing(p.lat, p.lng, p.radius)] },
      })),
    }),
    [predictions, selectedId],
  );

  const dotGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: dots.map((d) => ({
        type: 'Feature' as const,
        properties: { id: d.incidentId, color: MAP_COLORS[d.issue] },
        geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
      })),
    }),
    [dots],
  );

  const accuracyGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features:
        user && userAccuracy && userAccuracy > 15
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Polygon' as const, coordinates: [circleRing(user.lat, user.lng, Math.min(userAccuracy, 3000))] },
              },
            ]
          : [],
    }),
    [user, userAccuracy],
  );

  const onClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    onSelect?.(id ?? null);
  };

  // Citizens only need to see crews that are actually heading somewhere.
  const visibleCrews = crews.filter((c) => c.status === 'en_route' || (showSubstations && c.status === 'available'));
  const showPredictionPins = zoom >= 13 || predictions.length <= 1;

  return (
    <div className={className ?? 'h-full w-full'}>
      <Map
        ref={mapRef}
        mapStyle={styleUrl}
        initialViewState={{ longitude: initialCenter.lng, latitude: initialCenter.lat, zoom: initialZoom }}
        maxBounds={NSUKKA_BOUNDS}
        minZoom={12}
        maxZoom={18.5}
        interactive={interactive}
        attributionControl={false}
        cursor={cursor}
        interactiveLayerIds={interactive ? ['incident-areas', 'prediction-zones', 'report-dots'] : []}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('grab')}
        onClick={onClick}
        onLoad={(e) => {
          quietBaseMap(e.target);
          setLoaded(true);
        }}
        onMoveEnd={regroup}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-left" />

        <Source id="predictions" type="geojson" data={predictionGeojson}>
          <Layer
            id="prediction-zones"
            type="fill"
            paint={{
              'fill-color': MAP_COLORS.predicted,
              'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.16, 0.06],
            }}
          />
          <Layer
            id="prediction-outline"
            type="line"
            paint={{
              'line-color': MAP_COLORS.predicted,
              'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.9, 0.45],
              'line-width': ['case', ['==', ['get', 'selected'], 1], 2, 1.25],
              'line-dasharray': [2, 2],
            }}
          />
        </Source>

        <Source id="incident-areas" type="geojson" data={areaGeojson}>
          <Layer id="incident-areas" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.14 }} />
          <Layer id="incident-outline" type="line" paint={{ 'line-color': ['get', 'color'], 'line-opacity': 0.55, 'line-width': 1.5 }} />
        </Source>

        <Source id="user-accuracy" type="geojson" data={accuracyGeojson}>
          <Layer id="user-accuracy-fill" type="fill" paint={{ 'fill-color': '#2457f5', 'fill-opacity': 0.1 }} />
          <Layer id="user-accuracy-line" type="line" paint={{ 'line-color': '#2457f5', 'line-opacity': 0.5, 'line-width': 1.25 }} />
        </Source>

        <Source id="report-dots" type="geojson" data={dotGeojson}>
          <Layer
            id="report-dots"
            type="circle"
            minzoom={ZOOM.dots}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['interpolate', ['linear'], ['zoom'], ZOOM.dots, 2.5, 17, 4.5, 18.5, 6],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.25,
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], ZOOM.dots, 0, ZOOM.dots + 0.4, 0.85],
              'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], ZOOM.dots, 0, ZOOM.dots + 0.4, 1],
            }}
          />
        </Source>

        {showSubstations &&
          substations.map((s) => (
            <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
              <SubstationPin label={`${s.name} — ${s.rating}`} />
            </Marker>
          ))}

        {showPredictionPins &&
          predictions.map((p) => (
            <Marker
              key={p.id}
              longitude={p.lng}
              latitude={p.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect?.(p.id);
              }}
              style={{ zIndex: p.id === selectedId ? 20 : 1, cursor: 'pointer' }}
            >
              <PredictionPin prediction={p} selected={p.id === selectedId} />
            </Marker>
          ))}

        <AnimatePresence>
          {groups.map((g) => {
            const single = g.members.length === 1 ? g.members[0] : null;
            const bumped = bump && g.members.some((m) => m.id === bump.incidentId) ? bump.key : undefined;
            return (
              <Marker
                key={g.id}
                longitude={g.lng}
                latitude={g.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  if (single) onSelect?.(single.id);
                  else zoomInto(g);
                }}
                style={{
                  zIndex: single?.id === selectedId ? 20 : single?.status === 'restored' ? 2 : single ? 5 : 8,
                  cursor: 'pointer',
                }}
              >
                {single ? (
                  <IncidentPin
                    incident={single}
                    selected={single.id === selectedId}
                    bump={bumped}
                    showName={zoom >= ZOOM.names || single.id === selectedId}
                  />
                ) : (
                  <GroupPin members={g.members} bump={bumped} />
                )}
              </Marker>
            );
          })}
        </AnimatePresence>

        {visibleCrews.map((c) => (
          <Marker
            key={c.id}
            longitude={c.lng}
            latitude={c.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              if (c.incidentId) onSelect?.(c.incidentId);
            }}
            style={{ zIndex: 15, cursor: c.incidentId ? 'pointer' : 'default' }}
          >
            <CrewPin crew={c} />
          </Marker>
        ))}

        {user && (
          <Marker longitude={user.lng} latitude={user.lat} anchor="center" style={{ zIndex: 30 }}>
            <UserDot />
          </Marker>
        )}
      </Map>
    </div>
  );
}
