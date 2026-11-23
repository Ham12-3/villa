import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { TOTAL_VH } from './data/chapters';
import { createStory, type Story } from './animation/timeline';
import { S, cam, env, intro } from './animation/state';
import type { VillaModel } from './three/assemble';
import { Loader, Overlay } from './ui/Overlay';
import { ProgressRail, setActiveRail, setRailProgress } from './ui/ProgressRail';
import { ReplayButton } from './ui/ReplayButton';
import { Labels } from './ui/Labels';
import { view } from './animation/view';

// three.js, the model builder and the scene are separate chunks, fetched
// after the page shell (loader, hero copy) has painted
const Scene = lazy(() => import('./three/Scene').then((m) => ({ default: m.Scene })));
const loadEngine = () => Promise.all([import('./three/assets'), import('./three/assemble')]);

export default function App() {
  const [model, setModel] = useState<VillaModel | null>(null);
  const [load, setLoad] = useState({ progress: 0, label: 'Preparing drawings' });
  const [ready, setReady] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  const railItems = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollHint = useRef<HTMLDivElement>(null);
  const story = useRef<Story | null>(null);

  // build the geometry (async, reports progress to the loading screen)
  useEffect(() => {
    let cancelled = false;
    let built: VillaModel | null = null;
    // the evening-sky light first (a third of the bar), then the geometry;
    // surface textures load later, after the page is revealed
    let dispose = () => {};
    loadEngine()
      .then(async ([assetsModule, { assembleVilla }]) => {
        dispose = assetsModule.disposeAssets;
        await assetsModule.loadEnvironment((p) => {
          if (!cancelled) setLoad({ progress: p * 0.34, label: 'Loading evening light' });
        });
        return assembleVilla((progress, label) => {
          if (!cancelled) setLoad({ progress: 0.34 + progress * 0.66, label });
        });
      })
      .then((m) => {
        built = m;
        if (cancelled) m.dispose();
        else setModel(m);
      });
    return () => {
      cancelled = true;
      built?.dispose();
      dispose();
    };
  }, []);

  // smooth scroll + the master timeline
  useEffect(() => {
    if (!scroller.current || !stage.current) return;
    const s = createStory({
      scroller: scroller.current,
      stage: stage.current,
      overlays: blocks.current.filter((el): el is HTMLElement => !!el),
      scrollHint: scrollHint.current,
      onProgress: (p) => setRailProgress(railItems.current, p),
      onChapter: (i) => {
        view.chapter = i;
        view.copy = view.copyRects[i] ?? view.copy;
        setActiveRail(railItems.current, i);
        blocks.current.forEach((el, k) => el?.setAttribute('aria-hidden', String(k !== i)));
      },
    });
    story.current = s;
    s.setLocked(true);
    if (import.meta.env.DEV) Object.assign(window, { __villa: { S, cam } });
    return () => {
      s.destroy();
      story.current = null;
    };
  }, []);

  // Tell the camera where the chapter copy sits, so the model can be kept
  // clear of it at any window size (see animation/framing.ts).
  useEffect(() => {
    const measure = () => {
      // one box per chapter (offsets ignore the transforms GSAP animates);
      // the hero has no model to avoid, so it borrows the first chapter's box
      view.copyRects = blocks.current.map((el, i, all) => {
        const b = i === 0 ? all[1] : el;
        if (!b) return { left: 0, top: 0, right: 0, bottom: 0, valid: false };
        return { left: b.offsetLeft, top: b.offsetTop, right: b.offsetLeft + b.offsetWidth, bottom: b.offsetTop + b.offsetHeight, valid: true };
      });
      view.copy = view.copyRects[view.chapter] ?? view.copy;
      view.stacked = window.matchMedia('(max-width: 820px)').matches;
      const rail = document.querySelector('.rail')?.getBoundingClientRect();
      view.rail = rail && !view.stacked ? { left: rail.left, top: rail.top, right: rail.right, bottom: rail.bottom, valid: true } : { ...view.rail, valid: false };
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const onReady = useCallback(() => {
    setReady(true);
    story.current?.setLocked(false);
    // arrival: the sheet settles in while the title is revealed (CSS, .is-ready)
    document.documentElement.classList.add('is-ready');
    if (env.reducedMotion) intro.v = 1;
    else gsap.to(intro, { v: 1, duration: 3.2, ease: 'power3.out', delay: 0.2 });
  }, []);

  return (
    <>
      <div className="stage" ref={stage}>
        <div className="canvas-wrap">
          <Suspense fallback={null}>
            <Scene model={model} onReady={onReady} />
          </Suspense>
        </div>
        <Labels />
        <Overlay blocks={blocks} scrollHint={scrollHint} />
      </div>
      <ProgressRail items={railItems} onJump={(i) => story.current?.goTo(i)} />
      <ReplayButton onClick={() => story.current?.toTop()} />
      <Loader progress={load.progress} label={load.label} done={ready} />
      {/* the tall element that provides the scroll distance */}
      <div className="scroller" ref={scroller} style={{ height: `${TOTAL_VH}vh` }} />
    </>
  );
}
