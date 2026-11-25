import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { lamps, pieces, type InteriorMaterial } from '../../data/interior';
import { BoxInstancer, MeshBuilder, type BoxSet } from './geo';

/**
 * Edge radius (m) for box-shaped pieces, by material: upholstery is soft,
 * joinery and stone just lose their razor edge so they catch a highlight.
 * Materials not listed (floors, rugs, mirrors, lights) stay plain boxes.
 */
const EDGE: Partial<Record<InteriorMaterial, number>> = {
  fabric: 0.09,
  fabricDark: 0.07,
  ceramic: 0.03,
  stone: 0.02,
  wood: 0.012,
  dark: 0.012,
  accent: 0.07,
  marble: 0.008,
  marbleDark: 0.008,
  hedge: 0.3,
};

/**
 * A bowl standing on the floor (bath, basin, planter): outer wall, rounded
 * rim, inner wall and floor, as one lathe. Unit size; scaled to an oval.
 */
function tubGeometry() {
  const pts = [
    [0.0, 0.0], [0.4, 0.0], [0.455, 0.06], [0.485, 0.4], [0.5, 0.92], [0.495, 0.98], [0.475, 1.0],
    [0.455, 0.98], [0.44, 0.9], [0.41, 0.42], [0.34, 0.3], [0.0, 0.27],
  ].map(([r, y]) => new THREE.Vector2(r, y - 0.5));
  return new THREE.LatheGeometry(pts, 40);
}

/** A hanging curtain: a thin sheet with vertical folds, a little fuller at the hem. */
function curtainGeometry(width: number, height: number, depth: number) {
  const g = new THREE.BoxGeometry(width, height, 0.02, Math.max(8, Math.round(width * 26)), 6, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const hem = 0.65 + 0.35 * (0.5 - p.getY(i) / height);
    const fold = Math.sin(x * 21 + Math.sin(x * 5.3) * 1.4) * depth * hem;
    p.setZ(i, p.getZ(i) + fold);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Furniture and lamps for the rooms the camera tours. Plain box pieces are
 * instanced per material; soft-edged boxes, curtains, cylinders, spheres and
 * the lamp globes are merged into one mesh per material.
 */
export function buildInterior() {
  const boxSets = new Map<InteriorMaterial, BoxInstancer>();
  const roundSets = new Map<InteriorMaterial, MeshBuilder>();
  const boxesOf = (m: InteriorMaterial) => {
    let b = boxSets.get(m);
    if (!b) boxSets.set(m, (b = new BoxInstancer()));
    return b;
  };
  const roundOf = (m: InteriorMaterial) => {
    let b = roundSets.get(m);
    if (!b) roundSets.set(m, (b = new MeshBuilder()));
    return b;
  };

  for (const p of pieces) {
    if (p.shape === 'box') {
      const edge = EDGE[p.material];
      const thin = Math.min(p.s[0], p.s[1], p.s[2]);
      if ((!edge || thin < 0.08) && !p.tilt) {
        boxesOf(p.material).add(p.c, p.s, p.rot ?? 0);
        continue;
      }
      const radius = Math.min(edge ?? 0.004, thin * 0.42);
      const rb = new RoundedBoxGeometry(p.s[0], p.s[1], p.s[2], radius > 0.04 ? 4 : 2, radius);
      rb.deleteAttribute('uv');
      if (p.tilt) rb.rotateX(p.tilt);
      if (p.rot) rb.rotateY(p.rot);
      rb.translate(p.c[0], p.c[1], p.c[2]);
      roundOf(p.material).add(rb);
      continue;
    }
    if (p.shape === 'tub') {
      const tg = tubGeometry();
      tg.deleteAttribute('uv');
      tg.scale(p.s[0], p.s[1], p.s[2]);
      tg.computeVertexNormals();
      if (p.rot) tg.rotateY(p.rot);
      tg.translate(p.c[0], p.c[1], p.c[2]);
      roundOf(p.material).add(tg);
      continue;
    }
    if (p.shape === 'curtain') {
      const cg = curtainGeometry(p.s[0], p.s[1], p.s[2]);
      cg.deleteAttribute('uv');
      if (p.rot) cg.rotateY(p.rot);
      cg.translate(p.c[0], p.c[1], p.c[2]);
      roundOf(p.material).add(cg);
      continue;
    }
    const g =
      p.shape === 'cyl'
        ? new THREE.CylinderGeometry(0.5 * (p.taper ?? 1), 0.5, 1, 24)
        : new THREE.SphereGeometry(0.5, p.material === 'olive' || p.material === 'hedge' ? 10 : 20, p.material === 'olive' || p.material === 'hedge' ? 8 : 14);
    g.deleteAttribute('uv');
    g.scale(p.s[0], p.s[1], p.s[2]);
    if (p.tilt) g.rotateX(p.tilt);
    if (p.rot) g.rotateY(p.rot);
    g.translate(p.c[0], p.c[1], p.c[2]);
    roundOf(p.material).add(g);
  }

  for (const l of lamps) {
    const g = new THREE.SphereGeometry(l.radius, 16, 12);
    g.deleteAttribute('uv');
    g.translate(l.pos[0], l.pos[1], l.pos[2]);
    roundOf('glow').add(g);
    if (l.from !== undefined) {
      const top = l.pos[1] + l.radius;
      boxesOf('rail').add([l.pos[0], (top + l.from) / 2, l.pos[2]], [0.012, l.from - top, 0.012]);
    }
  }

  const boxes: [InteriorMaterial, BoxSet][] = [];
  for (const [m, b] of boxSets) boxes.push([m, b.build()]);
  const round: [InteriorMaterial, THREE.BufferGeometry][] = [];
  for (const [m, b] of roundSets) round.push([m, b.build()]);
  return { boxes, round };
}
