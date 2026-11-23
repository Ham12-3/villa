import type { Annotation } from '../data/villa';
import { clamp01, type State } from './state';

/** Staggered 0..1 progress of one callout inside its group. */
export function annotationProgress(s: State, a: Annotation, index: number, count: number) {
  const base = a.group === 'details' ? s.annoDetails : s.annoRoof;
  const stagger = 0.8;
  return clamp01(base * (1 + stagger) - (index / Math.max(1, count - 1)) * stagger);
}
