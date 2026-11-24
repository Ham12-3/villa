/**
 * VILLA SEREIN — single source of truth.
 *
 * Everything the site draws (2D plans and the 3D building) is generated from
 * this file. Plan coordinates are metres: [x, z] with +x = east (screen right)
 * and +z = garden front (towards the camera). Elevations are metres above
 * ground. The house footprint spans x -20..20 (plus a 4 m cantilever) and
 * z -12.5..12.5.
 */

export type Vec2 = [number, number];

export type OpeningType = 'door' | 'window' | 'glass' | 'arch';

export interface Opening {
  /** distance from wall start to the centre of the opening */
  at: number;
  width: number;
  height: number;
  /** sill height above floor level */
  sill: number;
  type: OpeningType;
  /** door swing side (+1 / -1 relative to the wall normal) */
  swing?: 1 | -1;
}

export interface Wall {
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  openings: Opening[];
  exterior: boolean;
}

export interface Room {
  name: string;
  poly: Vec2[];
  /** optional small note under the name */
  note?: string;
}

export interface Slab {
  poly: Vec2[];
  holes?: Vec2[][];
  thickness: number;
  /** elevation of the top surface */
  top: number;
}

export interface Railing {
  path: Vec2[];
  base: number;
  height: number;
}

export interface Stair {
  /** centre of the first riser */
  start: Vec2;
  /** unit direction of travel */
  dir: Vec2;
  width: number;
  steps: number;
  from: number;
  to: number;
  run: number;
}

export interface Dimension {
  a: Vec2;
  b: Vec2;
  /** offset of the dimension line from the measured edge (signed, along the left normal) */
  offset: number;
}

export interface Level {
  id: 'ground' | 'first' | 'second';
  name: string;
  label: string;
  elevation: number;
  slab: Slab;
  walls: Wall[];
  rooms: Room[];
  dimensions: Dimension[];
}

export interface Tree {
  pos: Vec2;
  base: number;
  height: number;
  /** widest canopy radius */
  radius: number;
  kind: 'cypress' | 'olive';
}

// ---------------------------------------------------------------- helpers

const EXT = 0.3;
const INT = 0.16;

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const wall = (
  a: Vec2,
  b: Vec2,
  height: number,
  openings: Opening[] = [],
  exterior = false,
): Wall => ({ a, b, height, openings, exterior, thickness: exterior ? EXT : INT });

const ext = (a: Vec2, b: Vec2, height: number, openings: Opening[] = []) =>
  wall(a, b, height, openings, true);

const win = (at: number, width = 1.8, height = 1.9, sill = 0.9): Opening => ({
  at,
  width,
  height,
  sill,
  type: 'window',
});
const glass = (at: number, width: number, height = 3.3): Opening => ({
  at,
  width,
  height,
  sill: 0,
  type: 'glass',
});
const door = (at: number, width = 1.0, swing: 1 | -1 = 1, height = 2.4): Opening => ({
  at,
  width,
  height,
  sill: 0,
  type: 'door',
  swing,
});
const arch = (at: number, width = 2.6, height = 3.2, sill = 0): Opening => ({
  at,
  width,
  height,
  sill,
  type: 'arch',
});

// ---------------------------------------------------------------- levels

export const ELEVATIONS = {
  ground: 0,
  first: 4.0,
  second: 8.0,
  rooftop: 12.1,
} as const;

const H0 = 3.7; // clear wall height, ground
const H1 = 3.7;
const H2 = 3.8;

