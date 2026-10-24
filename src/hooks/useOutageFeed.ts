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
import { api, ApiFailure } from '@/lib/api';
import type { LiveFeed } from '@/lib/incidents';
import type { SubmitResult } from '@/lib/reporting';
import { useToast } from '@/components/ui/Toast';

export interface FeedEvent {
  key: number;
  incidentId: string;
  name: string;
  issue: IssueType;
  place: string;
}

/**
 * `live` reads real outages from /api/incidents. `demo` is the scripted
 * Nsukka night used on the landing and sign-in pages, where there is nobody
 * to read live data for yet.
 */
export type FeedSource = 'live' | 'demo';

interface Options {
  source?: FeedSource;
  onEvent?: (event: FeedEvent) => void;
  /** False parks the feed entirely (a shared feed is in charge). */
  enabled?: boolean;
}

/** How often the live map asks the server for changes. */
const POLL_MS = 15_000;

export interface OutageFeed {
  source: FeedSource;
  incidents: Incident[];
  crews: Crew[];
  dots: ReportDot[];
  lastEvent: FeedEvent | null;
  /** False until the first live load finishes (always true for the demo). */
  loaded: boolean;
  /** Set when the live feed couldn't be reached; the map keeps the last good data. */
  offline: boolean;
  /** "I have this too": a real report at `at` in live mode. */
  addReport: (incidentId: string, name: string, at?: { lat: number; lng: number }) => Promise<SubmitResult | null>;
  setStatus: (incidentId: string, status: IncidentStatus) => Promise<boolean>;
  dispatchCrew: (incidentId: string, crewId: string) => Promise<boolean>;
  /** Expected fix time, cause and public update for residents. Throws ApiFailure so forms can show field errors. */
  updateInfo: (incidentId: string, info: IncidentInfo) => Promise<void>;
  refresh: () => void;
}

export interface IncidentInfo {
  etaAt?: string | null;
  cause?: string | null;
  publicNote?: string;
}

/**
 * "I have this too": a real report of the same problem, from `at` (your place,
 * when it's inside the outage) or the outage itself. The server decides if it's
 * new, a repeat, or too soon.
 */
export function joinOutage(target: Incident, at?: { lat: number; lng: number }) {
  const point = at ?? { lat: target.lat, lng: target.lng };
  return api<SubmitResult>('/api/reports', {
    body: {
      issue: target.issue,
      lat: point.lat,
      lng: point.lng,
      areaSlug: target.areaId || undefined,
      startedAt: new Date(Date.now() - target.minutesAgo * 60_000).toISOString(),
    },
  });
}

export function useOutageFeed({ source = 'live', onEvent, enabled = true }: Options = {}): OutageFeed {
  const demo = useDemoFeed({ onEvent, enabled: enabled && source === 'demo' });
  const live = useLiveFeed({ onEvent, enabled: enabled && source === 'live' });
  return source === 'demo' ? demo : live;
}

/* ------------------------------------------------------------------ */
/* Crews — still local until teams move to the database (Phase 2)      */
/* ------------------------------------------------------------------ */

function useCrews(enabled: boolean, incidentsRef: React.RefObject<Incident[]>) {
  const [crews, setCrews] = useState<Crew[]>(seedCrews);

  // Crews en route drive toward their incident.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      setCrews((prev) =>
        prev.map((crew) => {
          if (crew.status !== 'en_route' || !crew.incidentId) return crew;
          const target = incidentsRef.current?.find((i) => i.id === crew.incidentId);
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
  }, [enabled, incidentsRef]);

  const assign = useCallback((incidentId: string, crewId: string) => {
    setCrews((prev) => prev.map((c) => (c.id === crewId ? { ...c, status: 'en_route', incidentId } : c)));
  }, []);

  const release = useCallback((incidentId: string) => {
    setCrews((prev) =>
      prev.map((c) => (c.incidentId === incidentId ? { ...c, status: 'available', incidentId: undefined, etaMinutes: undefined } : c)),
    );
  }, []);

  return { crews, assign, release };
}

/* ------------------------------------------------------------------ */
/* Live                                                                */
/* ------------------------------------------------------------------ */

