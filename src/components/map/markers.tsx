'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, SparklesIcon, TruckIcon, ZapIcon } from 'lucide-react';
import { IssueIcon } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { incidentColor, type Crew, type Incident, type Prediction } from '@/data/nsukka';

/** Speech-bubble pill with a tail pointing at the spot, like native map apps. */
function Bubble({
  color,
  selected,
  children,
  className,
  light = false,
}: {
  color: string;
  selected: boolean;
  children: React.ReactNode;
  className?: string;
  /** White bubble with dark text (groups). */
  light?: boolean;
}) {
  return (
    <span className="relative flex flex-col items-center">
      <span
        className={cn(
          'relative flex h-8 items-center gap-1.5 rounded-full px-2.5 font-display text-sm font-bold tabular-nums shadow-pin transition-shadow',
          light ? 'bg-surface text-ink' : 'text-white',
          selected && 'ring-[3px] ring-white',
          className,
        )}
        style={light ? undefined : { backgroundColor: color }}
      >
        {children}
      </span>
      <span
        className={cn('-mt-1 h-2 w-2 rotate-45 rounded-[2px]', light && 'bg-surface')}
        style={light ? undefined : { backgroundColor: color }}
        aria-hidden="true"
      />
    </span>
  );
}

/** Small name tag under a pin, shown once the map is zoomed in enough to need it. */
function NameTag({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 font-body text-[11px] font-semibold text-ink shadow-card"
    >
      {children}
    </motion.span>
  );
}

const pop = {
  initial: { scale: 0.4, opacity: 0, y: 6 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.4, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 26 },
};

export function IncidentPin({
  incident,
  selected,
  bump,
  showName,
}: {
  incident: Incident;
  selected: boolean;
  /** Changes whenever a new report lands here, replaying a single bump. */
  bump?: number;
  showName: boolean;
}) {
  const restored = incident.status === 'restored';
  const color = incidentColor(incident);

  if (restored) {
    return (
      <motion.span {...pop} className="flex origin-bottom flex-col items-center">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white shadow-pin',
            selected && 'ring-[3px] ring-white',
          )}
          style={{ backgroundColor: color }}
        >
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
        {showName && <NameTag>{incident.area}</NameTag>}
      </motion.span>
    );
  }

  return (
    <motion.span {...pop} className="flex origin-bottom flex-col items-center">
      <motion.span
        key={bump}
        className="relative block origin-bottom"
        initial={bump ? { scale: 1.25 } : false}
        animate={{ scale: selected ? 1.12 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
      >
        {selected && (
          <span
            className="animate-pulse-ring absolute left-1/2 top-4 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        <Bubble color={color} selected={selected}>
          <IssueIcon issue={incident.issue} className="h-3.5 w-3.5" />
          {incident.reports}
          {incident.status === 'crew_dispatched' && (
            <span className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white" aria-hidden="true">
              <TruckIcon className="h-3 w-3 text-status-crew" strokeWidth={2.5} />
            </span>
          )}
        </Bubble>
      </motion.span>
      {showName && <NameTag>{incident.area}</NameTag>}
    </motion.span>
  );
}

/** Several nearby areas folded into one calm white pin. Tap to zoom in. */
export function GroupPin({ members, bump }: { members: Incident[]; bump?: number }) {
  const shown = members.slice(0, 3);
  return (
    <motion.span {...pop} className="block origin-bottom">
      <motion.span
        key={bump}
        className="block origin-bottom"
        initial={bump ? { scale: 1.2 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
      >
        <Bubble color="var(--surface)" selected={false} light className="h-9 gap-2 pl-1.5 pr-3">
          <span className="flex -space-x-1.5" aria-hidden="true">
            {shown.map((m) => (
              <span
                key={m.id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white"
                style={{ backgroundColor: incidentColor(m) }}
              >
                <IssueIcon issue={m.issue} className="h-3 w-3" />
              </span>
            ))}
          </span>
          <span className="font-body text-[13px] font-semibold">{members.length} areas</span>
        </Bubble>
      </motion.span>
    </motion.span>
  );
}

export function PredictionPin({ prediction, selected }: { prediction: Prediction; selected: boolean }) {
  return (
    <motion.span {...pop} className="block origin-bottom">
      <motion.span className="block origin-bottom" animate={{ scale: selected ? 1.12 : 1 }}>
        <Bubble color="var(--status-predicted)" selected={selected} className="h-7 px-2 text-[13px]">
          <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {prediction.confidence}%
        </Bubble>
      </motion.span>
    </motion.span>
  );
}

export function CrewPin({ crew }: { crew: Crew }) {
  return (
    <motion.span {...pop} className="block origin-bottom">
      <Bubble color="#111113" selected={false} className="h-7 px-2 text-[12px]">
        <TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {crew.name.replace('Crew ', '')}
        {crew.etaMinutes !== undefined && crew.status === 'en_route' && (
          <span className="font-body text-[11px] font-medium opacity-70">{crew.etaMinutes}m</span>
        )}
      </Bubble>
    </motion.span>
  );
}

export function SubstationPin({ label }: { label: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-sm border-2 border-white bg-ink shadow-pin" title={label}>
      <ZapIcon className="h-3 w-3 fill-volt text-volt" aria-hidden="true" />
    </span>
  );
}

export function UserDot() {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center" aria-label="Your location">
      <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent" aria-hidden="true" />
      <span className="relative h-4 w-4 rounded-full border-[3px] border-white bg-accent shadow-pin" />
    </span>
  );
}
