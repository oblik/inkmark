import type { Mark, Point } from '../types.ts';
import type { GeometryContext, MarkGeometry } from './types.ts';
import { circle } from './circle.ts';
import { box } from './box.ts';
import { underline } from './underline.ts';
import { highlight } from './highlight.ts';
import { strike } from './strike.ts';
import { bracket } from './bracket.ts';
import { arrow } from './arrow.ts';
import { label } from './label.ts';
import { scribble } from './scribble.ts';

/** `scribblePoints` are the scribble points already mapped to frame space. */
export function buildGeometry(mark: Mark, ctx: GeometryContext, scribblePoints?: Point[]): MarkGeometry {
  switch (mark.type) {
    case 'circle': return circle(mark, ctx);
    case 'box': return box(mark, ctx);
    case 'underline': return underline(mark, ctx);
    case 'highlight': return highlight(mark, ctx);
    case 'strike': return strike(mark, ctx);
    case 'bracket': return bracket(mark, ctx);
    case 'arrow': return arrow(mark, ctx);
    case 'label': return label(mark, ctx);
    case 'scribble': return scribble(mark, ctx, scribblePoints ?? []);
  }
}
