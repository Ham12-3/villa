/**
 * Fit-out of the rooms the camera tours at the end of the story: living room,
 * entrance lobby, dining room, kitchen, the first-floor bathroom and master
 * bedroom, and the pool loggia lounge. Like the rest of the villa it is plain
 * data (boxes, cylinders, spheres, lamps) turned into geometry by a builder.
 *
 * Coordinates as in villa.ts: metres, +x east, +z garden front. Ground floor
 * finishes sit on y 0, first-floor ones on y 4.
 */

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
  | 'water';

export interface Piece {
  material: InteriorMaterial;
  shape: 'box' | 'cyl' | 'sphere' | 'curtain';
  /** centre */
  c: [number, number, number];
  /** size: width, height, depth (for cyl / sphere these are diameters; for a curtain, depth is the depth of its folds) */
  s: [number, number, number];
  /** rotation about the vertical axis, radians */
  rot?: number;
}

export interface Lamp {
  /** centre of the glowing globe */
  pos: [number, number, number];
  radius: number;
  /** height the suspension rod hangs from (omit for no rod) */
  from?: number;
}

type V3 = [number, number, number];
const box = (material: InteriorMaterial, c: V3, s: V3, rot = 0): Piece => ({ material, shape: 'box', c, s, rot });
const cyl = (material: InteriorMaterial, c: V3, s: V3): Piece => ({ material, shape: 'cyl', c, s });
const sph = (material: InteriorMaterial, c: V3, s: V3): Piece => ({ material, shape: 'sphere', c, s });
/** A drawn-back linen curtain hanging in the x direction: bottom at y0, `height` tall. */
const curtain = (x: number, y0: number, z: number, width: number, height: number): Piece => ({
  material: 'fabric',
  shape: 'curtain',
  c: [x, y0 + height / 2, z],
  s: [width, height, 0.07],
});

/** Local -> world for a piece group rotated about Y at (x, z). */
const placer = (x: number, y0: number, z: number, rot: number) => {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return (lx: number, y: number, lz: number): V3 => [x + lx * cos + lz * sin, y0 + y, z - lx * sin + lz * cos];
};

/** A sofa: base, back, two arms, loose seat and back cushions. Faces -z before rotation. */
function sofa(x: number, z: number, length: number, rot = 0, y0 = 0, m: InteriorMaterial = 'fabric'): Piece[] {
  const at = placer(x, y0, z, rot);
  const n = Math.max(2, Math.round(length / 1.05));
  const w = (length - 0.5) / n;
  const out = [
    box(m, at(0, 0.2, 0), [length, 0.4, 1.0], rot),
    box(m, at(0, 0.58, 0.42), [length, 0.5, 0.18], rot),
    box(m, at(-length / 2 + 0.11, 0.42, 0), [0.22, 0.6, 1.0], rot),
    box(m, at(length / 2 - 0.11, 0.42, 0), [0.22, 0.6, 1.0], rot),
  ];
  for (let k = 0; k < n; k++) {
    const lx = -length / 2 + 0.25 + w * (k + 0.5);
    out.push(box(m, at(lx, 0.47, -0.08), [w - 0.04, 0.14, 0.78], rot));
    out.push(box(m, at(lx, 0.72, 0.26), [w - 0.1, 0.36, 0.16], rot));
  }
  return out;
}

/** Olive in a planter. */
function plant(x: number, z: number, y0 = 0, scale = 1): Piece[] {
  return [
    cyl('stone', [x, y0 + 0.28 * scale, z], [0.56 * scale, 0.56 * scale, 0.56 * scale]),
    cyl('dark', [x, y0 + 0.9 * scale, z], [0.05, 0.9 * scale, 0.05]),
    sph('olive', [x, y0 + 1.6 * scale, z], [0.95 * scale, 0.9 * scale, 0.95 * scale]),
    sph('olive', [x + 0.22 * scale, y0 + 1.85 * scale, z - 0.1], [0.6 * scale, 0.55 * scale, 0.6 * scale]),
  ];
}

function stool(x: number, z: number, y0 = 0): Piece[] {
  return [
    cyl('fabricDark', [x, y0 + 0.69, z], [0.38, 0.07, 0.38]),
    cyl('brass', [x, y0 + 0.33, z], [0.045, 0.66, 0.045]),
    cyl('brass', [x, y0 + 0.02, z], [0.36, 0.03, 0.36]),
  ];
}

// ---------------------------------------------------------------- ground floor

const SEATING: [number, number] = [0.3, -2.9];
const DINING: [number, number] = [-12.6, -1.4];

