import type { CircleMark } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { boundsOf, rng, solidBox } from './util.ts';
import type { Point } from '../types.ts';

export function circle(mark: CircleMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const box = solidBox(region);
  const pad = mark.pad ?? 8;
  const loops = mark.loops ?? 1;
  const rand = rng(ctx.seed, 'circle');
  const cx = box[0] + box[2] / 2;
  const cy = box[1] + box[3] / 2;
  // Hug the box like a pen. Wide boxes get a tight ellipse, square ones reach the corners.
  const wide = box[2] >= box[3];
  const asp = Math.max(1, wide ? box[2] / Math.max(box[3], 1) : box[3] / Math.max(box[2], 1));
  const along = 1.12 + 0.294 / asp;
  const across = 1.3 + 0.114 / asp;
  const rx = (box[2] / 2) * (wide ? along : across) + pad;
  const ry = (box[3] / 2) * (wide ? across : along) + pad;
  const start = -Math.PI * 0.8 + (rand() - 0.5) * 0.4;
  const overshoot = 0.3 + rand() * 0.12;
  const total = Math.PI * 2 * loops + overshoot;
  const steps = Math.ceil((total / (Math.PI * 2)) * 12);
  // The pen drifts outward by a fixed number of pixels per loop.
  const drift = ctx.style.stroke.width * (loops === 2 ? 1.6 : 1.1);
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (total * i) / steps;
    const g = (drift * (a - start)) / (Math.PI * 2) + (rand() - 0.5) * 1.5;
    pts.push([cx + Math.cos(a) * (rx + g), cy + Math.sin(a) * (ry + g)]);
  }
  const b = boundsOf(pts);
  return {
    layer: 'marks',
    strokes: [{ kind: 'curve', pts }],
    bounds: { box: b, shape: 'ellipse', isPoint: false },
    targetBox: box,
    width: ctx.style.stroke.width,
  };
}
