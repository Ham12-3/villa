import * as THREE from 'three';
import type { Tree } from '../../data/villa';
import { LineBuilder, MeshBuilder, rng, type P3 } from './geo';

/** Clean circle in the plane spanned by u and v. */
export function circle(centre: P3, u: P3, v: P3, radius: number, segments = 48): P3[] {
  const pts: P3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    pts.push([centre[0] + u[0] * c + v[0] * s, centre[1] + u[1] * c + v[1] * s, centre[2] + u[2] * c + v[2] * s]);
  }
  return pts;
}

const X: P3 = [1, 0, 0];
const Y: P3 = [0, 1, 0];
const Z: P3 = [0, 0, 1];

/** Smooth, repeatable 3D noise used to sculpt the canopies. */
function sculpt(x: number, y: number, z: number, seed: number) {
  return (
    Math.sin(x * 1.7 + seed) * Math.cos(z * 1.9 - seed * 0.7) * 0.5 +
    Math.sin(y * 2.3 + seed * 1.3) * Math.sin(x * 3.1 + z * 2.7) * 0.3 +
    Math.cos(y * 5.1 + x * 4.3 - z * 3.7 + seed) * 0.2
  );
}

/** Cypress silhouette: radius at height fraction t (0 = skirt, 1 = tip). */
const cypressProfile = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85) * (1 - t * 0.12);

/**
 * Stylised trees in the manner of an architect's model:
 *  - cypress: a tall, sculpted spindle
 *  - olive: a soft, lobed crown on a short forked trunk
 * Each has a clean line-drawing twin (meridians and rings, no jitter) for
 * the drawing stages, and a smooth solid twin for the materialised view.
 */
export function buildTrees(trees: Tree[], seed = 1) {
  const lines = new LineBuilder();
  const cypress = new MeshBuilder();
  const olive = new MeshBuilder();
  const trunks = new MeshBuilder();
  const rand = rng(seed * 9973 + 17);

  trees.forEach((t, ti) => {
    const [x, z] = t.pos;
    const r = t.radius;
    const origin: P3 = [x, t.base, z];
    const delay = trees.length > 1 ? ti / (trees.length - 1) : 0;
    const o = { delay, origin };
    const s = rand() * 40;

    if (t.kind === 'cypress') {
      const skirt = t.base + Math.min(0.9, t.height * 0.09);
      const h = t.base + t.height - skirt;

      // solid: lathe-like surface, sculpted, then smooth normals
      const radial = 16;
      const rows = 22;
      const g = new THREE.CylinderGeometry(1, 1, 1, radial, rows, true);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const ty = p.getY(i) + 0.5;
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const rr = r * cypressProfile(ty) * (1 + 0.09 * sculpt(Math.cos(a) * 2, ty * 9, Math.sin(a) * 2, s));
        p.setXYZ(i, x + Math.cos(a) * rr, skirt + ty * h, z + Math.sin(a) * rr);
      }
      g.computeVertexNormals();
      g.deleteAttribute('uv');
      cypress.add(g, o);

      const tg = new THREE.CylinderGeometry(0.07 * r + 0.04, 0.1 * r + 0.06, skirt - t.base + 0.3, 8, 1);
      tg.deleteAttribute('uv');
      tg.translate(x, (t.base + skirt + 0.3) / 2, z);
      trunks.add(tg, o);

      // drawing: six meridians and three rings
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const pts: P3[] = [];
        for (let i = 0; i <= 24; i++) {
          const ty = i / 24;
          const rr = r * cypressProfile(ty);
          pts.push([x + Math.cos(a) * rr, skirt + ty * h, z + Math.sin(a) * rr]);
        }
        lines.polyline(pts, { ...o, shade: k % 3 === 0 ? 0.85 : 0.45 });
      }
      for (const ty of [0.18, 0.42, 0.68]) {
        lines.polyline(circle([x, skirt + ty * h, z], X, Z, r * cypressProfile(ty), 32), { ...o, closed: true, shade: 0.5 });
      }
      lines.polyline([[x, t.base, z], [x, skirt, z]], { ...o, shade: 0.85 });
      return;
    }

    // ---- olive
    const cy = t.base + t.height - r * 0.95;
    const blobs: [number, number, number, number][] = [
      [0, 0, 0, 0.86],
      [r * 0.42, r * 0.1, r * 0.22, 0.6],
      [-r * 0.38, -r * 0.02, -r * 0.3, 0.62],
      [r * 0.05, r * 0.34, -r * 0.26, 0.52],
      [-r * 0.2, r * 0.2, r * 0.36, 0.5],
    ];
    for (const [bx, by, bz, k] of blobs) {
      const g = new THREE.SphereGeometry(r * k, 20, 14);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i);
        const py = p.getY(i);
        const pz = p.getZ(i);
        const d = 1 + 0.14 * sculpt((px / r) * 3, (py / r) * 3, (pz / r) * 3, s + bx);
        p.setXYZ(i, x + bx + px * d, cy + by + py * d * 0.86, z + bz + pz * d);
      }
      g.computeVertexNormals();
      g.deleteAttribute('uv');
      olive.add(g, o);
    }
    const lean = (rand() - 0.5) * 0.3;
    const th = cy - r * 0.35 - t.base;
    const tg = new THREE.CylinderGeometry(0.05 * r + 0.035, 0.09 * r + 0.06, th, 8, 1);
    tg.deleteAttribute('uv');
    tg.rotateZ(-lean * 0.25);
    tg.translate(x + lean * 0.3, t.base + th / 2, z);
    trunks.add(tg, o);
    for (const side of [-1, 1]) {
      const bg = new THREE.CylinderGeometry(0.03 * r + 0.02, 0.05 * r + 0.03, r * 0.9, 6, 1);
      bg.deleteAttribute('uv');
      bg.rotateZ(side * 0.6);
      bg.translate(x + lean * 0.3 - side * r * 0.24, t.base + th + r * 0.2, z + side * r * 0.08);
      trunks.add(bg, o);
    }

    // drawing: crown as three clean great circles, a ground-plane ring, trunk
    // drawn a little outside the sculpted solid so the outline is never clipped
    const c: P3 = [x, cy + r * 0.04, z];
    const sq: P3 = [0, 0.9, 0];
    const lr = r * 1.16;
    lines.polyline(circle(c, X, Z, lr), { ...o, closed: true, shade: 0.85 });
    lines.polyline(circle(c, X, sq, lr), { ...o, closed: true, shade: 0.5 });
    lines.polyline(circle(c, Z, sq, lr), { ...o, closed: true, shade: 0.5 });
    lines.polyline(circle(c, [0.707, 0, 0.707], sq, lr), { ...o, closed: true, shade: 0.3 });
    lines.polyline([[x, t.base, z], [x + lean * 0.3, cy - r * 0.86, z]], { ...o, shade: 0.85 });
  });

  return { lines: lines.build(), cypress: cypress.build(), olive: olive.build(), trunks: trunks.build() };
}

export { X as AXIS_X, Y as AXIS_Y, Z as AXIS_Z };
