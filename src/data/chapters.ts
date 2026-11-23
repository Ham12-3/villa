/**
 * The scroll story: copy, scroll ranges and camera keyframes for each chapter.
 * Ranges are percentages of the total scroll length (0..100).
 */

export interface CameraPose {
  /** look-at point in metres */
  target: [number, number, number];
  /** distance from the target */
  radius: number;
  /** degrees from straight-down (0 = plan view, 90 = horizon) */
  polar: number;
  /** degrees around the building, 0 = garden front */
  azimuth: number;
}

export interface Chapter {
  id: string;
  /** short name on the progress rail (the hero has none) */
  rail?: string;
  eyebrow: string;
  title: string;
  description: string;
  start: number;
  end: number;
  /** scroll position where the chapter is fully settled (rail jumps + reduced motion) */
  rest: number;
}

export const TOTAL_VH = 900;

export const chapters: Chapter[] = [
  {
    id: 'hero',
    eyebrow: 'Private residence — 001',
    title: 'Villa Serein',
    description: 'From plan to place',
    start: 0,
    end: 8,
    rest: 0,
  },
  {
    id: 'site',
    rail: 'Site',
    eyebrow: '01 — Site plan',
    title: 'A plot between garden and water',
    description: 'Boundary, lawns, pool and forecourt are set out first, 74 by 52 metres.',
    start: 8,
    end: 18,
    rest: 17.6,
  },
  {
    id: 'plan',
    rail: 'Plan',
    eyebrow: '02 — Ground floor plan',
    title: 'Rooms drawn around a courtyard pool',
    description: 'An L-shaped plan: living spaces to the garden, service rooms to the forecourt.',
    start: 18,
    end: 30,
    rest: 29.6,
  },
  {
    id: 'structure',
    rail: 'Structure',
    eyebrow: '03 — Extrusion',
    title: 'The plan stands up',
    description: 'Walls rise 3.7 metres from their own outlines, openings already in place.',
    start: 30,
    end: 42,
    rest: 41.6,
  },
  {
    id: 'floors',
    rail: 'Floors',
    eyebrow: '04 — Floors stack',
    title: 'Three levels, each one offset',
    description: 'Slabs slide in, each plan is drawn on its slab, and the next storey rises.',
    start: 42,
    end: 58,
    rest: 57.6,
  },
  {
    id: 'details',
    rail: 'Details',
    eyebrow: '05 — Openings and details',
    title: 'Glass, arches and cantilevers',
    description: 'Frames and glazing fill the openings; terraces slide out and railings follow.',
    start: 58,
    end: 70,
    rest: 69.6,
  },
  {
    id: 'rooftop',
    rail: 'Rooftop',
    eyebrow: '06 — Roof and pavilion',
    title: 'A garden in the sky',
    description: 'Pergola beams drop in one by one beside the tower, and the trees grow in.',
    start: 70,
    end: 80,
    rest: 79.6,
  },
  {
    id: 'material',
    rail: 'Material',
    eyebrow: '07 — Materialisation',
    title: 'Drawing becomes building',
    description: 'White render over a warm stone base, dark frames, still water, evening sun.',
    start: 80,
    end: 92,
    rest: 91.6,
  },
  {
    id: 'villa',
    rail: 'Villa',
    eyebrow: '08 — Villa Serein',
    title: 'From plan to place',
    description: 'Five suites, a rooftop pavilion and 1,600 square metres of quiet.',
    start: 92,
    end: 100,
    rest: 100,
  },
];

export interface CameraKey {
  /** scroll position (0..100) at which the camera passes through this pose */
  at: number;
  pose: CameraPose;
}

const key = (
  at: number,
  target: [number, number, number],
  radius: number,
  polar: number,
  azimuth: number,
): CameraKey => ({ at, pose: { target, radius, polar, azimuth } });

/**
 * Keyframes of the single camera spline (see animation/cameraPath.ts).
 * It starts straight above the sheet, holds plan view while the drawings are
 * made, then tilts once, slowly and continuously, craning down and around to
 * a low three-quarter view of the finished house. Tilt only ever increases.
 */
export const cameraPath: CameraKey[] = [
  key(0, [-8, 0, 1], 172, 0.4, 0),
  key(10, [-8, 0, 1], 158, 0.4, 0),
  key(18, [-8, 0, 1], 158, 0.4, 0),
  key(25, [-6, 0, 0], 98, 0.4, 0),
  key(30, [-6, 0, 0], 98, 0.4, 0),
  key(41, [0, 2, 0], 112, 57, 24),
  key(53, [1, 4.5, 0], 118, 64, 31),
  key(66, [2, 5.5, 1], 108, 69, 35),
  key(78, [2, 7.5, 0], 104, 72, 37),
  key(90, [0, 5.5, 0], 110, 76, 18),
  key(100, [-6, 5, 2], 100, 81, -36),
];

/** Small screens: same story, less orbiting, a little further back. */
export const cameraPathMobile: CameraKey[] = [
  key(0, [1, 0, 1], 160, 0.4, 0),
  key(10, [1, 0, 1], 150, 0.4, 0),
  key(18, [1, 0, 1], 150, 0.4, 0),
  key(25, [2, 0, 0], 104, 0.4, 0),
  key(30, [2, 0, 0], 104, 0.4, 0),
  key(41, [1, 2, 0], 112, 58, 26),
  key(66, [2, 5.5, 0], 110, 68, 30),
  key(78, [2, 7.5, 0], 108, 71, 31),
  key(90, [1, 5.5, 0], 110, 75, 24),
  key(100, [0, 5, 2], 108, 80, 4),
];

export const railChapters = chapters.filter((c) => c.rail);

/** index of the chapter containing scroll position p (0..100) */
export function chapterAt(p: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (p >= chapters[i].start) return i;
  }
  return 0;
}
