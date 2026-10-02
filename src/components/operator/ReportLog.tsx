'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildReportLog, type ReportReview, type ReportRow } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { offsetMeters } from '@/lib/geo';

interface ReportLogValue {
  rows: ReportRow[];
  setReview: (ids: string[], review: ReportReview) => void;
}

const ReportLogContext = createContext<ReportLogValue | null>(null);

/**
 * Every individual citizen report, newest first. Live reports from the feed
 * are appended as they arrive, and incident status changes (confirm, dispatch,
 * restore) flow through to the rows behind them.
 */
export function ReportLogProvider({ children }: { children: React.ReactNode }) {
  const { incidents, lastEvent } = useSharedOutageFeed();
  const [rows, setRows] = useState<ReportRow[]>(buildReportLog);

  useEffect(() => {
    if (!lastEvent) return;
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

  const setReview = useCallback((ids: string[], review: ReportReview) => {
    const set = new Set(ids);
    setRows((prev) => prev.map((r) => (set.has(r.id) ? { ...r, review } : r)));
  }, []);

  // Rows always show their incident's current status.
  const value = useMemo<ReportLogValue>(() => {
    const status = new Map(incidents.map((i) => [i.id, i.status]));
    return { rows: rows.map((r) => ({ ...r, status: status.get(r.incidentId) ?? r.status })), setReview };
  }, [rows, incidents, setReview]);

  return <ReportLogContext.Provider value={value}>{children}</ReportLogContext.Provider>;
}

export function useReportLog() {
  const ctx = useContext(ReportLogContext);
  if (!ctx) throw new Error('useReportLog must be used inside ReportLogProvider');
  return ctx;
}
