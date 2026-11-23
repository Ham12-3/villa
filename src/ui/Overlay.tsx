import type { RefObject } from 'react';
import { chapters } from '../data/chapters';
import { VILLA_NAME } from '../data/villa';

interface Props {
  /** filled with one element per chapter, in order, for the timeline */
  blocks: RefObject<(HTMLElement | null)[]>;
  scrollHint: RefObject<HTMLDivElement | null>;
}

/** Fixed HTML layer: brand, chapter copy on the left, scroll hint, CTA. */
/** Wraps each word in a mask so lines can rise into view. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, k) => (
        <span className="w" key={k}>
          <span>{word}</span>
        </span>
      ))}
    </>
  );
}

export function Overlay({ blocks, scrollHint }: Props) {
  const last = chapters.length - 1;
  return (
    <div className="overlay">
      <header className="brand">
        <span className="brand__name">{VILLA_NAME}</span>
        <span className="brand__meta">Residence 001 — Plan to place</span>
      </header>

      {chapters.map((c, i) => (
        <section
          key={c.id}
          ref={(el) => {
            blocks.current[i] = el;
          }}
          className={`chapter${i === 0 ? ' chapter--hero' : ''}${i === last ? ' chapter--final' : ''}`}
          aria-hidden={i !== 0}
        >
          <p className="chapter__eyebrow">{c.eyebrow}</p>
          {i === 0 ? (
            <h1 className="chapter__title" aria-label={c.title}>
              {c.title.split(" ").map((word, k) => (
                <span className="mask" key={k} aria-hidden="true">
                  <span style={{ transitionDelay: (0.25 + k * 0.14) + "s" }}>{word}</span>
                </span>
              ))}
            </h1>
          ) : (
            <h2 className="chapter__title" aria-label={c.title}>
              <Words text={c.title} />
            </h2>
          )}
          <p className="chapter__desc" aria-label={c.description}>
            {i === 0 ? c.description : <Words text={c.description} />}
          </p>
          {i === last && (
            <a className="cta" href="mailto:viewings@villaserein.example?subject=Private%20viewing">
              <span>Arrange a private viewing</span>
              <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
                <path d="M0 5h16M12 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            </a>
          )}
        </section>
      ))}

      <div className="scroll-hint" ref={scrollHint}>
        <span>Scroll to build</span>
        <i />
      </div>
    </div>
  );
}

export function Loader({ progress, label, done }: { progress: number; label: string; done: boolean }) {
  return (
    <div className={`loader${done ? ' is-done' : ''}`} role="status" aria-live="polite">
      <div className="loader__inner">
        <span className="loader__name">{VILLA_NAME}</span>
        <div className="loader__bar">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="loader__row">
          <span>{label}</span>
          <span>{String(Math.round(progress * 100)).padStart(3, '0')}</span>
        </div>
      </div>
    </div>
  );
}
