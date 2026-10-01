'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  BatteryChargingIcon,
  BellRingIcon,
  DropletsIcon,
  PlugZapIcon,
  RefrigeratorIcon,
  TruckIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PredictionBadge } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { issueMeta, type Prediction } from '@/data/nsukka';

interface PredictionDetailProps {
  prediction: Prediction;
  view: 'citizen' | 'operator';
  onBack: () => void;
  onWarn: () => void;
}

const prepare = [
  { icon: BatteryChargingIcon, text: 'Charge phones, power banks and rechargeable lamps' },
  { icon: DropletsIcon, text: 'Pump and store water while there is light' },
  { icon: RefrigeratorIcon, text: 'Keep the fridge closed to hold the cold' },
  { icon: PlugZapIcon, text: 'Unplug TVs and fridges if voltage drops low' },
];

export function PredictionDetail({ prediction, view, onBack, onWarn }: PredictionDetailProps) {
  const [done, setDone] = useState<number[]>([]);
  const [warned, setWarned] = useState(false);

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

      <PredictionBadge confidence={prediction.confidence} className="mt-3" />
      <h2 className="mt-3 font-display text-2xl font-bold leading-snug tracking-tight text-ink">
        Possible {issueMeta[prediction.issue].label.toLowerCase()} in {prediction.area}
      </h2>
      <p className="mt-1 font-body text-base font-medium text-status-predicted">{prediction.window}</p>

      <div className="mt-5 rounded-lg bg-canvas p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-body text-sm text-ink-muted">How sure the model is</span>
          <span className="font-display text-xl font-bold tabular-nums text-ink">{prediction.confidence}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="presentation">
          <motion.div
            className="h-full rounded-full bg-status-predicted"
            initial={{ width: 0 }}
            animate={{ width: `${prediction.confidence}%` }}
            transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        <p className="mt-3 font-body text-xs text-ink-faint">
          About {prediction.households.toLocaleString()} homes in this zone.
        </p>
      </div>

      <h3 className="mt-6 font-body text-sm font-semibold text-ink">Why we think so</h3>
      <ul className="mt-2 space-y-2">
        {prediction.reasons.map((r) => (
          <li key={r} className="flex gap-2.5 font-body text-sm leading-snug text-ink-muted">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-predicted" aria-hidden="true" />
            {r}
          </li>
        ))}
      </ul>

      {view === 'citizen' ? (
        <>
          <h3 className="mt-6 font-body text-sm font-semibold text-ink">Get ready</h3>
          <ul className="mt-2 space-y-1.5">
            {prepare.map(({ icon: Icon, text }, i) => {
              const checked = done.includes(i);
              return (
                <li key={text}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i]))}
                    className="flex w-full items-center gap-3 rounded-md bg-canvas p-3 text-left transition-colors hover:bg-sunken"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className={cn('flex-1 font-body text-sm', checked ? 'text-ink-faint line-through' : 'text-ink')}>
                      {text}
                    </span>
                    <motion.span
                      initial={false}
                      animate={{ scale: checked ? 1 : 0.85 }}
                      className={cn(
                        'h-5 w-5 shrink-0 rounded-full border-2',
                        checked ? 'border-status-restored bg-status-restored' : 'border-line-strong',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-6 space-y-2.5">
          <Button
            full
            size="lg"
            disabled={warned}
            onClick={() => {
              setWarned(true);
              onWarn();
            }}
            leading={<BellRingIcon className="h-5 w-5" aria-hidden="true" />}
          >
            {warned ? 'Residents warned' : `Warn ${prediction.households.toLocaleString()} homes`}
          </Button>
          <Button full size="lg" variant="secondary" leading={<TruckIcon className="h-5 w-5" aria-hidden="true" />}>
            Pre-stage a crew nearby
          </Button>
        </div>
      )}
    </div>
  );
}
