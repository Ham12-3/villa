import * as THREE from 'three';
import type { Tree } from '../../data/villa';
import { LineBuilder, MeshBuilder, rng, type P3 } from './geo';
import type { Spray } from '../foliage';

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
  // (leaf cards have their own sequence, so adding them moves no tree)
  const rs = rng(seed * 331 + 5);
  const sprays: Spray[] = [];

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
      const radial = 22;
      const rows = 40;
      const g = new THREE.CylinderGeometry(1, 1, 1, radial, rows, true);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const ty = p.getY(i) + 0.5;
        const a = Math.atan2(p.getZ(i), p.getX(i));
        // tight columns of foliage: broad lobes, with a finer ragged layer on top
        const rr =
          r *
          cypressProfile(ty) *
          (1 + 0.1 * sculpt(Math.cos(a) * 2, ty * 9, Math.sin(a) * 2, s) + 0.07 * sculpt(Math.cos(a) * 7, ty * 31, Math.sin(a) * 7, s + 3));
        p.setXYZ(i, x + Math.cos(a) * rr, skirt + ty * h, z + Math.sin(a) * rr);
      }
      g.computeVertexNormals();
      g.deleteAttribute('uv');
      cypress.add(g, o);

      // upswept sprays all over the column
      for (let q = 0; q < 380; q++) {
        const ty = 0.03 + rs() * 0.95;
        const a = rs() * Math.PI * 2;
        const rr = r * cypressProfile(ty) * 0.98;
        sprays.push({
          p: [x + Math.cos(a) * rr, skirt + ty * h, z + Math.sin(a) * rr],
          n: [Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8],
          out: [Math.cos(a) * 0.92, 0.39, Math.sin(a) * 0.92],
          size: 0.5 + rs() * 0.45,
          kind: 'cypress',
        });
      }

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
    const lean = (rand() - 0.5) * 0.3;
    const th = cy - r * 0.35 - t.base;
    const fork: P3 = [x + lean * 0.3, t.base + th, z];

    // a tapered limb between two points
    const limb = (a: P3, b: P3, ra: number, rb: number) => {
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = dir.length();
      const lg = new THREE.CylinderGeometry(rb, ra, len, 7, 1);
      lg.deleteAttribute('uv');
      lg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
      lg.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      trunks.add(lg, o);
    };

    // short, thick, slightly twisted trunk in two lifts, then four or five boughs
    const knee: P3 = [x + lean * 0.5 + (rand() - 0.5) * 0.16 * r, t.base + th * 0.4, z + (rand() - 0.5) * 0.18 * r];
    const hip: P3 = [x + lean * 0.1 + (rand() - 0.5) * 0.16 * r, t.base + th * 0.75, z + (rand() - 0.5) * 0.16 * r];
    limb([x, t.base - 0.05, z], knee, 0.075 * r + 0.06, 0.06 * r + 0.045);
    limb(knee, hip, 0.06 * r + 0.045, 0.05 * r + 0.035);
    limb(hip, fork, 0.05 * r + 0.035, 0.045 * r + 0.03);
    const boughs = 4 + Math.floor(rand() * 2);
    const tips: P3[] = [];
    for (let k = 0; k < boughs; k++) {
      const a = (k / boughs) * Math.PI * 2 + rand() * 0.9;
      const reach = r * (0.42 + rand() * 0.2);
      const tip: P3 = [fork[0] + Math.cos(a) * reach, cy + r * (-0.12 + rand() * 0.3), fork[2] + Math.sin(a) * reach];
      limb(fork, tip, 0.04 * r + 0.025, 0.015 * r + 0.01);
      tips.push(tip);
    }

    // crown: many small clumps of foliage gathered round the bough ends, so the
    // outline is broken and the sky shows through between them. Normals lean
    // towards the crown's own outward direction, which lights it as one mass.
    const centre = new THREE.Vector3(x + lean * 0.3, cy + r * 0.08, z);
    const clumps = Math.round(40 + r * 11);
    for (let k = 0; k < clumps; k++) {
      const tip = tips[k % tips.length];
      const ca = rand() * Math.PI * 2;
      const cr = Math.sqrt(rand()) * r * 0.5;
      const px = tip[0] + Math.cos(ca) * cr;
      const pz = tip[2] + Math.sin(ca) * cr;
      // keep inside a flattened dome over the fork
      const dx = (px - centre.x) / (r * 1.05);
      const dz = (pz - centre.z) / (r * 1.05);
      const dome = Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz));
      const py = cy - r * 0.3 + rand() * (0.3 + dome * 0.75) * r;
      const size = r * (0.17 + rand() * 0.15);
      const g = new THREE.SphereGeometry(size, 12, 9);
      const p = g.getAttribute('position');
      const sk = s + k * 1.7;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i);
        const vy = p.getY(i);
        const vz = p.getZ(i);
        const d =
          1 +
          0.28 * sculpt((vx / size) * 2.2, (vy / size) * 2.2, (vz / size) * 2.2, sk) +
          0.16 * sculpt((vx / size) * 6.1, (vy / size) * 6.1, (vz / size) * 6.1, sk + 9);
        p.setXYZ(i, px + vx * d, py + vy * d * 0.8, pz + vz * d);
      }
      g.computeVertexNormals();
      const n = g.getAttribute('normal');
      const out = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        out.set(p.getX(i) - centre.x, (p.getY(i) - (cy - r * 0.2)) * 1.3, p.getZ(i) - centre.z).normalize();
        out.multiplyScalar(0.6).add(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).multiplyScalar(0.4)).normalize();
        n.setXYZ(i, out.x, out.y, out.z);
      }
      g.deleteAttribute('uv');
      olive.add(g, o);

      // sprays of leaves standing off the clump, those facing into the crown left out
      for (let q = 0; q < 12; q++) {
        const u = rs() * 2 - 1;
        const a2 = rs() * Math.PI * 2;
        const sq = Math.sqrt(1 - u * u);
        const dir: P3 = [sq * Math.cos(a2), u, sq * Math.sin(a2)];
        const pos: P3 = [px + dir[0] * size * 0.92, py + dir[1] * size * 0.74, pz + dir[2] * size * 0.92];
        out.set(pos[0] - centre.x, (pos[1] - (cy - r * 0.2)) * 1.3, pos[2] - centre.z).normalize();
        const spread = rs();
        if (dir[0] * out.x + dir[1] * out.y + dir[2] * out.z < -0.25) continue;
        sprays.push({ p: pos, n: dir, out: [out.x, out.y, out.z], size: Math.max(0.34, size * (1.25 + spread * 0.7)), kind: 'olive' });
      }
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

  return { lines: lines.build(), cypress: cypress.build(), olive: olive.build(), trunks: trunks.build(), sprays };
}

export { X as AXIS_X, Y as AXIS_Y, Z as AXIS_Z };
