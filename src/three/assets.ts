import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { wake } from '../animation/state';

/** CC0 assets from Poly Haven, served from /public/assets (see CREDITS.md). */
const BASE = `${import.meta.env.BASE_URL}assets/`;
const HDRI = 'hdri/belfast_sunset_puresky_1k.hdr';
const SETS = {
  stone: 'sandstone_blocks_08',
  wood: 'oak_veneer_01',
  grass: 'leafy_grass',
} as const;

export type TextureSetName = keyof typeof SETS;

export interface TextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

interface TexturedMaterial {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
}

/** 1x1 stand-in so materials compile with their texture slots from the start. */
function pixel(r: number, g: number, b: number, srgb: boolean) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** average colour of each set, flat normal, mid-high roughness */
const placeholder = (r: number, g: number, b: number): TextureSet => ({
  map: pixel(r, g, b, true),
  normalMap: pixel(128, 128, 255, false),
  roughnessMap: pixel(210, 210, 210, false),
});

export interface Assets {
  environment: THREE.DataTexture | null;
  /** azimuth (radians, atan2(z, x)) of the brightest part of the sky */
  sunAzimuth: number;
  /** starts as flat placeholders; replaced in place once the real sets arrive */
  textures: Record<TextureSetName, TextureSet>;
}

export const assets: Assets = {
  environment: null,
  sunAzimuth: 0,
  textures: {
    stone: placeholder(190, 172, 138),
    wood: placeholder(176, 140, 104),
    grass: placeholder(74, 92, 44),
  },
};

/** materials using each set, so the real textures can be swapped in later */
const users: Record<TextureSetName, Set<TexturedMaterial>> = { stone: new Set(), wood: new Set(), grass: new Set() };

export function useTextureSet(name: TextureSetName, material: TexturedMaterial) {
  users[name].add(material);
  return assets.textures[name];
}

/** Finds where the sun sits in an equirectangular HDR so the key light can match it. */
function findSunAzimuth(tex: THREE.DataTexture): number {
  const { data, width, height } = tex.image as { data: Uint16Array | Float32Array; width: number; height: number };
  const half = data instanceof Uint16Array;
  const cols = new Float64Array(width);
  // only the band around the horizon matters for a low sun
  for (let y = Math.floor(height * 0.3); y < Math.floor(height * 0.6); y += 2) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i];
      const g = half ? THREE.DataUtils.fromHalfFloat(data[i + 1]) : data[i + 1];
      cols[x] += r * 1.2 + g;
    }
  }
  // smooth, then take the brightest column
  let best = 0;
  let bestV = -1;
  const win = Math.max(2, Math.floor(width / 64));
  for (let x = 0; x < width; x++) {
    let v = 0;
    for (let k = -win; k <= win; k++) v += cols[(x + k + width) % width];
    if (v > bestV) {
      bestV = v;
      best = x;
    }
  }
  return ((best + 0.5) / width - 0.5) * Math.PI * 2;
}

/**
 * Needed before first paint: the environment map shapes how every material
 * is compiled, so it is part of the loading screen.
 */
export async function loadEnvironment(onProgress: (p: number) => void): Promise<void> {
  try {
    const tex = await new HDRLoader().loadAsync(BASE + HDRI, (e) => {
      if (e.total) onProgress(e.loaded / e.total);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    assets.environment = tex;
    assets.sunAzimuth = findSunAzimuth(tex);
  } catch (e) {
    console.warn('Environment map failed to load', e);
  }
  onProgress(1);
}

/**
 * The surface textures are only seen four fifths of the way down the page, so
 * they load after the page is revealed: GPU-compressed KTX2 with mipmaps,
 * transcoded off the main thread, then swapped into the materials that were
 * compiled against placeholders (same shader, no recompile).
 */
export async function loadTextures(gl: THREE.WebGLRenderer): Promise<void> {
  const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
  const loader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(gl);
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());

  const load = async (file: string, srgb: boolean) => {
    const t = await loader.loadAsync(`${BASE}tex/${file}.ktx2`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    gl.initTexture(t); // upload now, not on the first frame that shows it
    return t;
  };

  await Promise.all(
    (Object.entries(SETS) as [TextureSetName, string][]).map(async ([name, id]) => {
      try {
        const [map, normalMap, roughnessMap] = await Promise.all([
          load(`${id}_diff`, true),
          load(`${id}_nor_gl`, false),
          load(`${id}_rough`, false),
        ]);
        const old = assets.textures[name];
        assets.textures[name] = { map, normalMap, roughnessMap };
        for (const m of users[name]) {
          m.map = map;
          m.normalMap = normalMap;
          m.roughnessMap = roughnessMap;
        }
        wake(30);
        old.map.dispose();
        old.normalMap.dispose();
        old.roughnessMap.dispose();
      } catch (e) {
        console.warn(`Texture set "${name}" failed to load; keeping the flat placeholder`, e);
      }
    }),
  );
  loader.dispose();
}

export function disposeAssets() {
  assets.environment?.dispose();
  assets.environment = null;
  for (const set of Object.values(assets.textures)) {
    set.map.dispose();
    set.normalMap.dispose();
    set.roughnessMap.dispose();
  }
  for (const set of Object.values(users)) set.clear();
}
