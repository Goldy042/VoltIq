'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BatteryChargingIcon, CheckIcon, DropletsIcon, PlugZapIcon, RefrigeratorIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';

const tasks = [
  { icon: BatteryChargingIcon, text: 'Charge phones and power banks' },
  { icon: DropletsIcon, text: 'Pump and store water' },
  { icon: RefrigeratorIcon, text: 'Freeze water bottles to keep the fridge cold' },
  { icon: PlugZapIcon, text: 'Unplug the TV and fridge if voltage drops' },
];

const R = 22;
const C = 2 * Math.PI * R;

/** Preparation checklist for the forecast window, with a progress ring. */
export function ReadyChecklist({ startsAt }: { startsAt: string }) {
  const [done, setDone] = useState<number[]>([]);
  const progress = done.length / tasks.length;
  const complete = done.length === tasks.length;

  return (
    <section aria-labelledby="ready-title" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Get ready</p>
          <h2 id="ready-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
            {complete ? 'You’re ready' : `Before ${startsAt}`}
          </h2>
        </div>
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="28" cy="28" r={R} fill="none" stroke="var(--canvas)" strokeWidth="5" />
            <motion.circle
              cx="28"
              cy="28"
              r={R}
              fill="none"
              stroke={complete ? 'var(--status-restored)' : 'var(--ink)'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={false}
              animate={{ strokeDashoffset: C * (1 - progress) }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </svg>
          <span className="font-display text-sm font-bold tabular-nums text-ink">
            {done.length}/{tasks.length}
          </span>
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {tasks.map(({ icon: Icon, text }, i) => {
          const checked = done.includes(i);
          return (
            <li key={text}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i]))}
                className="flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-canvas"
              >
                <Icon className={cn('h-5 w-5 shrink-0', checked ? 'text-ink-faint' : 'text-ink-muted')} aria-hidden="true" />
                <span className={cn('flex-1 font-body text-sm', checked ? 'text-ink-faint line-through' : 'text-ink')}>{text}</span>
                <motion.span
                  initial={false}
                  animate={{ scale: checked ? 1 : 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    checked ? 'border-status-restored bg-status-restored text-white' : 'border-line-strong',
                  )}
                  aria-hidden="true"
                >
                  {checked && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
                </motion.span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
