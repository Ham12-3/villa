/**
 * Fit-out of the rooms the camera tours at the end of the story: living room,
 * entrance lobby, dining room, kitchen, the first-floor bathroom and master
 * bedroom, and the pool loggia lounge. Like the rest of the villa it is plain
 * data (boxes, cylinders, spheres, lamps) turned into geometry by a builder.
 *
 * Coordinates as in villa.ts: metres, +x east, +z garden front. Ground floor
 * finishes sit on y 0, first-floor ones on y 4.
 */

import { stairs, type Stair } from './villa';

export type InteriorMaterial =
  | 'floor'
  | 'rug'
  | 'fabric'
  | 'fabricDark'
  | 'wood'
  | 'dark'
  | 'stone'
  | 'paving'
  | 'slab'
  | 'rail'
  | 'art'
  | 'glow'
  | 'ceramic'
  | 'mirror'
  | 'brass'
  | 'olive'
  | 'water'
  | 'marble'
  | 'marbleDark'
  | 'tileStone'
  | 'accent'
  | 'steel'
  | 'glassDark'
  | 'screen'
  | 'sheer'
  | 'hedge'
  | 'shade'
  | 'fire';

export interface Piece {
  material: InteriorMaterial;
  shape: 'box' | 'cyl' | 'sphere' | 'curtain' | 'tub';
  /** centre */
  c: [number, number, number];
  /** size: width, height, depth (for cyl / sphere / tub these are diameters; for a curtain, depth is the depth of its folds) */
  s: [number, number, number];
  /** rotation about the vertical axis, radians */
  rot?: number;
  /** lean about the piece's own width axis, radians, applied before `rot` (+ leans the top towards local +z) */
  tilt?: number;
  /** cylinders: top diameter as a fraction of the bottom one */
  taper?: number;
}

export interface Lamp {
  /** centre of the glowing globe */
  pos: [number, number, number];
  radius: number;
  /** height the suspension rod hangs from (omit for no rod) */
  from?: number;
}

type V3 = [number, number, number];
type M = InteriorMaterial;
const box = (material: M, c: V3, s: V3, rot = 0, tilt = 0): Piece => ({ material, shape: 'box', c, s, rot, tilt });
const cyl = (material: M, c: V3, s: V3, taper = 1): Piece => ({ material, shape: 'cyl', c, s, taper });
const sph = (material: M, c: V3, s: V3): Piece => ({ material, shape: 'sphere', c, s });
/** a bowl open at the top: bath, basin, planter */
const tub = (material: M, c: V3, s: V3, rot = 0): Piece => ({ material, shape: 'tub', c, s, rot });
/** A curtain hanging in the x direction (or z with rot = PI / 2): bottom at y0, `height` tall. */
const curtain = (x: number, y0: number, z: number, width: number, height: number, rot = 0, material: M = 'fabric'): Piece => ({
  material,
  shape: 'curtain',
  c: [x, y0 + height / 2, z],
  s: [width, height, material === 'sheer' ? 0.045 : 0.07],
  rot,
});

/** Local -> world for a piece group rotated about Y at (x, z). */
const placer = (x: number, y0: number, z: number, rot: number) => {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return (lx: number, y: number, lz: number): V3 => [x + lx * cos + lz * sin, y0 + y, z - lx * sin + lz * cos];
};

/** repeatable scatter for planting */
let seed = 20240;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/**
 * A sofa on a recessed plinth: deep base, low back and arms, loose seat
 * cushions, back cushions leaning on the back, two scatter cushions.
 * Faces -z before rotation.
 */
function sofa(x: number, z: number, length: number, rot = 0, y0 = 0, m: M = 'fabric', scatter: M[] = ['accent', 'fabricDark']): Piece[] {
  const at = placer(x, y0, z, rot);
  const n = Math.max(2, Math.round(length / 1.0));
  const inner = length - 0.56;
  const w = inner / n;
  const out = [
    box('dark', at(0, 0.05, 0.02), [length - 0.24, 0.1, 0.84], rot),
    box(m, at(0, 0.25, 0), [length, 0.3, 1.04], rot),
    box(m, at(0, 0.56, 0.43), [length, 0.5, 0.2], rot),
    box(m, at(-length / 2 + 0.14, 0.47, 0), [0.28, 0.42, 1.04], rot),
    box(m, at(length / 2 - 0.14, 0.47, 0), [0.28, 0.42, 1.04], rot),
  ];
  for (let k = 0; k < n; k++) {
    const lx = -inner / 2 + w * (k + 0.5);
    out.push(box(m, at(lx, 0.49, -0.08), [w - 0.03, 0.2, 0.8], rot));
    out.push(box(m, at(lx, 0.8, 0.24), [w - 0.07, 0.46, 0.2], rot, 0.2));
  }
  out.push(box(scatter[0], at(-inner / 2 + 0.3, 0.8, 0.06), [0.46, 0.46, 0.16], rot + 0.3, 0.32));
  out.push(box(scatter[1], at(inner / 2 - 0.28, 0.79, 0.07), [0.42, 0.42, 0.15], rot - 0.35, 0.3));
  return out;
}

/** A small olive in a tapered planter: a loose crown of leaf clumps on a thin stem. */
function plant(x: number, z: number, y0 = 0, scale = 1, pot: M = 'ceramic'): Piece[] {
  const out: Piece[] = [
    cyl(pot, [x, y0 + 0.3 * scale, z], [0.5 * scale, 0.6 * scale, 0.5 * scale], 1.25),
    cyl('dark', [x, y0 + 0.595 * scale, z], [0.56 * scale, 0.02, 0.56 * scale]),
    cyl('wood', [x, y0 + 1.0 * scale, z], [0.05 * scale, 0.9 * scale, 0.05 * scale], 0.7),
  ];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.46 * scale;
    const h = (1.4 + rnd() * 0.85) * scale;
    const d = (0.17 + rnd() * 0.17) * scale;
    out.push(sph('olive', [x + Math.cos(a) * r, y0 + h, z + Math.sin(a) * r], [d, d * 0.82, d]));
  }
  return out;
}

