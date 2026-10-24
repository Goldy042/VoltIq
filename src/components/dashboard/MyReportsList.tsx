'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, Undo2Icon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IssueIcon, StatusBadge } from '@/components/ui/Badges';
import { useToast } from '@/components/ui/Toast';
import { issueMeta } from '@/data/nsukka';
import type { MyReport } from '@/lib/incidents';

function when(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}, ${time}`;
}

const closedLabel = { withdrawn: 'Withdrawn', not_accepted: 'Not accepted by EEDC' } as const;

/** A resident's report history as a timeline, with "I reported by mistake" on open reports. */
export function MyReportsList({
  reports,
  onWithdraw,
}: {
  reports: MyReport[];
  onWithdraw?: (id: string) => Promise<void>;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const withdraw = async (r: MyReport) => {
    if (!onWithdraw) return;
    setBusy(r.id);
    try {
      await onWithdraw(r.id);
      toast({ title: 'Report withdrawn', body: 'It no longer counts towards the outage.' });
    } catch (e) {
      toast({ title: 'Couldn’t withdraw it', body: e instanceof Error ? e.message : 'Try again.', color: 'var(--status-out)' });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <ol className="space-y-0">
      {reports.map((r, idx) => {
        const closed = r.status === 'withdrawn' || r.status === 'not_accepted';
        const restored = r.status === 'restored';
        return (
          <li key={r.id} className="relative flex gap-4 pb-5 last:pb-0">
            {idx < reports.length - 1 && <span className="absolute left-[19px] top-10 h-[calc(100%-36px)] w-0.5 bg-line" aria-hidden="true" />}
            <span
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: closed ? 'var(--ink-faint)' : restored ? 'var(--status-restored)' : issueMeta[r.issue].color }}
            >
              {restored ? <CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <IssueIcon issue={r.issue} className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`font-body text-sm font-semibold ${closed ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink'}`}>
                  {issueMeta[r.issue].label} · {r.place}
                </p>
                {closed ? (
                  <span className="inline-flex h-7 items-center rounded-full bg-sunken px-2.5 font-body text-xs font-semibold text-ink-muted">
                    {closedLabel[r.status as keyof typeof closedLabel]}
                  </span>
                ) : (
                  <StatusBadge status={r.status as Exclude<MyReport['status'], 'withdrawn' | 'not_accepted'>} />
                )}
              </div>
              <p className="mt-0.5 font-body text-xs text-ink-muted">
                {when(r.createdAt)} · {r.ref}
                {r.incidentId && !closed && (
                  <>
                    {' · '}
                    <Link href={`/outages/${r.incidentId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      Follow the repair
                    </Link>
                  </>
                )}
              </p>
              {r.note && <p className="mt-1.5 font-body text-sm text-ink-muted">“{r.note}”</p>}

              {r.canWithdraw && onWithdraw && (
                <AnimatePresence mode="wait" initial={false}>
                  {confirming === r.id ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2 rounded-md bg-canvas p-3"
                    >
                      <p className="font-body text-sm text-ink">Withdraw this report?</p>
                      <p className="mt-0.5 font-body text-xs text-ink-muted">Use this if you reported by mistake. It stops counting towards the outage. If your light is back, answer “Is your light back?” instead.</p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => withdraw(r)}>
                          Withdraw
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          Keep it
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="ask"
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setConfirming(r.id)}
                      className="mt-1.5 inline-flex items-center gap-1.5 font-body text-xs font-medium text-ink-muted hover:text-ink"
                    >
                      <Undo2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      Reported by mistake?
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
