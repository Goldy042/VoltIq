'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  InboxIcon,
  MapIcon,
  SparklesIcon,
  TruckIcon,
  UserXIcon,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IssueIcon } from '@/components/ui/Badges';
import { useToast } from '@/components/ui/Toast';
import { MapCanvas } from '@/components/map';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOperations } from '@/lib/operations';
import { formatAgo } from '@/lib/geo';
import { CONFIRM_AT_REPORTS, areaById, issueMeta, predictions, statusMeta } from '@/data/nsukka';
import { reportsByHour } from '@/data/operations';
import { Avatar, HealthBadge, JobStatus, KpiStrip, Page, PageHeader, Panel, Tag } from './parts';
import { ReportsChart } from './ReportsChart';
import { useReportLog } from './ReportLog';

type Tone = 'out' | 'low' | 'predicted';
const toneColor: Record<Tone, string> = {
  out: 'var(--status-out)',
  low: 'var(--status-low)',
  predicted: 'var(--status-predicted)',
};

interface Attention {
  id: string;
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function OperatorOverview() {
  const router = useRouter();
  const toast = useToast();
  const { incidents, crews, dots, lastEvent, setStatus } = useSharedOutageFeed();
  const { rows } = useReportLog();
  const { teams, actingAs, allowed, leadName, healthOf } = useOperations();
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric', hour12: false }).format(new Date()));
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  const active = incidents.filter((i) => i.status !== 'restored');
  const homesOut = active.reduce((s, i) => s + i.households, 0);
  const pending = rows.filter((r) => r.review === 'pending').length;
  const liveRows = rows.filter((r) => r.id.startsWith('VQ-5')).length;
  const reports24h = reportsByHour.reduce((s, h) => s + h.reports, 0) + liveRows;
  // A team "has a job" when a dispatcher sent it to a fault that isn't restored yet.
  const jobFor = (teamId: string) =>
    incidents.find((i) => i.id === crews.find((c) => c.id === teamId)?.incidentId && i.status !== 'restored');
  const busy = teams.filter((t) => jobFor(t.id)).length;
  const fix = median(teams.filter((t) => t.jobsRestored).map((t) => t.restoreMinutes));

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    for (const i of active) {
      if (i.status === 'reported' && i.reports >= CONFIRM_AT_REPORTS) {
        items.push({
          id: `confirm-${i.id}`,
          tone: 'out',
          icon: <InboxIcon className="h-4 w-4" aria-hidden="true" />,
          title: `Confirm ${i.place}`,
          body: `${i.reports} reports, unconfirmed · first ${formatAgo(i.minutesAgo)}`,
          action: allowed('triage_reports') ? (
            <Button
              size="sm"
              onClick={() => {
                setStatus(i.id, 'confirmed');
                toast({ title: 'Fault confirmed', body: i.place });
              }}
            >
              Confirm
            </Button>
          ) : null,
        });
      } else if (i.status === 'confirmed' && !i.crewId) {
        items.push({
          id: `dispatch-${i.id}`,
          tone: 'low',
          icon: <TruckIcon className="h-4 w-4" aria-hidden="true" />,
          title: `Dispatch to ${i.place}`,
          body: `Confirmed, no team · ${i.households.toLocaleString()} homes waiting`,
          action: (
            <ButtonLink href={`/operator/map?focus=${i.id}`} size="sm">
              Dispatch
            </ButtonLink>
          ),
        });
      }
    }
    for (const t of teams) {
      const h = healthOf(t.id);
      if (!t.leadId) {
        items.push({
          id: `lead-${t.id}`,
          tone: 'low',
          icon: <UserXIcon className="h-4 w-4" aria-hidden="true" />,
          title: `${t.name} has no lead`,
          body: 'Residents see “No lead yet” beside this team',
          action: (
            <ButtonLink href="/operator/teams" size="sm" variant="secondary">
              Assign
            </ButtonLink>
          ),
        });
      } else if (h.level === 'at_risk') {
        items.push({
          id: `health-${t.id}`,
          tone: 'out',
          icon: <AlertTriangleIcon className="h-4 w-4" aria-hidden="true" />,
          title: `${t.name} is at risk`,
          body: h.issues.slice(0, 2).join(' · '),
          action: (
            <ButtonLink href="/operator/teams" size="sm" variant="secondary">
              View
            </ButtonLink>
          ),
        });
      }
    }
    for (const p of predictions) {
      if (p.confidence >= 70 && p.startsInHours <= 6) {
        items.push({
          id: `pred-${p.id}`,
          tone: 'predicted',
          icon: <SparklesIcon className="h-4 w-4" aria-hidden="true" />,
          title: `Warn ${p.area}`,
          body: `${p.confidence}% likely ${p.window.toLowerCase()} · ${p.households.toLocaleString()} homes`,
          action: (
            <ButtonLink href={`/operator/map?focus=${p.id}`} size="sm" variant="secondary">
              Warn
            </ButtonLink>
          ),
        });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, teams, allowed]);

  // Open faults rolled up per feeder — the unit EEDC actually switches.
  const feeders = useMemo(() => {
    const map = new Map<string, { feeder: string; band: string; areas: Set<string>; reports: number; homes: number; worst: (typeof active)[number] }>();
    for (const i of active) {
      const area = areaById[i.areaId];
      if (!area) continue;
      const cur = map.get(area.feeder);
      if (!cur) map.set(area.feeder, { feeder: area.feeder, band: area.band, areas: new Set([area.name]), reports: i.reports, homes: i.households, worst: i });
      else {
        cur.areas.add(area.name);
        cur.reports += i.reports;
        cur.homes += i.households;
        if (i.issue === 'no_power' && cur.worst.issue !== 'no_power') cur.worst = i;
        else if (i.reports > cur.worst.reports && (i.issue === 'no_power') === (cur.worst.issue === 'no_power')) cur.worst = i;
      }
    }
    return [...map.values()].sort((a, b) => b.homes - a.homes);
  }, [active]);
  const maxHomes = Math.max(1, ...feeders.map((f) => f.homes));

  const spark = reportsByHour.map((h) => h.reports);

  return (
    <Page wide>
      <PageHeader
        eyebrow={`${greeting}, ${actingAs.name.split(' ')[0]}`}
        title="Operations overview"
        subtitle="Everything open in the Nsukka district right now, worst first."
        actions={
          <ButtonLink href="/operator/map" size="sm" leading={<MapIcon className="h-4 w-4" aria-hidden="true" />}>
            Open live map
          </ButtonLink>
        }
      />

      <KpiStrip
        items={[
          { label: 'Open faults', value: active.length, tone: 'var(--status-out)', hint: `${active.filter((i) => i.issue === 'no_power').length} with no light` },
          { label: 'Homes affected', value: homesOut.toLocaleString(), hint: 'Across open faults' },
          { label: 'Reports · 24 h', value: reports24h, tone: 'var(--accent)', spark, hint: 'Busiest in the evening' },
          { label: 'To review', value: pending, tone: pending ? 'var(--status-low)' : undefined, hint: 'Single reports to check' },
          { label: 'Teams on jobs', value: `${busy}/${teams.length}`, tone: 'var(--status-crew)', hint: `${teams.length - busy} free` },
          { label: 'Median fix', value: fix < 60 ? `${fix}m` : `${(fix / 60).toFixed(1)}h`, tone: 'var(--status-restored)', hint: 'Dispatch → restored, 7 d' },
        ]}
      />

      {/* Live picture + priority queue */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel
          title="Live picture"
          meta={`${active.length} faults · ${predictions.length} forecasts`}
          className="xl:col-span-8"
          flush
          delay={0.05}
          action={
            <Link href="/operator/map" className="inline-flex items-center gap-1 font-body text-xs font-medium text-ink-muted hover:text-ink">
              Full map <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <div className="relative h-[360px] sm:h-[440px]">
            <MapCanvas
              incidents={incidents}
              predictions={predictions}
              dots={dots}
              crews={crews}
              showSubstations
              initialZoom={13.3}
              bump={lastEvent ? { incidentId: lastEvent.incidentId, key: lastEvent.key } : null}
              onSelect={(id) => id && router.push(`/operator/map?focus=${id}`)}
            />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
              {[
                { label: 'No light', color: 'var(--status-out)', n: active.filter((i) => i.issue === 'no_power').length },
                { label: 'Low / unstable', color: 'var(--status-low)', n: active.filter((i) => i.issue !== 'no_power').length },
                { label: 'Teams out', color: 'var(--status-crew)', n: busy },
              ].map((l) => (
                <span key={l.label} className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-surface px-2 font-body text-xs text-ink-muted shadow-float">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
                  {l.label}
                  <span className="font-mono text-ink">{l.n}</span>
                </span>
              ))}
            </div>
            <AnimatePresence>
              {lastEvent && (
                <motion.div
                  key={lastEvent.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[70%] items-center gap-2 rounded-sm bg-surface py-1.5 pl-1.5 pr-3 shadow-float sm:flex"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm text-white" style={{ backgroundColor: issueMeta[lastEvent.issue].color }}>
                    <IssueIcon issue={lastEvent.issue} className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate font-body text-xs text-ink-muted">
                    <span className="font-medium text-ink">New report</span> · {lastEvent.place}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>

        <Panel title="Needs attention" meta={String(attention.length).padStart(2, '0')} className="xl:col-span-4" flush delay={0.1}>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 p-6 font-body text-sm text-ink-muted">
              <CheckIcon className="h-4 w-4 text-status-restored" aria-hidden="true" /> Nothing waiting on you.
            </p>
          ) : (
            <ul className="max-h-[440px] divide-y divide-line overflow-y-auto">
              <AnimatePresence initial={false}>
                {attention.map((a, idx) => (
                  <motion.li
                    key={a.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    className="relative flex items-center gap-3 py-3 pl-4 pr-3"
                  >
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ backgroundColor: toneColor[a.tone] }} aria-hidden="true" />
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
                      style={{ color: toneColor[a.tone], backgroundColor: `color-mix(in srgb, ${toneColor[a.tone]} 14%, transparent)` }}
                    >
                      {a.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-medium text-ink">{a.title}</p>
                      <p className="truncate font-body text-xs text-ink-faint">{a.body}</p>
                    </div>
                    {a.action}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>
      </div>

      {/* Trend + feeders */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel title="Reports per hour" meta="Last 24 h" className="xl:col-span-5" delay={0.15}>
          <ReportsChart data={reportsByHour} />
        </Panel>

        <Panel title="Open faults by feeder" meta={`${feeders.length} feeders`} className="xl:col-span-7" flush delay={0.2}>
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-normal">Feeder</th>
                <th className="hidden px-2 py-2.5 font-normal sm:table-cell">Worst</th>
                <th className="px-2 py-2.5 text-right font-normal">Reports</th>
                <th className="w-[38%] px-4 py-2.5 font-normal">Homes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {feeders.map((f) => (
                <tr
                  key={f.feeder}
                  onClick={() => router.push(`/operator/map?focus=${f.worst.id}`)}
                  className="cursor-pointer transition-colors hover:bg-raised"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{f.feeder}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {[...f.areas].join(', ')} · Band {f.band}
                    </p>
                  </td>
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <Tag color={issueMeta[f.worst.issue].color}>
                      <IssueIcon issue={f.worst.issue} className="h-3 w-3" />
                      {f.worst.status === 'crew_dispatched' ? 'Team sent' : statusMeta[f.worst.status].label.replace(' by EEDC', '')}
                    </Tag>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-ink">{f.reports}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                        <motion.span
                          className="block h-full rounded-full"
                          style={{ backgroundColor: issueMeta[f.worst.issue].color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(f.homes / maxHomes) * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                        />
                      </span>
                      <span className="w-12 text-right font-mono tabular-nums text-ink">{f.homes.toLocaleString()}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Team board */}
      <Panel
        title="Teams"
        meta={`${busy} on jobs · ${teams.length - busy} free`}
        delay={0.25}
        action={
          <Link href="/operator/teams" className="inline-flex items-center gap-1 font-body text-xs font-medium text-ink-muted hover:text-ink">
            Manage <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {teams.map((t) => {
            const h = healthOf(t.id);
            const job = jobFor(t.id);
            return (
              <div key={t.id} className="flex min-w-0 flex-col gap-3 rounded-sm bg-canvas p-3 ring-1 ring-line">
                <div className="flex items-center gap-2.5">
                  <Avatar name={leadName(t.id)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-medium text-ink">{t.name}</p>
                    <p className="truncate font-body text-xs text-ink-faint">{leadName(t.id)}</p>
                  </div>
                  <HealthBadge level={h.level} score={h.score} />
                </div>
                <div className="flex min-w-0">
                  <JobStatus place={job?.place} href={job ? `/operator/map?focus=${job.id}` : undefined} />
                </div>
                <dl className="grid grid-cols-3 gap-2 border-t border-line pt-2.5 font-body">
                  {[
                    { k: 'On shift', v: `${h.onShift}/${h.size}` },
                    { k: 'Fixed 7d', v: t.jobsRestored },
                    { k: '≤ 4 hr', v: t.jobsRestored ? `${t.within4h}%` : '—' },
                  ].map((m) => (
                    <div key={m.k}>
                      <dt className="text-2xs text-ink-faint">{m.k}</dt>
                      <dd className="font-mono text-sm tabular-nums text-ink">{m.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Panel>
    </Page>
  );
}
