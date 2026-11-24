import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import gsap from 'gsap';
import { S, activity, cam, debug, env, intro, rig, wake } from '../animation/state';
import { createCameraPath, createTourPath, type PoseValues, type TourValues } from '../animation/cameraPath';
import { TOUR_START } from '../data/tour';
import { createFraming, placeCamera } from '../animation/framing';
import { LABEL_COLUMN, view } from '../animation/view';
import { site } from '../data/villa';
import { lights as interiorLights } from '../data/interior';
import { assets } from './assets';
import { SWEEP, shared } from './materials';
import { SKY_GLSL, sky } from './sky';
import type { VillaModel } from './assemble';
import { Villa } from './Villa';

const DEG = Math.PI / 180;

/** Low evening sun from the garden side: about 20 degrees above the horizon. */
const SUN = new THREE.Vector3(-58, 27, 44);

/** how quickly the camera catches up with its spline target (1/s); lower = heavier */
const CAMERA_DAMPING = 3.4;
/** multisampling for the scene buffer: real anti-aliasing for the 1px linework */
const MSAA = env.mobile ? 2 : 4;
const POSE_KEYS = ['tx', 'ty', 'tz', 'radius', 'polar', 'azimuth', 'fov'] as const;
const TOUR_KEYS = ['ex', 'ey', 'ez', 'lx', 'ly', 'lz', 'fov'] as const;
/** far clip plane: past the edge of the ground, which runs to the horizon */
const FAR = 3200;
/** real point lights shared between all the rooms */
const LAMP_SLOTS = 2;

