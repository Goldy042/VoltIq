'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRightIcon, CheckIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { AppHeader } from '@/components/app/AppHeader';
import { AppTabBar } from '@/components/app/AppTabBar';
import { HourlyOutlook } from '@/components/dashboard/HourlyOutlook';
import { RepairTracker } from '@/components/dashboard/RepairTracker';
import { ReadyChecklist } from '@/components/dashboard/ReadyChecklist';
import { SupplyWeek } from '@/components/dashboard/SupplyWeek';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { IssueIcon, StatusBadge } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOutageFeed } from '@/hooks/useOutageFeed';
import {
  areaById,
  nearestArea,
  bandHours,
  hourlyOutlook,
  issueMeta,
  predictions,
  statusMeta,
  supplyWeek,
  type Incident,
} from '@/data/nsukka';
import { distanceMeters, formatAgo } from '@/lib/geo';
import { describeLocation } from '@/lib/address';
import { placeName, useProfile } from '@/lib/profile';
import { LightBackPrompt } from '@/components/dashboard/LightBackPrompt';
import { MyReportsList } from '@/components/dashboard/MyReportsList';
import { useMyReports } from '@/hooks/useMyReports';
import { useLightChecks } from '@/hooks/useLightChecks';
import { LightCheckCard } from '@/components/outage/LightCheckCard';
import { placeVsOutage, type CheckAnswer } from '@/lib/checks';
import { distanceToCells } from '@/lib/footprint';

/** Reports shown on the dashboard; the rest are on /reports. */
const PREVIEW = 4;

const StreetGlow = dynamic(() => import('@/components/dashboard/StreetGlow').then((m) => m.StreetGlow), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0b0b0d]" />,
});

const ease = [0.23, 1, 0.32, 1] as const;
const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + i * 0.07, duration: 0.55, ease },
});

/**
 * Big status word, like "Rain" in a weather app. Until you've said it's off
 * at your place too, an outage on your block is "nearby", not yours.
 */
function statusWord(i?: Incident, backOn?: Incident, confirmed = true) {
  if (!i) return { word: backOn ? 'Light is back' : 'Light on', color: '#3ccf8a' };
  const near = confirmed ? '' : ' nearby';
  if (i.issue === 'no_power') return { word: `No light${near}`, color: '#ff5c5f' };
  if (i.issue === 'low_voltage') return { word: `Low voltage${near}`, color: '#ff9a3d' };
  return { word: `Unstable${near}`, color: '#ff9a3d' };
}

/**
 * Your outage: one you reported (or said "no light" to), else one whose dark
 * blocks your place is on. Being in the same area isn't enough: five homes
 * in Odenigwe aren't all of Odenigwe.
 */
function pickMine(list: Incident[], home: { lat: number; lng: number }, isMine: (i: Incident) => boolean, isLit: (i: Incident) => boolean) {
  return list
    .filter((i) => isMine(i) || (placeVsOutage(home, i) === 'inside' && !isLit(i)))
    .sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || distanceMeters(a, home) - distanceMeters(b, home))[0];
}

