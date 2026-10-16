/**
 * Nsukka addressing: area → landmark → exact pin, plus a plus code.
 *
 * A saved place is always a coordinate. Everything a person reads ("near
 * Ogige Market, 120 m south") and everything EEDC needs (feeder, band) is
 * derived from that coordinate, so nobody has to know a street name.
 */

import { areas, areaById, areaContaining, areaScore, nearestArea, type Area } from '@/data/nsukka';
import { landmarks, type Landmark } from '@/data/landmarks';
import { distanceMeters, distanceToRingEdge } from '@/lib/geo';
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

/* ------------------------------------------------------------------ */
/* Area resolution: size-aware, honest about GPS error, and corrected   */
/* by the people who live there.                                       */
/* ------------------------------------------------------------------ */

/** "I'm in Hilltop, not Odim Gate" — remembered for points nearby. */
export interface AreaCorrection {
  lat: number;
  lng: number;
  areaId: string;
}

/** A correction applies to anything within this distance of where it was made. */
const CORRECTION_RADIUS_M = 150;

let corrections: AreaCorrection[] = [];

/** Set by ProfileProvider from the saved profile. Server code never sees any. */
export function setAreaCorrections(list: AreaCorrection[]) {
  corrections = list;
}

export interface AreaMatch {
  area: Area;
  /** Other areas the person could plausibly be in, best first. */
  alternatives: Area[];
  /** False when GPS error or a near-tie means we should ask. */
  confident: boolean;
  /** True when a resident's own correction decided it. */
  corrected: boolean;
}

/**
 * Which area a point is in.
 *
 * 1. Inside a resident-drawn boundary (Hilltop): that area, full stop — unless
 *    the GPS error reaches past its edge, then we ask.
 * 2. Otherwise: a resident's correction for this spot, or the closest centre
 *    (scaled by size) among areas without a boundary.
 *
 * With `accuracy` (metres, from the GPS fix) any area the error circle could
 * reach is offered as an alternative, so a rough fix asks "Hilltop or Odim
 * Gate?" instead of confidently guessing wrong.
 */
export function resolveArea(p: LatLng, accuracy = 0, list: AreaCorrection[] = corrections): AreaMatch {
  const open = areas.filter((a) => !a.boundary);
  const ranked = open
    .map((a) => {
      const d = distanceMeters(a, p);
      return { a, d, s: areaScore(a, p, d) };
    })
    .sort((x, y) => x.s - y.s);
  // Bounded areas the GPS error circle reaches into.
  const boundedNearby = areas.filter((a) => a.boundary && distanceToRingEdge(p, a.boundary) <= accuracy);

  const inside = areaContaining(p);
  if (inside) {
    const unsure = accuracy > distanceToRingEdge(p, inside.boundary!);
    const alternatives = unsure
      ? [...boundedNearby.filter((a) => a.id !== inside.id), ...ranked.slice(0, 2).map((r) => r.a)].slice(0, 3)
      : [];
    return { area: inside, alternatives, confident: !unsure, corrected: false };
  }

  // A boundary is the last word on its area, so corrections only pick among the rest.
  let correction: AreaCorrection | null = null;
  let correctionMeters = CORRECTION_RADIUS_M;
  for (const c of list) {
    const d = distanceMeters(c, p);
    if (d < correctionMeters && areaById[c.areaId] && !areaById[c.areaId].boundary) {
      correction = c;
      correctionMeters = d;
    }
  }

  const best = correction ? ranked.find((r) => r.a.id === correction.areaId)! : ranked[0];
  const worstCase = areaScore(best.a, p, best.d + accuracy);
  const alternatives = [
    ...boundedNearby,
    ...ranked
      .filter((r) => r.a.id !== best.a.id)
      .filter((r) => r.s < best.s * 1.25 || areaScore(r.a, p, Math.max(0, r.d - accuracy)) <= worstCase)
      .map((r) => r.a),
  ].slice(0, 3);

  return {
    area: best.a,
    alternatives,
    confident: Boolean(correction) || alternatives.length === 0,
    corrected: Boolean(correction),
  };
}

const roundMeters = (m: number) => (m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50);

/** Reverse-geocode a pin into words people in Nsukka use. */
export function describeLocation(p: LatLng): LocationDescription {
  const { area } = resolveArea(p);
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
    const s = score(q, [a.name, ...(a.aka ?? [])]) + (q.length >= 4 ? score(q, [a.feeder]) / 4 : 0);
    if (s) results.push({ type: 'area', id: a.id, name: a.name, detail: a.aka?.length ? `Area · also called ${a.aka[0]}` : `Area · ${a.feeder}`, lat: a.lat, lng: a.lng, s: s + 5 });
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