/** Camera rig + lighting, all driven from the scroll state every frame. */
function Rig() {
  const { camera, scene, size } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const frame = useMemo(() => createFraming(), []);
  const samplePath = useMemo(() => createCameraPath(env.mobile), []);
  const goal = useMemo<PoseValues>(() => ({ tx: 0, ty: 0, tz: 0, radius: 0, polar: 0, azimuth: 0, fov: 30 }), []);
  const lamps = useRef<(THREE.PointLight | null)[]>([]);
  const settled = useRef(false);
  const aspectNow = size.width / size.height;
  // The walkthrough starts from wherever the model view leaves the camera.
  const sampleTour = useMemo(() => {
    const pose = samplePath(TOUR_START, { tx: 0, ty: 0, tz: 0, radius: 0, polar: 0, azimuth: 0, fov: 30 });
    const probe = new THREE.PerspectiveCamera();
    placeCamera(probe, pose, pose.radius * (aspectNow < 1.5 ? Math.min(2.15, 1.5 / aspectNow) : 1));
    return createTourPath(
      { ex: probe.position.x, ey: probe.position.y, ez: probe.position.z, lx: pose.tx, ly: pose.ty, lz: pose.tz, fov: pose.fov },
      env.mobile,
    );
  }, [samplePath, aspectNow]);
  const tourGoal = useMemo<TourValues>(() => ({ ex: 0, ey: 0, ez: 0, lx: 0, ly: 0, lz: 0, fov: 30 }), []);
  const tour = useMemo<TourValues>(() => ({ ex: 0, ey: 0, ez: 0, lx: 0, ly: 0, lz: 0, fov: 30 }), []);
  const tourReady = useRef(false);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const order = useMemo(() => interiorLights.map((_, i) => i), []);
  const weights = useMemo(() => interiorLights.map(() => 0), []);
  const fr = useRef({ zoom: 1, dx: 0, dy: 0, ready: false });

  useEffect(() => {
    // Image-based lighting from the evening-sky HDRI, turned so that the
    // bright part of its sky sits behind the key light. The visible
    // background is the <Backdrop> gradient, not the HDRI.
    scene.environment = assets.environment;
    scene.environmentRotation.set(0, assets.sunAzimuth - Math.atan2(SUN.z, SUN.x), 0);
    // the visible sky is the same photo, turned the same way
    sky.uSkyRot.value = assets.sunAzimuth - Math.atan2(SUN.z, SUN.x);
    return () => {
      scene.environment = null;
    };
  }, [scene]);


  useFrame((state, delta) => {
    // Where the spline says the camera should be for this scroll position...
    samplePath(rig.at, goal);
    // ...and a critically damped follow, so the camera has weight like a
    // crane arm: it never snaps, even when the scroll does. Frame-rate
    // independent (exact for any delta, so slow frames cannot make it lag); skipped on the first frame and for reduced motion.
    const k = settled.current && !env.reducedMotion ? 1 - Math.exp(-delta * CAMERA_DAMPING) : 1;
    settled.current = true;
    for (const key of POSE_KEYS) cam[key] += (goal[key] - cam[key]) * k;

    // The walkthrough has its own eye / look-at path, followed with the same
    // damping, and takes over from the model view just after TOUR_START.
    sampleTour(Math.max(TOUR_START, rig.at), tourGoal);
    const kt = tourReady.current ? k : 1;
    tourReady.current = true;
    for (const key of TOUR_KEYS) tour[key] += (tourGoal[key] - tour[key]) * kt;
    const touring = smooth(TOUR_START, TOUR_START + 4, rig.at);

    // pull back on narrow / portrait screens so the villa always fits
    const aspect = size.width / size.height;
    const fit = aspect < 1.5 ? Math.min(2.15, 1.5 / aspect) : 1;
    // arrival: the camera settles in from a little further out
    const base = cam.radius * fit * (1 + (1 - intro.v) * 0.09);

    // Safe zone: pull back / slide the picture just enough that the site
    // never sits under the copy and the house never leaves the frame, at any
    // window size. Eased in after the hero, where there is no model yet.
    const cam3 = camera as THREE.PerspectiveCamera;
    const w = size.width;
    const h = size.height;
    cam3.clearViewOffset();
    // lens and clip planes follow the move: a long lens and deep range for the
    // model, a wider lens and a near plane of 25 cm once inside the room
    cam3.fov = cam.fov + (tour.fov - cam.fov) * touring;
    cam3.near = 2 + (0.25 - 2) * smooth(104, 116, rig.at);
    cam3.far = FAR;
    cam3.updateProjectionMatrix();
    const markers = Math.max(S.marker0, S.marker1, S.marker2, S.marker3) * S.markerFade;
    const f = frame(cam3, cam, base, w, h, {
      // the whole plot is the subject on the site plan and once it is built
      wholeSite: Math.max(1 - smooth(18, 26, rig.at), smooth(79, 85, rig.at)),
      reserveRight: smooth(0, 0.3, markers) * (view.stacked ? 84 : LABEL_COLUMN),
    });
    // (released again as the camera leaves the model view to go inside)
    const on = smooth(5, 11, rig.at) * (1 - touring);
    // the answer changes when the copy block changes with the chapter, so it
    // is followed with the same kind of damping as the camera itself
    const kf = fr.current.ready && !env.reducedMotion ? 1 - Math.exp(-delta * 2.6) : 1;
    fr.current.ready = true;
    fr.current.zoom += (f.zoom - fr.current.zoom) * kf;
    fr.current.dx += (f.dx - fr.current.dx) * kf;
    fr.current.dy += (f.dy - fr.current.dy) * kf;
    placeCamera(cam3, cam, base * (1 + (fr.current.zoom - 1) * on));
    cam3.setViewOffset(w, h, -fr.current.dx * on, fr.current.dy * on, w, h);
    if (touring > 0) {
      // hand over from the orbiting model view to the walkthrough path
      eye.set(tour.ex, tour.ey, tour.ez);
      look.set(
        cam.tx + (tour.lx - cam.tx) * touring,
        cam.ty + (tour.ly - cam.ty) * touring,
        cam.tz + (tour.lz - cam.tz) * touring,
      );
      cam3.position.lerp(eye, touring);
      cam3.lookAt(look);
      cam3.updateMatrixWorld();
    }
    // labels are projected with exactly this camera, in this same frame
    for (const fn of view.listeners) fn(cam3, w, h);

    const m = S.mat;
    shared.uMat.value = m;
    shared.uTime.value = state.clock.elapsedTime;
    // the materialisation front crosses the site, then climbs the house
    shared.uSweep.value = SWEEP.from + (SWEEP.to - SWEEP.from) * m;
    // lights come up early and stay up: what you see change is the front
    const lit = smooth(0, 0.14, m);
    scene.environmentIntensity = lit * 0.27;
    if (sun.current) sun.current.intensity = lit * 3.9;
    // Room lighting: there is one warm light per room in the data, but only
    // LAMP_SLOTS real lights. Each frame they are given to the rooms that
    // matter most: the ones that glow in the exterior views, then, on the
    // walkthrough, whichever rooms the camera is nearest (faded by distance,
    // so a light is always dark when its slot is reassigned).
    const near = smooth(104, 112, rig.at);
    for (let i = 0; i < interiorLights.length; i++) {
      const l = interiorLights[i];
      const d = Math.hypot(cam3.position.x - l.pos[0], cam3.position.y - l.pos[1], cam3.position.z - l.pos[2]);
      const proximity = (1 - smooth(7, 16, d)) * near;
      weights[i] = Math.max(proximity, l.outside ? 1 - near : 0);
    }
    order.sort((a, b) => weights[b] - weights[a]);
    for (let s = 0; s < LAMP_SLOTS; s++) {
      const light = lamps.current[s];
      if (!light) continue;
      const l = interiorLights[order[s]];
      light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      light.distance = l.distance;
      light.intensity = lit * l.intensity * weights[order[s]];
    }
  });

  return (
    <>
      <directionalLight
        ref={sun}
        position={SUN}
        color="#ffd2a4"
        intensity={0}
        castShadow
        shadow-mapSize={env.mobile ? [2048, 2048] : [4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.06}
        shadow-radius={env.mobile ? 3 : 5}
      >
        <orthographicCamera attach="shadow-camera" args={[-62, 62, 50, -50, 1, 260]} />
      </directionalLight>
      {/* warm lamp light indoors: present from the start (so shaders compile once), lit with the rest */}
      {Array.from({ length: LAMP_SLOTS }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lamps.current[i] = el;
          }}
          color="#ffc48c"
          intensity={0}
          distance={14}
          decay={2}
        />
      ))}
    </>
  );
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The one background for the whole story: a vertical gradient drawn behind
 * everything, which warms slowly and continuously with scroll, from the cool
 * near-black of the drawing board to a deep evening tone with a low glow
 * behind the house. No stage ever swaps the background; it only drifts.
 * As the model materialises the gradient gives way to the real evening sky
 * (see sky.ts), looked up by view direction so it turns with the camera.
 */
