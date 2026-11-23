import * as THREE from 'three';
import { housePoints, sitePoints, type Pt } from '../data/massing';
import type { PoseValues } from './cameraPath';
import { convexHull, hullMinXInBand, view } from './view';

const DEG = Math.PI / 180;

export interface Framing {
  /** extra pull-back on top of the authored camera distance */
  zoom: number;
  /** shift of the picture on screen, in px (right / up are positive) */
  dx: number;
  dy: number;
}

interface Needs {
  /** 0..1: the whole site (plinth, trees) must be in frame, not just the house */
  wholeSite: number;
  /** px kept free on the right for level labels */
  reserveRight: number;
}

/** Puts the camera on its orbit pose at the given distance (no picture shift). */
export function placeCamera(camera: THREE.PerspectiveCamera, pose: PoseValues, radius: number) {
  const polar = Math.max(0.2, pose.polar) * DEG;
  const az = pose.azimuth * DEG;
  camera.position.set(
    pose.tx + radius * Math.sin(polar) * Math.sin(az),
    pose.ty + radius * Math.cos(polar),
    pose.tz + radius * Math.sin(polar) * Math.cos(az),
  );
  camera.lookAt(pose.tx, pose.ty, pose.tz);
  camera.updateMatrixWorld();
}

/**
 * Safe-zone solver. Every frame it finds the smallest pull-back and picture
 * shift for which
 *   - nothing of the site sits under the chapter copy,
 *   - the house is fully inside the viewport (clear of brand and labels),
 * at whatever size and shape the window is. It works on screen-space convex
 * hulls of a coarse model, so it is conservative and continuous: as the
 * camera moves, the answer glides, it never jumps.
 */
export function createFraming() {
  const v = new THREE.Vector3();
  const house = new Float32Array(housePoints.length * 2);
  const all = new Float32Array(sitePoints.length * 2);
  const hull: number[] = [];
  const result: Framing = { zoom: 1, dx: 0, dy: 0 };

  const project = (pts: Pt[], camera: THREE.PerspectiveCamera, w: number, h: number, out: Float32Array) => {
    for (let i = 0; i < pts.length; i++) {
      v.set(pts[i][0], pts[i][1], pts[i][2]).project(camera);
      out[i * 2] = (v.x * 0.5 + 0.5) * w;
      out[i * 2 + 1] = (-v.y * 0.5 + 0.5) * h;
    }
  };
  const bounds = (a: Float32Array) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < a.length; i += 2) {
      if (a[i] < x0) x0 = a[i];
      if (a[i] > x1) x1 = a[i];
      if (a[i + 1] < y0) y0 = a[i + 1];
      if (a[i + 1] > y1) y1 = a[i + 1];
    }
    return { x0, x1, y0, y1 };
  };

  /** Evaluates one candidate zoom; returns whether it satisfies everything. */
  const test = (
    camera: THREE.PerspectiveCamera,
    pose: PoseValues,
    radius: number,
    w: number,
    h: number,
    needs: Needs,
    strictSite: boolean,
  ) => {
    placeCamera(camera, pose, radius);
    project(housePoints, camera, w, h, house);
    project(sitePoints, camera, w, h, all);
    convexHull(all, sitePoints.length, hull);
    const hb = bounds(house);
    const sb = bounds(all);
    const c = view.copy;
    const top = Math.min(72, h * 0.09);

    if (view.stacked) {
      // copy is underneath: lift the picture until the site clears it
      const dy = Math.max(0, sb.y1 - (c.top - 22));
      // and slide it left by half the label column, so the house stays centred
      // in the width that is actually free
      const dx = -needs.reserveRight / 2;
      result.dx = dx;
      result.dy = dy;
      return hb.y0 - dy >= top && hb.x0 + dx >= 8 && hb.x1 + dx <= w - 8 - needs.reserveRight;
    }

    // copy and rail are to the left: slide the picture right until the site
    // clears both, each within its own height band
    let dx = Math.max(0, c.right + 28 - hullMinXInBand(hull, c.top - 16, c.bottom + 16));
    const r = view.rail;
    if (r.valid) dx = Math.max(dx, r.right + 22 - hullMinXInBand(hull, r.top - 10, r.bottom + 10));
    result.dx = dx;
    result.dy = 0;
    let ok = hb.x1 + dx <= w - 24 - needs.reserveRight && hb.y0 >= top && hb.y1 <= h - 26;
    if (strictSite) ok = ok && sb.x1 + dx <= w - 14 && sb.y0 >= top * 0.6 && sb.y1 <= h - 14;
    return ok;
  };

  const solveZoom = (
    camera: THREE.PerspectiveCamera,
    pose: PoseValues,
    base: number,
    w: number,
    h: number,
    needs: Needs,
    strictSite: boolean,
  ) => {
    // small screens may also move in: there the authored distance is only a guess
    let lo = view.stacked ? 0.55 : 1;
    let hi = 3.4;
    if (test(camera, pose, base * lo, w, h, needs, strictSite)) return lo;
    for (let i = 0; i < 13; i++) {
      const mid = (lo + hi) / 2;
      if (test(camera, pose, base * mid, w, h, needs, strictSite)) hi = mid;
      else lo = mid;
    }
    return hi;
  };

  return (
    camera: THREE.PerspectiveCamera,
    pose: PoseValues,
    base: number,
    w: number,
    h: number,
    needs: Needs,
  ): Framing => {
    if (!view.copy.valid) {
      result.zoom = 1;
      result.dx = 0;
      result.dy = 0;
      return result;
    }
    let zoom = solveZoom(camera, pose, base, w, h, needs, false);
    if (needs.wholeSite > 0.001 && !view.stacked) {
      const strict = solveZoom(camera, pose, base, w, h, needs, true);
      zoom += (strict - zoom) * needs.wholeSite;
    }
    // leave result.dx / dy matching the final zoom
    test(camera, pose, base * zoom, w, h, needs, false);
    result.zoom = zoom;
    return result;
  };
}
