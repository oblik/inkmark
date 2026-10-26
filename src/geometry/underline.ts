import type { Point, UnderlineMark } from '../types.ts';
import type { GeometryContext, MarkGeometry, Skeleton } from './types.ts';
import { rectRegion, rng, solidBox } from './util.ts';

export function underline(mark: UnderlineMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const t = solidBox(region);
  const w = ctx.style.stroke.width;
  const rand = rng(ctx.seed, 'underline');
  const offset = mark.offset ?? 4;
  const y = t[1] + t[3] + offset;
  const strokes: Skeleton[] = [];
  const line = (yy: number, inset: number): Skeleton => {
    const tilt = (rand() - 0.5) * 3;
    const a: Point = [t[0] - 2 + inset, yy + tilt];
    const b: Point = [t[0] + t[2] + 2 - inset, yy - tilt];
    return { kind: 'line', pts: [a, b] };
  };
  strokes.push(line(y, 0));
  let bottom = y;
  if (mark.double) {
    bottom = y + w * 2.2 + 2;
    strokes.push(line(bottom, t[2] * 0.04));
  }
  return {
    layer: 'marks',
    strokes,
    bounds: rectRegion([t[0], y - w, t[2], bottom - y + w * 2]),
    targetBox: t,
    width: w,
  };
}