/** Bar stool: padded seat with a low back on four slim legs. The sitter faces -z. */
function stool(x: number, z: number, y0 = 0, rot = 0): Piece[] {
  const at = placer(x, y0, z, rot);
  const out = [
    box('fabricDark', at(0, 0.73, 0), [0.4, 0.09, 0.38], rot),
    box('fabricDark', at(0, 0.93, 0.18), [0.38, 0.24, 0.05], rot, 0.14),
  ];
  for (const [lx, lz] of [[-0.16, -0.15], [0.16, -0.15], [-0.16, 0.15], [0.16, 0.15]]) {
    out.push(box('brass', at(lx, 0.345, lz), [0.022, 0.69, 0.022], rot));
  }
  out.push(box('brass', at(0, 0.26, -0.15), [0.32, 0.016, 0.016], rot));
  out.push(box('brass', at(0, 0.26, 0.15), [0.32, 0.016, 0.016], rot));
  return out;
}

/**
 * A run of cabinet doors: n panels standing a little proud of the carcass,
 * with shadow gaps between and a brass pull on each. `along` is the axis the
 * run follows, `at` the plane of the carcass face, `out` the way it faces.
 */
function fronts(o: {
  along: 'x' | 'z';
  from: number;
  to: number;
  y0: number;
  y1: number;
  at: number;
  out: 1 | -1;
  n: number;
  m: M;
  pull?: 'top' | 'tall' | 'none';
}): Piece[] {
  const pieces: Piece[] = [];
  const pitch = (o.to - o.from) / o.n;
  const h = o.y1 - o.y0;
  const p = (a: number, y: number, off: number): V3 => (o.along === 'x' ? [a, y, o.at + o.out * off] : [o.at + o.out * off, y, a]);
  const size = (len: number, hh: number, d: number): V3 => (o.along === 'x' ? [len, hh, d] : [d, hh, len]);
  for (let i = 0; i < o.n; i++) {
    const a = o.from + pitch * (i + 0.5);
    pieces.push(box(o.m, p(a, o.y0 + h / 2, 0.011), size(pitch - 0.007, h - 0.006, 0.02)));
    if (o.pull === 'tall') {
      const side = i % 2 === 0 ? pitch / 2 - 0.05 : -pitch / 2 + 0.05;
      pieces.push(box('brass', p(a + side, o.y0 + h * 0.48, 0.034), size(0.014, 0.9, 0.014)));
    } else if (o.pull !== 'none') {
      pieces.push(box('brass', p(a, o.y1 - 0.07, 0.032), size(0.16, 0.012, 0.014)));
    }
  }
  return pieces;
}

/** Fluted timber: a row of thin upright slats on a face. */
function slats(along: 'x' | 'z', from: number, to: number, y0: number, y1: number, at: number, out: 1 | -1, m: M = 'wood'): Piece[] {
  const pieces: Piece[] = [];
  const n = Math.round((to - from) / 0.052);
  const pitch = (to - from) / n;
  for (let i = 0; i < n; i++) {
    const a = from + pitch * (i + 0.5);
    const c: V3 = along === 'x' ? [a, (y0 + y1) / 2, at + out * 0.011] : [at + out * 0.011, (y0 + y1) / 2, a];
    pieces.push(box(m, c, along === 'x' ? [pitch * 0.68, y1 - y0, 0.022] : [0.022, y1 - y0, pitch * 0.68]));
  }
  return pieces;
}

/** Recessed ceiling spots in a grid, flush with the soffit at height y. */
function downlights(x0: number, x1: number, z0: number, z1: number, y: number, nx: number, nz: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = x0 + ((i + 0.5) / nx) * (x1 - x0);
      const z = z0 + ((j + 0.5) / nz) * (z1 - z0);
      pieces.push(cyl('dark', [x, y - 0.006, z], [0.15, 0.012, 0.15]));
      pieces.push(cyl('glow', [x, y - 0.014, z], [0.085, 0.008, 0.085]));
    }
  }
  return pieces;
}

/** Sun lounger: timber frame, seat pad, raised back. The head is at local +z. */
function lounger(x: number, z: number, rot = 0): Piece[] {
  const at = placer(x, 0, z, rot);
  const out = [box('wood', at(0, 0.29, 0), [0.7, 0.05, 2.0], rot)];
  for (const [lx, lz] of [[-0.3, -0.9], [0.3, -0.9], [-0.3, 0.75], [0.3, 0.75]]) {
    out.push(box('wood', at(lx, 0.135, lz), [0.05, 0.27, 0.05], rot));
  }
  out.push(box('fabric', at(0, 0.37, -0.32), [0.64, 0.1, 1.3], rot));
  out.push(box('fabric', at(0, 0.53, 0.62), [0.64, 0.1, 0.7], rot, -0.5));
  out.push(box('accent', at(0, 0.44, -0.75), [0.5, 0.07, 0.36], rot));
  return out;
}

/** a thin frame behind a mirror or canvas hung on a wall whose face runs along z */
const frameZ = (m: M, x: number, y: number, z: number, h: number, len: number): Piece => box(m, [x, y, z], [0.03, h + 0.07, len + 0.07]);

// ---------------------------------------------------------------- ground floor

const SEATING: [number, number] = [0.3, -2.9];
const DINING: [number, number] = [-12.6, -1.4];
/** underside of the first-floor slab */
const CEIL = 3.7;

