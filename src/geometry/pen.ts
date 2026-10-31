import type { RoughGenerator } from 'roughjs/bin/generator';
import { getStroke } from 'perfect-freehand';
import type { Point, Style } from '../types.ts';
import type { Skeleton } from './types.ts';
import { createRandom } from '../seed.ts';
import { pathLength } from './util.ts';

/** One drawn stroke, ready for the DOM. */
export type PenPart =
  /** Rough pen: stroked SVG paths. The stroke draws on. */
  | { kind: 'stroke'; paths: string[]; weight: number }
  /** Marker pen: a filled outline. A mask with the centerline reveals it. */
  | { kind: 'fill'; outline: string; center: string; maskWidth: number; weight: number };

// The rough pen code loads only when a style uses it. Most styles use the freehand pen.
let generator: RoughGenerator | undefined;
let loading: Promise<void> | undefined;

/** Loads the pen code a style needs. Call it before `renderStrokes`. */
export function loadPen(style: Style): Promise<void> {
  if (style.pen !== 'rough' || generator) return Promise.resolve();
  loading ??= import('roughjs').then((m) => { generator = m.default.generator(); });
  return loading;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function renderStrokes(strokes: Skeleton[], style: Style, seed: number, width: number): PenPart[] {
  return strokes.map((s, i) => {
    const weight = s.weight ?? Math.max(pathLength(s.pts), 1);
    const sd = (seed + i * 7919) >>> 0;
    return style.pen === 'rough' ? roughPart(s, style, sd, width, weight) : freehandPart(s, style, sd, width, weight);
  });
}

function roughPart(s: Skeleton, style: Style, seed: number, width: number, weight: number): PenPart {
  if (!generator) throw new Error('Inkmark: the rough pen is not loaded. Call loadPen(style) first.');
  const o = {
    seed: seed || 1,
    roughness: style.stroke.roughness,
    bowing: style.stroke.bowing,
    strokeWidth: width,
    preserveVertices: s.kind === 'poly',
    stroke: '#000',
  };
  const pts = s.pts;
  const drawable =
    s.kind === 'line' ? generator.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], o)
    : s.kind === 'poly' ? generator.linearPath(pts, o)
    : generator.curve(pts, o);
  const paths = generator.toPaths(drawable).filter((p) => p.stroke !== 'none' && (!p.fill || p.fill === 'none')).map((p) => p.d);
  return { kind: 'stroke', paths, weight };
}

// Smooth 1D noise from two sine waves with seeded phases.
function noise(rand: () => number) {
  const p1 = rand() * 6.28, p2 = rand() * 6.28, l1 = 70 + rand() * 40, l2 = 31 + rand() * 20;
  return (s: number) => (Math.sin(s / l1 * 6.2832 + p1) * 0.6 + Math.sin(s / l2 * 6.2832 + p2) * 0.4);
}

function sample(s: Skeleton, step: number): Point[] {
  const out: Point[] = [];
  const seg = (a: Point, b: Point, last: boolean) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 0; i < n + (last ? 1 : 0); i++) {
      const t = i / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  };
  const pts = s.pts;
  if (s.kind === 'curve' && pts.length > 2) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.max(2, Math.ceil(len / step));
      for (let k = 0; k < n + (i === pts.length - 2 ? 1 : 0); k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
  } else {
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], i === pts.length - 2);
  }
  return out;
}

function outlinePath(points: number[][]): string {
  const n = points.length;
  if (n < 4) return '';
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M ${r1(points[0][0])} ${r1(points[0][1])} Q`;
  for (let i = 0; i < n; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    d += ` ${r1(points[i][0])} ${r1(points[i][1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return d + ' Z';
}

function freehandPart(s: Skeleton, style: Style, seed: number, width: number, weight: number): PenPart {
  const rand = createRandom(seed);
  const wob = noise(rand);
  const prs = noise(rand);
  const amp = 0.7 * style.stroke.roughness;
  const base = sample(s, 3);
  // Distance along the stroke.
  const dist: number[] = [0];
  for (let i = 1; i < base.length; i++) dist.push(dist[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
  const total = dist[dist.length - 1];
  const center: Point[] = base.map((p, i) => {
    const a = base[Math.max(0, i - 1)], b = base[Math.min(base.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const off = wob(dist[i]) * amp;
    return [p[0] + (-(b[1] - a[1]) / l) * off, p[1] + ((b[0] - a[0]) / l) * off];
  });
  const input = center.map((p, i) => [p[0], p[1], 0.52 + prs(dist[i]) * 0.3]);
  const outline = getStroke(input, {
    size: width,
    thinning: style.stroke.thinning,
    smoothing: 0.5,
    streamline: 0.35,
    simulatePressure: false,
    last: true,
    start: { cap: true },
    end: { cap: true, taper: total > 60 ? Math.min(width * 2.5, total * 0.25) : false },
  });
  const step = Math.max(1, Math.round(center.length / 80));
  let c = '';
  center.forEach((p, i) => {
    if (i % step === 0 || i === center.length - 1) c += `${c ? ' L' : 'M'} ${r1(p[0])} ${r1(p[1])}`;
  });
  return { kind: 'fill', outline: outlinePath(outline), center: c, maskWidth: width * 2.2 + 6, weight };
}