function useLiveFeed({ onEvent, enabled }: { onEvent?: (e: FeedEvent) => void; enabled: boolean }): OutageFeed {
  const toast = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dots, setDots] = useState<ReportDot[]>([]);
  const [lastEvent, setLastEvent] = useState<FeedEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const incidentsRef = useRef<Incident[]>([]);
  incidentsRef.current = incidents;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const seenRef = useRef<Map<string, number> | null>(null);
  const [crews, setCrews] = useState<Crew[]>([]);
  const assign = useCallback((incidentId: string, crewId: string) => {
    setCrews((prev) => prev.map((c) => (c.id === crewId ? { ...c, status: 'on_site', incidentId } : c)));
  }, []);
  const release = useCallback((incidentId: string) => {
    setCrews((prev) => prev.map((c) => (c.incidentId === incidentId ? { ...c, status: 'available', incidentId: undefined } : c)));
  }, []);

  const load = useCallback(async () => {
    try {
      const feed = await api<LiveFeed>('/api/incidents');
      // New reports since the last poll become a ticker event (never on first load).
      const before = seenRef.current;
      if (before) {
        const grew = feed.incidents
          .map((i) => ({ i, by: i.reports - (before.get(i.id) ?? 0) }))
          .filter((x) => x.by > 0 && x.i.status !== 'restored')
          .sort((a, b) => b.by - a.by)[0];
        if (grew) {
          const event: FeedEvent = { key: Date.now(), incidentId: grew.i.id, name: 'A neighbour', issue: grew.i.issue, place: grew.i.place };
          setLastEvent(event);
          onEventRef.current?.(event);
        }
      }
      seenRef.current = new Map(feed.incidents.map((i) => [i.id, i.reports]));
      setIncidents(feed.incidents);
      setDots(feed.dots);
      setCrews(feed.crews ?? []);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Poll while the page is visible; catch up as soon as it's back or the phone reconnects.
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const tick = async () => {
      if (!document.hidden) await load();
      timer = window.setTimeout(tick, POLL_MS);
    };
    tick();
    const wake = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      tick();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [enabled, load]);

  const patchIncident = (id: string, patch: Partial<Incident>) =>
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addReport = useCallback<OutageFeed['addReport']>(
    async (incidentId, _name, at) => {
      const target = incidentsRef.current.find((i) => i.id === incidentId);
      if (!target) return null;
      try {
        const result = await joinOutage(target, at);
        void load();
        return result;
      } catch (e) {
        toast({ title: 'Couldn’t send your report', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
        return null;
      }
    },
    [load, toast],
  );

  const setStatus = useCallback<OutageFeed['setStatus']>(
    async (incidentId, status) => {
      const before = incidentsRef.current.find((i) => i.id === incidentId);
      if (!before) return false;
      patchIncident(incidentId, { status, crewId: status === 'restored' ? undefined : before.crewId });
      if (status === 'restored') release(incidentId);
      try {
        await api(`/api/operator/incidents/${incidentId}/status`, { body: { status } });
        void load();
        return true;
      } catch (e) {
        patchIncident(incidentId, { status: before.status, crewId: before.crewId });
        toast({ title: 'Status not saved', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
        return false;
      }
    },
    [load, release, toast],
  );

  const dispatchCrew = useCallback<OutageFeed['dispatchCrew']>(
    async (incidentId, crewId) => {
      const before = incidentsRef.current.find((i) => i.id === incidentId);
      if (!before) return false;
      patchIncident(incidentId, { crewId, status: 'crew_dispatched' });
      assign(incidentId, crewId);
      try {
        await api(`/api/operator/incidents/${incidentId}/dispatch`, { body: { teamId: crewId } });
        void load();
        return true;
      } catch (e) {
        patchIncident(incidentId, { crewId: before.crewId, status: before.status });
        void load();
        toast({ title: 'Dispatch not saved', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
        return false;
      }
    },
    [assign, load, toast],
  );

  const updateInfo = useCallback<OutageFeed['updateInfo']>(
    async (incidentId, info) => {
      await api(`/api/operator/incidents/${incidentId}/update`, { body: info });
      patchIncident(incidentId, {
        ...(info.etaAt !== undefined && { etaAt: info.etaAt ?? undefined }),
        ...(info.cause !== undefined && { cause: info.cause ?? undefined }),
        ...(info.publicNote !== undefined && { publicNote: info.publicNote.trim() || undefined, publicNoteAt: new Date().toISOString() }),
      });
      void load();
    },
    [load],
  );

  return {
    source: 'live',
    incidents,
    crews,
    dots,
    lastEvent,
    loaded,
    offline,
    addReport,
    setStatus,
    dispatchCrew,
    updateInfo,
    refresh: () => void load(),
  };
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/**
 * The scripted Nsukka night: seeded outages with a neighbour "reporting"
 * every 10–16 seconds so the landing and sign-in maps are never static.
 */
function useDemoFeed({ onEvent, enabled }: { onEvent?: (e: FeedEvent) => void; enabled: boolean }): OutageFeed {
  const [incidents, setIncidents] = useState<Incident[]>(seedIncidents);
  const [extraDots, setExtraDots] = useState<ReportDot[]>([]);
  const [lastEvent, setLastEvent] = useState<FeedEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;
  const { crews, assign, release } = useCrews(enabled, incidentsRef);

  const baseDots = useMemo(() => seedIncidents.flatMap((i) => reportDotsFor(i)), []);
  const dots = useMemo(() => [...baseDots, ...extraDots], [baseDots, extraDots]);

  const addReport = useCallback<OutageFeed['addReport']>(async (incidentId, name) => {
    const target = incidentsRef.current.find((i) => i.id === incidentId);
    if (!target) return null;
    const r = Math.sqrt(Math.random()) * target.radius * 0.9;
    const t = Math.random() * Math.PI * 2;
    const p = offsetMeters(target.lat, target.lng, Math.sin(t) * r, Math.cos(t) * r);
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, reports: i.reports + 1 } : i)));
    setExtraDots((prev) => [
      ...prev,
      { id: `${incidentId}-live-${Date.now()}`, incidentId, lat: p.lat, lng: p.lng, issue: target.issue, minutesAgo: 0 },
    ]);
    const event: FeedEvent = { key: Date.now(), incidentId, name, issue: target.issue, place: target.place };
    setLastEvent(event);
    onEventRef.current?.(event);
    return null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const tick = () => {
      const active = incidentsRef.current.filter((i) => i.status !== 'restored');
      if (active.length) {
        // Busier incidents attract more reports, like real life.
        const total = active.reduce((s, i) => s + Math.sqrt(i.reports), 0);
        let pick = Math.random() * total;
        const chosen = active.find((i) => (pick -= Math.sqrt(i.reports)) <= 0) ?? active[0];
        const name = liveReporterNames[Math.floor(Math.random() * liveReporterNames.length)];
        void addReport(chosen.id, name);
      }
      timer = window.setTimeout(tick, 10000 + Math.random() * 6000);
    };
    timer = window.setTimeout(tick, 3500);
    return () => window.clearTimeout(timer);
  }, [enabled, addReport]);

  const setStatus = useCallback<OutageFeed['setStatus']>(
    async (incidentId, status) => {
      setIncidents((prev) =>
        prev.map((i) => (i.id === incidentId ? { ...i, status, crewId: status === 'restored' ? undefined : i.crewId } : i)),
      );
      if (status === 'restored') release(incidentId);
      return true;
    },
    [release],
  );

  const dispatchCrew = useCallback<OutageFeed['dispatchCrew']>(
    async (incidentId, crewId) => {
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: 'crew_dispatched', crewId } : i)));
      assign(incidentId, crewId);
      return true;
    },
    [assign],
  );

  const updateInfo = useCallback<OutageFeed['updateInfo']>(async (incidentId, info) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id !== incidentId
          ? i
          : {
              ...i,
              ...(info.etaAt !== undefined && { etaAt: info.etaAt ?? undefined }),
              ...(info.cause !== undefined && { cause: info.cause ?? undefined }),
              ...(info.publicNote !== undefined && { publicNote: info.publicNote.trim() || undefined, publicNoteAt: new Date().toISOString() }),
            },
      ),
    );
  }, []);

  return {
    source: 'demo',
    incidents,
    crews,
    dots,
    lastEvent,
    loaded: true,
    offline: false,
    addReport,
    setStatus,
    dispatchCrew,
    updateInfo,
    refresh: () => {},
  };
}

/* ------------------------------------------------------------------ */
/* Shared feed for a whole section                                     */
/* ------------------------------------------------------------------ */

const FeedContext = createContext<OutageFeed | null>(null);

/**
 * One feed for a whole section (the operator dashboard), so a dispatch made on
 * the map is still there on the reports and teams pages.
 */
export function OutageFeedProvider({ children, source = 'live' }: { children: ReactNode; source?: FeedSource }) {
  const feed = useOutageFeed({ source });
  return createElement(FeedContext.Provider, { value: feed }, children);
}

/** The section's shared feed if there is one, otherwise a live feed of its own. */
export function useSharedOutageFeed() {
  const shared = useContext(FeedContext);
  const own = useOutageFeed({ enabled: !shared });
  return shared ?? own;
}
