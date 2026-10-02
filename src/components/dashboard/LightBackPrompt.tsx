'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SunIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { issueMeta } from '@/data/nsukka';
import { api } from '@/lib/api';
import { formatAgo } from '@/lib/geo';
import { useProfile } from '@/lib/profile';
import type { OpenReport } from '@/lib/reporting';

const minutesSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;

/**
 * Asks about your open reports once they've been quiet for a while (or EEDC
 * says the light is back): "Is your light back?" One tap closes the report or
 * keeps it counted; enough "yes" answers restore the outage for everyone.
 */
export function LightBackPrompt() {
  const { signedIn } = useProfile();
  const toast = useToast();
  const [queue, setQueue] = useState<OpenReport[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    api<{ reports: OpenReport[] }>('/api/reports/prompts')
      .then((r) => setQueue(r.reports))
      .catch(() => {});
  }, [signedIn]);

  const current = queue[0];

  const answer = async (back: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await api<{ status: string }>(`/api/reports/${current.id}/light`, { body: { back } });
      toast(
        res.status === 'restored'
          ? { title: 'Light restored in ' + current.areaName, body: 'Enough neighbours agree — EEDC and the map now show it’s back.', color: 'var(--status-restored)' }
          : res.status === 'reopened'
            ? { title: 'We’ve reopened the outage', body: 'You and a neighbour say it’s still off, so EEDC will see it again.', color: 'var(--status-out)' }
            : back
              ? { title: 'Glad it’s back', body: 'We’ve closed your report.', color: 'var(--status-restored)' }
              : { title: 'Still counted', body: 'EEDC can see your light is still off.' },
      );
      setQueue((q) => q.slice(1));
    } catch (e) {
      toast({ title: 'Couldn’t send', body: e instanceof Error ? e.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          role="dialog"
          aria-label="Is your light back?"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 rounded-lg bg-surface p-4 shadow-float sm:left-auto sm:right-6 sm:w-96 lg:bottom-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt text-ink">
              <SunIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-ink">Is your light back?</p>
              <p className="mt-0.5 font-body text-sm text-ink-muted">
                {current.incident?.status === 'restored'
                  ? `EEDC says supply is back in ${current.areaName}. Is it at your place?`
                  : `You reported ${issueMeta[current.issue].label.toLowerCase()} in ${current.areaName} ${formatAgo(minutesSince(current.createdAt))}.`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Ask me later"
              onClick={() => setQueue((q) => q.slice(1))}
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => answer(true)} loading={busy}>
              Yes, it’s back
            </Button>
            <Button size="sm" variant="secondary" onClick={() => answer(false)} disabled={busy}>
              Still off
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
