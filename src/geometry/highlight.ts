import type { HighlightMark } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { rectRegion, rng, solidBox } from './util.ts';

const f = (n: number) => Math.round(n * 100) / 100;

export function highlight(mark: HighlightMark, ctx: GeometryContext): MarkGeometry {
  const region = ctx.region(mark.target);
  const t = solidBox(region);
  const rand = rng(ctx.seed, 'highlight');
  const width = Math.max(12, t[3] * 1.05);
  const cy = t[1] + t[3] / 2;
  const x0 = t[0] - 4;
  const x1 = t[0] + t[2] + 4;
  // Hand wobble only on text-height bands. A tall band stays straight, or its ends look skewed.
  const amp = width > 40 ? 0 : 1;
  const j1 = (rand() - 0.5) * 2 * amp;
  const j2 = (rand() - 0.5) * 2 * amp;
  const bow = (rand() - 0.5) * 3 * amp;
  const d = `M ${f(x0)} ${f(cy + j1)} Q ${f((x0 + x1) / 2)} ${f(cy + bow)} ${f(x1)} ${f(cy + j2)}`;
  return {
    layer: 'highlight',
    strokes: [],
    band: { d, width, opacity: mark.opacity ?? 0.5 },
    bounds: rectRegion([x0, cy - width / 2, x1 - x0, width]),
    targetBox: t,
    width,
  };
}
