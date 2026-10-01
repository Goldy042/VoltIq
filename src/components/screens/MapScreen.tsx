'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRingIcon, LocateFixedIcon, PlusIcon, TruckIcon, UsersIcon, ZapOffIcon } from 'lucide-react';
import { MapCanvas, type FlyTarget } from '@/components/map';
import { MapTopBar, type MapFilter } from '@/components/map/MapTopBar';
import { BottomSheet, type SheetSnap } from '@/components/map/BottomSheet';
import { IncidentList } from '@/components/map/IncidentList';
import { MapKey } from '@/components/map/MapKey';
import { IncidentDetail } from '@/components/map/IncidentDetail';
import { PredictionDetail } from '@/components/map/PredictionDetail';
import { IconButton } from '@/components/ui/IconButton';
import { ButtonLink } from '@/components/ui/Button';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { IssueIcon } from '@/components/ui/Badges';
import { useToast } from '@/components/ui/Toast';
import { useOutageFeed } from '@/hooks/useOutageFeed';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { describeLocation } from '@/lib/address';
import { placeName, useProfile } from '@/lib/profile';
import {
  NSUKKA_BOUNDS,
  areaById,
  issueMeta,
  predictions,
  type Incident,
  type Prediction,
} from '@/data/nsukka';

interface MapScreenProps {
  view: 'citizen' | 'operator';
  /** Incident or prediction id to open on arrival (from ?focus=). */
  initialFocus?: string;
}

const severity = (i: Incident) =>
  i.status === 'restored' ? 9 : i.issue === 'no_power' ? (i.status === 'crew_dispatched' ? 2 : 0) : 1;