const living: Piece[] = [
  box('floor', [3, 0.012, -2.035], [17.84, 0.024, 6.77]),
  box('rug', [SEATING[0], 0.04, SEATING[1]], [6.6, 0.03, 3.8]),
  ...sofa(0.2, -0.95, 3.4, 0),
  ...sofa(-3.0, -2.9, 2.6, -Math.PI / 2),
  // (marble coffee table, lounge chairs, vases and plants are real models: see `models`)
  box('art', [SEATING[0] - 0.3, 0.52, SEATING[1] + 0.12], [0.34, 0.05, 0.26], 0.2),
  // fire wall on the back wall, with a long low hearth and a slot of fire
  box('dark', [2.2, 1.72, -5.3], [4.4, 3.44, 0.24]),
  box('stone', [2.2, 0.2, -5.0], [4.9, 0.4, 0.62]),
  box('glow', [2.2, 0.72, -5.17], [2.3, 0.2, 0.04]),
  // sideboard, canvas and a lamp under the gallery
  box('wood', [-4.2, 0.4, -5.12], [2.5, 0.8, 0.5]),
  box('art', [-4.2, 2.05, -5.4], [1.7, 1.25, 0.04]),
  box('rail', [-5.2, 0.8, -4.9], [0.03, 1.6, 0.03]),
  box('glow', [-5.2, 1.72, -4.9], [0.3, 0.34, 0.3]),
  // reading corner and planting at the east end
  cyl('wood', [10.4, 0.25, -3.4], [0.5, 0.5, 0.5]),
  ...plant(10.9, -4.7),
  ...plant(-5.2, 0.6, 0, 0.9),
  // full-height linen at each end of the glazing
  curtain(-5.3, 0.03, 1.2, 1.1, 7.3),
  curtain(11.3, 0.03, 1.2, 1.1, 7.3),
];

const dining: Piece[] = [
  box('floor', [-12.965, 0.012, -1.0], [13.77, 0.024, 8.84]),
  box('rug', [DINING[0], 0.04, DINING[1]], [5.2, 0.03, 3.4]),
  box('wood', [DINING[0], 0.75, DINING[1]], [3.5, 0.06, 1.15]),
  box('dark', [DINING[0] - 1.25, 0.36, DINING[1]], [0.1, 0.72, 0.9]),
  box('dark', [DINING[0] + 1.25, 0.36, DINING[1]], [0.1, 0.72, 0.9]),
  // table setting
  cyl('brass', [DINING[0] + 0.5, 0.9, DINING[1]], [0.07, 0.24, 0.07]),
  cyl('brass', [DINING[0] + 0.75, 0.87, DINING[1] + 0.1], [0.07, 0.18, 0.07]),
  // buffet with a mirror on the west wall
  box('wood', [-19.5, 0.43, -1.4], [0.5, 0.86, 3.2]),
  box('mirror', [-19.78, 1.9, -1.4], [0.04, 1.4, 2.4]),
  ...plant(-18.6, 2.6),
];

const kitchen: Piece[] = [
  box('slab', [-12.965, 0.012, -8.96], [13.77, 0.024, 6.76]),
  // back run under the windows: dark fronts, pale stone top, tall timber larder
  box('dark', [-12.2, 0.45, -12.02], [9.6, 0.9, 0.66]),
  box('ceramic', [-12.2, 0.92, -12.0], [9.7, 0.04, 0.72]),
  box('wood', [-18.75, 1.2, -12.02], [2.2, 2.4, 0.66]),
  box('dark', [-18.2, 1.2, -11.68], [0.02, 2.2, 0.02]),
  box('dark', [-11.2, 0.95, -12.0], [0.8, 0.02, 0.52]), // hob
  box('mirror', [-14.6, 0.95, -12.0], [0.7, 0.02, 0.45]), // sink
  cyl('brass', [-14.6, 1.1, -12.22], [0.04, 0.32, 0.04]),
  box('wood', [-8.9, 1.75, -12.22], [3.0, 0.05, 0.28]),
  cyl('ceramic', [-9.6, 1.9, -12.22], [0.18, 0.24, 0.18]),
  cyl('ceramic', [-9.2, 1.86, -12.22], [0.14, 0.16, 0.14]),
  cyl('brass', [-8.3, 1.88, -12.22], [0.16, 0.2, 0.16]),
  // island with a waterfall stone top and four stools
  box('wood', [-12.6, 0.45, -9.2], [3.9, 0.9, 1.15]),
  box('ceramic', [-12.6, 0.93, -9.2], [4.2, 0.06, 1.35]),
  box('ceramic', [-14.67, 0.48, -9.2], [0.06, 0.96, 1.35]),
  box('ceramic', [-10.53, 0.48, -9.2], [0.06, 0.96, 1.35]),
  ...[-14.0, -13.1, -12.2, -11.3].flatMap((x) => stool(x, -8.2)),
];