const living: Piece[] = [
  box('floor', [3, 0.012, -2.035], [17.84, 0.024, 6.77]),
  box('rug', [SEATING[0], 0.04, SEATING[1]], [6.6, 0.03, 3.8]),
  ...sofa(0.2, -0.95, 3.4, 0),
  ...sofa(-3.0, -2.9, 2.6, -Math.PI / 2, 0, 'fabric', ['fabricDark', 'accent']),
  // (marble coffee table, lounge chairs, vases and plants are real models: see `models`)
  box('art', [SEATING[0] - 0.3, 0.52, SEATING[1] + 0.12], [0.34, 0.05, 0.26], 0.2),
  // the fire wall: one slab of dark veined marble, a long slot of fire, a pale hearth
  box('marbleDark', [2.2, 1.75, -5.3], [4.4, 3.5, 0.24]),
  box('glassDark', [2.2, 0.9, -5.172], [2.6, 0.46, 0.02]),
  box('dark', [2.2, 0.71, -5.14], [2.4, 0.05, 0.07]),
  // a low ribbon of gas flame: many overlapping tongues of uneven height
  box('fire', [2.2, 0.75, -5.14], [2.26, 0.035, 0.03]),
  ...Array.from({ length: 44 }, (_, i) => {
    const h = 0.06 + 0.1 * Math.abs(Math.sin(i * 1.7 + 0.7)) * Math.abs(Math.sin(i * 0.61)) + 0.03 * Math.sin(i * 5.1);
    return cyl('fire', [2.2 - 1.1 + i * 0.0512, 0.745 + h / 2, -5.14 + 0.012 * Math.sin(i * 3.3)], [0.1, h, 0.04], 0.3);
  }),
  box('marble', [2.2, 0.2, -5.0], [4.9, 0.4, 0.62]),
  // sideboard on slim legs, a framed canvas and a floor lamp under the gallery
  box('glassDark', [-4.2, 0.5, -5.13], [2.5, 0.6, 0.48]),
  ...fronts({ along: 'x', from: -5.45, to: -2.95, y0: 0.2, y1: 0.79, at: -4.89, out: 1, n: 4, m: 'wood', pull: 'none' }),
  box('wood', [-4.2, 0.805, -5.12], [2.54, 0.03, 0.54]),
  ...[-5.3, -3.1].flatMap((x) => [box('brass', [x, 0.1, -4.95], [0.03, 0.2, 0.03]), box('brass', [x, 0.1, -5.3], [0.03, 0.2, 0.03])]),
  box('dark', [-4.2, 2.05, -5.405], [1.78, 1.33, 0.03]),
  box('art', [-4.2, 2.05, -5.39], [1.7, 1.25, 0.03]),
  cyl('brass', [-5.2, 0.015, -4.9], [0.3, 0.03, 0.3]),
  cyl('brass', [-5.2, 0.8, -4.9], [0.025, 1.6, 0.025]),
  cyl('shade', [-5.2, 1.72, -4.9], [0.38, 0.32, 0.38], 0.82),
  // reading corner and planting at the east end
  cyl('wood', [10.4, 0.25, -3.4], [0.5, 0.5, 0.5]),
  box('art', [10.4, 0.52, -3.4], [0.3, 0.04, 0.22], 0.5),
  ...plant(10.9, -4.7, 0, 1.15),
  ...plant(-5.2, 0.6, 0, 1.0),
  // full-height linen at each end of the glazing
  curtain(-5.3, 0.03, 1.2, 1.1, 7.3),
  curtain(11.3, 0.03, 1.2, 1.1, 7.3),
  // spots in the high ceiling
  ...downlights(-4, 10, -4.6, 0.4, 7.7, 5, 2),
];

const dining: Piece[] = [
  box('floor', [-12.965, 0.012, -1.0], [13.77, 0.024, 8.84]),
  box('rug', [DINING[0], 0.04, DINING[1]], [5.2, 0.03, 3.4]),
  box('wood', [DINING[0], 0.745, DINING[1]], [3.5, 0.07, 1.15]),
  box('dark', [DINING[0] - 1.2, 0.355, DINING[1]], [0.12, 0.71, 0.85]),
  box('dark', [DINING[0] + 1.2, 0.355, DINING[1]], [0.12, 0.71, 0.85]),
  // table setting: a wide bowl and two candlesticks
  tub('ceramic', [DINING[0] + 0.15, 0.83, DINING[1]], [0.46, 0.1, 0.46]),
  cyl('brass', [DINING[0] + 0.62, 0.9, DINING[1]], [0.06, 0.24, 0.06], 0.6),
  cyl('brass', [DINING[0] + 0.82, 0.87, DINING[1] + 0.1], [0.06, 0.18, 0.06], 0.6),
  // buffet with a brass-framed mirror on the west wall, linen at the windows
  box('glassDark', [-19.52, 0.49, -1.4], [0.46, 0.68, 3.2]),
  ...fronts({ along: 'z', from: -3.0, to: 0.2, y0: 0.15, y1: 0.83, at: -19.29, out: 1, n: 4, m: 'wood', pull: 'none' }),
  box('wood', [-19.5, 0.845, -1.4], [0.52, 0.03, 3.24]),
  ...[-2.9, 0.1].flatMap((z) => [box('brass', [-19.35, 0.075, z], [0.03, 0.15, 0.03]), box('brass', [-19.7, 0.075, z], [0.03, 0.15, 0.03])]),
  frameZ('brass', -19.82, 1.95, -1.4, 1.4, 2.4),
  box('mirror', [-19.795, 1.95, -1.4], [0.02, 1.4, 2.4]),
  curtain(-19.72, 0.03, -5.12, 0.5, 3.5, Math.PI / 2),
  curtain(-19.72, 0.03, -2.86, 0.42, 3.5, Math.PI / 2),
  curtain(-19.72, 0.03, 0.48, 0.42, 3.5, Math.PI / 2),
  ...plant(-18.7, 2.85, 0, 1.1),
  ...downlights(-18.5, -7.5, -4.6, 2.6, CEIL, 4, 2),
];

