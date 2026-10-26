import type { LabelMark } from '../types.ts';
import type { GeometryContext, LabelLayout, MarkGeometry } from './types.ts';
import { rectRegion } from './util.ts';
import type { Box } from '../types.ts';

const MARGIN = 14;
const GAP = 14;

function wrap(text: string, maxWidth: number, size: number, measure: GeometryContext['measure']): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export function label(mark: LabelMark, ctx: GeometryContext): MarkGeometry {
  const { style, frame } = ctx;
  const size = mark.size ?? style.font.size;
  const lh = size * (style.font.lineHeight ?? 1.1);
  const maxWidth = mark.maxWidth ?? Math.min(frame.width * 0.45, size * 12);
  const lines = wrap(mark.text, maxWidth, size, ctx.measure);
  const w = Math.max(...lines.map((l) => ctx.measure(l, size)), 1);
  const h = lines.length * lh;

  const at = mark.at;
  const arrow = 'mark' in at ? ctx.arrowOf(at.mark) : undefined;
  const region = ctx.region(at);
  let x: number;
  let y: number;
  if (arrow && 'mark' in at && (at.end ?? 'start') === 'start') {
    // Next to the arrow tail, on the side away from the arrow.
    const [dx, dy] = arrow.tailDir;
    const reach = Math.abs(dx) * (w / 2) + Math.abs(dy) * (h / 2);
    const cx = arrow.start[0] + dx * (reach + GAP);
    const cy = arrow.start[1] + dy * (reach + GAP);
    x = cx - w / 2;
    y = cy - h / 2;
  } else {
    const [bx, by, bw, bh] = region.box;
    const side = !mark.side || mark.side === 'auto' ? undefined : mark.side;
    if (!side) {
      [x, y] = autoPlace(region.box, w, h, ctx);
    } else if (side === 'top') { x = bx + bw / 2 - w / 2; y = by - GAP - h; }
    else if (side === 'bottom') { x = bx + bw / 2 - w / 2; y = by + bh + GAP; }
    else if (side === 'left') { x = bx - GAP - w; y = by + bh / 2 - h / 2; }
    else { x = bx + bw + GAP; y = by + bh / 2 - h / 2; }
  }
  x = Math.max(MARGIN, Math.min(frame.width - MARGIN - w, x));
  y = Math.max(MARGIN, Math.min(frame.height - MARGIN - h, y));

  const layout: LabelLayout = {
    lines: lines.map((text, i) => ({ text, x, y: y + i * lh + size * 0.82 })),
    fontSize: size,
    lineHeight: lh,
    box: [x, y, w, h],
  };
  return {
    layer: 'marks',
    strokes: [],
    text: layout,
    bounds: rectRegion(layout.box),
    targetBox: region.box,
    width: 0,
  };
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Try each side and a few shifts. Pick the spot with the least overlap. First best wins, so it is deterministic. */
function autoPlace(t: Box, w: number, h: number, ctx: GeometryContext): [number, number] {
  const { frame } = ctx;
  const { marks, text } = ctx.obstacles();
  const [bx, by, bw, bh] = t;
  const cands: [number, number][] = [];
  const shifts = [0, -0.35, 0.35, -0.7, 0.7];
  for (const side of ['bottom', 'top', 'right', 'left'] as const) {
    for (const g of [GAP, GAP * 2.2, GAP * 4, GAP * 6.5]) {
      for (const sh of shifts) {
        if (side === 'top' || side === 'bottom') {
          const x = bx + bw / 2 - w / 2 + sh * (w + bw) / 2;
          cands.push([x, side === 'top' ? by - g - h : by + bh + g]);
        } else {
          const y = by + bh / 2 - h / 2 + sh * (h + bh) / 2;
          cands.push([side === 'left' ? bx - g - w : bx + bw + g, y]);
        }
      }
    }
  }
  const tbox: Box = [bx - 2, by - 2, bw + 4, bh + 4];
  let best = cands[0];
  let bestScore = Infinity;
  for (const c of cands) {
    const x = Math.max(MARGIN, Math.min(frame.width - MARGIN - w, c[0]));
    const y = Math.max(MARGIN, Math.min(frame.height - MARGIN - h, c[1]));
    const box: Box = [x, y, w, h];
    let score = overlap(box, tbox) * 4;
    for (const m of marks) score += overlap(box, m) * 2;
    for (const m of text) score += overlap(box, m);
    // Small pull toward the target, and a penalty for being moved by the frame edge.
    score += Math.hypot(x + w / 2 - (bx + bw / 2), y + h / 2 - (by + bh / 2)) * 4;
    score += (Math.abs(x - c[0]) + Math.abs(y - c[1])) * 30;
    if (score < bestScore - 1e-6) { bestScore = score; best = [x, y]; }
  }
  return best;
}
