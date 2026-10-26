import type { ArrowMark, Point } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { boundsOf, center, rng } from './util.ts';
import { edgePoint } from './util.ts';

export function arrow(mark: ArrowMark, ctx: GeometryContext): MarkGeometry {
  const from = ctx.region(mark.from, true);
  const to = ctx.region(mark.to, true);
  const w = ctx.style.stroke.width;
  const rand = rng(ctx.seed, 'arrow');
  const fc = center(from.box);
  const tc = center(to.box);
  const gap = 6 + w;
  const start = from.isPoint ? fc : edgePoint(from, tc, gap);
  const end = to.isPoint ? edgePoint(to, start, 3) : edgePoint(to, start, gap);

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = mark.bend ?? 0.2;
  const k = bend * len;
  const mid: Point = [(start[0] + end[0]) / 2 + nx * k, (start[1] + end[1]) / 2 + ny * k];
  const q = (t: number): Point => [
    (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * mid[0] + t * t * end[0],
    (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * mid[1] + t * t * end[1],
  ];
  const shaft: Point[] = [0, 0.25, 0.5, 0.75, 1].map(q);
  shaft[0] = start;
  shaft[4] = end;

  // Head at the end, along the tangent.
  const before = q(0.92);
  const hx = end[0] - before[0];
  const hy = end[1] - before[1];
  const hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl;
  const uy = hy / hl;
  const headLen = (mark.head ?? 1) * Math.max(16, w * 3.4);
  const ang = (28 * Math.PI) / 180 + (rand() - 0.5) * 0.1;
  const rot = (a: number): Point => [
    end[0] - (ux * Math.cos(a) - uy * Math.sin(a)) * headLen,
    end[1] - (ux * Math.sin(a) + uy * Math.cos(a)) * headLen,
  ];
  const head: Point[] = [rot(ang), end, rot(-ang)];

  const second = shaft[1];
  const tl = Math.hypot(start[0] - second[0], start[1] - second[1]) || 1;
  const tailDir: Point = [(start[0] - second[0]) / tl, (start[1] - second[1]) / tl];

  let shaftLen = 0;
  for (let i = 1; i < shaft.length; i++) shaftLen += Math.hypot(shaft[i][0] - shaft[i - 1][0], shaft[i][1] - shaft[i - 1][1]);
  return {
    layer: 'marks',
    strokes: [
      { kind: 'curve', pts: shaft },
      { kind: 'poly', pts: head, weight: Math.max(shaftLen * 0.3, headLen * 2) },
    ],
    bounds: { box: boundsOf([...shaft, ...head]), shape: 'rect', isPoint: false },
    targetBox: boundsOf([start, end]),
    arrow: { start, end, tailDir },
    width: w,
  };
}
