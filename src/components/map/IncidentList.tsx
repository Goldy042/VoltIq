'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronRightIcon, SparklesIcon, TruckIcon } from 'lucide-react';
import { IssueIcon } from '@/components/ui/Badges';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { incidentColor, issueMeta, statusMeta, type Incident, type Prediction } from '@/data/nsukka';
import { formatAgo } from '@/lib/geo';

interface IncidentListProps {
  items: Array<Incident | Prediction>;
  onSelect: (id: string) => void;
}

export function IncidentList({ items, onSelect }: IncidentListProps) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="font-display text-lg font-semibold text-ink">Nothing here</p>
        <p className="mt-1 font-body text-sm text-ink-muted">No areas match that search and filter.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 px-3 pb-6">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            {item.kind === 'incident' ? (
              <IncidentRow incident={item} onSelect={onSelect} />
            ) : (
              <PredictionRow prediction={item} onSelect={onSelect} />
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function RowShell({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="flex w-full items-center gap-3 rounded-lg bg-canvas p-3 text-left transition-colors duration-150 hover:bg-sunken"
    >
      {children}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
    </motion.button>
  );
}

function IncidentRow({ incident, onSelect }: { incident: Incident; onSelect: (id: string) => void }) {
  const restored = incident.status === 'restored';
  return (
    <RowShell onClick={() => onSelect(incident.id)}>
      <span
        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md text-white"
        style={{ backgroundColor: incidentColor(incident) }}
      >
        {restored ? <CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <IssueIcon issue={incident.issue} />}
        <AnimatedCount value={incident.reports} className="font-display text-xs font-bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-base font-semibold tracking-tight text-ink">
          {incident.place}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate font-body text-xs text-ink-muted">
          <span style={{ color: incidentColor(incident) }} className="font-semibold">
            {restored ? 'Restored' : issueMeta[incident.issue].label}
          </span>
          <span aria-hidden="true">·</span>
          {incident.status === 'crew_dispatched' ? (
            <span className="inline-flex items-center gap-1 font-medium text-status-crew">
              <TruckIcon className="h-3 w-3" aria-hidden="true" /> Crew on the way
            </span>
          ) : (
            <span>{statusMeta[incident.status].label}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{formatAgo(incident.minutesAgo)}</span>
        </span>
      </span>
    </RowShell>
  );
}

function PredictionRow({ prediction, onSelect }: { prediction: Prediction; onSelect: (id: string) => void }) {
  return (
    <RowShell onClick={() => onSelect(prediction.id)}>
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-status-predicted text-white">
        <SparklesIcon className="h-4 w-4" aria-hidden="true" />
        <span className="font-display text-xs font-bold tabular-nums">{prediction.confidence}%</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-base font-semibold tracking-tight text-ink">
          {prediction.area}
        </span>
        <span className="mt-0.5 block truncate font-body text-xs text-ink-muted">
          <span className="font-semibold text-status-predicted">Possible {issueMeta[prediction.issue].label.toLowerCase()}</span>
          {' · '}
          {prediction.window}
        </span>
      </span>
    </RowShell>
  );
}