const lobby: Piece[] = [
  box('paving', [6, 0.012, -9.0], [7.84, 0.024, 6.76]),
  box('rug', [6, 0.04, -8.9], [2.4, 0.03, 4.6]),
  // round table with a tall arrangement in the middle of the hall
  cyl('dark', [6, 0.38, -10.2], [0.5, 0.76, 0.5]),
  cyl('ceramic', [6, 0.79, -10.2], [1.5, 0.06, 1.5]),
  box('art', [5.5, 0.85, -10.05], [0.34, 0.06, 0.26], 0.3),
  // console and tall mirror on the east wall, bench opposite
  box('wood', [9.62, 0.42, -9.2], [0.44, 0.84, 2.4]),
  box('mirror', [9.86, 1.95, -9.2], [0.04, 1.7, 1.5]),
  box('fabricDark', [2.5, 0.24, -10.6], [0.5, 0.48, 1.8]),
  box('art', [2.12, 1.9, -10.6], [0.04, 1.2, 1.6]),
  ...plant(9.3, -6.2, 0, 0.95),
];

// the pool loggia: an open lounge behind the arches
const lounge: Piece[] = [
  box('paving', [-12.965, 0.012, 8.0], [13.77, 0.024, 8.76]),
  box('rug', [-16.2, 0.04, 6.6], [5.2, 0.03, 4.2]),
  ...sofa(-16.2, 4.75, 3.6, Math.PI, 0, 'fabric'),
  ...sofa(-18.6, 6.9, 2.6, -Math.PI / 2, 0, 'fabric'),
  cyl('stone', [-16.1, 0.2, 6.6], [1.3, 0.4, 1.3]),
  cyl('brass', [-16.1, 0.45, 6.6], [0.3, 0.1, 0.3]),
  // daybeds by the south-west arch
  box('wood', [-17.6, 0.18, 10.6], [2.1, 0.36, 0.95]),
  box('fabric', [-17.6, 0.44, 10.6], [2.0, 0.16, 0.9]),
  box('fabric', [-18.4, 0.6, 10.6], [0.4, 0.16, 0.8]),
  box('wood', [-9.2, 0.18, 10.9], [0.95, 0.36, 2.1]),
  box('fabric', [-9.2, 0.44, 10.9], [0.9, 0.16, 2.0]),
  box('fabric', [-9.2, 0.6, 11.7], [0.8, 0.16, 0.4]),
  // bar along the dining wall
  box('dark', [-10.6, 0.52, 4.0], [4.2, 1.04, 0.6]),
  box('ceramic', [-10.6, 1.06, 4.02], [4.4, 0.05, 0.72]),
  ...[-11.8, -10.6, -9.4].flatMap((x) => stool(x, 4.75)),
  cyl('brass', [-11.5, 1.2, 3.95], [0.09, 0.24, 0.09]),
  cyl('ceramic', [-9.9, 1.18, 3.95], [0.2, 0.2, 0.2]),
  // lanterns and planting
  box('glow', [-19.2, 0.3, 11.6], [0.3, 0.5, 0.3]),
  box('glow', [-19.3, 0.22, 4.4], [0.24, 0.36, 0.24]),
  box('glow', [-7.0, 0.26, 4.6], [0.26, 0.44, 0.26]),
  ...plant(-19.0, 9.0, 0, 1.1),
  ...plant(-7.2, 11.8, 0, 1.0),
];

// ---------------------------------------------------------------- first floor

const F = 4; // first floor level

