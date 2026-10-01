import type { Incident } from '@/data/nsukka';

export interface PinGroup {
  id: string;
  lng: number;
  lat: number;
  members: Incident[];
}

const severity = (i: Incident) =>
  i.status === 'restored' ? 3 : i.issue === 'no_power' ? 0 : i.status === 'crew_dispatched' ? 2 : 1;

/**
 * Greedy screen-space grouping: incidents whose pins would overlap at the
 * current zoom merge into one group. The most severe incident seeds each
 * group so it is never the one hidden inside another.
 */
export function groupIncidents(
  incidents: Incident[],
  project: (lng: number, lat: number) => { x: number; y: number },
  radiusPx: number,
  keepAlone: (i: Incident) => boolean,
): PinGroup[] {
  const sorted = [...incidents].sort((a, b) => severity(a) - severity(b) || b.reports - a.reports);
  const groups: Array<PinGroup & { x: number; y: number }> = [];
  for (const incident of sorted) {
    const p = project(incident.lng, incident.lat);
    const home = keepAlone(incident)
      ? undefined
      : groups.find((g) => !keepAlone(g.members[0]) && Math.hypot(g.x - p.x, g.y - p.y) < radiusPx);
    if (home) home.members.push(incident);
    else groups.push({ id: incident.id, lng: incident.lng, lat: incident.lat, members: [incident], x: p.x, y: p.y });
  }
  // Centre multi-member groups on their members.
  return groups.map(({ x: _x, y: _y, ...g }) => {
    if (g.members.length === 1) return g;
    const lng = g.members.reduce((s, m) => s + m.lng, 0) / g.members.length;
    const lat = g.members.reduce((s, m) => s + m.lat, 0) / g.members.length;
    return { ...g, id: `group-${g.members.map((m) => m.id).join('-')}`, lng, lat };
  });
}
