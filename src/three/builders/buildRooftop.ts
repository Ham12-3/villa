import { rooftop, type Opening, type Wall } from '../../data/villa';
import { BoxInstancer, LineBuilder, MeshBuilder, extrudePlan } from './geo';
import { wallGeometry } from './buildWalls';
import { buildWindows } from './buildWindows';

/** Tower walls derived from the rooftop data, each face with tall arches. */
export function towerWalls(): Wall[] {
  const t = rooftop.tower;
  const [x0, z0] = t.min;
  const [x1, z1] = t.max;
  const corners: [number, number][] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  return corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const openings: Opening[] = [];
    for (let k = 0; k < t.arch.perFace; k++) {
      openings.push({
        at: (len * (k + 1)) / (t.arch.perFace + 1),
        width: t.arch.width,
        height: t.arch.height,
        sill: t.arch.sill,
        type: 'arch',
      });
    }
    return { a, b, thickness: t.wallThickness, height: t.height - t.roofThickness, openings, exterior: true };
  });
}

/** Observatory tower: walls + cap slab (one growing solid) and its arched glazing. */
export function buildTower() {
  const t = rooftop.tower;
  const y0 = rooftop.elevation;
  const walls = towerWalls();
  const mesh = new MeshBuilder();
  const lines = new LineBuilder();
  const o = { origin: [0, y0, 0] as [number, number, number] };

  for (const w of walls) {
    const g = wallGeometry(w, y0);
    lines.edges(g, o);
    mesh.add(g, o);
  }
  const lip = 0.35;
  const cap = extrudePlan(
    [
      [t.min[0] - lip, t.min[1] - lip],
      [t.max[0] + lip, t.min[1] - lip],
      [t.max[0] + lip, t.max[1] + lip],
      [t.min[0] - lip, t.max[1] + lip],
    ],
    y0 + t.height,
    t.roofThickness,
  );
  lines.edges(cap, o);
  mesh.add(cap, o);

  const glazing = buildWindows([{ walls, elevation: y0 }]);
  return { solid: mesh.build(), edges: lines.build(), glass: glazing.glass, glassLines: glazing.glassLines };
}

/** Planter boxes on the roof, as instanced boxes. */
export function buildPlanters() {
  const boxes = new BoxInstancer();
  const y0 = rooftop.elevation;
  rooftop.planters.forEach((p, i) => {
    const cx = (p.min[0] + p.max[0]) / 2;
    const cz = (p.min[1] + p.max[1]) / 2;
    boxes.add([cx, y0 + p.height / 2, cz], [p.max[0] - p.min[0], p.height, p.max[1] - p.min[1]], 0, {
      delay: i / rooftop.planters.length,
      origin: [cx, y0, cz],
    });
  });
  return boxes.build();
}