const kitchen: Piece[] = [
  box('tileStone', [-12.965, 0.012, -8.96], [13.77, 0.024, 6.76]),
  // back run under the windows: matt dark doors, a marble top, brass pulls
  box('glassDark', [-12.2, 0.49, -12.05], [9.6, 0.8, 0.6]),
  box('glassDark', [-12.2, 0.045, -12.09], [9.6, 0.09, 0.5]),
  ...fronts({ along: 'x', from: -17.0, to: -7.4, y0: 0.1, y1: 0.89, at: -11.75, out: 1, n: 16, m: 'dark' }),
  box('marble', [-12.2, 0.915, -12.03], [9.7, 0.05, 0.68]),
  box('marble', [-12.2, 0.99, -12.335], [9.7, 0.1, 0.02]),
  // tall units at the west end: fridge and larder doors, a pair of ovens
  box('glassDark', [-18.75, 1.35, -12.05], [2.2, 2.7, 0.6]),
  ...fronts({ along: 'x', from: -19.85, to: -17.65, y0: 0.1, y1: 2.69, at: -11.75, out: 1, n: 4, m: 'wood', pull: 'tall' }),
  box('glassDark', [-18.475, 1.02, -11.722], [0.5, 0.46, 0.012]),
  box('glassDark', [-18.475, 1.58, -11.722], [0.5, 0.46, 0.012]),
  box('steel', [-18.475, 1.285, -11.7], [0.42, 0.016, 0.02]),
  box('steel', [-18.475, 1.845, -11.7], [0.42, 0.016, 0.02]),
  // hob between the windows under a steel canopy; sink under the east window
  box('glassDark', [-13.25, 0.946, -12.02], [0.8, 0.012, 0.5]),
  ...[[-0.2, -0.11], [0.2, -0.11], [-0.2, 0.12], [0.2, 0.12]].map(([dx, dz]) => cyl('steel', [-13.25 + dx, 0.954, -12.02 + dz], [0.19, 0.004, 0.19])),
  box('steel', [-13.25, 1.74, -12.08], [0.95, 0.07, 0.52]),
  box('steel', [-13.25, 2.74, -12.19], [0.32, 1.92, 0.3]),
  box('glassDark', [-10.5, 0.944, -12.0], [0.78, 0.012, 0.44]),
  cyl('brass', [-10.5, 1.12, -12.25], [0.032, 0.36, 0.032]),
  box('brass', [-10.5, 1.3, -12.15], [0.03, 0.03, 0.22]),
  cyl('brass', [-10.5, 1.26, -12.05], [0.03, 0.08, 0.03]),
  // open shelf with a few pots
  box('wood', [-8.3, 1.7, -12.21], [2.0, 0.05, 0.26]),
  cyl('ceramic', [-8.9, 1.85, -12.21], [0.18, 0.24, 0.18], 0.75),
  cyl('ceramic', [-8.55, 1.81, -12.21], [0.14, 0.16, 0.14]),
  cyl('brass', [-7.8, 1.83, -12.21], [0.16, 0.2, 0.16], 0.8),
  tub('ceramic', [-8.15, 1.77, -12.2], [0.26, 0.09, 0.26]),
  // island: fluted oak under a marble top that falls to the floor at both ends
  box('glassDark', [-12.6, 0.45, -9.33], [3.9, 0.86, 0.9]),
  ...slats('x', -14.55, -10.65, 0.03, 0.88, -8.88, 1),
  ...fronts({ along: 'x', from: -14.55, to: -10.65, y0: 0.1, y1: 0.87, at: -9.78, out: -1, n: 6, m: 'dark' }),
  box('marble', [-12.6, 0.93, -9.2], [4.2, 0.06, 1.35]),
  box('marble', [-14.67, 0.465, -9.2], [0.06, 0.93, 1.35]),
  box('marble', [-10.53, 0.465, -9.2], [0.06, 0.93, 1.35]),
  ...[-14.0, -13.1, -12.2, -11.3].flatMap((x) => stool(x, -8.3)),
  curtain(-19.72, 0.03, -7.85, 0.4, 3.5, Math.PI / 2),
  ...downlights(-18.5, -7.5, -11.2, -6.6, CEIL, 4, 2),
];

const lobby: Piece[] = [
  box('tileStone', [6, 0.012, -9.0], [7.84, 0.024, 6.76]),
  box('rug', [6, 0.04, -8.9], [2.4, 0.03, 4.6]),
  // round marble table on a dark drum in the middle of the hall
  cyl('marbleDark', [6, 0.385, -10.2], [0.62, 0.77, 0.62], 0.78),
  cyl('marble', [6, 0.795, -10.2], [1.5, 0.05, 1.5]),
  box('art', [5.5, 0.845, -10.05], [0.34, 0.05, 0.26], 0.3),
  // the front door: a pair of oak leaves with long brass pulls
  box('wood', [5.45, 1.4, -12.44], [1.09, 2.78, 0.06]),
  box('wood', [6.55, 1.4, -12.44], [1.09, 2.78, 0.06]),
  box('brass', [5.88, 1.3, -12.38], [0.03, 1.1, 0.03]),
  box('brass', [6.12, 1.3, -12.38], [0.03, 1.1, 0.03]),
  // floating console and tall mirror on the east wall, bench and canvas opposite
  box('wood', [9.66, 0.79, -9.2], [0.42, 0.1, 2.4]),
  box('brass', [9.7, 0.37, -10.25], [0.03, 0.74, 0.03]),
  box('brass', [9.7, 0.37, -8.15], [0.03, 0.74, 0.03]),
  frameZ('brass', 9.9, 1.95, -9.2, 1.7, 1.5),
  box('mirror', [9.875, 1.95, -9.2], [0.02, 1.7, 1.5]),
  box('dark', [2.5, 0.17, -11.3], [0.42, 0.34, 0.05]),
  box('dark', [2.5, 0.17, -9.9], [0.42, 0.34, 0.05]),
  box('fabricDark', [2.5, 0.41, -10.6], [0.5, 0.14, 1.8]),
  box('accent', [2.42, 0.62, -11.1], [0.14, 0.4, 0.42], 0, 0),
  box('dark', [2.105, 1.9, -10.6], [0.03, 1.28, 1.68]),
  box('art', [2.125, 1.9, -10.6], [0.03, 1.2, 1.6]),
  ...plant(9.3, -6.2, 0, 1.1),
  ...downlights(3.2, 8.8, -11.6, -6.4, CEIL, 3, 3),
];

