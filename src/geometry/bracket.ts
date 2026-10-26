import type { BracketMark, Point } from '../types.ts';
import type { GeometryContext, MarkGeometry, Skeleton } from './types.ts';
import { rectRegion, rng, solidBox } from './util.ts';

export function bracket(mark: BracketMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const t = solidBox(region);
  const pad = mark.pad ?? 8;
  const sides = mark.sides ?? ['left'];
  const rand = rng(ctx.seed, 'bracket');
  const x0 = t[0] - pad, y0 = t[1] - pad;
  const x1 = t[0] + t[2] + pad, y1 = t[1] + t[3] + pad;
  const tick = Math.max(8, Math.min(16, Math.min(x1 - x0, y1 - y0) * 0.3));
  const j = () => (rand() - 0.5) * 2;
  const strokes: Skeleton[] = [];
  for (const side of sides) {
    let pts: Point[];
    if (side === 'left') pts = [[x0 + tick, y0 + j()], [x0, y0], [x0 + j(), y1], [x0 + tick, y1 + j()]];
    else if (side === 'right') pts = [[x1 - tick, y0 + j()], [x1, y0], [x1 + j(), y1], [x1 - tick, y1 + j()]];
    else if (side === 'top') pts = [[x0 + j(), y0 + tick], [x0, y0], [x1, y0 + j()], [x1 + j(), y0 + tick]];
    else pts = [[x0 + j(), y1 - tick], [x0, y1], [x1, y1 + j()], [x1 + j(), y1 - tick]];
    strokes.push({ kind: 'poly', pts });
  }
  return {
    layer: 'marks',
    strokes,
    bounds: rectRegion([x0, y0, x1 - x0, y1 - y0]),
    targetBox: t,
    width: ctx.style.stroke.width,
  };
}
