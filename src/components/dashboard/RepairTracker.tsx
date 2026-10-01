'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, TruckIcon, UsersIcon } from 'lucide-react';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { cn } from '@/components/ui/cn';
import {
  CONFIRM_AT_REPORTS,
  crewStatusLabel,
  statusMeta,
  type Crew,
  type Incident,
  type IncidentStatus,
} from '@/data/nsukka';

const stages: Array<{ status: IncidentStatus; short: string }> = [
  { status: 'reported', short: 'Reported' },
  { status: 'confirmed', short: 'Confirmed' },
  { status: 'crew_dispatched', short: 'Crew' },
  { status: 'restored', short: 'Restored' },
];

const ease = [0.23, 1, 0.32, 1] as const;

/** Uber-style live tracker for the fault on the citizen's street. */
export function RepairTracker({ incident, crew }: { incident: Incident; crew?: Crew }) {
  const step = statusMeta[incident.status].step;
  const toConfirm = Math.max(0, CONFIRM_AT_REPORTS - incident.reports);

  const message =
    incident.status === 'reported'
      ? toConfirm > 0
        ? `${toConfirm} more report${toConfirm === 1 ? '' : 's'} usually gets EEDC to confirm. Ask your neighbours to tap “I have this too”.`
        : 'Enough neighbours have reported. EEDC should confirm shortly.'
      : incident.status === 'confirmed'
        ? 'EEDC has confirmed the fault and is assigning a crew.'
        : incident.status === 'crew_dispatched'
          ? `${crew?.name ?? 'A crew'} is ${crew?.status === 'on_site' ? 'working on it now' : `about ${crew?.etaMinutes ?? 6} min away`}.`
          : 'Light is back. Thanks for reporting.';

  return (
    <section aria-labelledby="tracker-title" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Repair progress</p>
      <h2 id="tracker-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
        {statusMeta[incident.status].label}
      </h2>

      {/* Four-stage progress bar */}
      <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Repair stages">
        {stages.map((s, i) => (
          <li key={s.status}>
            <span className="block h-1.5 overflow-hidden rounded-full bg-canvas">
              <motion.span
                className={cn('block h-full rounded-full', i === step && i < 3 ? 'bg-status-low' : 'bg-ink')}
                initial={{ width: 0 }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.6, delay: i * 0.15, ease }}
              />
            </span>
            <span
              className={cn(
                'mt-2 flex items-center gap-1 font-body text-xs',
                i <= step ? 'font-semibold text-ink' : 'text-ink-faint',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step && <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
              {s.short}
            </span>
          </li>
        ))}
      </ol>

      {incident.status === 'reported' && (
        <div className="mt-5 rounded-lg bg-canvas p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
              <UsersIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              <AnimatedCount value={incident.reports} /> of ~{CONFIRM_AT_REPORTS} reports
            </span>
            <span className="font-body text-xs text-ink-faint">to get confirmed</span>
          </div>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={CONFIRM_AT_REPORTS}
            aria-valuenow={Math.min(incident.reports, CONFIRM_AT_REPORTS)}
            aria-label="Reports towards confirmation"
          >
            <motion.div
              className="h-full rounded-full bg-ink"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (incident.reports / CONFIRM_AT_REPORTS) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      )}

      {incident.status === 'crew_dispatched' && crew && (
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-canvas p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-status-crew text-white">
            <TruckIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-body text-sm font-semibold text-ink">
              {crew.name} · {crew.lead}
            </p>
            <p className="font-body text-xs text-ink-muted">{crewStatusLabel[crew.status]}</p>
          </div>
        </div>
      )}

      <p className="mt-4 font-body text-sm leading-snug text-ink-muted">{message}</p>
    </section>
  );
}
