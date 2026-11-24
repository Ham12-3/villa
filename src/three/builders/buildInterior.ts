import * as THREE from 'three';
import { lamps, pieces, type InteriorMaterial } from '../../data/interior';
import { BoxInstancer, MeshBuilder, type BoxSet } from './geo';

/**
 * Furniture and lamps for the rooms the camera tours. Box-shaped pieces are
 * instanced per material; cylinders, spheres and the lamp globes are merged
 * into one mesh per material.
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
      boxesOf(p.material).add(p.c, p.s, p.rot ?? 0);
      continue;
    }
    const g = p.shape === 'cyl' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24) : new THREE.SphereGeometry(0.5, 20, 14);
    g.deleteAttribute('uv');
    g.scale(p.s[0], p.s[1], p.s[2]);
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
