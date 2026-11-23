import type { RefObject } from 'react';
import { chapters } from '../data/chapters';

interface Props {
  /** one button per chapter index (hero slot stays null) */
  items: RefObject<(HTMLButtonElement | null)[]>;
  onJump: (chapterIndex: number) => void;
}

/** Fixed left rail listing the chapters; click to jump. */
export function ProgressRail({ items, onJump }: Props) {
  return (
    <nav className="rail" aria-label="Chapters">
      <ol>
        {chapters.map((c, i) =>
          c.rail ? (
            <li key={c.id}>
              <button
                type="button"
                ref={(el) => {
                  items.current[i] = el;
                }}
                onClick={() => onJump(i)}
              >
                <i>
                  <b />
                </i>
                <span>{c.rail}</span>
              </button>
            </li>
          ) : null,
        )}
      </ol>
    </nav>
  );
}

/** Fills each section's line with how far the story is through it (0..100). */
export function setRailProgress(items: (HTMLButtonElement | null)[], percent: number) {
  items.forEach((el, i) => {
    if (!el) return;
    const c = chapters[i];
    const f = Math.min(1, Math.max(0, (percent - c.start) / (c.end - c.start)));
    const v = f.toFixed(3);
    if (el.dataset.f !== v) {
      el.dataset.f = v;
      el.style.setProperty('--fill', v);
    }
  });
}

/** Highlights the active chapter without going through React state. */
export function setActiveRail(items: (HTMLButtonElement | null)[], active: number) {
  items.forEach((el, i) => {
    if (!el) return;
    const on = i === active;
    el.classList.toggle('is-active', on);
    el.classList.toggle('is-past', i < active);
    if (on) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  });
}
