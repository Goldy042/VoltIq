'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import type { CheckAnswer } from '@/lib/checks';
import { useProfile } from '@/lib/profile';

/**
 * Your "do you have light?" answers from the last day (/api/checks), and a
 * way to answer. Visitors can tap through it locally; nothing is sent.
 */
export function useLightChecks() {
  const { signedIn } = useProfile();
  const [answers, setAnswers] = useState<Record<string, CheckAnswer>>({});

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<{ checks: Array<{ incidentId: string; answer: CheckAnswer }> }>('/api/checks')
      .then(({ checks }) => live && setAnswers(Object.fromEntries(checks.map((c) => [c.incidentId, c.answer]))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn]);

  /** Optimistic; throws ApiFailure (after rolling back) if the server refuses. */
  const answer = useCallback(
    async (incidentId: string, value: CheckAnswer) => {
      setAnswers((a) => ({ ...a, [incidentId]: value }));
      if (!signedIn) return;
      try {
        await api('/api/checks', { body: { incidentId, answer: value } });
      } catch (e) {
        setAnswers(({ [incidentId]: _, ...rest }) => rest);
        throw e instanceof ApiFailure ? e : new ApiFailure('server_error', 'Couldn’t send your answer. Try again.');
      }
    },
    [signedIn],
  );

  return { answers, answer };
}
