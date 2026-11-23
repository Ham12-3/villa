import type * as THREE from 'three';

/**
 * Shared screen-space state between the WebGL scene and the HTML overlay.
 *  - The overlay measures where the chapter copy sits and writes it here.
 *  - The camera rig reads it to keep the model out of that zone, then calls
 *    the listeners (in the same frame) so projected labels never lag.
 */
export const view = {
  /** bounding box of the current chapter's copy, in CSS px (valid once measured) */
  copy: { left: 0, top: 0, right: 0, bottom: 0, valid: false },
  /** the same box for every chapter, by chapter index */
  copyRects: [] as { left: number; top: number; right: number; bottom: number; valid: boolean }[],
  chapter: 0,
  /** bounding box of the section rail (also kept clear of the model) */
  rail: { left: 0, top: 0, right: 0, bottom: 0, valid: false },
  /** copy sits under the model (small screens) rather than beside it */
  stacked: false,
  listeners: new Set<(camera: THREE.PerspectiveCamera, width: number, height: number) => void>(),
};

/** px between the building and the right edge kept free for the level labels */
export const LABEL_COLUMN = 216;

/** 2D convex hull (monotone chain) of points stored as [x0, y0, x1, y1, ...]. */
export function convexHull(pts: ArrayLike<number>, count: number, out: number[]): number {
  const idx: number[] = [];
  for (let i = 0; i < count; i++) idx.push(i);
  idx.sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (o: number, a: number, b: number) =>
    (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const h: number[] = [];
  for (const i of idx) {
    while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], i) <= 0) h.pop();
    h.push(i);
  }
  const lower = h.length + 1;
  for (let k = idx.length - 2; k >= 0; k--) {
    const i = idx[k];
    while (h.length >= lower && cross(h[h.length - 2], h[h.length - 1], i) <= 0) h.pop();
    h.push(i);
  }
  h.pop();
  out.length = 0;
  for (const i of h) out.push(pts[i * 2], pts[i * 2 + 1]);
  return h.length;
}

/** Leftmost x of a hull inside the horizontal band y0..y1 (Infinity if it misses the band). */
export function hullMinXInBand(hull: number[], y0: number, y1: number): number {
  let min = Infinity;
  const n = hull.length / 2;
  for (let i = 0; i < n; i++) {
    let ax = hull[i * 2];
    let ay = hull[i * 2 + 1];
    let bx = hull[((i + 1) % n) * 2];
    let by = hull[((i + 1) % n) * 2 + 1];
    if (ay > by) {
      [ax, bx] = [bx, ax];
      [ay, by] = [by, ay];
    }
    if (by < y0 || ay > y1) continue;
    const span = by - ay || 1e-6;
    const ta = Math.max(0, (y0 - ay) / span);
    const tb = Math.min(1, (y1 - ay) / span);
    min = Math.min(min, ax + (bx - ax) * ta, ax + (bx - ax) * tb);
  }
  return min;
}

/** Does a horizontal ray from (x, y) towards +x pass through the hull? */
export function rayHitsHull(hull: number[], x: number, y: number): boolean {
  const n = hull.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = hull[i * 2];
    const ay = hull[i * 2 + 1];
    const bx = hull[((i + 1) % n) * 2];
    const by = hull[((i + 1) % n) * 2 + 1];
    if (ay > y === by > y) continue;
    const ix = ax + ((y - ay) / (by - ay)) * (bx - ax);
    if (ix > x) return true;
  }
  return false;
}

/**
 * Projects a world point to CSS px with the camera's current matrices.
 * (Plain arithmetic, so the HTML overlay does not need three.js loaded.)
 */
export function projectPoint(camera: THREE.PerspectiveCamera, p: readonly number[], w: number, h: number, out: [number, number]) {
  const v = camera.matrixWorldInverse.elements;
  const m = camera.projectionMatrix.elements;
  const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
  const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
  const z = v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
  const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
  out[0] = (cx * 0.5 + 0.5) * w;
  out[1] = (-cy * 0.5 + 0.5) * h;
  return out;
}
