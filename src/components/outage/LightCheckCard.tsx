'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, HelpCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { Incident } from '@/data/nsukka';
import type { CheckAnswer } from '@/lib/checks';
import { cn } from '@/components/ui/cn';

/**
 * "Do you have light?" for a resident near an outage they haven't reported.
 * "Yes" marks their block as lit on the map, which is how the outage's edge is
 * found; "No" adds them to it.
 */
export function LightCheckCard({
  incident,
  placeLabel,
  distanceM,
  answered,
  onAnswer,
  className,
}: {
  incident: Incident;
  /** "home", "your hostel"… */
  placeLabel: string;
  /** How far the nearest dark block is, when known. */
  distanceM?: number;
  answered?: CheckAnswer;
  onAnswer: (value: CheckAnswer) => Promise<void>;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<CheckAnswer | null>(null);

  const send = async (value: CheckAnswer) => {
    setBusy(value);
    try {
      await onAnswer(value);
    } catch (e) {
      toast({ title: 'Couldn’t send', body: e instanceof Error ? e.message : 'Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const where = distanceM && distanceM > 60 ? `about ${Math.round(distanceM / 50) * 50} m from your ${placeLabel}` : `on your ${placeLabel}’s block`;

  return (
    <section aria-labelledby={`check-${incident.id}`} className={cn('rounded-xl bg-surface p-5 shadow-card', className)}>
      <AnimatePresence mode="wait" initial={false}>
        {answered ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-restored text-white">
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id={`check-${incident.id}`} className="font-display text-lg font-bold tracking-tight text-ink">
                Thanks, that helps
              </h2>
              <p className="mt-0.5 font-body text-sm text-ink-muted">
                {answered === 'on'
                  ? 'Your block shows as having light, so EEDC can see where the outage stops.'
                  : 'You’re added to the outage. We’ll tell you when a team is on it.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="ask" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <HelpCircleIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Help your neighbours</p>
                <h2 id={`check-${incident.id}`} className="mt-0.5 font-display text-lg font-bold tracking-tight text-ink">
                  Do you have light at your {placeLabel}?
                </h2>
                <p className="mt-1 font-body text-sm text-ink-muted">
                  {incident.reports} {incident.reports === 1 ? 'neighbour' : 'neighbours'} {where} reported no light. Your answer shows
                  EEDC how far the outage goes.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => send('on')} loading={busy === 'on'} disabled={busy !== null}>
                Yes, I have light
              </Button>
              <Button size="sm" onClick={() => send('off')} loading={busy === 'off'} disabled={busy !== null}>
                No light
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
