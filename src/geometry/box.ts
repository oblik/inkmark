import type { BoxMark, Point } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { rectRegion, rng, solidBox } from './util.ts';

export function box(mark: BoxMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const t = solidBox(region);
  const pad = mark.pad ?? 8;
  const rand = rng(ctx.seed, 'box');
  const x0 = t[0] - pad, y0 = t[1] - pad;
  const x1 = t[0] + t[2] + pad, y1 = t[1] + t[3] + pad;
  const over = 6 + rand() * 6;
  // Start a bit down the left side, go around, finish past the start.
  const pts: Point[] = [
    [x0 + 1, y0 + over],
    [x0, y0],
    [x1, y0 + (rand() - 0.5) * 2],
    [x1 + (rand() - 0.5) * 2, y1],
    [x0, y1],
    [x0 + (rand() - 0.5) * 2, y0 - 1],
    [x0 + over * 1.4, y0],
  ];
  return {
    layer: 'marks',
    strokes: [{ kind: 'poly', pts }],
    bounds: rectRegion([x0, y0, x1 - x0, y1 - y0]),
    targetBox: t,
    width: ctx.style.stroke.width,
  };
}
