import type { Railing } from '../../data/villa';
import { BoxInstancer, wallFrame } from './geo';

const POST = 0.05;
const SPACING = 1.5;

/** Slim post-and-rail balustrades. Everything is an instanced box. */
export function buildRailings(railings: Railing[]) {
  const boxes = new BoxInstancer();
  let total = 0;
  for (const r of railings) {
    for (let i = 1; i < r.path.length; i++) total += wallFrame(r.path[i - 1], r.path[i]).length;
  }

  let run = 0;
  for (const r of railings) {
    for (let i = 1; i < r.path.length; i++) {
      const f = wallFrame(r.path[i - 1], r.path[i]);
      const [mx, mz] = f.at(f.length / 2);
      const dm = (run + f.length / 2) / total;
      const origin: [number, number, number] = [mx, r.base, mz];

      // handrail + two tension wires
      boxes.add([mx, r.base + r.height, mz], [f.length + POST, 0.05, 0.08], f.rotY, { delay: dm, origin });
      for (const k of [0.36, 0.68]) {
        boxes.add([mx, r.base + r.height * k, mz], [f.length, 0.018, 0.018], f.rotY, { delay: dm, origin });
      }
      const n = Math.max(1, Math.round(f.length / SPACING));
      for (let k = 0; k <= n; k++) {
        const u = (k / n) * f.length;
        const [x, z] = f.at(u);
        boxes.add([x, r.base + r.height / 2, z], [POST, r.height, POST], f.rotY, {
          delay: (run + u) / total,
          origin: [x, r.base, z],
        });
      }
      run += f.length;
    }
  }
  return boxes.build();
}
