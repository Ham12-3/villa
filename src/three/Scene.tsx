import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import gsap from 'gsap';
import { S, activity, cam, debug, env, intro, rig, wake } from '../animation/state';
import { createCameraPath, type PoseValues } from '../animation/cameraPath';
import { createFraming, placeCamera } from '../animation/framing';
import { LABEL_COLUMN, view } from '../animation/view';
import { site } from '../data/villa';
import { assets } from './assets';
import { SWEEP, shared } from './materials';
import type { VillaModel } from './assemble';
import { Villa } from './Villa';

const DEG = Math.PI / 180;

/** Low evening sun from the garden side: about 20 degrees above the horizon. */
const SUN = new THREE.Vector3(-58, 27, 44);

/** how quickly the camera catches up with its spline target (1/s); lower = heavier */
const CAMERA_DAMPING = 3.4;
/** multisampling for the scene buffer: real anti-aliasing for the 1px linework */
const MSAA = env.mobile ? 2 : 4;
const POSE_KEYS = ['tx', 'ty', 'tz', 'radius', 'polar', 'azimuth'] as const;

/** Camera rig + lighting, all driven from the scroll state every frame. */
function Rig() {
  const { camera, scene, size } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const frame = useMemo(() => createFraming(), []);
  const samplePath = useMemo(() => createCameraPath(env.mobile), []);
  const goal = useMemo<PoseValues>(() => ({ tx: 0, ty: 0, tz: 0, radius: 0, polar: 0, azimuth: 0 }), []);
  const settled = useRef(false);
  const fr = useRef({ zoom: 1, dx: 0, dy: 0, ready: false });

  useEffect(() => {
    // Image-based lighting from the evening-sky HDRI, turned so that the
    // bright part of its sky sits behind the key light. The visible
    // background is the <Backdrop> gradient, not the HDRI.
    scene.environment = assets.environment;
    scene.environmentRotation.set(0, assets.sunAzimuth - Math.atan2(SUN.z, SUN.x), 0);
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
    const markers = Math.max(S.marker0, S.marker1, S.marker2, S.marker3) * S.markerFade;
    const f = frame(cam3, cam, base, w, h, {
      // the whole plot is the subject on the site plan and once it is built
      wholeSite: Math.max(1 - smooth(18, 26, rig.at), smooth(79, 85, rig.at)),
      reserveRight: smooth(0, 0.3, markers) * (view.stacked ? 84 : LABEL_COLUMN),
    });
    const on = smooth(5, 11, rig.at);
    // the answer changes when the copy block changes with the chapter, so it
    // is followed with the same kind of damping as the camera itself
    const kf = fr.current.ready && !env.reducedMotion ? 1 - Math.exp(-delta * 2.6) : 1;
    fr.current.ready = true;
    fr.current.zoom += (f.zoom - fr.current.zoom) * kf;
    fr.current.dx += (f.dx - fr.current.dx) * kf;
    fr.current.dy += (f.dy - fr.current.dy) * kf;
    placeCamera(cam3, cam, base * (1 + (fr.current.zoom - 1) * on));
    cam3.setViewOffset(w, h, -fr.current.dx * on, fr.current.dy * on, w, h);
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
  });

  return (
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
          varying vec2 vUv;
          void main() {
            float v = smoothstep(0.0, 1.0, vUv.y);
            vec3 cool = mix(uCoolBottom, uCoolTop, v);
            vec3 warm = mix(uWarmBottom, uWarmTop, pow(v, 0.8));
            // low horizon glow, slightly right of centre where the house sits
            vec2 g = (vUv - vec2(0.56, 0.36)) * vec2(1.25, 2.7);
            warm += uGlow * exp(-dot(g, g)) * 0.4;
            vec3 c = mix(cool, warm, uWarm);
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
  useFrame(() => {
    // warms across two thirds of the scroll, not inside one chapter
    material.uniforms.uWarm.value = smooth(30, 97, rig.at);
  });
  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
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
          float a = (tight * 0.5 + wide * wide * 0.42) * uMat;
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
          <Backdrop />
          <Rig />
          <ContactShadow />
          <Villa model={model} onReady={onReady} />
        </>
      )}
      <Post />
      <Pump />
    </Canvas>
  );
}