// the pool loggia: an open lounge behind the arches
const lounge: Piece[] = [
  box('paving', [-12.965, 0.012, 8.0], [13.77, 0.024, 8.76]),
  box('rug', [-16.2, 0.04, 6.6], [5.2, 0.03, 4.2]),
  ...sofa(-16.2, 4.75, 3.6, Math.PI, 0, 'fabric'),
  ...sofa(-18.6, 6.9, 2.6, -Math.PI / 2, 0, 'fabric', ['fabricDark', 'accent']),
  cyl('marble', [-16.1, 0.2, 6.6], [1.3, 0.4, 1.3]),
  tub('brass', [-16.1, 0.45, 6.6], [0.34, 0.1, 0.34]),
  // daybeds by the south-west arch
  box('wood', [-17.6, 0.16, 10.6], [2.1, 0.32, 0.95]),
  box('fabric', [-17.6, 0.41, 10.6], [2.0, 0.18, 0.9]),
  box('fabric', [-18.42, 0.6, 10.6], [0.8, 0.14, 0.42], Math.PI / 2, 0.5),
  box('accent', [-18.1, 0.56, 10.5], [0.4, 0.12, 0.36], 0.3),
  box('wood', [-9.2, 0.16, 10.9], [0.95, 0.32, 2.1]),
  box('fabric', [-9.2, 0.41, 10.9], [0.9, 0.18, 2.0]),
  box('fabric', [-9.2, 0.6, 11.72], [0.8, 0.14, 0.42], 0, -0.5),
  // bar along the dining wall: fluted oak under marble
  box('glassDark', [-10.6, 0.52, 4.0], [4.2, 1.04, 0.56]),
  ...slats('x', -12.7, -8.5, 0.03, 1.03, 4.28, 1),
  box('marble', [-10.6, 1.065, 4.05], [4.4, 0.05, 0.78]),
  ...[-11.8, -10.6, -9.4].flatMap((x) => stool(x, 4.85)),
  cyl('brass', [-11.5, 1.21, 3.95], [0.09, 0.24, 0.09], 0.7),
  tub('ceramic', [-9.1, 1.14, 3.95], [0.26, 0.1, 0.26]),
  // lanterns and planting
  ...[[-19.2, 11.6, 0.5], [-19.3, 4.4, 0.36], [-7.0, 4.6, 0.44]].flatMap(([x, z, h]): Piece[] => [
    box('glow', [x, h / 2 + 0.03, z], [0.2, h - 0.08, 0.2]),
    box('dark', [x, 0.015, z], [0.3, 0.03, 0.3]),
    box('dark', [x, h + 0.01, z], [0.3, 0.03, 0.3]),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box('dark', [x + a * 0.14, h / 2, z + b * 0.14], [0.02, h, 0.02])),
  ]),
  ...plant(-19.0, 9.0, 0, 1.25),
  ...plant(-7.2, 11.8, 0, 1.15),
  ...downlights(-18.5, -7.5, 5.0, 11.4, CEIL, 4, 2),
];

// the pool terrace and the edges of the garden
const terrace: Piece[] = [
  // loungers at the east end of the pool and on the lawn side
  ...[9.3, 11.25, 13.2].flatMap((z) => lounger(23.6, z, Math.PI / 2)),
  cyl('wood', [23.9, 0.2, 10.28], [0.4, 0.4, 0.4]),
  cyl('wood', [23.9, 0.2, 12.22], [0.4, 0.4, 0.4]),
  ...lounger(8.6, 15.85, Math.PI / 2),
  ...lounger(12.4, 15.85, Math.PI / 2),
  cyl('wood', [10.9, 0.2, 16.0], [0.4, 0.4, 0.4]),
  // clipped hedges on the boundary, open at the garden gate and the drive
  box('hedge', [-35.1, 1.5, 1], [1.5, 3.0, 50.4]),
  box('hedge', [37.1, 1.5, 1], [1.5, 3.0, 50.4]),
  box('hedge', [-5.2, 1.5, -24.2], [61.3, 3.0, 1.5]),
  box('hedge', [-22.9, 1.5, 26.2], [25.9, 3.0, 1.5]),
  box('hedge', [22.6, 1.5, 26.2], [30.5, 3.0, 1.5]),
  // box balls along the lawn edge
  ...[5.2, 8.6, 12, 15.4, 18.8, 22.2, -17, -20.4, -23.8].flatMap((x, i) => {
    const d = i % 2 ? 0.9 : 1.15;
    return [sph('hedge', [x, d * 0.42, 19.4], [d, d * 0.9, d])];
  }),
  // olives in big pots on the terrace corners
  ...plant(25.0, 2.5, 0, 1.5, 'stone'),
  ...plant(25.0, 16.0, 0, 1.5, 'stone'),
];

// ---------------------------------------------------------------- first floor

const F = 4; // first floor level

