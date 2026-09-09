import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  ZoomControl,
  useMap } from
'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import {
  mapCenter,
  type OutagePoint,
  type PredictedZone } from
'../../data/outages';

interface LiveMapCanvasProps {
  points: OutagePoint[];
  zones: PredictedZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Coordinates the map should fly to; changes trigger the flight. */
  flyTo: {lat: number;lng: number;zoom: number;key: number;} | null;
}

const cssColor = (state: OutagePoint['state']) => {
  if (state === 'critical') return 'var(--status-critical)';
  if (state === 'resolved') return 'var(--status-stable)';
  return 'var(--status-reported)';
};

function pinIcon(point: OutagePoint, selected: boolean) {
  const color = cssColor(point.state);
  const heavy = point.reports >= 10;
  return L.divIcon({
    className: 'gp-marker',
    iconSize: heavy ? [30, 30] : [22, 22],
    iconAnchor: heavy ? [15, 15] : [11, 11],
    html: `<span class="gp-pin ${point.state === 'critical' ? 'gp-pin-critical' : ''} ${
    selected ? 'gp-pin-selected' : ''}" style="--pin:${
    color}">
      <span class="gp-pin-halo"></span>
      ${
    heavy ?
    `<span class="gp-pin-count">${point.reports}</span>` :
    '<span class="gp-pin-dot"></span>'}
    </span>`

  });
}

function clusterIcon(cluster: L.MarkerCluster) {
  const markers = cluster.getAllChildMarkers();
  let weight = 0;
  let critical = false;
  markers.forEach((m) => {
    const opts = m.options as unknown as {weight?: number;severity?: string;};
    weight += opts.weight ?? 1;
    if (opts.severity === 'critical') critical = true;
  });
  const color = critical ? 'var(--status-critical)' : 'var(--status-reported)';
  return L.divIcon({
    className: 'gp-cluster',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<span class="gp-pin ${critical ? 'gp-pin-critical' : ''}" style="--pin:${color}">
      <span class="gp-pin-halo"></span>
      <span class="gp-pin-count">${weight}</span>
    </span>`
  });
}

function MapController({
  flyTo


}: {flyTo: LiveMapCanvasProps['flyTo'];}) {
  const map = useMap();

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 0.7 });
  }, [flyTo, map]);

  return null;
}

export function LiveMapCanvas({
  points,
  zones,
  selectedId,
  onSelect,
  flyTo
}: LiveMapCanvasProps) {
  const markers = useMemo(
    () =>
    points.map((point) =>
    <Marker
      key={point.id}
      position={[point.lat, point.lng]}
      icon={pinIcon(point, point.id === selectedId)}
      // custom options read back by the cluster icon builder
      {...{ weight: point.reports, severity: point.state } as object}
      eventHandlers={{ click: () => onSelect(point.id) }}
      alt={`${point.address}, ${point.state}`} />

    ),
    [points, selectedId, onSelect]
  );

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      minZoom={11}
      maxZoom={18}
      zoomControl={false}
      className="h-full w-full">
      
      <TileLayer
        className="gp-tiles"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
      

      {zones.map((zone) =>
      <Circle
        key={zone.id}
        center={[zone.lat, zone.lng]}
        radius={zone.radius}
        eventHandlers={{ click: () => onSelect(zone.id) }}
        pathOptions={{
          className: 'gp-zone',
          color: '#5a5f8c',
          weight: zone.id === selectedId ? 2 : 1,
          dashArray: '4 4',
          fillColor: '#5a5f8c',
          fillOpacity: 0.1
        }} />

      )}

      <MarkerClusterGroup
        iconCreateFunction={clusterIcon}
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={44}
        chunkedLoading>
        
        {markers}
      </MarkerClusterGroup>

      <ZoomControl position="topright" />
      <MapController flyTo={flyTo} />
    </MapContainer>);

}