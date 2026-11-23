import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { S, clamp01, env, type State } from '../animation/state';
import type { VillaModel } from '../three/assemble';

interface Item {
  key: string;
  position: [number, number, number];
  className: string;
  content: React.ReactNode;
  opacity: (s: State) => number;
}

const Z_RANGE: [number, number] = [6, 0];

/**
 * Text that lies on the drawing itself: room names and dimensions. Each is a
 * drei <Html> pinned to a 3D point (level markers and callouts are in Labels);
 * opacity is written straight to the DOM from the animation state.
 */
export function Annotations({ labels }: { labels: VillaModel['labels'] }) {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const last = useRef<number[]>([]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];

    labels.rooms.forEach((r, i) => {
      if (env.mobile && r.level > 0) return;
      const key = `rooms${r.level}` as 'rooms0';
      out.push({
        key: `room-${i}`,
        position: r.position,
        className: 'tag tag--room',
        content: (
          <>
            {r.name}
            {r.note && <small>{r.note}</small>}
          </>
        ),
        opacity: (s) => s[key],
      });
    });

    if (!env.mobile) {
      labels.dims.forEach((d, i) => {
        out.push({
          key: `dim-${i}`,
          position: d.position,
          className: 'tag tag--dim',
          content: d.text,
          opacity: (s) => clamp01(s.detail0 * 2 - 1) * s.detailFade0,
        });
      });
    }

    return out;
  }, [labels]);

  useFrame(() => {
    for (let i = 0; i < items.length; i++) {
      const el = els.current[i];
      if (!el) continue;
      const o = Math.round(items[i].opacity(S) * 100) / 100;
      if (o === last.current[i]) continue;
      last.current[i] = o;
      el.style.opacity = String(o);
      el.style.visibility = o <= 0 ? 'hidden' : 'visible';
    }
  });

  return (
    <>
      {items.map((it, i) => (
        <Html key={it.key} position={it.position} zIndexRange={Z_RANGE} style={{ pointerEvents: 'none' }}>
          <div
            ref={(el) => {
              els.current[i] = el;
              if (el) last.current[i] = -1;
            }}
            className={it.className}
            style={{ opacity: 0, visibility: 'hidden' }}
          >
            {it.content}
          </div>
        </Html>
      ))}
    </>
  );
}
