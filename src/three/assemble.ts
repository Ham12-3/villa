import * as THREE from 'three';
import {
  levels,
  railings,
  rooftop,
  site,
  stairs,
  terraces,
} from '../data/villa';
import { clamp01, debug, env, intro, rig, type State } from '../animation/state';
import {
  makeLineMaterial,
  makeSolidMaterial,
  type LineMaterial,
  type RevealConfig,
  type SolidKind,
  type SolidMaterial,
} from './materials';
import { type BoxSet, type P3 } from './builders/geo';
import { buildPlanLines } from './builders/buildPlanLines';
import { buildWalls } from './builders/buildWalls';
import { buildSlabs } from './builders/buildSlabs';
import { buildStairs } from './builders/buildStairs';
import { buildWindows } from './builders/buildWindows';
import { buildRailings } from './builders/buildRailings';
import { buildPergola } from './builders/buildPergola';
import { buildTrees } from './builders/buildTrees';
import { buildGrid, buildSiteLines, buildSiteSolids } from './builders/buildSite';
import { buildPlanters, buildTower } from './builders/buildRooftop';
import { buildInterior } from './builders/buildInterior';
import { glassClear } from '../data/tour';
import { buildLeafCards, leafTexture, makeLeafMaterial } from './foliage';

type Num = (s: State) => number;

const ramp = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface RoomLabel {
  position: P3;
  name: string;
  note?: string;
  level: number;
}

export interface VillaModel {
  root: THREE.Group;
  /** push the animation state into every uniform; called once per frame */
  update: (s: State) => void;
  dispose: () => void;
  labels: {
    rooms: RoomLabel[];
    dims: { position: P3; text: string }[];
  };
  stats: { drawCalls: number; triangles: number };
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitBoxEdges = new THREE.EdgesGeometry(unitBox);

interface PartOptions {
  reveal?: RevealConfig;
  /** 0..1 build progress (grow / drop / slide) */
  prog?: Num;
  /** 0..1 pen progress for self-drawing lines */
  draw?: Num;
  /** line opacity, before the global line fade */
  opacity?: Num;
  /** exempt from the global fade applied when the model materialises */
  keepLines?: boolean;
  drawStagger?: number;
  fadeRadius?: number;
  shadows?: boolean;
  /** 0..1 opacity of the solids (only meaningful for transparent materials) */
  fade?: Num;
  /** hide solids until this returns true */
  solidWhen?: (s: State) => boolean;
}

/**
 * Builds every geometry group of the villa, in small async steps so the
 * loading screen can show real progress, and returns one `update(state)`.
 */
export async function assembleVilla(onProgress: (p: number, label: string) => void): Promise<VillaModel> {
  const root = new THREE.Group();
  const drivers: ((s: State) => void)[] = [];
  const disposables: { dispose: () => void }[] = [];
  let triangles = 0;

  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  /** One animated group: any mix of merged solid, instanced boxes and lines. */
  const part = (
    content: {
      solids?: [THREE.BufferGeometry, SolidKind][];
      boxes?: [BoxSet, SolidKind];
      lines?: THREE.BufferGeometry;
    },
    o: PartOptions = {},
  ) => {
    const solidMats: SolidMaterial[] = [];
    const lineMats: LineMaterial[] = [];
    const solidObjs: THREE.Object3D[] = [];
    const lineObjs: THREE.Object3D[] = [];
    const shadows = o.shadows ?? true;

    for (const [geom, kind] of content.solids ?? []) {
      if (!geom.getAttribute('position')?.count) continue;
      const mat = track(makeSolidMaterial(kind, o.reveal, env.mobile || debug.noTransmission));
      const mesh = new THREE.Mesh(track(geom), mat);
      mesh.castShadow = shadows && kind !== 'glass' && kind !== 'water';
      mesh.receiveShadow = shadows;
      mesh.renderOrder = kind === 'glass' || kind === 'water' ? 2 : 0;
      triangles += geom.getAttribute('position').count / 3;
      solidMats.push(mat);
      solidObjs.push(mesh);
    }

    if (content.boxes && content.boxes[0].count > 0) {
      const [set, kind] = content.boxes;
      const mat = track(makeSolidMaterial(kind, o.reveal, env.mobile || debug.noTransmission));
      const geom = track(unitBox.clone());
      geom.setAttribute('aDelay', new THREE.InstancedBufferAttribute(set.delay, 1));
      geom.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(set.origin, 3));
      const mesh = new THREE.InstancedMesh(geom, mat, set.count);
      mesh.instanceMatrix.array.set(set.matrices);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      triangles += set.count * 12;
      solidMats.push(mat);
      solidObjs.push(mesh);

      // instanced wireframe twin
      const eg = track(new THREE.InstancedBufferGeometry());
      eg.setAttribute('position', unitBoxEdges.getAttribute('position'));
      eg.setAttribute('aInstanceMatrix', new THREE.InstancedBufferAttribute(set.matrices, 16));
      eg.setAttribute('aDelay', new THREE.InstancedBufferAttribute(set.delay, 1));
      eg.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(set.origin, 3));
      eg.instanceCount = set.count;
      const lm = track(makeLineMaterial({ ...o.reveal, instanced: true, keep: o.keepLines }));
      lineMats.push(lm);
      lineObjs.push(new THREE.LineSegments(eg, lm));
    }

