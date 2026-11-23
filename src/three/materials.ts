import * as THREE from 'three';
import { useTextureSet, type TextureSetName } from './assets';

export const COLORS = {
  background: '#171717',
  line: '#f1f1ee',
  /** unlit face colour while the model is still a drawing */
  paper: '#1c1c1c',
};

// ------------------------------------------------------------------ shared

/** Uniforms shared by every material so one tween drives the whole scene. */
export const shared = {
  /** 0 = drawing, 1 = fully materialised */
  uMat: { value: 0 },
  /** position of the materialisation front (see SWEEP below) */
  uSweep: { value: -1000 },
  /** seconds, for the pool ripples */
  uTime: { value: 0 },
};

/**
 * The drawing turns into the building along one moving front: a tilted plane
 * that crosses the site from the garden corner and then climbs the house.
 * Behind the front surfaces are lit material; ahead of it they are still
 * drawing. Solids and linework share this function, so a line disappears
 * exactly where the material arrives.
 */
export const SWEEP = { from: -18, to: 38, band: 3.6 };
const SWEEP_GLSL = /* glsl */ `
  uniform float uSweep;
  float sweepCoord(vec3 p) { return p.y + p.x * 0.22 - p.z * 0.14; }
  float sweepAt(vec3 p, float jitter) {
    return clamp((uSweep - sweepCoord(p) + jitter) / ${SWEEP.band.toFixed(1)}, 0.0, 1.0);
  }
`;

const REVEAL_PARS = /* glsl */ `
  attribute float aDelay;
  attribute vec3 aOrigin;
  uniform float uProg;
  uniform float uStagger;
  uniform vec3 uDrop;
  uniform vec3 uGrowAxis;
  varying float vG;

  // Staggered 0..1 progress for this vertex, then grow / drop from its origin.
  vec3 reveal(vec3 p) {
    float g = clamp(uProg * (1.0 + uStagger) - aDelay * uStagger, 0.0, 1.0);
    g = g * g * (3.0 - 2.0 * g);
    vG = g;
    p = mix(p, aOrigin + (p - aOrigin) * g, uGrowAxis);
    p += uDrop * (1.0 - g);
    return p;
  }
`;

export interface RevealUniforms {
  uProg: { value: number };
  uStagger: { value: number };
  uDrop: { value: THREE.Vector3 };
  uGrowAxis: { value: THREE.Vector3 };
}

export interface RevealConfig {
  stagger?: number;
  drop?: [number, number, number];
  growAxis?: [number, number, number];
}

function revealUniforms(c: RevealConfig = {}): RevealUniforms {
  return {
    uProg: { value: 1 },
    uStagger: { value: c.stagger ?? 0 },
    uDrop: { value: new THREE.Vector3(...(c.drop ?? [0, 0, 0])) },
    uGrowAxis: { value: new THREE.Vector3(...(c.growAxis ?? [0, 0, 0])) },
  };
}

// ------------------------------------------------------------------ lines

export interface LineUniforms extends RevealUniforms {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uDraw: { value: number };
  uDrawStagger: { value: number };
  uBoost: { value: number };
  uFadeRadius: { value: number };
  uSweep: { value: number };
  uSweepFade: { value: number };
}

export type LineMaterial = THREE.ShaderMaterial & { uniforms: LineUniforms };

/**
 * The one line material: thin white linework that can
 *  - draw itself along its length (uDraw + aT),
 *  - grow / drop with the solid it outlines (uProg + aDelay / aOrigin).
 */
