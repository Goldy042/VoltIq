'use client';

import React, { useState } from 'react';
import { HelpCircleIcon } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Incident } from '@/data/nsukka';
import { api, ApiFailure } from '@/lib/api';
import { ASK_BATCH } from '@/lib/checks';
import { useOperations } from '@/lib/operations';

/**
 * Ask residents around an outage "do you have light?" now. Each person is
 * asked at most every 6 hours, so pressing it twice doesn't spam anyone.
 */
export function AskNearbyButton({ incident, onDone }: { incident: Incident; onDone?: () => void }) {
  const toast = useToast();
  const { allowed, live } = useOperations();
  const [busy, setBusy] = useState(false);
  if (incident.status === 'restored' || incident.issue !== 'no_power' || !allowed('dispatch_teams')) return null;

  const ask = async () => {
    setBusy(true);
    try {
      const { asked } =
        live ? await api<{ asked: number }>(`/api/operator/incidents/${incident.id}/ask`, { body: {} }) : { asked: 6 };
      toast(
        asked
          ? { title: `Asked ${asked} ${asked === 1 ? 'neighbour' : 'neighbours'}`, body: 'Their answers appear on the map as they come in.' }
          : { title: 'Nobody new to ask', body: 'Everyone nearby was asked in the last 6 hours, reported it, or turned questions off.' },
      );
      onDone?.();
    } catch (e) {
      toast({ title: 'Couldn’t ask', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={ask}
      disabled={busy}
      title={`Sends "Do you have light?" to up to ${ASK_BATCH} residents with a saved place nearby`}
      className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-body text-xs font-medium text-ink ring-1 ring-line hover:bg-raised disabled:opacity-60"
    >
      <HelpCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? 'Asking…' : 'Ask nearby'}
    </button>
  );
}
