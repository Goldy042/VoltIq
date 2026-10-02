'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, LocateFixedIcon, XIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { AreaMatch } from '@/lib/address';
import { ROUGH_FIX_METERS, type Fix } from '@/lib/locate';

interface LocationCheckProps {
  fix: Fix | null;
  match: AreaMatch | null;
  locating: boolean;
  /** One-line description of the spot, e.g. "120 m east of Odim Gate". */
  summary?: string;
  onPick: (areaId: string) => void;
  onClose: () => void;
}

/**
 * Says where we think you are, how sure we are, and lets you fix it in one
 * tap. A correction is remembered for that spot, so the next lookup is right.
 */
export function LocationCheck({ fix, match, locating, summary, onPick, onClose }: LocationCheckProps) {
  const rough = fix ? fix.accuracy > ROUGH_FIX_METERS : false;
  const options = match ? [match.area, ...match.alternatives] : [];
  const ask = match && !match.confident;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="w-[min(22rem,calc(100vw-5.5rem))] rounded-lg bg-surface p-4 shadow-float"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-on">
          {locating ? <Spinner className="h-4 w-4" /> : <LocateFixedIcon className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold text-ink">
            {match ? (ask ? `${match.area.name}?` : `You’re in ${match.area.name}`) : 'Finding you…'}
          </p>
          <p className="mt-0.5 font-body text-xs leading-snug text-ink-muted">
            {fix
              ? `${summary ? `${summary} · ` : ''}accurate to about ${Math.round(fix.accuracy)} m${locating ? ', still sharpening' : ''}`
              : 'GPS gets sharper over a few seconds.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!locating && match && (
        <div className="mt-3">
          <p className="font-body text-xs text-ink-muted">
            {ask
              ? rough
                ? 'Your location is rough here. Which area are you in?'
                : 'You’re near a boundary. Which area are you in?'
              : match.corrected
                ? 'Using the area you chose for this spot before.'
                : 'Not right? Pick your area and we’ll remember it for this spot.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((a) => {
              const current = a.id === match.area.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium transition-colors',
                    current ? 'bg-ink text-canvas' : 'border border-line-strong bg-surface text-ink hover:border-ink',
                  )}
                >
                  {current && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
