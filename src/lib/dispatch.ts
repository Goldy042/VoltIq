/**
 * The operator's work queue: which outages need what, in what order, and how
 * worried to be about the wait. Pure, so it's tested without a browser.
 */

import type { Incident } from '@/data/nsukka';

export type QueueTab = 'confirm' | 'assign' | 'active' | 'fixed';

export const queueTabs: Array<{ id: QueueTab; label: string; empty: string }> = [
  { id: 'confirm', label: 'Confirm', empty: 'Nothing waiting. New reports land here first.' },
  { id: 'assign', label: 'Assign', empty: 'Every confirmed fault has a team.' },
  { id: 'active', label: 'In progress', empty: 'No teams out right now.' },
  { id: 'fixed', label: 'Fixed', empty: 'Nothing fixed in the last few hours.' },
];

const tabOf: Record<Incident['status'], QueueTab> = {
  reported: 'confirm',
  confirmed: 'assign',
  crew_dispatched: 'active',
  restored: 'fixed',
};

/** Higher = look at it first: more people, more homes, and longer without light. */
export function priority(i: Incident) {
  const weight = i.issue === 'no_power' ? 1.5 : 1;
  return (i.reports * 4 + i.households / 25) * weight * (1 + i.minutesAgo / 90);
}

export function buildQueue(incidents: Incident[]): Record<QueueTab, Incident[]> {
  const q: Record<QueueTab, Incident[]> = { confirm: [], assign: [], active: [], fixed: [] };
  for (const i of incidents) q[tabOf[i.status]].push(i);
  q.confirm.sort((a, b) => priority(b) - priority(a));
  q.assign.sort((a, b) => priority(b) - priority(a));
  // Longest-running jobs first, so stuck ones surface.
  q.active.sort((a, b) => b.minutesAgo - a.minutesAgo);
  q.fixed.sort((a, b) => a.minutesAgo - b.minutesAgo);
  return q;
}

export const tabFor = (i: Incident) => tabOf[i.status];

export type WaitLevel = 'ok' | 'slow' | 'late';

/** How long people have been without light, as a colour: under 1 h fine, under 3 h slow, then late. */
export function waitLevel(minutes: number): WaitLevel {
  if (minutes < 60) return 'ok';
  if (minutes < 180) return 'slow';
  return 'late';
}

export const waitColor: Record<WaitLevel, string> = {
  ok: 'var(--ink-muted)',
  slow: 'var(--status-low)',
  late: 'var(--status-out)',
};

/** "45m" / "2h 10m" / "3d" — compact, for queue rows. */
export function shortDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  if (h >= 48) return `${Math.round(h / 24)}d`;
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}