export function makeLineMaterial(
  o: RevealConfig & { instanced?: boolean; drawStagger?: number; fadeRadius?: number; boost?: number; keep?: boolean } = {},
): LineMaterial {
  const uniforms: LineUniforms = {
    ...revealUniforms(o),
    uColor: { value: new THREE.Color(COLORS.line) },
    uOpacity: { value: 1 },
    uDraw: { value: 1 },
    uDrawStagger: { value: o.drawStagger ?? 0.8 },
    uBoost: { value: o.boost ?? 1.22 },
    uFadeRadius: { value: o.fadeRadius ?? 0 },
    uSweep: shared.uSweep,
    uSweepFade: { value: o.keep ? 0 : 1 },
  };
  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    defines: o.instanced ? { INSTANCED: '' } : {},
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${REVEAL_PARS}
      #ifdef INSTANCED
        attribute mat4 aInstanceMatrix;
      #else
        attribute float aT;
        attribute float aShade;
      #endif
      varying float vT;
      varying float vDelay;
      varying float vShade;
      varying vec3 vPos;
      void main() {
        vec3 p = position;
        #ifdef INSTANCED
          p = (aInstanceMatrix * vec4(p, 1.0)).xyz;
          vT = 0.0;
          vShade = 1.0;
        #else
          vT = aT;
          vShade = aShade;
        #endif
        vDelay = aDelay;
        p = reveal(p);
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDraw;
      uniform float uDrawStagger;
      uniform float uBoost;
      uniform float uFadeRadius;
      uniform float uSweepFade;
      ${SWEEP_GLSL}
      varying float vT;
      varying float vDelay;
      varying float vShade;
      varying float vG;
      varying vec3 vPos;
      void main() {
        float head = uDraw * (1.0 + uDrawStagger) - vDelay * uDrawStagger;
        if (head <= 0.0 || vT > head) discard;
        float a = uOpacity * vShade * smoothstep(0.0, 0.25, vG);
        if (uFadeRadius > 0.0) {
          a *= 1.0 - smoothstep(uFadeRadius * 0.35, uFadeRadius, length(vPos.xz));
        }
        // hand over to the material: the line dissolves as the front passes
        a *= 1.0 - uSweepFade * smoothstep(0.0, 0.7, sweepAt(vPos, 0.0));
        if (a < 0.003) discard;
        // a brighter tip where the pen currently is
        float tip = smoothstep(0.06, 0.0, head - vT) * step(head, 0.999);
        gl_FragColor = vec4(uColor * (uBoost + tip * 1.2), a);
      }
    `,
  }) as LineMaterial;
}

// ------------------------------------------------------------------ solids

export type SolidKind =
  | 'render'
  | 'stone'
  | 'slab'
  | 'frame'
  | 'glass'
  | 'wood'
  | 'rail'
  | 'ground'
  | 'paving'
  | 'drive'
  | 'lawn'
  | 'tile'
  | 'water'
  | 'cypress'
  | 'olive'
  | 'trunk';

interface SolidSpec {
  color: string;
  roughness: number;
  metalness: number;
  /** colour (and alpha) while still a drawing */
  dark?: string;
  darkAlpha?: number;
  opacity?: number;
  transparent?: boolean;
  doubleSide?: boolean;
  envIntensity?: number;
  /** Poly Haven texture set, box-projected in world space */
  tex?: TextureSetName;
  /** metres covered by one texture repeat */
  texSize?: number;
  normalScale?: number;
  /** strength / frequency of the procedural tone + roughness variation */
  noise?: number;
  noiseFreq?: number;
  /** extra shader behaviour */
  mode?: 'glass' | 'water' | 'foliage';
  /** absent (discarded) until the materialisation front reaches it */
  dissolve?: boolean;
}

const SOLIDS: Record<SolidKind, SolidSpec> = {
  // lime render: almost white, with soft cloudy variation in tone and sheen
  render: { color: '#f4f1eb', roughness: 0.9, metalness: 0, noise: 0.075, noiseFreq: 0.42 },
  stone: { color: '#bcc3ca', roughness: 1, metalness: 0, tex: 'stone', texSize: 2.4, normalScale: 0.9 },
  slab: { color: '#e7e3da', roughness: 0.82, metalness: 0, noise: 0.07, noiseFreq: 0.6 },
  // dark bronze
  frame: { color: '#2c2118', roughness: 0.36, metalness: 0.9, envIntensity: 1.2 },
  glass: {
    color: '#74868c',
    roughness: 0.03,
    metalness: 0,
    transparent: true,
    dark: '#9a9a9a',
    darkAlpha: 0.13,
    doubleSide: true,
    envIntensity: 2.4,
    mode: 'glass',
  },
  wood: { color: '#8f6f55', roughness: 1, metalness: 0, tex: 'wood', texSize: 1.5, normalScale: 0.7 },
  rail: { color: '#2c2118', roughness: 0.4, metalness: 0.9 },
  ground: { color: '#8d8476', roughness: 1, metalness: 0, dissolve: true, noise: 0.22, noiseFreq: 2.2 },
  paving: { color: '#ffffff', roughness: 1, metalness: 0, dissolve: true, tex: 'stone', texSize: 3.6, normalScale: 0.6 },
  drive: { color: '#77716a', roughness: 0.96, metalness: 0, dissolve: true, noise: 0.24, noiseFreq: 3.1 },
  lawn: { color: '#a6c98c', roughness: 1, metalness: 0, dissolve: true, tex: 'grass', texSize: 3.2, normalScale: 1 },
  tile: { color: '#74bfc2', roughness: 0.35, metalness: 0, dissolve: true, noise: 0.12, noiseFreq: 1.6 },
  water: {
    color: '#1f6f7c',
    roughness: 0.05,
    metalness: 0.35,
    transparent: true,
    opacity: 0.8,
    darkAlpha: 0,
    dissolve: true,
    envIntensity: 1.7,
    mode: 'water',
  },
  cypress: { color: '#2c3f2a', roughness: 1, metalness: 0, noise: 0.55, noiseFreq: 2.4, mode: 'foliage' },
  olive: { color: '#56664a', roughness: 1, metalness: 0, noise: 0.5, noiseFreq: 2.0, mode: 'foliage' },
  trunk: { color: '#4b3b2e', roughness: 1, metalness: 0, noise: 0.3, noiseFreq: 3 },
};

export interface SolidUniforms extends RevealUniforms {
  uMat: { value: number };
  uSweep: { value: number };
  uTime: { value: number };
  uDark: { value: THREE.Color };
  uDarkAlpha: { value: number };
  uFade: { value: number };
  uTexSize: { value: number };
  uNoise: { value: number };
  uNoiseFreq: { value: number };
}

export type SolidMaterial = (THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) & {
  userData: { u: SolidUniforms };
};

const C = THREE.ShaderChunk;
const boxUv = (chunk: string, name: string) => chunk.split(name).join('boxUv');

const FRAG_PARS = /* glsl */ `
  uniform float uMat;
  uniform float uTime;
  ${SWEEP_GLSL}
  uniform vec3 uDark;
  uniform float uDarkAlpha;
  uniform float uFade;
  uniform float uTexSize;
  uniform float uNoise;
  uniform float uNoiseFreq;
  varying float vG;
  varying vec3 vWPos;
  varying vec3 vWNrm;

  float vHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(vHash(i), vHash(i + vec3(1, 0, 0)), f.x), mix(vHash(i + vec3(0, 1, 0)), vHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(vHash(i + vec3(0, 0, 1)), vHash(i + vec3(1, 0, 1)), f.x), mix(vHash(i + vec3(0, 1, 1)), vHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float vFbm(vec3 p) {
    return vNoise(p) * 0.5 + vNoise(p * 2.13 + 7.1) * 0.3 + vNoise(p * 4.7 + 3.3) * 0.2;
  }
`;

/**
 * PBR material (standard, or physical for glass) patched so that it
 *  - shares the reveal vertex logic with the lines,
 *  - maps textures by world-space box projection (the procedural geometry
 *    carries no UVs), with procedural tone / roughness variation on top,
 *  - cross-fades from a flat "paper" colour to the lit material via uMat.
 * While uMat is 0 the solids simply hide the linework behind them, giving a
 * clean hidden-line drawing.
 */
export function makeSolidMaterial(kind: SolidKind, c: RevealConfig = {}, lite = false): SolidMaterial {
  const s = SOLIDS[kind];
  const common: THREE.MeshStandardMaterialParameters = {
    color: s.color,
    roughness: s.roughness,
    metalness: s.metalness,
    transparent: s.transparent ?? false,
    opacity: s.opacity ?? 1,
    depthWrite: !s.transparent,
    side: s.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    envMapIntensity: s.envIntensity ?? 1,
    // push faces back a hair so their edge lines never z-fight
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 2,
  };
  if (s.tex) common.normalScale = new THREE.Vector2(s.normalScale ?? 1, s.normalScale ?? 1);

  let m: SolidMaterial;
  if (s.mode === 'glass' && !lite) {
    // real glass: light passes through (tinted), the sky reflects off it
    m = new THREE.MeshPhysicalMaterial({
      ...common,
      transmission: 0.92,
      thickness: 0,
      ior: 1.85,
      specularIntensity: 1,
    }) as SolidMaterial;
  } else if (s.mode === 'glass') {
    // light fallback for small devices: no transmission pass
    m = new THREE.MeshStandardMaterial({ ...common, metalness: 1, opacity: 0.68 }) as SolidMaterial;
  } else {
    m = new THREE.MeshStandardMaterial(common) as SolidMaterial;
  }
  if (s.tex) {
    // registers the material so the real (lazy-loaded) textures replace the
    // placeholders it is compiled against
    const set = useTextureSet(s.tex, m);
    m.map = set.map;
    m.normalMap = set.normalMap;
    m.roughnessMap = set.roughnessMap;
  }
  if (s.dissolve) m.defines = { ...m.defines, VILLA_DISSOLVE: '' };
  if (s.mode === 'water') m.defines = { ...m.defines, VILLA_WATER: '' };
  if (s.mode === 'foliage') m.defines = { ...m.defines, VILLA_FOLIAGE: '' };

  const u: SolidUniforms = {
    ...revealUniforms(c),
    uMat: shared.uMat,
    uSweep: shared.uSweep,
    uTime: shared.uTime,
    uDark: { value: new THREE.Color(s.dark ?? COLORS.paper) },
    uDarkAlpha: { value: s.darkAlpha ?? 1 },
    uFade: { value: 1 },
    uTexSize: { value: s.texSize ?? 1 },
    uNoise: { value: s.noise ?? 0 },
    uNoiseFreq: { value: s.noiseFreq ?? 1 },
  };
  m.userData.u = u;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${REVEAL_PARS}\nvarying vec3 vWPos;\nvarying vec3 vWNrm;`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 mvPosition = vec4(transformed, 1.0);
        vWNrm = objectNormal;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vWNrm = mat3(instanceMatrix) * objectNormal;
        #endif
        mvPosition.xyz = reveal(mvPosition.xyz);
        if (vG <= 0.0) mvPosition.xyz = aOrigin; // collapse unrevealed parts
        vWPos = mvPosition.xyz;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        // world-space box projection: pick the plane the face looks along
        vec3 bn = abs(normalize(vWNrm));
        vec2 boxUv = (bn.y > bn.x && bn.y > bn.z ? vWPos.xz : (bn.x > bn.z ? vWPos.zy : vWPos.xy)) / uTexSize;
        ${boxUv(C.map_fragment, 'vMapUv')}
        float vVar = vFbm(vWPos * uNoiseFreq) - 0.5;
        diffuseColor.rgb *= 1.0 + vVar * uNoise;
        #ifdef VILLA_FOLIAGE
          // leaf-scale speckle and a darker underside
          diffuseColor.rgb *= 0.8 + 0.34 * vNoise(vWPos * 11.0);
          diffuseColor.rgb *= 0.72 + 0.28 * smoothstep(-0.6, 0.5, normalize(vWNrm).y);
        #endif
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        ${boxUv(C.roughnessmap_fragment, 'vRoughnessMapUv')}
        roughnessFactor = clamp(roughnessFactor - vVar * uNoise * 1.6, 0.03, 1.0);
        `,
      )
      .replace('#include <normal_fragment_begin>', boxUv(C.normal_fragment_begin, 'vNormalMapUv'))
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        ${boxUv(C.normal_fragment_maps, 'vNormalMapUv')}
        #ifdef VILLA_WATER
          // two layers of slow drifting ripples, as a perturbed surface normal
          float e = 0.12;
          vec3 q = vec3(vWPos.xz * 1.15, uTime * 0.32);
          vec3 q2 = vec3(vWPos.zx * 2.6 + 4.0, uTime * 0.5);
          float h0 = vFbm(q) + 0.4 * vNoise(q2);
          float hx = vFbm(q + vec3(e, 0.0, 0.0)) + 0.4 * vNoise(q2 + vec3(0.0, e, 0.0));
          float hz = vFbm(q + vec3(0.0, e, 0.0)) + 0.4 * vNoise(q2 + vec3(e, 0.0, 0.0));
          vec3 wn = normalize(vec3(-(hx - h0) / e * 0.22, 1.0, -(hz - h0) / e * 0.22));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        #endif
        `,
      )
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `
        // local materialisation: 0 ahead of the front, 1 behind it, with a
        // soft noisy edge so the change reads as a dissolve, never a pop
        float lm = sweepAt(vWPos, (vFbm(vWPos * 1.7) - 0.5) * 2.2);
        #ifdef VILLA_DISSOLVE
          if (lm <= vNoise(vWPos * 16.0) * 0.35) discard; // not there at all until swept
        #endif
        float front = lm * (1.0 - lm) * 4.0;
        gl_FragColor = mix(vec4(uDark, uDarkAlpha), gl_FragColor, lm);
        gl_FragColor.rgb += vec3(1.0, 0.8, 0.58) * front * 0.22 * step(0.001, uMat);
        gl_FragColor.a *= uFade;
        #include <dithering_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'villa-solid';
  return m;
}
