import type { ScribbleMark } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { boundsOf, rectRegion } from './util.ts';

/** Scribble points are already in frame space (the caller maps them). */
export function scribble(mark: ScribbleMark, ctx: GeometryContext, pts: [number, number][]): MarkGeometry {
  const b = boundsOf(pts);
  return {
    layer: 'marks',
    strokes: [{ kind: 'curve', pts }],
    bounds: rectRegion(b),
    targetBox: b,
    width: mark.thickness ?? ctx.style.stroke.width,
  };
}
