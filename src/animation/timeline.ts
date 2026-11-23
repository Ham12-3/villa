import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { chapterAt, chapters } from '../data/chapters';
import { S, env, rig, wake, type StateKey } from './state';

gsap.registerPlugin(ScrollTrigger);

export interface Story {
  /** smooth-scroll to a chapter's settled position */
  goTo: (chapterIndex: number) => void;
  toTop: () => void;
  setLocked: (locked: boolean) => void;
  destroy: () => void;
}

interface Options {
  scroller: HTMLElement;
  /** element faded during stepped (reduced-motion) transitions */
  stage: HTMLElement;
  /** one overlay text block per chapter, in order */
  overlays: HTMLElement[];
  scrollHint: HTMLElement | null;
  onChapter: (index: number) => void;
  /** smoothed story position (0..100), called whenever it changes */
  onProgress?: (percent: number) => void;
}

/**
 * The single master timeline. Its duration is 100 "percent units" and it is
 * scrubbed 1:1 by the page scroll, so every tween below is positioned by the
 * scroll percentage at which it should happen and reverses for free.
 */
function buildTimeline(o: Options) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

  /** tween one state value between two scroll positions */
  const t = (key: StateKey, a: number, b: number, from = 0, to = 1, ease = 'power2.inOut') =>
    tl.fromTo(S, { [key]: from }, { [key]: to, duration: b - a, ease, immediateRender: false }, a);

  // 0 HERO ------------------------------------------------------------
  t('grid', 0.5, 7);

  // 1 SITE PLAN -------------------------------------------------------
  t('site', 8.4, 17.4, 0, 1, 'power1.inOut');

  // 2 GROUND FLOOR PLAN -----------------------------------------------
  t('siteFade', 18, 22, 1, 0.36);
  t('plan0', 18.4, 25.6, 0, 1, 'power1.inOut');
  t('rooms0', 24.4, 27);
  t('detail0', 25, 29.5, 0, 1, 'power1.inOut');

  // 3 EXTRUSION -------------------------------------------------------
  t('rooms0', 30, 32.4, 1, 0);
  t('detailFade0', 30, 33, 1, 0);
  t('slab0', 30, 32.5);
  t('walls0', 32, 41, 0, 1, 'power1.inOut');
  t('planFade0', 33, 40, 1, 0.3);
  t('marker0', 38.5, 41.6);

  // 4 FLOORS STACK ----------------------------------------------------
  t('slab1', 42, 45, 0, 1, 'power3.out');
  t('stairs0', 43, 49, 0, 1, 'none');
  t('plan1', 44.4, 47.6, 0, 1, 'power1.inOut');
  t('rooms1', 46, 47.4);
  t('walls1', 47.4, 51, 0, 1, 'power1.inOut');
  t('rooms1', 48.2, 49.6, 1, 0);
  t('marker1', 49.4, 51.4);
  t('planFade1', 50, 52, 1, 0.3);

  t('slab2', 50.6, 53.2, 0, 1, 'power3.out');
  t('stairs1', 51, 57, 0, 1, 'none');
  t('plan2', 52.6, 55.2, 0, 1, 'power1.inOut');
  t('rooms2', 53.8, 55);
  t('walls2', 54.8, 57.5, 0, 1, 'power1.inOut');
  t('rooms2', 55.4, 56.6, 1, 0);
  t('marker2', 56, 57.5);
  t('planFade2', 57, 58.5, 1, 0.3);

  // 5 OPENINGS AND DETAILS --------------------------------------------
  t('frames', 58.4, 63.6, 0, 1, 'none');
  t('glass', 60, 65.6, 0, 1, 'none');
  t('terraces', 61.4, 66.2, 0, 1, 'none');
  t('railings', 63.4, 69, 0, 1, 'none');
  t('annoDetails', 64.4, 69.4, 0, 1, 'none');

  // 6 ROOF AND ROOFTOP PAVILION ---------------------------------------
  t('annoDetails', 70, 71.6, 1, 0);
  t('roof', 70.2, 73, 0, 1, 'power3.out');
  t('tower', 72, 76, 0, 1, 'power2.out');
  t('pergola', 72.8, 78, 0, 1, 'none');
  t('roofDetails', 73.4, 76.6, 0, 1, 'none');
  t('treesGarden', 74, 79.4, 0, 1, 'none');
  t('towerGlass', 75, 77.2);
  t('treesRoof', 75.6, 79, 0, 1, 'none');
  t('annoRoof', 76.4, 79.4, 0, 1, 'none');
  t('marker3', 77.2, 79.5);

  // 7 MATERIALISATION -------------------------------------------------
  t('gridFade', 80, 86, 1, 0);
  t('annoFade', 80.6, 83, 1, 0);
  t('mat', 80.8, 91, 0, 1, 'sine.inOut');
  // level markers belong to the drawing: they leave as the building arrives
  t('markerFade', 80.8, 85.5, 1, 0);

  // 8 FINAL REVEAL ----------------------------------------------------

  // CAMERA — a single linear tween moves the sample point along the
  // camera spline; all easing lives in the spline itself (cameraPath.ts)
  tl.fromTo(rig, { at: 0 }, { at: 100, duration: 100, ease: 'none', immediateRender: false }, 0);

  // CHAPTER COPY — headline and body rise line by line from behind a mask,
  // scrubbed by scroll like everything else. Each block hands over to the
  // next just after the chapter boundary, so it is still fully visible at
  // the chapter's rest point.
  o.overlays.forEach((el, i) => {
    const c = chapters[i];
    if (i === 0) {
      gsap.set(el, { autoAlpha: 1, y: 0 }); // the hero plays its own arrival (CSS)
    } else {
      const at = c.start + 0.7;
      gsap.set(el, { autoAlpha: 0 });
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', immediateRender: false }, at);
      const eyebrow = el.querySelector('.chapter__eyebrow');
      if (eyebrow) {
        tl.fromTo(eyebrow, { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, at);
      }
      // group the word spans into visual lines (by their top offset)
      const lines: HTMLElement[][] = [];
      let lastTop = -1;
      let lastParent: Element | null = null;
      el.querySelectorAll<HTMLElement>('.w > span').forEach((w) => {
        const mask = w.parentElement as HTMLElement;
        const block = mask.parentElement;
        if (block !== lastParent || Math.abs(mask.offsetTop - lastTop) > 4) {
          lines.push([]);
          lastTop = mask.offsetTop;
          lastParent = block;
        }
        lines[lines.length - 1].push(w);
      });
      lines.forEach((line, k) => {
        gsap.set(line, { yPercent: 112 });
        tl.fromTo(
          line,
          { yPercent: 112 },
          { yPercent: 0, duration: 1.15, ease: 'power3.out', immediateRender: false },
          at + 0.15 + k * 0.2,
        );
      });
      const cta = el.querySelector('.cta');
      if (cta) {
        tl.fromTo(cta, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, at + 0.5 + lines.length * 0.2);
      }
    }
    if (i < chapters.length - 1) {
      tl.fromTo(
        el,
        { autoAlpha: 1, y: 0 },
        { autoAlpha: 0, y: -22, duration: 0.8, ease: 'power2.in', immediateRender: false },
        c.end - 0.3,
      );
    }
  });
  if (o.scrollHint) {
    tl.fromTo(o.scrollHint, { autoAlpha: 1 }, { autoAlpha: 0, duration: 2, immediateRender: false }, 1);
  }

  // pad the timeline to exactly 100 units
  tl.set({}, {}, 100);
  return tl;
}