export function MapScreen({ view, initialFocus }: MapScreenProps) {
  const toast = useToast();
  const { primary } = useProfile();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { incidents, crews, dots, lastEvent, addReport, setStatus, dispatchCrew } = useOutageFeed();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MapFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [sheetPx, setSheetPx] = useState(168);
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(
    view === 'citizen' ? { lat: primary.lat, lng: primary.lng } : null,
  );
  const [affected, setAffected] = useState<string[]>([]);

  const matches = useCallback(
    (areaId: string, ...extra: string[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const area = areaById[areaId];
      return [area?.name, area?.feeder, ...extra].some((v) => v?.toLowerCase().includes(q));
    },
    [query],
  );

  const visibleIncidents = useMemo(
    () =>
      incidents.filter((i) => {
        if (!matches(i.areaId, i.place)) return false;
        if (filter === 'forecast') return false;
        if (filter === 'restored') return i.status === 'restored';
        if (filter === 'no_power') return i.issue === 'no_power' && i.status !== 'restored';
        if (filter === 'unstable') return i.issue !== 'no_power' && i.status !== 'restored';
        return true;
      }),
    [incidents, filter, matches],
  );

  const visiblePredictions = useMemo(
    () => (filter === 'all' || filter === 'forecast' ? predictions.filter((p) => matches(p.areaId, p.area)) : []),
    [filter, matches],
  );

  const counts = useMemo<Record<MapFilter, number>>(() => {
    const active = incidents.filter((i) => i.status !== 'restored');
    return {
      all: incidents.length + predictions.length,
      no_power: active.filter((i) => i.issue === 'no_power').length,
      unstable: active.filter((i) => i.issue !== 'no_power').length,
      forecast: predictions.length,
      restored: incidents.length - active.length,
    };
  }, [incidents]);

  const listItems = useMemo<Array<Incident | Prediction>>(
    () => [
      ...[...visibleIncidents].sort((a, b) => severity(a) - severity(b) || b.reports - a.reports),
      ...[...visiblePredictions].sort((a, b) => b.confidence - a.confidence),
    ],
    [visibleIncidents, visiblePredictions],
  );

  const selected: Incident | Prediction | null =
    incidents.find((i) => i.id === selectedId) ?? predictions.find((p) => p.id === selectedId) ?? null;

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const item = incidents.find((i) => i.id === id) ?? predictions.find((p) => p.id === id);
      if (!item) return;
      setSnap('half');
      setFlyTo({ lat: item.lat, lng: item.lng, zoom: item.kind === 'prediction' ? 14.6 : 16, key: Date.now() });
    },
    [incidents],
  );

  useEffect(() => {
    if (!initialFocus) return;
    // Let the map mount before flying so the camera move is visible.
    const t = window.setTimeout(() => select(initialFocus), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus]);

  const locate = () => {
    const fallback = () => {
      const home = { lat: primary.lat, lng: primary.lng };
      setUser(home);
      setFlyTo({ ...home, zoom: 15.5, key: Date.now() });
      toast({ title: `Showing your ${placeName(primary).toLowerCase()}`, body: describeLocation(primary).summary, icon: <LocateFixedIcon className="h-4 w-4" />, color: 'var(--accent)' });
    };
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const [w, s, e, n] = NSUKKA_BOUNDS;
        const inside = coords.longitude > w && coords.longitude < e && coords.latitude > s && coords.latitude < n;
        if (!inside) return fallback();
        const here = { lat: coords.latitude, lng: coords.longitude };
        setUser(here);
        setFlyTo({ ...here, zoom: 16, key: Date.now() });
      },
      fallback,
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'restored');
  const homesOut = activeIncidents.reduce((s, i) => s + i.households, 0);
  const crewsOut = crews.filter((c) => c.status !== 'available').length;

  const header = (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-1">
      <div className="min-w-0">
        <p className="font-display text-xl font-bold tracking-tight text-ink">
          {view === 'operator' ? 'EEDC Nsukka · Live' : 'Nsukka right now'}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 font-body text-sm text-ink-muted">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-status-out" />
            <span className="relative h-2 w-2 rounded-full bg-status-out" />
          </span>
          <AnimatedCount value={activeIncidents.reduce((s, i) => s + i.reports, 0)} /> reports in{' '}
          {activeIncidents.length} areas
        </p>
      </div>
      {view === 'citizen' ? (
        <ButtonLink href="/report" size="md" leading={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
          Report
        </ButtonLink>
      ) : null}
    </div>
  );

  const summary = (
    <div className="grid grid-cols-3 gap-2 px-3 pb-3">
      <SummaryTile
        icon={<ZapOffIcon className="h-4 w-4" aria-hidden="true" />}
        color="var(--status-out)"
        value={counts.no_power}
        label="No light"
      />
      <SummaryTile
        icon={<IssueIcon issue="low_voltage" className="h-4 w-4" />}
        color="var(--status-low)"
        value={counts.unstable}
        label="Low / unstable"
      />
      {view === 'operator' ? (
        <SummaryTile icon={<TruckIcon className="h-4 w-4" aria-hidden="true" />} color="var(--status-crew)" value={`${crewsOut}/${crews.length}`} label="Crews out" />
      ) : (
        <SummaryTile icon={<UsersIcon className="h-4 w-4" aria-hidden="true" />} color="var(--ink)" value={homesOut.toLocaleString()} label="Homes hit" />
      )}
    </div>
  );

  const panelBody = (
    <AnimatePresence mode="wait" initial={false}>
      {selected ? (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {selected.kind === 'incident' ? (
            <IncidentDetail
              incident={selected}
              crews={crews}
              view={view}
              onBack={() => select(null)}
              affected={affected.includes(selected.id)}
              onAffected={() => {
                setAffected((a) => [...a, selected.id]);
                addReport(selected.id, 'You');
                toast({
                  title: 'You’ve been counted',
                  body: `${selected.reports + 1} reports at ${selected.place}`,
                  icon: <IssueIcon issue={selected.issue} className="h-4 w-4" />,
                  color: issueMeta[selected.issue].color,
                });
              }}
              onStatus={(s) => {
                setStatus(selected.id, s);
                toast({ title: s === 'restored' ? 'Marked as restored' : 'Fault confirmed', body: selected.place });
              }}
              onDispatch={(crewId) => {
                dispatchCrew(selected.id, crewId);
                const crew = crews.find((c) => c.id === crewId);
                toast({
                  title: `${crew?.name} dispatched`,
                  body: `Residents of ${selected.area} have been notified`,
                  icon: <TruckIcon className="h-4 w-4" />,
                  color: 'var(--status-crew)',
                });
              }}
            />
          ) : (
            <PredictionDetail
              prediction={selected}
              view={view}
              onBack={() => select(null)}
              onWarn={() =>
                toast({
                  title: 'Warning sent',
                  body: `${selected.households.toLocaleString()} homes in ${selected.area}`,
                  icon: <BellRingIcon className="h-4 w-4" />,
                  color: 'var(--status-predicted)',
                })
              }
            />
          )}
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {summary}
          <IncidentList items={listItems} onSelect={select} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  const panelWidth = 420;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-sunken">
      <div className="absolute inset-0">
        <MapCanvas
          incidents={visibleIncidents}
          predictions={visiblePredictions}
          dots={dots.filter((d) => visibleIncidents.some((i) => i.id === d.incidentId))}
          crews={crews}
          showSubstations={view === 'operator'}
          selectedId={selectedId}
          onSelect={select}
          flyTo={flyTo}
          user={user}
          bump={lastEvent ? { incidentId: lastEvent.incidentId, key: lastEvent.key } : null}
          padding={desktop ? { left: panelWidth + 32 } : { bottom: sheetPx }}
        />
      </div>

      <div className="absolute inset-x-0 top-0 z-30 lg:left-[452px]">
        <MapTopBar
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={(f) => {
            setFilter(f);
            setSelectedId(null);
          }}
          counts={counts}
          lastEvent={lastEvent}
          backHref={view === 'operator' ? '/' : '/dashboard'}
        />
      </div>

      {/* Map controls ride just above the sheet on mobile */}
      <div
        className="absolute right-3 z-30 flex flex-col gap-2.5 transition-[bottom,opacity] duration-300 ease-out lg:bottom-6 lg:right-6"
        style={
          desktop
            ? undefined
            : { bottom: sheetPx + 12, opacity: snap === 'full' ? 0 : 1, pointerEvents: snap === 'full' ? 'none' : undefined }
        }
      >
        <MapKey />
        <IconButton floating size="lg" label="Show my location" icon={<LocateFixedIcon className="h-5 w-5" />} onClick={locate} />
      </div>

      {desktop ? (
        <aside
          className="absolute bottom-4 left-4 top-4 z-40 flex flex-col overflow-hidden rounded-xl bg-surface shadow-float"
          style={{ width: panelWidth }}
        >
          <div className="pt-4">{header}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
        </aside>
      ) : (
        <BottomSheet snap={snap} onSnapChange={setSnap} header={header} onVisibleHeight={setSheetPx}>
          {panelBody}
        </BottomSheet>
      )}
    </div>
  );
}

function SummaryTile({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number | string; label: string }) {
  return (
    <div className="rounded-md bg-canvas p-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
        {icon}
      </span>
      <p className="mt-2 font-display text-xl font-bold leading-none tracking-tight text-ink">
        <AnimatedCount value={value} />
      </p>
      <p className="mt-1 font-body text-xs text-ink-muted">{label}</p>
    </div>
  );
}
