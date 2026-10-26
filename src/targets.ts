import type { Background, Box, Frame, Point, Target } from './types.ts';
import type { MarkGeometry, Region } from './geometry/types.ts';

/** Maps background space to frame space. */
export interface FitMap {
  scale: number;
  ox: number;
  oy: number;
}

export function fitBackground(bg: Background, frame: { width: number; height: number; fit?: Frame['fit'] }): FitMap {
  const sx = frame.width / bg.width;
  const sy = frame.height / bg.height;
  const scale = frame.fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  return { scale, ox: (frame.width - bg.width * scale) / 2, oy: (frame.height - bg.height * scale) / 2 };
}

export const toFrameBox = (m: FitMap, b: Box): Box => [b[0] * m.scale + m.ox, b[1] * m.scale + m.oy, b[2] * m.scale, b[3] * m.scale];
export const toFramePoint = (m: FitMap, p: Point): Point => [p[0] * m.scale + m.ox, p[1] * m.scale + m.oy];

export interface MarkRecord {
  id: string;
  geometry: MarkGeometry;
}

export interface ResolverDeps {
  map: FitMap;
  anchors: Record<string, Point | Box>;
  /** Box of a selector match in background space, or null when nothing matches. */
  selectorBox(selector: string): Box | null;
  mark(id: string): MarkRecord | undefined;
}

export function createResolver(deps: ResolverDeps) {
  const { map } = deps;
  const fromBox = (b: Box): Region => ({ box: toFrameBox(map, b), shape: 'rect', isPoint: false });
  const fromPoint = (p: Point): Region => {
    const [x, y] = toFramePoint(map, p);
    return { box: [x, y, 0, 0], shape: 'rect', isPoint: true };
  };
  const pointRegion = (p: Point): Region => ({ box: [p[0], p[1], 0, 0], shape: 'rect', isPoint: true });

  return function region(target: Target, forArrow = false): Region {
    if ('box' in target) return fromBox(target.box);
    if ('point' in target) return fromPoint(target.point);
    if ('selector' in target) {
      const b = deps.selectorBox(target.selector);
      if (!b) throw new Error(`Selector "${target.selector}" matches no element in the background.`);
      return fromBox(b);
    }
    if ('anchor' in target) {
      const a = deps.anchors[target.anchor];
      if (!a) throw new Error(`Anchor "${target.anchor}" is not in the anchor map.`);
      return a.length === 2 ? fromPoint(a as Point) : fromBox(a as Box);
    }
    const rec = deps.mark(target.mark);
    if (!rec) throw new Error(`Mark "${target.mark}" does not exist yet. A target can only name an earlier mark.`);
    const arrow = rec.geometry.arrow;
    if (arrow && target.end) return pointRegion(target.end === 'start' ? arrow.start : arrow.end);
    if (forArrow) return rec.geometry.bounds;
    return { box: rec.geometry.targetBox, shape: 'rect', isPoint: false };
  };
}
