'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  HomeIcon,
  InboxIcon,
  MapIcon,
  SparklesIcon,
  TruckIcon,
  UserXIcon,
  ZapOffIcon,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IssueBadge, StatusBadge } from '@/components/ui/Badges';
import { useToast } from '@/components/ui/Toast';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOperations } from '@/lib/operations';
import { formatAgo } from '@/lib/geo';
import { CONFIRM_AT_REPORTS, areaById, predictions } from '@/data/nsukka';
import { reportsByHour } from '@/data/operations';
import { Avatar, Card, CrewStatusPill, HealthBadge, Kpi, Page, PageHeader } from './parts';
import { ReportsChart } from './ReportsChart';
import { useReportLog } from './ReportLog';

interface Attention {
  id: string;
  tone: 'out' | 'low' | 'predicted';
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
  const toast = useToast();
  const { incidents, crews, setStatus } = useSharedOutageFeed();
  const { rows } = useReportLog();
  const { teams, actingAs, allowed, leadName, healthOf } = useOperations();

  const active = incidents.filter((i) => i.status !== 'restored');
  const homesOut = active.reduce((s, i) => s + i.households, 0);
  const pending = rows.filter((r) => r.review === 'pending').length;
  const reports24h = reportsByHour.reduce((s, h) => s + h.reports, 0) + rows.filter((r) => r.id.startsWith('VQ-5')).length;
  const available = crews.filter((c) => c.status === 'available').length;
  const response = median(teams.filter((t) => t.jobsCompleted).map((t) => t.responseMinutes));

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    for (const i of active) {
      if (i.status === 'reported' && i.reports >= CONFIRM_AT_REPORTS) {
        items.push({
          id: `confirm-${i.id}`,
          tone: 'out',
          icon: <InboxIcon className="h-4 w-4" aria-hidden="true" />,
          title: `${i.reports} reports at ${i.place}, not confirmed`,
          body: `First report ${formatAgo(i.minutesAgo)}. Enough neighbours agree to confirm.`,
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
          title: `${i.place}: confirmed, no team assigned`,
          body: `${i.households.toLocaleString()} homes waiting · ${formatAgo(i.minutesAgo)}`,
          action: <ButtonLink href={`/operator/map?focus=${i.id}`} size="sm">Dispatch</ButtonLink>,
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
          body: 'Residents see “No lead yet” beside this team. A manager needs to assign one.',
          action: <ButtonLink href="/operator/teams" size="sm" variant="secondary">Assign</ButtonLink>,
        });
      } else if (h.level === 'at_risk') {
        items.push({
          id: `health-${t.id}`,
          tone: 'out',
          icon: <AlertTriangleIcon className="h-4 w-4" aria-hidden="true" />,
          title: `${t.name} is at risk`,
          body: h.issues.slice(0, 2).join(' · '),
          action: <ButtonLink href="/operator/teams" size="sm" variant="secondary">View</ButtonLink>,
        });
      }
    }
    for (const p of predictions) {
      if (p.confidence >= 70 && p.startsInHours <= 6) {
        items.push({
          id: `pred-${p.id}`,
          tone: 'predicted',
          icon: <SparklesIcon className="h-4 w-4" aria-hidden="true" />,
          title: `Likely outage: ${p.area}, ${p.window.toLowerCase()}`,
          body: `${p.confidence}% confidence · ${p.households.toLocaleString()} homes`,
          action: <ButtonLink href={`/operator/map?focus=${p.id}`} size="sm" variant="secondary">Warn</ButtonLink>,
        });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, teams, allowed]);

  const byArea = useMemo(() => {
    const map = new Map<string, { faults: number; reports: number; homes: number; worst: (typeof active)[number] }>();
    for (const i of active) {
      const cur = map.get(i.areaId);
      if (!cur) map.set(i.areaId, { faults: 1, reports: i.reports, homes: i.households, worst: i });
      else {
        cur.faults += 1;
        cur.reports += i.reports;
        cur.homes += i.households;
        if (i.reports > cur.worst.reports) cur.worst = i;
      }
    }
    return [...map.entries()].sort((a, b) => b[1].homes - a[1].homes);
  }, [active]);