    if (content.lines && content.lines.getAttribute('position')?.count) {
      const lm = track(
        makeLineMaterial({ ...o.reveal, drawStagger: o.drawStagger, fadeRadius: o.fadeRadius, keep: o.keepLines }),
      );
      lineMats.push(lm);
      lineObjs.push(new THREE.LineSegments(track(content.lines), lm));
    }

    for (const obj of [...solidObjs, ...lineObjs]) {
      obj.frustumCulled = false;
      obj.matrixAutoUpdate = false;
      obj.visible = false;
      root.add(obj);
    }

    drivers.push((s) => {
      const p = o.prog ? o.prog(s) : 1;
      const d = o.draw ? o.draw(s) : 1;
      const a = o.opacity ? o.opacity(s) : 1;
      const built = p > 0.0005;
      const fade = o.fade ? o.fade(s) : 1;
      const solidOn = built && fade > 0.003 && (!o.solidWhen || o.solidWhen(s));
      for (const m of solidMats) {
        m.userData.u.uProg.value = p;
        m.userData.u.uFade.value = fade;
      }
      for (const obj of solidObjs) obj.visible = solidOn;
      // once the sweep has passed, swept linework is fully gone: skip the draw
      const linesOn = built && d > 0.0005 && a > 0.004 && (o.keepLines || s.mat < 0.999);
      for (const m of lineMats) {
        m.uniforms.uProg.value = p;
        m.uniforms.uDraw.value = d;
        m.uniforms.uOpacity.value = a;
      }
      for (const obj of lineObjs) obj.visible = linesOn;
    });
  };

  const steps: [string, () => void][] = [];
  const step = (label: string, fn: () => void) => steps.push([label, fn]);

  const rooms: RoomLabel[] = [];
  const dims: { position: P3; text: string }[] = [];

  // ---------------------------------------------------------------- site
  step('Setting out the site', () => {
    part({ lines: buildGrid() }, { opacity: (s) => Math.max(s.grid, intro.v * 0.5) * s.gridFade * 0.075, keepLines: true, fadeRadius: 92 });
    part({ lines: buildSiteLines() }, { draw: (s) => s.site, opacity: (s) => s.siteFade, drawStagger: 1.4 });

    const land = buildSiteSolids();
    part(
      {
        solids: [
          [land.ground, 'ground'],
          [land.paving, 'paving'],
          [land.drive, 'drive'],
          [land.lawn, 'lawn'],
          [land.tile, 'tile'],
          [land.water, 'water'],
        ],
        lines: land.baseEdges,
      },
      { opacity: (s) => s.slab0 * 0.7, solidWhen: (s) => s.mat > 0.0005 },
    );
  });

  // ---------------------------------------------------------------- levels
  levels.forEach((level, i) => {
    const planKey = `plan${i}` as 'plan0';
    const fadeKey = `planFade${i}` as 'planFade0';
    const slabKey = `slab${i}` as 'slab0';
    const wallKey = `walls${i}` as 'walls0';

    step(`Drawing the ${level.name.toLowerCase()} plan`, () => {
      const plan = buildPlanLines(level, stairs);
      part({ lines: plan.main }, { draw: (s) => s[planKey], opacity: (s) => s[fadeKey], drawStagger: 1.6 });
      part(
        { lines: plan.detail },
        i === 0
          ? { draw: (s) => s.detail0, opacity: (s) => s.detailFade0, drawStagger: 1.2 }
          : { draw: (s) => s[planKey], opacity: (s) => s[fadeKey] * 0.8, drawStagger: 1.2 },
      );
      dims.push(...plan.dims);
      for (const r of level.rooms) {
        const cx = r.poly.reduce((a, p) => a + p[0], 0) / r.poly.length;
        const cz = r.poly.reduce((a, p) => a + p[1], 0) / r.poly.length;
        rooms.push({ position: [cx, level.elevation + 0.1, cz], name: r.name, note: r.note, level: i });
      }
    });

    step(`Raising the ${level.name.toLowerCase()}`, () => {
      const slab = buildSlabs([level.slab]);
      part(
        { solids: [[slab.solid, 'slab']], lines: slab.edges },
        { reveal: { drop: i === 0 ? [0, 0, 0] : [0, 9, 0] }, prog: (s) => s[slabKey] },
      );
      // the ground floor is masonry outside and limewashed plaster inside
      const walls = buildWalls(level.walls, level.elevation, i * 5, i === 0 ? level.slab.poly : undefined);
      part(
        {
          solids: [
            [walls.solid, i === 0 ? 'stone' : 'render'],
            [walls.lining, 'plaster'],
          ],
          lines: walls.edges,
        },
        { reveal: { growAxis: [0, 1, 0], stagger: 0.9 }, prog: (s) => s[wallKey] },
      );
    });
  });

  // ---------------------------------------------------------------- stairs
  step('Setting the stairs', () => {
    stairs.forEach((st, k) => {
      const key = `stairs${k}` as 'stairs0';
      part(
        { boxes: [buildStairs(st), 'slab'] },
        { reveal: { drop: [0, 1.4, 0], stagger: 4 }, prog: (s) => s[key] },
      );
    });
  });

  // ---------------------------------------------------------------- openings
  step('Glazing the openings', () => {
    const w = buildWindows(levels.map((l) => ({ walls: l.walls, elevation: l.elevation })));
    part({ boxes: [w.frames, 'frame'] }, { reveal: { growAxis: [1, 1, 1], stagger: 2.2 }, prog: (s) => s.frames });
    part(
      { solids: [[w.glass, 'glass']], lines: w.glassLines },
      // the panes clear while the camera tours (it passes through the glazing
      // three times) and return for the last look back at the house
      { reveal: { growAxis: [0, 1, 0], stagger: 2.2 }, prog: (s) => s.glass, shadows: false, fade: () => 1 - ramp(glassClear.out[0], glassClear.out[1], rig.at) + ramp(glassClear.back[0], glassClear.back[1], rig.at) },
    );
  });

  step('Cantilevering the terraces', () => {
    terraces.forEach((t, k) => {
      const slab = buildSlabs([t]);
      part(
        { solids: [[slab.solid, 'slab']], lines: slab.edges },
        { reveal: { drop: t.slide }, prog: (s) => clamp01(s.terraces * 1.6 - k * 0.6) },
      );
    });
    part(
      { boxes: [buildRailings(railings), 'rail'] },
      { reveal: { growAxis: [0, 1, 0], stagger: 2.4 }, prog: (s) => s.railings },
    );
  });

  // ---------------------------------------------------------------- rooftop
  step('Building the rooftop pavilion', () => {
    const roof = buildSlabs([rooftop.slab]);
    part({ solids: [[roof.solid, 'slab']], lines: roof.edges }, { reveal: { drop: [0, 9, 0] }, prog: (s) => s.roof });

    const tower = buildTower();
    part(
      { solids: [[tower.solid, 'render']], lines: tower.edges },
      { reveal: { growAxis: [0, 1, 0] }, prog: (s) => s.tower },
    );
    part(
      { solids: [[tower.glass, 'glass']], lines: tower.glassLines },
      { reveal: { growAxis: [0, 1, 0], stagger: 1 }, prog: (s) => s.towerGlass, shadows: false },
    );

    part({ boxes: [buildPergola(), 'wood'] }, { reveal: { drop: [0, 5, 0], stagger: 5 }, prog: (s) => s.pergola });
    part(
      { boxes: [buildPlanters(), 'stone'] },
      { reveal: { growAxis: [0, 1, 0], stagger: 1 }, prog: (s) => s.roofDetails },
    );
    part(
      { boxes: [buildRailings([rooftop.parapet]), 'rail'] },
      { reveal: { growAxis: [0, 1, 0], stagger: 2 }, prog: (s) => s.roofDetails },
    );
  });

  // ---------------------------------------------------------------- interior
  step('Furnishing the rooms', () => {
    // Furniture is not part of the drawing: it exists once the building starts
    // to materialise, and is lit up by the same sweep as everything else.
    const inside = buildInterior();
    const built: Num = (s) => (s.mat > 0.001 ? 1 : 0);
    // lights, lamp shades, glass and sheers throw no shadow
    const shadowless = new Set<SolidKind>(['glow', 'shade', 'screen', 'sheer', 'fire']);
    for (const [kind, set] of inside.boxes) {
      part({ boxes: [set, kind] }, { prog: built, opacity: () => 0, shadows: !shadowless.has(kind) });
    }
    for (const [kind, geom] of inside.round) {
      part({ solids: [[geom, kind]] }, { prog: built, shadows: !shadowless.has(kind) });
    }
  });

  step('Planting the trees', () => {
    const roofTrees = buildTrees(rooftop.trees, 3);
    part(
      { solids: [[roofTrees.cypress, 'cypress'], [roofTrees.olive, 'olive'], [roofTrees.trunks, 'trunk']], lines: roofTrees.lines },
      { reveal: { growAxis: [1, 1, 1], stagger: 1.2 }, prog: (s) => s.treesRoof, opacity: () => 0.8 },
    );
    const garden = buildTrees(site.trees, 7);
    part(
      { solids: [[garden.cypress, 'cypress'], [garden.olive, 'olive'], [garden.trunks, 'trunk']], lines: garden.lines },
      { reveal: { growAxis: [1, 1, 1], stagger: 1.6 }, prog: (s) => s.treesGarden, opacity: () => 0.9 },
    );

    // The leaves themselves: cut-out sprays over every crown. Like the
    // furniture they are no part of the drawing; they arrive with the sweep.
    const cards = track(buildLeafCards([...roofTrees.sprays, ...garden.sprays]));
    const leaves = new THREE.Mesh(cards, track(makeLeafMaterial(track(leafTexture()))));
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.frustumCulled = false;
    leaves.matrixAutoUpdate = false;
    leaves.visible = false;
    root.add(leaves);
    triangles += cards.getAttribute('position').count / 3;
    drivers.push((s) => {
      leaves.visible = s.mat > 0.001;
    });
  });

  // run the steps, yielding to the browser between each
  for (let i = 0; i < steps.length; i++) {
    onProgress(i / steps.length, steps[i][0]);
    await new Promise((r) => setTimeout(r, 0));
    steps[i][1]();
  }
  onProgress(1, 'Ready');

  return {
    root,
    update: (s) => {
      for (const d of drivers) d(s);
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
      root.clear();
    },
    labels: { rooms, dims },
    stats: { drawCalls: root.children.length, triangles: Math.round(triangles) },
  };
}
