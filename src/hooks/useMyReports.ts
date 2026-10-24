'use client';

import { useCallback, useEffect, useState } from 'react';
import { myReports as demoReports } from '@/data/nsukka';
import { api, ApiFailure } from '@/lib/api';
import type { MyReport } from '@/lib/incidents';
import { useProfile } from '@/lib/profile';

const demo: MyReport[] = demoReports.map((r, i) => ({
  id: r.id,
  ref: r.id,
  issue: r.issue,
  place: r.place,
  createdAt: new Date(Date.now() - [20, 60 * 24 * 30, 60 * 24 * 42][i % 3] * 60_000).toISOString(),
  note: r.note,
  incidentId: null,
  status: r.status,
  lightBack: r.status === 'restored',
  canWithdraw: false,
}));

/**
 * The signed-in resident's reports from /api/reports/mine (visitors see the
 * demo history). `refreshKey` lets screens reload after a new report.
 */
export function useMyReports(refreshKey?: unknown) {
  const { signedIn } = useProfile();
  const [reports, setReports] = useState<MyReport[]>(signedIn ? [] : demo);
  const [loaded, setLoaded] = useState(!signedIn);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const { reports: fresh } = await api<{ reports: MyReport[] }>('/api/reports/mine');
      setReports(fresh);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /** Optimistic; throws ApiFailure (after rolling back) if the server refuses. */
  const withdraw = useCallback(
    async (id: string) => {
      const before = reports;
      setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'withdrawn', canWithdraw: false } : r)));
      if (!signedIn) return;
      try {
        await api(`/api/reports/${id}/withdraw`, { body: {} });
      } catch (e) {
        setReports(before);
        throw e instanceof ApiFailure ? e : new ApiFailure('server_error', 'Couldn’t withdraw it. Try again.');
      }
    },
    [reports, signedIn],
  );

  return { reports, loaded, failed, reload: load, withdraw };
}
