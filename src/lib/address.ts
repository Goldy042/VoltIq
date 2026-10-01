/**
 * Nsukka addressing: area → landmark → exact pin, plus a plus code.
 *
 * A saved place is always a coordinate. Everything a person reads ("near
 * Ogige Market, 120 m south") and everything EEDC needs (feeder, band) is
 * derived from that coordinate, so nobody has to know a street name.
 */

import { areas, areaById, nearestArea, type Area } from '@/data/nsukka';
import { landmarks, type Landmark } from '@/data/landmarks';
import { distanceMeters } from '@/lib/geo';
import { shortPlusCode } from '@/lib/pluscode';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationDescription {
  area: Area;
  landmark: Landmark | null;
  landmarkMeters: number;
  /** "Beside", "120 m south of" … */
  relation: string;
  /** One-line human description, e.g. "120 m south of Ogige Market, Ogige". */
  summary: string;
  plusCode: string;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function bearingWord(from: LatLng, to: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

const roundMeters = (m: number) => (m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50);

/** Reverse-geocode a pin into words people in Nsukka use. */
export function describeLocation(p: LatLng): LocationDescription {
  const area = nearestArea(p);
  let landmark: Landmark | null = null;
  let landmarkMeters = Infinity;
  for (const l of landmarks) {
    const d = distanceMeters(l, p);
    if (d < landmarkMeters) {
      landmark = l;
      landmarkMeters = d;
    }
  }
  if (landmarkMeters > 900) landmark = null;

  let relation = '';
  if (landmark) {
    relation = landmarkMeters < 60 ? 'Beside' : `${roundMeters(landmarkMeters)} m ${bearingWord(landmark, p)} of`;
  }
  const areaPart = landmark && landmark.name.includes(area.name) ? '' : area.name;
  const summary = landmark
    ? `${relation} ${landmark.name}${areaPart ? `, ${areaPart}` : ''}`
    : `${area.name}, Nsukka`;

  return { area, landmark, landmarkMeters, relation, summary, plusCode: shortPlusCode(p.lat, p.lng) };
}

export type SearchResult =
  | { type: 'area'; id: string; name: string; detail: string; lat: number; lng: number }
  | { type: 'landmark'; id: string; name: string; detail: string; lat: number; lng: number; kind: Landmark['kind'] };

const norm = (s: string) => s.toLowerCase().replace(/[’'.,()-]/g, ' ').replace(/\s+/g, ' ').trim();

function score(query: string, names: string[]) {
  let best = 0;
  for (const raw of names) {
    const n = norm(raw);
    if (n === query) best = Math.max(best, 100);
    else if (n.startsWith(query)) best = Math.max(best, 80);
    else if (n.split(' ').some((w) => w.startsWith(query))) best = Math.max(best, 60);
    else if (n.includes(query)) best = Math.max(best, 40);
  }
  return best;
}

/** Search areas and landmarks together, best matches first. */
export function searchPlaces(input: string, limit = 7): SearchResult[] {
  const q = norm(input);
  if (!q) return [];
  const results: Array<SearchResult & { s: number }> = [];
  for (const a of areas) {
    // Feeder names only count weakly, so "unn" finds the campus before every area on the UNN feeder.
    const s = score(q, [a.name]) + (q.length >= 4 ? score(q, [a.feeder]) / 4 : 0);
    if (s) results.push({ type: 'area', id: a.id, name: a.name, detail: `Area · ${a.feeder}`, lat: a.lat, lng: a.lng, s: s + 5 });
  }
  for (const l of landmarks) {
    const s = score(q, [l.name, ...(l.aka ?? [])]);
    if (s) {
      results.push({
        type: 'landmark',
        id: l.id,
        name: l.name,
        kind: l.kind,
        detail: `Landmark · ${nearestArea(l).name}`,
        lat: l.lat,
        lng: l.lng,
        s,
      });
    }
  }
  // An area and a landmark often share a name (Odim Gate); keep the better match.
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name))
    .filter((r) => (seen.has(norm(r.name)) ? false : (seen.add(norm(r.name)), true)))
    .slice(0, limit)
    .map(({ s: _s, ...r }) => r);
}

export { areaById };
