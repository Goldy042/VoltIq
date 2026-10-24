'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, LocateFixedIcon, PlusIcon, SearchIcon, SparklesIcon, SunIcon, XIcon } from 'lucide-react';
import { MapCanvas, type FlyTarget } from '@/components/map';
import { BottomSheet, type SheetSnap } from '@/components/map/BottomSheet';
import { MapKey } from '@/components/map/MapKey';
import { PredictionDetail } from '@/components/map/PredictionDetail';
import { LocationCheck } from '@/components/map/LocationCheck';
import { IconButton } from '@/components/ui/IconButton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IssueIcon } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { locateBest, locateErrorText, type Fix } from '@/lib/locate';
import { describeLocation, resolveArea } from '@/lib/address';
import { distanceMeters, formatAgo } from '@/lib/geo';
import { formatEta } from '@/lib/incidents';
import { placeVsOutage } from '@/lib/checks';
import { scopeMeta } from '@/lib/footprint';
import { placeName, useProfile } from '@/lib/profile';
import { areaById, incidentColor, issueMeta, predictions, statusMeta, type Incident, type Prediction } from '@/data/nsukka';

type Filter = 'all' | 'no_power' | 'low';

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'no_power', label: 'No light' },
  { id: 'low', label: 'Low voltage' },
];

/** Outages within this distance of your place are "near you". */
const NEAR_M = 2000;
/** Outages this busy get a full pin wherever they are. */
const BIG_REPORTS = 8;
/** Your place counts as inside an outage this far beyond its edge. */

const ease = [0.23, 1, 0.32, 1] as const;

