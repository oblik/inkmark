import type { LabelMark } from '../types.ts';
import type { GeometryContext, LabelLayout, MarkGeometry } from './types.ts';
import { rectRegion } from './util.ts';

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
    const side = !mark.side || mark.side === 'auto' ? pickSide(bx, by, bw, bh, w, h, frame) : mark.side;
    if (side === 'top') { x = bx + bw / 2 - w / 2; y = by - GAP - h; }
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

function pickSide(bx: number, by: number, bw: number, bh: number, w: number, h: number, f: { width: number; height: number }) {
  const space = {
    top: by - MARGIN - GAP - h,
    bottom: f.height - (by + bh) - MARGIN - GAP - h,
    left: bx - MARGIN - GAP - w,
    right: f.width - (bx + bw) - MARGIN - GAP - w,
  };
  let best: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  let score = -Infinity;
  // Prefer top and bottom on ties: text reads better there.
  for (const s of ['bottom', 'top', 'right', 'left'] as const) {
    if (space[s] > score) { score = space[s]; best = s; }
  }
  return best;
}
