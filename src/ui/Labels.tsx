import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { S, clamp01, env } from '../animation/state';
import { LABEL_COLUMN, convexHull, projectPoint, rayHitsHull, view } from '../animation/view';
import { annotationProgress } from '../animation/annotations';
import { boxCorners, markerCandidates, volumes } from '../data/massing';
import { annotations, formatElevation } from '../data/villa';

const scratch: [number, number] = [0, 0];
const MARKER_KEYS = ['marker0', 'marker1', 'marker2', 'marker3'] as const;

/**
 * Level markers and feature callouts, drawn in HTML/SVG over the canvas.
 *
 * Every frame (called by the camera rig, so never a frame behind) each label
 * is re-projected from a real 3D point on the model:
 *  - a level marker starts from a point on that floor's edge, chosen so that
 *    a leader running right from it does not pass over any part of the
 *    house, and ends in a label column in the right-hand margin;
 *  - a callout starts on the outer edge of its feature and leads away from
 *    the building.
 * Labels fade and slide in with the floor they belong to.
 */
export function Labels() {
  const root = useRef<HTMLDivElement>(null);
  const callouts = useMemo(() => annotations.filter((a) => !(env.mobile && a.desktopOnly)), []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends Element>(sel: string) => Array.from(el.querySelectorAll<T>(sel));
    const mLabel = q<HTMLDivElement>('.lvl');
    const mLine = q<SVGLineElement>('.lvl-line');
    const mTick = q<SVGLineElement>('.lvl-tick');
    const cLabel = q<HTMLDivElement>('.call');
    const cLine = q<SVGLineElement>('.call-line');
    const cDot = q<SVGCircleElement>('.call-dot');

    // scratch buffers
    const hulls: number[][] = volumes.map(() => []);
    const corners = volumes.map(boxCorners);
    const buf = new Float32Array(16);
    const ax = markerCandidates.map(() => NaN); // damped anchor positions
    const ay = markerCandidates.map(() => NaN);
    const pick = markerCandidates.map(() => -1);
    const sx = new Float32Array(32);
    const sy = new Float32Array(32);
    const labelY: number[] = [];
    const widths = mLabel.map(() => 0);
    let last = performance.now();

    const set = (n: Element, name: string, val: number) => n.setAttribute(name, val.toFixed(1));

    const update = (camera: THREE.PerspectiveCamera, w: number, h: number) => {
      const now = performance.now();
      const k = env.reducedMotion ? 1 : 1 - Math.exp(-((now - last) / 1000) * 9);
      last = now;
      const px = (p: readonly number[]) => projectPoint(camera, p, w, h, scratch);

      // ---- level markers
      const anyMarker = MARKER_KEYS.some((key) => S[key] > 0.001) && S.markerFade > 0.001;
      if (anyMarker) {
        // screen-space hull of every building volume
        for (let b = 0; b < volumes.length; b++) {
          for (let i = 0; i < 8; i++) {
            const [x, y] = px(corners[b][i]);
            buf[i * 2] = x;
            buf[i * 2 + 1] = y;
          }
          convexHull(buf, 8, hulls[b]);
        }
      }
      let column = 0;
      const shown: number[] = [];
      markerCandidates.forEach((mc, i) => {
        const prog = S[MARKER_KEYS[i]];
        const label = mLabel[i];
        if (!anyMarker || prog <= 0.001) {
          label.style.visibility = 'hidden';
          mLine[i].style.visibility = mTick[i].style.visibility = 'hidden';
          ax[i] = NaN;
          return;
        }
        // candidates whose rightward leader is clear of every volume
        let best = -1;
        let bestX = -Infinity;
        for (let c = 0; c < mc.points.length; c++) {
          const [x, y] = px(mc.points[c]);
          sx[c] = x;
          sy[c] = y;
          let clear = true;
          for (let b = 0; b < volumes.length && clear; b++) clear = !rayHitsHull(hulls[b], x + 1.5, y);
          // prefer the current choice a little, so it does not flicker between two
          const score = x + (c === pick[i] ? 12 : 0);
          if (clear && score > bestX) {
            bestX = score;
            best = c;
          }
        }
        if (best < 0) {
          // nothing clear from this angle: better no leader than one over the house
          label.style.visibility = 'hidden';
          mLine[i].style.visibility = mTick[i].style.visibility = 'hidden';
          return;
        }
        pick[i] = best;
        // glide to the chosen point (also when the choice changes)
        ax[i] = Number.isNaN(ax[i]) ? sx[best] : ax[i] + (sx[best] - ax[i]) * k;
        ay[i] = Number.isNaN(ay[i]) ? sy[best] : ay[i] + (sy[best] - ay[i]) * k;
        column = Math.max(column, ax[i]);
        shown.push(i);
        if (!widths[i]) widths[i] = label.offsetWidth;
      });

      if (shown.length) {
        const maxW = Math.max(...shown.map((i) => widths[i]));
        const gutter = env.mobile ? 14 : 40;
        const col = Math.min(column + (env.mobile ? 26 : LABEL_COLUMN - maxW - 46), w - gutter - maxW);
        // stack labels top to bottom, at their own height, never closer than a line
        shown.sort((a, b) => ay[a] - ay[b]);
        shown.forEach((i, n) => {
          labelY[i] = n === 0 ? ay[i] : Math.max(ay[i], labelY[shown[n - 1]] + 22);
        });
        for (const i of shown) {
          const prog = S[MARKER_KEYS[i]];
          const draw = clamp01(prog * 1.7);
          const text = clamp01(prog * 2.4 - 1.4) * S.markerFade;
          const x1 = ax[i] + 3;
          const x2 = Math.max(x1, col - 12);
          set(mLine[i], 'x1', x1);
          set(mLine[i], 'y1', ay[i]);
          set(mLine[i], 'x2', x1 + (x2 - x1) * draw);
          set(mLine[i], 'y2', ay[i] + (labelY[i] - ay[i]) * draw);
          set(mTick[i], 'x1', ax[i]);
          set(mTick[i], 'x2', ax[i]);
          set(mTick[i], 'y1', ay[i] - 5);
          set(mTick[i], 'y2', ay[i] + 5);
          mLine[i].style.visibility = mTick[i].style.visibility = 'visible';
          mLine[i].style.opacity = mTick[i].style.opacity = String(S.markerFade * 0.75);
          const label = mLabel[i];
          label.style.visibility = text > 0 ? 'visible' : 'hidden';
          label.style.opacity = text.toFixed(2);
          // slides in from the building side as it fades up
          label.style.transform = `translate(${(col - (1 - text) * 16).toFixed(1)}px, ${labelY[i].toFixed(1)}px) translateY(-50%)`;
        }
      }

      // ---- callouts
      const scale = Math.min(1.1, Math.max(0.62, w / 1440));
      callouts.forEach((a, i) => {
        const list = annotations.filter((o) => o.group === a.group);
        const prog = annotationProgress(S, a, list.indexOf(a), list.length);
        const fade = S.annoFade;
        if (prog <= 0.001 || fade <= 0.001) {
          cLabel[i].style.visibility = cLine[i].style.visibility = cDot[i].style.visibility = 'hidden';
          return;
        }
        const [x, y] = px(a.anchor);
        const ox = a.offset[0] * scale;
        const oy = a.offset[1] * scale;
        const draw = clamp01(prog * 1.6);
        const text = clamp01(prog * 3 - 2) * fade;
        set(cLine[i], 'x1', x);
        set(cLine[i], 'y1', y);
        set(cLine[i], 'x2', x + ox * draw);
        set(cLine[i], 'y2', y + oy * draw);
        set(cDot[i], 'cx', x);
        set(cDot[i], 'cy', y);
        cLine[i].style.visibility = cDot[i].style.visibility = 'visible';
        cLine[i].style.opacity = cDot[i].style.opacity = String(fade * 0.8);
        const label = cLabel[i];
        label.style.visibility = text > 0 ? 'visible' : 'hidden';
        label.style.opacity = text.toFixed(2);
        // the label sits beyond the end of its leader, on the side it points to
        const tx = ox < -20 ? 'translateX(-100%) translateX(-10px)' : ox > 20 ? 'translateX(10px)' : 'translateX(-50%)';
        const ty = Math.abs(ox) > 20 ? 'translateY(-50%)' : oy < 0 ? 'translateY(-100%) translateY(-8px)' : 'translateY(8px)';
        label.style.transform = `translate(${(x + ox).toFixed(1)}px, ${(y + oy).toFixed(1)}px) ${tx} ${ty}`;
      });
    };

    view.listeners.add(update);
    return () => {
      view.listeners.delete(update);
    };
  }, [callouts]);

  return (
    <div className="labels" ref={root} aria-hidden="true">
      <svg className="labels__lines">
        {markerCandidates.map((mc) => (
          <g key={mc.marker.id}>
            <line className="lvl-line" />
            <line className="lvl-tick" />
          </g>
        ))}
        {callouts.map((a) => (
          <g key={a.id}>
            <line className="call-line" />
            <circle className="call-dot" r="2" />
          </g>
        ))}
      </svg>
      {markerCandidates.map((mc) => (
        <div className="lvl" key={mc.marker.id}>
          <i>▽</i>
          <span>{mc.marker.label}</span>
          <b>{formatElevation(mc.marker.elevation)}</b>
        </div>
      ))}
      {callouts.map((a) => (
        <div className="call" key={a.id}>
          {a.text}
        </div>
      ))}
    </div>
  );
}
