import * as THREE from 'three';
import { site, type Vec2 } from '../../data/villa';
import { LineBuilder, MeshBuilder, extrudePlan, type P3 } from './geo';
import { AXIS_X, AXIS_Z, circle } from './buildTrees';

const Y = 0.035;
const up = (poly: Vec2[], y = Y): P3[] => poly.map(([x, z]) => [x, y, z]);

const inset = (poly: Vec2[], d: number): Vec2[] => {
  // rectangles only — good enough for the pool coping
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  const x0 = Math.min(...xs) + d;
  const x1 = Math.max(...xs) - d;
  const z0 = Math.min(...zs) + d;
  const z1 = Math.max(...zs) - d;
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
};

/** Site plan linework: plot, driveway, terrace, pool, gardens, tree symbols. */
export function buildSiteLines() {
  const lb = new LineBuilder();

  lb.polyline(up(site.plot), { closed: true, delay: 0 });
  lb.polyline(up(inset(site.plot, 0.8)), { closed: true, delay: 0.05, shade: 0.3 });

  lb.polyline(up(site.driveway), { closed: true, delay: 0.15, shade: 0.7 });
  // paving joints across the forecourt
  for (let x = 2; x < 26; x += 4) {
    lb.polyline(up([[x, -21], [x, -12.6]]), { delay: 0.2 + x * 0.004, shade: 0.18 });
  }

  lb.polyline(up(site.deck), { closed: true, delay: 0.3, shade: 0.75 });
  for (let z = 4.5; z < 17; z += 3) {
    lb.polyline(up([[-6, z], [26, z]]), { delay: 0.34, shade: 0.12 });
  }

  const pool = site.pool.poly;
  lb.polyline(up(inset(pool, -site.pool.coping)), { closed: true, delay: 0.45 });
  lb.polyline(up(pool), { closed: true, delay: 0.48 });
  // water hatching
  const [px0, pz0] = pool[0];
  const [px1, pz1] = pool[2];
  for (let i = 1; i < 6; i++) {
    const z = pz0 + ((pz1 - pz0) * i) / 6;
    // regular, alternating hatch: reads as water without looking hand-drawn
    const a = px0 + (i % 2 ? 2.5 : 5);
    const b = px1 - (i % 2 ? 5 : 2.5);
    lb.polyline(up([[a, z], [b, z]]), { delay: 0.5 + i * 0.01, shade: 0.28 });
  }
  // entry steps
  for (let i = 0; i < 3; i++) {
    lb.polyline(up([[px0 + 0.6 + i * 0.5, pz0], [px0 + 0.6 + i * 0.5, pz0 + 2.4]]), { delay: 0.52, shade: 0.4 });
  }

  site.gardens.forEach((g, i) => lb.polyline(up(g), { closed: true, delay: 0.55 + i * 0.03, shade: 0.5 }));
  site.paths.forEach((p, i) => lb.polyline(up(p), { delay: 0.62 + i * 0.03, shade: 0.4 }));

  // plan symbol for each garden tree: a cloud loop and a centre cross
  site.trees.forEach((t, i) => {
    const [x, z] = t.pos;
    const delay = 0.7 + (i / site.trees.length) * 0.3;
    lb.polyline(circle([x, Y, z], AXIS_X, AXIS_Z, t.radius), { closed: true, delay, shade: 0.55 });
    if (t.kind === 'olive') {
      lb.polyline(circle([x, Y, z], AXIS_X, AXIS_Z, t.radius * 0.55, 32), { closed: true, delay, shade: 0.22 });
    }
    lb.polyline(up([[x - 0.3, z], [x + 0.3, z]]), { delay, shade: 0.6 });
    lb.polyline(up([[x, z - 0.3], [x, z + 0.3]]), { delay, shade: 0.6 });
  });

  // north arrow, just outside the plot (north is up the sheet)
  const [nx, nz] = [44, 22];
  const ring: P3[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ring.push([nx + Math.cos(a) * 1.5, Y, nz + Math.sin(a) * 1.5]);
  }
  lb.polyline(ring, { closed: true, delay: 0.9, shade: 0.6 });
  lb.polyline(up([[nx, nz + 1.5], [nx, nz - 2.3]]), { delay: 0.92, shade: 0.9 });
  lb.polyline(up([[nx - 0.6, nz - 1.2], [nx, nz - 2.3], [nx + 0.6, nz - 1.2]]), { delay: 0.95, shade: 0.9 });

  return lb.build();
}

/** Landscape solids, only really visible once the model materialises. */
export function buildSiteSolids() {
  const pool = site.pool.poly;
  const coping = inset(pool, -site.pool.coping);

  const ground = new MeshBuilder();
  ground.add(extrudePlan(site.plot, -0.09, 1.5, [pool]));

  const paving = new MeshBuilder();
  paving.add(extrudePlan(site.deck, -0.012, 0.08, [coping]));
  // pool coping, a touch proud of the deck
  paving.add(extrudePlan(coping, 0.03, 0.14, [pool]));

  const drive = new MeshBuilder();
  drive.add(extrudePlan(site.driveway, -0.04, 0.06));

  const lawn = new MeshBuilder();
  for (const g of site.gardens) lawn.add(extrudePlan(g, -0.03, 0.07));

  const tile = new MeshBuilder();
  tile.add(extrudePlan(pool, -site.pool.depth, 0.2));

  const water = new MeshBuilder();
  const w = new THREE.PlaneGeometry(pool[2][0] - pool[0][0], pool[2][1] - pool[0][1]);
  w.rotateX(-Math.PI / 2);
  w.translate((pool[0][0] + pool[2][0]) / 2, -0.16, (pool[0][1] + pool[2][1]) / 2);
  w.deleteAttribute('uv');
  water.add(w);

  // the plinth edge reads as a model base in the 3/4 views
  const baseEdges = new LineBuilder();
  const base = extrudePlan(site.plot, -0.09, 1.5);
  baseEdges.edges(base, { shade: 0.5 });
  base.dispose();

  return {
    ground: ground.build(),
    paving: paving.build(),
    drive: drive.build(),
    lawn: lawn.build(),
    tile: tile.build(),
    water: water.build(),
    baseEdges: baseEdges.build(),
  };
}

/** Faint construction grid with brighter majors every 10 m. */
export function buildGrid(extent = 110, step = 2) {
  const lb = new LineBuilder();
  for (let v = -extent; v <= extent; v += step) {
    const major = Math.abs(v % 10) < 0.001;
    const shade = major ? 1 : 0.38;
    lb.segment([v, 0.01, -extent], [v, 0.01, extent], { shade }, 0, 0);
    lb.segment([-extent, 0.01, v], [extent, 0.01, v], { shade }, 0, 0);
  }
  return lb.build();
}
