import type { Slab } from '../../data/villa';
import { LineBuilder, MeshBuilder, extrudePlan, type RevealOpts } from './geo';

/** Floor / roof slabs: extruded plan polygons (with optional voids). */
export function buildSlabs(slabs: Slab[], opts: RevealOpts[] = []) {
  const mesh = new MeshBuilder();
  const lines = new LineBuilder();
  slabs.forEach((s, i) => {
    const g = extrudePlan(s.poly, s.top, s.thickness, s.holes);
    const o = { origin: [0, s.top, 0] as [number, number, number], ...opts[i] };
    lines.edges(g, o);
    mesh.add(g, o);
  });
  return { solid: mesh.build(), edges: lines.build() };
}
