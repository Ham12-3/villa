import * as THREE from 'three';
import { S, wake } from '../animation/state';
import { models, type ModelId } from '../data/interior';
import { COLORS, SWEEP, shared } from './materials';

/**
 * The real furniture and decor: CC0 glTF models from Poly Haven, placed from
 * the `models` list in data/interior.ts. They are fetched after the page is
 * revealed (nothing of them is seen until four fifths of the way down), their
 * textures are uploaded one per frame so nothing hitches, and their shaders
 * are compiled before they are shown.
 */
export interface Furniture {
  group: THREE.Group;
  /** call once per frame */
  update: (camera: THREE.Camera) => void;
  dispose: () => void;
}

/** beyond this distance a piece is a few pixels behind glass: not drawn */
const DRAW_DISTANCE = 64;

const paper = { value: new THREE.Color(COLORS.paper) };

/** Makes a glTF material appear with the same materialisation front as the house. */
export function joinSweep(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSweep = shared.uSweep;
    shader.uniforms.uPaper = paper;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFWPos;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        vec4 fwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fwp = instanceMatrix * fwp;
        #endif
        vFWPos = (modelMatrix * fwp).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSweep;\nuniform vec3 uPaper;\nvarying vec3 vFWPos;')
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `
        float flm = clamp((uSweep - (vFWPos.y + vFWPos.x * 0.22 - vFWPos.z * 0.14)) / ${SWEEP.band.toFixed(1)}, 0.0, 1.0);
        if (flm <= 0.0) discard; // not there until the front has passed
        gl_FragColor.rgb = mix(uPaper, gl_FragColor.rgb, flm);
        #include <dithering_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'villa-model';
}

export async function loadFurniture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<Furniture> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}assets/models/`;
  const ids = [...new Set(models.map((p) => p.model))];

  const group = new THREE.Group();
  group.visible = false;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const items: THREE.Group[] = [];
  const anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());

  await Promise.all(
    ids.map(async (id: ModelId) => {
      let source: THREE.Group;
      try {
        source = (await loader.loadAsync(`${base}${id}/${id}.gltf`)).scene;
      } catch (e) {
        console.warn(`Model "${id}" failed to load`, e);
        return;
      }
      source.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      source.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      });
      for (const mesh of meshes) {
        geometries.add(mesh.geometry);
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (materials.has(m)) continue;
          materials.add(m);
          joinSweep(m);
          const std = m as THREE.MeshStandardMaterial;
          for (const t of [std.map, std.normalMap, std.roughnessMap, std.metalnessMap, std.aoMap]) {
            if (!t) continue;
            t.anisotropy = anisotropy;
            textures.add(t);
          }
        }
      }
      for (const p of models) {
        if (p.model !== id) continue;
        const item = new THREE.Group();
        item.position.set(p.pos[0], p.pos[1], p.pos[2]);
        item.rotation.y = p.rot ?? 0;
        item.scale.setScalar(p.scale ?? 1);
        for (const mesh of meshes) {
          const copy = new THREE.Mesh(mesh.geometry, mesh.material);
          copy.matrix.copy(mesh.matrixWorld);
          copy.matrixAutoUpdate = false;
          copy.castShadow = true;
          copy.receiveShadow = true;
          item.add(copy);
        }
        item.updateMatrixWorld(true);
        items.push(item);
        group.add(item);
      }
    }),
  );

  // compile against a linear target, like the rest of the scene (see Villa.tsx)
  scene.add(group);
  group.visible = true;
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  gl.setRenderTarget(target);
  const compiled = gl.compileAsync(group, camera, scene);
  gl.setRenderTarget(null);
  group.visible = false;
  let ready = false;
  compiled
    .catch(() => {})
    .then(() => {
      target.dispose();
      ready = true;
      wake(30);
    });

  const queue = [...textures];
  let shown = false;
  wake(queue.length + 30);

  return {
    group,
    update: (cam) => {
      // one texture upload per frame, then the pieces can be drawn
      if (queue.length) {
        gl.initTexture(queue.pop()!);
        wake(4);
        return;
      }
      if (!ready) return;
      if (!shown) {
        shown = true;
        wake(30);
      }
      const on = S.mat > 0.001;
      group.visible = on;
      if (!on) return;
      for (const item of items) item.visible = item.position.distanceTo(cam.position) < DRAW_DISTANCE;
    },
    dispose: () => {
      scene.remove(group);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