function Backdrop() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uWarm: { value: 0 },
          uCoolTop: { value: new THREE.Color('#121213') },
          uCoolBottom: { value: new THREE.Color('#1b1b1d') },
          uWarmTop: { value: new THREE.Color('#161210') },
          uWarmBottom: { value: new THREE.Color('#2c231d') },
          uGlow: { value: new THREE.Color('#4d3626') },
          uProjInv: { value: new THREE.Matrix4() },
          uCamWorld: { value: new THREE.Matrix4() },
          uSkyMap: sky.uSkyMap,
          uSkyRot: sky.uSkyRot,
          uSkyGain: sky.uSkyGain,
          uSkyMix: sky.uSkyMix,
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uWarm;
          uniform vec3 uCoolTop;
          uniform vec3 uCoolBottom;
          uniform vec3 uWarmTop;
          uniform vec3 uWarmBottom;
          uniform vec3 uGlow;
          uniform mat4 uProjInv;
          uniform mat4 uCamWorld;
          uniform float uSkyMix;
          ${SKY_GLSL}
          varying vec2 vUv;
          void main() {
            float v = smoothstep(0.0, 1.0, vUv.y);
            vec3 cool = mix(uCoolBottom, uCoolTop, v);
            vec3 warm = mix(uWarmBottom, uWarmTop, pow(v, 0.8));
            // low horizon glow, slightly right of centre where the house sits
            vec2 g = (vUv - vec2(0.56, 0.36)) * vec2(1.25, 2.7);
            warm += uGlow * exp(-dot(g, g)) * 0.4;
            vec3 c = mix(cool, warm, uWarm);
            if (uSkyMix > 0.0) {
              vec4 far = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
              vec3 dir = normalize(mat3(uCamWorld) * (far.xyz / far.w));
              c = mix(c, skyColor(dir), uSkyMix);
            }
            // a little grain so the gradient never bands
            float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            c += (n - 0.5) * 0.0035;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }, delta) => {
    // warms across two thirds of the scroll, not inside one chapter
    material.uniforms.uWarm.value = smooth(30, 97, rig.at);
    // the sky arrives with the materials (and eases in if its photo is late)
    sky.loaded = sky.ready ? Math.min(1, sky.loaded + Math.min(delta, 0.05) * 1.6) : 0;
    sky.uSkyMix.value = smooth(0.12, 0.95, S.mat) * sky.loaded;
    if (sky.ready && sky.loaded < 1) wake(2);
    camera.updateMatrixWorld();
    material.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    material.uniforms.uCamWorld.value.copy(camera.matrixWorld);
  });
  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/**
 * The land around the plot: a meadow running to the horizon, where it fades
 * into the lowest band of the sky. Arrives with the sky; takes the sun's
 * shadows of the house and trees.
 */
