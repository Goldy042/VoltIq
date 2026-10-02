'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, CheckIcon, GaugeIcon, HomeIcon, TimerIcon, TruckIcon, UsersIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IssueBadge, StatusBadge } from '@/components/ui/Badges';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { cn } from '@/components/ui/cn';
import {
  areaById,
  crewStatusLabel,
  liveReporterNames,
  statusMeta,
  type Crew,
  type Incident,
  type IncidentStatus,
} from '@/data/nsukka';
import { distanceMeters, formatAgo } from '@/lib/geo';
import { useOperations } from '@/lib/operations';

interface IncidentDetailProps {
  incident: Incident;
  crews: Crew[];
  view: 'citizen' | 'operator';
  onBack: () => void;
  affected: boolean;
  onAffected: () => void;
  onStatus: (status: IncidentStatus) => void;
  onDispatch: (crewId: string) => void;
}

const steps: IncidentStatus[] = ['reported', 'confirmed', 'crew_dispatched', 'restored'];

export function IncidentDetail({ incident, crews, view, onBack, affected, onAffected, onStatus, onDispatch }: IncidentDetailProps) {
  const area = areaById[incident.areaId];
  const crew = crews.find((c) => c.id === incident.crewId);
  const { leadName } = useOperations();
  const step = statusMeta[incident.status].step;

  return (
    <div className="px-5 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 font-body text-sm text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        All areas
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <IssueBadge issue={incident.issue} status={incident.status} />
        {incident.status !== 'restored' && <StatusBadge status={incident.status} />}
      </div>
      <h2 className="mt-3 font-display text-2xl font-bold leading-snug tracking-tight text-ink">{incident.place}</h2>
      <p className="mt-1 font-body text-sm text-ink-muted">
        {area?.feeder} · Band {area?.band}
      </p>

      {/* Social proof: you're not the only one */}
      <NeighbourStack count={incident.reports} seed={incident.id} />

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Stat icon={<UsersIcon className="h-4 w-4" />} label="Reports" value={<AnimatedCount value={incident.reports} />} />
        <Stat icon={<HomeIcon className="h-4 w-4" />} label="Homes" value={incident.households.toLocaleString()} />
        {incident.voltage ? (
          <Stat
            icon={<GaugeIcon className="h-4 w-4" />}
            label="Voltage"
            value={<span className="text-status-low">{incident.voltage} V</span>}
          />
        ) : (
          <Stat icon={<TimerIcon className="h-4 w-4" />} label="Started" value={formatAgo(incident.minutesAgo).replace(' ago', '')} />
        )}
      </dl>

      <p className="mt-5 rounded-md bg-canvas p-4 font-body text-sm leading-body text-ink-muted">“{incident.note}”</p>

      {/* Progress tracker */}
      <section aria-label="Repair progress" className="mt-6">
        <h3 className="font-body text-sm font-semibold text-ink">Repair progress</h3>
        <ol className="mt-3 space-y-0">
          {steps.map((s, i) => {
            const done = i <= step;
            const current = i === step;
            return (
              <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && (
                  <span className="absolute left-[11px] top-6 h-[calc(100%-20px)] w-0.5 bg-line" aria-hidden="true">
                    <motion.span
                      className="block w-full bg-ink"
                      initial={false}
                      animate={{ height: i < step ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </span>
                )}
                <motion.span
                  initial={false}
                  animate={{ scale: current ? 1.08 : 1 }}
                  className={cn(
                    'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    done ? 'border-ink bg-ink text-canvas' : 'border-line-strong bg-surface',
                  )}
                >
                  {done && <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                </motion.span>
                <div className="-mt-0.5">
                  <p className={cn('font-body text-sm', done ? 'font-semibold text-ink' : 'text-ink-faint')}>
                    {statusMeta[s].label}
                  </p>
                  {s === 'crew_dispatched' && crew && (
                    <p className="mt-0.5 font-body text-xs text-ink-muted">
                      {crew.name} · {leadName(crew.id)} · {crewStatusLabel[crew.status]}
                      {crew.status === 'en_route' && crew.etaMinutes !== undefined && ` · about ${crew.etaMinutes} min away`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-6 space-y-2.5">
        {view === 'citizen' ? (
          incident.status !== 'restored' && (
            <>
              <Button
                full
                size="lg"
                onClick={onAffected}
                disabled={affected}
                leading={affected ? <CheckIcon className="h-5 w-5" aria-hidden="true" /> : undefined}
              >
                {affected ? 'You’re counted — thanks' : 'I have this problem too'}
              </Button>
              <ButtonLink href="/report" variant="secondary" size="lg" full>
                Report something different
              </ButtonLink>
            </>
          )
        ) : (
          <OperatorActions incident={incident} crews={crews} onStatus={onStatus} onDispatch={onDispatch} />
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-canvas p-3">
      <dt className="flex items-center gap-1.5 font-body text-xs text-ink-faint">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-bold tracking-tight text-ink">{value}</dd>
    </div>
  );
}

function NeighbourStack({ count, seed }: { count: number; seed: string }) {
  const names = useMemo(() => {
    const offset = seed.length % liveReporterNames.length;
    return [0, 1, 2, 3].map((i) => liveReporterNames[(offset + i * 3) % liveReporterNames.length]);
  }, [seed]);
  const tints = ['#f4d7c6', '#cfe0f5', '#d8eed9', '#efdcf5'];
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="flex -space-x-2" aria-hidden="true">
        {names.map((n, i) => (
          <motion.span
            key={n}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface font-body text-xs font-semibold text-ink"
            style={{ backgroundColor: tints[i] }}
          >
            {n[0]}
          </motion.span>
        ))}
      </div>
      <p className="font-body text-sm text-ink-muted">
        <span className="font-semibold text-ink">
          {names[0]}, {names[1]} and {Math.max(0, count - 2)} others
        </span>{' '}
        reported this
      </p>
    </div>
  );
}

function OperatorActions({
  incident,
  crews,
  onStatus,
  onDispatch,
}: {
  incident: Incident;
  crews: Crew[];
  onStatus: (s: IncidentStatus) => void;
  onDispatch: (crewId: string) => void;
}) {
  const { leadName } = useOperations();
  const available = crews
    .filter((c) => c.status === 'available')
    .map((c) => ({ crew: c, meters: distanceMeters(c, incident) }))
    .sort((a, b) => a.meters - b.meters);
  const [crewId, setCrewId] = useState<string | null>(available[0]?.crew.id ?? null);

  if (incident.status === 'restored') {
    return <p className="font-body text-sm text-ink-muted">Closed. Residents were notified when light returned.</p>;
  }

  if (incident.status === 'crew_dispatched') {
    return (
      <Button full size="lg" onClick={() => onStatus('restored')} leading={<CheckIcon className="h-5 w-5" aria-hidden="true" />}>
        Mark light restored
      </Button>
    );
  }

  return (
    <>
      {incident.status === 'reported' && (
        <Button full size="lg" variant="secondary" onClick={() => onStatus('confirmed')}>
          Confirm fault
        </Button>
      )}
      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 font-body text-sm font-semibold text-ink">Dispatch a crew</legend>
        <p className="px-1 font-body text-xs text-ink-faint">Nearest available crews first.</p>
        {available.length === 0 ? (
          <p className="mt-3 px-1 font-body text-sm text-ink-muted">Every crew is busy right now.</p>
        ) : (
          <div role="radiogroup" className="mt-3 space-y-1.5">
            {available.map(({ crew, meters }) => (
              <button
                key={crew.id}
                type="button"
                role="radio"
                aria-checked={crewId === crew.id}
                onClick={() => setCrewId(crew.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  crewId === crew.id ? 'bg-ink text-canvas' : 'bg-canvas text-ink hover:bg-sunken',
                )}
              >
                <TruckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 font-body text-sm font-medium">
                  {crew.name} <span className="font-normal opacity-70">· {leadName(crew.id)}</span>
                </span>
                <span className="font-body text-xs tabular-nums opacity-70">{(meters / 1000).toFixed(1)} km</span>
              </button>
            ))}
          </div>
        )}
        <Button
          full
          size="lg"
          className="mt-3"
          disabled={!crewId}
          onClick={() => crewId && onDispatch(crewId)}
          leading={<TruckIcon className="h-5 w-5" aria-hidden="true" />}
        >
          Dispatch crew
        </Button>
      </fieldset>
    </>
  );
}
