import * as THREE from 'three';
import { rng, type P3 } from './builders/geo';
import { joinSweep } from './furniture';

/**
 * Leaves for the trees. The sculpted crowns from buildTrees give each tree its
 * mass and its shadow; on top of them sit thousands of small cards, each a
 * spray of leaves with see-through gaps, which is what makes the outline of a
 * tree read as foliage rather than as a solid.
 */
export interface Spray {
  /** centre of the card */
  p: P3;
  /** the way the card faces */
  n: P3;
  /** outward direction of the whole crown at this point (used for lighting) */
  out: P3;
  /** edge length, metres */
  size: number;
  kind: 'olive' | 'cypress';
}

/** A spray of narrow leaves on a transparent ground, drawn once on a canvas. */
export function leafTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(4711);
  const leaf = (x: number, y: number, len: number, angle: number, light: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = `hsl(${78 + rand() * 16}, ${10 + rand() * 9}%, ${light}%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, len * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // midrib
    ctx.strokeStyle = `hsla(80, 12%, ${light + 12}%, 0.7)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2, 0);
    ctx.stroke();
    ctx.restore();
  };
  // twigs fanning out from the middle, leaves in pairs along each
  for (let t = 0; t < 22; t++) {
    const a = (t / 22) * Math.PI * 2 + rand() * 0.5;
    const reach = size * (0.26 + rand() * 0.2);
    const steps = 8 + Math.floor(rand() * 5);
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const bend = a + (rand() - 0.5) * 0.5 * f;
      const x = size / 2 + Math.cos(bend) * reach * f;
      const y = size / 2 + Math.sin(bend) * reach * f;
      const len = size * (0.05 + rand() * 0.035);
      // darker deep in the spray, paler (silver) at the tips
      const light = 36 + f * 20 + rand() * 12;
      leaf(x, y, len, bend + 0.75 + rand() * 0.4, light);
      leaf(x, y, len, bend - 0.75 - rand() * 0.4, light - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** One quad per spray, merged. Lit by the crown's outward direction, so a tree shades as one form. */
export function buildLeafCards(sprays: Spray[]): THREE.BufferGeometry {
  const rand = rng(90210);
  const pos = new Float32Array(sprays.length * 18);
  const nor = new Float32Array(sprays.length * 18);
  const uv = new Float32Array(sprays.length * 12);
  const col = new Float32Array(sprays.length * 18);
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const b = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(1, 0, 0);
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  sprays.forEach((s, i) => {
    // face outwards, tilted a little every which way
    n.set(s.n[0] + (rand() - 0.5) * 0.9, s.n[1] + (rand() - 0.5) * 0.9, s.n[2] + (rand() - 0.5) * 0.9).normalize();
    t.crossVectors(Math.abs(n.y) > 0.9 ? side : up, n).normalize();
    b.crossVectors(n, t);
    const roll = rand() * Math.PI * 2;
    const cr = Math.cos(roll) * s.size * 0.5;
    const sr = Math.sin(roll) * s.size * 0.5;
    // shading normal: mostly the crown's, a little of the card's own
    const lx = s.out[0] * 0.75 + n.x * 0.25;
    const ly = s.out[1] * 0.75 + n.y * 0.25;
    const lz = s.out[2] * 0.75 + n.z * 0.25;
    const tone = 0.78 + rand() * 0.34;
    const tint = s.kind === 'olive' ? [0.86 * tone, 0.96 * tone, 0.84 * tone] : [0.3 * tone, 0.46 * tone, 0.3 * tone];
    corners.forEach(([cx, cy], k) => {
      const ax = cx * cr - cy * sr;
      const ay = cx * sr + cy * cr;
      v.set(s.p[0], s.p[1], s.p[2]).addScaledVector(t, ax).addScaledVector(b, ay);
      const o = i * 18 + k * 3;
      pos[o] = v.x;
      pos[o + 1] = v.y;
      pos[o + 2] = v.z;
      nor[o] = lx;
      nor[o + 1] = ly;
      nor[o + 2] = lz;
      col[o] = tint[0];
      col[o + 1] = tint[1];
      col[o + 2] = tint[2];
      uv[i * 12 + k * 2] = cx * 0.5 + 0.5;
      uv[i * 12 + k * 2 + 1] = cy * 0.5 + 0.5;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Cut-out leaves that arrive with the same materialisation front as everything else. */
export function makeLeafMaterial(map: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    vertexColors: true,
  });
  joinSweep(m);
  m.customProgramCacheKey = () => 'villa-leaves';
  return m;
}
