'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, CheckIcon, GaugeIcon, HomeIcon, ShareIcon, SunIcon, UsersIcon } from 'lucide-react';
import { AppHeader } from '@/components/app/AppHeader';
import { AppTabBar } from '@/components/app/AppTabBar';
import { RepairTracker } from '@/components/dashboard/RepairTracker';
import { MapCanvas } from '@/components/map';
import { OutageTimeline, ReportsOverTime, span } from '@/components/outage/OutageParts';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { IssueBadge } from '@/components/ui/Badges';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { areaById, issueMeta } from '@/data/nsukka';
import { joinOutage } from '@/hooks/useOutageFeed';
import { useOutageDetail } from '@/hooks/useOutageDetail';
import { ApiFailure } from '@/lib/api';
import type { OutageDetail } from '@/lib/incidents';
import { placeName, useProfile } from '@/lib/profile';
import { placeVsOutage } from '@/lib/checks';
import { distanceToCells } from '@/lib/footprint';
import { useLightChecks } from '@/hooks/useLightChecks';
import { useMyReports } from '@/hooks/useMyReports';
import { LightCheckCard } from '@/components/outage/LightCheckCard';
import { OutageReach, ScopePill } from '@/components/outage/OutageReach';

const ease = [0.23, 1, 0.32, 1] as const;