function Ground() {
  const { geometry, material } = useMemo(() => {
    // a disc with the plot cut out (the site model fills that)
    const xs = site.plot.map((p) => p[0]);
    const zs = site.plot.map((p) => p[1]);
    const inset = 0.6;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 2600, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    const x0 = Math.min(...xs) + inset;
    const x1 = Math.max(...xs) - inset;
    const z0 = Math.min(...zs) + inset;
    const z1 = Math.max(...zs) - inset;
    // (shape y is world -z after the plane is laid flat)
    hole.moveTo(x0, -z0);
    hole.lineTo(x0, -z1);
    hole.lineTo(x1, -z1);
    hole.lineTo(x1, -z0);
    hole.closePath();
    shape.holes.push(hole);
    const geometry = new THREE.ShapeGeometry(shape, 72);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.15, 0);

    const material = new THREE.MeshStandardMaterial({
      color: '#c6d2a0',
      roughness: 1,
      metalness: 0,
      map: assets.textures.grass.map,
      transparent: true,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSkyMap = sky.uSkyMap;
      shader.uniforms.uSkyRot = sky.uSkyRot;
      shader.uniforms.uSkyGain = sky.uSkyGain;
      shader.uniforms.uSkyMix = sky.uSkyMix;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uSkyMix;
          varying vec3 vGPos;
          ${SKY_GLSL}
          float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float gNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
          }`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          float gDist = length(vGPos - cameraPosition);
          // grass blades close by, dissolving into broad drifts of tone far off
          vec3 gTex = texture2D(map, vGPos.xz / 3.4).rgb;
          vec3 gFar = vec3(0.066, 0.1, 0.03);
          diffuseColor.rgb *= mix(gTex, gFar, smoothstep(18.0, 90.0, gDist));
          float gDrift = gNoise(vGPos.xz * 0.045) * 0.6 + gNoise(vGPos.xz * 0.011 + 9.0) * 0.4;
          diffuseColor.rgb *= mix(vec3(0.78, 0.86, 0.7), vec3(1.3, 1.18, 0.9), gDrift);`,
        )
        .replace(
          '#include <dithering_fragment>',
          /* glsl */ `
          vec3 gDir = (vGPos - cameraPosition) / gDist;
          float gFog = 1.0 - exp(-pow(gDist / 900.0, 1.4));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, skyHaze(gDir), gFog);
          gl_FragColor.a = uSkyMix;
          #include <dithering_fragment>`,
        );
    };
    return { geometry, material };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = sky.uSkyMix.value > 0.001;
    // the real grass texture arrives late: same slot, no recompile
    if (material.map !== assets.textures.grass.map) material.map = assets.textures.grass.map;
  });
  return <mesh ref={ref} geometry={geometry} material={material} renderOrder={-900} frustumCulled={false} receiveShadow />;
}

/**
 * Soft contact shadow on an invisible floor just under the site plinth, so
 * the model sits in space instead of floating on the background.
 */