  const hour = 16; // demo "now" is 4 PM
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const toneColor = { out: 'var(--status-out)', low: 'var(--status-low)', predicted: 'var(--status-predicted)' };

  return (
    <Page>
      <PageHeader
        title={`${greeting}, ${actingAs.name.split(' ')[0]}`}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-pulse-ring absolute inset-0 rounded-full bg-status-out" />
              <span className="relative h-2 w-2 rounded-full bg-status-out" />
            </span>
            Live · Nsukka district, {active.length} open faults
          </span>
        }
        actions={
          <ButtonLink href="/operator/map" leading={<MapIcon className="h-4 w-4" aria-hidden="true" />}>
            Open live map
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open faults" value={active.length} hint={`${active.filter((i) => i.issue === 'no_power').length} with no light`} icon={<ZapOffIcon className="h-3.5 w-3.5" aria-hidden="true" />} color="var(--status-out)" />
        <Kpi label="Homes affected" value={homesOut.toLocaleString()} hint="Across all open faults" icon={<HomeIcon className="h-3.5 w-3.5" aria-hidden="true" />} />
        <Kpi label="Reports, 24 hr" value={reports24h} hint="From residents" icon={<InboxIcon className="h-3.5 w-3.5" aria-hidden="true" />} color="var(--accent)" />
        <Kpi label="Awaiting review" value={pending} hint="Single reports to check" icon={<AlertTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />} color="var(--status-low)" />
        <Kpi label="Teams free" value={`${available}/${crews.length}`} hint={`${crews.length - available} out on jobs`} icon={<TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />} color="var(--status-crew)" />
        <Kpi label="Median response" value={`${response} min`} hint="Dispatch → on site, 7 days" icon={<ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />} color="var(--status-restored)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card title={`Needs attention · ${attention.length}`} className="lg:col-span-3">
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 py-6 font-body text-sm text-ink-muted">
              <CheckIcon className="h-4 w-4 text-status-restored" aria-hidden="true" /> Nothing waiting on you.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: toneColor[a.tone] }}>
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-semibold text-ink">{a.title}</p>
                    <p className="mt-0.5 truncate font-body text-xs text-ink-muted">{a.body}</p>
                  </div>
                  {a.action}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reports per hour" className="lg:col-span-2" action={<span className="font-body text-xs text-ink-faint">Last 24 hr</span>}>
          <ReportsChart data={reportsByHour} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card
          title="Team health"
          className="lg:col-span-2"
          action={
            <Link href="/operator/teams" className="inline-flex items-center gap-1 font-body text-sm font-medium text-accent hover:underline">
              All teams <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {teams.map((t) => {
              const h = healthOf(t.id);
              const crew = crews.find((c) => c.id === t.id);
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <Avatar name={leadName(t.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-ink">
                      {t.name} <span className="font-normal text-ink-muted">· {leadName(t.id)}</span>
                    </p>
                    <p className="mt-0.5 truncate font-body text-xs text-ink-muted">
                      {h.onShift}/{h.size} on shift{h.issues[0] ? ` · ${h.issues[0]}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <HealthBadge level={h.level} score={h.score} />
                    {crew && <CrewStatusPill status={crew.status} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Open faults by area" className="lg:col-span-3">
          <div className="-mx-4 overflow-x-auto lg:-mx-5">
            <table className="w-full min-w-[520px] font-body text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="px-4 py-2 font-medium lg:px-5">Area</th>
                  <th className="px-2 py-2 font-medium">Worst fault</th>
                  <th className="px-2 py-2 text-right font-medium">Reports</th>
                  <th className="px-4 py-2 text-right font-medium lg:px-5">Homes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byArea.map(([areaId, a]) => (
                  <tr key={areaId} className="hover:bg-canvas">
                    <td className="px-4 py-2.5 lg:px-5">
                      <Link href={`/operator/map?focus=${a.worst.id}`} className="font-semibold text-ink hover:underline">
                        {areaById[areaId]?.name}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        {areaById[areaId]?.feeder} · Band {areaById[areaId]?.band}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <IssueBadge issue={a.worst.issue} status={a.worst.status} className="h-6" />
                        <StatusBadge status={a.worst.status} className="h-6" />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink">{a.reports}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink lg:px-5">{a.homes.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Page>
  );
}
