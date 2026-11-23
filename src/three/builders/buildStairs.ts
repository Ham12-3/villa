import type { Stair } from '../../data/villa';
import { BoxInstancer } from './geo';

/** Straight flight: one instanced box per tread, revealed step by step. */
export function buildStairs(stair: Stair) {
  const boxes = new BoxInstancer();
  const rise = (stair.to - stair.from) / stair.steps;
  const rotY = Math.atan2(-stair.dir[1], stair.dir[0]);
  for (let i = 0; i < stair.steps; i++) {
    const u = (i + 0.5) * stair.run;
    const x = stair.start[0] + stair.dir[0] * u;
    const z = stair.start[1] + stair.dir[1] * u;
    const y = stair.from + (i + 0.5) * rise;
    boxes.add([x, y, z], [stair.run, rise, stair.width], rotY, {
      delay: i / (stair.steps - 1),
      origin: [x, y, z],
    });
  }
  return boxes.build();
}
