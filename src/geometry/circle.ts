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
  const rx = (box[2] / 2) * 1.3 + pad;
  const ry = (box[3] / 2) * 1.3 + pad;
  const start = -Math.PI * 0.8 + (rand() - 0.5) * 0.4;
  const overshoot = 0.45 + rand() * 0.15;
  const total = Math.PI * 2 * loops + overshoot;
  const steps = Math.ceil((total / (Math.PI * 2)) * 12);
  const w = ctx.style.stroke.width;
  const growth = Math.max(loops === 2 ? 0.1 : 0.07, (w * (loops === 2 ? 1.6 : 1.2)) / Math.min(rx, ry));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (total * i) / steps;
    const k = 1 + (growth * (a - start)) / (Math.PI * 2) + (rand() - 0.5) * 0.03;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
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