/** GROUND +0.000 — L-shaped plinth: 40 x 14 m bar plus a 14 x 11 m garden wing. */
const ground: Level = {
  id: 'ground',
  name: 'Ground Floor',
  label: 'GROUND',
  elevation: ELEVATIONS.ground,
  slab: {
    poly: [
      [-20, -12.5],
      [20, -12.5],
      [20, 1.5],
      [-6, 1.5],
      [-6, 12.5],
      [-20, 12.5],
    ],
    thickness: 0.35,
    top: 0,
  },
  walls: [
    // perimeter (counter-clockwise from the back-left corner)
    ext([-20, -12.5], [20, -12.5], H0, [
      win(4),
      win(9.5),
      win(17, 2.4),
      door(26, 2.2, 1, 2.8), // main entrance
      { at: 35, width: 5.2, height: 2.7, sill: 0, type: 'door' }, // garage
    ]),
    ext([20, -12.5], [20, 1.5], H0, [win(3.5, 2.2), win(10.5, 2.6, 2.2, 0.7)]),
    // double-height living facade
    ext([20, 1.5], [-6, 1.5], H0, [win(4, 3.2, 2.4, 0.5), glass(17, 16.4, 3.4)]),
    // garden wing — arched loggia facing the pool
    ext([-6, 1.5], [-6, 12.5], H0, [arch(2.2), arch(5.5), arch(8.8)]),
    ext([-6, 12.5], [-20, 12.5], H0, [arch(2.6), arch(7), arch(11.4)]),
    ext([-20, 12.5], [-20, -12.5], H0, [
      win(4, 2.6, 2.2, 0.7),
      win(10.5, 2.6, 2.2, 0.7),
      win(16.5),
      win(21.5),
    ]),
    // interior
    wall([-20, -5.5], [-6, -5.5], H0, [door(11, 1.6, 1)]),
    wall([-6, -5.5], [20, -5.5], H0, [door(4, 1.0, -1), door(12, 2.0, 1), door(20, 1.0, 1)]),
    wall([-6, -12.5], [-6, -5.5], H0, [door(5.2, 1.0, 1)]),
    wall([2, -12.5], [2, -5.5], H0, [door(4.5, 1.0, -1)]),
    wall([10, -12.5], [10, -5.5], H0, [door(5.5, 1.0, 1)]),
    wall([12, -5.5], [12, 1.5], H0, [door(1.6, 1.0, -1)]),
    wall([-6, -5.5], [-6, 1.5], H0, [{ at: 3.5, width: 4.6, height: 3.0, sill: 0, type: 'glass' }]),
    wall([-20, 3.5], [-6, 3.5], H0, [arch(7, 3.4, 3.1)]),
  ],
  rooms: [
    { name: 'Living', note: 'double height', poly: rect(-6, -5.5, 12, 1.5) },
    { name: 'Dining', poly: rect(-20, -5.5, -6, 3.5) },
    { name: 'Kitchen', poly: rect(-20, -12.5, -6, -5.5) },
    { name: 'Stair Hall', poly: rect(-6, -12.5, 2, -5.5) },
    { name: 'Entrance', poly: rect(2, -12.5, 10, -5.5) },
    { name: 'Garage', poly: rect(10, -12.5, 20, -5.5) },
    { name: 'Study', poly: rect(12, -5.5, 20, 1.5) },
    { name: 'Pool Loggia', poly: rect(-20, 3.5, -6, 12.5) },
  ],
  dimensions: [
    { a: [-20, -12.5], b: [20, -12.5], offset: -3.2 },
    { a: [-20, 12.5], b: [-20, -12.5], offset: -3.2 },
    { a: [-6, 12.5], b: [-20, 12.5], offset: -2.6 },
    { a: [20, -12.5], b: [20, 1.5], offset: -2.6 },
  ],
};

/** FIRST FLOOR +4.000 — bar shifted 4 m east, cantilevering over the forecourt. */
const first: Level = {
  id: 'first',
  name: 'First Floor',
  label: 'FIRST FLOOR',
  elevation: ELEVATIONS.first,
  slab: {
    poly: [
      [-20, -12.5],
      [24, -12.5],
      [24, 1.5],
      [-6, 1.5],
      [-6, 12.5],
      [-20, 12.5],
    ],
    // void over the double-height living room, and the stair opening
    holes: [rect(-5.6, -5.2, 11.6, 1.1), rect(-3.2, -8.8, 1.6, -7.2)],
    thickness: 0.3,
    top: ELEVATIONS.first,
  },
  walls: [
    ext([-14, -12.5], [24, -12.5], H1, [win(4), win(12, 3.0, 2.2, 0.7), win(22, 3.0, 2.2, 0.7), win(32)]),
    ext([24, -12.5], [24, 1.5], H1, [win(3.5, 2.4), glass(10.5, 4.4, 2.9)]),
    ext([24, 1.5], [-14, 1.5], H1, [glass(6, 9.6, 3.0), glass(21, 16.4, 3.4), glass(34, 5.0, 2.9)]),
    ext([-14, 1.5], [-14, -12.5], H1, [glass(3.5, 4.2, 2.9), win(10.5, 2.4)]),
    wall([-14, -5.5], [-6, -5.5], H1, [door(6.5, 1.0, 1)]),
    wall([12, -5.5], [24, -5.5], H1, [door(1.6, 1.0, -1), door(8, 1.0, 1)]),
    wall([-6, -12.5], [-6, 1.5], H1, [door(5.5, 1.0, 1)]),
    wall([12, -12.5], [12, 1.5], H1, [door(5.2, 1.0, -1)]),
  ],
  rooms: [
    { name: 'Master Suite', poly: rect(12, -5.5, 24, 1.5) },
    { name: 'Master Bath', poly: rect(12, -12.5, 24, -5.5) },
    { name: 'Gallery', poly: rect(-6, -12.5, 12, -5.5) },
    { name: 'Void', note: 'living below', poly: rect(-6, -5.5, 12, 1.5) },
    { name: 'Bedroom 2', poly: rect(-14, -5.5, -6, 1.5) },
    { name: 'Bedroom 3', poly: rect(-14, -12.5, -6, -5.5) },
    { name: 'Wing Terrace', poly: rect(-20, 1.5, -6, 12.5) },
  ],
  dimensions: [],
};

