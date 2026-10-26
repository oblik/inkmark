import type { Box, Point } from '../types.ts';
import type { Region } from './types.ts';
import { createRandom } from '../seed.ts';

/** Box of a region. A point becomes a small box so marks have something to wrap. */
export function solidBox(r: Region, size = 48): Box {
  if (!r.isPoint) return r.box;
  return [r.box[0] - size / 2, r.box[1] - size / 2, size, size];
}

export function center(b: Box): Point {
  return [b[0] + b[2] / 2, b[1] + b[3] / 2];
}

export function boundsOf(pts: Point[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

export function rng(seed: number, salt: string): () => number {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  return createRandom(h);
}

export function pathLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** Point where a ray from the region center toward `from` leaves the region, pushed out by `gap`. */
export function edgePoint(r: Region, from: Point, gap: number): Point {
  const [x, y, w, h] = r.box;
  const c: Point = [x + w / 2, y + h / 2];
  if (r.isPoint) {
    const d = Math.hypot(from[0] - c[0], from[1] - c[1]) || 1;
    return [c[0] + ((from[0] - c[0]) / d) * gap, c[1] + ((from[1] - c[1]) / d) * gap];
  }
  const dx = from[0] - c[0];
  const dy = from[1] - c[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return c;
  const ux = dx / len;
  const uy = dy / len;
  let t: number;
  if (r.shape === 'ellipse') {
    const rx = w / 2, ry = h / 2;
    t = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
  } else {
    const tx = ux !== 0 ? w / 2 / Math.abs(ux) : Infinity;
    const ty = uy !== 0 ? h / 2 / Math.abs(uy) : Infinity;
    t = Math.min(tx, ty);
  }
  if (t >= len) return c; // source is inside the target
  return [c[0] + ux * (t + gap), c[1] + uy * (t + gap)];
}

export const rectRegion = (box: Box): Region => ({ box, shape: 'rect', isPoint: false });
