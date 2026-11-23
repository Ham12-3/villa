import { rooftop } from '../../data/villa';
import { BoxInstancer } from './geo';

/**
 * Rooftop pavilion: columns, two edge beams and a field of pergola beams.
 * Delay slots are ordered so the structure assembles itself: columns first,
 * then edge beams, then the beams one by one from west to east.
 */
export function buildPergola() {
  const p = rooftop.pavilion;
  const y0 = rooftop.elevation;
  const boxes = new BoxInstancer();
  const [x0, z0] = p.min;
  const [x1, z1] = p.max;
  const top = y0 + p.height;

  for (let i = 0; i < p.columnsX; i++) {
    const x = x0 + ((x1 - x0) * i) / (p.columnsX - 1);
    for (const z of [z0, z1]) {
      boxes.add([x, y0 + p.height / 2, z], [p.column, p.height, p.column], 0, {
        delay: (i / (p.columnsX - 1)) * 0.12,
      });
    }
  }

  const eb = p.edgeBeam;
  [z0, z1].forEach((z, k) => {
    boxes.add([(x0 + x1) / 2, top + eb.depth / 2, z], [x1 - x0 + 1.0, eb.depth, eb.width], 0, {
      delay: 0.16 + k * 0.05,
    });
  });

  const b = p.beam;
  const n = Math.floor((x1 - x0) / b.spacing);
  const start = (x0 + x1) / 2 - (n * b.spacing) / 2;
  for (let i = 0; i <= n; i++) {
    boxes.add(
      [start + i * b.spacing, top + eb.depth + b.depth / 2, (z0 + z1) / 2],
      [b.width, b.depth, z1 - z0 + b.overhang * 2],
      0,
      { delay: 0.26 + (i / n) * 0.74 },
    );
  }
  return boxes.build();
}