/** SECOND FLOOR +8.000 — compact pavilion pushed 2 m forward over the glass facade. */
const second: Level = {
  id: 'second',
  name: 'Second Floor',
  label: 'SECOND FLOOR',
  elevation: ELEVATIONS.second,
  slab: {
    poly: [
      [-14, -12.5],
      [24, -12.5],
      [24, 1.5],
      [16, 1.5],
      [16, 3.5],
      [-10, 3.5],
      [-10, 1.5],
      [-14, 1.5],
    ],
    thickness: 0.3,
    top: ELEVATIONS.second,
  },
  walls: [
    ext([-10, -10.5], [16, -10.5], H2, [win(5, 3.0, 2.2, 0.7), win(13, 1.8), win(20, 3.0, 2.2, 0.7)]),
    ext([16, -10.5], [16, 3.5], H2, [arch(3, 2.2, 3.2), arch(7, 2.2, 3.2), arch(11, 2.2, 3.2)]),
    ext([16, 3.5], [-10, 3.5], H2, [glass(6.5, 11.4, 3.2), glass(19.5, 11.4, 3.2)]),
    ext([-10, 3.5], [-10, -10.5], H2, [glass(3.5, 4.4, 3.0), win(10, 2.6, 2.2, 0.7)]),
    wall([3, -10.5], [3, 3.5], H2, [door(4, 1.0, 1), door(10.5, 1.0, -1)]),
    wall([-10, -3.5], [3, -3.5], H2, [door(10, 1.0, 1)]),
  ],
  rooms: [
    { name: 'Sky Lounge', poly: rect(3, -10.5, 16, 3.5) },
    { name: 'Guest Suite', poly: rect(-10, -3.5, 3, 3.5) },
    { name: 'Studio', poly: rect(-10, -10.5, 3, -3.5) },
    { name: 'East Terrace', poly: rect(16, -12.5, 24, 1.5) },
  ],
  dimensions: [],
};

export const levels: Level[] = [ground, first, second];

// ---------------------------------------------------------------- details

/** Cantilevered slabs that slide out of the building in the details chapter. */
export const terraces: (Slab & { slide: [number, number, number]; name: string })[] = [
  {
    name: 'Master terrace',
    poly: rect(12, 1.5, 24, 5.2),
    thickness: 0.3,
    top: ELEVATIONS.first,
    slide: [0, 0, -3.7],
  },
  {
    name: 'Sky balcony',
    poly: rect(-10, 3.5, 16, 5.6),
    thickness: 0.3,
    top: ELEVATIONS.second,
    slide: [0, 0, -2.1],
  },
];

const RAIL = 1.1;

export const railings: Railing[] = [
  // wing roof terrace (first floor)
  { path: [[-6, 1.5], [-6, 12.5], [-20, 12.5], [-20, -12.5], [-14, -12.5]], base: ELEVATIONS.first, height: RAIL },
  // cantilevered master terrace
  { path: [[12, 1.5], [12, 5.2], [24, 5.2], [24, 1.5]], base: ELEVATIONS.first, height: RAIL },
  // gallery edge over the living void
  { path: [[-5.6, -5.3], [11.6, -5.3]], base: ELEVATIONS.first, height: RAIL },
  // second floor roof terraces
  { path: [[16, 1.5], [24, 1.5], [24, -12.5], [-14, -12.5], [-14, 1.5], [-10, 1.5]], base: ELEVATIONS.second, height: RAIL },
  // sky balcony
  { path: [[-10, 3.5], [-10, 5.6], [16, 5.6], [16, 3.5]], base: ELEVATIONS.second, height: RAIL },
];