const bathroom: Piece[] = [
  box('tileStone', [18, F + 0.012, -9.0], [11.76, 0.024, 6.76]),
  // the bath wall: marble round the east window
  box('marble', [23.835, F + 0.45, -9.0], [0.03, 0.9, 6.7]),
  box('marble', [23.835, F + 3.25, -9.0], [0.03, 0.9, 6.7]),
  box('marble', [23.835, F + 1.85, -11.275], [0.03, 1.9, 2.15]),
  box('marble', [23.835, F + 1.85, -6.725], [0.03, 1.9, 2.15]),
  // freestanding bath under the window, with a floor-standing filler
  tub('ceramic', [22.75, F + 0.3, -9.0], [0.88, 0.6, 1.86]),
  cyl('water', [22.75, F + 0.47, -9.0], [0.74, 0.01, 1.62]),
  cyl('brass', [22.1, F + 0.47, -10.05], [0.04, 0.94, 0.04]),
  box('brass', [22.24, F + 0.92, -10.05], [0.3, 0.03, 0.03]),
  cyl('brass', [22.38, F + 0.89, -10.05], [0.03, 0.06, 0.03]),
  cyl('wood', [21.85, F + 0.24, -8.0], [0.36, 0.48, 0.36]),
  box('rug', [21.9, F + 0.03, -9.2], [0.7, 0.02, 1.3]),
  // floating double vanity: fluted oak, marble top, two bowls, a backlit mirror
  box('glassDark', [17, F + 0.55, -5.86], [3.6, 0.45, 0.5]),
  ...slats('x', 15.2, 18.8, F + 0.33, F + 0.775, -6.11, -1),
  box('marble', [17, F + 0.8, -5.88], [3.7, 0.05, 0.6]),
  tub('ceramic', [16.1, F + 0.895, -5.9], [0.46, 0.14, 0.36]),
  tub('ceramic', [17.9, F + 0.895, -5.9], [0.46, 0.14, 0.36]),
  ...[16.1, 17.9].flatMap((x) => [
    box('brass', [x, F + 1.08, -5.67], [0.028, 0.028, 0.18]),
    cyl('brass', [x - 0.14, F + 1.08, -5.6], [0.045, 0.045, 0.045]),
    cyl('brass', [x + 0.14, F + 1.08, -5.6], [0.045, 0.045, 0.045]),
  ]),
  box('glow', [17, F + 1.8, -5.588], [3.48, 1.28, 0.012]),
  box('mirror', [17, F + 1.8, -5.604], [3.4, 1.2, 0.02]),
  box('fabric', [18.55, F + 0.865, -5.9], [0.34, 0.08, 0.24]),
  box('fabric', [18.55, F + 0.94, -5.9], [0.33, 0.07, 0.23]),
  // walk-in shower in the corner: marble walls, a glass screen, a brass rain head
  box('dark', [13.4, F + 0.03, -11.2], [2.3, 0.04, 2.3]),
  box('marble', [12.1, F + 1.35, -11.2], [0.03, 2.7, 2.3]),
  box('marble', [13.4, F + 1.35, -12.33], [2.3, 2.7, 0.03]),
  box('screen', [14.56, F + 1.12, -11.2], [0.012, 2.2, 2.2]),
  box('brass', [12.3, F + 2.3, -11.2], [0.4, 0.025, 0.025]),
  cyl('brass', [12.6, F + 2.27, -11.2], [0.3, 0.025, 0.3]),
  cyl('brass', [12.14, F + 1.2, -11.2], [0.05, 0.05, 0.05]),
  // towels on a brass rail by the bath
  box('brass', [20.6, F + 1.25, -12.28], [0.9, 0.022, 0.022]),
  box('fabric', [20.5, F + 0.93, -12.29], [0.5, 0.66, 0.035]),
  // WC behind a half-height marble wall
  box('marble', [21.9, F + 0.6, -6.3], [0.12, 1.2, 1.5]),
  box('ceramic', [22.95, F + 0.55, -5.72], [0.9, 1.1, 0.24]),
  cyl('ceramic', [22.95, F + 0.3, -6.14], [0.38, 0.34, 0.58]),
  cyl('ceramic', [22.95, F + 0.49, -6.14], [0.385, 0.03, 0.585]),
  box('steel', [22.95, F + 0.95, -5.845], [0.24, 0.16, 0.012]),
  ...plant(23.2, -12.0, F, 1.0),
  ...downlights(14, 23, -11.6, -6.6, F + CEIL, 4, 2),
];

const BED: [number, number] = [17.2, -4.1];

const bedroom: Piece[] = [
  box('floor', [18, F + 0.012, -2.035], [11.76, 0.024, 6.77]),
  box('rug', [17.2, F + 0.04, -3.4], [4.6, 0.03, 3.8]),
  // headboard wall: an oak panel with a channelled upholstered headboard and a line of light above
  box('wood', [17.2, F + 1.3, -5.395], [4.6, 2.6, 0.04]),
  box('glow', [17.2, F + 2.63, -5.39], [4.4, 0.03, 0.03]),
  ...Array.from({ length: 9 }, (_, i) => box('fabricDark', [17.2 - 2.3 + (4.6 / 9) * (i + 0.5), F + 0.95, -5.31], [4.6 / 9 - 0.012, 1.25, 0.11])),
  // king bed: low oak platform, mattress, duvet, a folded throw, five pillows
  box('wood', [BED[0], F + 0.12, BED[1]], [2.5, 0.24, 2.35]),
  box('fabric', [BED[0], F + 0.37, BED[1] - 0.08], [2.0, 0.26, 2.1]),
  box('fabric', [BED[0], F + 0.53, BED[1] + 0.2], [2.12, 0.12, 1.55]),
  box('accent', [BED[0], F + 0.6, BED[1] + 0.72], [2.16, 0.06, 0.55]),
  ...[-0.36, 0.36].map((dx) => box('fabric', [BED[0] + dx, F + 0.77, -4.99], [0.66, 0.5, 0.18], 0, -0.26)),
  ...[-0.4, 0.4].map((dx) => box('fabric', [BED[0] + dx, F + 0.7, -4.74], [0.7, 0.42, 0.2], 0, -0.55)),
  box('accent', [BED[0], F + 0.67, -4.52], [0.5, 0.3, 0.14], 0, -0.6),
  // bedside lamps (the tables are real models), and a bench at the foot
  ...[15.75, 18.65].flatMap((x) => [
    cyl('brass', [x, F + 0.565, -5.0], [0.12, 0.02, 0.12]),
    cyl('brass', [x, F + 0.7, -5.0], [0.03, 0.27, 0.03]),
    cyl('shade', [x, F + 0.93, -5.0], [0.26, 0.22, 0.26], 0.8),
  ]),
  box('dark', [16.4, F + 0.17, -2.62], [0.04, 0.34, 0.42]),
  box('dark', [18.0, F + 0.17, -2.62], [0.04, 0.34, 0.42]),
  box('fabric', [17.2, F + 0.41, -2.62], [1.7, 0.14, 0.46]),
  // wardrobe wall on the west side, a dressing mirror beside it
  box('glassDark', [12.4, F + 1.3, -1.6], [0.6, 2.6, 4.4]),
  ...fronts({ along: 'z', from: -3.8, to: 0.6, y0: F + 0.06, y1: F + 2.59, at: 12.7, out: 1, n: 8, m: 'wood', pull: 'tall' }),
  // the east glazing: sheers, a side table and a tree in a pot (the chair is a real model)
  cyl('wood', [20.6, F + 0.25, 0.4], [0.46, 0.5, 0.46]),
  ...plant(22.9, 0.6, F, 1.1),
  curtain(23.72, F + 0.03, -4.0, 1.0, 3.6, Math.PI / 2, 'sheer'),
  curtain(23.72, F + 0.03, -0.2, 1.0, 3.6, Math.PI / 2, 'sheer'),
  // the terrace glazing: linen at the ends, sheers drawn part of the way
  curtain(12.75, F + 0.03, 1.2, 1.1, 3.6),
  curtain(23.25, F + 0.03, 1.2, 1.1, 3.6),
  curtain(14.5, F + 0.03, 1.26, 2.3, 3.6, 0, 'sheer'),
  curtain(21.5, F + 0.03, 1.26, 2.3, 3.6, 0, 'sheer'),
  ...downlights(13.5, 22.5, -4.4, 0.4, F + CEIL, 4, 2),
];