export function DashboardScreen() {
  const toast = useToast();
  const reducedMotion = Boolean(useReducedMotion());
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { incidents, crews, dots, addReport, source: feedSource } = useOutageFeed();
  const [counted, setCounted] = useState(false);
  const [greeting, setGreeting] = useState('Hello');
  const [pastHero, setPastHero] = useState(false);
  const [panelWidth, setPanelWidth] = useState(520);
  const heroRef = useRef<HTMLElement>(null);

  const { profile, primary } = useProfile();
  const home = useMemo(() => ({ lat: primary.lat, lng: primary.lng }), [primary.lat, primary.lng]);
  // A place saved before areas were seeded may have no area yet; fall back to the nearest.
  const area = areaById[primary.areaId] ?? nearestArea(primary);
  // Changes whenever any outage changes status, so history and "is your light back?" catch up with EEDC.
  const feedVersion = useMemo(() => incidents.map((i) => `${i.id}:${i.status}`).join('|'), [incidents]);
  const history = useMyReports(`${feedVersion}|${counted}`);
  const checks = useLightChecks();
  // Answered on this visit: their card stays to say thanks.
  const [justAnswered, setJustAnswered] = useState<string[]>([]);
  const reported = useMemo(
    () => new Set(history.reports.filter((r) => r.incidentId && r.status !== 'withdrawn').map((r) => r.incidentId!)),
    [history.reports],
  );
  const isMine = (i: Incident) => reported.has(i.id) || checks.answers[i.id] === 'off';
  const isLit = (i: Incident) => checks.answers[i.id] === 'on';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mine = useMemo(() => pickMine(incidents.filter((i) => i.status !== 'restored'), home, isMine, isLit), [incidents, home, reported, checks.answers]);
  // Fixed in the last few hours where you live: say so instead of quietly going back to "no problems".
  const backOn = useMemo(
    () => (mine ? undefined : pickMine(incidents.filter((i) => i.status === 'restored'), home, (i) => reported.has(i.id), () => false)),
    [mine, incidents, home, reported],
  );
  // Outages around (not on) your place you haven't told us about: ask "do you have light?".
  const toAsk = useMemo(
    () =>
      incidents
        .filter((i) => i.id !== mine?.id && i.status !== 'restored' && i.issue === 'no_power' && !reported.has(i.id))
        .filter((i) => placeVsOutage(home, i) && (!checks.answers[i.id] || justAnswered.includes(i.id)))
        .map((i) => ({ i, d: i.cells?.off.length ? distanceToCells(home, i.cells.off) : Math.max(0, distanceMeters(i, home) - i.radius) }))
        .sort((a, b) => a.d - b.d)[0],
    [incidents, mine?.id, reported, home, checks.answers, justAnswered],
  );
  // Your place is on the outage's blocks but you haven't said it's off for you too.
  const confirmed = !mine || counted || isMine(mine);
  // A different (or newly fixed) outage: "I have this too" applies afresh.
  useEffect(() => setCounted(false), [mine?.id]);
  const crew = mine?.crewId ? crews.find((c) => c.id === mine.crewId) : undefined;
  const forecast = predictions.find((p) => p.areaId === area.id || p.area.includes(area.name));
  const status = statusWord(mine, backOn, confirmed);

  const answerCheck = async (incidentId: string, value: CheckAnswer) => {
    await checks.answer(incidentId, value);
    setJustAnswered((ids) => [...ids, incidentId]);
    if (value === 'off') void history.reload();
  };

  const lightOnHere = async () => {
    if (!mine) return;
    try {
      await answerCheck(mine.id, 'on');
    } catch (e) {
      toast({ title: 'Couldn’t send', body: e instanceof Error ? e.message : 'Try again.' });
    }
  };
  const first = profile.name.split(' ')[0];

  const nearby = useMemo(
    () =>
      incidents
        .filter((i) => i.id !== mine?.id && i.status !== 'restored')
        .map((i) => ({ incident: i, meters: distanceMeters(i, home) }))
        .filter((x) => x.meters < 3500)
        .sort((a, b) => a.meters - b.meters)
        .slice(0, 4),
    [incidents, mine?.id, home],
  );

  // Time-of-day greeting is computed on the client so it matches the reader's clock.
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    setPanelWidth(Math.min(window.innerWidth * 0.5, 560));
  }, []);

  // Header goes light once the night hero scrolls away.
  useEffect(() => {
    const onScroll = () => {
      const hero = heroRef.current;
      if (hero) setPastHero(window.scrollY > hero.offsetTop + hero.offsetHeight - 72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const mapPadding = useMemo(() => (desktop ? { left: panelWidth } : {}), [desktop, panelWidth]);

  // A real report from your default place; the server decides if it's new, a repeat, or too soon.
  const countMe = async () => {
    if (!mine) return;
    setCounted(true);
    const result = await addReport(mine.id, 'You', home);
    if (!result && feedSource === 'live') {
      setCounted(false);
      return;
    }
    toast({
      title: result?.outcome === 'already_counted' ? 'You’re already counted' : 'You’ve been counted',
      body:
        result?.outcome === 'already_counted'
          ? 'You reported this a few minutes ago. Tell us again later if it’s still off.'
          : `Your report joins the outage near ${mine.place}`,
      icon: <IssueIcon issue={mine.issue} className="h-4 w-4" />,
      color: issueMeta[mine.issue].color,
    });
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-16">
      <AppHeader tone={pastHero ? 'day' : 'night'} />
      <LightBackPrompt refreshKey={feedVersion} />

      {/* ---- Hero: your street, tonight ---- */}
      <section ref={heroRef} aria-labelledby="status-word" className="relative bg-[#0b0b0d] text-white lg:h-[600px]">
        <div className="relative h-[44svh] min-h-[280px] lg:absolute lg:inset-0 lg:h-auto">
          <StreetGlow home={home} incidents={incidents} dots={dots} padding={mapPadding} reducedMotion={reducedMotion} />
          <Link
            href="/map"
            className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 font-body text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 lg:bottom-8 lg:right-8"
          >
            Open live map <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-6 lg:px-6 lg:pointer-events-none lg:flex lg:h-full lg:items-center lg:py-0">
          <div className="max-w-md lg:pointer-events-auto">
            <motion.p {...rise(0)} className="flex items-center gap-2 font-body text-sm text-white/60">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-pulse-ring absolute inset-0 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              </span>
              {greeting}, {first} · {placeName(primary)}, {describeLocation(primary).summary}
            </motion.p>

            <motion.h1
              {...rise(1)}
              id="status-word"
              className={cn('mt-3 font-display text-5xl font-bold leading-tight tracking-tight', mine?.issue === 'fluctuating' && 'animate-flicker')}
              style={{ color: status.color }}
            >
              {status.word}
            </motion.h1>

            <motion.p {...rise(2)} className="mt-3 font-body text-lg leading-snug text-white/75">
              {mine && !confirmed ? (
                <>
                  <span className="font-semibold text-white">
                    <AnimatedCount value={mine.reports} /> {mine.reports === 1 ? 'neighbour' : 'neighbours'}
                  </span>{' '}
                  on your block reported {issueMeta[mine.issue].label.toLowerCase()}. Is it the same at your place?
                </>
              ) : mine ? (
                <>
                  {issueMeta[mine.issue].description}.{' '}
                  <span className="font-semibold text-white">
                    <AnimatedCount value={mine.reports} /> {mine.reports === 1 ? 'neighbour' : 'neighbours'}
                  </span>{' '}
                  reported it near {mine.place}.
                </>
              ) : backOn ? (
                <>The outage near {backOn.place} has been fixed. Still off at your place? Tell us below.</>
              ) : toAsk ? (
                <>Neighbours near {toAsk.i.place} report no light, but your place isn’t in it.</>
              ) : (
                <>No problems reported in {area.name} right now.</>
              )}
            </motion.p>

            {mine && (
              <motion.dl {...rise(3)} className="mt-6 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-3">
                {[
                  { label: 'Started', value: formatAgo(mine.minutesAgo) },
                  { label: 'Status', value: statusMeta[mine.status].label.replace(' by EEDC', '') },
                  { label: 'Band', value: `${area.band} · ${bandHours[area.band]} hrs/day` },
                ].map((f) => (
                  <div key={f.label} className="px-3 first:pl-0">
                    <dt className="font-body text-xs text-white/50">{f.label}</dt>
                    <dd className="mt-0.5 font-body text-sm font-semibold">{f.value}</dd>
                  </div>
                ))}
              </motion.dl>
            )}

            <motion.div {...rise(4)} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              {mine && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={countMe}
                  disabled={counted}
                  className="inline-flex h-14 sm:flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 font-body text-base font-semibold text-[#111113] disabled:bg-white/15 disabled:text-white"
                >
                  {counted && <CheckIcon className="h-5 w-5" aria-hidden="true" />}
                  {counted ? 'You’re counted' : confirmed ? 'I have this too' : 'Mine is off too'}
                </motion.button>
              )}
              {mine && !confirmed ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={lightOnHere}
                  className="inline-flex h-14 sm:flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 font-body text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  I have light
                </motion.button>
              ) : (
              <Link
                href="/report"
                className="inline-flex h-14 sm:flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 font-body text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                {mine ? 'Something else' : backOn ? 'Still off at my place' : 'Report a problem'}
              </Link>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---- Below the fold: what's next, and what's been ----
          Phones: one column in the order below (order-1…6).
          Desktop: a main column (forecast, repair, supply) and a sticky
          right rail (get ready, around you, your reports). The column
          wrappers are `contents` on phones so the order classes apply. */}
      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-4 px-4 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 lg:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          {toAsk && (
            <motion.div {...rise(5)} className="order-none">
              <LightCheckCard
                incident={toAsk.i}
                placeLabel={placeName(primary).toLowerCase()}
                distanceM={toAsk.d}
                answered={justAnswered.includes(toAsk.i.id) ? checks.answers[toAsk.i.id] : undefined}
                onAnswer={(v) => answerCheck(toAsk.i.id, v)}
              />
            </motion.div>
          )}
          {forecast && (
            <motion.div {...rise(5)} className="order-1">
              <HourlyOutlook
                hours={hourlyOutlook}
                headline={`Outage likely ${forecast.window.toLowerCase()}`}
                detail={`${forecast.confidence}% chance in ${forecast.area}. ${forecast.reasons[0]}.`}
              />
            </motion.div>
          )}
          {mine && (
            <div className="order-2">
              <RepairTracker incident={mine} crew={crew} />
            </div>
          )}
          <div className="order-4">
            <SupplyWeek days={supplyWeek} promise={bandHours[area.band]} band={area.band} />
          </div>
        </div>

        <aside
          aria-label="Your area at a glance"
          className="contents no-scrollbar lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:pb-2"
        >
          {forecast && (
            <div className="order-3">
              <ReadyChecklist startsAt="7 PM" />
            </div>
          )}

          <section aria-labelledby="nearby-title" className="order-5 rounded-xl bg-surface p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Around you</p>
                <h2 id="nearby-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink lg:text-lg">
                  {nearby.length ? `${nearby.length} ${nearby.length === 1 ? 'problem' : 'problems'} nearby` : 'All clear nearby'}
                </h2>
              </div>
              <Link href="/map" className="font-body text-sm font-semibold text-accent hover:underline">
                Map
              </Link>
            </div>
            {nearby.length === 0 ? (
              <p className="mt-2 font-body text-sm text-ink-muted">No outages reported within 3.5 km of {placeName(primary).toLowerCase()}.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {nearby.map(({ incident: i, meters }) => (
                  <li key={i.id}>
                    <Link href={`/map?focus=${i.id}`} className="group flex items-center gap-3 py-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: issueMeta[i.issue].color }}
                      >
                        <IssueIcon issue={i.issue} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm font-semibold text-ink">{i.area}</span>
                        <span className="block truncate font-body text-xs text-ink-muted">
                          {issueMeta[i.issue].label} · <AnimatedCount value={i.reports} /> reports ·{' '}
                          {i.status === 'crew_dispatched' ? 'crew on the way' : statusMeta[i.status].label.toLowerCase()}
                        </span>
                      </span>
                      <span className="shrink-0 font-body text-xs tabular-nums text-ink-faint">{(meters / 1000).toFixed(1)} km</span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="my-reports" className="order-6 rounded-xl bg-surface p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">History</p>
                <h2 id="my-reports" className="mt-1 font-display text-xl font-bold tracking-tight text-ink lg:text-lg">
                  Your reports
                </h2>
              </div>
              {history.reports.length > PREVIEW && (
                <Link href="/reports" className="inline-flex items-center gap-1 font-body text-sm font-medium text-ink-muted hover:text-ink">
                  See all {history.reports.length}
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="mt-4">
              {!history.loaded ? (
                <p className="font-body text-sm text-ink-muted">Loading your reports…</p>
              ) : history.reports.length === 0 ? (
                <p className="font-body text-sm text-ink-muted">
                  {history.failed ? 'Couldn’t load your reports. Check your connection.' : 'Nothing yet. When your light goes, report it and track the repair here.'}
                </p>
              ) : (
                <MyReportsList reports={history.reports.slice(0, PREVIEW)} onWithdraw={history.withdraw} />
              )}
            </div>
          </section>
        </aside>
      </main>

      <AppTabBar />
    </div>
  );
}
