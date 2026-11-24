# Villa Serein

A scroll-driven 3D architectural story. As you scroll, a villa goes from a 2D
site plan to the finished house: Site, Plan, Structure, Floors, Details,
Rooftop, Material, Villa. Then a walkthrough: in over the pool and through the
glazing to the living room, entrance lobby, dining room and kitchen, up the
stair to the gallery, bathroom and master bedroom, out over the terrace to
the swimming pool, through an arch into the pool lounge, and out to the
garden for a last look back. Scrolling back reverses everything.

The walkthrough route is `src/data/tour.ts` (eye and look-at points through the
real door openings) and the furnishings are `src/data/interior.ts`.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Stack

Vite, React, TypeScript, three.js, @react-three/fiber, @react-three/postprocessing,
GSAP ScrollTrigger (one master timeline) and Lenis for smooth scroll.

## How it works

- **One source of truth.** `src/data/villa.ts` describes the site, levels, walls,
  openings, stairs, terraces and rooftop. Both the 2D plans and the 3D building
  are generated from it by the builders in `src/three/builders`. There is no
  downloaded model.
- **One timeline.** `src/animation/timeline.ts` tweens plain numbers in
  `src/animation/state.ts`, scrubbed by scroll. The render loop copies them into
  shader uniforms. No React state changes while scrolling.
- **One camera move.** `src/animation/cameraPath.ts` is a monotone spline through
  the keyframes in `src/data/chapters.ts`, followed with damping.
- **One reveal shader.** Lines and solids share the same grow / drop / draw
  logic and the same materialisation front (`src/three/materials.ts`), so
  linework disappears exactly where material arrives.
- **Safe zone.** `src/animation/framing.ts` keeps the model clear of the copy and
  the rail at any window size. `src/ui/Labels.tsx` projects level labels and
  callouts each frame and routes leaders clear of the building.

## Performance

- The canvas renders on demand: nothing is drawn while idle on a drawing stage.
- Pixel ratio is clamped (1.75 desktop, 1.5 small screens) and steps down if
  frames run long.
- Ambient occlusion is on for discrete GPUs only; real glass transmission is
  desktop only. Shadows are rendered in short bursts, not every frame.
- Shaders are compiled in parallel behind the loading screen.
- three.js and the scene are separate chunks loaded after the page shell.
- Surface textures are KTX2 (Basis) with mipmaps, loaded after first paint.
- `prefers-reduced-motion` gets a stepped version with cross-fades.

## Scripts

- `npm run shots -- <label> [--mobile] [--reverse] [--reduced] [--size=1024x768] [--at=40,55]`
  screenshots the story at scroll positions into `shots/` (uses installed Edge or Chrome).
- `node scripts/motion.mjs` checks the camera spline and measures frame-by-frame motion.
- `node scripts/perf.mjs` measures load time and frame times.
- `npm run textures` re-encodes `assets-src/tex` to KTX2 in `public/assets/tex`.

## Review switches

Add to the URL: `?ao` forces ambient occlusion on, `?noao` off, `?notrans`
disables glass transmission, `?msaa=0|2|4` sets multisampling, `?always`
renders every frame.

## Assets

CC0 HDRI and textures from Poly Haven; see `public/assets/CREDITS.md`.
