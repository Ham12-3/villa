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

function inside(poly: [number, number][], x: number, z: number) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Splits a wall into the faces that look into a room and the rest. Partitions
 * are room faces all over; an exterior wall's are its inner face only, so its
 * outer face and the reveals of its openings stay masonry.
 */
function splitLining(g: THREE.BufferGeometry, wall: Wall, footprint: [number, number][]) {
  const src = g.index ? g.toNonIndexed() : g;
  const p = src.getAttribute('position');
  const f = wallFrame(wall.a, wall.b);
  const room: number[] = [];
  const rest: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    let lining = !wall.exterior;
    if (!lining) {
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const along = n.x * f.nx + n.z * f.nz;
      if (Math.abs(along) > 0.9) {
        const s = Math.sign(along) * 0.5;
        lining = inside(footprint, (a.x + b.x + c.x) / 3 + f.nx * s, (a.z + b.z + c.z) / 3 + f.nz * s);
      }
    }
    (lining ? room : rest).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  if (src !== g) src.dispose();
  const make = (arr: number[]) => {
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    out.computeVertexNormals();
    return out;
  };
  return { room: make(room), rest: make(rest) };
}

/**
 * All walls of a level merged into one solid and one edge-line geometry. With
 * a `footprint` (the level's plan outline) the faces that look into rooms
 * come back separately as `lining`, to take an interior finish.
 */
export function buildWalls(walls: Wall[], elevation: number, seed = 0, footprint?: [number, number][]) {
  const mesh = new MeshBuilder();
  const lining = new MeshBuilder();
  const lines = new LineBuilder();
  walls.forEach((w, i) => {
    // exterior walls lead, partitions follow; a little jitter keeps it organic
    const jitter = (((i + seed) * 7919) % 13) / 13;
    const delay = Math.min(1, (w.exterior ? 0 : 0.35) + jitter * 0.6);
    const g = wallGeometry(w, elevation);
    const o = { delay, origin: [0, elevation, 0] as [number, number, number] };
    lines.edges(g, o);
    if (footprint) {
      const parts = splitLining(g, w, footprint);
      g.dispose();
      if (parts.rest.getAttribute('position').count) mesh.add(parts.rest, o);
      if (parts.room.getAttribute('position').count) lining.add(parts.room, o);
    } else {
      mesh.add(g, o);
    }
  });
  return { solid: mesh.build(), lining: lining.build(), edges: lines.build() };
}
