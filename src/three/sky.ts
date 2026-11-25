import * as THREE from 'three';
import { wake } from '../animation/state';

/**
 * The visible evening sky: the same Poly Haven sky that lights the scene, as a
 * tone-mapped photo. It is sampled by view direction in the backdrop shader
 * and, at the horizon, by the ground (so the land fades into the sky it sits
 * under). Loaded after the page is revealed; until then, and through the
 * drawing stages, the backdrop is its plain gradient.
 */
const placeholder = new THREE.DataTexture(new Uint8Array([40, 34, 30, 255]), 1, 1, THREE.RGBAFormat);
placeholder.colorSpace = THREE.SRGBColorSpace;
placeholder.needsUpdate = true;

export const sky = {
  uSkyMap: { value: placeholder as THREE.Texture },
  /** added to a world azimuth to get the photo's: turns its sun behind the key light */
  uSkyRot: { value: 0 },
  /** 0 = plain gradient, 1 = the sky */
  uSkyMix: { value: 0 },
  uSkyGain: { value: 0.72 },
  /** 0..1, eases up once the photo has arrived */
  loaded: 0,
  ready: false,
};

export const SKY_GLSL = /* glsl */ `
  uniform sampler2D uSkyMap;
  uniform float uSkyRot;
  uniform float uSkyGain;
  vec2 skyUv(vec3 d) {
    return vec2((atan(d.z, d.x) + uSkyRot) / 6.28318530718 + 0.5, asin(d.y) / 3.14159265359 + 0.5);
  }
  // The haze at the horizon in this direction: a heavily blurred read of the
  // photo a few degrees up. The ground fades to this, and so does the sky.
  vec3 skyHaze(vec3 d) {
    vec3 h = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5, 0.0, 0.0));
    h.y = 0.085;
    return textureLod(uSkyMap, skyUv(normalize(h)), 5.5).rgb * uSkyGain;
  }
  // far hills and tree lines, as a soft uneven edge to the land
  float skyRidge(float a) {
    return 0.5 + 0.5 * (sin(a * 5.0 + 1.3) * 0.46 + sin(a * 13.0 + 4.1) * 0.3 + sin(a * 31.0 + 0.6) * 0.16 + sin(a * 83.0) * 0.08);
  }
  vec3 skyColor(vec3 d) {
    vec3 haze = skyHaze(d);
    float up = d.y;
    float az = atan(d.z, d.x);
    d.y = max(d.y, 0.004);
    // (explicit level: the lookup wraps in azimuth, where automatic mip
    // selection would draw a seam)
    vec3 c = textureLod(uSkyMap, skyUv(normalize(d)), 0.0).rgb * uSkyGain;
    c = mix(haze, c, smoothstep(0.0, 0.075, up));
    float far = 0.004 + 0.011 * skyRidge(az);
    float near = 0.0015 + 0.006 * skyRidge(az * 1.7 + 2.0) + 0.0012 * sin(az * 240.0) * sin(az * 131.0);
    c = mix(c, mix(haze, vec3(0.085, 0.1, 0.105), 0.34), 1.0 - smoothstep(far - 0.0007, far + 0.0007, up));
    c = mix(c, mix(haze, vec3(0.03, 0.045, 0.03), 0.5), 1.0 - smoothstep(near - 0.0006, near + 0.0006, up));
    return c;
  }
`;

export async function loadSky(gl: THREE.WebGLRenderer): Promise<void> {
  try {
    const tex = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/sky.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // mipmaps are only ever read at explicit levels (see SKY_GLSL)
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    gl.initTexture(tex);
    sky.uSkyMap.value = tex;
    sky.ready = true;
    wake(90);
  } catch (e) {
    console.warn('Sky photo failed to load; keeping the gradient backdrop', e);
  }
}

export function disposeSky() {
  if (sky.uSkyMap.value !== placeholder) sky.uSkyMap.value.dispose();
  sky.uSkyMap.value = placeholder;
  sky.ready = false;
  sky.loaded = 0;
}
