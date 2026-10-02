/** Small geo helpers for the mock map. Swap for PostGIS queries later. */

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Offset a point by metres north and east. */
export function offsetMeters(
  lat: number,
  lng: number,
  north: number,
  east: number,
) {
  const dLat = north / 111_320;
  const dLng = east / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** GeoJSON polygon ring approximating a circle, for zone fills. */
export function circleRing(lat: number, lng: number, radius: number, steps = 64) {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const p = offsetMeters(lat, lng, Math.sin(angle) * radius, Math.cos(angle) * radius);
    ring.push([p.lng, p.lat]);
  }
  return ring;
}

/** Deterministic PRNG so server and client agree on generated mock points. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function formatAgo(minutes: number) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} hr ${rest} min ago` : `${hours} hr ago`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/* ------------------------------------------------------------------ */
/* Boundaries: a ring of [lng, lat] pairs (GeoJSON order), first ≠ last ok */
/* ------------------------------------------------------------------ */

export type Ring = [number, number][];

/** Ray casting. Fine at Nsukka scale, where the earth is flat enough. */
export function pointInRing(p: { lat: number; lng: number }, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to the nearest edge of a ring (inside or out). */
export function distanceToRingEdge(p: { lat: number; lng: number }, ring: Ring) {
  // Local flat projection in metres around p.
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 111_320;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const x1 = (ax - p.lng) * kx, y1 = (ay - p.lat) * ky;
    const x2 = (bx - p.lng) * kx, y2 = (by - p.lat) * ky;
    const dx = x2 - x1, dy = y2 - y1;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x1 + t * dx, y1 + t * dy));
  }
  return best;
}

/**
 * Everything within `radius` metres of the line a→b, as a ring: a strip with
 * rounded ends. Used when residents have only pinned the two ends of an area.
 */
export function capsuleRing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  radius: number,
  stepsPerEnd = 12,
): Ring {
  const north = (b.lat - a.lat) * 111_320;
  const east = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const heading = Math.atan2(north, east); // direction a→b, radians from east
  const ring: Ring = [];
  const arc = (c: { lat: number; lng: number }, from: number) => {
    for (let i = 0; i <= stepsPerEnd; i++) {
      const ang = from + (i / stepsPerEnd) * Math.PI;
      const q = offsetMeters(c.lat, c.lng, Math.sin(ang) * radius, Math.cos(ang) * radius);
      ring.push([q.lng, q.lat]);
    }
  };
  arc(b, heading - Math.PI / 2); // round the far end
  arc(a, heading + Math.PI / 2); // and the near end
  return ring;
}

/** Smallest convex ring around a set of rings — joins pinned pieces of one area. */
export function convexHull(...rings: Ring[]): Ring {
  const pts = rings.flat().slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Ring = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Ring = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