export const stairs: Stair[] = [
  { start: [-5.0, -8.0], dir: [1, 0], width: 1.3, steps: 20, from: 0, to: ELEVATIONS.first, run: 0.29 },
  { start: [4.2, -9.0], dir: [1, 0], width: 1.3, steps: 20, from: ELEVATIONS.first, to: ELEVATIONS.second, run: 0.29 },
];

// ---------------------------------------------------------------- rooftop

export const rooftop = {
  elevation: ELEVATIONS.rooftop,
  /** roof slab oversails the second floor and shades the sky balcony */
  slab: {
    poly: rect(-11, -11.5, 17, 5.9),
    thickness: 0.3,
    top: ELEVATIONS.rooftop,
  } as Slab,
  parapet: {
    path: [[-10.8, -11.3], [16.8, -11.3], [16.8, 5.7], [-10.8, 5.7], [-10.8, -11.3]] as Vec2[],
    base: ELEVATIONS.rooftop,
    height: 1.0,
  } as Railing,
  /** observatory tower with tall arched windows on every face */
  tower: {
    min: [-9.2, -9.6] as Vec2,
    max: [-3.2, -3.6] as Vec2,
    height: 5.6,
    wallThickness: 0.3,
    roofThickness: 0.25,
    arch: { width: 1.5, height: 4.1, sill: 0.6, perFace: 2 },
  },
  /** open pavilion under a timber pergola */
  pavilion: {
    min: [1.2, -8.4] as Vec2,
    max: [15.2, 2.6] as Vec2,
    height: 3.1,
    column: 0.24,
    columnsX: 4,
    beam: { width: 0.12, depth: 0.32, spacing: 0.7, overhang: 0.6 },
    edgeBeam: { width: 0.2, depth: 0.36 },
  },
  planters: [
    { min: [-10.2, 3.6] as Vec2, max: [-0.6, 5.1] as Vec2, height: 0.65 },
    { min: [-2.6, -10.8] as Vec2, max: [0.4, -3.8] as Vec2, height: 0.65 },
    { min: [15.4, -10.8] as Vec2, max: [16.4, -1.2] as Vec2, height: 0.5 },
  ],
  trees: [
    { pos: [-8.4, 4.35], base: ELEVATIONS.rooftop + 0.65, height: 3.4, radius: 1.25, kind: 'olive' },
    { pos: [-5.2, 4.35], base: ELEVATIONS.rooftop + 0.65, height: 2.8, radius: 1.0, kind: 'olive' },
    { pos: [-2.2, 4.35], base: ELEVATIONS.rooftop + 0.65, height: 3.1, radius: 1.15, kind: 'olive' },
    { pos: [-1.1, -9.0], base: ELEVATIONS.rooftop + 0.65, height: 3.6, radius: 1.3, kind: 'olive' },
    { pos: [-1.1, -5.4], base: ELEVATIONS.rooftop + 0.65, height: 2.9, radius: 1.05, kind: 'olive' },
  ] as Tree[],
};

// ---------------------------------------------------------------- site

