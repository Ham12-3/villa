import * as THREE from 'three';

export type P3 = [number, number, number];

/**
 * Every vertex in the scene carries the same small set of "reveal" attributes
 * so one shader can grow, drop, or draw any part of the villa:
 *  - aDelay  : 0..1 stagger slot inside its group
 *  - aOrigin : point the vertex grows from
 *  - aT      : 0..1 position along its polyline (lines only, for draw-on)
 *  - aShade  : brightness multiplier (lines only)
 */
export interface RevealOpts {
  delay?: number;
  origin?: P3;
  shade?: number;
}

export class LineBuilder {
  private pos: number[] = [];
  private t: number[] = [];
  private delay: number[] = [];
  private shade: number[] = [];
  private origin: number[] = [];

  get empty() {
    return this.pos.length === 0;
  }

  private push(p: P3, t: number, o: RevealOpts) {
    this.pos.push(p[0], p[1], p[2]);
    this.t.push(t);
    this.delay.push(o.delay ?? 0);
    this.shade.push(o.shade ?? 1);
    const og = o.origin ?? p;
    this.origin.push(og[0], og[1], og[2]);
  }

  segment(a: P3, b: P3, o: RevealOpts = {}, t0 = 0, t1 = 1) {
    this.push(a, t0, o);
    this.push(b, t1, o);
  }

  /** Polyline whose aT runs 0..1 along its length, so it can draw itself. */
  polyline(points: P3[], o: RevealOpts & { closed?: boolean } = {}) {
    const pts = o.closed ? [...points, points[0]] : points;
    if (pts.length < 2) return;
    const lens: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      lens.push(lens[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const total = lens[lens.length - 1] || 1;
    for (let i = 1; i < pts.length; i++) {
      this.segment(pts[i - 1], pts[i], o, lens[i - 1] / total, lens[i] / total);
    }
  }

  /** Hard edges of a mesh (the wireframe twin of every solid). */
  edges(geom: THREE.BufferGeometry, o: RevealOpts = {}, threshold = 20) {
    const e = new THREE.EdgesGeometry(geom, threshold);
    const p = e.getAttribute('position');
    for (let i = 0; i < p.count; i += 2) {
      this.segment(
        [p.getX(i), p.getY(i), p.getZ(i)],
        [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
        o,
        0,
        0,
      );
    }
    e.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(this.t, 1));
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(this.delay, 1));
    g.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shade, 1));
    g.setAttribute('aOrigin', new THREE.Float32BufferAttribute(this.origin, 3));
    return g;
  }
}

/** Merges many small geometries into one draw call. */
export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private delay: number[] = [];
  private origin: number[] = [];

  get empty() {
    return this.pos.length === 0;
  }

  /** Takes ownership of `geom` and disposes it. */
  add(geom: THREE.BufferGeometry, o: RevealOpts = {}) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const og = o.origin ?? [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.delay.push(o.delay ?? 0);
      this.origin.push(og[0], og[1], og[2]);
    }
    if (g !== geom) g.dispose();
    geom.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(this.delay, 1));
    g.setAttribute('aOrigin', new THREE.Float32BufferAttribute(this.origin, 3));
    return g;
  }
}

export interface BoxSet {
  count: number;
  matrices: Float32Array;
  delay: Float32Array;
  origin: Float32Array;
}

/**
 * Collects box-shaped parts (beams, posts, rails, frames, treads) so they can
 * be rendered as one InstancedMesh plus one instanced edge-line object.
 */
export class BoxInstancer {
  private m: number[] = [];
  private d: number[] = [];
  private o: number[] = [];
  private tmp = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  get count() {
    return this.d.length;
  }

  add(center: P3, size: P3, rotY = 0, o: RevealOpts = {}) {
    this.q.setFromAxisAngle(this.up, rotY);
    this.tmp.compose(
      new THREE.Vector3(center[0], center[1], center[2]),
      this.q,
      new THREE.Vector3(size[0], size[1], size[2]),
    );
    this.m.push(...this.tmp.elements);
    this.d.push(o.delay ?? 0);
    const og = o.origin ?? center;
    this.o.push(og[0], og[1], og[2]);
  }

  build(): BoxSet {
    return {
      count: this.count,
      matrices: new Float32Array(this.m),
      delay: new Float32Array(this.d),
      origin: new Float32Array(this.o),
    };
  }
}

/** Deterministic PRNG so the villa looks identical on every load. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Extrudes a plan polygon downwards from `top` by `thickness`. */
export function extrudePlan(
  poly: [number, number][],
  top: number,
  thickness: number,
  holes: [number, number][][] = [],
): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, top, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Local frame of a wall: u runs along it, n is its left normal. */
export function wallFrame(a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const ux = dx / length;
  const uz = dz / length;
  return {
    length,
    ux,
    uz,
    nx: -uz,
    nz: ux,
    /** rotation about Y that maps local +x onto the wall direction */
    rotY: Math.atan2(-uz, ux),
    at: (u: number, off = 0): [number, number] => [a[0] + ux * u - uz * off, a[1] + uz * u + ux * off],
  };
}
