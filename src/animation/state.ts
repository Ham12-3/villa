/**
 * Plain numeric animation state. GSAP writes to it from the scroll timeline;
 * the render loop reads it every frame and pushes the values into uniforms.
 * Nothing here ever touches React state.
 */
export const S = {
  grid: 0,
  gridFade: 1,
  site: 0,
  siteFade: 1,

  // ground floor plan
  plan0: 0,
  planFade0: 1,
  rooms0: 0,
  detail0: 0,
  detailFade0: 1,
  slab0: 0,
  walls0: 0,

  // upper floors
  slab1: 0,
  plan1: 0,
  planFade1: 1,
  rooms1: 0,
  walls1: 0,
  slab2: 0,
  plan2: 0,
  planFade2: 1,
  rooms2: 0,
  walls2: 0,
  stairs0: 0,
  stairs1: 0,

  // openings and details
  frames: 0,
  glass: 0,
  terraces: 0,
  railings: 0,
  annoDetails: 0,

  // rooftop
  roof: 0,
  tower: 0,
  towerGlass: 0,
  pergola: 0,
  roofDetails: 0,
  treesRoof: 0,
  treesGarden: 0,
  annoRoof: 0,
  annoFade: 1,

  // level markers
  marker0: 0,
  marker1: 0,
  marker2: 0,
  marker3: 0,
  markerFade: 1,

  // materialisation
  mat: 0,
};

export type State = typeof S;
export type StateKey = keyof State;

/** 0..1 arrival animation, played once after loading (not scroll-driven) */
export const intro = { v: 0 };

/** scroll position (0..100) the camera spline is sampled at */
export const rig = { at: 0 };

/** the damped pose the camera is actually at this frame (written by the rig) */
export const cam = { tx: 0, ty: 0, tz: 0, radius: 170, polar: 0.4, azimuth: 0 };

const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches;

export const env = {
  mobile: mq('(max-width: 820px)'),
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
};

/** switches for profiling and review: ?noao, ?ao (force on), ?notrans, ?msaa=N, ?always */
const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const debug = {
  noAO: qs.has('noao'),
  forceAO: qs.has('ao'),
  noTransmission: qs.has('notrans'),
  /** ?msaa=0|2|4 overrides the multisampling level */
  msaa: qs.has('msaa') ? Number(qs.get('msaa')) : null,
  /** ?always renders every frame instead of on demand */
  always: qs.has('always'),
};

/**
 * The canvas renders on demand. Anything that changes what is on screen calls
 * wake(); the pump in Scene.tsx then renders for that many frames (long
 * enough for the damped camera to settle) and goes quiet again.
 */
export const activity = { frames: 180 };
export const wake = (frames = 150) => {
  if (activity.frames < frames) activity.frames = frames;
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