export function createStory(o: Options): Story {
  const tl = buildTimeline(o);
  let lenis: Lenis | null = null;
  let current = -1;
  let stepTimer = 0;
  let raf: ((time: number) => void) | null = null;

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const yFor = (percent: number) => (percent / 100) * maxScroll();

  const setChapter = (i: number) => {
    if (i === current) return false;
    current = i;
    o.onChapter(i);
    return true;
  };

  let trigger: ScrollTrigger;
  let lastP = -1;
  const feed = () => {
    const p = tl.progress() * 100;
    if (Math.abs(p - lastP) < 0.005) return;
    lastP = p;
    wake(); // the picture is changing: keep the canvas rendering
    o.onProgress?.(p);
  };
  gsap.ticker.add(feed);

  if (env.reducedMotion) {
    // Stepped version: no scrubbing, no smooth scroll. Each chapter is shown
    // in its settled state and chapters cross-fade.
    o.stage.style.transition = 'opacity 0.35s ease';
    tl.progress(0);
    trigger = ScrollTrigger.create({
      trigger: o.scroller,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const i = chapterAt(self.progress * 100);
        if (!setChapter(i)) return;
        window.clearTimeout(stepTimer);
        o.stage.style.opacity = '0';
        stepTimer = window.setTimeout(() => {
          tl.progress(chapters[i].rest / 100);
          o.stage.style.opacity = '1';
        }, 360);
      },
    });
    setChapter(0);
  } else {
    // low lerp = long, weighted glide after each wheel tick
    lenis = new Lenis({ lerp: env.mobile ? 0.1 : 0.068, wheelMultiplier: 0.8, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    raf = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    trigger = ScrollTrigger.create({
      animation: tl,
      trigger: o.scroller,
      start: 'top top',
      end: 'bottom bottom',
      // the timeline trails the scroll position, so nothing ever snaps
      scrub: env.mobile ? 0.6 : 1.1,
      onUpdate: (self) => setChapter(chapterAt(self.progress * 100)),
    });
    setChapter(chapterAt(trigger.progress * 100));
  }

  const scrollTo = (y: number, duration: number) => {
    if (lenis) lenis.scrollTo(y, { duration, easing: (x) => 1 - Math.pow(1 - x, 3) });
    else window.scrollTo({ top: y, behavior: 'auto' });
  };

  return {
    goTo: (i) => {
      const c = chapters[i];
      const y = yFor(c.rest);
      const distance = Math.abs(window.scrollY - y) / Math.max(1, maxScroll());
      scrollTo(y, 1.2 + distance * 4);
    },
    toTop: () => scrollTo(0, 2.6),
    setLocked: (locked) => {
      document.documentElement.classList.toggle('is-locked', locked);
      if (locked) lenis?.stop();
      else lenis?.start();
    },
    destroy: () => {
      window.clearTimeout(stepTimer);
      if (raf) gsap.ticker.remove(raf);
      gsap.ticker.remove(feed);
      trigger.kill();
      tl.kill();
      lenis?.destroy();
      lenis = null;
    },
  };
}
