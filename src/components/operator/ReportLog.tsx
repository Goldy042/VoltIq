'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildReportLog, type ReportReview, type ReportRow } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { api, ApiFailure } from '@/lib/api';
import { offsetMeters } from '@/lib/geo';
import { useOperations } from '@/lib/operations';
import { useToast } from '@/components/ui/Toast';

interface ReportLogValue {
  rows: ReportRow[];
  /** False until the first live load finishes. */
  loaded: boolean;
  setReview: (ids: string[], review: ReportReview) => void;
}

const ReportLogContext = createContext<ReportLogValue | null>(null);
const POLL_MS = 20_000;

/**
 * Every individual citizen report, newest first. In the operator area it is
 * the real log from /api/operator/reports, and Accept / Mark false go through
 * the review API (which moves the reporter's trust score). Elsewhere it is
 * the demo log.
 */
export function ReportLogProvider({ children }: { children: React.ReactNode }) {
  const { live } = useOperations();
  const { incidents, lastEvent } = useSharedOutageFeed();
  const toast = useToast();
  const [rows, setRows] = useState<ReportRow[]>(() => (live ? [] : buildReportLog()));
  const [loaded, setLoaded] = useState(!live);

  const load = useCallback(async () => {
    try {
      const { rows: fresh } = await api<{ rows: ReportRow[] }>('/api/operator/reports');
      setRows(fresh);
    } catch {
      /* keep the last good list; the feed's offline note covers connectivity */
    } finally {
      setLoaded(true);
    }
  }, []);

  // Live: load, poll while visible, and refetch when the feed sees new reports.
  useEffect(() => {
    if (!live) return;
    let timer = 0;
    const tick = async () => {
      if (!document.hidden) await load();
      timer = window.setTimeout(tick, POLL_MS);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [live, load]);

  useEffect(() => {
    if (!lastEvent) return;
    if (live) {
      void load();
      return;
    }
    // Demo: invent the row behind the simulated report.
    const inc = incidents.find((i) => i.id === lastEvent.incidentId);
    if (!inc) return;
    const t = Math.random() * Math.PI * 2;
    const p = offsetMeters(inc.lat, inc.lng, Math.sin(t) * inc.radius * 0.5, Math.cos(t) * inc.radius * 0.5);
    setRows((prev) => [
      {
        id: `VQ-${5000 + prev.length}`,
        incidentId: inc.id,
        areaId: inc.areaId,
        place: inc.place,
        reporter: lastEvent.name,
        phone: '+234 80• ••• ••••',
        issue: inc.issue,
        status: inc.status,
        review: inc.status === 'reported' ? 'pending' : 'confirmed',
        minutesAgo: 0,
        lat: p.lat,
        lng: p.lng,
      },
      ...prev,
    ]);
    // Only a new event should add a row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  const setReview = useCallback(
    (ids: string[], review: ReportReview) => {
      const set = new Set(ids);
      setRows((prev) => prev.map((r) => (set.has(r.id) ? { ...r, review } : r)));
      if (!live || review === 'pending') return;
      const decision = review === 'confirmed' ? 'accepted' : 'false_report';
      Promise.all(ids.map((id) => api(`/api/operator/reports/${id}/review`, { body: { decision } })))
        .catch((e) => {
          toast({
            title: 'Review not saved',
            body: e instanceof ApiFailure ? e.message : 'Try again in a moment.',
            color: 'var(--status-out)',
          });
        })
        .finally(() => void load());
    },
    [live, load, toast],
  );

  // Rows always show their outage's current status.
  const value = useMemo<ReportLogValue>(() => {
    const status = new Map(incidents.map((i) => [i.id, i.status]));
    return { rows: rows.map((r) => ({ ...r, status: status.get(r.incidentId) ?? r.status })), loaded, setReview };
  }, [rows, incidents, loaded, setReview]);

  return <ReportLogContext.Provider value={value}>{children}</ReportLogContext.Provider>;
}

export function useReportLog() {
  const ctx = useContext(ReportLogContext);
  if (!ctx) throw new Error('useReportLog must be used inside ReportLogProvider');
  return ctx;
}
