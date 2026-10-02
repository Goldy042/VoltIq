'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  crews as seedCrews,
  incidents as seedIncidents,
  liveReporterNames,
  reportDotsFor,
  type Crew,
  type Incident,
  type IncidentStatus,
  type IssueType,
  type ReportDot,
} from '@/data/nsukka';
import { distanceMeters, offsetMeters } from '@/lib/geo';

export interface FeedEvent {
  key: number;
  incidentId: string;
  name: string;
  issue: IssueType;
  place: string;
}

interface Options {
  /** Simulate a neighbour report every few seconds. */
  live?: boolean;
  onEvent?: (event: FeedEvent) => void;
  /** False parks the simulation entirely (a shared feed is in charge). */
  enabled?: boolean;
}

/**
 * Mock realtime layer. Holds incidents, crews and report dots in memory and
 * drips in new citizen reports so the map is never static. Replace with a
 * server subscription (SSE / Neon logical replication) when the API exists.
 */
export function useOutageFeed({ live = true, onEvent, enabled = true }: Options = {}) {
  const [incidents, setIncidents] = useState<Incident[]>(seedIncidents);
  const [crews, setCrews] = useState<Crew[]>(seedCrews);
  const [extraDots, setExtraDots] = useState<ReportDot[]>([]);
  const [lastEvent, setLastEvent] = useState<FeedEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;

  const baseDots = useMemo(() => seedIncidents.flatMap((i) => reportDotsFor(i)), []);
  const dots = useMemo(() => [...baseDots, ...extraDots], [baseDots, extraDots]);

  const addReport = useCallback((incidentId: string, name: string) => {
    const target = incidentsRef.current.find((i) => i.id === incidentId);
    if (!target) return;
    const r = Math.sqrt(Math.random()) * target.radius * 0.9;
    const t = Math.random() * Math.PI * 2;
    const p = offsetMeters(target.lat, target.lng, Math.sin(t) * r, Math.cos(t) * r);
    setIncidents((prev) =>
      prev.map((i) => (i.id === incidentId ? { ...i, reports: i.reports + 1 } : i)),
    );
    setExtraDots((prev) => [
      ...prev,
      { id: `${incidentId}-live-${Date.now()}`, incidentId, lat: p.lat, lng: p.lng, issue: target.issue, minutesAgo: 0 },
    ]);
    const event: FeedEvent = { key: Date.now(), incidentId, name, issue: target.issue, place: target.place };
    setLastEvent(event);
    onEventRef.current?.(event);
  }, []);

  // A neighbour reports somewhere active every 10–16 seconds — alive, not alarming.
  useEffect(() => {
    if (!live || !enabled) return;
    let timer: number;
    const tick = () => {
      const active = incidentsRef.current.filter((i) => i.status !== 'restored');
      if (active.length) {
        // Busier incidents attract more reports, like real life.
        const total = active.reduce((s, i) => s + Math.sqrt(i.reports), 0);
        let pick = Math.random() * total;
        const chosen = active.find((i) => (pick -= Math.sqrt(i.reports)) <= 0) ?? active[0];
        const name = liveReporterNames[Math.floor(Math.random() * liveReporterNames.length)];
        addReport(chosen.id, name);
      }
      timer = window.setTimeout(tick, 10000 + Math.random() * 6000);
    };
    timer = window.setTimeout(tick, 3500);
    return () => window.clearTimeout(timer);
  }, [live, enabled, addReport]);

  // Crews en route drive toward their incident.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      setCrews((prev) =>
        prev.map((crew) => {
          if (crew.status !== 'en_route' || !crew.incidentId) return crew;
          const target = incidentsRef.current.find((i) => i.id === crew.incidentId);
          if (!target) return crew;
          const left = distanceMeters(crew, target);
          if (left < 35) return { ...crew, status: 'on_site', etaMinutes: undefined, lat: target.lat, lng: target.lng };
          const k = Math.min(1, 60 / left);
          return {
            ...crew,
            lat: crew.lat + (target.lat - crew.lat) * k,
            lng: crew.lng + (target.lng - crew.lng) * k,
            etaMinutes: Math.max(1, Math.round(left / 120)),
          };
        }),
      );
    }, 1500);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const setStatus = useCallback((incidentId: string, status: IncidentStatus) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incidentId ? { ...i, status, crewId: status === 'restored' ? undefined : i.crewId } : i,
      ),
    );
    if (status === 'restored') {
      setCrews((prev) =>
        prev.map((c) => (c.incidentId === incidentId ? { ...c, status: 'available', incidentId: undefined, etaMinutes: undefined } : c)),
      );
    }
  }, []);

  const dispatchCrew = useCallback((incidentId: string, crewId: string) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === incidentId ? { ...i, status: 'crew_dispatched', crewId } : i)),
    );
    setCrews((prev) =>
      prev.map((c) => (c.id === crewId ? { ...c, status: 'en_route', incidentId } : c)),
    );
  }, []);

  return { incidents, crews, dots, lastEvent, addReport, setStatus, dispatchCrew };
}

export type OutageFeed = ReturnType<typeof useOutageFeed>;

const FeedContext = createContext<OutageFeed | null>(null);

/**
 * One feed for a whole section (the operator dashboard), so a dispatch made on
 * the map is still there on the reports and teams pages.
 */
export function OutageFeedProvider({ children }: { children: ReactNode }) {
  const feed = useOutageFeed();
  return createElement(FeedContext.Provider, { value: feed }, children);
}

/** The section's shared feed if there is one, otherwise a feed of its own. */
export function useSharedOutageFeed() {
  const shared = useContext(FeedContext);
  const own = useOutageFeed({ enabled: !shared });
  return shared ?? own;
}