function distanceText(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

const statusShort: Record<Incident['status'], string> = {
  reported: 'Reported',
  confirmed: 'EEDC confirmed',
  crew_dispatched: 'Team assigned',
  restored: 'Fixed',
};

/**
 * The resident's live map. Calm by design (after Airbnb's "less is more" map):
 * your place first, then what's near you, then the rest of Nsukka. Quiet
 * outages are small dots until you zoom in; report dots appear only up close;
 * forecasts are off unless you ask. Tapping an outage opens a short preview
 * with a link to its full page.
 */
export function MapScreen({ initialFocus }: { initialFocus?: string }) {
  const toast = useToast();
  const { primary, signedIn, correctArea } = useProfile();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { incidents, crews, dots, lastEvent, addReport, source, loaded, offline } = useSharedOutageFeed();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showForecasts, setShowForecasts] = useState(false);
  const [showFixed, setShowFixed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [sheetPx, setSheetPx] = useState(196);
  const home = useMemo(() => ({ lat: primary.lat, lng: primary.lng }), [primary.lat, primary.lng]);
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(signedIn ? home : null);
  const [affected, setAffected] = useState<string[]>([]);

  const matches = useCallback(
    (i: Incident) => {
      const q = query.trim().toLowerCase();
      if (q && !`${i.place} ${i.area} ${areaById[i.areaId]?.feeder ?? ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'no_power') return i.issue === 'no_power';
      if (filter === 'low') return i.issue !== 'no_power';
      return true;
    },
    [query, filter],
  );

  const withDistance = useMemo(
    () => incidents.filter(matches).map((i) => ({ i, d: distanceMeters(i, home) })),
    [incidents, matches, home],
  );
  const open = withDistance.filter((x) => x.i.status !== 'restored');
  const fixed = withDistance.filter((x) => x.i.status === 'restored').sort((a, b) => a.i.minutesAgo - b.i.minutesAgo);
  const near = signedIn ? open.filter((x) => x.d <= NEAR_M).sort((a, b) => a.d - b.d) : [];
  const elsewhere = open.filter((x) => !near.includes(x)).sort((a, b) => b.i.reports - a.i.reports);
  // On the outage's dark blocks, or just around them (where we ask "do you have light?").
  const mine = signedIn ? incidents.find((i) => i.status !== 'restored' && placeVsOutage(home, i) === 'inside') : undefined;
  const closeBy = signedIn && !mine ? incidents.find((i) => i.status !== 'restored' && placeVsOutage(home, i) === 'near') : undefined;

  const nearIds = useMemo(() => new Set(near.map((x) => x.i.id)), [near]);
  const prominent = useCallback((i: Incident) => nearIds.has(i.id) || i.reports >= BIG_REPORTS || i.id === mine?.id, [nearIds, mine?.id]);
  const visiblePredictions = showForecasts ? predictions : [];
  const mapIncidents = useMemo(() => withDistance.map((x) => x.i), [withDistance]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) ?? null;
  const selectedPrediction = selectedIncident ? null : visiblePredictions.find((p) => p.id === selectedId) ?? null;

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const item = incidents.find((i) => i.id === id) ?? predictions.find((p) => p.id === id);
      if (!item) return;
      setSnap('half');
      setFlyTo({ lat: item.lat, lng: item.lng, zoom: item.kind === 'prediction' ? 14.6 : 15.8, key: Date.now() });
    },
    [incidents],
  );

  // Arriving from a link: wait for the live feed, then open that outage once.
  const focused = useRef(false);
  useEffect(() => {
    if (!initialFocus || !loaded || focused.current) return;
    const t = window.setTimeout(() => {
      focused.current = true;
      select(initialFocus);
    }, 700);
    return () => window.clearTimeout(t);
  }, [initialFocus, loaded, select]);

  /* ---- "Where am I?" ---- */
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [correctionKey, setCorrectionKey] = useState(0);
  const cancelLocate = useRef<() => void>(() => {});
  useEffect(() => () => cancelLocate.current(), []);
  const match = useMemo(
    () => (fix ? resolveArea(fix, fix.accuracy) : null),
    // Recompute after a correction is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fix, correctionKey],
  );

  const locate = () => {
    cancelLocate.current();
    setLocating(true);
    setCheckOpen(true);
    setFix(null);
    let first = true;
    cancelLocate.current = locateBest({
      onFix: (f) => {
        setFix(f);
        setUser({ lat: f.lat, lng: f.lng });
        if (first) setFlyTo({ lat: f.lat, lng: f.lng, zoom: 16, key: Date.now() });
        first = false;
      },
      onDone: (f) => {
        setLocating(false);
        setFix(f);
        setUser({ lat: f.lat, lng: f.lng });
      },
      onError: (err) => {
        setLocating(false);
        setCheckOpen(false);
        setFix(null);
        if (signedIn) {
          setUser(home);
          setFlyTo({ ...home, zoom: 15.5, key: Date.now() });
        }
        toast({
          title: signedIn ? `Couldn’t find you — showing your ${placeName(primary).toLowerCase()}` : 'Couldn’t find your location',
          body: locateErrorText[err],
          icon: <LocateFixedIcon className="h-4 w-4" />,
          color: 'var(--status-low)',
        });
      },
    });
  };

  const pickArea = (areaId: string) => {
    if (!fix) return;
    correctArea(fix, areaId);
    setCorrectionKey((k) => k + 1);
    toast({ title: `Got it — ${areaById[areaId]?.name}`, body: 'We’ll remember this for the spot you’re in.', color: 'var(--accent)' });
    setCheckOpen(false);
  };

  const join = async (i: Incident) => {
    setAffected((a) => [...a, i.id]);
    const inside = placeVsOutage(home, i) !== null;
    const result = await addReport(i.id, 'You', inside ? home : undefined);
    if (!result && source === 'live') {
      setAffected((a) => a.filter((x) => x !== i.id));
      return;
    }
    toast({
      title: result?.outcome === 'already_counted' ? 'You’re already counted' : 'You’ve been counted',
      body: result?.outcome === 'already_counted' ? 'You reported this a few minutes ago.' : `Your report joins the outage at ${i.place}`,
      icon: <IssueIcon issue={i.issue} className="h-4 w-4" />,
      color: issueMeta[i.issue].color,
    });
  };

  /* ---- Panel pieces ---- */

  const statusLine = !loaded
    ? 'Loading the live map…'
    : offline
      ? 'Can’t reach the live map — showing the last update'
      : open.length === 0
        ? 'No outages reported right now'
        : `${open.length} ${open.length === 1 ? 'outage' : 'outages'} across Nsukka`;

  const atYourPlace = signedIn ? (
    mine ? (
      <Link
        href={`/outages/${mine.id}`}
        className="flex items-center gap-3 rounded-lg p-3 text-white transition-[filter] hover:brightness-110"
        style={{ backgroundColor: incidentColor(mine) }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <IssueIcon issue={mine.issue} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-sm font-semibold">
            {issueMeta[mine.issue].label} on your {placeName(primary).toLowerCase()}’s block
          </span>
          <span className="block truncate font-body text-xs text-white/80">
            {statusShort[mine.status]} · {mine.reports} neighbours{mine.etaAt ? ` · back ${formatEta(mine.etaAt)}` : ''}
          </span>
        </span>
        <ArrowRightIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    ) : closeBy ? (
      <Link href={`/outages/${closeBy.id}`} className="flex items-center gap-3 rounded-lg bg-canvas p-3 transition-colors hover:bg-sunken">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: incidentColor(closeBy) }}>
          <IssueIcon issue={closeBy.issue} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-sm font-semibold text-ink">
            {issueMeta[closeBy.issue].label} near your {placeName(primary).toLowerCase()}
          </span>
          <span className="block truncate font-body text-xs text-ink-muted">
            {closeBy.reports} {closeBy.reports === 1 ? 'neighbour' : 'neighbours'} close by. Do you have light? Tell us.
          </span>
        </span>
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    ) : (
      <div className="flex items-center gap-3 rounded-lg bg-[#e6f5ed] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-restored text-white">
          <SunIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-sm font-semibold text-ink">Nothing reported at your {placeName(primary).toLowerCase()}</span>
          <span className="block font-body text-xs text-ink-muted">If your light is off, you could be the first to report it.</span>
        </span>
      </div>
    )
  ) : (
    <div className="rounded-lg bg-canvas p-3">
      <p className="font-body text-sm font-semibold text-ink">Is it just you?</p>
      <p className="mt-0.5 font-body text-xs text-ink-muted">
        <Link href="/signup" className="font-medium text-ink underline underline-offset-2">
          Save your place
        </Link>{' '}
        to see outages near you and hear when light is back.
      </p>
    </div>
  );

  const controls = (
    <div className="space-y-2.5">
      <label className="relative block">
        <span className="sr-only">Search by place, area or feeder</span>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place, e.g. Odenigwe"
          className="h-10 w-full rounded-full border border-line bg-canvas pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'h-8 rounded-full px-3 font-body text-xs font-medium transition-colors',
              filter === f.id ? 'bg-ink text-canvas' : 'bg-canvas text-ink-muted hover:text-ink',
            )}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showForecasts}
          onClick={() => {
            setShowForecasts((v) => !v);
            if (selectedPrediction) setSelectedId(null);
          }}
          className={cn(
            'ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-body text-xs font-medium transition-colors',
            showForecasts ? 'bg-status-predicted text-white' : 'bg-canvas text-ink-muted hover:text-ink',
          )}
        >
          <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Forecasts
        </button>
      </div>
    </div>
  );

  const rowProps = (i: Incident) => ({
    onSelect: () => select(i.id),
    onHover: (on: boolean) => setHoverId(on ? i.id : null),
    active: i.id === selectedId,
  });

  const lists = (
    <div className="space-y-5">
      {signedIn && (
        <Section title="Near you" count={near.length}>
          {near.length ? (
            near.map(({ i, d }) => <OutageRow key={i.id} incident={i} meta={distanceText(d)} {...rowProps(i)} />)
          ) : (
            <p className="px-1 font-body text-sm text-ink-muted">Nothing within {NEAR_M / 1000} km of your {placeName(primary).toLowerCase()}.</p>
          )}
        </Section>
      )}
      <Section title={signedIn ? 'Elsewhere in Nsukka' : 'Across Nsukka'} count={elsewhere.length}>
        {elsewhere.length ? (
          elsewhere.map(({ i, d }) => <OutageRow key={i.id} incident={i} meta={signedIn ? distanceText(d) : i.area} {...rowProps(i)} />)
        ) : (
          <p className="px-1 font-body text-sm text-ink-muted">{loaded ? (query || filter !== 'all' ? 'Nothing matches.' : 'Light is on everywhere else.') : '…'}</p>
        )}
      </Section>
      {showForecasts && (
        <Section title="Forecasts" count={visiblePredictions.length} note="Demo data until forecasts go live">
          {visiblePredictions.map((p) => (
            <ForecastRow key={p.id} prediction={p} onSelect={() => select(p.id)} />
          ))}
        </Section>
      )}
      {fixed.length > 0 && (
        <section>
          <button
            type="button"
            aria-expanded={showFixed}
            onClick={() => setShowFixed((v) => !v)}
            className="flex w-full items-center justify-between px-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-ink"
          >
            Fixed in the last few hours · {fixed.length}
            <ChevronDownIcon className={cn('h-4 w-4 transition-transform', showFixed && 'rotate-180')} aria-hidden="true" />
          </button>
          <AnimatePresence initial={false}>
            {showFixed && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 space-y-1">
                  {fixed.map(({ i }) => (
                    <OutageRow key={i.id} incident={i} meta={i.area} {...rowProps(i)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );

  const preview = selectedIncident ? (
    <OutagePreview
      incident={selectedIncident}
      distance={signedIn ? distanceMeters(selectedIncident, home) : null}
      crewName={crews.find((c) => c.id === selectedIncident.crewId)?.name}
      signedIn={signedIn}
      affected={affected.includes(selectedIncident.id)}
      onJoin={() => void join(selectedIncident)}
      onClose={() => select(null)}
    />
  ) : null;

  const header = (
    <div className="px-4 pb-3 pt-1 lg:pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-tight text-ink">Nsukka right now</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-body text-xs text-ink-muted">
            <span className={cn('h-1.5 w-1.5 rounded-full', offline ? 'bg-status-low' : 'bg-status-restored')} aria-hidden="true" />
            {statusLine}
          </p>
        </div>
        <ButtonLink href="/report" size="sm" leading={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
          Report
        </ButtonLink>
      </div>
      <div className="mt-3">{atYourPlace}</div>
    </div>
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-sunken">
      <div className="absolute inset-0">
        <MapCanvas
          incidents={mapIncidents}
          predictions={visiblePredictions}
          dots={dots.filter((d) => mapIncidents.some((i) => i.id === d.incidentId))}
          crews={crews}
          selectedId={selectedId}
          highlightId={hoverId}
          prominent={prominent}
          onSelect={select}
          flyTo={flyTo}
          user={user}
          userAccuracy={fix?.accuracy}
          bump={lastEvent ? { incidentId: lastEvent.incidentId, key: lastEvent.key } : null}
          padding={desktop ? { left: 416 } : { bottom: sheetPx }}
        />
      </div>

      {/* Back, on phones (desktop has it in the panel) */}
      <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+12px)] z-30 lg:hidden">
        <Link href="/dashboard" aria-label="Back to home" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-float">
          <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {/* Map controls */}
      <div
        className="absolute right-3 z-30 flex flex-col gap-2.5 transition-[bottom,opacity] duration-300 ease-out lg:bottom-6 lg:right-6"
        style={desktop ? undefined : { bottom: sheetPx + 12, opacity: snap === 'full' ? 0 : 1, pointerEvents: snap === 'full' ? 'none' : undefined }}
      >
        <MapKey />
        <IconButton floating size="lg" label="Show my location" icon={<LocateFixedIcon className="h-5 w-5" />} onClick={locate} />
      </div>

      <div
        className="absolute left-3 z-30 transition-[bottom,opacity] duration-300 ease-out lg:bottom-6 lg:left-[432px]"
        style={desktop ? undefined : { bottom: sheetPx + 12, opacity: snap === 'full' ? 0 : 1, pointerEvents: snap === 'full' ? 'none' : undefined }}
      >
        <AnimatePresence>
          {checkOpen && (
            <LocationCheck
              fix={fix}
              match={match}
              locating={locating}
              summary={fix && match ? describeLocation(fix).summary : undefined}
              onPick={pickArea}
              onClose={() => {
                cancelLocate.current();
                setLocating(false);
                setCheckOpen(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {desktop ? (
        <>
          <aside className="absolute bottom-4 left-4 top-4 z-40 flex w-[400px] flex-col overflow-hidden rounded-xl bg-surface shadow-float">
            <Link href="/dashboard" className="mx-4 mt-3 inline-flex w-fit items-center gap-1 rounded-full font-body text-xs text-ink-muted hover:text-ink">
              <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Home
            </Link>
            {header}
            <div className="border-y border-line px-4 py-3">{controls}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              {selectedPrediction ? (
                <PredictionDetail prediction={selectedPrediction} view="citizen" onBack={() => select(null)} onWarn={() => {}} />
              ) : (
                lists
              )}
            </div>
          </aside>
          {/* Preview floats over the map, beside the panel */}
          <AnimatePresence>
            {preview && (
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.25, ease }}
                className="absolute bottom-6 left-[432px] z-40 w-[360px]"
              >
                {preview}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <BottomSheet snap={snap} onSnapChange={setSnap} header={header} peekHeight={196} onVisibleHeight={setSheetPx}>
          <div className="px-4 pb-6">
            {preview ? (
              <div className="pt-1">{preview}</div>
            ) : selectedPrediction ? (
              <PredictionDetail prediction={selectedPrediction} view="citizen" onBack={() => select(null)} onWarn={() => {}} />
            ) : (
              <div className="space-y-5 pt-1">
                {controls}
                {lists}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function Section({ title, count, note, children }: { title: string; count: number; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-baseline justify-between px-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
        <span className="font-mono tabular-nums">{count}</span>
      </h2>
      {note && <p className="px-1 font-body text-xs text-ink-faint">{note}</p>}
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}

function OutageRow({
  incident: i,
  meta,
  active,
  onSelect,
  onHover,
}: {
  incident: Incident;
  meta: string;
  active: boolean;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const restored = i.status === 'restored';
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors', active ? 'bg-sunken' : 'hover:bg-canvas')}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: incidentColor(i) }}
        aria-hidden="true"
      >
        {restored ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : <IssueIcon issue={i.issue} className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-semibold text-ink">{i.place}</span>
        <span className="block truncate font-body text-xs text-ink-muted">
          {restored ? 'Light restored' : `${issueMeta[i.issue].label} · ${i.reports} ${i.reports === 1 ? 'report' : 'reports'}`} · {statusShort[i.status]}
        </span>
      </span>
      <span className="shrink-0 font-body text-xs tabular-nums text-ink-faint">{meta}</span>
    </button>
  );
}

function ForecastRow({ prediction: p, onSelect }: { prediction: Prediction; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-canvas">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-predicted text-white" aria-hidden="true">
        <SparklesIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-semibold text-ink">{p.area}</span>
        <span className="block truncate font-body text-xs text-ink-muted">
          {p.confidence}% chance · {p.window}
        </span>
      </span>
    </button>
  );
}

/** Short card for a tapped outage; the full story is on its own page. */
function OutagePreview({
  incident: i,
  distance,
  crewName,
  signedIn,
  affected,
  onJoin,
  onClose,
}: {
  incident: Incident;
  distance: number | null;
  crewName?: string;
  signedIn: boolean;
  affected: boolean;
  onJoin: () => void;
  onClose: () => void;
}) {
  const restored = i.status === 'restored';
  return (
    <article className="rounded-xl bg-surface p-4 shadow-float ring-1 ring-line lg:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: incidentColor(i) }} aria-hidden="true">
          {restored ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : <IssueIcon issue={i.issue} className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-xs font-semibold" style={{ color: incidentColor(i) }}>
            {restored ? 'Light restored' : issueMeta[i.issue].label} · {statusMeta[i.status].label.replace('Crew on the way', 'Team assigned')}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-bold leading-snug tracking-tight text-ink">{i.place}</h3>
          <p className="mt-0.5 font-body text-xs text-ink-muted">
            {i.reports} {i.reports === 1 ? 'neighbour' : 'neighbours'} · ~{i.households.toLocaleString()} homes{i.scope ? ` (${scopeMeta[i.scope].label.toLowerCase()})` : ''} · started {formatAgo(i.minutesAgo)}
            {distance !== null && ` · ${distanceText(distance)} away`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sunken">
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!restored && (i.etaAt || crewName) && (
        <p className="mt-3 rounded-md bg-canvas px-3 py-2 font-body text-sm text-ink">
          {crewName && `${crewName} is on it.`} {i.etaAt && `Expected back ${formatEta(i.etaAt)}.`}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {!restored && signedIn && (
          <Button size="md" className="flex-1" onClick={onJoin} disabled={affected} leading={affected ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : undefined}>
            {affected ? 'Counted' : 'I have this too'}
          </Button>
        )}
        <ButtonLink href={`/outages/${i.id}`} size="md" variant="secondary" className="flex-1" trailing={<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}>
          Details
        </ButtonLink>
      </div>
    </article>
  );
}
