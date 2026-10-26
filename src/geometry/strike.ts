import type { StrikeMark } from '../types.ts';
import type { GeometryContext, MarkGeometry, Skeleton } from './types.ts';
import { rng, solidBox } from './util.ts';

export function strike(mark: StrikeMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const t = solidBox(region);
  const rand = rng(ctx.seed, 'strike');
  const strokes: Skeleton[] = [];
  if (mark.crossed) {
    const j = () => (rand() - 0.5) * 3;
    strokes.push({ kind: 'line', pts: [[t[0] + j(), t[1] + j()], [t[0] + t[2] + j(), t[1] + t[3] + j()]] });
    strokes.push({ kind: 'line', pts: [[t[0] + t[2] + j(), t[1] + j()], [t[0] + j(), t[1] + t[3] + j()]] });
  } else {
    const cy = t[1] + t[3] / 2;
    const tilt = (rand() - 0.5) * 4;
    strokes.push({ kind: 'line', pts: [[t[0] - 3, cy + tilt], [t[0] + t[2] + 3, cy - tilt]] });
  }
  return {
    layer: 'marks',
    strokes,
    bounds: { box: t, shape: 'rect', isPoint: false },
    targetBox: t,
    width: ctx.style.stroke.width,
  };
}