// ---------------------------------------------------------------- stairs

/**
 * Finishes a flight from villa.ts (the structure there is one plain block per
 * step): a sloping concrete carriage under the steps, oak treads with a
 * nosing and a line of light beneath each, and a raked glass balustrade with
 * a brass handrail on both sides. Flights run along +x.
 */
function dressStair(s: Stair): Piece[] {
  const rise = (s.to - s.from) / s.steps;
  const length = s.steps * s.run;
  const slope = Math.atan2(rise, s.run);
  const sin = Math.sin(slope);
  const cos = Math.cos(slope);
  const [x0, z] = s.start;
  const raked = Math.hypot(length, s.to - s.from);
  // a point `along` the line of the inner corners of the steps, lifted `off` square to it
  const on = (along: number, off: number): [number, number] => [x0 + along * cos - off * sin, s.from + along * sin + off * cos];
  const out: Piece[] = [];
  const [cx, cy] = on(raked / 2, -0.11);
  out.push(box('slab', [cx, cy, z], [s.width, 0.22, raked], Math.PI / 2, -slope));
  for (let i = 0; i < s.steps - 1; i++) {
    const front = x0 + i * s.run;
    const top = s.from + (i + 1) * rise;
    out.push(box('wood', [front + s.run / 2 - 0.015, top + 0.02, z], [s.run + 0.03, 0.04, s.width + 0.02]));
    out.push(box('shade', [front - 0.012, top - 0.012, z], [0.012, 0.012, s.width - 0.16]));
  }
  // balustrades stand on the line of the nosings (one riser above the inner corners)
  const lift = rise * cos;
  for (const side of [-1, 1]) {
    const bz = z + side * (s.width / 2 + 0.012);
    const [gx, gy] = on(raked / 2 - 0.1, lift + 0.46);
    out.push(box('screen', [gx, gy, bz], [0.014, 0.92, raked - 0.5], Math.PI / 2, -slope));
    const [hx, hy] = on(raked / 2 - 0.1, lift + 0.94);
    out.push(box('brass', [hx, hy, bz], [0.05, 0.035, raked - 0.3], Math.PI / 2, -slope));
  }
  return out;
}

const [flight, upperFlight] = stairs;
/** the opening in the first floor that the flight rises through */
const WELL = { x0: -3.2, x1: 1.6, z0: -8.8, z1: -7.2 };
const flightEnd = flight.start[0] + flight.steps * flight.run;

const stairHall: Piece[] = [
  box('tileStone', [-2, 0.012, -9.0], [7.84, 0.024, 6.76]),
  ...dressStair(flight),
  ...dressStair(upperFlight),
  // the landing that closes the well beyond the top step
  box('slab', [(flightEnd + WELL.x1) / 2, F - 0.15, -8], [WELL.x1 - flightEnd, 0.3, WELL.z1 - WELL.z0]),
  // oak boards on the gallery, laid round the well
  ...(
    [
      [-5.92, WELL.x0, -12.35, -5.22],
      [WELL.x1, 11.92, -12.35, -5.22],
      [WELL.x0, WELL.x1, -12.35, WELL.z0],
      [WELL.x0, WELL.x1, WELL.z1, -5.22],
      [flightEnd, WELL.x1, WELL.z0, WELL.z1],
    ] as [number, number, number, number][]
  ).map(([xa, xb, za, zb]) => box('floor', [(xa + xb) / 2, F + 0.012, (za + zb) / 2], [xb - xa, 0.024, zb - za])),
  // glass guarding round the well on the first floor, capped in brass
  ...[WELL.z0 - 0.03, WELL.z1 + 0.03].flatMap((z) => [
    box('screen', [(WELL.x0 + flightEnd) / 2, F + 0.53, z], [flightEnd - WELL.x0, 1.05, 0.014]),
    box('brass', [(WELL.x0 + flightEnd) / 2, F + 1.07, z], [flightEnd - WELL.x0 + 0.04, 0.035, 0.05]),
  ]),
  box('screen', [WELL.x0 - 0.03, F + 0.53, -8], [0.014, 1.05, WELL.z1 - WELL.z0 + 0.06]),
  box('brass', [WELL.x0 - 0.03, F + 1.07, -8], [0.05, 0.035, WELL.z1 - WELL.z0 + 0.1]),
  // a canvas on the living-room wall, a tree by the foot of the stair, spots overhead
  box('dark', [0.2, 1.9, -5.595], [1.68, 1.18, 0.03]),
  box('art', [0.2, 1.9, -5.61], [1.6, 1.1, 0.03]),
  ...plant(-5.2, -11.6, 0, 1.2),
  ...downlights(-5, 1, -12, -9.4, CEIL, 3, 1),
  ...downlights(-5.4, -3.6, -8.4, -6.2, CEIL, 1, 2),
  ...downlights(2, 11, -12, -6, F + CEIL, 3, 2),
];

export const pieces: Piece[] = [
  ...living,
  ...dining,
  ...kitchen,
  ...lobby,
  ...stairHall,
  ...lounge,
  ...terrace,
  ...bathroom,
  ...bedroom,
];

// ---------------------------------------------------------------- real models

export type ModelId =
  | 'mid_century_lounge_chair'
  | 'modern_arm_chair_01'
  | 'dining_chair_02'
  | 'coffee_table_round_01'
  | 'side_table_01'
  | 'ceramic_vase_01'
  | 'ceramic_vase_02'
  | 'potted_plant_02'
  | 'potted_plant_04';

export interface Placement {
  model: ModelId;
  /** position of the model's base */
  pos: V3;
  /** which way it faces, radians about the vertical axis (0 = towards +z, the garden) */
  rot?: number;
  scale?: number;
}

/** angle that makes a model at (x, z) face the point (tx, tz) */
const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
const put = (model: ModelId, pos: V3, rot = 0, scale = 1): Placement => ({ model, pos, rot, scale });

/**
 * CC0 furniture and decor from Poly Haven (public/assets/models), placed at
 * real size. These load after the page is revealed.
 */