/** One outage, for residents: where, how it's going, what EEDC said, and "I have this too". */
export function OutageScreen({ initial }: { initial: OutageDetail }) {
  const { detail, offline, refresh } = useOutageDetail(initial);
  const { incident } = detail;
  const { signedIn, primary } = useProfile();
  const toast = useToast();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const area = areaById[incident.areaId];
  const restored = incident.status === 'restored';
  const home = { lat: primary.lat, lng: primary.lng };
  const where = placeVsOutage(home, incident);
  const insideZone = where !== null;
  const mine = useMyReports(joined);
  const checks = useLightChecks();
  const [answeredNow, setAnsweredNow] = useState(false);
  const reported = joined || mine.reports.some((r) => r.incidentId === incident.id && r.status !== 'withdrawn');
  // Near the outage, not reported it: "do you have light?" (stays to say thanks once answered).
  const askCheck =
    signedIn && !restored && incident.issue === 'no_power' && insideZone && !reported && (!checks.answers[incident.id] || answeredNow);

  const join = async () => {
    setJoining(true);
    try {
      const r = await joinOutage(incident, insideZone ? home : undefined);
      setJoined(true);
      toast({
        title: r.outcome === 'already_counted' ? 'You’re already counted' : 'You’ve been counted',
        body: r.outcome === 'already_counted' ? 'You reported this a few minutes ago.' : `Your report joins the outage at ${incident.place}.`,
        color: issueMeta[incident.issue].color,
      });
      void refresh();
    } catch (e) {
      toast({ title: 'Couldn’t count you', body: e instanceof ApiFailure ? e.message : 'Try again.', color: 'var(--status-out)' });
    } finally {
      setJoining(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    const text = `${issueMeta[incident.issue].label} at ${incident.place} — follow the repair on VoltIq`;
    try {
      if (navigator.share) await navigator.share({ title: 'VoltIq', text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', body: 'Send it to neighbours so they can add themselves.' });
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-16">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pt-5 lg:px-6 lg:pt-8">
        <Link href="/map" className="-ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 font-body text-sm text-ink-muted hover:bg-sunken hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          Live map
        </Link>

        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <IssueBadge issue={incident.issue} status={incident.status} />
            <ScopePill incident={incident} />
            {offline && <span className="font-body text-xs text-ink-faint">Offline · showing the last update</span>}
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-ink lg:text-4xl">{incident.place}</h1>
          <p className="mt-1.5 font-body text-sm text-ink-muted">
            {incident.area}
            {area && ` · ${area.feeder}`} · {restored && detail.restoredAt ? `Off for ${span(detail.startedAt, detail.restoredAt)}` : `Off for ${span(detail.startedAt)}`}
          </p>
        </motion.header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            {askCheck && (
              <LightCheckCard
                incident={incident}
                placeLabel={placeName(primary).toLowerCase()}
                distanceM={incident.cells?.off.length ? distanceToCells(home, incident.cells.off) : undefined}
                answered={answeredNow ? checks.answers[incident.id] : undefined}
                onAnswer={async (v) => {
                  await checks.answer(incident.id, v);
                  setAnsweredNow(true);
                  void refresh();
                }}
              />
            )}
            {restored ? (
              <section className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
                <p className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-status-restored">
                  <SunIcon className="h-5 w-5" aria-hidden="true" />
                  Light is back
                </p>
                <p className="mt-1 font-body text-sm text-ink-muted">
                  {detail.restoredBy === 'community' ? 'Neighbours said their light came back' : 'EEDC marked supply restored'}
                  {detail.restoredAt && ` after ${span(detail.startedAt, detail.restoredAt)}`}.
                </p>
              </section>
            ) : (
              <RepairTracker incident={incident} crew={detail.crew} />
            )}

            <OutageReach incident={incident} className="lg:p-6" />

            <section className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">Reports over time</h2>
              <p className="mt-0.5 font-body text-sm text-ink-muted">When neighbours told us. A late rise often means it spread.</p>
              <div className="mt-4">
                <ReportsOverTime detail={detail} />
              </div>
            </section>

            <section className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">What’s happened</h2>
              <div className="mt-4">
                <OutageTimeline detail={detail} />
              </div>
            </section>
          </div>

          {/* Side column */}
          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-xl bg-surface shadow-card">
              <div className="h-56 lg:h-64">
                <MapCanvas
                  incidents={[incident]}
                  dots={detail.dots}
                  crews={detail.crew ? [detail.crew] : []}
                  selectedId={incident.id}
                  initialCenter={incident}
                  initialZoom={15.6}
                  user={signedIn ? home : null}
                />
              </div>
              <dl className="grid grid-cols-2 gap-px bg-line">
                <Stat icon={<UsersIcon className="h-4 w-4" />} label="Neighbours reported" value={<AnimatedCount value={incident.reports} />} />
                <Stat icon={<HomeIcon className="h-4 w-4" />} label="Homes affected" value={`~${incident.households.toLocaleString()}`} />
                {incident.voltage ? (
                  <Stat icon={<GaugeIcon className="h-4 w-4" />} label="Typical voltage" value={<span className="text-status-low">{incident.voltage} V</span>} />
                ) : (
                  <Stat icon={<SunIcon className="h-4 w-4" />} label="Say light is back" value={detail.lightBack} />
                )}
                <Stat icon={<CheckIcon className="h-4 w-4" />} label="Status" value={<span className="text-base">{restored ? 'Fixed' : incident.status === 'reported' ? 'Waiting for EEDC' : 'Being fixed'}</span>} />
              </dl>
            </section>

            <section className="space-y-2.5 rounded-xl bg-surface p-5 shadow-card">
              {restored ? (
                <>
                  <p className="font-body text-sm text-ink-muted">Still no light at your place? Report it so EEDC sees it’s not fully fixed.</p>
                  <ButtonLink href={`/report?issue=${incident.issue}`} full size="lg">
                    Still off at my place
                  </ButtonLink>
                </>
              ) : signedIn ? (
                <>
                  <Button full size="lg" onClick={join} loading={joining} disabled={joined} leading={joined ? <CheckIcon className="h-5 w-5" aria-hidden="true" /> : undefined}>
                    {joined ? 'You’re counted' : 'I have this too'}
                  </Button>
                  <p className="font-body text-xs text-ink-faint">
                    {insideZone ? 'Counts your saved place.' : 'Your saved place is outside this outage, so we’ll check it’s really affecting you.'} More reports get EEDC moving faster.
                  </p>
                </>
              ) : (
                <>
                  <ButtonLink href="/signup" full size="lg">
                    Sign up to add yourself
                  </ButtonLink>
                  <p className="font-body text-xs text-ink-faint">Free. We’ll tell you the moment light is back.</p>
                </>
              )}
              <Button full variant="ghost" onClick={share} leading={<ShareIcon className="h-4 w-4" aria-hidden="true" />}>
                Share with neighbours
              </Button>
            </section>
          </aside>
        </div>
      </main>
      <AppTabBar />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-surface p-4">
      <dt className="flex items-center gap-1.5 font-body text-xs text-ink-faint">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-bold tracking-tight text-ink">{value}</dd>
    </div>
  );
}
