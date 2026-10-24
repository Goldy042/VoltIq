'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRightIcon,
  CheckIcon,
  LayersIcon,
  ListIcon,
  MapIcon,
  SearchIcon,
  Table2Icon,
  TruckIcon,
  XIcon,
} from 'lucide-react';
import { MapCanvas, type FlyTarget } from '@/components/map';
import { IncidentInfoForm } from '@/components/map/IncidentInfo';
import { OperatorActions } from '@/components/map/IncidentDetail';
import { PredictionDetail } from '@/components/map/PredictionDetail';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { areaById, issueMeta, predictions, statusMeta, type Incident } from '@/data/nsukka';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { buildQueue, queueTabs, shortDuration, tabFor, waitColor, waitLevel, type QueueTab } from '@/lib/dispatch';
import { CAUSES, formatEta, type Cause } from '@/lib/incidents';
import { useOperations } from '@/lib/operations';
import { scopeMeta } from '@/lib/footprint';
import { AskNearbyButton } from './AskNearbyButton';
import { useReportLog } from './ReportLog';
import { IssueTag, Kbd, LiveDot, Tag } from './parts';

type Layer = 'dots' | 'teams' | 'substations' | 'forecasts';

const layerMeta: Record<Layer, { label: string; hint: string }> = {
  dots: { label: 'Report dots', hint: 'Each resident’s report, rounded to ~30 m' },
  teams: { label: 'Teams', hint: 'Where each team is, or the job it’s on' },
  substations: { label: 'Substations', hint: 'Injection substations and feeders' },
  forecasts: { label: 'Forecasts', hint: 'Demo data until forecasts go live' },
};

const LAYER_KEY = 'voltiq.operator.layers.v1';
const defaultLayers: Record<Layer, boolean> = { dots: false, teams: true, substations: false, forecasts: false };

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * The dispatch board: a work queue on the left (what needs confirming, a
 * team, finishing), the map in the middle, and the selected fault's controls
 * on the right. Map / Table switch for busy nights. J/K to move, Enter for the
 * full page, C to confirm, Esc to close, 1–4 for tabs, V for table.
 */