const bathroom: Piece[] = [
  box('ceramic', [18, F + 0.012, -9.0], [11.76, 0.024, 6.76]),
  // double vanity with a long mirror on the bedroom wall
  box('wood', [17, F + 0.5, -5.76], [3.6, 0.5, 0.56]),
  box('ceramic', [17, F + 0.78, -5.76], [3.7, 0.06, 0.6]),
  cyl('ceramic', [16.1, F + 0.86, -5.78], [0.44, 0.12, 0.44]),
  cyl('ceramic', [17.9, F + 0.86, -5.78], [0.44, 0.12, 0.44]),
  cyl('brass', [16.1, F + 0.98, -5.56], [0.035, 0.26, 0.035]),
  cyl('brass', [17.9, F + 0.98, -5.56], [0.035, 0.26, 0.035]),
  box('mirror', [17, F + 1.75, -5.47], [3.4, 1.2, 0.03]),
  box('glow', [17, F + 2.45, -5.5], [3.0, 0.05, 0.05]),
  // freestanding bath by the east window
  cyl('ceramic', [21.0, F + 0.31, -9.4], [0.98, 0.62, 2.0]),
  cyl('dark', [21.0, F + 0.615, -9.4], [0.84, 0.012, 1.86]),
  cyl('water', [21.0, F + 0.6, -9.4], [0.82, 0.02, 1.84]),
  cyl('brass', [21.75, F + 0.5, -10.2], [0.045, 1.0, 0.045]),
  cyl('wood', [20.0, F + 0.24, -8.4], [0.36, 0.48, 0.36]),
  box('rug', [19.9, F + 0.03, -9.4], [0.8, 0.02, 1.6]),
  // walk-in shower in the corner behind a glass screen
  box('dark', [13.4, F + 0.03, -11.2], [2.3, 0.04, 2.3]),
  box('stone', [12.26, F + 1.3, -11.2], [0.1, 2.6, 2.3]),
  box('mirror', [14.56, F + 1.15, -11.2], [0.02, 2.3, 2.2]),
  cyl('brass', [12.5, F + 2.25, -11.2], [0.28, 0.03, 0.28]),
  // WC behind a half-height stone wall
  box('stone', [21.9, F + 0.65, -6.3], [0.12, 1.3, 1.5]),
  box('ceramic', [22.95, F + 0.22, -6.25], [0.4, 0.44, 0.6]),
  box('ceramic', [22.95, F + 0.64, -5.86], [0.44, 0.42, 0.2]),
  box('ceramic', [22.95, F + 0.46, -6.25], [0.42, 0.04, 0.62]),
  ...plant(23.2, -12.0, F, 0.9),
];

const bedroom: Piece[] = [
  box('floor', [18, F + 0.012, -2.035], [11.76, 0.024, 6.77]),
  box('rug', [17.2, F + 0.04, -3.4], [4.6, 0.03, 3.8]),
  // king bed against a full-height upholstered headboard wall
  box('fabricDark', [17.2, F + 1.2, -5.34], [4.6, 2.4, 0.12]),
  box('wood', [17.2, F + 0.18, -4.18], [2.2, 0.36, 2.25]),
  box('fabric', [17.2, F + 0.5, -4.15], [2.05, 0.28, 2.15]),
  box('fabric', [17.2, F + 0.66, -3.75], [2.1, 0.06, 1.4]),
  box('fabricDark', [17.2, F + 0.7, -3.25], [2.12, 0.05, 0.5]),
  box('fabric', [16.7, F + 0.76, -4.92], [0.75, 0.22, 0.45]),
  box('fabric', [17.7, F + 0.76, -4.92], [0.75, 0.22, 0.45]),
  box('fabricDark', [17.2, F + 0.8, -4.62], [0.6, 0.18, 0.3]),
  // bedside tables with lamps, and a bench at the foot
  cyl('brass', [15.75, F + 0.71, -5.0], [0.05, 0.32, 0.05]),
  cyl('brass', [18.65, F + 0.71, -5.0], [0.05, 0.32, 0.05]),
  cyl('glow', [15.75, F + 0.95, -5.0], [0.24, 0.2, 0.24]),
  cyl('glow', [18.65, F + 0.95, -5.0], [0.24, 0.2, 0.24]),
  box('fabric', [17.2, F + 0.22, -2.7], [1.7, 0.44, 0.46]),
  // wardrobe wall, dressing mirror, and a chair by the glass
  box('wood', [23.5, F + 1.2, -3.4], [0.62, 2.4, 3.6]),
  box('dark', [23.18, F + 1.2, -3.4], [0.02, 2.2, 0.02]),
  box('mirror', [23.18, F + 1.25, -1.0], [0.03, 2.0, 0.8]),
  cyl('wood', [20.6, F + 0.25, 0.4], [0.46, 0.5, 0.46]),
  ...plant(12.9, 0.7, F, 1.0),
  curtain(12.75, F + 0.03, 1.2, 1.1, 3.6),
  curtain(23.25, F + 0.03, 1.2, 1.1, 3.6),
];

export const pieces: Piece[] = [...living, ...dining, ...kitchen, ...lobby, ...lounge, ...bathroom, ...bedroom];

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
  put('potted_plant_02', [-3.5, 0.8, -5.12], 1.2),
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
  put('potted_plant_04', [-9.9, 1.085, 3.95], 0.2, 1.4),
  // bathroom
  put('potted_plant_04', [20.0, F + 0.48, -8.4], 0.5, 1.5),
  put('ceramic_vase_02', [15.5, F + 0.81, -5.8], 0, 1.2),
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
  { pos: [20.6, F + 2.4, -8.8], radius: 0.14, from: F + 3.7 },
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
  { pos: [18.4, F + 2.5, -8.8], intensity: 16, distance: 12 },
  { pos: [-14.5, 2.5, 7.2], intensity: 18, distance: 14 },
];
