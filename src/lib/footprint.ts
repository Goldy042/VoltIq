/**
 * Where an outage really is. Nsukka is cut into blocks about 100 m across; an
 * outage covers the blocks its reports came from, not the whole area it's
 * in. Neighbours who say they have light mark blocks that are fine, which
 * stops five dark homes being read as "Odenigwe has no light".
 *
 * Shared by the server and the map, and unit-tested (footprint.test.ts).
 */

import { distanceMeters } from './geo';

type Point = { lat: number; lng: number };

/** Block size: 0.0009° ≈ 100 m each way in Nsukka. */
export const CELL_DEG = 0.0009;
/** One block's ground area in m² (≈ 100 m × 99 m at Nsukka's latitude). */
export const CELL_AREA_M2 = 9_900;

/** A block as [row, col] on the grid. */
export type Cell = [number, number];

export function cellOf(p: Point): Cell {
  return [Math.floor(p.lat / CELL_DEG), Math.floor(p.lng / CELL_DEG)];
}

export function cellCenter([row, col]: Cell): Point {
  return { lat: (row + 0.5) * CELL_DEG, lng: (col + 0.5) * CELL_DEG };
}

/** The block's outline as a closed [lng, lat] ring, for map polygons. */
export function cellRing([row, col]: Cell): [number, number][] {
  const s = row * CELL_DEG;
  const w = col * CELL_DEG;
  const n = s + CELL_DEG;
  const e = w + CELL_DEG;
  return [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
}

const keyOf = (c: Cell) => `${c[0]}:${c[1]}`;

function uniqueCells(points: Point[]) {
  const out = new Map<string, Cell>();
  for (const p of points) {
    const c = cellOf(p);
    out.set(keyOf(c), c);
  }
  return out;
}

/**
 * How big the outage is, which hints at what failed:
 * - pocket: a block or two (a transformer, a line, a few meters)
 * - street: a stretch of a few hundred metres
 * - area: reports spread across the neighbourhood (likely the feeder)
 * - scattered: dark homes with lit homes between them (house wiring or meters)
 */
export type Scope = 'pocket' | 'street' | 'area' | 'scattered';

export interface Footprint {
  /** Blocks where people reported no light. */
  off: Cell[];
  /** Blocks where neighbours said they have light (and nobody reported). */
  on: Cell[];
  scope: Scope;
  /** Widest distance across the dark blocks, edge to edge, in metres. */
  spanM: number;
}

export const POCKET_MAX_CELLS = 2;
export const POCKET_MAX_SPAN_M = 250;
export const STREET_MAX_SPAN_M = 600;

export function buildFootprint(offPoints: Point[], onPoints: Point[]): Footprint {
  const off = uniqueCells(offPoints);
  const on = uniqueCells(onPoints);
  for (const k of off.keys()) on.delete(k);
  const offCells = [...off.values()];
  const onCells = [...on.values()];

  let spanM = offCells.length ? 100 : 0;
  for (let i = 0; i < offCells.length; i++) {
    for (let j = i + 1; j < offCells.length; j++) {
      spanM = Math.max(spanM, Math.round(distanceMeters(cellCenter(offCells[i]), cellCenter(offCells[j]))) + 100);
    }
  }

  // Lit blocks among the dark ones: as many fine as dark means it isn't one fault.
  let scope: Scope;
  const rows = offCells.map((c) => c[0]);
  const cols = offCells.map((c) => c[1]);
  const litBetween = offCells.length
    ? onCells.filter(
        ([r, c]) => r >= Math.min(...rows) - 1 && r <= Math.max(...rows) + 1 && c >= Math.min(...cols) - 1 && c <= Math.max(...cols) + 1,
      ).length
    : 0;
  if (offCells.length >= 3 && litBetween >= offCells.length) scope = 'scattered';
  else if (offCells.length <= POCKET_MAX_CELLS && spanM <= POCKET_MAX_SPAN_M) scope = 'pocket';
  else if (spanM <= STREET_MAX_SPAN_M) scope = 'street';
  else scope = 'area';

  return { off: offCells, on: onCells, scope, spanM };
}

/**
 * Homes affected: the dark blocks times how many homes a block of this area
 * holds. Scattered outages are just the homes that reported. Never fewer than
 * the people who reported, never more than the area has.
 */
export function footprintHomes(
  fp: Pick<Footprint, 'off' | 'scope'>,
  reporters: number,
  areaHouseholds: number | null,
  areaRadiusM: number | null,
) {
  if (fp.scope === 'scattered' || !areaHouseholds || !areaRadiusM) return reporters;
  const perCell = (areaHouseholds / (Math.PI * areaRadiusM * areaRadiusM)) * CELL_AREA_M2;
  return Math.min(areaHouseholds, Math.max(reporters, Math.round(fp.off.length * perCell)));
}

/** Metres from a point to the nearest dark block's edge (0 inside one). */
export function distanceToCells(p: Point, cells: Cell[]) {
  let best = Infinity;
  for (const c of cells) best = Math.min(best, Math.max(0, distanceMeters(p, cellCenter(c)) - 50));
  return best;
}

export const scopeMeta: Record<Scope, { label: string; hint: string; staffHint: string }> = {
  pocket: {
    label: 'A few homes',
    hint: 'Only a block or two around here.',
    staffHint: 'One or two blocks. Likely a transformer, a single line or a few meters.',
  },
  street: {
    label: 'One street',
    hint: 'A stretch of a few hundred metres.',
    staffHint: 'A few hundred metres. Likely a section of line or one transformer.',
  },
  area: {
    label: 'Area-wide',
    hint: 'Reports from across the neighbourhood.',
    staffHint: 'Spread across the neighbourhood. Likely the feeder.',
  },
  scattered: {
    label: 'Scattered homes',
    hint: 'Neighbours in between have light.',
    staffHint: 'Lit homes between the dark ones. Likely prepaid meters or house wiring, not the grid.',
  },
};
