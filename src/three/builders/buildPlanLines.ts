import type { Level, Stair, Wall } from '../../data/villa';
import { LineBuilder, wallFrame, type P3 } from './geo';

const LIFT = 0.04;

function arc(cx: number, cz: number, r: number, a0: number, a1: number, y: number, n = 12): P3[] {
  const pts: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
  }
  return pts;
}

function wallPlan(w: Wall, y: number, delay: number, main: LineBuilder, detail: LineBuilder) {
  const f = wallFrame(w.a, w.b);
  const e = w.exterior ? w.thickness / 2 : 0;
  const t = w.thickness / 2;
  const openings = [...w.openings].sort((p, q) => p.at - q.at);
  const P = (u: number, off: number): P3 => {
    const [x, z] = f.at(u, off);
    return [x, y, z];
  };

  // solid stretches between openings, drawn as closed poché rectangles
  let cursor = -e;
  const solid: [number, number][] = [];
  for (const o of openings) {
    solid.push([cursor, o.at - o.width / 2]);
    cursor = o.at + o.width / 2;
  }
  solid.push([cursor, f.length + e]);
  for (const [u0, u1] of solid) {
    if (u1 - u0 < 0.02) continue;
    main.polyline([P(u0, -t), P(u1, -t), P(u1, t), P(u0, t)], { closed: true, delay });
  }

  for (const o of openings) {
    const u0 = o.at - o.width / 2;
    const u1 = o.at + o.width / 2;
    const d = Math.min(1, delay + 0.08);
    if (o.type === 'window' || o.type === 'glass' || (o.type === 'arch' && w.exterior)) {
      // glazing: sill lines plus the pane on the centreline
      main.polyline([P(u0, -t), P(u1, -t)], { delay: d, shade: 0.55 });
      main.polyline([P(u0, t), P(u1, t)], { delay: d, shade: 0.55 });
      main.polyline([P(u0, 0), P(u1, 0)], { delay: d, shade: 0.9 });
    } else if (o.type === 'arch') {
      main.polyline([P(u0, 0), P(u1, 0)], { delay: d, shade: 0.35 });
    } else if (o.width > 3) {
      // overhead garage door
      detail.polyline([P(u0, -t), P(u1, -t)], { delay, shade: 0.5 });
      detail.polyline([P(u0, -t - 0.5), P(u1, -t - 0.5)], { delay, shade: 0.3 });
    } else {
      const s = o.swing ?? 1;
      const leaves = o.width > 1.5 ? 2 : 1;
      const lw = o.width / leaves;
      const base = Math.atan2(f.uz, f.ux);
      const normal = Math.atan2(f.ux * s, -f.uz * s);
      for (let k = 0; k < leaves; k++) {
        const hingeU = k === 0 ? u0 : u1;
        const [hx, hz] = f.at(hingeU, s * t);
        const closed = k === 0 ? base : base + Math.PI;
        // sweep from the closed position to 90 degrees open
        let open = normal;
        while (open - closed > Math.PI) open -= Math.PI * 2;
        while (open - closed < -Math.PI) open += Math.PI * 2;
        detail.polyline(arc(hx, hz, lw, closed, open, y), { delay, shade: 0.5 });
        detail.polyline(
          [
            [hx, y, hz],
            [hx + Math.cos(open) * lw, y, hz + Math.sin(open) * lw],
          ],
          { delay, shade: 0.9 },
        );
      }
    }
  }
}

function stairPlan(s: Stair, y: number, detail: LineBuilder) {
  const [dx, dz] = s.dir;
  const nx = -dz;
  const nz = dx;
  const hw = s.width / 2;
  const len = s.steps * s.run;
  const P = (u: number, off: number): P3 => [s.start[0] + dx * u + nx * off, y, s.start[1] + dz * u + nz * off];
  detail.polyline([P(0, -hw), P(len, -hw), P(len, hw), P(0, hw)], { closed: true, delay: 0.1, shade: 0.7 });
  for (let i = 1; i < s.steps; i++) {
    detail.polyline([P(i * s.run, -hw), P(i * s.run, hw)], { delay: 0.1 + (i / s.steps) * 0.6, shade: 0.4 });
  }
  // direction arrow
  detail.polyline([P(0.3, 0), P(len - 0.3, 0)], { delay: 0.5, shade: 0.8 });
  detail.polyline([P(len - 0.8, 0.3), P(len - 0.3, 0), P(len - 0.8, -0.3)], { delay: 0.8, shade: 0.8 });
}

export interface DimensionLabel {
  position: P3;
  text: string;
}

/**
 * 2D drawing of one level, laid flat on its slab:
 *  - main   : wall outlines, glazing and room boundaries
 *  - detail : door swings, stair treads and dimension lines
 */
export function buildPlanLines(level: Level, stairs: Stair[]) {
  const main = new LineBuilder();
  const detail = new LineBuilder();
  const y = level.elevation + LIFT;
  const dims: DimensionLabel[] = [];

  level.walls.forEach((w, i) => {
    wallPlan(w, y, (i / level.walls.length) * 0.85, main, detail);
  });

  // room boundaries sit on the wall centrelines like setting-out lines
  level.rooms.forEach((r, i) => {
    main.polyline(
      r.poly.map(([x, z]) => [x, y, z] as P3),
      { closed: true, delay: 0.5 + (i / level.rooms.length) * 0.5, shade: 0.22 },
    );
  });

  // slab edge so upper plans read against the floor below
  main.polyline(
    level.slab.poly.map(([x, z]) => [x, y, z] as P3),
    { closed: true, delay: 0, shade: 0.4 },
  );

  for (const s of stairs) {
    if (Math.abs(s.from - level.elevation) < 0.01) stairPlan(s, y, detail);
  }

  for (const d of level.dimensions) {
    const f = wallFrame(d.a, d.b);
    const P = (u: number, off: number): P3 => {
      const [x, z] = f.at(u, off);
      return [x, y, z];
    };
    const o = d.offset;
    const tick = 0.45;
    const sgn = Math.sign(o);
    detail.polyline([P(0, o), P(f.length, o)], { delay: 0.3, shade: 0.75 });
    for (const u of [0, f.length]) {
      detail.polyline([P(u, sgn * 0.6), P(u, o + sgn * 0.5)], { delay: 0.25, shade: 0.45 });
      detail.polyline([P(u - tick / 2, o - tick / 2), P(u + tick / 2, o + tick / 2)], { delay: 0.55, shade: 1 });
    }
    dims.push({ position: P(f.length / 2, o + sgn * 1.1), text: f.length.toFixed(2) });
  }

  return { main: main.build(), detail: detail.build(), dims };
}