export const site = {
  plot: rect(-36, -25, 38, 27),
  /** stone terrace around the pool */
  deck: [
    [-6, 1.5],
    [26, 1.5],
    [26, 17],
    [-6, 17],
    [-6, 12.5],
  ] as Vec2[],
  pool: { poly: rect(-2, 8, 21, 14.5), depth: 1.4, coping: 0.5 },
  gardens: [
    rect(-34, 18.6, 36, 25),
    rect(-34, -23, -22, 17.2),
    rect(27.6, 1.5, 36, 17.2),
  ],
  driveway: [
    [-2, -12.5],
    [24, -12.5],
    [24, -3],
    [34, -3],
    [34, -25],
    [26, -25],
    [26, -21],
    [-2, -21],
  ] as Vec2[],
  /** stepping-stone path from the forecourt to the garden */
  paths: [
    [[-21, -21], [-21, 14]],
    [[-21, 14], [-21, 17.8], [-6, 17.8]],
    [[26.8, 1.5], [26.8, 17.8], [-6, 17.8]],
  ] as Vec2[][],
  trees: [
    // olives along the garden front and by the pool terrace
    { pos: [-29, 21.6], base: 0, height: 6.4, radius: 3.0, kind: 'olive' },
    { pos: [-19, 22.2], base: 0, height: 5.2, radius: 2.3, kind: 'olive' },
    { pos: [-9, 21.6], base: 0, height: 5.8, radius: 2.6, kind: 'olive' },
    { pos: [6, 22.3], base: 0, height: 4.8, radius: 2.1, kind: 'olive' },
    { pos: [18, 21.8], base: 0, height: 5.4, radius: 2.4, kind: 'olive' },
    { pos: [30, 21.6], base: 0, height: 6.6, radius: 3.1, kind: 'olive' },
    { pos: [32, 12], base: 0, height: 5.6, radius: 2.5, kind: 'olive' },
    { pos: [31.5, 5.2], base: 0, height: 4.9, radius: 2.1, kind: 'olive' },
    // a cypress avenue down the west boundary
    { pos: [-28.5, 13], base: 0, height: 11.5, radius: 1.25, kind: 'cypress' },
    { pos: [-28.5, 7], base: 0, height: 10.4, radius: 1.15, kind: 'cypress' },
    { pos: [-28.5, 1], base: 0, height: 12.0, radius: 1.3, kind: 'cypress' },
    { pos: [-28.5, -5], base: 0, height: 10.8, radius: 1.2, kind: 'cypress' },
    { pos: [-28.5, -11], base: 0, height: 11.6, radius: 1.25, kind: 'cypress' },
    { pos: [-28.5, -17], base: 0, height: 10.2, radius: 1.1, kind: 'cypress' },
    // and three marking the entrance court
    { pos: [-12, -22.8], base: 0, height: 9.6, radius: 1.05, kind: 'cypress' },
    { pos: [6, -22.9], base: 0, height: 9.0, radius: 1.0, kind: 'cypress' },
    { pos: [18, -22.9], base: 0, height: 9.8, radius: 1.05, kind: 'cypress' },
  ] as Tree[],
};

// ---------------------------------------------------------------- annotations

export interface Annotation {
  id: string;
  text: string;
  /** point on the outer edge of the feature, where the leader starts */
  anchor: [number, number, number];
  /** where the label sits relative to the anchor, in px at a 1440 px wide window; always pointing away from the house */
  offset: [number, number];
  group: 'details' | 'rooftop';
  /** hidden on small screens */
  desktopOnly?: boolean;
}

export const annotations: Annotation[] = [
  { id: 'living', text: 'Double-height living', anchor: [3, 0.05, 1.7], offset: [-36, 118], group: 'details' },
  { id: 'terrace', text: 'Cantilevered terrace', anchor: [24, 3.85, 5.2], offset: [64, 92], group: 'details', desktopOnly: true },
  { id: 'loggia', text: 'Arched pool loggia', anchor: [-20, 2.2, 12.5], offset: [-74, -86], group: 'details', desktopOnly: true },
  { id: 'pavilion', text: 'Rooftop pavilion', anchor: [8.2, 15.95, -2.9], offset: [0, -104], group: 'rooftop' },
  { id: 'tower', text: 'Observatory tower', anchor: [-9.2, 17.75, -6.6], offset: [-96, -70], group: 'rooftop', desktopOnly: true },
];

export interface LevelMarker {
  id: string;
  label: string;
  elevation: number;
}

export const levelMarkers: LevelMarker[] = [
  { id: 'ground', label: 'GROUND', elevation: ELEVATIONS.ground },
  { id: 'first', label: 'FIRST FLOOR', elevation: ELEVATIONS.first },
  { id: 'second', label: 'SECOND FLOOR', elevation: ELEVATIONS.second },
  { id: 'rooftop', label: 'ROOFTOP', elevation: ELEVATIONS.rooftop },
];

export const formatElevation = (e: number) => `${e >= 0 ? '+' : '-'}${Math.abs(e).toFixed(3)}`;

export const VILLA_NAME = 'Villa Serein';
