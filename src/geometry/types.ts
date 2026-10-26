import type { Box, Point, Style } from '../types.ts';

/** A place in frame space. A point has width 0 and height 0. */
export interface Region {
  box: Box;
  shape: 'rect' | 'ellipse';
  isPoint: boolean;
}

/** One pen stroke before the pen is applied. Points are in frame space. */
export interface Skeleton {
  kind: 'line' | 'poly' | 'curve';
  pts: Point[];
  /** Share of the draw time of the mark. Default: the path length. */
  weight?: number;
}

export interface LabelLayout {
  lines: { text: string; x: number; y: number }[];
  fontSize: number;
  lineHeight: number;
  box: Box;
}

export interface MarkGeometry {
  layer: 'marks' | 'highlight';
  strokes: Skeleton[];
  /** Highlight band: a wide stroke along `d`. */
  band?: { d: string; width: number; opacity: number };
  text?: LabelLayout;
  /** Box of the thing the mark drew. */
  bounds: Region;
  /** Box of the target the mark points at. */
  targetBox: Box;
  arrow?: { start: Point; end: Point; tailDir: Point };
  /** Stroke size in px for the pen. */
  width: number;
}

export interface GeometryContext {
  style: Style;
  frame: { width: number; height: number };
  seed: number;
  /** Resolve a target to a region in frame space. */
  region(target: import('../types.ts').Target, forArrow?: boolean): Region;
  measure(text: string, size: number): number;
  /** Boxes a label should avoid, in frame space. */
  obstacles(): { marks: Box[]; text: Box[] };
  arrowOf(id: string): { start: Point; end: Point; tailDir: Point } | undefined;
}
