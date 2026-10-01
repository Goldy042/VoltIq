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
  bandHours,
  hourlyOutlook,
  issueMeta,
  myReports,
  predictions,
  statusMeta,
  supplyWeek,
  type Incident,
} from '@/data/nsukka';
import { distanceMeters, formatAgo } from '@/lib/geo';
import { describeLocation } from '@/lib/address';
import { placeName, useProfile } from '@/lib/profile';

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

/** Big status word, like "Rain" in a weather app. */
function statusWord(i?: Incident) {
  if (!i || i.status === 'restored') return { word: 'Light on', color: '#3ccf8a' };
  if (i.issue === 'no_power') return { word: 'No light', color: '#ff5c5f' };
  if (i.issue === 'low_voltage') return { word: 'Low voltage', color: '#ff9a3d' };
  return { word: 'Unstable', color: '#ff9a3d' };
}


export function DashboardScreen() {
  const toast = useToast();
  const reducedMotion = Boolean(useReducedMotion());
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { incidents, crews, dots, addReport } = useOutageFeed();
  const [counted, setCounted] = useState(false);
  const [greeting, setGreeting] = useState('Hello');
  const [pastHero, setPastHero] = useState(false);
  const [panelWidth, setPanelWidth] = useState(520);
  const heroRef = useRef<HTMLElement>(null);

  const { profile, primary } = useProfile();
  const home = useMemo(() => ({ lat: primary.lat, lng: primary.lng }), [primary.lat, primary.lng]);
  const area = areaById[primary.areaId];
  const mine = incidents.find((i) => i.areaId === primary.areaId && i.status !== 'restored');
  const crew = mine?.crewId ? crews.find((c) => c.id === mine.crewId) : undefined;
  const forecast = predictions.find((p) => p.areaId === primary.areaId || p.area.includes(area.name));
  const status = statusWord(mine);
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

  const countMe = () => {
    if (!mine) return;
    setCounted(true);
    addReport(mine.id, 'You');
    toast({
      title: 'You’ve been counted',
      body: `${mine.reports + 1} reports in ${area.name}`,
      icon: <IssueIcon issue={mine.issue} className="h-4 w-4" />,
      color: issueMeta[mine.issue].color,
    });
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-16">
      <AppHeader tone={pastHero ? 'day' : 'night'} />

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

        <div className="relative mx-auto max-w-5xl px-5 pb-8 pt-6 lg:pointer-events-none lg:flex lg:h-full lg:items-center lg:py-0">
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
              {mine ? (
                <>
                  {issueMeta[mine.issue].description}.{' '}
                  <span className="font-semibold text-white">
                    <AnimatedCount value={mine.reports} /> neighbours
                  </span>{' '}
                  in {area.name} reported it.
                </>
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
                  {counted ? 'You’re counted' : 'I have this too'}
                </motion.button>
              )}
              <Link
                href="/report"
                className="inline-flex h-14 sm:flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 font-body text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                {mine ? 'Something else' : 'Report a problem'}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---- Below the fold: what's next, and what's been ---- */}
      <main className="mx-auto mt-6 max-w-5xl space-y-4 px-4 lg:mt-8 lg:px-5">
        {forecast && (
          <motion.div {...rise(5)}>
            <HourlyOutlook
              hours={hourlyOutlook}
              headline={`Outage likely ${forecast.window.toLowerCase()}`}
              detail={`${forecast.confidence}% chance in ${forecast.area}. ${forecast.reasons[0]}.`}
            />
          </motion.div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {mine && <RepairTracker incident={mine} crew={crew} />}
          {forecast && <ReadyChecklist startsAt="7 PM" />}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <SupplyWeek days={supplyWeek} promise={bandHours[area.band]} band={area.band} />

          <section aria-labelledby="nearby-title" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Around you</p>
                <h2 id="nearby-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
                  {nearby.length} problems nearby
                </h2>
              </div>
              <Link href="/map" className="font-body text-sm font-semibold text-accent hover:underline">
                Map
              </Link>
            </div>
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
          </section>
        </div>

        <section aria-labelledby="my-reports" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">History</p>
              <h2 id="my-reports" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
                Your reports
              </h2>
            </div>
            <span className="font-body text-sm text-ink-faint">{myReports.length} total</span>
          </div>
          <ol className="mt-4 space-y-0">
            {myReports.map((r, idx) => (
              <li key={r.id} className="relative flex gap-4 pb-5 last:pb-0">
                {idx < myReports.length - 1 && (
                  <span className="absolute left-[19px] top-10 h-[calc(100%-36px)] w-0.5 bg-line" aria-hidden="true" />
                )}
                <span
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: r.status === 'restored' ? 'var(--status-restored)' : issueMeta[r.issue].color }}
                >
                  {r.status === 'restored' ? (
                    <CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <IssueIcon issue={r.issue} className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-body text-sm font-semibold text-ink">
                      {issueMeta[r.issue].label} · {r.place}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 font-body text-xs text-ink-muted">
                    {r.when} · {r.id}
                  </p>
                  {r.note && <p className="mt-1.5 font-body text-sm text-ink-muted">“{r.note}”</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <AppTabBar />
    </div>
  );
}
