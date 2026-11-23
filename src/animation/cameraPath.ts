import { cameraPath, cameraPathMobile, type CameraKey, type CameraPose } from '../data/chapters';

/**
 * One continuous camera move for the whole story.
 *
 * Every pose channel (target, distance, tilt, orbit) is a monotone cubic
 * Hermite spline (Fritsch–Carlson / PCHIP) through the keyframes, sampled by
 * scroll position. That gives a C1-continuous path with no overshoot: the
 * camera never dips below plan view, never bounces past a key, and holds
 * perfectly still wherever consecutive keys are equal.
 */
class Channel {
  private m: number[];

  constructor(
    private xs: number[],
    private ys: number[],
  ) {
    const n = xs.length;
    const h: number[] = [];
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      h.push(xs[i + 1] - xs[i]);
      d.push((ys[i + 1] - ys[i]) / h[i]);
    }
    // zero slope at both ends: the move eases out of rest and back into it
    this.m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) continue;
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      this.m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }

  at(x: number): number {
    const { xs, ys, m } = this;
    const n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  }
}

export interface PoseValues {
  tx: number;
  ty: number;
  tz: number;
  radius: number;
  polar: number;
  azimuth: number;
}

export function createCameraPath(mobile: boolean) {
  const keys: CameraKey[] = mobile ? cameraPathMobile : cameraPath;
  const xs = keys.map((k) => k.at);
  const ch = (pick: (p: CameraPose) => number) => new Channel(xs, keys.map((k) => pick(k.pose)));
  const tx = ch((p) => p.target[0]);
  const ty = ch((p) => p.target[1]);
  const tz = ch((p) => p.target[2]);
  const radius = ch((p) => p.radius);
  const polar = ch((p) => p.polar);
  const azimuth = ch((p) => p.azimuth);

  /** write the pose at scroll position `at` (0..100) into `out` */
  return (at: number, out: PoseValues) => {
    out.tx = tx.at(at);
    out.ty = ty.at(at);
    out.tz = tz.at(at);
    out.radius = radius.at(at);
    out.polar = polar.at(at);
    out.azimuth = azimuth.at(at);
    return out;
  };
}
