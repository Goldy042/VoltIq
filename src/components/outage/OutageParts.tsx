'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, FlagIcon, MegaphoneIcon, ShieldCheckIcon, TruckIcon, WrenchIcon } from 'lucide-react';
import { ReportsChart } from '@/components/operator/ReportsChart';
import type { OutageDetail, OutageEvent } from '@/lib/incidents';

const TZ = 'Africa/Lagos';

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

/** "Today, 4:52 PM" / "Thu 22 Oct, 4:52 PM" in Nsukka time. */
export function dayTime(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-NG', { timeZone: TZ });
  const prefix = day(d) === day(new Date()) ? 'Today' : d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
  return `${prefix}, ${clockTime(iso)}`;
}

/** "2 hr 10 min" between two times. */
export function span(fromIso: string, toIso?: string) {
  const m = Math.max(0, Math.round(((toIso ? new Date(toIso) : new Date()).getTime() - new Date(fromIso).getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h >= 48 ? `${Math.round(h / 24)} days` : r ? `${h} hr ${r} min` : `${h} hr`;
}

const eventIcon: Record<OutageEvent['kind'], { icon: React.ElementType; color: string }> = {
  first_report: { icon: FlagIcon, color: 'var(--status-out)' },
  confirmed: { icon: ShieldCheckIcon, color: 'var(--ink)' },
  team: { icon: TruckIcon, color: 'var(--status-crew)' },
  team_done: { icon: WrenchIcon, color: 'var(--ink-muted)' },
  update: { icon: MegaphoneIcon, color: 'var(--accent)' },
  restored: { icon: CheckIcon, color: 'var(--status-restored)' },
};

/** What happened, oldest first, with the open step at the end while it's still off. */
export function OutageTimeline({ detail }: { detail: OutageDetail }) {
  const open = detail.incident.status !== 'restored';
  return (
    <ol className="space-y-0">
      {detail.timeline.map((e, i) => {
        const { icon: Icon, color } = eventIcon[e.kind];
        const last = i === detail.timeline.length - 1 && !open;
        return (
          <motion.li
            key={`${e.kind}-${e.at}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && <span className="absolute left-[13px] top-8 h-[calc(100%-24px)] w-px bg-line" aria-hidden="true" />}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="font-body text-sm text-ink">{e.text}</p>
              <p className="mt-0.5 font-body text-xs text-ink-faint">
                {dayTime(e.at)}
                {e.by && ` · ${e.by}`}
              </p>
            </div>
          </motion.li>
        );
      })}
      {open && (
        <li className="flex gap-3">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong" aria-hidden="true" />
          <p className="pt-1 font-body text-sm text-ink-muted">Still off · {span(detail.startedAt)} so far</p>
        </li>
      )}
    </ol>
  );
}

/** Reports per time bucket since the outage started. */
export function ReportsOverTime({ detail, height = 120 }: { detail: OutageDetail; height?: number }) {
  const { counts, minutes } = detail.reportsOverTime;
  const start = new Date(detail.startedAt).getTime();
  const label = (i: number) => {
    const iso = new Date(start + i * minutes * 60_000).toISOString();
    return minutes >= 1440 ? dayTime(iso).split(',')[0] : clockTime(iso);
  };
  const data = counts.map((reports, i) => ({ hour: label(i), reports }));
  const open = detail.incident.status !== 'restored';
  return <ReportsChart data={data} height={height} startLabel={clockTime(detail.startedAt)} endLabel={open ? 'Now' : 'Restored'} />;
}
