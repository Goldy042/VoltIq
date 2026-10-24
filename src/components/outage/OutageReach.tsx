'use client';

import React from 'react';
import { HomeIcon, SunIcon, ZapOffIcon } from 'lucide-react';
import type { Incident } from '@/data/nsukka';
import { scopeMeta } from '@/lib/footprint';
import { cn } from '@/components/ui/cn';

/** "A few homes", "Area-wide"… as a small pill. Nothing for outages without blocks. */
export function ScopePill({ incident, className }: { incident: Pick<Incident, 'scope'>; className?: string }) {
  if (!incident.scope) return null;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full bg-sunken px-2.5 font-body text-xs font-semibold text-ink-muted',
        className,
      )}
    >
      {scopeMeta[incident.scope].label}
    </span>
  );
}

/**
 * How far an outage reaches, from the blocks: its size, how many reported no
 * light and how many neighbours around it have light. Staff get the likely
 * cause; residents a plain hint.
 */
export function OutageReach({
  incident,
  staff = false,
  bare = false,
  className,
}: {
  incident: Incident;
  staff?: boolean;
  /** Inside someone else's card: no card or heading of its own. */
  bare?: boolean;
  className?: string;
}) {
  if (!incident.scope) return null;
  const meta = scopeMeta[incident.scope];
  const items = [
    { icon: ZapOffIcon, value: incident.reports, label: 'reported no light', color: 'var(--status-out)' },
    { icon: SunIcon, value: incident.lightOn ?? 0, label: 'nearby have light', color: 'var(--status-restored)' },
    { icon: HomeIcon, value: `~${incident.households.toLocaleString()}`, label: 'homes, estimated', color: 'var(--ink-muted)' },
  ];
  return (
    <section aria-label="How far it reaches" className={cn(!bare && 'rounded-xl bg-surface p-5 shadow-card', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {!bare && <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">How far it reaches</p>}
        <ScopePill incident={incident} />
      </div>
      <p className="mt-2 font-body text-sm text-ink-muted">{staff ? meta.staffHint : meta.hint}</p>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="flex items-center gap-1.5 font-body text-xs text-ink-faint">
              <it.icon className="h-3.5 w-3.5" style={{ color: it.color }} aria-hidden="true" />
              {it.label}
            </dt>
            <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-ink">{it.value}</dd>
          </div>
        ))}
      </dl>
      {staff && incident.asked ? (
        <p className="mt-3 font-body text-xs text-ink-faint">
          {incident.asked} {incident.asked === 1 ? 'neighbour hasn’t' : 'neighbours haven’t'} answered yet.
        </p>
      ) : null}
      <p className="mt-3 flex items-center gap-3 font-body text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--status-out)', opacity: 0.5 }} aria-hidden="true" />
          No light
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--status-restored)', opacity: 0.5 }} aria-hidden="true" />
          Has light
        </span>
        <span>Blocks are about 100 m across.</span>
      </p>
    </section>
  );
}
