import * as THREE from 'three';
import type { Wall } from '../../data/villa';
import { LineBuilder, MeshBuilder, wallFrame } from './geo';
import { openingOutline } from './buildArches';

/**
 * One wall as a solid: its elevation is drawn as a 2D outline that steps
 * around every opening (door and glass openings notch the bottom edge,
 * windows become holes), then extruded by the wall thickness. No CSG needed.
 */
export function wallGeometry(wall: Wall, elevation: number): THREE.BufferGeometry {
  const f = wallFrame(wall.a, wall.b);
  const e = wall.exterior ? wall.thickness / 2 : 0; // close the corners
  const h = wall.height;
  const openings = [...wall.openings].sort((p, q) => p.at - q.at);

  const outline: THREE.Vector2[] = [new THREE.Vector2(-e, 0)];
  const holes: THREE.Path[] = [];

  for (const o of openings) {
    const pts = openingOutline(o.at, o.width, Math.min(o.height, h - o.sill - 0.15), o.sill, o.type === 'arch');
    if (o.sill <= 0.001) {
      // notch: walk up the left jamb, across the head, down the right jamb
      const l = pts[0];
      const r = pts[1];
      outline.push(new THREE.Vector2(l.x, 0));
      const head = pts.slice(2).reverse();
      outline.push(...head);
      outline.push(new THREE.Vector2(r.x, 0));
    } else {
      holes.push(new THREE.Path(pts));
    }
  }
  outline.push(new THREE.Vector2(f.length + e, 0), new THREE.Vector2(f.length + e, h), new THREE.Vector2(-e, h));

  const shape = new THREE.Shape(outline);
  shape.holes = holes;
  const g = new THREE.ExtrudeGeometry(shape, { depth: wall.thickness, bevelEnabled: false });
  g.deleteAttribute('uv');
  g.translate(0, 0, -wall.thickness / 2);

  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(f.ux, 0, f.uz),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-f.uz, 0, f.ux),
  );
  m.setPosition(wall.a[0], elevation, wall.a[1]);
  g.applyMatrix4(m);
  return g;
}

/** All walls of a level merged into one solid and one edge-line geometry. */
export function buildWalls(walls: Wall[], elevation: number, seed = 0) {
  const mesh = new MeshBuilder();
  const lines = new LineBuilder();
  walls.forEach((w, i) => {
    // exterior walls lead, partitions follow; a little jitter keeps it organic
    const jitter = (((i + seed) * 7919) % 13) / 13;
    const delay = Math.min(1, (w.exterior ? 0 : 0.35) + jitter * 0.6);
    const g = wallGeometry(w, elevation);
    const o = { delay, origin: [0, elevation, 0] as [number, number, number] };
    lines.edges(g, o);
    mesh.add(g, o);
  });
  return { solid: mesh.build(), edges: lines.build() };
}