export function OperatorBoard({ initialFocus }: { initialFocus?: string }) {
  const feed = useSharedOutageFeed();
  const { incidents, crews, dots, loaded, offline, lastEvent } = feed;
  const { allowed } = useOperations();
  const { rows } = useReportLog();
  const toast = useToast();
  const desktop = useMediaQuery('(min-width: 1024px)');

  const [tab, setTab] = useState<QueueTab>('confirm');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'table'>('map');
  const [mobilePane, setMobilePane] = useState<'queue' | 'map'>('queue');
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [layers, setLayers] = useState(defaultLayers);
  const [layersOpen, setLayersOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYER_KEY);
      if (raw) setLayers({ ...defaultLayers, ...(JSON.parse(raw) as Partial<Record<Layer, boolean>>) });
    } catch {
      /* keep defaults */
    }
  }, []);
  const toggleLayer = (l: Layer) =>
    setLayers((prev) => {
      const next = { ...prev, [l]: !prev[l] };
      try {
        window.localStorage.setItem(LAYER_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });

  const matches = useCallback(
    (i: Incident) => {
      const q = query.trim().toLowerCase();
      return !q || `${i.place} ${i.area} ${areaById[i.areaId]?.feeder ?? ''}`.toLowerCase().includes(q);
    },
    [query],
  );
  const queue = useMemo(() => buildQueue(incidents.filter(matches)), [incidents, matches]);
  const list = queue[tab];
  const toReview = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.review === 'pending') m.set(r.incidentId, (m.get(r.incidentId) ?? 0) + 1);
    return m;
  }, [rows]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) ?? null;
  const selectedPrediction = selectedIncident ? null : predictions.find((p) => p.id === selectedId) ?? null;

  const select = useCallback(
    (id: string | null, opts: { fly?: boolean } = {}) => {
      setSelectedId(id);
      if (!id) return;
      const inc = incidents.find((i) => i.id === id);
      const item = inc ?? predictions.find((p) => p.id === id);
      if (inc) setTab(tabFor(inc));
      if (item && opts.fly !== false) setFlyTo({ lat: item.lat, lng: item.lng, zoom: 15.6, key: Date.now() });
    },
    [incidents],
  );

  // Arriving from the overview, palette or an alert: open that fault once the feed is in.
  const focused = useRef(false);
  useEffect(() => {
    if (!initialFocus || !loaded || focused.current) return;
    const t = window.setTimeout(() => {
      focused.current = true;
      select(initialFocus);
      setMobilePane('map');
    }, 500);
    return () => window.clearTimeout(t);
  }, [initialFocus, loaded, select]);

  const confirm = useCallback(
    async (i: Incident) => {
      if (i.status !== 'reported' || !allowed('triage_reports')) return;
      if (await feed.setStatus(i.id, 'confirmed')) toast({ title: 'Fault confirmed', body: i.place });
    },
    [allowed, feed, toast],
  );

  // Keyboard: the queue is the main surface, so it gets the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = list.findIndex((i) => i.id === selectedId);
      if (k === 'j' || k === 'arrowdown') {
        const next = list[Math.min(list.length - 1, idx + 1)];
        if (next) {
          e.preventDefault();
          select(next.id);
        }
      } else if (k === 'k' || k === 'arrowup') {
        const prev = list[Math.max(0, idx - 1)];
        if (prev) {
          e.preventDefault();
          select(prev.id);
        }
      } else if (k === 'escape') {
        select(null);
      } else if (k === 'enter' && selectedIncident) {
        window.location.assign(`/operator/outages/${selectedIncident.id}`);
      } else if (k === 'c' && selectedIncident) {
        void confirm(selectedIncident);
      } else if (k === 'v') {
        setView((v) => (v === 'map' ? 'table' : 'map'));
      } else if (['1', '2', '3', '4'].includes(k)) {
        setTab(queueTabs[Number(k) - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, selectedId, selectedIncident, select, confirm]);

  const crewsFree = crews.filter((c) => c.status === 'available').length;
  const mapIncidents = useMemo(() => incidents.filter(matches), [incidents, matches]);
  const panelOpen = Boolean(selectedIncident || selectedPrediction);

  const queuePane = (
    <section aria-label="Work queue" className="flex min-h-0 flex-1 flex-col border-line bg-surface lg:w-[360px] lg:flex-none lg:border-r">
      <div className="space-y-3 border-b border-line p-3">
        <label className="relative block">
          <span className="sr-only">Search faults by place, area or feeder</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Place, area or feeder"
            className="h-9 w-full rounded-sm border border-line bg-canvas pl-9 pr-3 font-body text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
        </label>
        <div role="tablist" aria-label="Queue" className="grid grid-cols-4 gap-1 rounded-sm bg-canvas p-1">
          {queueTabs.map((t, n) => {
            const count = queue[t.id].length;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                title={`${t.label} (${n + 1})`}
                className={cn(
                  'relative flex h-12 flex-col items-center justify-center rounded-[5px] font-body text-2xs font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {active && <motion.span layoutId="queue-tab" className="absolute inset-0 rounded-[5px] bg-raised ring-1 ring-line-strong" />}
                <span className="relative font-mono text-base leading-none tabular-nums">{count}</span>
                <span className="relative mt-1">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loaded ? (
          <p className="p-6 text-center font-body text-sm text-ink-muted">Loading faults…</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-center font-body text-sm text-ink-muted">{query ? 'No faults match that search.' : queueTabs.find((t) => t.id === tab)!.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((i) => (
              <li key={i.id}>
                <QueueRow
                  incident={i}
                  active={i.id === selectedId}
                  review={toReview.get(i.id) ?? 0}
                  team={crews.find((c) => c.id === i.crewId)?.name}
                  onSelect={() => {
                    select(i.id);
                    if (!desktop) setMobilePane('map');
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 font-body text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <LiveDot color={offline ? 'var(--status-low)' : undefined} />
          {offline ? 'Offline · last known' : 'Live'}
        </span>
        <span className="flex items-center gap-1.5">
          <TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono text-ink">{crewsFree}</span> of {crews.length} teams free
        </span>
        <span className="hidden items-center gap-1 xl:flex">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
    </section>
  );

  const mapPane = (
    <div className="relative min-h-0 flex-1">
      <MapCanvas
        incidents={mapIncidents}
        predictions={layers.forecasts ? predictions : []}
        dots={layers.dots ? dots.filter((d) => mapIncidents.some((i) => i.id === d.incidentId)) : []}
        crews={layers.teams ? crews : []}
        showSubstations={layers.substations}
        selectedId={selectedId}
        onSelect={(id) => select(id, { fly: false })}
        flyTo={flyTo}
        bump={lastEvent ? { incidentId: lastEvent.incidentId, key: lastEvent.key } : null}
        padding={desktop && panelOpen ? { right: 420 } : undefined}
      />

      {/* Layers */}
      <div className="absolute left-3 top-3 z-20">
        <button
          type="button"
          aria-expanded={layersOpen}
          onClick={() => setLayersOpen((o) => !o)}
          className="inline-flex h-9 items-center gap-2 rounded-sm bg-surface px-3 font-body text-sm text-ink shadow-float ring-1 ring-line hover:bg-raised"
        >
          <LayersIcon className="h-4 w-4" aria-hidden="true" />
          Layers
        </button>
        <AnimatePresence>
          {layersOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 w-64 rounded-md bg-surface p-1.5 shadow-float ring-1 ring-line"
            >
              {(Object.keys(layerMeta) as Layer[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="switch"
                  aria-checked={layers[l]}
                  onClick={() => toggleLayer(l)}
                  className="flex w-full items-start gap-2.5 rounded-sm p-2 text-left hover:bg-raised"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] ring-1',
                      layers[l] ? 'bg-accent text-white ring-accent' : 'ring-line-strong',
                    )}
                    aria-hidden="true"
                  >
                    {layers[l] && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block font-body text-sm text-ink">{layerMeta[l].label}</span>
                    <span className="block font-body text-xs text-ink-faint">{layerMeta[l].hint}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.aside
            key={selectedId}
            initial={desktop ? { opacity: 0, x: 24 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={desktop ? { opacity: 0, x: 24 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            aria-label="Selected fault"
            className="absolute inset-x-0 bottom-0 z-30 max-h-[78%] overflow-y-auto rounded-t-lg bg-surface shadow-float ring-1 ring-line lg:inset-y-3 lg:left-auto lg:right-3 lg:max-h-none lg:w-[400px] lg:rounded-md"
          >
            {selectedIncident ? (
              <FaultPanel
                incident={selectedIncident}
                review={toReview.get(selectedIncident.id) ?? 0}
                onClose={() => select(null)}
              />
            ) : selectedPrediction ? (
              <div className="py-3">
                <PredictionDetail prediction={selectedPrediction} view="operator" onBack={() => select(null)} onWarn={() => toast({ title: 'Forecast warnings arrive with Phase 4', body: 'Nothing was sent.' })} />
              </div>
            ) : null}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <div className="flex items-center gap-1 rounded-sm bg-canvas p-0.5 lg:hidden">
          <PaneButton active={mobilePane === 'queue'} onClick={() => setMobilePane('queue')} icon={<ListIcon className="h-4 w-4" />} label="Queue" />
          <PaneButton active={mobilePane === 'map'} onClick={() => setMobilePane('map')} icon={<MapIcon className="h-4 w-4" />} label="Map" />
        </div>
        <p className="hidden font-body text-sm text-ink-muted lg:block">
          <span className="font-mono text-ink">{queue.confirm.length + queue.assign.length + queue.active.length}</span> open ·{' '}
          <span className="font-mono text-ink">{queue.confirm.length}</span> to confirm ·{' '}
          <span className="font-mono text-ink">{queue.assign.length}</span> need a team
        </p>
        <div className="ml-auto hidden items-center gap-1 rounded-sm bg-canvas p-0.5 lg:flex">
          <PaneButton active={view === 'map'} onClick={() => setView('map')} icon={<MapIcon className="h-4 w-4" />} label="Map" />
          <PaneButton active={view === 'table'} onClick={() => setView('table')} icon={<Table2Icon className="h-4 w-4" />} label="Table" kbd="V" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {desktop ? (
          view === 'table' ? (
            <BoardTable
              incidents={mapIncidents}
              crews={crews}
              toReview={toReview}
              onOpen={(id) => {
                setView('map');
                select(id);
              }}
            />
          ) : (
            <>
              {queuePane}
              {mapPane}
            </>
          )
        ) : mobilePane === 'queue' ? (
          queuePane
        ) : (
          mapPane
        )}
      </div>
    </div>
  );
}

function PaneButton({ active, onClick, icon, label, kbd }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; kbd?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 font-body text-xs font-medium', active ? 'bg-raised text-ink ring-1 ring-line-strong' : 'text-ink-muted hover:text-ink')}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

function QueueRow({ incident: i, active, review, team, onSelect }: { incident: Incident; active: boolean; review: number; team?: string; onSelect: () => void }) {
  const restored = i.status === 'restored';
  const level = waitLevel(i.minutesAgo);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn('relative flex w-full gap-3 px-3 py-3 text-left transition-colors', active ? 'bg-raised' : 'hover:bg-raised')}
    >
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: restored ? 'var(--status-restored)' : issueMeta[i.issue].color }} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate font-body text-sm font-medium text-ink">{i.place}</span>
          {!restored && (
            <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: waitColor[level] }} title="Time since the first report">
              {shortDuration(i.minutesAgo)}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate font-body text-xs text-ink-muted">
          {issueMeta[i.issue].short} · {i.reports} {i.reports === 1 ? 'report' : 'reports'} · ~{i.households.toLocaleString()} homes
          {i.scope && ` · ${scopeMeta[i.scope].label}`}
        </span>
        {(team || i.etaAt || review > 0) && (
          <span className="mt-1.5 flex flex-wrap gap-1.5 font-body text-2xs">
            {team && <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-ink-muted">{team}</span>}
            {i.etaAt && <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-ink-muted">Back {formatEta(i.etaAt)}</span>}
            {review > 0 && <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-status-low">{review} to review</span>}
          </span>
        )}
      </span>
    </button>
  );
}

function FaultPanel({ incident, review, onClose }: { incident: Incident; review: number; onClose: () => void }) {
  const feed = useSharedOutageFeed();
  const { allowed } = useOperations();
  const toast = useToast();
  const area = areaById[incident.areaId];
  const cause = incident.cause && incident.cause in CAUSES ? CAUSES[incident.cause as Cause] : null;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-line bg-surface p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <IssueTag issue={incident.issue} />
            <Tag color={statusMeta[incident.status].color}>{statusMeta[incident.status].label}</Tag>
          </div>
          <h2 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-ink">{incident.place}</h2>
          <p className="font-body text-xs text-ink-muted">
            {incident.area}
            {area && ` · ${area.feeder}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-raised hover:text-ink">
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-3 border-b border-line">
        {[
          { k: 'No light', v: incident.reports },
          { k: 'Have light nearby', v: incident.lightOn ?? 0 },
          { k: 'Off for', v: shortDuration(incident.minutesAgo) },
        ].map((s) => (
          <div key={s.k} className="border-r border-line p-3 last:border-r-0">
            <dt className="font-body text-2xs text-ink-faint">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-lg text-ink">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3 p-4">
        {incident.scope && (
          <div className="flex items-start gap-3 rounded-sm bg-canvas p-3">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-medium text-ink">
                {scopeMeta[incident.scope].label} · ~{incident.households.toLocaleString()} homes
              </p>
              <p className="mt-0.5 font-body text-xs text-ink-muted">{scopeMeta[incident.scope].staffHint}</p>
              {incident.asked ? <p className="mt-1 font-body text-2xs text-ink-faint">{incident.asked} asked, no answer yet</p> : null}
            </div>
            <AskNearbyButton incident={incident} onDone={feed.refresh} />
          </div>
        )}
        {(cause || incident.etaAt) && (
          <p className="font-body text-xs text-ink-muted">
            {cause}
            {cause && incident.etaAt && ' · '}
            {incident.etaAt && `Back ${formatEta(incident.etaAt)}`}
          </p>
        )}
        {incident.note && <p className="rounded-sm bg-canvas p-3 font-body text-sm text-ink-muted">{incident.note}</p>}
        {review > 0 && (
          <Link href={`/operator/outages/${incident.id}`} className="block rounded-sm bg-canvas p-3 font-body text-sm text-status-low hover:text-ink">
            {review} report{review === 1 ? '' : 's'} flagged or waiting for review →
          </Link>
        )}

        {incident.status === 'reported' && allowed('triage_reports') && (
          <p className="font-body text-xs text-ink-faint">
            Press <Kbd>C</Kbd> to confirm without leaving the queue.
          </p>
        )}
        {allowed('dispatch_teams') && (
          <OperatorActions
            incident={incident}
            crews={feed.crews}
            onStatus={async (s) => {
              if (await feed.setStatus(incident.id, s)) toast({ title: s === 'restored' ? 'Marked as restored' : 'Status updated', body: incident.place });
            }}
            onDispatch={async (teamId) => {
              const team = feed.crews.find((c) => c.id === teamId);
              if (await feed.dispatchCrew(incident.id, teamId)) toast({ title: `${team?.name ?? 'Team'} dispatched`, body: incident.place });
            }}
          />
        )}
        {incident.status !== 'restored' && allowed('dispatch_teams') && <IncidentInfoForm incident={incident} />}

        <Link
          href={`/operator/outages/${incident.id}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-sm font-body text-sm text-ink-muted ring-1 ring-line hover:text-ink"
        >
          Full details, timeline and reports
          <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
          <Kbd>↵</Kbd>
        </Link>
      </div>
    </div>
  );
}

type SortKey = 'reports' | 'households' | 'minutesAgo';

/** Every open fault as a sortable table, for nights with too many pins to read. */
function BoardTable({
  incidents,
  crews,
  toReview,
  onOpen,
}: {
  incidents: Incident[];
  crews: Array<{ id: string; name: string }>;
  toReview: Map<string, number>;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('minutesAgo');
  const rows = useMemo(() => {
    const open = incidents.filter((i) => i.status !== 'restored');
    return [...open].sort((a, b) => b[sort] - a[sort]);
  }, [incidents, sort]);
  const th = (key: SortKey | null, label: string, right = false) => (
    <th className={cn('px-3 py-2 font-medium', right && 'text-right')}>
      {key ? (
        <button type="button" onClick={() => setSort(key)} className={cn('uppercase tracking-wide', sort === key ? 'text-ink' : 'hover:text-ink')}>
          {label}
          {sort === key && ' ↓'}
        </button>
      ) : (
        label
      )}
    </th>
  );
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface">
      <table className="w-full min-w-[900px] font-body text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line text-left font-mono text-2xs uppercase tracking-wide text-ink-faint">
            {th(null, 'Place')}
            {th(null, 'Issue')}
            {th(null, 'Status')}
            {th('reports', 'Reports', true)}
            {th('households', 'Homes', true)}
            {th('minutesAgo', 'Off for', true)}
            {th(null, 'Team')}
            {th(null, 'Expected back')}
            {th(null, 'Review')}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((i) => (
            <tr key={i.id} onClick={() => onOpen(i.id)} className="cursor-pointer hover:bg-raised">
              <td className="max-w-[280px] truncate px-3 py-2.5 text-ink">
                <Link href={`/operator/outages/${i.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {i.place}
                </Link>
                <span className="block text-xs text-ink-faint">{i.area}</span>
              </td>
              <td className="px-3 py-2.5">
                <IssueTag issue={i.issue} />
              </td>
              <td className="px-3 py-2.5 text-ink-muted">{statusMeta[i.status].label}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">{i.reports}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-muted">{i.households.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums" style={{ color: waitColor[waitLevel(i.minutesAgo)] }}>
                {shortDuration(i.minutesAgo)}
              </td>
              <td className="px-3 py-2.5 text-ink-muted">{crews.find((c) => c.id === i.crewId)?.name ?? '—'}</td>
              <td className="px-3 py-2.5 text-ink-muted">{i.etaAt ? formatEta(i.etaAt).replace('by ', '') : '—'}</td>
              <td className="px-3 py-2.5 text-status-low">{toReview.get(i.id) || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-10 text-center font-body text-sm text-ink-muted">No open faults.</p>}
    </div>
  );
}
