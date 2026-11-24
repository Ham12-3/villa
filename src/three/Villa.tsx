import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { S, wake } from '../animation/state';
import type { VillaModel } from './assemble';
import { assets, loadTextures } from './assets';
import { SWEEP, shared } from './materials';
import { loadFurniture, type Furniture } from './furniture';
import { loadSky } from './sky';
import { Annotations } from '../ui/Annotations';

/** frames drawn fully built behind the loading screen (see `warm` below) */
const WARM_FRAMES = 3;

/**
 * Mounts the procedurally built villa and, once per frame, copies the scroll
 * animation state into its uniforms. No React state changes while scrolling.
 */
export function Villa({ model, onReady }: { model: VillaModel; onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const lastMat = useRef(-1);
  const settle = useRef(0);
  const frames = useRef(0);
  const compiled = useRef(false);
  const furniture = useRef<Furniture | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      furniture.current?.dispose();
      furniture.current = null;
    };
  }, []);

  useEffect(() => {
    // Shadows are rendered on demand only (see below), never every frame.
    gl.shadowMap.autoUpdate = false;
    // Compile every program up front, in parallel and off the main thread
    // where the browser supports it, so nothing hitches mid-scroll and the
    // loading screen keeps moving. The scene is drawn through the post chain,
    // i.e. into a linear render target; compiling against one makes these the
    // very programs the real frames use (compiled against the canvas they
    // would all be built a second time).
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    gl.setRenderTarget(target);
    const done = gl.compileAsync(scene, camera);
    gl.setRenderTarget(null);
    let alive = true;
    done
      .catch(() => {})
      .then(() => {
        target.dispose();
        if (!alive) return;
        compiled.current = true;
        wake(60);
      });
    // ...and upload every texture now, instead of on the first lit frame.
    for (const set of Object.values(assets.textures)) {
      if (!set) continue;
      gl.initTexture(set.map);
      gl.initTexture(set.normalMap);
      gl.initTexture(set.roughnessMap);
    }
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, model]);

  // A copy of the animation state with everything built and half materialised.
  // Drawing it for the first few frames, while the loading screen still covers
  // the canvas, makes the GPU driver really compile and link every program
  // (gl.compile alone defers that to first use, which cost a multi-second
  // stall mid-scroll), upload geometry and allocate the transmission buffer.
  const warm = useMemo(() => {
    const w = { ...S };
    for (const key of Object.keys(w) as (keyof typeof w)[]) w[key] = 1;
    w.mat = 0.5;
    return w;
  }, []);

  useFrame(() => {
    // nothing of the model is drawn until its programs are ready
    model.root.visible = compiled.current;
    if (!compiled.current) return;
    if (frames.current < WARM_FRAMES) {
      model.update(warm);
      shared.uMat.value = warm.mat;
      shared.uSweep.value = (SWEEP.from + SWEEP.to) / 2;
    } else {
      model.update(S);
    }

    // The shadow map is only needed while the model is materialised, and by
    // then all geometry is static. So it is rendered in a short burst of
    // frames when the lit stage is entered and again when it completes (a
    // single frame proved unreliable), and never otherwise: not while the
    // sweep moves, not on steady frames, not during the drawing stages.
    const was = lastMat.current;
    lastMat.current = S.mat;
    if ((was <= 0.002 && S.mat > 0.002) || (was < 0.999 && S.mat >= 0.999)) settle.current = 8;
    // (the first frames after loading also run it once, to allocate the map
    // behind the loading screen rather than mid-scroll)
    if (frames.current < WARM_FRAMES) gl.shadowMap.needsUpdate = true;
    if (S.mat > 0.002 && settle.current > 0) {
      settle.current--;
      gl.shadowMap.needsUpdate = true;
    }

    // reveal the page only after the warm-up and one normal frame
    if (frames.current < WARM_FRAMES + 2 && ++frames.current === WARM_FRAMES + 2) {
      onReady();
      // now that the page is up, fetch the real surface textures in the background
      loadTextures(gl);
      // ...the photo of the sky, and the furniture models
      loadSky(gl);
      loadFurniture(gl, scene, camera)
        .then((f) => {
          if (!alive.current) return f.dispose();
          furniture.current = f;
        })
        .catch((e) => console.warn('Furniture failed to load', e));
    }
    const f = furniture.current;
    if (f) {
      const was = f.group.visible;
      f.update(camera);
      // the new pieces need to be in the shadow map
      if (f.group.visible && !was) settle.current = 8;
    }
  });

  return (
    <>
      <primitive object={model.root} />
      <Annotations labels={model.labels} />
    </>
  );
}