function ContactShadow() {
  const material = useMemo(() => {
    const xs = site.plot.map((p) => p[0]);
    const zs = site.plot.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMat: shared.uMat,
        uSkyMix: sky.uSkyMix,
        uCentre: { value: new THREE.Vector2(cx, cz) },
        uHalf: { value: new THREE.Vector2((Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...zs) - Math.min(...zs)) / 2) },
        // the shadow leans away from the sun
        uLean: { value: new THREE.Vector2(-SUN.x, -SUN.z).normalize().multiplyScalar(5) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vP = w.xz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uMat;
        uniform float uSkyMix;
        uniform vec2 uCentre;
        uniform vec2 uHalf;
        uniform vec2 uLean;
        varying vec2 vP;
        float box(vec2 p, vec2 b) {
          vec2 d = abs(p) - b;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        }
        void main() {
          float tight = 1.0 - smoothstep(-1.5, 4.0, box(vP - uCentre, uHalf));
          float wide = 1.0 - smoothstep(-4.0, 30.0, box(vP - uCentre - uLean, uHalf));
          // (much lighter once there is real ground, with real shadows, under it)
          float a = (tight * 0.5 + wide * wide * 0.42) * uMat * (1.0 - 0.72 * uSkyMix);
          gl_FragColor = vec4(0.012, 0.008, 0.006, a);
        }
      `,
    });
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = S.mat > 0.001;
  });
  return (
    <mesh ref={ref} material={material} rotation-x={-Math.PI / 2} position={[1, -1.62, 1]} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[220, 200]} />
    </mesh>
  );
}

/**
 * Post chain, kept quiet. Ambient occlusion, tone mapping and the bloom
 * threshold all follow the materialisation value, so the drawing stages keep
 * their exact flat blueprint colours and the lit stages get filmic response.
 */
function Post() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ao = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tone = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloom = useRef<any>(null);

  // Ambient occlusion costs a full extra frame on integrated graphics, so it
  // is a quality tier: on for discrete GPUs, off for phones and integrated
  // chips, and a governor below drops it if frames still run long.
  const gl = useThree((s) => s.gl);
  const useAO = useMemo(() => {
    if (debug.forceAO) return true;
    if (env.mobile || debug.noAO) return false;
    const ctx = gl.getContext();
    const info = ctx.getExtension('WEBGL_debug_renderer_info');
    const gpu = info ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return !/Intel|Iris|UHD|HD Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Microsoft Basic/i.test(gpu);
  }, [gl]);
  const slow = useRef(0);
  const aoScale = useRef(1);
  const aoDropped = useRef(false);
  const dprSlow = useRef(0);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useRef(Math.min(window.devicePixelRatio || 1, env.mobile ? 1.5 : 1.75));

  useFrame((_, delta) => {
    const m = S.mat;
    // Resolution governor: about 1.5 s of frames slower than 45 fps steps the
    // pixel ratio down a notch (never below 1). Gaps after an idle spell are
    // not slow frames, so anything over 100 ms is ignored.
    if (delta < 0.1 && dpr.current > 1) {
      if (delta > 0.0222) dprSlow.current++;
      else dprSlow.current = Math.max(0, dprSlow.current - 1);
      if (dprSlow.current > 90) {
        dprSlow.current = 0;
        dpr.current = Math.max(1, dpr.current - 0.25);
        setDpr(dpr.current);
      }
    }
    if (ao.current && !debug.forceAO) {
      // governor: ~1s of frames slower than 48fps in the lit stage turns AO off
      if (m > 0.5 && delta > 0.0208 && delta < 0.1) slow.current++;
      else slow.current = Math.max(0, slow.current - 2);
      if (slow.current > 60) aoDropped.current = true;
      if (aoDropped.current) aoScale.current = Math.max(0, aoScale.current - delta * 1.5);
    }
    if (ao.current) {
      // N8AO otherwise re-renders every transparent object (all the linework
      // and glass) into its own buffer each frame, which triples frame time
      ao.current.autoDetectTransparency = false;
      ao.current.configuration.transparencyAware = false;
      ao.current.enabled = m > 0.001 && aoScale.current > 0;
      ao.current.configuration.intensity = m * 2.6 * aoScale.current;
    }
    if (tone.current) tone.current.blendMode.opacity.value = smooth(0, 0.3, m);
    // lines glow a little; on the lit model only real highlights do
    if (bloom.current) bloom.current.luminanceMaterial.threshold = 1 + m * 0.55;
  });

  return (
    <EffectComposer multisampling={debug.msaa ?? MSAA}>
      {!useAO ? (
        <></>
      ) : (
        <N8AO ref={ao} aoRadius={2.4} distanceFalloff={1} intensity={0} quality="medium" halfRes color="#1c130d" />
      )}
      <SMAA />
      <Bloom
        ref={bloom}
        mipmapBlur
        luminanceThreshold={1.0}
        luminanceSmoothing={0.12}
        intensity={env.mobile ? 0.18 : 0.24}
        radius={0.55}
      />
      <ToneMapping ref={tone} mode={ToneMappingMode.ACES_FILMIC} blendFunction={BlendFunction.NORMAL} />
      <Vignette offset={0.28} darkness={0.62} />
    </EffectComposer>
  );
}

/**
 * Render-on-demand pump. The canvas only draws while something is moving:
 * scroll, the damped camera settling, the arrival animation, or the lit
 * stage (where the pool water is always in motion). Idle on a drawing stage,
 * it draws nothing at all.
 */
function Pump() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tick = () => {
      if (activity.frames > 0) activity.frames--;
      else if (S.mat <= 0.001 && (intro.v >= 1 || intro.v === 0)) return;
      invalidate();
    };
    const onResize = () => wake(60);
    gsap.ticker.add(tick);
    window.addEventListener('resize', onResize);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
    };
  }, [invalidate]);
  return null;
}

export function Scene({ model, onReady }: { model: VillaModel | null; onReady: () => void }) {
  return (
    <Canvas
      flat
      frameloop={debug.always ? 'always' : 'demand'}
      shadows="soft"
      dpr={[1, env.mobile ? 1.5 : 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 30, near: 2, far: 900, position: [0, 165, 1] }}
    >
      {model && (
        <>
          <Rig />
          <Backdrop />
          <Ground />
          <ContactShadow />
          <Villa model={model} onReady={onReady} />
        </>
      )}
      <Post />
      <Pump />
    </Canvas>
  );
}
