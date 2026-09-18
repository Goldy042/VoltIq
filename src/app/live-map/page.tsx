"use client";
import React, { useMemo, useState } from 'react';
import { ChevronUpIcon } from 'lucide-react';
import { MapTopBar } from '@/components/map/MapTopBar';
import { MapLegend } from '@/components/map/MapLegend';
import { OutageList } from '@/components/map/OutageList';
import { OutageDetail } from '@/components/map/OutageDetail';
import { LiveMapCanvas } from '@/components/map/LiveMapCanvas';
import {
  outagePoints,
  predictedZones,
  severityRank,
  type OutagePoint,
  type OutageState,
  type PredictedZone } from
'@/data/outages';

interface LiveMapProps {
  /** Operator adds dispatch and status controls to each fault. */
  view?: 'citizen' | 'operator';
}

const matches = (haystack: string[], query: string) =>
query.trim() === '' ||
haystack.some((v) => v.toLowerCase().includes(query.trim().toLowerCase()));

export function LiveMap({ view = 'citizen' }: LiveMapProps) {
  const [query, setQuery] = useState('');
  const [showReports, setShowReports] = useState(true);
  const [showPredictions, setShowPredictions] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<
    {lat: number;lng: number;zoom: number;key: number;} | null>(
    null);
  const [overrides, setOverrides] = useState<Record<string, OutageState>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const points: OutagePoint[] = useMemo(
    () =>
    outagePoints.map((p) => ({
      ...p,
      state: overrides[p.id] ?? p.state,
      crew: overrides[p.id] === 'dispatched' ? p.crew ?? 'Crew 3' : p.crew
    })),
    [overrides]
  );

  const visiblePoints = useMemo(
    () =>
    showReports ?
    points.filter((p) => matches([p.address, p.district, p.feeder], query)) :
    [],
    [points, showReports, query]
  );

  const visibleZones: PredictedZone[] = useMemo(
    () =>
    showPredictions ?
    predictedZones.filter((z) => matches([z.district, z.feeder], query)) :
    [],
    [showPredictions, query]
  );

  const listItems = useMemo(() => {
    const rank = (item: OutagePoint | PredictedZone) =>
    item.kind === 'prediction' ? 3 : severityRank[item.state] <= 1 ? severityRank[item.state] : severityRank[item.state] + 2;
    return [...visiblePoints, ...visibleZones].sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      if (a.kind === 'prediction' && b.kind === 'prediction')
      return b.confidence - a.confidence;
      if (a.kind === 'report' && b.kind === 'report')
      return a.ageMinutes - b.ageMinutes;
      return 0;
    });
  }, [visiblePoints, visibleZones]);

  const selected =
  listItems.find((item) => item.id === selectedId) ?? (
  selectedId ?
  [...points, ...predictedZones].find((i) => i.id === selectedId) ?? null :
  null);

  const select = (id: string) => {
    const item = [...points, ...predictedZones].find((i) => i.id === id);
    if (!item) return;
    setSelectedId(id);
    setSheetOpen(true);
    setFlyTo({
      lat: item.lat,
      lng: item.lng,
      zoom: item.kind === 'prediction' ? 14 : 15,
      key: Date.now()
    });
  };

  const changeState = (id: string, state: OutageState) =>
  setOverrides((prev) => ({ ...prev, [id]: state }));

  const activeCount = points.filter((p) => p.state !== 'resolved').length;

  const panel =
  <>
      {selected &&
    <OutageDetail
      item={selected}
      view={view}
      onChangeState={changeState}
      onClose={() => setSelectedId(null)} />

    }
      <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
        <h2 className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          Active areas
        </h2>
        <span className="font-body text-2xs tabular-nums text-ink-faint">
          {listItems.length} shown
        </span>
      </div>
      <OutageList items={listItems} selectedId={selectedId} onSelect={select} />
    </>;


  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      <MapTopBar
        view={view}
        query={query}
        onQuery={setQuery}
        showReports={showReports}
        showPredictions={showPredictions}
        onToggleReports={() => setShowReports((v) => !v)}
        onTogglePredictions={() => setShowPredictions((v) => !v)}
        activeCount={activeCount} />
      

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[22rem] shrink-0 flex-col overflow-y-auto border-r border-line bg-canvas lg:flex xl:w-[24rem]">
          {panel}
        </aside>

        <div className="relative min-h-0 flex-1">
          <LiveMapCanvas
            points={visiblePoints}
            zones={visibleZones}
            selectedId={selectedId}
            onSelect={select}
            flyTo={flyTo} />
          

          <div className="pointer-events-none absolute bottom-6 left-4 z-[900]">
            <MapLegend />
          </div>
        </div>

        {/* Mobile: bottom sheet with the same list and detail */}
        <div className="absolute inset-x-0 bottom-0 z-[1000] border-t border-line bg-canvas lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            className="flex w-full items-center justify-between px-5 py-3">
            
            <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              {listItems.length} areas · {activeCount} active
            </span>
            <ChevronUpIcon
              className="h-4 w-4 text-ink-muted transition-transform duration-150 ease-out"
              style={{ transform: sheetOpen ? 'rotate(180deg)' : undefined }}
              strokeWidth={1.5}
              aria-hidden="true" />
            
          </button>
          {sheetOpen &&
          <div className="max-h-[58vh] overflow-y-auto border-t border-line">
              {panel}
            </div>
          }
        </div>
      </div>
    </div>);

}