export const models: Placement[] = [
  // living room
  put('coffee_table_round_01', [SEATING[0], 0.024, SEATING[1]]),
  put('mid_century_lounge_chair', [2.9, 0.024, -3.9], facing(2.9, -3.9, SEATING[0], SEATING[1])),
  put('mid_century_lounge_chair', [9.5, 0.024, -2.2], facing(9.5, -2.2, 4, -2.6)),
  put('potted_plant_04', [SEATING[0] + 0.35, 0.515, SEATING[1] - 0.15], 0.6, 1.5),
  put('ceramic_vase_02', [0.7, 0.4, -5.0], 0, 1.7),
  put('ceramic_vase_01', [1.15, 0.4, -5.05], 0, 1.5),
  put('potted_plant_02', [-3.5, 0.82, -5.12], 1.2),
  // dining room: eight chairs, north side facing the garden and south side facing back
  ...[-1.2, -0.4, 0.4, 1.2].flatMap((dx) => [
    put('dining_chair_02', [DINING[0] + dx, 0.07, DINING[1] - 0.72], 0),
    put('dining_chair_02', [DINING[0] + dx, 0.07, DINING[1] + 0.72], Math.PI),
  ]),
  put('ceramic_vase_02', [DINING[0] - 0.55, 0.78, DINING[1]], 0, 1.4),
  put('ceramic_vase_01', [-19.5, 0.86, -2.3], 0, 1.6),
  put('potted_plant_04', [-19.5, 0.86, -0.5], 2.1, 1.6),
  // kitchen
  put('potted_plant_02', [-13.6, 0.96, -9.3], 0.4, 0.8),
  put('ceramic_vase_01', [-11.9, 0.96, -9.1], 0, 1.2),
  // lobby
  put('potted_plant_02', [6, 0.82, -10.2], 2.4, 1.15),
  put('ceramic_vase_01', [9.62, 0.84, -8.45], 0, 1.7),
  put('ceramic_vase_02', [9.62, 0.84, -9.9], 0, 1.3),
  // pool lounge
  put('mid_century_lounge_chair', [-14.2, 0.024, 7.7], facing(-14.2, 7.7, -16.1, 6.6)),
  put('modern_arm_chair_01', [-11.6, 0.024, 9.4], facing(-11.6, 9.4, -15, 7)),
  put('side_table_01', [-12.7, 0.024, 9.9], 0.3),
  put('potted_plant_04', [-12.7, 0.575, 9.9], 1.0, 1.5),
  put('potted_plant_04', [-9.9, 1.09, 3.95], 0.2, 1.4),
  // bathroom
  put('potted_plant_04', [21.85, F + 0.48, -8.0], 0.5, 1.5),
  put('ceramic_vase_02', [15.5, F + 0.825, -5.9], 0, 1.2),
  // master bedroom
  put('side_table_01', [15.75, F + 0.024, -5.0]),
  put('side_table_01', [18.65, F + 0.024, -5.0]),
  put('modern_arm_chair_01', [21.5, F + 0.024, -0.4], facing(21.5, -0.4, 17.2, -3.4)),
  put('ceramic_vase_01', [20.6, F + 0.5, 0.4], 0, 1.4),
];

/** Glass globes: pendants in each room. */
export const lamps: Lamp[] = [
  // living: a loose cluster hanging in the double-height void
  ...[
    [0, 0, 4.2],
    [0.35, 0.2, 4.9],
    [-0.3, 0.25, 5.3],
    [-0.55, -0.4, 3.7],
    [0.5, -0.3, 4.55],
    [-0.2, 0.5, 5.6],
    [0.15, 0.1, 3.95],
  ].map(([dx, dz, y]): Lamp => ({ pos: [SEATING[0] + dx * 1.6, y, SEATING[1] + dz * 1.6], radius: 0.13, from: 7.7 })),
  // dining and kitchen: rows over the tables
  ...[-1.1, 0, 1.1].map((dx): Lamp => ({ pos: [DINING[0] + dx, 2.15, DINING[1]], radius: 0.15, from: 3.7 })),
  ...[-1.3, 0, 1.3].map((dx): Lamp => ({ pos: [-12.6 + dx, 2.1, -9.2], radius: 0.12, from: 3.7 })),
  // lobby
  { pos: [6, 2.55, -10.2], radius: 0.2, from: 3.7 },
  { pos: [6.4, 2.95, -9.8], radius: 0.13, from: 3.7 },
  // lounge
  { pos: [-16.1, 2.3, 6.6], radius: 0.18, from: 3.7 },
  { pos: [-10.6, 2.4, 4.3], radius: 0.11, from: 3.7 },
  { pos: [-9.6, 2.5, 4.3], radius: 0.11, from: 3.7 },
  // bedroom and bathroom
  { pos: [14.9, F + 2.3, -2.2], radius: 0.14, from: F + 3.7 },
  { pos: [15.3, F + 2.7, -2.5], radius: 0.1, from: F + 3.7 },
  { pos: [22.1, F + 2.45, -9.5], radius: 0.14, from: F + 3.7 },
  { pos: [22.4, F + 2.75, -8.9], radius: 0.1, from: F + 3.7 },
];

/**
 * Warm pools of light, one per room. Only the three nearest the camera are
 * actually lit at any moment (see the rig), so the cost stays constant.
 * `outside` marks the ones that glow in the exterior views.
 */
export const lights: { pos: V3; intensity: number; distance: number; outside?: boolean }[] = [
  { pos: [SEATING[0], 4.3, SEATING[1]], intensity: 34, distance: 18, outside: true },
  { pos: [DINING[0], 2.2, DINING[1]], intensity: 16, distance: 12, outside: true },
  { pos: [17.2, F + 2.5, -3.0], intensity: 16, distance: 12, outside: true },
  { pos: [-12.6, 2.3, -9.4], intensity: 18, distance: 12 },
  { pos: [6, 2.6, -9.6], intensity: 15, distance: 11 },
  { pos: [4, F + 2.6, -8.5], intensity: 12, distance: 12 },
  { pos: [-3.6, 2.7, -10.2], intensity: 14, distance: 11 },
  { pos: [18.4, F + 2.5, -8.8], intensity: 16, distance: 12 },
  { pos: [-14.5, 2.5, 7.2], intensity: 18, distance: 14 },
];
