import * as THREE from 'three';

const ARC_SEGMENTS = 14;

/**
 * Outline of an opening in wall-elevation space (u along the wall, v up),
 * counter-clockwise starting at the bottom-left corner. Arched openings get a
 * semicircular head; everything else is a rectangle.
 */
export function openingOutline(
  centre: number,
  width: number,
  height: number,
  sill: number,
  arched: boolean,
): THREE.Vector2[] {
  const l = centre - width / 2;
  const r = centre + width / 2;
  const top = sill + height;
  if (!arched) {
    return [
      new THREE.Vector2(l, sill),
      new THREE.Vector2(r, sill),
      new THREE.Vector2(r, top),
      new THREE.Vector2(l, top),
    ];
  }
  const radius = width / 2;
  const spring = top - radius;
  const pts = [new THREE.Vector2(l, sill), new THREE.Vector2(r, sill)];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = (i / ARC_SEGMENTS) * Math.PI;
    pts.push(new THREE.Vector2(centre + Math.cos(a) * radius, spring + Math.sin(a) * radius));
  }
  return pts;
}

/** Flat glass pane filling an arched opening, in wall-elevation space. */
export function buildArchPane(width: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(openingOutline(0, width, height, 0, true));
  const g = new THREE.ShapeGeometry(shape);
  g.deleteAttribute('uv');
  return g;
}
