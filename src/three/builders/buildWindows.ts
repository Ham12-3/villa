import * as THREE from 'three';
import type { Wall } from '../../data/villa';
import { BoxInstancer, LineBuilder, MeshBuilder, wallFrame, type P3 } from './geo';
import { buildArchPane } from './buildArches';

const BAR = 0.07;
const DEPTH = 0.14;

export interface WallSet {
  walls: Wall[];
  elevation: number;
}

/**
 * Fills every exterior opening: instanced frame bars + a glass pane for
 * windows and glazed facades, a shaped pane for arches, a leaf for doors.
 * Delay slots run level by level, and along each wall, for a staggered reveal.
 */
export function buildWindows(sets: WallSet[]) {
  const frames = new BoxInstancer();
  const glass = new MeshBuilder();
  const glassLines = new LineBuilder();

  sets.forEach((set, si) => {
    for (const w of set.walls) {
      if (!w.exterior) continue;
      const f = wallFrame(w.a, w.b);
      const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(f.ux, 0, f.uz),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-f.uz, 0, f.ux),
      );

      for (const o of w.openings) {
        const [x, z] = f.at(o.at);
        const y0 = set.elevation + o.sill;
        const h = Math.min(o.height, w.height - o.sill - 0.15);
        const cy = y0 + h / 2;
        const delay = Math.min(1, (si + o.at / f.length) / sets.length);
        const origin: P3 = [x, cy, z];
        const bar = (u: number, y: number, size: P3) => {
          const [bx, bz] = f.at(u);
          frames.add([bx, y, bz], size, f.rotY, { delay, origin });
        };

        if (o.type === 'arch') {
          const pane = buildArchPane(o.width, h);
          pane.applyMatrix4(basis.clone().setPosition(x, y0, z));
          const po = { delay, origin: [x, y0, z] as P3 };
          glassLines.edges(pane, po);
          // slim central mullion and springing-line transom
          const spring = y0 + h - o.width / 2;
          glassLines.segment([x, y0, z], [x, y0 + h, z], { ...po, shade: 0.7 });
          const [lx, lz] = f.at(o.at - o.width / 2);
          const [rx, rz] = f.at(o.at + o.width / 2);
          glassLines.segment([lx, spring, lz], [rx, spring, rz], { ...po, shade: 0.7 });
          glass.add(pane, po);
          continue;
        }

        // perimeter frame
        bar(o.at, y0 + BAR / 2, [o.width, BAR, DEPTH]);
        bar(o.at, y0 + h - BAR / 2, [o.width, BAR, DEPTH]);
        bar(o.at - o.width / 2 + BAR / 2, cy, [BAR, h, DEPTH]);
        bar(o.at + o.width / 2 - BAR / 2, cy, [BAR, h, DEPTH]);

        if (o.type === 'door') {
          bar(o.at, cy, [o.width - BAR * 2, h - BAR * 2, 0.06]);
          continue;
        }

        const panels = Math.max(1, Math.round(o.width / 1.9));
        for (let k = 1; k < panels; k++) {
          bar(o.at - o.width / 2 + (k * o.width) / panels, cy, [BAR * 0.7, h, DEPTH * 0.8]);
        }
        const pane = new THREE.PlaneGeometry(o.width - BAR, h - BAR);
        pane.deleteAttribute('uv');
        pane.applyMatrix4(basis.clone().setPosition(x, cy, z));
        glass.add(pane, { delay, origin: [x, y0, z] });
      }
    }
  });

  return { frames: frames.build(), glass: glass.build(), glassLines: glassLines.build() };
}
