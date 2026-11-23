import { ELEVATIONS, levelMarkers, rooftop, site, type LevelMarker } from './villa';

/**
 * A coarse box model of the villa (mirrors the volumes described in villa.ts).
 * It is never drawn. It exists so that the UI can reason about the building
 * in screen space: keeping copy clear of the model, and routing label leaders
 * so they never pass over the house.
 */
export interface Box {
  min: [number, number];
  max: [number, number];
  y0: number;
  y1: number;
}

const RAIL = 1.1;
const t = rooftop.tower;
const p = rooftop.pavilion;

export const volumes: Box[] = [
  /* 0 */ { min: [-20, -12.5], max: [20, 1.5], y0: 0, y1: ELEVATIONS.first }, // ground bar
  /* 1 */ { min: [-20, 1.5], max: [-6, 12.5], y0: 0, y1: ELEVATIONS.first + RAIL }, // garden wing + its terrace rail
  /* 2 */ { min: [-14, -12.5], max: [24, 1.5], y0: ELEVATIONS.first, y1: ELEVATIONS.second + RAIL }, // first floor
  /* 3 */ { min: [12, 1.5], max: [24, 5.2], y0: ELEVATIONS.first - 0.3, y1: ELEVATIONS.first + RAIL }, // master terrace
  /* 4 */ { min: [-10, -10.5], max: [16, 3.5], y0: ELEVATIONS.second, y1: ELEVATIONS.rooftop }, // second floor
  /* 5 */ { min: [-10, 3.5], max: [16, 5.6], y0: ELEVATIONS.second - 0.3, y1: ELEVATIONS.second + RAIL }, // sky balcony
  /* 6 */ { min: [-11, -11.5], max: [17, 5.9], y0: ELEVATIONS.rooftop - 0.3, y1: ELEVATIONS.rooftop + 1 }, // roof + parapet
  /* 7 */ { min: t.min, max: t.max, y0: ELEVATIONS.rooftop, y1: ELEVATIONS.rooftop + t.height }, // tower
  /* 8 */ { min: p.min, max: p.max, y0: ELEVATIONS.rooftop, y1: ELEVATIONS.rooftop + p.height + 0.7 }, // pergola
];

export type Pt = [number, number, number];

export function boxCorners(b: Box): Pt[] {
  const out: Pt[] = [];
  for (const y of [b.y0, b.y1]) {
    out.push([b.min[0], y, b.min[1]], [b.max[0], y, b.min[1]], [b.max[0], y, b.max[1]], [b.min[0], y, b.max[1]]);
  }
  return out;
}

const ring = (b: Box, y: number): Pt[] => [
  [b.min[0], y, b.min[1]],
  [b.max[0], y, b.min[1]],
  [b.max[0], y, b.max[1]],
  [b.min[0], y, b.max[1]],
];

/**
 * For each level marker: the points on the building, at that level's
 * elevation, that a leader is allowed to start from. The label system picks,
 * every frame, one whose path to the margin is clear of the building.
 */
export const markerCandidates: { marker: LevelMarker; points: Pt[] }[] = levelMarkers.map((marker) => {
  const y = marker.elevation;
  const from: Box[] =
    marker.id === 'ground'
      ? [volumes[0], volumes[1]]
      : marker.id === 'first'
        ? [volumes[2], volumes[3]]
        : marker.id === 'second'
          ? [volumes[2], volumes[4], volumes[5]]
          : [volumes[6]];
  return { marker, points: from.flatMap((b) => ring(b, y)) };
});

/** Everything that must stay fully in frame: the house, plus room for the plan's dimension lines. */
export const housePoints: Pt[] = [
  ...volumes.flatMap(boxCorners),
  [-24.5, 0, -17],
  [26, 0, -17],
  [-24.5, 0, 16.5],
  [26, 0, 16.5],
];

/** Everything that copy must never overlap: the house, the whole plot, and the trees. */
export const sitePoints: Pt[] = [
  ...housePoints,
  ...site.plot.flatMap(([x, z]): Pt[] => [
    [x, 0, z],
    [x, -1.6, z],
  ]),
  ...site.trees.flatMap((tr): Pt[] => [
    [tr.pos[0], tr.base + tr.height, tr.pos[1]],
    [tr.pos[0] - tr.radius, tr.base + tr.height * 0.6, tr.pos[1]],
    [tr.pos[0] + tr.radius, tr.base + tr.height * 0.6, tr.pos[1]],
  ]),
  ...rooftop.trees.map((tr): Pt => [tr.pos[0], tr.base + tr.height, tr.pos[1]]),
];
